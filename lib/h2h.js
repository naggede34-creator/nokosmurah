// ===========================================================================
// H2H AgenH2H (REST API v1): dipakai untuk PENARIKAN INSTAN ke DANA.
//   POST {AGEN_BASE}/transaction  (ref_id unik = idtrx kita, sku lokal AgenH2H, customer_id = nomor DANA)
// Auth: header X-API-Key, X-Timestamp, X-Signature = HMAC-SHA256(secret, timestamp \n METHOD \n URI \n RAW_BODY).
// Kredensial diisi admin di Integrasi > AgenH2H (AGEN_KEY / AGEN_SECRET), tidak pernah dikirim ke browser atau dicatat.
// Hasil akhir datang lewat webhook (app/api/agenh2h/callback) dan disusul polling status dari cron.
// Penyedia lama (SMP/Solusi Media Pulsa) tidak dipakai lagi untuk kirim; parser laporan lamanya tetap ada untuk transaksi lama.
// ===========================================================================
import crypto from 'crypto'
import {getSec} from './settings'

export const AGEN_BASE='https://agenh2h.com/api/v1'
const base=s=>String(s.AGEN_BASE||AGEN_BASE).replace(/\/+$/,'')

// Nominal DANA -> SKU lokal AgenH2H, diisi admin (AGEN_DANA_SKUS), contoh: "10000=A2H-DANA10, 20000=A2H-DANA20"
// (pisahkan dengan koma / baris baru). SKU diambil dari GET /products?q=dana (lihat scripts/agen-sku.mjs).
export function parseSkus(txt){
 const o={}
 for(const part of String(txt||'').split(/[\n,;]+/)){
  const m=part.trim().match(/^(\d[\d.]*)\s*[=:]\s*([A-Za-z0-9._:-]{2,100})$/);if(!m)continue
  const n=Math.floor(+m[1].replace(/\./g,''));if(n>=1000&&n<=10000000)o[n]=m[2]}
 return o}
export async function instProducts(){return parseSkus((await getSec()).AGEN_DANA_SKUS)}
export async function instNominals(){return Object.keys(await instProducts()).map(Number).sort((a,b)=>a-b)}

export async function h2hCreds(){
 const s=await getSec()
 return {key:s.AGEN_KEY,secret:s.AGEN_SECRET,base:base(s)}}
export async function h2hReady(){
 const c=await h2hCreds();return !!(c.key&&c.secret&&(await instNominals()).length)}

// Nomor DANA -> bentuk 08xxxxxxxxxx. '' kalau tidak valid.
export const normDana=v=>{let d=String(v||'').replace(/\D/g,'')
 if(d.startsWith('62'))d='0'+d.slice(2);else if(d.startsWith('8'))d='0'+d
 return /^08[0-9]{8,12}$/.test(d)?d:''}

// Buang bagian yang tidak boleh sampai ke pengguna / catatan: sisa saldo provider & client id.
const bersih=t=>String(t||'').replace(/\s+/g,' ').replace(/SISA\s*SALDO\s*:?\s*[\d.,]+/ig,'').replace(/CLIENTID\s*=\s*\S+/ig,'').trim().slice(0,200)
const GAGAL=/\bGAGAL\b|DITOLAK|SALDO\s+(?:ANDA\s+)?(?:TIDAK|KURANG)|TIDAK\s+CUKUP|\b(?:PIN|PASS(?:WORD)?|ID|USER(?:NAME)?)\s+(?:ANDA\s+)?(?:SALAH|TIDAK\s+VALID)|KODE\s*PRODUK\s+(?:SALAH|TIDAK)|PRODUK\s+(?:TIDAK|GANGGUAN|KOSONG|NONAKTIF)|INVALID|DIBLOKIR/i
const BERHASIL=/\b(?:BERHASIL|SUKSES|SUCCESS)\b/i
const BUKAN=/(?:TIDAK|BELUM|BUKAN)\s+(?:BERHASIL|SUKSES|SUCCESS)/i

// Teks balasan/laporan provider -> success | failed | unknown. Hanya yang JELAS yang final:
// kalau ada dua sinyal bertentangan, atau kalimatnya "tidak/belum berhasil", hasilnya unknown (admin yang memastikan).
export function klasifikasi(raw){
 const text=bersih(raw),g=GAGAL.test(text),b=BERHASIL.test(text)
 if(g&&!b)return {state:'failed',text}
 if(b&&!g&&!BUKAN.test(text)){
  const sn=(text.match(/SN\s*:\s*(.+?)(?:\.\s*$|$)/i)||[])[1]||''
  const hrg=+String((text.match(/HRG\s*:\s*([\d.,]+)/i)||[])[1]||'').replace(/\./g,'').replace(',','.')||0
  return {state:'success',text,sn:sn.trim().slice(0,120),cost:hrg}}
 return {state:'unknown',text}}

// ---- Report URL: provider mengirim laporan status akhir (GET/POST, bentuknya tidak dijamin) ----
const ID_KEYS=['idtrx','id_trx','refid','ref_id','reffid','reff','ref','trxid','trx_id','idtransaksi','id_transaksi','reference']
const ST_KEYS=['status','state','statustrx','status_trx','message','msg','pesan','keterangan','ket','result','note','remark','response','resp']
// Ambil kandidat idtrx (milik kita: 13 digit) + teks status dari query string / body (JSON, form, atau teks biasa).
export function parseReport(query,rawBody){
 const f={},put=(k,v)=>{if(v==null||typeof v==='object')return;f[String(k).toLowerCase().trim()]=String(v).slice(0,500)}
 for(const [k,v] of query)put(k,v)
 const raw=String(rawBody||'').slice(0,4000).trim()
 let plain=!!raw
 if(raw){
  try{const j=JSON.parse(raw);if(j&&typeof j==='object'){plain=false;for(const k of Object.keys(j))put(k,j[k])}}
  catch(e){if(/^[^=\s&]+=/.test(raw)){plain=false;try{for(const [k,v] of new URLSearchParams(raw))put(k,v)}catch(e2){}}}}
 const idc=[];for(const k of ID_KEYS)if(f[k]&&!idc.includes(f[k]))idc.push(f[k])
 for(const m of ((Object.values(f).join(' ')+' '+raw).match(/\b\d{13}\b/g)||[]))if(!idc.includes(m))idc.push(m)
 let st=ST_KEYS.map(k=>f[k]).filter(Boolean).join(' ')
 if(!st)st=plain?raw:Object.values(f).join(' ')
 const sn=f.sn||f.serial||f.serialnumber||f.sn_trx||''
 return {idc:idc.slice(0,6),statusText:bersih(st),sn:String(sn).slice(0,120),
  raw:(Object.keys(f).length?JSON.stringify(f):raw).slice(0,400)}}

// Balasan HTML dari Cloudflare/WAF (bukan jawaban API provider).
export const BLOCK_TEXT='Diblokir firewall/Cloudflare provider (bukan balasan API): minta AgenH2H whitelist IP server kita'
export const isBlocked=(status,raw)=>{const t=String(raw||'')
 return /<title>\s*(?:Just a moment|Attention Required)|cf-chl|challenge-platform|cf-browser-verification|Enable JavaScript and cookies to continue|Checking your browser/i.test(t)
  ||((status===403||status===429||status===503)&&/cloudflare/i.test(t))}

// ---- request bertanda tangan ke AgenH2H ----
export const sign=(secret,ts,method,uri,body)=>crypto.createHmac('sha256',String(secret)).update(ts+'\n'+method+'\n'+uri+'\n'+body).digest('hex')
const PASTI_GAGAL=/^(AUTH_|PRODUCT_NOT_FOUND|CUSTOMER_ID_REQUIRED|SERVER_ID_REQUIRED|INSUFFICIENT_BALANCE|API_RATE_LIMITED|API_ROUTE_NOT_FOUND|API_METHOD_NOT_ALLOWED|CATEGORY_NOT_FOUND)/
const snOf=v=>Array.isArray(v)?v.filter(Boolean).join(', '):String(v||'')

async function call(method,path,obj){
 const c=await h2hCreds()
 const body=obj?JSON.stringify(obj):''
 const uri=new URL(c.base+path).pathname+(path.includes('?')?path.slice(path.indexOf('?')):'')
 const ts=String(Math.floor(Date.now()/1000))
 const r=await fetch(c.base+path,{method,redirect:'manual',signal:AbortSignal.timeout(15000),body:body||undefined,
  headers:{'Accept':'application/json','Content-Type':'application/json','User-Agent':'ArtapediaPay-H2H/2.0','X-API-Key':c.key,'X-Timestamp':ts,'X-Signature':sign(c.secret,ts,method,uri,body)}})
 const raw=(await r.text()).slice(0,4000)
 let j=null;try{j=JSON.parse(raw)}catch(e){}
 return {status:r.status,raw,j}}

// data transaksi AgenH2H -> success | failed | unknown (hanya status terminal yang final)
export function dataState(d){
 const st=String((d&&d.status)||'').toLowerCase()
 const msg=bersih((d&&d.message)||'')
 if(st==='success'||st==='completed')return {state:'success',text:msg||'Transaksi Berhasil',sn:snOf(d.serial_number).slice(0,120),cost:+d.total||0}
 if(st==='failed'||st==='cancelled')return {state:'failed',text:msg||'Transaksi gagal di provider'}
 return {state:'unknown',text:'Menunggu konfirmasi AgenH2H (status: '+(st||'belum ada')+')'+(msg?' '+msg:'')}}

// Satu respons HTTP -> hasil. sent=true kalau transaksi sudah tercatat di AgenH2H.
function baca(res){
 const {status,raw,j}=res
 if(isBlocked(status,raw))return {state:'unknown',blocked:true,text:BLOCK_TEXT}
 if(j&&j.success&&j.data)return dataState(j.data)
 const code=String((j&&j.code)||''),msg=bersih((j&&(j.message||(j.errors&&JSON.stringify(j.errors))))||raw.replace(/<[^>]*>/g,' '))
 // ditolak SEBELUM transaksi dibuat (dana pasti tidak terkirim)
 if(PASTI_GAGAL.test(code)||(status===422&&code!=='TRANSACTION_BUSY')||status===401||status===429)
  return {state:'failed',notSent:true,code,text:(code?code+': ':'')+(msg||('HTTP '+status))}
 return {state:'unknown',retry:true,code,text:msg||('Provider error HTTP '+status)}}

// Kirim satu transaksi. Hasil:
//   success : AgenH2H menyatakan transaksi berhasil
//   failed  : ditolak jelas / gagal final (dana pasti tidak terkirim)
//   unknown : timeout, 5xx, 409 sibuk, atau belum final (JANGAN dianggap gagal: dana mungkin sudah terkirim)
// Timeout/5xx/409 diulang SEKALI dengan ref_id yang sama: aman, AgenH2H idempoten (tidak ada debit ganda).
export async function h2hSend({kode,tujuan,idtrx}){
 if(!await h2hReady())return {state:'failed',text:'H2H belum dikonfigurasi admin',notSent:true}
 const body={ref_id:String(idtrx),sku:kode,customer_id:tujuan,quantity:1}
 let last={state:'unknown',text:'Gagal menghubungi provider'}
 for(let i=0;i<2;i++){
  try{last=baca(await call('POST','/transaction',body))}
  catch(e){last={state:'unknown',retry:true,text:e&&e.name==='TimeoutError'?'Provider tidak membalas (timeout 15 detik)':'Gagal menghubungi provider'}}
  if(!last.retry)return last
  await new Promise(r=>setTimeout(r,1500))}
 return last}

// Cek status transaksi (fallback kalau webhook belum datang). NOT_FOUND = ref_id tidak pernah tercatat di AgenH2H => dana tidak terkirim.
export async function h2hStatus(idtrx){
 if(!await h2hReady())return {state:'unknown',text:'H2H belum dikonfigurasi admin'}
 try{
  const res=await call('POST','/transaction/status',{ref_id:String(idtrx)})
  if(res.j&&res.j.code==='TRANSACTION_NOT_FOUND')return {state:'failed',notFound:true,text:'Transaksi tidak tercatat di AgenH2H'}
  if(res.j&&res.j.success&&res.j.data)return dataState(res.j.data)
  return {state:'unknown',text:isBlocked(res.status,res.raw)?BLOCK_TEXT:bersih((res.j&&res.j.message)||('HTTP '+res.status))}
 }catch(e){return {state:'unknown',text:'Gagal menghubungi provider'}}}

// Tes koneksi untuk admin: cek API Key + HMAC lewat GET /account, lalu pastikan tiap SKU DANA yang diisi ada (GET /products/{sku}).
export async function h2hCheck(){
 const c=await h2hCreds()
 if(!c.key||!c.secret)return {ok:false,info:'AGEN_KEY / AGEN_SECRET belum diisi'}
 try{
  const a=await call('GET','/account')
  if(isBlocked(a.status,a.raw))return {ok:false,info:BLOCK_TEXT}
  if(!(a.j&&a.j.success))return {ok:false,info:'Ditolak AgenH2H: '+bersih((a.j&&(a.j.code+' '+(a.j.message||'')))||('HTTP '+a.status))}
  const d=a.j.data||{},prods=await instProducts(),nom=Object.keys(prods).map(Number).sort((x,y)=>x-y)
  if(!nom.length){
   // AGEN_DANA_SKUS masih kosong: cari produk DANA di katalog dan tampilkan isian siap salin
   let saran=''
   try{
    const cat=await call('GET','/products?q=dana&all=1')
    const list=(cat.j&&cat.j.success&&Array.isArray(cat.j.data)?cat.j.data:[]).filter(x=>x&&x.sku&&(!x.status||x.status==='available')&&/dana/i.test((x.game||'')+' '+(x.name||'')))
    const m={}
    for(const x of list){const g=String(x.name||x.nominal||'').match(/(\d[\d.]*)\s*$/)||String(x.nominal||'').match(/(\d[\d.]*)/);const n=g?Math.floor(+g[1].replace(/\./g,'')):0
     if(n>=5000&&n<=500000&&n%5000===0&&!m[n])m[n]=x.sku}
    saran=Object.keys(m).map(Number).sort((a,b)=>a-b).map(n=>n+'='+m[n]).join(', ')}catch(e){}
   return {ok:false,info:'Terhubung ('+(d.name||d.user_id)+', saldo Rp'+(+d.balance||0).toLocaleString('id-ID')+'), tapi AGEN_DANA_SKUS belum diisi.'+(saran?' Salin ke kolom AGEN_DANA_SKUS (hapus nominal yang tidak mau dipakai): '+saran:' Format: 10000=SKU, 20000=SKU')}}
  const bad=[];let rows=[]
  for(const n of nom){
   const p=await call('GET','/products/'+encodeURIComponent(prods[n]))
   if(p.j&&p.j.success&&p.j.data){const x=p.j.data;rows.push(n/1000+'rb='+x.price)
    if(x.status&&String(x.status)!=='available')bad.push(prods[n]+' (status '+x.status+')')}
   else bad.push(prods[n]+' (tidak ditemukan)')}
  return {ok:!bad.length,info:'Terhubung · '+(d.name||d.user_id)+' · level '+d.level+' · saldo Rp'+(+d.balance||0).toLocaleString('id-ID')+(bad.length?' · SKU bermasalah: '+bad.join(', '):' · '+nom.length+' SKU DANA valid (harga modal: '+rows.join(', ')+')')}
 }catch(e){return {ok:false,info:e&&e.name==='TimeoutError'?'AgenH2H tidak membalas (timeout)':'Gagal menghubungi AgenH2H'}}}
