// Penyedia nomor (nokos). Setiap penyedia mengikuti antarmuka yang sama: services / countries / order / status / cancel.
// Penyedia aktif: Dibanana (dibanana_s1..s4).
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
  return {id:'dbn'+d.order_id,phone:phoneNum(d.phone_number),expiredAt:Date.now()+18*60000,cost:Math.round(+d.price_idr||+price||0)}},
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

// ---------- Telekos: NOMOR TELEGRAM SIAP PAKAI (session sudah login) — api.telekos.my.id ----------
// Bukan OTP biasa: nomor langsung dipakai, "OTP" = kode login Telegram (@777000) yang dibaca dari session di server Telekos.
// - Autentikasi header x-api-key (telekos_...), harga Rupiah, saldo akun Telekos dipotong langsung saat order.
// - Satu layanan saja ("Telegram"); daftar negara + harga + stok dari GET /api/telegram/countries.
// - provider_id disimpan "<harga>~<KODE_NEGARA>". ID order diberi awalan "tlk" (transactionId Telekos, acak 12 karakter).
// - Kode bisa diambil kapan saja selama session aktif (tanpa batas waktu), jadi batas tunggu order dibuat panjang (24 jam).
// - Telekos TIDAK mengembalikan saldo untuk nomor yang sudah dibeli, jadi server ini ditandai noCancel:
//   pembeli tidak bisa membatalkan sendiri (lihat cancelBlock di lib/sync.js). cancel() di sini = "release" session
//   (dipakai admin / kedaluwarsa), dan idempoten.
export async function tlk(path,{method='GET',body=null,timeout=25000}={}){
 const s=await getSec()
 if(!s.TELEKOS_KEY)throw Error('API key Telekos belum diisi (admin > Integrasi > Telekos)')
 const base=(s.TELEKOS_BASE||'https://api.telekos.my.id').replace(/\/+$/,'')
 const h={'x-api-key':s.TELEKOS_KEY,Accept:'application/json'}
 if(body)h['Content-Type']='application/json'
 let r
 try{r=await fetch(base+path,{method,cache:'no-store',headers:h,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout)})}
 catch(e){throw Error('Telekos tidak bisa dihubungi: '+(e.name==='TimeoutError'?'timeout':e.message))}
 const txt=await r.text().catch(()=>'')
 let d=null;try{d=txt?JSON.parse(txt):{}}catch(e){throw Error('Telekos membalas bukan JSON (HTTP '+r.status+')')}
 if(!d||d.ok===false||d.success===false||!r.ok){const e=Error(String((d&&(d.message||d.error))||tlkMsg(r.status)).slice(0,200));e.status=r.status;throw e}
 return d}
const tlkMsg=s=>s===401||s===403?'API key Telekos salah atau nonaktif'
 :s===402?'Saldo Telekos tidak cukup'
 :s===404?'Data yang diminta tidak ada di Telekos'
 :s===429?'Terlalu banyak permintaan ke Telekos, coba lagi sebentar'
 :s>=500?'Telekos sedang gangguan (HTTP '+s+')':'Telekos menolak permintaan (HTTP '+s+')'
const tlkId=id=>String(id||'').replace(/^tlk/,'').replace(/[^A-Za-z0-9_-]/g,'')
// saldo Telekos: bentuk balasan /api/balance tidak baku, jadi dibaca dari beberapa kemungkinan nama field
export const tlkBalance=d=>{const x=d&&typeof d==='object'?d:{};const v=[x.balance,x.saldo,x.saldoSisa,x.data&&x.data.balance,x.data&&x.data.saldo,x.user&&x.user.balance].find(y=>y!=null&&!isNaN(+y));return Math.round(+v||0)}
const TLK_SERVICE={service_code:'telegram',service_name:'Telegram (nomor siap pakai)'}
const telekosServer={
 services:async()=>[TLK_SERVICE],
 countries:()=>memo('tlk:ct',30000,async()=>{
  const d=await tlk('/api/telegram/countries')
  return (d.countries||[]).filter(c=>c&&c.code&&Math.round(+c.price)>0&&Math.floor(+c.stock)>0).map(c=>{
   const code=String(c.code).toUpperCase().replace(/[^A-Z0-9]/g,''),price=Math.round(+c.price),m=dbnCountry(code.toLowerCase())
   return {name:(c.name&&String(c.name).toUpperCase()!==code)?String(c.name):m.name,flag:c.flag||m.flag,country_id:code,success_rate:0,
    pricelist:[{provider_id:`${price}~${code}`,country_id:code,price,stock:Math.floor(+c.stock),provider_name:'Session siap pakai'}]}}).sort((a,b)=>a.pricelist[0].price-b.pricelist[0].price)}),
 order:async b=>{
  const [price,code]=String(b.providerId||'').split('~'),cc=String(code||b.countryId||'').toUpperCase().replace(/[^A-Z0-9]/g,'')
  if(!cc)throw Error('Paket Telekos tidak valid, muat ulang halaman lalu pesan lagi')
  const d=await tlk('/api/telegram/order',{method:'POST',body:{country:cc}})
  const tid=d.transactionId||d.orderId
  if(!tid||!d.phone)throw Error('Respons order Telekos tidak lengkap')
  return {id:'tlk'+tid,phone:phoneNum(d.phone),expiredAt:Date.now()+24*3600000,cost:Math.round(+d.price||+price||0)}},
 status:async id=>{
  const d=await tlk('/api/telegram/code',{method:'POST',body:{transactionId:tlkId(id)}})
  const st=String(d.state||'').toLowerCase()
  if(st==='ok'&&d.code!=null&&String(d.code).trim())return {otp:String(d.code).trim(),msg:'Kode login Telegram untuk '+(d.phone||'nomor ini')+'. Masukkan di aplikasi Telegram.',state:'success'}
  // session mati sebelum ada kode: nomor tidak bisa dipakai -> diperlakukan kedaluwarsa (saldo pembeli dikembalikan)
  if(st==='session_terminated')return {otp:null,msg:d.message||null,state:'expired'}
  return {otp:null,msg:d.message||null,state:'pending'}},
 cancel:async id=>{await tlk('/api/telegram/release',{method:'POST',body:{transactionId:tlkId(id)}})},
 balance:()=>tlk('/api/balance')}

export const SERVERS=[
 {server:'dibanana_s1',name:'Dibanana Ekonomi',badge:'Hemat',provider:'Dibanana · ekonomi',description:'Server ekonomi Dibanana: harga termurah, nomor Indonesia. Pembatalan diizinkan 2 menit setelah order.',needs:'DIBANANA_KEY'},
 {server:'dibanana_s2',name:'Dibanana Premium',badge:'Pilih operator',provider:'Dibanana · premium',description:'Server premium Dibanana: bisa pilih operator (Telkomsel, Indosat, Axis, Tri, Smartfren, by.U) atau acak.',needs:'DIBANANA_KEY'},
 {server:'dibanana_s3',name:'Dibanana Khusus',badge:'Khusus',provider:'Dibanana · khusus',description:'Server khusus Dibanana untuk aplikasi tertentu.',needs:'DIBANANA_KEY'},
 {server:'dibanana_s4',name:'Dibanana WA Luar',badge:'WA luar negeri',provider:'Dibanana · wa_luar',description:'Nomor WhatsApp luar negeri (Malaysia, Singapura, AS, Inggris, dll).',needs:'DIBANANA_KEY'},
 {server:'telekos_tg',name:'Telegram Siap Pakai',badge:'Session siap',provider:'Telekos · telegram',description:'Nomor Telegram yang sudah login (session siap). Kode login diambil otomatis. Nomor langsung milikmu setelah dibeli, jadi tidak bisa dibatalkan.',needs:'TELEKOS_KEY',noCancel:true}]
export const P={dibanana_s1:dbnServer(1,'ekonomi'),dibanana_s2:dbnServer(2,'premium'),dibanana_s3:dbnServer(3,'khusus'),dibanana_s4:dbnServer(4,'wa_luar'),telekos_tg:telekosServer}
