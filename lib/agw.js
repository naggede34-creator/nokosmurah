// ===========================================================================
// ADMIN GATEWAY (SMP Payment) — payment gateway KHUSUS ADMIN.
//
// Pemilik situs (admin) menerbitkan API key untuk aplikasi/developer miliknya sendiri.
// Aplikasi itu memanggil API (app/api/agw/[...p]/route.js) untuk membuat tagihan QRIS dinamis,
// mengecek status, dan menerima webhook saat lunas. Uangnya langsung masuk ke akun SMP Payment
// admin (tidak ada saldo / dompet di sini), jadi tidak ada penarikan dana.
//
// Mesin pembayaran = lib/smp.js (QRIS statis -> dinamis + KODE UNIK, pelunasan lewat callback
// /api/callbackqris/<SMP_SECRET>). Tagihan gateway ditandai meta {kind:'agw'} supaya callback
// tahu tagihan itu milik gateway ini, bukan deposit pengguna.
//
// Penyimpanan (kv):
//   agw:cfg        -> pengaturan {on,min,max,expMin}
//   agw:keys       -> daftar API key [{id,name,key,secret,on,ipw,hook,at}]
//   agwk:<key>     -> id key (pencarian cepat saat request API masuk)
//   agwi:<id>      -> tagihan (id = id tagihan SMP)
//   agwo:<kid>:<order_id> -> id tagihan (idempotensi order_id milik aplikasi)
//   agwh:<id>      -> status pengiriman webhook terakhir
//   agw:log / agw:log:<kid> -> daftar id tagihan terbaru (maks 1000)
//   agw:pend       -> id tagihan yang belum final (disapu cron)
//   agw:hpend      -> id tagihan yang webhooknya belum terkirim (diulang cron)
//   agw:stat       -> agregat harian {paidN,paidSum,days:{YYYY-MM-DD:{n,sum}}}
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {getSec} from './settings'
import {checkUrl,sign,newSecret} from './webhook'
import {smpCreate,smpCancel,smpReady,PAID,RRN,ORPHAN,EXP_MIN} from './smp'
import {notify,rp} from './telegram'
import {bg} from './bg'

export const DEF={on:true,min:1000,max:10000000,expMin:15}
export const GRACE_MIN=20                 // pembayaran yang telat sampai sekian menit setelah kedaluwarsa tetap diterima
export const MAX_ATTEMPT=6                // percobaan kirim webhook
const BACKOFF=[0,60,300,900,3600,10800]   // detik sebelum percobaan ke-n
const LOGMAX=1000

export class AErr extends Error{constructor(m,code='bad_request',status=400){super(m);this.code=code;this.status=status}}

const KEYS='agw:keys',LOG='agw:log',PEND='agw:pend',HPEND='agw:hpend',STAT='agw:stat'
const INV=id=>'agwi:'+id,HK=id=>'agwh:'+id,ORD=(k,o)=>'agwo:'+k+':'+o
const rid=n=>crypto.randomBytes(n).toString('hex')
export const newKey=()=>'agw_live_'+rid(20)
export const newSec=()=>'agw_sec_'+rid(24)
const rxKey=/^agw_live_[a-f0-9]{40}$/

// ---------- pengaturan ----------
export async function cfgGet(){
 const c=(await kv.get('agw:cfg'))||{}
 return {...DEF,...c,expMin:Math.min(EXP_MIN,Math.max(2,Math.floor(+c.expMin||DEF.expMin)))}}
export async function cfgSave(v){
 const n=(x,lo,hi,d)=>{x=Math.floor(+x);return isNaN(x)?d:Math.min(hi,Math.max(lo,x))}
 const c={on:!!v.on,min:n(v.min,500,10000000,DEF.min),max:n(v.max,1000,100000000,DEF.max),expMin:n(v.expMin,2,EXP_MIN,DEF.expMin)}
 if(c.max<c.min)throw new AErr('Nominal maksimal harus lebih besar dari minimal')
 await kv.set('agw:cfg',c);return cfgGet()}

// ---------- API key ----------
// Perubahan daftar key selalu lewat sini: baca ulang -> ubah -> simpan hanya kalau revisi belum berubah.
async function mutKeys(fn){
 for(let i=0;i<6;i++){
  const list=(await kv.get(KEYS))||[],rev=list.__rev||0
  const out=fn(list);if(out===false)return {list,out:false}
  if(await kv.casSet(KEYS,[...list],rev))return {list,out}
  await new Promise(r=>setTimeout(r,60+i*60))}
 throw new AErr('Gagal menyimpan data key, coba lagi',500)}
export const listKeys=async()=>(await kv.get(KEYS))||[]
export const keyById=async id=>(await listKeys()).find(x=>x.id===id)||null
export async function byKey(key){
 const k=String(key||'').trim();if(!rxKey.test(k))return null
 const id=await kv.get('agwk:'+k);if(!id)return null
 const o=await keyById(id);return o&&o.key===k?o:null}
const cleanName=s=>String(s||'').replace(/[<>]/g,'').trim().slice(0,40)
export async function createKey(name){
 name=cleanName(name);if(!name)throw new AErr('Isi nama aplikasi / developer dulu')
 const k={id:'k'+rid(5),name,key:newKey(),secret:'',on:true,ipw:[],hook:{url:'',secret:'',on:false},at:Date.now()}
 const {list}=await mutKeys(l=>{if(l.length>=50)throw new AErr('Maksimal 50 API key');l.push(k);return true})
 await kv.set('agwk:'+k.key,k.id);return k}
export async function patchKey(id,fn){
 let found=null
 const {out}=await mutKeys(l=>{const k=l.find(x=>x.id===id);if(!k)throw new AErr('Key tidak ditemukan',  'not_found',404);found=k;return fn(k)})
 return found}
export const renameKey=(id,name)=>{name=cleanName(name);if(!name)throw new AErr('Nama tidak boleh kosong');return patchKey(id,k=>{k.name=name;return true})}
export const setKeyOn=(id,on)=>patchKey(id,k=>{k.on=!!on;return true})
export async function regenKey(id){
 const cur=await keyById(id);if(!cur)throw new AErr('Key tidak ditemukan','not_found',404)
 const oldKey=cur.key                       // disalin dulu: objek `cur` bisa ikut berubah saat key diganti
 const nk=newKey()
 await kv.set('agwk:'+nk,id)                // peta key baru dibuat SEBELUM key lama dicabut: tidak ada celah tanpa key
 const k=await patchKey(id,x=>{x.key=nk;return true})
 await kv.del('agwk:'+oldKey);return k}
export async function setSecretOn(id,on){return patchKey(id,k=>{k.secret=on?newSec():'';return true})}
export async function setIpw(id,raw){
 const net=await import('net')
 const list=[...new Set(String(raw||'').split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean))]
 if(list.length>20)throw new AErr('Maksimal 20 IP')
 for(const ip of list)if(!net.isIP(ip))throw new AErr('IP tidak valid: '+ip)
 return patchKey(id,k=>{k.ipw=list;return true})}
export async function setHook(id,url,on){
 url=String(url||'').trim()
 if(url){const c=await checkUrl(url);if(!c.ok)throw new AErr(c.error);url=c.url}
 if(on&&!url)throw new AErr('Isi URL webhook dulu')
 return patchKey(id,k=>{k.hook={url,secret:k.hook&&k.hook.secret||(url?newSecret():''),on:!!on&&!!url};return true})}
export const regenHookSecret=id=>patchKey(id,k=>{k.hook={...(k.hook||{url:'',on:false}),secret:newSecret()};return true})
export async function delKey(id){
 const k=await keyById(id);if(!k)throw new AErr('Key tidak ditemukan','not_found',404)
 await mutKeys(l=>{const i=l.findIndex(x=>x.id===id);if(i<0)return false;l.splice(i,1);return true})
 await kv.del('agwk:'+k.key);return true}

// ---------- log & statistik ----------
async function pushLog(kid,id){
 for(const key of [LOG,LOG+':'+kid]){
  for(let i=0;i<6;i++){
   const l=(await kv.get(key))||[],rev=l.__rev||0
   if(await kv.casSet(key,[id,...l].slice(0,LOGMAX),rev))break
   await new Promise(r=>setTimeout(r,40+i*50))}}}
const day=ms=>new Date(ms+7*36e5).toISOString().slice(0,10)       // hari menurut WIB
async function bump(amount,ms){
 for(let i=0;i<6;i++){
  const s=(await kv.get(STAT))||{paidN:0,paidSum:0,days:{}},rev=s.__rev||0
  const o={paidN:(+s.paidN||0)+1,paidSum:(+s.paidSum||0)+amount,days:{...(s.days||{})}},d=day(ms)
  o.days[d]={n:((o.days[d]||{}).n||0)+1,sum:((o.days[d]||{}).sum||0)+amount}
  const ks=Object.keys(o.days).sort();while(ks.length>45)delete o.days[ks.shift()]
  if(await kv.casSet(STAT,o,rev))return
  await new Promise(r=>setTimeout(r,40+i*50))}}

// ---------- tagihan ----------
export const getInvoice=id=>kv.get(INV(String(id||'').slice(0,60)))
const ORDER_RX=/^[A-Za-z0-9._:-]{1,64}$/

export async function createInvoice(k,b){
 const c=await cfgGet()
 if(!c.on)throw new AErr('Gateway sedang dinonaktifkan admin','gateway_off',503)
 if(!await smpReady())throw new AErr('SMP Payment belum dikonfigurasi admin','smp_not_ready',503)
 const amount=Math.floor(+b.amount)
 if(!(amount>=c.min&&amount<=c.max))throw new AErr(`Nominal minimal Rp${c.min.toLocaleString('id-ID')} dan maksimal Rp${c.max.toLocaleString('id-ID')}`,'invalid_amount',422)
 let orderId=b.order_id==null?'':String(b.order_id).trim()
 if(orderId&&!ORDER_RX.test(orderId))throw new AErr('order_id hanya boleh huruf, angka, titik, titik dua, garis bawah, strip (maks 64 karakter)','invalid_order_id',422)
 const desc=String(b.description||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,100)
 const cname=String(b.customer_name||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,60)
 let meta=b.metadata==null?null:b.metadata
 if(meta!=null&&(typeof meta!=='object'||JSON.stringify(meta).length>1024))throw new AErr('metadata harus objek JSON maksimal 1 KB','invalid_metadata',422)
 const lk='agw:c:'+k.id+':'+(orderId||rid(6))
 if(!await kv.lock(lk,20000))throw new AErr('Permintaan dengan order_id yang sama sedang diproses','busy',409)
 try{
  if(orderId){
   const eid=await kv.get(ORD(k.id,orderId))
   if(eid){let ex=await checkInvoice(eid)
    if(ex&&ex.status==='paid')throw new AErr('order_id ini sudah dibayar','order_paid',409)
    if(ex&&ex.status==='pending'){if(ex.amount!==amount)throw new AErr('order_id ini masih punya tagihan aktif dengan nominal berbeda. Batalkan dulu atau pakai order_id baru.','order_conflict',409)
     return {inv:ex,existing:true}}}}
  const r=await smpCreate(amount,{kind:'agw',kid:k.id})
  const now=Date.now()
  const inv={id:r.id,keyId:k.id,keyName:k.name,orderId,desc,customer:cname,meta,amount,total:r.total,unique:r.fee,
   qr:r.qr||'',qrImg:r.qrImg||'',status:'pending',at:now,expMs:now+c.expMin*60000,paidAt:0,rrn:'',payer:'',issuer:''}
  await kv.set(INV(inv.id),inv)
  if(orderId)await kv.set(ORD(k.id,orderId),inv.id)
  await kv.sadd(PEND,inv.id);await pushLog(k.id,inv.id)
  return {inv,existing:false}}
 finally{await kv.unlock(lk)}}

// Tampilan untuk API publik.
export const view=(inv,extra={})=>({
 invoice_id:inv.id,order_id:inv.orderId||null,status:inv.status,amount:inv.amount,unique_code:inv.unique,total_pay:inv.total,
 description:inv.desc||'',customer_name:inv.customer||'',metadata:inv.meta||null,
 qr_string:inv.qr||'',qr_image:inv.qr?'https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data='+encodeURIComponent(inv.qr):(inv.qrImg||''),
 created_at:new Date(inv.at).toISOString(),expired_at:new Date(inv.expMs).toISOString(),
 paid_at:inv.paidAt?new Date(inv.paidAt).toISOString():null,
 payer_name:inv.payer||null,issuer:inv.issuer||null,reference:inv.rrn||null,...extra})

// Status: pending -> paid (lewat callback) / expired (lewat waktu) / canceled.
// Aman dipanggil berbarengan dan berulang.
export async function checkInvoice(id){
 let inv=await getInvoice(id);if(!inv)return null
 if(inv.status==='paid'||inv.status==='canceled')return inv
 // penanda lunas dari callback SMP sudah ada tapi tagihan belum sempat ditandai (jarang: fungsi mati di tengah)
 const p=await kv.get(PAID(inv.id))
 if(p){const r=await paidBySmp(inv.id,inv.total,{rrn:p.rrn||'',payer:p.payer||'',issuer:p.issuer||'',at:p.at});if(r.ok)return getInvoice(id)}
 if(inv.status==='pending'&&Date.now()>inv.expMs)inv=await expire(inv.id)||inv
 return inv}

async function expire(id){
 if(!await kv.lock('agw:pay:'+id,15000))return getInvoice(id)
 try{const inv=await getInvoice(id);if(!inv||inv.status!=='pending'||Date.now()<=inv.expMs)return inv
  inv.status='expired';inv.expAt=Date.now();await kv.set(INV(id),inv)
  bg(fire(inv,'invoice.expired'))
  return inv}
 finally{await kv.unlock('agw:pay:'+id)}}

// Dipanggil callback SMP. nominal = total yang dibayar. TIDAK PERNAH menandai lunas dua kali.
export async function paidBySmp(id,nominal,info){
 if(!await kv.lock('agw:pay:'+id,20000))return {busy:true}
 try{
  const inv=await getInvoice(id);if(!inv)return {ok:false}
  if(inv.status==='paid'){
   // callback ulang untuk pembayaran yang sama = aman; pembayaran LAIN dengan total sama = jangan ditelan
   return inv.rrn&&info.rrn&&inv.rrn!==info.rrn?{ok:false,dup:true}:{ok:true,dup:true}}
  if(inv.status==='canceled'||inv.total!==nominal)return {ok:false}
  const was=inv.status
  inv.status='paid';inv.paidAt=Date.now();inv.rrn=String(info.rrn||'');inv.payer=String(info.payer||'');inv.issuer=String(info.issuer||'')
  if(was==='expired')inv.late=true
  await kv.set(INV(id),inv);await kv.srem(PEND,id)
  await bump(inv.amount,inv.paidAt).catch(()=>{})
  bg(fire(inv,'invoice.paid'))
  bg(notify({i:'🏦',t:'Gateway SMP: pembayaran masuk',st:'ok',id:['Invoice',inv.id],
   rows:[['Aplikasi',inv.keyName],['Order ID',inv.orderId||'-'],['Nominal',rp(inv.amount)],['Total dibayar',rp(inv.total)],['Pembayar',inv.payer||'-']],
   note:was==='expired'?'Dibayar setelah kedaluwarsa, tetap diterima.':''}).catch(()=>{}))
  return {ok:true}}
 finally{await kv.unlock('agw:pay:'+id)}}

export async function cancelInvoice(id,keyId){
 if(!await kv.lock('agw:pay:'+id,15000))throw new AErr('Tagihan sedang diproses, coba lagi','busy',409)
 try{
  const inv=await getInvoice(id)
  if(!inv||(keyId&&inv.keyId!==keyId))throw new AErr('Tagihan tidak ditemukan','not_found',404)
  if(inv.status==='paid')throw new AErr('Tagihan sudah dibayar, tidak bisa dibatalkan','already_paid',409)
  if(inv.status==='canceled')return inv
  if(await kv.get(PAID(inv.id)))throw new AErr('Pembayaran untuk tagihan ini sudah masuk, tidak bisa dibatalkan','already_paid',409)
  inv.status='canceled';inv.canceledAt=Date.now();await kv.set(INV(id),inv)
  await smpCancel({id:inv.id,total:inv.total}).catch(()=>{});await kv.srem(PEND,id)
  return inv}
 finally{await kv.unlock('agw:pay:'+id)}}

// Admin: tandai lunas manual (mis. pembayaran sudah dicek di mutasi SMP tapi callback tidak sampai).
export async function manualPaid(id,note){
 const inv=await getInvoice(id);if(!inv)throw new AErr('Tagihan tidak ditemukan','not_found',404)
 if(inv.status==='paid')throw new AErr('Tagihan ini sudah lunas')
 if(inv.status==='canceled')throw new AErr('Tagihan sudah dibatalkan')
 const r=await paidBySmp(id,inv.total,{rrn:'manual-'+Date.now().toString(36),payer:String(note||'ditandai admin').slice(0,40),issuer:'ADMIN'})
 if(r.busy)throw new AErr('Sedang diproses, coba lagi','busy',409)
 if(!r.ok)throw new AErr('Gagal menandai lunas')
 await kv.set(PAID(id),{rrn:'manual',at:Date.now(),manual:1})
 return getInvoice(id)}

// Admin: kaitkan pembayaran SMP yang masuk tanpa tagihan (daftar 'smp:orphan') ke satu tagihan gateway.
export async function attachOrphan(rrn,id){
 const l=(await kv.get(ORPHAN))||[],o=l.find(x=>x.rrn===rrn)
 if(!o)throw new AErr('Pembayaran tidak ditemukan di daftar',  'not_found',404)
 const inv=await getInvoice(id);if(!inv)throw new AErr('Tagihan tidak ditemukan','not_found',404)
 if(inv.total!==o.nominal)throw new AErr(`Nominal tidak cocok: pembayaran ${rp(o.nominal)}, tagihan ${rp(inv.total)}`)
 if(inv.status==='paid'||inv.status==='canceled')throw new AErr('Tagihan sudah '+inv.status)
 const r=await paidBySmp(id,o.nominal,{rrn:o.rrn,payer:o.payer,issuer:o.issuer})
 if(!r.ok)throw new AErr(r.busy?'Sedang diproses, coba lagi':'Gagal mengaitkan pembayaran')
 await kv.set(PAID(id),o);await kv.set(RRN(o.rrn),{id,agw:1,at:Date.now()})
 await kv.set(ORPHAN,l.filter(x=>x.rrn!==rrn))
 return getInvoice(id)}

// ---------- webhook ----------
const URL_OK=async u=>{const c=await checkUrl(u);return c.ok?c.url:''}
export const payload=(inv,event)=>({event,...view(inv)})
async function post(url,secret,event,body,delivery){
 const raw=JSON.stringify(body),ts=String(Math.floor(Date.now()/1000))
 const r=await fetch(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(7000),
  headers:{'Content-Type':'application/json','User-Agent':'Artapedia-AGW/1.0','X-AGW-Event':event,'X-AGW-Delivery':delivery,'X-AGW-Timestamp':ts,'X-AGW-Signature':sign(secret,ts,raw)},body:raw})
 return r.status}
// Kirim satu kali, catat hasilnya. Percobaan ulang dilakukan cron (sweep) dengan jeda bertahap.
export async function fire(inv,event,force){
 const k=await keyById(inv.keyId),h=k&&k.hook
 if(!h||!h.on||!h.url||!h.secret)return {skipped:true}
 const prev=(await kv.get(HK(inv.id)))||{},n=(prev.event===event?+prev.n||0:0)+1
 const st={event,n,ok:false,code:0,err:'',at:Date.now(),next:0}
 const url=await URL_OK(h.url)
 if(!url)st.err='URL webhook tidak lolos pemeriksaan'
 else{try{const code=await post(url,h.secret,event,payload(inv,event),inv.id+':'+n)
   st.code=code;st.ok=code>=200&&code<300;if(!st.ok)st.err='Balasan HTTP '+code}
  catch(e){st.err=String(e.name==='TimeoutError'?'Timeout (7 detik)':e.message||'gagal').slice(0,120)}}
 if(!st.ok&&n<MAX_ATTEMPT)st.next=Date.now()+BACKOFF[Math.min(n,BACKOFF.length-1)]*1000
 await kv.set(HK(inv.id),st)
 if(st.ok||n>=MAX_ATTEMPT)await kv.srem(HPEND,inv.id);else await kv.sadd(HPEND,inv.id)
 return st}
export const hookState=id=>kv.get(HK(id))
export async function testHook(k){
 if(!k.hook||!k.hook.url||!k.hook.secret)throw new AErr('Webhook belum diatur untuk key ini')
 const url=await URL_OK(k.hook.url);if(!url)throw new AErr('URL webhook tidak lolos pemeriksaan')
 const body={event:'webhook.test',message:'Tes webhook dari Admin Gateway',key_name:k.name,time:new Date().toISOString()}
 try{const code=await post(url,k.hook.secret,'webhook.test',body,'test-'+rid(4));return {ok:code>=200&&code<300,code}}
 catch(e){return {ok:false,code:0,error:String(e.name==='TimeoutError'?'Timeout (7 detik)':e.message||'gagal').slice(0,120)}}}
export async function resend(id){
 const inv=await getInvoice(id);if(!inv)throw new AErr('Tagihan tidak ditemukan','not_found',404)
 const ev=inv.status==='paid'?'invoice.paid':inv.status==='expired'?'invoice.expired':''
 if(!ev)throw new AErr('Webhook hanya dikirim untuk tagihan lunas / kedaluwarsa')
 await kv.del(HK(id))
 return fire(inv,ev)}

// ---------- sapuan cron ----------
// 1) tagihan lewat batas waktu -> expired, kode unik dilepas setelah masa tenggang
// 2) webhook gagal diulang sesuai jadwal
export async function sweep(deadline){
 let expired=0,freed=0,retried=0
 for(const id of ((await kv.get(PEND))||[])){
  if(Date.now()>deadline)break
  try{const inv=await getInvoice(id)
   if(!inv||inv.status==='paid'||inv.status==='canceled'){await kv.srem(PEND,id);continue}
   const before=inv.status;const cur=await checkInvoice(id)
   if(cur&&before==='pending'&&cur.status==='expired')expired++
   if(cur&&cur.status==='expired'&&Date.now()>cur.expMs+GRACE_MIN*60000){
    await smpCancel({id:cur.id,total:cur.total}).catch(()=>{});await kv.srem(PEND,id);freed++}}catch(e){}}
 for(const id of ((await kv.get(HPEND))||[])){
  if(Date.now()>deadline)break
  try{const st=await kv.get(HK(id)),inv=await getInvoice(id)
   if(!st||!inv||st.ok||st.n>=MAX_ATTEMPT){await kv.srem(HPEND,id);continue}
   if(Date.now()<(st.next||0))continue
   await fire(inv,st.event);retried++}catch(e){}}
 return {expired,freed,retried}}

// ---------- tampilan admin ----------
export async function listInvoices({status,q,keyId,page=1,limit=20}={}){
 const ids=(await kv.get(keyId?LOG+':'+keyId:LOG))||[]
 const rows=(await kv.mget(ids.slice(0,300).map(INV))).filter(Boolean)
 for(const r of rows)if(r.status==='pending'&&Date.now()>r.expMs)r.status='expired'   // tampilan saja; status disimpan oleh cron / cek berikutnya
 let f=rows
 if(status)f=f.filter(x=>x.status===status)
 if(q){const s=String(q).trim().toLowerCase();f=f.filter(x=>x.id.toLowerCase().includes(s)||String(x.orderId).toLowerCase().includes(s)||String(x.total)===s||String(x.amount)===s)}
 limit=Math.min(50,Math.max(1,+limit||20));page=Math.max(1,+page||1)
 const slice=f.slice((page-1)*limit,page*limit)
 const hooks=await kv.mget(slice.map(x=>HK(x.id)))
 return {total:f.length,page,limit,pages:Math.ceil(f.length/limit)||1,
  items:slice.map((x,i)=>({...view(x),key_id:x.keyId,key_name:x.keyName,late:!!x.late,hook:hooks[i]?{event:hooks[i].event,ok:hooks[i].ok,n:hooks[i].n,code:hooks[i].code,err:hooks[i].err,at:hooks[i].at}:null}))}}

export async function stats(){
 const s=(await kv.get(STAT))||{paidN:0,paidSum:0,days:{}},now=Date.now(),t=day(now)
 const sum=n=>{let c=0,m=0;for(let i=0;i<n;i++){const d=s.days[day(now-i*864e5)];if(d){c+=d.n;m+=d.sum}}return {n:c,sum:m}}
 const pend=((await kv.get(PEND))||[]).length
 return {today:s.days[t]||{n:0,sum:0},week:sum(7),month:sum(30),all:{n:+s.paidN||0,sum:+s.paidSum||0},pending:pend,
  days:Array.from({length:14},(_,i)=>{const d=day(now-(13-i)*864e5);return {d,...(s.days[d]||{n:0,sum:0})}})}}

export async function overview(site){
 const [cfg,keys,st,ready,sec]=await Promise.all([cfgGet(),listKeys(),stats(),smpReady(),getSec()])
 const orphans=((await kv.get(ORPHAN))||[]).slice(0,30)
 return {cfg,stats:st,smp:{ready,qrisDinamis:/^000201/.test(sec.SMP_QRIS||''),username:sec.SMP_USERNAME||'',
   callback:site+'/api/callbackqris/'+(sec.SMP_SECRET||'ISI_SMP_SECRET'),hasSecret:!!sec.SMP_SECRET},
  base:site+'/api/agw',orphans,
  keys:keys.map(k=>({id:k.id,name:k.name,key:k.key,secret:k.secret||'',on:k.on,ipw:k.ipw||[],at:k.at,
   hook:{url:(k.hook||{}).url||'',on:!!(k.hook||{}).on,secret:(k.hook||{}).secret||''}}))}}
