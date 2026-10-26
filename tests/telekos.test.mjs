// Server "Telegram Siap Pakai" (Telekos, api.telekos.my.id): penyedia, order lewat API v1, kode login, kedaluwarsa+refund, tanpa pembatalan.
// Jalankan dari akar proyek: npx tsx tests/telekos.test.mjs
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const PV=await import('../lib/providers.js')
const SY=await import('../lib/sync.js')
const KEL=await import('../lib/kelola.js')
const route=await import('../app/api/[...p]/route.js')
const {P,SERVERS,isRestock}=PV

// ---- Telekos palsu ----
const T={calls:[],balance:75000,stock:{US:19,ID:0,MY:5},code:null,state:'waiting',fail:null,seq:0}
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}})
const realFetch=globalThis.fetch
globalThis.fetch=async(url,o={})=>{
 const u=new URL(String(url));if(u.host!=='api.telekos.my.id')return realFetch(url,o)
 const body=o.body?JSON.parse(o.body):null;T.calls.push({m:o.method||'GET',p:u.pathname,k:(o.headers||{})['x-api-key'],body})
 if((o.headers||{})['x-api-key']!=='telekos_abc')return J({ok:false,error:'API key tidak valid'},401)
 if(T.fail)return J({ok:false,error:T.fail},400)
 if(u.pathname==='/api/balance')return J({ok:true,balance:T.balance})
 if(u.pathname==='/api/telegram/countries')return J({ok:true,countries:[{code:'US',name:'US',flag:'🇺🇸',price:10000,stock:T.stock.US},{code:'ID',name:'ID',flag:'🇮🇩',price:8000,stock:T.stock.ID},{code:'MY',name:'Malaysia',flag:'🇲🇾',price:11000,stock:T.stock.MY}]})
 if(u.pathname==='/api/telegram/order'){const id='Trx'+String(++T.seq).padStart(9,'0');T.balance-=body.country==='MY'?11000:10000;return J({ok:true,transactionId:id,orderId:id,phone:'+12025550100',country:{code:body.country},price:body.country==='MY'?11000:10000,saldoSisa:T.balance})}
 if(u.pathname==='/api/telegram/code'){if(T.state==='ok')return J({ok:true,transactionId:body.transactionId,state:'ok',phone:'+12025550100',code:T.code});return J({ok:true,transactionId:body.transactionId,state:T.state,message:'x'})}
 if(u.pathname==='/api/telegram/release')return J({ok:true,state:'released',released:true})
 return J({ok:false,error:'not found'},404)}

// ---- pendaftaran server ----
const sv=SERVERS.find(s=>s.server==='telekos_tg')
ok(sv&&sv.needs==='TELEKOS_KEY'&&sv.noCancel===true&&P.telekos_tg,'server telekos_tg terdaftar (butuh TELEKOS_KEY, tanpa pembatalan)')
for(const f of ['services','countries','order','status','cancel','balance'])ok(typeof P.telekos_tg[f]==='function','antarmuka penyedia: '+f)
await kv.set('sec',{});resetSec()
ok(await P.telekos_tg.countries().then(()=>false,e=>/API key Telekos belum diisi/.test(e.message)),'tanpa API key: pesan jelas (tidak crash)')
await kv.set('sec',{TELEKOS_KEY:'telekos_abc'});resetSec()

// ---- katalog ----
const sv1=await P.telekos_tg.services();ok(sv1.length===1&&sv1[0].service_code==='telegram','satu layanan: Telegram')
const ct=await P.telekos_tg.countries()
ok(ct.length===2&&ct[0].country_id==='US'&&ct[1].country_id==='MY','negara stok 0 disembunyikan, urut harga termurah')
ok(ct[0].pricelist[0].provider_id==='10000~US'&&ct[0].pricelist[0].price===10000&&ct[0].pricelist[0].stock===19,'paket: provider_id "harga~KODE", harga & stok')
ok(ct[0].flag==='🇺🇸'&&/United States|Amerika/i.test(ct[0].name),'nama negara dilengkapi (US → '+ct[0].name+')')
ok(T.calls[0].k==='telekos_abc'&&T.calls[0].m==='GET','autentikasi memakai header x-api-key')
// ---- saldo ----
ok(PV.tlkBalance({ok:true,balance:75000})===75000&&PV.tlkBalance({saldo:'1200'})===1200&&PV.tlkBalance({data:{balance:5}})===5&&PV.tlkBalance(null)===0,'saldo dibaca dari beberapa bentuk balasan /api/balance')
const sb=await KEL.serverBalances();const ac=sb.accounts.find(a=>a.id==='tlk')
ok(ac&&ac.ok&&ac.balance===75000&&sb.servers.find(s=>s.server==='telekos_tg').balance===75000,'Kelola > saldo server menampilkan saldo Telekos')

// ---- order lewat API v1 (alur web/API sungguhan) ----
await kv.set('cfg',{});await kv.set('u:u1',{id:'u1',email:'a@b.c',name:'A',balance:50000,apikey:'apik1',tx:[],mut:[],pass:'x',joinedAt:new Date().toISOString()});await kv.set('k:apik1','u1');await kv.set('e:a@b.c','u1')
const api=async(path,body)=>{const r=await route.POST(new Request('https://x.test/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer apik1','content-type':'application/json'},body:body?JSON.stringify(body):undefined}),{params:{p:path.split('?')[0].split('/')}});return {st:r.status,j:await r.json().catch(()=>({}))}}
let r=await api('v1/servers');ok(r.j.items.some(s=>s.server==='telekos_tg'&&s.noCancel),'v1/servers menampilkan Telegram Siap Pakai bila API key terisi')
await kv.set('sec',{});resetSec();r=await api('v1/servers');ok(!r.j.items.some(s=>s.server==='telekos_tg'),'tanpa API key server tidak ditampilkan')
await kv.set('sec',{TELEKOS_KEY:'telekos_abc'});resetSec()
r=await api('v1/services?server=telekos_tg');ok(r.j.items&&r.j.items[0].service_code==='telegram','v1/services?server=telekos_tg')
r=await api('v1/countries?server=telekos_tg&service_id=telegram');ok(r.j.items.length===2&&r.j.items[0].pricelist[0].sell_price>=10000,'v1/countries memuat harga jual')
const jual=r.j.items[0].pricelist[0].sell_price
const before=(await kv.get('u:u1')).balance
r=await api('v1/order',{server:'telekos_tg',serviceId:'telegram',serviceName:'Telegram',countryId:'US',countryName:'Amerika Serikat',providerId:'10000~US'})
ok(r.st===200&&/^tlkTrx/.test(r.j.orderId)&&r.j.phoneNumber==='+12025550100','order berhasil: nomor Telegram siap pakai diberikan')
let u=await kv.get('u:u1');ok(u.balance===before-jual&&u.tx[0].cost===10000&&u.tx[0].status==='pending','saldo pembeli terpotong harga jual; modal Telekos tercatat Rp10.000')
ok(T.calls.find(c=>c.p==='/api/telegram/order').body.country==='US','Telekos dipanggil dengan kode negara yang benar')
ok(u.tx[0].expiredAt-Date.now()>23*3600000,'batas tunggu panjang (24 jam)')
// kode belum ada → tetap menunggu
r=await api('v1/orders/status?order_id='+u.tx[0].id);ok(r.j.status==='pending'&&!r.j.otpCode,'kode belum ada → status menunggu')
// ---- tidak bisa dibatalkan ----
u=await kv.get('u:u1');u.tx[0].at=Date.now()-3600000;await kv.set('u:u1',u)
r=await api('v1/orders/cancel',{order_id:u.tx[0].id});ok(r.st>=400&&/tidak bisa dibatalkan/.test(JSON.stringify(r.j)),'pembeli tidak bisa membatalkan nomor Telegram siap pakai')
ok((await kv.get('u:u1')).balance===before-jual&&!T.calls.some(c=>c.p==='/api/telegram/release'),'saldo tidak berubah dan session tidak dilepas')
// ---- kode login masuk ----
T.state='ok';T.code='54321'
r=await api('v1/orders/status?order_id='+u.tx[0].id);ok(r.j.status==='success'&&r.j.otpCode==='54321','kode login Telegram diterima → order sukses')
u=await kv.get('u:u1');ok(u.tx[0].status==='success'&&u.tx[0].otp==='54321'&&u.balance===before-jual,'tersimpan sukses, saldo tetap terpotong')

// ---- kode tidak pernah diambil → kedaluwarsa + refund ---- (dan session dilepas bila admin membatalkan)
T.state='waiting'
r=await api('v1/order',{server:'telekos_tg',serviceId:'telegram',serviceName:'Telegram',countryId:'MY',countryName:'Malaysia',providerId:'11000~MY'})
ok(r.st===200,'order kedua (Malaysia)')
u=await kv.get('u:u1');const o2=u.tx[0],b2=u.balance
o2.expiredAt=Date.now()-SY.LATE-1000;await kv.set('u:u1',u)
const u2=await kv.get('u:u1');await SY.syncOrder(u2,u2.tx[0]);await kv.set('u:u1',u2)
ok(u2.tx[0].status==='expired'&&u2.balance>b2,'lewat batas tunggu tanpa kode → kedaluwarsa & saldo pembeli dikembalikan')
// session mati sebelum ada kode
r=await api('v1/order',{server:'telekos_tg',serviceId:'telegram',serviceName:'Telegram',countryId:'US',countryName:'AS',providerId:'10000~US'})
T.state='session_terminated';let u3=await kv.get('u:u1');const b3=u3.balance;await SY.syncOrder(u3,u3.tx[0]);await kv.set('u:u1',u3)
ok(u3.tx[0].status==='expired'&&u3.balance>b3,'session sudah mati sebelum ada kode → refund otomatis')
T.state='waiting'
// ---- cancel penyedia = release session (idempoten) ----
await P.telekos_tg.cancel('tlkTrx000000001');ok(T.calls.some(c=>c.p==='/api/telegram/release'&&c.body.transactionId==='Trx000000001'),'cancel() = release session memakai transactionId tanpa awalan tlk')

// ---- galat ----
T.fail='Saldo tidak cukup';const e1=await P.telekos_tg.order({providerId:'10000~US'}).catch(e=>e);ok(isRestock(e1),'saldo Telekos habis → dikenali sebagai restok (pembeli melihat pesan restok)')
T.fail=null;await kv.set('sec',{TELEKOS_KEY:'salah'});resetSec();const e2=await P.telekos_tg.balance().catch(e=>e)
ok(/tidak valid|salah|nonaktif/i.test(e2.message),'API key salah → pesan jelas')
await kv.set('sec',{TELEKOS_KEY:'telekos_abc'});resetSec()
// ---- tes koneksi admin ----
const tr=await route.POST(new Request('https://x.test/api/admin/sec/test',{method:'POST',headers:{'x-admin':'pwx','content-type':'application/json'},body:JSON.stringify({target:'telekos'})}),{params:{p:['admin','sec','test']}})
process.env.ADMIN_PASSWORD='pwx'
const tr2=await route.POST(new Request('https://x.test/api/admin/sec/test',{method:'POST',headers:{'x-admin':'pwx','content-type':'application/json'},body:JSON.stringify({target:'telekos'})}),{params:{p:['admin','sec','test']}});const tj=await tr2.json()
ok(tj.ok&&/Telekos/.test(tj.info)&&/Rp/.test(tj.info),'tombol Tes koneksi Telekos di admin: '+tj.info)
console.log('\n'+pass+' lulus, '+fail+' gagal');process.exit(fail?1:0)
