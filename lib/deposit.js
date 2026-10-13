// Deposit multi-gateway. Pengguna hanya melihat NAMA METODE (mis. "QRIS"); di belakangnya admin mengatur RUTE (gateway) mana yang aktif.
// Untuk satu metode, rute aktif dipilih ACAK (berbobot) dan otomatis pindah ke rute lain kalau satu gagal.
//  - artapedia : API v1 Artapedia lama (QRIS)
//  - pakasir   : Pakasir API v2 (QRIS + Virtual Account)
//  - ditz      : Ditznesia / JasaOTP deposit QRIS
import {kv} from './db'
import {save} from './auth'
import {getSec} from './settings'
import {upDep,dz} from './providers'
import {notify,mask,rp,wibAt} from './telegram'
import {creditDeposit} from './bonus'
import {pushUser,msgDep,quiet} from './tgpush'
import {push as webPush,keyUser} from './push'
import {strukPng,strukUrl} from './strukimg'

export const ROUTES={artapedia:'Artapedia',pakasir:'Pakasir',ditz:'Ditznesia'}
const VA=(name,key)=>[key,{name,desc:'Transfer lewat Virtual Account '+name+' · saldo masuk otomatis',routes:['pakasir'],min:10000,max:50000000,va:1}]
export const METHODS=Object.fromEntries([
 ['qris',{name:'QRIS',desc:'Bayar pakai e-wallet / m-banking apa saja · saldo masuk otomatis',routes:['artapedia','pakasir','ditz'],min:0,max:10000000}],
 VA('BRI','bri_va'),VA('BNI','bni_va'),VA('CIMB Niaga','cimb_niaga_va'),VA('Permata','permata_va'),VA('Maybank','maybank_va'),
 VA('Bank Neo Commerce','bnc_va'),VA('Artha Graha','artha_graha_va'),VA('Sahabat Sampoerna','sampoerna_va')])

export const toMs=v=>{if(v==null||v==='')return 0;if(typeof v==='number')return v<1e12?v*1000:v;const t=Date.parse(v);return isNaN(t)?0:t}
const tmo=()=>AbortSignal.timeout(25000)

// ---------- gateway ----------
const pk=async()=>{const s=await getSec();return {base:(s.PAKASIR_BASE||'https://app.pakasir.com').replace(/\/+$/,''),slug:s.PAKASIR_SLUG,key:s.PAKASIR_KEY}}
const pkState=s=>{s=String(s||'').toLowerCase();return ['completed','success','paid','settlement'].includes(s)?'completed':['expired','kadaluarsa'].includes(s)?'expired':['canceled','cancelled','batal'].includes(s)?'canceled':['failed','gagal'].includes(s)?'failed':'pending'}
const dzS=s=>{s=String(s||'').toLowerCase();return s==='berhasil'||s==='completed'||s==='success'?'completed':s==='batal'||s==='canceled'?'canceled':s==='kadaluarsa'||s==='expired'?'expired':s==='gagal'||s==='failed'?'failed':'pending'}
const newId=()=>'ART'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,7).toUpperCase()
export const GW={
 artapedia:{ready:async()=>!!(await getSec()).ARTA_KEY,
  create:async(amount)=>{const ms=await upDep.methods(),a=Array.isArray(ms.methods)?ms.methods:[],prov=a[0]&&a[0].provider
   if(!prov)throw Error('Metode deposit Artapedia kosong');const d=await upDep.create(amount,prov)
   return {id:String(d.order_id),total:d.total_amount,fee:d.admin_fee,qr:d.qr_string,qrImg:d.qr_image,va:'',exp:d.expired_at}},
  check:async o=>String((await upDep.check(o.id)).status||'pending'),
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
  cancel:async o=>{try{await dz('/deposit/cancel',{id:o.id})}catch(e){}}}}

// ---------- metode & rute ----------
export const routeOn=(cfg,r)=>!!(cfg.dep.routes[r]&&cfg.dep.routes[r].on)
async function usable(cfg,m){const out=[];for(const r of METHODS[m].routes)if(routeOn(cfg,r)&&await GW[r].ready().catch(()=>false))out.push(r);return out}
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
export async function depCheck(o){
 let s=await GW[o.gw||'artapedia'].check(o)
 if(s==='pending'&&o.expMs&&Date.now()>o.expMs+120000)s='expired'
 return s}
export const depCancel=o=>GW[o.gw||'artapedia'].cancel(o)

// ---------- daftar deposit yang belum selesai ----------
// Dipakai cron untuk menyapu deposit SECARA LANGSUNG (tidak perlu memindai seluruh pengguna, yang dulu
// sering kehabisan waktu 60 detik sehingga deposit pengguna di urutan belakang tidak pernah dicek).
export const DPEND='dpend'
export const depPendAdd=async(id,uid)=>{try{await kv.sadd(DPEND,id+'|'+uid)}catch(e){}}
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
 try{await notify({photo:png,photoName:'struk-'+o.id+'.png',src:o.via==='telegram'?'bot':undefined,i:'✅',t:'Deposit sukses',st:'ok',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Bonus deposit',o.bonus?'+'+rp(o.bonus):''],['Bonus ajakan teman',o.refBonus?'+'+rp(o.refBonus):''],['Total masuk',rp(o.amount+(o.bonus||0)+(o.refBonus||0))],['Saldo sekarang',rp(u.balance)],['Metode',(METHODS[o.method]||{name:'QRIS'}).name],['Rute',ROUTES[o.gw]||'Artapedia'],['Dibuat',wibAt(o.at)]],note:'Saldo sudah masuk otomatis'})}catch(e){}
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
 if(['expired','canceled','failed'].includes(st)){o.status=st;await depPendRm(o.id);return true}
 return false}
