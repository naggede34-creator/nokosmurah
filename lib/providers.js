// Penyedia nomor (nokos). Setiap penyedia mengikuti antarmuka yang sama: services / countries / order / status / cancel.
// Penyedia aktif: WarungNokos Server2 (wnk_s1).
// Kredensial dibaca dari admin > Integrasi (atau env sebagai cadangan), lihat lib/settings.js
import {kv} from './db'
import {getSec} from './settings'
const memo=(k,ttl,fn)=>{const m=globalThis.__memo||(globalThis.__memo={}),c=m[k];if(c&&Date.now()-c.t<ttl)return c.p
 const p=Promise.resolve().then(fn);m[k]={t:Date.now(),p};p.catch(()=>{if(m[k]&&m[k].p===p)delete m[k]});return p}
const num=v=>{const n=Number(String(v==null?'':v).replace(/[^0-9.-]/g,''));return isNaN(n)?0:n}
const arr=d=>Array.isArray(d)?d:(d&&(d.items||d.data||d.result))||[]
const phoneNum=v=>String(v||'').replace(/[^0-9+]/g,'')

// Saldo akun penyedia (server nokos) habis -> pembeli TIDAK boleh melihat "saldo tidak cukup" (mengira saldonya sendiri kurang).
// Tampilkan pesan restok. Dipakai web, API, dan bot Telegram.
export const RESTOCK_MSG='LAGI PROSES RESTOK YA, SABAR DITUNGGU YA, MAKASIH 🙏'
const RESTOCK_RE=/saldo[^.]{0,40}(tidak\s+(cukup|mencukupi)|tak\s+cukup|kurang|habis|minim|kosong|insufficient)|(insufficient|not\s+enough|low)\s+(balance|funds|credit)|balance[^.]{0,30}(insufficient|too\s+low|not\s+enough)|dana[^.]{0,30}(tidak\s+cukup|kurang)/i
export const isRestock=e=>RESTOCK_RE.test(String((e&&e.message)||e||''))
export const orderMsg=e=>isRestock(e)?RESTOCK_MSG:String((e&&e.message)||e||'Order gagal').slice(0,200)

// Bendera dari kode negara ISO-2 ("ID" -> 🇮🇩). Dipakai supaya daftar negara tetap
// enak dilihat walau endpoint-nya tidak mengirim emoji.
const f2=c=>{c=String(c||'').trim().toUpperCase()
 return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>0x1f1a5+x.charCodeAt(0))):''}
// ---------- WarungNokos Server2 (warungnokos.web.id) ----------
// Autentikasi header x-api-key (wn-...). Balasan selalu {success:true|false,...}.
// - /services -> id numerik layanan (dipakai sebagai service_code / platform_id)
// - /countries -> id negara + emoji bendera
// - /products?platform_id=&country_id= -> server/produk (id, available, price)
// - /order {product_id,app_id,country_id,service_name} -> trxId (mis. WN0000000001)
// - /status/:trxId -> {status, otp_code}  · /cancel {trxId} -> saldo di-refund otomatis
export async function wnk(path,{method='GET',params={},body=null,timeout=25000}={}){
 const s=await getSec()
 if(!s.WNK_KEY)throw Error('API key WarungNokos belum diisi (admin > Integrasi > WarungNokos)')
 const base=(s.WNK_BASE||'https://warungnokos.web.id/api/smscode').replace(/\/+$/,'')
 const u=new URL(base+path)
 for(const [k,v] of Object.entries(params))if(v!=null&&v!=='')u.searchParams.set(k,String(v))
 const h={'x-api-key':s.WNK_KEY,Accept:'application/json'}
 if(body)h['Content-Type']='application/json'
 let r
 try{r=await fetch(u,{method,cache:'no-store',headers:h,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)})}
 catch(e){throw Error('WarungNokos tidak bisa dihubungi: '+(e.name==='TimeoutError'?'timeout':e.message))}
 const txt=await r.text().catch(()=>'')
 let d=null;try{d=txt?JSON.parse(txt):{}}catch(e){throw Error('WarungNokos membalas bukan JSON (HTTP '+r.status+')')}
 if(!d||d.success===false||!r.ok)throw Error(String((d&&(d.message||d.error||d.msg))||wnkMsg(r.status)).slice(0,200))
 return d}
const wnkMsg=s=>s===401||s===403?'API key WarungNokos salah atau nonaktif'
 :s===402?'Saldo WarungNokos tidak cukup'
 :s===404?'Data yang diminta tidak ada di WarungNokos'
 :s>=500?'WarungNokos sedang gangguan (HTTP '+s+')':'WarungNokos menolak permintaan (HTTP '+s+')'
const wnkState=v=>{const s=String(v||'').toLowerCase()
 return ['completed','success','received','done'].includes(s)?'success'
  :['cancel','canceled','cancelled','batal','refunded','refund'].includes(s)?'canceled'
  :['expired','timeout','failed','gagal'].includes(s)?'expired':'pending'}
const wnkCountries=()=>memo('wnk:ct',300000,async()=>{
 const m=new Map();for(const x of arr(await wnk('/countries')))if(x&&x.id!=null&&x.active!==false)m.set(String(x.id),{name:String(x.name||x.id),flag:x.emoji||'🌐'})
 return m})
const wnkServer=()=>({
 services:()=>memo('wnk:sv',60000,async()=>arr(await wnk('/services'))
  .filter(x=>x&&x.id!=null&&x.active!==false)
  .map(x=>({service_code:String(x.id),service_name:String(x.name||x.code||x.id)}))
  .sort((a,b)=>a.service_name.localeCompare(b.service_name))),
 countries:sid=>memo('wnk:pr:'+sid,30000,async()=>{
  const [neg,prod]=await Promise.all([wnkCountries().catch(()=>new Map()),wnk('/products',{params:{platform_id:sid}})])
  const by=new Map()
  for(const x of arr(prod)){
   const price=Math.round(num(x.price)),stock=num(x.available)
   if(!x||x.id==null||x.active===false||price<=0||stock<=0)continue
   const cid=String(x.country_id??'');if(!cid)continue
   if(!by.has(cid)){const n=neg.get(cid)||{name:'Negara '+cid,flag:'🌐'};by.set(cid,{name:n.name,flag:n.flag,country_id:cid,success_rate:0,pricelist:[]})}
   by.get(cid).pricelist.push({provider_id:String(x.id),country_id:cid,price,stock,provider_name:String(x.name||'')})}
  return [...by.values()].map(c=>({...c,pricelist:c.pricelist.sort((a,b)=>a.price-b.price)}))}),
 order:async b=>{
  const product_id=+b.providerId,app_id=+b.serviceId,country_id=+b.countryId
  if(!product_id||!app_id||!country_id)throw Error('Produk WarungNokos tidak valid, muat ulang halaman lalu pesan lagi')
  const d=await wnk('/order',{method:'POST',body:{product_id,app_id,country_id,service_name:String(b.serviceName||'').slice(0,60)||undefined}})
  const x=d.data||d
  if(!x.trxId||!x.phoneNumber)throw Error('Respons order WarungNokos tidak lengkap')
  // batas waktu tidak dikirim API; anggap 20 menit (status tetap mengikuti jawaban /status)
  return {id:String(x.trxId),phone:phoneNum(x.phoneNumber),expiredAt:Date.now()+20*60000,cost:Math.round(num(x.amount))}},
 status:async id=>{
  const d=await wnk('/status/'+encodeURIComponent(id))
  const x=d.data&&typeof d.data==='object'?{...d,...d.data}:d
  const st=wnkState(x.status),pesan=x.sms||x.message_text||x.full_sms||null
  const otp=String(x.otp_code??x.otp??'').trim()
  if(otp)return {otp,msg:pesan,state:'success'}
  return {otp:null,msg:pesan,state:st==='success'?'pending':st}},
 // batal: saldo WarungNokos di-refund otomatis; penolakan diteruskan apa adanya supaya antrean pembatalan lib/sync.js mencoba ulang
 cancel:async id=>{await wnk('/cancel',{method:'POST',body:{trxId:String(id)}})}})

export const SERVERS=[
 {server:'wnk_s1',name:'WarungNokos Server2',badge:'Utama',provider:'WarungNokos · server2',description:'Server WarungNokos: banyak aplikasi & negara, stok dan harga real-time.',needs:'WNK_KEY'}]
export const P={wnk_s1:wnkServer()}
