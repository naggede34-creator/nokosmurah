// Penyedia nomor (nokos). Setiap penyedia mengikuti antarmuka yang sama: services / countries / order / status / cancel.
//  1) WarungNokos resmi (warungnokos_s1..s3) -> https://warungnokos.web.id, header x-api-key
//     - s1 = /api/otp      (Server 1 H2H: stok & rate sukses per server)
//     - s2 = /api/warkosv3 (Server 2 baru: harga final, alur negara -> layanan -> produk)
//     - s3 = /api/smscode  (Server 2 jalur lama: stok per produk)
// Kredensial dibaca dari admin > Integrasi (atau env sebagai cadangan), lihat lib/settings.js
import {kv} from './db'
import {getSec} from './settings'
const memo=(k,ttl,fn)=>{const m=globalThis.__memo||(globalThis.__memo={}),c=m[k];if(c&&Date.now()-c.t<ttl)return c.p
 const p=Promise.resolve().then(fn);m[k]={t:Date.now(),p};p.catch(()=>{if(m[k]&&m[k].p===p)delete m[k]});return p}
const num=v=>{const n=Number(String(v==null?'':v).replace(/[^0-9.-]/g,''));return isNaN(n)?0:n}
const arr=d=>Array.isArray(d)?d:(d&&(d.items||d.data||d.result))||[]

// ---------- WarungNokos (resmi) ----------
// Satu pintu untuk semua endpoint WarungNokos. Selalu melempar Error dengan pesan
// yang bisa dibaca admin maupun pembeli.
export async function wn(path,{method='GET',body=null,timeout=25000}={}){
 const s=await getSec()
 const key=s.WN_KEY
 if(!key)throw Error('API key WarungNokos belum diisi (admin > Integrasi > WarungNokos)')
 const base=(s.WN_BASE||'https://warungnokos.web.id').replace(/\/+$/,'')
 const h={'x-api-key':key,Accept:'application/json'}
 if(body)h['Content-Type']='application/json'
 // cache:'no-store' WAJIB: tanpa ini Next.js menyimpan jawaban GET di Data Cache, sehingga
 // status deposit/order yang sudah berubah di WarungNokos tetap terbaca dengan jawaban lama —
 // deposit yang sudah dibayar terlihat "pending" terus dan saldonya tidak pernah masuk.
 let r
 try{r=await fetch(base+path,{method,cache:'no-store',headers:h,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)})}
 catch(e){throw Error('WarungNokos tidak bisa dihubungi: '+(e.name==='TimeoutError'?'timeout':e.message))}
 const txt=await r.text().catch(()=>'')
 let d=null;try{d=txt?JSON.parse(txt):{}}catch(e){throw Error('WarungNokos membalas bukan JSON (HTTP '+r.status+')')}
 if(d&&d.success===false)throw Error(String(d.message||'WarungNokos menolak permintaan').slice(0,200))
 if(!r.ok)throw Error(String((d&&d.message)||wnMsg(r.status)).slice(0,200))
 return d}
const wnMsg=s=>s===401?'API key WarungNokos tidak dikirim atau tidak valid'
 :s===403?'API key WarungNokos dinonaktifkan atau IP server ini diblokir'
 :s===404?'Data yang diminta tidak ada di WarungNokos'
 :s===400?'WarungNokos menolak permintaan (parameter kurang / saldo tidak cukup)'
 :s>=500?'WarungNokos sedang gangguan (HTTP '+s+')':'WarungNokos menolak permintaan (HTTP '+s+')'
export const UPSTREAM=wn

// Bendera dari kode negara ISO-2 ("ID" -> 🇮🇩). Dipakai supaya daftar negara tetap
// enak dilihat walau endpoint-nya tidak mengirim emoji.
const f2=c=>{c=String(c||'').trim().toUpperCase()
 return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(...[...c].map(x=>0x1f1a5+x.charCodeAt(0))):''}
// Peta nama negara -> bendera, diambil sekali dari daftar negara Server 2 (satu-satunya
// endpoint WarungNokos yang mengirim kode ISO). Gagal = semua negara pakai 🌐.
const wnFlags=()=>memo('wn:flags',3600000,async()=>{const m=new Map()
 try{for(const c of arr(await wn('/api/warkosv3/countries'))){const f=f2(c.code)
  if(f&&c.name)m.set(String(c.name).toLowerCase(),f)}}catch(e){}
 return m})
// status WarungNokos: waiting | completed | canceled  (+ kata lain yang mungkin muncul)
const wnState=v=>{const s=String(v||'').toLowerCase().trim()
 return ['completed','complete','success','sukses','done','berhasil'].includes(s)?'success'
  :['canceled','cancelled','cancel','batal','dibatalkan'].includes(s)?'canceled'
  :['expired','expire','kadaluarsa','kedaluwarsa','timeout'].includes(s)?'expired':'pending'}
const wnStatus=async path=>{const d=await wn(path)
 const st=wnState(d.status),otp=d.otp_code==null?'':String(d.otp_code).trim()
 return {otp:st==='success'&&otp&&!/^(null|waiting)$/i.test(otp)?otp:null,
  msg:d.otp_message||d.sms||d.message_text||null,state:st}}
// "2026-10-05 09:28:44" dari WarungNokos tidak membawa zona waktu; dibaca sebagai WIB.
const wnMs=v=>{if(!v)return 0;if(typeof v==='number')return v<1e12?v*1000:v
 const s=String(v).trim(),t=Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)?s.replace(' ','T')+'+07:00':s)
 return isNaN(t)?0:t}
const wnPhone=v=>String(v||'').replace(/[^0-9+]/g,'')

// --- Server 1: /api/otp (punya stok & rate sukses per server) ---
// provider_id disimpan sebagai "<provider_id>.<server_id>" supaya dua server dengan
// provider yang sama tetap bisa dibedakan saat harga dicek ulang sebelum order.
const wn1Price=async(sid,cid,pid)=>{
 for(const c of await wn1.countries(sid))if(String(c.country_id)===String(cid))
  for(const x of c.pricelist)if(String(x.provider_id)===String(pid))return x.price
 throw Error('Harga layanan ini sudah berubah di WarungNokos, muat ulang halaman lalu pesan lagi')}
const wn1={
 services:()=>memo('wn1:sv',60000,async()=>arr(await wn('/api/otp/services'))
  .map(x=>({service_code:String(x.service_code??x.id??''),service_name:String(x.service_name||x.name||x.service_code||''),img:x.service_img||''}))
  .filter(x=>x.service_code&&x.service_name)
  .sort((a,b)=>a.service_name.localeCompare(b.service_name))),
 countries:sid=>memo('wn1:ct:'+sid,20000,async()=>{
  const fl=await wnFlags(),out=[]
  for(const c of arr(await wn('/api/otp/countries/'+encodeURIComponent(sid)))){
   const cid=String(c.number_id??c.id??'');if(!cid)continue
   const pl=(c.pricelist||[]).map(x=>({provider_id:String(x.provider_id)+'.'+String(x.server_id??0),
     country_id:cid,price:Math.round(+x.price||0),stock:+x.stock||0,
     provider_name:'Server '+(x.server_id??'-'),rate:Math.round(+x.rate||0)})).filter(x=>x.price>0&&x.stock>0)
   if(!pl.length)continue
   out.push({name:String(c.name||cid),flag:fl.get(String(c.name||'').toLowerCase())||'🌐',country_id:cid,
    success_rate:Math.max(...pl.map(x=>x.rate||0)),pricelist:pl})}
  return out}),
 // price_jual = harga modal apa adanya: markup situs ini ditambahkan di sisi kita sendiri
 // (lib/providers tidak boleh menitipkan markup ke upstream, nanti ikut terpotong dari saldo).
 order:async b=>{
  const pid=String(b.providerId).split('.')[0]
  const modal=await wn1Price(b.serviceId,b.countryId,b.providerId)
  const d=(await wn('/api/otp/order',{method:'POST',body:{number_id:String(b.countryId),provider_id:pid,
   operator_id:String(b.operatorId||'any'),price_jual:modal,service_name:b.serviceName||''}})).data||{}
  if(!d.trxId||!d.phoneNumber)throw Error('Respons order WarungNokos tidak lengkap')
  return {id:String(d.trxId),phone:wnPhone(d.phoneNumber),
   expiredAt:wnMs(d.expires_at||d.expiredAt)||Date.now()+10*60000,cost:Math.round(+d.amount||modal)}},
 status:id=>wnStatus('/api/otp/status/'+encodeURIComponent(id)),
 cancel:async id=>{await wn('/api/otp/set_status',{method:'POST',body:{trxId:String(id),action_status:'cancel'}})}}

// --- Server 2 baru: /api/warkosv3 (harga final, alurnya negara -> layanan -> produk) ---
const wnCfg=async()=>((await kv.get('cfg'))||{}).wn||{}
const wn2Countries=()=>memo('wn2:cl',600000,async()=>arr(await wn('/api/warkosv3/countries'))
 .map(c=>({id:String(c.id),name:String(c.name||c.id),flag:f2(c.code)||'🌐'})).filter(c=>c.id))
// Negara yang dipindai bisa dibatasi admin (cfg.wn.countries / cfg.wn.max) karena satu
// permintaan daftar layanan = satu permintaan per negara.
const wn2List=async()=>{const cf=await wnCfg(),all=await wn2Countries()
 const pick=String(cf.countries||'').split(',').map(x=>x.trim()).filter(Boolean)
 if(pick.length){const sel=all.filter(c=>pick.includes(c.id)||pick.some(p=>p.toLowerCase()===c.name.toLowerCase()))
  if(sel.length)return sel}
 const id=all.find(c=>/^indonesia$/i.test(c.name))
 return [...(id?[id]:[]),...all.filter(c=>!id||c.id!==id.id)].slice(0,Math.max(1,Math.min(30,+cf.max||10)))}
const wn2={
 services:()=>memo('wn2:sv',60000,async()=>{
  const cs=await wn2List(),seen=new Map()
  const r=await Promise.allSettled(cs.map(c=>wn('/api/warkosv3/services?country_id='+encodeURIComponent(c.id))))
  for(const x of r)if(x.status==='fulfilled')for(const sv of arr(x.value)){const id=String(sv.id??'')
   if(id&&!seen.has(id))seen.set(id,{service_code:id,service_name:String(sv.name||id)})}
  return [...seen.values()].sort((a,b)=>a.service_name.localeCompare(b.service_name))}),
 countries:sid=>memo('wn2:ct:'+sid,20000,async()=>{
  const cs=await wn2List()
  const r=await Promise.allSettled(cs.map(async c=>{
   const pr=arr(await wn(`/api/warkosv3/products?country_id=${encodeURIComponent(c.id)}&service_id=${encodeURIComponent(sid)}`))
   // Server 2 baru tidak mengirim stok: dianggap tersedia selama produknya muncul.
   const pl=pr.map(x=>({provider_id:String(x.id),country_id:c.id,price:Math.round(+x.price||0),stock:99,
     provider_name:String(x.name||'Server')})).filter(x=>x.price>0&&x.provider_id&&x.provider_id!=='undefined')
   return pl.length?{name:c.name,flag:c.flag,country_id:c.id,success_rate:0,pricelist:pl}:null}))
  return r.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value)}),
 order:async b=>{const d=(await wn('/api/warkosv3/order',{method:'POST',body:{country_id:num(b.countryId),
   service_id:num(b.serviceId),product_id:num(b.providerId),service_name:b.serviceName||''}})).data||{}
  if(!d.trxId||!d.phoneNumber)throw Error('Respons order WarungNokos S2 tidak lengkap')
  return {id:String(d.trxId),phone:wnPhone(d.phoneNumber),
   expiredAt:wnMs(d.expires_at)||Date.now()+10*60000,cost:Math.round(+d.amount||0)}},
 status:id=>wnStatus('/api/warkosv3/status/'+encodeURIComponent(id)),
 // WarungNokos hanya mengizinkan batal 3 menit setelah order; pesannya diteruskan apa adanya
 cancel:async id=>{await wn('/api/warkosv3/cancel',{method:'POST',body:{trxId:String(id)}})}}

// --- Server 2 jalur lama: /api/smscode (stok tampil, satu daftar layanan global) ---
const wn3={
 services:()=>memo('wn3:sv',60000,async()=>arr(await wn('/api/smscode/services'))
  .filter(x=>x.active!==false)
  .map(x=>({service_code:String(x.id??''),service_name:String(x.name||x.code||x.id||'')}))
  .filter(x=>x.service_code&&x.service_name)
  .sort((a,b)=>a.service_name.localeCompare(b.service_name))),
 countries:sid=>memo('wn3:ct:'+sid,20000,async()=>{
  const [cs,pr]=await Promise.all([
   memo('wn3:cl',600000,()=>wn('/api/smscode/countries')),
   wn('/api/smscode/products?platform_id='+encodeURIComponent(sid))])
  const by=new Map(arr(cs).map(c=>[String(c.id),{name:String(c.name||c.id),flag:c.emoji||'🌐'}]))
  const g=new Map()
  for(const x of arr(pr)){
   if(x.active===false)continue
   const cid=String(x.country_id??''),price=Math.round(+x.price||0)
   const stock=x.available==null?99:+x.available
   if(!cid||price<=0||!(stock>0))continue
   if(!g.has(cid))g.set(cid,[])
   g.get(cid).push({provider_id:String(x.id),country_id:cid,price,stock,provider_name:String(x.name||'Server')})}
  return [...g.entries()].map(([cid,pl])=>{const m=by.get(cid)||{name:cid,flag:'🌐'}
   return {name:m.name,flag:m.flag,country_id:cid,success_rate:0,pricelist:pl}})}),
 order:async b=>{const d=(await wn('/api/smscode/order',{method:'POST',body:{product_id:num(b.providerId),
   app_id:num(b.serviceId),country_id:num(b.countryId),service_name:b.serviceName||''}})).data||{}
  if(!d.trxId||!d.phoneNumber)throw Error('Respons order WarungNokos S2 (lama) tidak lengkap')
  return {id:String(d.trxId),phone:wnPhone(d.phoneNumber),
   expiredAt:wnMs(d.expires_at)||Date.now()+10*60000,cost:Math.round(+d.amount||0)}},
 status:id=>wnStatus('/api/smscode/status/'+encodeURIComponent(id)),
 cancel:async id=>{await wn('/api/smscode/cancel',{method:'POST',body:{trxId:String(id)}})}}

// ---------- SMSCode (api.smscode.gg) — "SERVER FAST OTP V 1" ----------
// Dipakai versi /v1 (IDR): uangnya langsung rupiah bulat, tanpa kurs dan tanpa
// 503 FX_RATE_UNAVAILABLE seperti /v2 (USD). Autentikasi: Bearer token.
// Bentuk balasan: {success:true,data:...} atau {success:false,error:{code,message}}.
export async function sc(path,{method='GET',body=null,timeout=25000,idem=''}={}){
 const s=await getSec()
 if(!s.SMSCODE_KEY)throw Error('API token SMSCode belum diisi (admin > Integrasi > SMSCode)')
 const base=(s.SMSCODE_BASE||'https://api.smscode.gg/v1').replace(/\/+$/,'')
 const h={Authorization:'Bearer '+s.SMSCODE_KEY,Accept:'application/json'}
 if(body)h['Content-Type']='application/json'
 if(idem)h['Idempotency-Key']=String(idem).replace(/[^A-Za-z0-9_-]/g,'').slice(0,128)
 let r
 try{r=await fetch(base+path,{method,cache:'no-store',headers:h,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)})}
 catch(e){throw Error('SMSCode tidak bisa dihubungi: '+(e.name==='TimeoutError'?'timeout':e.message))}
 const txt=await r.text().catch(()=>'')
 let d=null;try{d=txt?JSON.parse(txt):{}}catch(e){throw Error('SMSCode membalas bukan JSON (HTTP '+r.status+')')}
 const er=d&&d.error
 if(er||d&&d.success===false){const e=Error(String((er&&er.message)||scMsg(r.status)).slice(0,200));e.code=(er&&er.code)||'';throw e}
 if(!r.ok)throw Error(scMsg(r.status))
 return d&&('data' in d)?d.data:d}
const scMsg=s=>s===401?'Token SMSCode tidak valid atau belum aktif'
 :s===403?'Akses SMSCode ditolak'
 :s===404?'Data yang diminta tidak ada di SMSCode'
 :s===409?'SMSCode menolak: permintaan bentrok / saldo tidak cukup'
 :s===422?'SMSCode menolak parameternya'
 :s===429?'Terlalu banyak permintaan ke SMSCode, coba lagi sebentar'
 :s>=500?'SMSCode sedang gangguan (HTTP '+s+')':'SMSCode menolak permintaan (HTTP '+s+')'
// ACTIVE / OTP_RECEIVED / COMPLETED / CANCELED / EXPIRED
const scState=v=>{const x=String(v||'').toUpperCase()
 return x==='CANCELED'||x==='CANCELLED'?'canceled':x==='EXPIRED'?'expired':x==='COMPLETED'?'completed':'pending'}
const scCountries=()=>memo('sc:cl',600000,async()=>{const m=new Map()
 for(const c of arr(await sc('/catalog/countries'))){if(c.active===false)continue
  m.set(String(c.id),{name:String(c.name||c.id),flag:c.emoji||f2(c.code)||'🌐'})}
 return m})
// Semua produk satu layanan diambil sekaligus (country_id boleh dikosongkan), lalu
// dikelompokkan per negara. Satu baris produk = satu pilihan harga/operator di situs.
const scProducts=sid=>memo('sc:pr:'+sid,20000,async()=>{
 const out=[]
 for(let page=1;page<=5;page++){
  const d=arr(await sc(`/catalog/products?platform_id=${encodeURIComponent(sid)}&sort=price_asc&limit=2000&page=${page}`))
  out.push(...d);if(d.length<2000)break}
 return out})
const smscode={
 services:()=>memo('sc:sv',60000,async()=>arr(await sc('/catalog/services'))
  .filter(x=>x.active!==false)
  .map(x=>({service_code:String(x.id??''),service_name:String(x.name||x.code||x.id||'')}))
  .filter(x=>x.service_code&&x.service_name)
  .sort((a,b)=>a.service_name.localeCompare(b.service_name))),
 countries:sid=>memo('sc:ct:'+sid,20000,async()=>{
  const [by,pr]=await Promise.all([scCountries(),scProducts(sid)])
  const g=new Map()
  for(const x of pr){
   if(x.active===false)continue
   const cid=String(x.country_id??''),price=Math.round(+x.price||0),stock=+x.available||0
   if(!cid||price<=0||stock<=0)continue
   if(!g.has(cid))g.set(cid,[])
   g.get(cid).push({provider_id:String(x.id),country_id:cid,price,stock,
    provider_name:String(x.operator_name||x.name||'Any')})}
  return [...g.entries()].map(([cid,pl])=>{const m=by.get(cid)||{name:cid,flag:'🌐'}
   return {name:m.name,flag:m.flag,country_id:cid,success_rate:0,pricelist:pl.sort((a,b)=>a.price-b.price)}})}),
 // product_id = tier-slot pasti, jadi harganya tidak bergeser di tengah jalan.
 // Idempotency-Key menjaga agar percobaan ulang jaringan tidak membuat order dobel.
 order:async b=>{
  const d=await sc('/orders/create',{method:'POST',idem:'arta-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
   body:{product_id:num(b.providerId),quantity:1}})
  const o=((d||{}).orders||[])[0]
  if(!o||!o.id||!o.phone_number){
   const gagal=(d||{}).failed_count
   throw Error('SMSCode tidak mengembalikan nomor'+(gagal?' ('+gagal+' percobaan gagal)':''))}
  return {id:String(o.id),phone:wnPhone(o.phone_number),
   expiredAt:Date.parse(o.expires_at||'')||Date.now()+10*60000,cost:Math.round(+o.amount||0)}},
 status:async id=>{const o=await sc('/orders/'+encodeURIComponent(id))
  const st=scState(o&&o.status),pesan=(o&&o.otp_message)||null
  let otp=o&&o.otp_code!=null?String(o.otp_code).trim():''
  // Sebagian verifikasi datang sebagai KALIMAT tanpa kode terpisah (mis. tautan konfirmasi).
  // Kodenya dicoba diambil dari kalimatnya; kalau memang tidak ada angka, kalimatnya sendiri
  // yang ditampilkan supaya pembeli tetap bisa memakainya, bukan dibiarkan kosong.
  if(!otp&&pesan){const m=String(pesan).match(/\b(\d{4,8})\b/);otp=m?m[1]:String(pesan).trim().slice(0,60)}
  if(otp)return {otp,msg:pesan,state:'success'}
  // selesai tanpa SMS apa pun = nomornya tidak pernah menerima kode -> kedaluwarsa (refund)
  return {otp:null,msg:pesan,state:st==='completed'?'expired':st}},
 // Batal baru diizinkan 2 menit setelah order (CANCEL_TOO_EARLY). Penolakannya
 // diteruskan apa adanya: antrean pembatalan di lib/sync.js yang mencoba ulang.
 cancel:async id=>{await sc('/orders/cancel',{method:'POST',body:{id:num(id)}})},
 balance:()=>sc('/balance')}

// ---------- Dibanana (dibanana.id) — 4 server: ekonomi / premium / khusus / wa_luar ----------
// REST sederhana, autentikasi Bearer (bn_live_...), semua harga Rupiah. Balasan selalu {ok:true|false,...}.
// - Daftar harga butuh service + country; API tidak punya daftar negara, jadi negara yang dipindai
//   diatur admin (admin > Server > Negara Dibanana). Bawaan: id (wa_luar: my, sg, us, uk).
// - "id" produk dari /prices bersifat opaque dan bisa kedaluwarsa. provider_id di situs ini disimpan
//   sebagai "<harga>~<id>[~<operator>]" supaya kalau id-nya basi saat order (mis. penggantian nomor
//   Jaminan OTP beberapa menit kemudian) produk dengan harga yang sama bisa dicari ulang otomatis.
// - ID order diberi awalan "dbn" (mis. dbn84213) agar tidak bentrok dengan ID penyedia lain di kv "o:".
export async function dbn(path,{method='GET',params={},body=null,timeout=25000}={}){
 const s=await getSec()
 if(!s.DIBANANA_KEY)throw Error('API key Dibanana belum diisi (admin > Integrasi > Dibanana)')
 const base=(s.DIBANANA_BASE||'https://dibanana.id/api/v1').replace(/\/+$/,'')
 const u=new URL(base+path)
 for(const [k,v] of Object.entries(params))if(v!=null&&v!=='')u.searchParams.set(k,String(v))
 const h={Authorization:'Bearer '+s.DIBANANA_KEY,Accept:'application/json'}
 if(body)h['Content-Type']='application/json'
 let r
 try{r=await fetch(u,{method,cache:'no-store',headers:h,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)})}
 catch(e){throw Error('Dibanana tidak bisa dihubungi: '+(e.name==='TimeoutError'?'timeout':e.message))}
 const txt=await r.text().catch(()=>'')
 let d=null;try{d=txt?JSON.parse(txt):{}}catch(e){throw Error('Dibanana membalas bukan JSON (HTTP '+r.status+')')}
 if(!d||d.ok===false||!r.ok){const e=Error(String((d&&d.message)||dbnMsg(r.status)).slice(0,200));e.code=(d&&d.error)||'';throw e}
 return d}
const dbnMsg=s=>s===401?'API key Dibanana salah atau nonaktif'
 :s===402?'Saldo Dibanana tidak cukup'
 :s===404?'Data yang diminta tidak ada di Dibanana'
 :s===422?'Dibanana menolak permintaan (stok habis / status order tidak sesuai)'
 :s===503?'Server penyedia Dibanana sedang tidak merespons, coba lagi'
 :s>=500?'Dibanana sedang gangguan (HTTP '+s+')':'Dibanana menolak permintaan (HTTP '+s+')'
const DBN_OPS=['any','telkomsel','indosat','axis','three','smartfren','byu']
const dbnCfg=async()=>((await kv.get('cfg'))||{}).dbn||{}
const dbnCountry=code=>{const c=String(code||'').toLowerCase()
 const iso=c==='uk'?'GB':c.toUpperCase()
 let name=iso;try{name=new Intl.DisplayNames(['id'],{type:'region'}).of(iso)||iso}catch(e){}
 return {name,flag:f2(iso)||'🌐'}}
const dbnState=v=>{const s=String(v||'').toLowerCase()
 return s==='received'?'success':s==='cancelled'||s==='canceled'||s==='resend_cancelled'?'canceled'
  :s==='expired'||s==='refunded'?'expired':'pending'}
const dbnId=id=>String(id||'').replace(/^dbn/,'').replace(/[^0-9]/g,'')
// Negara bawaan yang dipindai (API Dibanana tak punya daftar negara). Negara yang tidak didukung / stok kosong
// otomatis tidak tampil, jadi daftar ini boleh panjang. Admin bisa menggantinya per server di admin > Server.
const DBN_COUNTRIES='id,my,sg,us,uk,ph,th,vn,in,co,br,mx,ar,cl,pe,ru,ua,kz,tr,pk,bd,lk,kh,la,mm,cn,hk,tw,jp,kr,au,nz,ca,de,fr,es,it,nl,pl,ro,cz,pt,se,no,fi,ie,gr,hu,bg,rs,il,sa,ae,eg,ma,dz,ng,gh,ke,tz,ug,za,zm,cm,ci,sn,et,mz,mg'
const dbnDefault=()=>DBN_COUNTRIES
const dbnServer=(n,sv)=>({
 services:()=>memo('dbn:sv:'+sv,60000,async()=>{
  const d=await dbn('/services',{params:{server:sv}})
  return (d.services||[]).map(x=>({service_code:String(x.code??''),service_name:String(x.name||x.code||'')}))
   .filter(x=>x.service_code&&x.service_name).sort((a,b)=>a.service_name.localeCompare(b.service_name))}),
 countries:sid=>memo(`dbn:ct:${sv}:${sid}`,60000,async()=>{
  const dc=await dbnCfg()
  const codes=String(((dc.countries||{})[n])||dbnDefault(sv)).split(',').map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]/g,'')).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,100)
  const one=async code=>{
   const d=await dbn('/prices',{params:{server:sv,service:sid,country:code},timeout:12000})
   let pl=[]
   ;(d.providers||[]).forEach((x,i)=>{const price=Math.round(+x.price_idr||0),stock=+x.stock||0
    if(!x.id||price<=0||stock<=0)return
    if(sv==='premium')for(const op of DBN_OPS)pl.push({provider_id:`${price}~${x.id}~${op}`,country_id:code,price,stock,
     provider_name:(op==='any'?'Operator acak':op.charAt(0).toUpperCase()+op.slice(1))+(d.providers.length>1?' · Paket '+(i+1):'')})
    else pl.push({provider_id:`${price}~${x.id}`,country_id:code,price,stock,provider_name:d.providers.length>1?'Paket '+(i+1):''})})
   if(!pl.length)return null
   const m=dbnCountry(code)
   return {name:m.name,flag:m.flag,country_id:code,success_rate:0,pricelist:pl.sort((a,b)=>a.price-b.price)}}
  // dipindai per kelompok 10 negara supaya Dibanana tidak kebanjiran permintaan sekaligus
  const out=[];for(let i=0;i<codes.length;i+=10){const r=await Promise.allSettled(codes.slice(i,i+10).map(one));for(const x of r)if(x.status==='fulfilled'&&x.value)out.push(x.value)}
  return out}),
 order:async b=>{
  const [price,pid,op]=String(b.providerId||'').split('~')
  if(!pid)throw Error('Paket Dibanana tidak valid, muat ulang halaman lalu pesan lagi')
  const kirim=async id=>dbn('/order',{method:'POST',body:{id,...(sv==='premium'?{operator:DBN_OPS.includes(op)?op:'any'}:{})}})
  let d
  try{d=await kirim(pid)}
  catch(e){
   // id produk basi -> cari produk dengan harga yang sama dari daftar terbaru, lalu ulangi sekali
   if(e.code!=='INVALID_PRODUCT_ID')throw e
   const fresh=await dbn('/prices',{params:{server:sv,service:b.serviceId,country:b.countryId}})
   const cocok=(fresh.providers||[]).find(x=>x.id&&Math.round(+x.price_idr||0)===Math.round(+price||0)&&(+x.stock||0)>0)
   if(!cocok)throw Error('Harga paket ini sudah berubah di Dibanana, muat ulang halaman lalu pesan lagi')
   d=await kirim(cocok.id)}
  if(!d.order_id||!d.phone_number)throw Error('Respons order Dibanana tidak lengkap')
  // order Dibanana kedaluwarsa ±19 menit sejak dibuat
  return {id:'dbn'+d.order_id,phone:wnPhone(d.phone_number),expiredAt:Date.now()+18*60000,cost:Math.round(+d.price_idr||+price||0)}},
 status:async id=>{
  const d=await dbn('/status',{params:{order_id:dbnId(id)}})
  const st=dbnState(d.status),pesan=d.full_sms||null
  let otp=[d.otp_code_2,d.otp_code].map(x=>x==null?'':String(x).trim()).find(Boolean)||''
  // verifikasi berbentuk kalimat: ambil angkanya dari isi SMS
  if(!otp&&st==='success'&&pesan){const m=String(pesan).match(/\b(\d{4,8})\b/);otp=m?m[1]:String(pesan).trim().slice(0,60)}
  if(otp&&st==='success')return {otp,msg:pesan,state:'success'}
  return {otp:null,msg:pesan,state:st}},
 // Dibanana: batal baru bisa 120 detik setelah order (TOO_EARLY); penolakan diteruskan apa adanya
 // supaya antrean pembatalan di lib/sync.js yang mencoba ulang. Saldo kembali penuh.
 cancel:async id=>{await dbn('/cancel',{method:'POST',body:{order_id:+dbnId(id)}})},
 balance:()=>dbn('/balance')})

export const SERVERS=[
 {server:'warungnokos_s1',name:'Server Plus',badge:'Utama',provider:'WarungNokos S1',description:'Jalur utama WarungNokos (H2H): stok & rate sukses terlihat per server.',needs:'WN_KEY'},
 {server:'warungnokos_s2',name:'Server Express',badge:'Harga final',provider:'WarungNokos S2',description:'Server 2 WarungNokos: harga sudah final, pilihan negaranya paling banyak. Pembatalan baru diizinkan 3 menit setelah order.',needs:'WN_KEY'},
 {server:'warungnokos_s3',name:'Server Lite',badge:'Stok tampil',provider:'WarungNokos S2 lama',description:'Server 2 WarungNokos jalur lama: stok per server ikut ditampilkan.',needs:'WN_KEY'},
 {server:'smscode_s1',name:'SERVER FAST OTP V 1',badge:'Cepat',provider:'SMSCode',description:'Nomor dari SMSCode: stok & operator terlihat per pilihan, kode OTP biasanya paling cepat masuk. Pembatalan diizinkan 2 menit setelah order.',needs:'SMSCODE_KEY'},
 {server:'dibanana_s1',name:'Dibanana Ekonomi',badge:'Hemat',provider:'Dibanana · ekonomi',description:'Server ekonomi Dibanana: harga termurah, nomor Indonesia. Pembatalan diizinkan 2 menit setelah order.',needs:'DIBANANA_KEY'},
 {server:'dibanana_s2',name:'Dibanana Premium',badge:'Pilih operator',provider:'Dibanana · premium',description:'Server premium Dibanana: bisa pilih operator (Telkomsel, Indosat, Axis, Tri, Smartfren, by.U) atau acak.',needs:'DIBANANA_KEY'},
 {server:'dibanana_s3',name:'Dibanana Khusus',badge:'Khusus',provider:'Dibanana · khusus',description:'Server khusus Dibanana untuk aplikasi tertentu.',needs:'DIBANANA_KEY'},
 {server:'dibanana_s4',name:'Dibanana WA Luar',badge:'WA luar negeri',provider:'Dibanana · wa_luar',description:'Nomor WhatsApp luar negeri (Malaysia, Singapura, AS, Inggris, dll).',needs:'DIBANANA_KEY'}]
export const P={warungnokos_s1:wn1,warungnokos_s2:wn2,warungnokos_s3:wn3,smscode_s1:smscode,
 dibanana_s1:dbnServer(1,'ekonomi'),dibanana_s2:dbnServer(2,'premium'),dibanana_s3:dbnServer(3,'khusus'),dibanana_s4:dbnServer(4,'wa_luar')}

// ---------- Deposit lewat WarungNokos (salah satu rute di lib/deposit.js) ----------
// Catatan API: field hasil "create" berada di LEVEL ATAS (bukan di dalam `data`),
// minimal Rp2.000, dan WarungNokos hanya mengizinkan 3 tagihan pending sekaligus.
export const wnDep={
 profile:()=>wn('/api/user/profile'),
 create:async(amount,method)=>{
  const amt=Math.round(+amount||0)
  const d=await wn('/api/deposit/create',{method:'POST',body:{amount:amt,method:method||'qris'}})
  if(!d||!d.trxId)throw Error('WarungNokos tidak mengembalikan ID deposit')
  const total=Math.round(+d.total||amt)
  return {id:String(d.trxId),total,fee:Math.max(0,total-amt),qr:d.qr_string||'',qrImg:d.qr_image||'',va:'',exp:d.expired_at}},
 // status dikembalikan apa adanya lalu diterjemahkan normSt() di lib/deposit.js
 check:async id=>{const d=await wn('/api/deposit/status/'+encodeURIComponent(id))
  return {status:d&&(d.status??d.state??(d.detail&&d.detail.status))}},
 cancel:async id=>{try{await wn('/api/deposit/cancel',{method:'POST',body:{trxId:String(id)}})}catch(e){}}}
