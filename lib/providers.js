// Penyedia nomor (nokos). Setiap penyedia mengikuti antarmuka yang sama: services / countries / order / status / cancel.
//  1) Artapedia lama (warungnokos_s1, warungnokos_s2)  -> API v1 Artapedia, Bearer key
//  2) JasaOTP / Ditznesia (jasaotp_s1..s5)             -> https://www.ditznesia.com/api/dev (apikey di query)
// Kredensial dibaca dari admin > Integrasi (atau env sebagai cadangan), lihat lib/settings.js
import {kv} from './db'
import {getSec} from './settings'
const memo=(k,ttl,fn)=>{const m=globalThis.__memo||(globalThis.__memo={}),c=m[k];if(c&&Date.now()-c.t<ttl)return c.p
 const p=Promise.resolve().then(fn);m[k]={t:Date.now(),p};p.catch(()=>{if(m[k]&&m[k].p===p)delete m[k]});return p}

// ---------- Artapedia lama ----------
const up=async(path,body)=>{
 const s=await getSec(),base=(s.ARTA_BASE||'https://artapedianokosmurahid.vercel.app/api/v1').replace(/\/+$/,'')
 if(!s.ARTA_KEY)throw Error('API key Artapedia belum diisi (admin > Integrasi)')
 // cache:'no-store' WAJIB: tanpa ini Next.js menyimpan jawaban GET di Data Cache, sehingga
 // status deposit/order yang sudah berubah di upstream tetap terbaca dengan jawaban lama —
 // deposit yang sudah dibayar terlihat "pending" terus dan saldonya tidak pernah masuk.
 const r=await fetch(base+path,{method:body?'POST':'GET',cache:'no-store',headers:{Authorization:'Bearer '+s.ARTA_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)})
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||('Upstream error '+r.status));return d}
export const UPSTREAM=up
const art=server=>({
 services:async()=>(await up('/services?server='+server)).items||[],
 // price = harga yang dipotong upstream dari saldo kita (sell_price upstream); markup kita ditambah di atasnya
 countries:async sid=>((await up(`/countries?server=${server}&service_id=${encodeURIComponent(sid)}`)).items||[]).map(c=>({...c,pricelist:(c.pricelist||[]).map(x=>({...x,price:+x.sell_price}))})),
 order:async b=>{const d=await up('/order',{server,serviceId:b.serviceId,countryId:b.countryId,providerId:b.providerId,operatorId:b.operatorId,serviceName:b.serviceName,countryName:b.countryName});return {id:String(d.orderId),phone:d.phoneNumber,expiredAt:d.expiredAt||Date.now()+10*60000,cost:d.price}},
 status:async id=>{const d=await up('/orders/status?order_id='+id);return {otp:d.otpCode||null,msg:d.otpMsg||null,state:d.status}},
 // CATATAN: endpoint cancel TIDAK ada di dokumentasi. Tambahkan POST /v1/orders/cancel di Artapedia lama, atau ubah baris ini.
 cancel:async id=>{await up('/orders/cancel',{order_id:id})}})

// ---------- JasaOTP / Ditznesia ----------
export async function dz(path,params={}){
 const s=await getSec(),base=(s.DITZ_BASE||'https://www.ditznesia.com/api/dev').replace(/\/+$/,'')
 if(!s.DITZ_KEY)throw Error('API key JasaOTP belum diisi (admin > Integrasi)')
 const u=new URL(base+path);u.searchParams.set('apikey',s.DITZ_KEY)
 for(const [k,v] of Object.entries(params))if(v!=null&&v!=='')u.searchParams.set(k,String(v))
 const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(25000)}),d=await r.json().catch(()=>null)
 if(!r.ok){const m=d&&(d.detail||d.error||d.message);throw Error(typeof m==='string'&&m?m:(m?JSON.stringify(m):'JasaOTP error '+r.status))}
 return d}
const arr=d=>Array.isArray(d)?d:(d&&(d.items||d.data||d.result))||[]
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
 {server:'warungnokos_s1',name:'Server Plus',badge:'Utama',provider:'WarungNokos',description:'Jalur utama WarungNokos (H2H), stok melimpah & rate sukses tertinggi.',needs:'ARTA_KEY'},
 {server:'warungnokos_s2',name:'Server Express',badge:'Global',provider:'WarungNokos S2',description:'Server2 WarungNokos, dipakai saat stok server utama kosong.',needs:'ARTA_KEY'},
 {server:'jasaotp_s1',name:'JasaOTP 1',badge:'Pilih operator',provider:'JasaOTP S1',description:'Bisa pilih operator seluler (Telkomsel, Indosat, dll) atau acak.',needs:'DITZ_KEY'},
 {server:'jasaotp_s2',name:'JasaOTP 2',badge:'Banyak varian',provider:'JasaOTP S2',description:'Beberapa varian harga per layanan, pilih yang paling pas.',needs:'DITZ_KEY'},
 {server:'jasaotp_s3',name:'JasaOTP 3',badge:'Simpel',provider:'JasaOTP S3',description:'Satu harga per layanan, langsung order.',needs:'DITZ_KEY'},
 {server:'jasaotp_s4',name:'JasaOTP 4',badge:'Global',provider:'JasaOTP S4',description:'Banyak negara, varian harga, bisa dibatalkan kapan saja.',needs:'DITZ_KEY'},
 {server:'jasaotp_s5',name:'JasaOTP 5',badge:'Multi provider',provider:'JasaOTP S5',description:'Varian dari banyak provider dengan pilihan harga.',needs:'DITZ_KEY'}]
export const P={warungnokos_s1:art('warungnokos_s1'),warungnokos_s2:art('warungnokos_s2'),
 jasaotp_s1:ditz(1),jasaotp_s2:ditz(2),jasaotp_s3:ditz(3),jasaotp_s4:ditz(4),jasaotp_s5:ditz(5)}

// ---------- Deposit lewat Artapedia lama (dipakai sebagai salah satu rute di lib/deposit.js) ----------
export const upDep={
 methods:()=>up('/deposit/methods'),
 create:(amount,provider)=>up('/deposit',{amount,provider}),
 // status bisa datang dengan nama field berbeda-beda; semuanya diteruskan apa adanya
 // lalu diterjemahkan di lib/deposit.js (normSt), bukan dibandingkan mentah-mentah.
 check:async id=>{const d=await up('/deposit?order_id='+id)
  return {status:d.status??d.state??d.payment_status??d.transaction_status??d.data?.status}},
 // CATATAN: endpoint cancel deposit upstream tidak ada di dokumentasi; dicoba best-effort, kegagalan diabaikan (pembatalan tetap berlaku di sisi situs ini)
 cancel:async id=>{try{await up('/deposit/cancel',{order_id:id})}catch(e){}}}
