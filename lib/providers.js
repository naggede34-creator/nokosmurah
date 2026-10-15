// Penyedia nomor (nokos). Setiap penyedia mengikuti antarmuka yang sama: services / countries / order / status / cancel.
//  1) WarungNokos resmi (warungnokos_s1..s3) -> https://warungnokos.web.id, header x-api-key
//     - s1 = /api/otp      (Server 1 H2H: stok & rate sukses per server)
//     - s2 = /api/warkosv3 (Server 2 baru: harga final, alur negara -> layanan -> produk)
//     - s3 = /api/smscode  (Server 2 jalur lama: stok per produk)
//  2) JasaOTP / Ditznesia (jasaotp_s1..s5)   -> https://www.ditznesia.com/api/dev (apikey di query)
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

// ---------- JasaOTP / Ditznesia ----------
export async function dz(path,params={}){
 const s=await getSec(),base=(s.DITZ_BASE||'https://www.ditznesia.com/api/dev').replace(/\/+$/,'')
 if(!s.DITZ_KEY)throw Error('API key JasaOTP belum diisi (admin > Integrasi)')
 const u=new URL(base+path);u.searchParams.set('apikey',s.DITZ_KEY)
 for(const [k,v] of Object.entries(params))if(v!=null&&v!=='')u.searchParams.set(k,String(v))
 const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(25000)}),d=await r.json().catch(()=>null)
 if(!r.ok){const m=d&&(d.detail||d.error||d.message);throw Error(typeof m==='string'&&m?m:(m?JSON.stringify(m):'JasaOTP error '+r.status))}
 return d}
const dzState=s=>{s=String(s||'').toLowerCase();return s==='batal'?'canceled':s==='kadaluarsa'||s==='timeout'?'expired':s}
const dzCfg=async()=>((await kv.get('cfg'))||{}).ditz||{}
const defCountry=n=>n===4?'id':'6'
const dzCountries=n=>memo('dz:cl:'+n,300000,async()=>arr(await dz('/countries',{server:n})).map(c=>({code:String(c.code),name:String(c.name||c.code),flag:c.flag||'🌐'})))
const dzOps=(n,code)=>memo(`dz:op:${n}:${code}`,600000,async()=>{try{const d=await dz('/operators',{server:n,country:code});return (d.operators||[]).map(String)}catch(e){return ['any']}})
const opName=o=>o==='any'?'Operator acak':o.charAt(0).toUpperCase()+o.slice(1)
const ditz=n=>({
 // daftar aplikasi diambil dari negara bawaan (Indonesia); negara lain dicek saat aplikasi dipilih
 services:()=>memo('dz:sv:'+n,60000,async()=>{
  const dc=await dzCfg(),code=String(((dc.countries||{})[n]||'').split(',')[0]||'').trim()||defCountry(n)
  const seen=new Map()
  for(const x of arr(await dz('/services',{server:n,country:code}))){const id=String(x.produk||x.id||'');if(!id||seen.has(id))continue;if(x.count!=null&&+x.count<=0)continue
   seen.set(id,{service_code:id,service_name:String(x.service_name||id)})}
  return [...seen.values()].sort((a,b)=>a.service_name.localeCompare(b.service_name))}),
 // negara + paket harga untuk satu aplikasi. Negara yang dicek diatur admin (Server > JasaOTP), bawaan: Indonesia + beberapa negara pertama.
 countries:sid=>memo(`dz:ct:${n}:${sid}`,20000,async()=>{
  const dc=await dzCfg(),all=await dzCountries(n),by=new Map(all.map(c=>[c.code,c]))
  let codes=String((dc.countries||{})[n]||'').split(',').map(x=>x.trim()).filter(Boolean)
  if(!codes.length){const id=all.find(c=>/^indonesia$/i.test(c.name)),rest=all.filter(c=>!id||c.code!==id.code).map(c=>c.code)
   codes=[...(id?[id.code]:[defCountry(n)]),...rest].slice(0,Math.max(1,Math.min(30,+dc.max||10)))}
  const out=await Promise.allSettled(codes.map(async code=>{
   const items=arr(await dz('/services',{server:n,country:code,service:sid})).filter(x=>String(x.produk||x.id)===String(sid)&&(x.count==null||+x.count>0))
   if(!items.length)return null
   const meta=by.get(code)||{name:code,flag:'🌐'};let pl=[]
   if(n===1){const ops=await dzOps(1,code),st=items.reduce((a,x)=>a+(+x.count||0),0),pr=Math.min(...items.map(x=>+x.price||0))
    pl=[...new Set(['any',...ops])].map(o=>({provider_id:o,country_id:code,price:pr,stock:st,provider_name:opName(o)}))}
   else pl=items.map(x=>({provider_id:n===3?'default':String(x.provider??x.price),country_id:code,price:+x.price||0,stock:+x.count||0,provider_name:n===3?'':('Varian '+(x.provider??x.price))}))
   pl=pl.filter(x=>x.price>0);if(!pl.length)return null
   return {name:meta.name,flag:meta.flag,country_id:code,success_rate:0,pricelist:pl}}))
  return out.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value)}),
 order:async b=>{
  const q={server:n,country:b.countryId,produk:b.serviceId}
  if(n===1)q.operator=b.providerId||'any'
  if(n===2||n===4||n===5)q.provider=b.providerId
  const d=await dz('/order',q);if(!d||!d.id||!d.number)throw Error('Respons order JasaOTP tidak lengkap')
  return {id:String(d.id),phone:String(d.number),expiredAt:+d.expires_at_ms||Date.now()+10*60000,cost:+d.price||0}},
 status:async id=>{const d=await dz('/status',{id});const otp=d.otp&&!/^waiting$/i.test(String(d.otp))&&String(d.status||'').toLowerCase()==='success'?String(d.otp):null
  return {otp,msg:null,state:dzState(d.status)}},
 // server 1/2/3/5: baru bisa dibatalkan 2 menit setelah order (kita pakai 3 menit), server 4 kapan saja
 cancel:async id=>{await dz('/cancel',{id})}})

export const SERVERS=[
 {server:'warungnokos_s1',name:'Server Plus',badge:'Utama',provider:'WarungNokos S1',description:'Jalur utama WarungNokos (H2H): stok & rate sukses terlihat per server.',needs:'WN_KEY'},
 {server:'warungnokos_s2',name:'Server Express',badge:'Harga final',provider:'WarungNokos S2',description:'Server 2 WarungNokos: harga sudah final, pilihan negaranya paling banyak. Pembatalan baru diizinkan 3 menit setelah order.',needs:'WN_KEY'},
 {server:'warungnokos_s3',name:'Server Lite',badge:'Stok tampil',provider:'WarungNokos S2 lama',description:'Server 2 WarungNokos jalur lama: stok per server ikut ditampilkan.',needs:'WN_KEY'},
 {server:'jasaotp_s1',name:'JasaOTP 1',badge:'Pilih operator',provider:'JasaOTP S1',description:'Bisa pilih operator seluler (Telkomsel, Indosat, dll) atau acak.',needs:'DITZ_KEY'},
 {server:'jasaotp_s2',name:'JasaOTP 2',badge:'Banyak varian',provider:'JasaOTP S2',description:'Beberapa varian harga per layanan, pilih yang paling pas.',needs:'DITZ_KEY'},
 {server:'jasaotp_s3',name:'JasaOTP 3',badge:'Simpel',provider:'JasaOTP S3',description:'Satu harga per layanan, langsung order.',needs:'DITZ_KEY'},
 {server:'jasaotp_s4',name:'JasaOTP 4',badge:'Global',provider:'JasaOTP S4',description:'Banyak negara, varian harga, bisa dibatalkan kapan saja.',needs:'DITZ_KEY'},
 {server:'jasaotp_s5',name:'JasaOTP 5',badge:'Multi provider',provider:'JasaOTP S5',description:'Varian dari banyak provider dengan pilihan harga.',needs:'DITZ_KEY'}]
export const P={warungnokos_s1:wn1,warungnokos_s2:wn2,warungnokos_s3:wn3,
 jasaotp_s1:ditz(1),jasaotp_s2:ditz(2),jasaotp_s3:ditz(3),jasaotp_s4:ditz(4),jasaotp_s5:ditz(5)}

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
