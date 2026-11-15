// Server nokos WarungNokos Server2 (lib/providers.js) dengan fetch tiruan sesuai dokumentasi API.
// Jalankan dari akar proyek: npx tsx tests/warungnokos.test.mjs
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const calls=[]
globalThis.fetch=async(u,o={})=>{u=new URL(String(u));const body=o.body?JSON.parse(o.body):null;calls.push({path:u.pathname,q:Object.fromEntries(u.searchParams),method:o.method,key:o.headers['x-api-key'],body})
 const R=(d,s=200)=>new Response(JSON.stringify(d),{status:s})
 const p=u.pathname.replace('/api/smscode','')
 if(p==='/services')return R({success:true,data:[{id:3,code:'wa',name:'WhatsApp',active:true},{id:9,code:'x',name:'Mati',active:false}]})
 if(p==='/countries')return R({success:true,data:[{id:6,name:'Indonesia',emoji:'🇮🇩',active:true}]})
 if(p==='/products')return R({success:true,data:[{id:142,name:'WhatsApp Indonesia (S1)',country_id:6,platform_id:3,available:42,price:1500,active:true},{id:143,name:'S2',country_id:6,platform_id:3,available:0,price:900,active:true},{id:150,name:'MY',country_id:7,platform_id:3,available:5,price:5000,active:true}]})
 if(p==='/order')return R({success:true,data:{trxId:'WN0000000001',serviceName:'WhatsApp (Indonesia)',phoneNumber:'628123456789',amount:1500,status:'waiting'}})
 if(p==='/status/WN0000000001')return R({success:true,status:'completed',otp_code:'123456'})
 if(p==='/status/WN2')return R({success:true,status:'waiting'})
 if(p==='/status/WN3')return R({success:true,status:'canceled'})
 if(p==='/cancel')return body.trxId==='BAD'?R({success:false,message:'Order tidak bisa dibatalkan'},400):R({success:true,message:'Berhasil dibatalkan'})
 return R({success:false,message:'?'},404)}
await kv.set('sec',{WNK_KEY:'wn-abc'});resetSec()
const {P,SERVERS}=await import('../lib/providers.js')
const s=P.wnk_s1
ok(SERVERS.length===1&&SERVERS[0].server==='wnk_s1'&&SERVERS[0].needs==='WNK_KEY','satu server WarungNokos, Dibanana dihapus')
const sv=await s.services()
ok(sv.length===1&&sv[0].service_code==='3'&&sv[0].service_name==='WhatsApp','layanan aktif: id jadi service_code')
ok(calls[0].key==='wn-abc'&&calls[0].path==='/api/smscode/services','header x-api-key & base URL benar')
const ct=await s.countries('3')
const id=ct.find(c=>c.country_id==='6')
ok(id&&id.name==='Indonesia'&&id.flag==='🇮🇩'&&id.pricelist.length===1&&id.pricelist[0].provider_id==='142'&&id.pricelist[0].price===1500&&id.pricelist[0].stock===42,'produk dikelompokkan per negara, stok 0 disaring')
ok(ct.some(c=>c.country_id==='7'&&c.name==='Negara 7'),'negara tak dikenal tetap tampil dengan nama cadangan')
ok(calls.some(c=>c.path.endsWith('/products')&&c.q.platform_id==='3'),'/products memakai platform_id')
const o=await s.order({serviceId:'3',countryId:'6',providerId:'142',serviceName:'WhatsApp'})
const oc=calls.find(c=>c.path.endsWith('/order'))
ok(oc.method==='POST'&&oc.body.product_id===142&&oc.body.app_id===3&&oc.body.country_id===6,'body order sesuai dokumentasi')
ok(o.id==='WN0000000001'&&o.phone==='628123456789'&&o.cost===1500&&o.expiredAt>Date.now(),'hasil order dipetakan')
const st=await s.status('WN0000000001')
ok(st.otp==='123456'&&st.state==='success','status completed + otp_code -> sukses')
ok((await s.status('WN2')).state==='pending','status waiting -> pending')
ok((await s.status('WN3')).state==='canceled','status canceled -> canceled')
await s.cancel('WN0000000001')
ok(calls.find(c=>c.path.endsWith('/cancel')).body.trxId==='WN0000000001','cancel mengirim trxId')
let err='';try{await s.cancel('BAD')}catch(e){err=e.message}
ok(err==='Order tidak bisa dibatalkan','pesan gagal dari WarungNokos diteruskan')
await kv.set('sec',{});resetSec()
err='';try{await P.wnk_s1.order({serviceId:'3',countryId:'6',providerId:'142'})}catch(e){err=e.message}
ok(/belum diisi/.test(err),'tanpa API key: pesan jelas')
console.log(`\n${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
