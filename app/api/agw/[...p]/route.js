// ===========================================================================
// ADMIN GATEWAY — API developer.  Base: https://DOMAIN/api/agw
// Dokumentasi lengkap: admin > Gateway SMP > Dokumentasi (lib/agwdocs.js).
//
// Autentikasi (wajib): header  X-API-Key: agw_live_...   atau   Authorization: Bearer agw_live_...
// Key SENGAJA tidak diterima lewat query string supaya tidak bocor ke log server / riwayat browser.
// Opsional per key: whitelist IP, dan tanda tangan HMAC (X-Timestamp + X-Signature).
// Semua balasan berbentuk {success:boolean, ...}; galat berbentuk {success:false, code, message}.
//
// Key hanya bisa dibuat oleh admin dari panel admin. Tidak ada pendaftaran publik.
// ===========================================================================
import crypto from 'crypto'
import {kv} from '../../../../lib/db'
import {clientIp} from '../../../../lib/auth'
import * as G from '../../../../lib/agw'

export const dynamic='force-dynamic'
export const maxDuration=30
const J=(o,s=200,h)=>Response.json(o,{status:s,headers:{'Cache-Control':'no-store',...(h||{})}})
const F=(message,code='bad_request',status=400,h)=>J({success:false,code,message},status,h)
const S=(o,s=200)=>J({success:true,...o},s)
const same=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}

async function handle(req,params,method){
 const path=(params.p||[]).map(x=>{try{return decodeURIComponent(x)}catch(e){return x}}).join('/')
 const url=new URL(req.url),q=Object.fromEntries(url.searchParams)
 // ---- autentikasi ----
 const hk=(req.headers.get('x-api-key')||((req.headers.get('authorization')||'').match(/^Bearer\s+(\S+)/)||[])[1]||'').trim()
 if(!hk)return F('API key wajib dikirim lewat header X-API-Key atau Authorization: Bearer','missing_api_key',401)
 const k=await G.byKey(hk)
 if(!k)return F('API key tidak valid','invalid_api_key',401)
 if(!k.on)return F('API key ini dinonaktifkan admin','key_disabled',403)
 const ip=clientIp(req)
 if((k.ipw||[]).length&&!k.ipw.includes(ip))return F('IP '+(ip||'tidak terdeteksi')+' tidak ada di whitelist key ini','ip_not_allowed',403)
 // body mentah dibaca SEKALI: dipakai untuk tanda tangan sekaligus di-parse
 const raw=method==='POST'?await req.text().catch(()=>''):''
 if(k.secret){
  const ts=req.headers.get('x-timestamp')||'',sg=req.headers.get('x-signature')||''
  if(!ts||!sg)return F('Key ini memakai tanda tangan: kirim header X-Timestamp dan X-Signature','signature_required',401)
  const t=+ts*(String(ts).length<=10?1000:1)
  if(!(Math.abs(Date.now()-t)<=300000))return F('X-Timestamp kedaluwarsa (selisih lebih dari 5 menit dari jam server)','timestamp_expired',401)
  const exp=crypto.createHmac('sha256',k.secret).update(`${method}\n/api/agw/${path}\n${raw}\n${ts}`).digest('hex')
  if(!same(exp,sg.trim().toLowerCase()))return F('Tanda tangan tidak cocok','signature_invalid',401)}
 let b={}
 if(method==='POST'&&raw.trim()){try{b=JSON.parse(raw)}catch(e){return F('Body harus JSON yang valid (Content-Type: application/json)','invalid_json',400)}
  if(!b||typeof b!=='object'||Array.isArray(b))return F('Body harus berupa objek JSON','invalid_json',400)}
 // ---- rate limit: buat tagihan 30/menit, lainnya 300/menit (per key) ----
 {const w=Math.floor(Date.now()/60000),tight=path==='qris/create'&&method==='POST'
  const n=await kv.incr(`rl:agw:${k.id}:${tight?'c':'a'}:${w}`),lim=tight?30:300
  if(n>lim)return F('Terlalu banyak permintaan, coba lagi sebentar','rate_limited',429,{'Retry-After':String(Math.max(1,(w+1)*60-Math.floor(Date.now()/1000)))})}

 try{
  // GET /ping — uji key + lihat batas gateway
  if(path==='ping'&&method==='GET'){
   const c=await G.cfgGet()
   return S({message:'pong',app:{id:k.id,name:k.name},gateway:{active:c.on,min_amount:c.min,max_amount:c.max,expire_minutes:c.expMin},
    security:{signature_required:!!k.secret,ip_whitelist:(k.ipw||[]).length>0,webhook_enabled:!!(k.hook&&k.hook.on)},
    your_ip:ip||null,server_time:new Date().toISOString()})}

  // POST /qris/create
  if(path==='qris/create'&&method==='POST'){
   const {inv,existing}=await G.createInvoice(k,b)
   return S({message:existing?'Tagihan aktif dengan order_id ini sudah ada, dikembalikan lagi.':'Tagihan QRIS dibuat. Pembeli harus membayar total_pay PERSIS.',
    idempotent:!!existing,invoice:G.view(inv)},existing?200:201)}

  // GET /qris/status/{invoice_id}   atau   GET /qris/status?order_id=...
  if((path==='qris/status'||path.startsWith('qris/status/'))&&method==='GET'){
   let id=path.slice('qris/status/'.length).trim()
   if(!id&&q.order_id){if(!/^[A-Za-z0-9._:-]{1,64}$/.test(q.order_id))return F('order_id tidak valid','invalid_order_id',422)
    id=await kv.get('agwo:'+k.id+':'+q.order_id)||''}
   if(!id)return F('Sertakan invoice_id di path atau order_id di query','missing_id',400)
   const inv=await G.checkInvoice(id)
   if(!inv||inv.keyId!==k.id)return F('Tagihan tidak ditemukan','not_found',404)
   return S({status:inv.status,invoice:G.view(inv),
    message:inv.status==='paid'?'Pembayaran diterima.':inv.status==='pending'?'Menunggu pembayaran.':'Tagihan '+inv.status+'.'})}

  // POST /qris/cancel/{invoice_id}
  if(path.startsWith('qris/cancel/')&&method==='POST'){
   const inv=await G.cancelInvoice(path.slice('qris/cancel/'.length).trim(),k.id)
   return S({status:inv.status,message:'Tagihan dibatalkan.',invoice:G.view(inv)})}

  // GET /qris/list?page=&limit=&status=
  if(path==='qris/list'&&method==='GET'){
   const st=['pending','paid','expired','canceled'].includes(q.status)?q.status:''
   const r=await G.listInvoices({status:st,q:q.search,keyId:k.id,page:q.page,limit:q.limit})
   return S({data:r.items.map(({key_id,key_name,late,hook,...x})=>x),meta:{page:r.page,limit:r.limit,total:r.total,total_pages:r.pages}})}

  // POST /webhook/test — kirim event webhook.test ke URL webhook key ini
  if(path==='webhook/test'&&method==='POST'){
   const r=await G.testHook(k)
   return S({delivered:r.ok,http_status:r.code,error:r.error||null})}

  return F('Endpoint tidak ditemukan: '+method+' /api/agw/'+path,'not_found',404)}
 catch(e){
  if(e instanceof G.AErr)return F(e.message,e.code,e.status)
  return F('Terjadi kesalahan di server, coba lagi','server_error',500)}}

export const GET=(req,c)=>handle(req,c.params,'GET')
export const POST=(req,c)=>handle(req,c.params,'POST')
