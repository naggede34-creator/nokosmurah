// Deposit multi-gateway. Pengguna hanya melihat NAMA METODE (mis. "QRIS"); di belakangnya admin mengatur RUTE (gateway) mana yang aktif.
// Untuk satu metode, rute aktif dipilih ACAK (berbobot) dan otomatis pindah ke rute lain kalau satu gagal.
//  - artapedia : API v1 Artapedia lama (QRIS)
//  - pakasir   : Pakasir API v2 (QRIS + Virtual Account)
//  - ditz      : Ditznesia / JasaOTP deposit QRIS
import {kv} from './db'
import {save} from './auth'
import {getSec} from './settings'
import {upDep,dz} from './providers'
import * as AX from './austin'
import {notify,mask,rp,wibAt} from './telegram'
import {creditDeposit} from './bonus'
import {pushUser,msgDep,quiet} from './tgpush'
import {push as webPush,keyUser} from './push'
import {strukPng,strukUrl} from './strukimg'

export const ROUTES={artapedia:'Artapedia',pakasir:'Pakasir',ditz:'Ditznesia',austin:'AustinPay'}
// Rute yang boleh dipakai mesin rute V2. V2 sengaja hanya dua rute ini (permintaan admin).
export const ROUTES_V2=['pakasir','austin']
export const engineOf=cfg=>((cfg.dep||{}).engine==='v2'?'v2':'v1')
const VA=(name,key)=>[key,{name,desc:'Transfer lewat Virtual Account '+name+' · saldo masuk otomatis',routes:['pakasir'],min:10000,max:50000000,va:1}]
export const METHODS=Object.fromEntries([
 ['qris',{name:'QRIS',desc:'Bayar pakai e-wallet / m-banking apa saja · saldo masuk otomatis',routes:['artapedia','pakasir','ditz','austin'],min:0,max:10000000}],
 VA('BRI','bri_va'),VA('BNI','bni_va'),VA('CIMB Niaga','cimb_niaga_va'),VA('Permata','permata_va'),VA('Maybank','maybank_va'),
 VA('Bank Neo Commerce','bnc_va'),VA('Artha Graha','artha_graha_va'),VA('Sahabat Sampoerna','sampoerna_va')])

export const toMs=v=>{if(v==null||v==='')return 0;if(typeof v==='number')return v<1e12?v*1000:v;const t=Date.parse(v);return isNaN(t)?0:t}
const tmo=()=>AbortSignal.timeout(25000)

// ---------- gateway ----------
const pk=async()=>{const s=await getSec();return {base:(s.PAKASIR_BASE||'https://app.pakasir.com').replace(/\/+$/,''),slug:s.PAKASIR_SLUG,key:s.PAKASIR_KEY}}
// SATU penerjemah status untuk semua gateway. Dulu tiap gateway punya daftar kata sendiri dan
// rute Artapedia malah mengembalikan status mentah dari upstream — kalau upstream menjawab
// "success"/"paid"/"berhasil" (bukan persis "completed"), deposit yang SUDAH DIBAYAR tidak pernah
// dikreditkan. Satu daftar kata dipakai bersama supaya kejadian itu tidak terulang di rute mana pun.
const LUNAS=['completed','complete','success','successful','sukses','paid','payed','settlement','settled','berhasil','done','approved','lunas','selesai']
const KADALUARSA=['expired','expire','kadaluarsa','kedaluwarsa','timeout','habis']
const BATAL=['canceled','cancelled','cancel','batal','dibatalkan','void']
const GAGAL=['failed','failure','gagal','rejected','ditolak','error','denied']
export const normSt=v=>{const s=String(v==null?'':v).toLowerCase().trim()
 if(LUNAS.includes(s))return 'completed'
 if(KADALUARSA.includes(s))return 'expired'
 if(BATAL.includes(s))return 'canceled'
 if(GAGAL.includes(s))return 'failed'
 return 'pending'}
const pkState=normSt,axState=normSt,dzS=normSt
const newId=()=>'ART'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,7).toUpperCase()
export const GW={
 artapedia:{ready:async()=>!!(await getSec()).ARTA_KEY,
  create:async(amount)=>{const ms=await upDep.methods(),a=Array.isArray(ms.methods)?ms.methods:[],prov=a[0]&&a[0].provider
   if(!prov)throw Error('Metode deposit Artapedia kosong');const d=await upDep.create(amount,prov)
   return {id:String(d.order_id),total:d.total_amount,fee:d.admin_fee,qr:d.qr_string,qrImg:d.qr_image,va:'',exp:d.expired_at}},
  check:async o=>{const d=await upDep.check(o.id)
   // beberapa upstream menaruh statusnya di nama lain, dan kata-katanya bisa macam-macam
   return normSt(d&&(d.status??d.state??d.payment_status??d.transaction_status))},
  cancel:o=>upDep.cancel(o.id)},
 pakasir:{ready:async()=>{const p=await pk();return !!(p.slug&&p.key)},
  create:async(amount,method)=>{const p=await pk(),id=newId()
   const r=await fetch(`${p.base}/api/v2/create-transaction/${encodeURIComponent(p.slug)}/${id}`,{method:'POST',headers:{'Content-Type':'application/json','X-Api-Key':p.key},body:JSON.stringify({method,amount}),signal:tmo()})
   const j=await r.json().catch(()=>null),d=j&&(j.data||j)
   if(!r.ok||!d||!d.txn_id)throw Error((j&&(j.error||j.message))||('Pakasir error '+r.status))
   return {id,total:d.total_payment||amount,fee:d.fee||0,qr:d.qr_string||'',qrImg:'',va:d.va_number||'',exp:d.expired_at}},
  check:async o=>{const p=await pk()
   const r=await fetch(`${p.base}/api/transactiondetail?project=${encodeURIComponent(p.slug)}&amount=${o.amount}&order_id=${encodeURIComponent(o.id)}&api_key=${encodeURIComponent(p.key)}`,{cache:'no-store',signal:tmo()})
   const j=await r.json().catch(()=>null);if(!r.ok)throw Error('Pakasir cek status '+r.status)
   return pkState(j&&((j.transaction&&j.transaction.status)||j.status))},
  cancel:async o=>{try{const p=await pk();await fetch(p.base+'/api/transactioncancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project:p.slug,order_id:o.id,amount:o.amount,api_key:p.key}),signal:tmo()})}catch(e){}}},
 ditz:{ready:async()=>!!(await getSec()).DITZ_KEY,
  create:async(amount)=>{const d=await dz('/deposit/create',{nominal:amount})
   if(!d||!d.id)throw Error('Respons deposit Ditznesia tidak lengkap')
   return {id:String(d.id),total:d.total_bayar||amount,fee:Math.max(0,(+d.total_bayar||amount)-(+d.total_diterima||amount)),qr:'',qrImg:d.qr_link||'',va:'',exp:d.expires_at_ms}},
  check:async o=>{return dzS((await dz('/deposit/status',{id:o.id})).status)},
  cancel:async o=>{try{await dz('/deposit/cancel',{id:o.id})}catch(e){}}},
 // AustinPay: QRIS saja. Nominal yang harus dibayar (deposit.amount) SUDAH termasuk biaya + kode unik,
 // jadi selisihnya kita catat sebagai biaya layanan supaya struk & tagihan pengguna cocok dengan QR-nya.
 austin:{ready:()=>AX.ready().catch(()=>false),
  create:async(amount)=>{const d=(await AX.depositCreate(amount)).deposit||{}
   if(!d.transaction_id)throw Error('AustinPay tidak mengembalikan ID transaksi')
   const total=Math.floor(+d.amount||amount)
   return {id:String(d.transaction_id),total,fee:Math.max(0,total-amount),qr:d.qr_string||'',qrImg:d.qr_image||'',va:'',exp:d.expired_at}},
  check:async o=>axState((await AX.depositCheck(o.id)).status),
  cancel:async o=>{try{await AX.depositCancel(o.id)}catch(e){}}}}

// ---------- metode & rute ----------
// Saklar rute dibaca dari mesin yang sedang dipakai: V1 pakai cfg.dep.routes, V2 pakai cfg.dep.routes2.
export const switches=cfg=>engineOf(cfg)==='v2'?((cfg.dep||{}).routes2||{}):((cfg.dep||{}).routes||{})
// Rute yang boleh dipakai satu metode pada mesin yang sedang aktif.
export const poolOf=(cfg,m)=>engineOf(cfg)==='v2'?METHODS[m].routes.filter(r=>ROUTES_V2.includes(r)):METHODS[m].routes
export const routeOn=(cfg,r)=>{const sw=switches(cfg);return !!(sw[r]&&sw[r].on)}
async function usable(cfg,m){const out=[];for(const r of poolOf(cfg,m))if(routeOn(cfg,r)&&await GW[r].ready().catch(()=>false))out.push(r);return out}
export const limitsOf=(cfg,m)=>({min:Math.max(+cfg.dep.min||2000,METHODS[m].min),max:Math.min(+cfg.dep.max||10000000,METHODS[m].max)})
// Daftar metode yang tampil ke pengguna: aktif di admin DAN punya minimal satu rute siap.
export async function methodsList(cfg){const out=[]
 for(const k of Object.keys(METHODS)){if(!(cfg.dep.methods[k]&&cfg.dep.methods[k].on))continue
  if(!(await usable(cfg,k)).length)continue;const l=limitsOf(cfg,k)
  out.push({provider:k,name:METHODS[k].name,description:METHODS[k].desc,type:METHODS[k].va?'va':'qris',min:l.min,max:l.max})}
 return out}
export async function readiness(cfg){const o={};for(const r of Object.keys(ROUTES))o[r]=await GW[r].ready().catch(()=>false);return o}
// Acak murni (Fisher-Yates): setiap rute yang aktif punya peluang SAMA besar, tanpa bobot.
// Jadi urutannya benar-benar berganti-ganti: kadang Pakasir, kadang Artapedia, kadang Ditznesia.
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
// Buat deposit: rute diacak merata, otomatis coba rute lain kalau satu gagal
export async function createDeposit(cfg,method,amount){
 const rs=await usable(cfg,method);if(!rs.length)throw Error('Metode deposit ini sedang tidak tersedia')
 let err=null
 for(const r of shuffle(rs)){
  try{const d=await GW[r].create(amount,method);return {gw:r,...d}}catch(e){err=e;try{await notify({i:'⚠️',t:'Rute deposit gagal',st:'fail',rows:[['Rute',ROUTES[r]],['Metode',METHODS[method].name],['Error',String(e.message).slice(0,200)]],note:rs.length>1?'Otomatis mencoba rute lain.':'Tidak ada rute lain yang aktif.'})}catch(_){}}}
 throw Error('Gagal membuat deposit: '+(err&&err.message||'semua rute bermasalah'))}

// ---------- status ----------
// Tenggang 15 menit setelah batas bayar sebelum kita sendiri menyatakan kedaluwarsa:
// QRIS sering masih bisa dibayar beberapa menit setelah waktunya habis, dan dulu deposit
// yang dibayar mepet langsung dicap kedaluwarsa lalu tidak pernah dicek lagi.
export const GRACE=15*60000
export async function depCheck(o){
 let s=await GW[o.gw||'artapedia'].check(o)
 if(s==='pending'&&o.expMs&&Date.now()>o.expMs+GRACE)s='expired'
 return s}
export const depCancel=o=>GW[o.gw||'artapedia'].cancel(o)

// ---------- daftar deposit yang belum selesai ----------
// Dipakai cron untuk menyapu deposit SECARA LANGSUNG (tidak perlu memindai seluruh pengguna, yang dulu
// sering kehabisan waktu 60 detik sehingga deposit pengguna di urutan belakang tidak pernah dicek).
export const DPEND='dpend'
export const DLATE='dlate'
export const depPendAdd=async(id,uid)=>{try{await kv.sadd(DPEND,id+'|'+uid)}catch(e){}}
// Deposit yang kedaluwarsa/batal TIDAK langsung dilupakan: masuk daftar susulan dan masih
// dicek berkala selama 24 jam. Pengguna yang membayar telat tetap mendapatkan saldonya.
export const depLateAdd=async(id,uid)=>{try{await kv.sadd(DLATE,id+'|'+uid+'|'+Date.now())}catch(e){}}
export const depLateRm=async id=>{try{const l=(await kv.get(DLATE))||[];for(const e of l)if(String(e).split('|')[0]===String(id))await kv.srem(DLATE,e)}catch(e){}}
export const depLateList=async()=>((await kv.get(DLATE))||[]).map(e=>{const [id,uid,at]=String(e).split('|');return {id,uid,at:+at||0}}).filter(x=>x.id&&x.uid)
export const depPendRm=async id=>{try{const l=(await kv.get(DPEND))||[];for(const e of l)if(String(e).split('|')[0]===String(id))await kv.srem(DPEND,e)}catch(e){}}
export const depPendList=async()=>((await kv.get(DPEND))||[]).map(e=>{const [id,uid]=String(e).split('|');return {id,uid}}).filter(x=>x.id&&x.uid)

// Notifikasi deposit sukses. Dipanggil SETELAH saldo tersimpan, dan tidak pernah melempar:
// kegagalan Telegram tidak boleh membuat saldo yang sudah masuk hilang lagi.
async function depNotify(u,o){
 // struk digambar sekali, dipakai untuk channel, DM Telegram, dan notifikasi HP
 const sec=await getSec().catch(()=>({}))
 const base=String(sec.SITE_URL||'').replace(/\/+$/,'')
 const host=base.replace(/^https?:\/\//,'')||'artapedia.id'
 let png=null
 try{png=await strukPng({order_id:o.id,amount:o.amount,total_amount:o.total,bonus:o.bonus||0,
  method_name:(METHODS[o.method]||METHODS.qris).name,status:'completed',createdAt:new Date(o.at).toISOString()},'deposit',host)}catch(e){}
 // kalau ini pelanggan bot reseller, channel admin diberi tahu toko mana yang dapat deposit
 let rsRow=[];if(u.rs){try{rsRow=await (await import('./reseller')).rows(u.rs)}catch(e){}}
 try{await notify({photo:png,photoName:'struk-'+o.id+'.png',src:o.via==='telegram'?'bot':undefined,i:'✅',t:'Deposit sukses'+(rsRow.length?' (reseller)':''),st:'ok',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Bonus deposit',o.bonus?'+'+rp(o.bonus):''],['Bonus ajakan teman',o.refBonus?'+'+rp(o.refBonus):''],['Total masuk',rp(o.amount+(o.bonus||0)+(o.refBonus||0))],['Saldo sekarang',rp(u.balance)],['Metode',(METHODS[o.method]||{name:'QRIS'}).name],['Rute',ROUTES[o.gw]||'Artapedia'],['Dibuat',wibAt(o.at)],...rsRow],note:'Saldo sudah masuk otomatis'})}catch(e){}
 // deposit pelanggan bot reseller: kabari juga channel milik reseller itu
 try{if(u.rs){const RS=await import('./reseller');RS.chDep(u.rs,o,'lunas',u.balance,png).catch(()=>{})}}catch(e){}
 try{if(!quiet.has(o.id))await pushUser(u,msgDep(o,u),{inline_keyboard:[[{text:'🛒 Beli Nokos',callback_data:'buy',style:'success'},{text:'🏠 Menu',callback_data:'m',style:'primary'}]]},png)}catch(e){}
 try{await webPush(keyUser(u.id),{t:'✅ Deposit berhasil',b:'Saldo '+rp(o.amount+(o.bonus||0)+(o.refBonus||0))+' sudah masuk. Saldo sekarang '+rp(u.balance)+'.',u:'/dashboard',tag:'dep-'+o.id,
  img:await strukUrl(base,'deposit',u.id,o.id).catch(()=>'')})}catch(e){}}

// Terapkan hasil cek status ke record deposit. Return true kalau ada perubahan (pemanggil boleh save(u) lagi, aman).
// Jaminan: begitu gateway bilang LUNAS, saldo disimpan lebih dulu (save), baru notifikasi dikirim.
// Kunci dilepas di blok finally, jadi percobaan berikutnya (polling / cron / webhook) tidak pernah terblokir
// oleh proses yang gagal di tengah jalan -- ini penyebab deposit "kadang masuk kadang tidak".
export async function applyDep(u,o,st){
 if(o.status!=='pending')return false
 if(st==='completed'){
  const fresh=async()=>{const f=await kv.get('u:'+u.id);return f&&(f.tx||[]).find(x=>x.type==='deposit'&&x.id===o.id)}
  const adopt=fo=>{o.status='completed';o.credited=true;if(fo.bonus!=null)o.bonus=fo.bonus;if(fo.refBonus!=null)o.refBonus=fo.refBonus;return true}
  if(!await kv.lock('dep:'+o.id,30000)){
   const fo=await fresh();return fo&&fo.credited?adopt(fo):false}   // jalur lain sedang memproses
  try{
   const fo=await fresh()
   if(fo&&fo.credited)return adopt(fo)                              // sudah dikreditkan jalur lain
   o.status='completed';if(!o.credited)await creditDeposit(u,o)
   await save(u)                                                    // SIMPAN DULU, sebelum notifikasi apa pun
   await depPendRm(o.id)
   await depNotify(u,o)
   return true}
  finally{await kv.unlock('dep:'+o.id)}}
 if(['expired','canceled','failed'].includes(st)){o.status=st;await depPendRm(o.id)
  // dibatalkan sendiri oleh pengguna tidak perlu dikejar; kedaluwarsa/gagal masih dicek susulan
  if(st!=='canceled')await depLateAdd(o.id,u.id)
  return true}
 return false}

// Cek ulang paksa — dipakai tombol "Saya sudah bayar" dan sapuan susulan.
// Berbeda dari jalur biasa: deposit yang sudah dicap kedaluwarsa/gagal pun ikut ditanya ulang
// ke gateway, karena uangnya bisa saja benar-benar masuk setelah itu.
export async function recheckDep(u,o){
 if(o.status==='completed')return {status:'completed',changed:false}
 if(o.status==='canceled')return {status:'canceled',changed:false}
 let raw='pending'
 try{raw=await GW[o.gw||'artapedia'].check(o)}catch(e){return {status:o.status,changed:false,error:e.message}}
 if(raw==='completed'){
  const was=o.status
  o.status='pending'                      // supaya applyDep mau memprosesnya lagi
  const ok=await applyDep(u,o,'completed')
  if(!ok)o.status=was
  await depLateRm(o.id)
  return {status:o.status,changed:ok}}
 // belum lunas: kalau sudah lewat tenggang, barulah dicap kedaluwarsa
 if(o.status==='pending'&&o.expMs&&Date.now()>o.expMs+GRACE){
  const ch=await applyDep(u,o,'expired');return {status:o.status,changed:ch}}
 return {status:o.status,changed:false}}
