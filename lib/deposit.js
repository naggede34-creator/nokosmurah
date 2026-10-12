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
function shuffle(c){const a=[...c],o=[];while(a.length){const t=a.reduce((s,x)=>s+x.w,0);let n=Math.random()*t,i=0;for(;i<a.length-1;i++){n-=a[i].w;if(n<0)break}o.push(a.splice(i,1)[0].r)}return o}
// Buat deposit: rute acak berbobot, otomatis coba rute lain kalau gagal
export async function createDeposit(cfg,method,amount){
 const rs=await usable(cfg,method);if(!rs.length)throw Error('Metode deposit ini sedang tidak tersedia')
 let err=null
 for(const r of shuffle(rs.map(x=>({r:x,w:Math.max(1,Math.min(100,+(cfg.dep.routes[x]||{}).w||1))})))){
  try{const d=await GW[r].create(amount,method);return {gw:r,...d}}catch(e){err=e;try{await notify({i:'⚠️',t:'Rute deposit gagal',st:'fail',rows:[['Rute',ROUTES[r]],['Metode',METHODS[method].name],['Error',String(e.message).slice(0,200)]],note:rs.length>1?'Otomatis mencoba rute lain.':'Tidak ada rute lain yang aktif.'})}catch(_){}}}
 throw Error('Gagal membuat deposit: '+(err&&err.message||'semua rute bermasalah'))}

// ---------- status ----------
export async function depCheck(o){
 let s=await GW[o.gw||'artapedia'].check(o)
 if(s==='pending'&&o.expMs&&Date.now()>o.expMs+120000)s='expired'
 return s}
export const depCancel=o=>GW[o.gw||'artapedia'].cancel(o)
// Terapkan hasil cek status ke record deposit. Return true kalau ada perubahan (pemanggil wajib save(u)).
export async function applyDep(u,o,st){
 if(o.status!=='pending')return false
 if(st==='completed'){
  if(await kv.incr('tmp:dep:'+o.id)>1)return false // sedang diproses jalur lain (polling / cron / webhook)
  const f=await kv.get('u:'+u.id),fo=f&&(f.tx||[]).find(x=>x.id===o.id)
  if(fo&&fo.credited){o.status='completed';o.credited=true;o.bonus=fo.bonus;u.balance=f.balance;u.mut=f.mut;return true}
  o.status='completed';if(!o.credited)await creditDeposit(u,o)
  await notify({src:o.via==='telegram'?'bot':undefined,i:'✅',t:'Deposit sukses',st:'ok',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Bonus deposit',o.bonus?'+'+rp(o.bonus):''],['Bonus ajakan teman',o.refBonus?'+'+rp(o.refBonus):''],['Total masuk',rp(o.amount+(o.bonus||0)+(o.refBonus||0))],['Saldo sekarang',rp(u.balance)],['Metode',(METHODS[o.method]||{name:'QRIS'}).name],['Rute',ROUTES[o.gw]||'Artapedia'],['Dibuat',wibAt(o.at)]],note:'Saldo sudah masuk otomatis'})
  if(!quiet.has(o.id))await pushUser(u,msgDep(o,u),{inline_keyboard:[[{text:'🛒 Beli Nokos',callback_data:'buy',style:'success'},{text:'🏠 Menu',callback_data:'m',style:'primary'}]]})
  return true}
 if(['expired','canceled','failed'].includes(st)){o.status=st;return true}
 return false}
