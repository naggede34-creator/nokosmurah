// Tes Suntik Sosmed (penyedia dipalsukan, tanpa jaringan). Jalankan: npx tsx tests/smm.test.mjs
process.env.CRON_SECRET='x'
const {kv}=await import('../lib/db.js')
const {save}=await import('../lib/auth.js')
const {resetSec}=await import('../lib/settings.js')
const SMM=await import('../lib/smm.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
await kv.set('sec',{SMM_KEY:'k123'});resetSec()
const SV=[{service:1,name:'IG Followers',type:'Default',category:'Instagram Followers',rate:'20000',min:'50',max:'10000',refill:true,cancel:true},
 {service:2,name:'TikTok Likes',type:'Default',category:'TikTok Likes',rate:'5000',min:'10',max:'5000',refill:false,cancel:false},
 {service:3,name:'Pkg',type:'Package',category:'Misc',rate:'1',min:'1',max:'1',refill:false,cancel:false}]
const prov={orders:{},next:100,fail:false,refillErr:''}
globalThis.fetch=async(url,opt={})=>{
 const b=Object.fromEntries(new URLSearchParams(String(opt.body)).entries()),J=o=>new Response(JSON.stringify(o),{status:200})
 if(b.key!=='k123')return J({error:'Invalid API key'})
 if(b.action==='services')return J(SV)
 if(b.action==='add'){if(prov.fail)return J({error:'Not enough funds on balance'});const id=prov.next++;prov.orders[id]={status:'Pending',remains:b.quantity,start_count:'10',charge:'1',currency:'IDR'};return J({order:id})}
 if(b.action==='status'){
  if(b.orders){const o={};for(const i of b.orders.split(','))o[i]=prov.orders[i]||{error:'Incorrect order ID'};return J(o)}
  return J(prov.orders[b.order]||{error:'Incorrect order ID'})}
 if(b.action==='cancel'){const id=b.orders;prov.orders[id].status='Canceled';return J([{order:+id,cancel:1}])}
 if(b.action==='refill'){if(prov.refillErr)return J({error:prov.refillErr});prov.rf=(prov.rf||0)+1;return J({refill:String(prov.rf)})}
 if(b.action==='refill_status')return J({status:prov.rfSt||'Pending'})
 if(b.action==='balance')return J({balance:'100',currency:'IDR'})
 return J({error:'x'})}
const mk=async(bal)=>{const id='u'+Math.random().toString(36).slice(2,8),u={id,email:id+'@x.com',name:id,pass:'',balance:bal,apikey:'key'+id,banned:false,tx:[],mut:[],joinedAt:new Date().toISOString()}
 await save(u);await kv.set('k:'+u.apikey,u.id);return u}
const fresh=async u=>kv.get('u:'+u.id)

console.log('\n[A] Harga & layanan')
await SMM.saveCfgS({markup:25,kurs:1,round:1})
const cfg=await SMM.getCfgS(),vis=await SMM.visible(cfg)
ok(vis.length===2,'Package disembunyikan, 2 layanan tampil')
ok(SMM.priceOf(vis[0],1000,cfg)===25000,'20/1000 + 25% = Rp25.000')
ok(SMM.priceOf(vis[0],100,cfg)===2500,'100 unit = Rp2.500')
const pl=await SMM.platforms(cfg);ok(pl.map(p=>p.name).join()==='Instagram,TikTok','platform terdeteksi')

console.log('\n[B] Order sukses, potong saldo, refund bila penyedia gagal')
let u=await mk(10000)
let r=await SMM.placeOrder(u,{serviceId:1,link:'https://instagram.com/abc',quantity:100,via:'web'})
let f=await fresh(u)
ok(r.view.orderId==='100'&&f.balance===7500,'order dibuat id=100, saldo 10.000→7.500')
ok(f.tx[0].status==='pending'&&await kv.get('smo:100')===u.id,'tercatat & terindeks')
prov.fail=true
let err;try{await SMM.placeOrder(f,{serviceId:1,link:'https://instagram.com/abc2',quantity:100})}catch(e){err=e}
f=await fresh(u);ok(err&&err.code==='restock'&&f.balance===7500,'penyedia kehabisan saldo → saldo user utuh (refund otomatis)')
prov.fail=false
try{await SMM.placeOrder(f,{serviceId:1,link:'x y',quantity:100})}catch(e){err=e}ok(err.code==='link','link berspasi ditolak')
try{await SMM.placeOrder(f,{serviceId:1,link:'https://a.co/z',quantity:10})}catch(e){err=e}ok(err.code==='qty','jumlah di bawah min ditolak')
try{await SMM.placeOrder(await mk(10),{serviceId:1,link:'https://a.co/q',quantity:1000})}catch(e){err=e}ok(err.code==='saldo','saldo kurang ditolak')

console.log('\n[C] Status: proses → sukses, tanpa notifikasi ganda')
prov.orders[100].status='In progress'
let s=await SMM.refreshOrder(u.id,'100',{force:true});ok(s.ev==='processing'&&s.o.status==='processing','In progress → processing')
s=await SMM.refreshOrder(u.id,'100',{force:true});ok(s.ev===null,'status sama tidak memicu kejadian lagi')
prov.orders[100].status='Completed'
s=await SMM.refreshOrder(u.id,'100',{force:true});ok(s.ev==='success'&&s.o.status==='success','Completed → success')
ok((await fresh(u)).balance===7500,'sukses tidak mengubah saldo')
s=await SMM.refreshOrder(u.id,'100',{force:true});ok(s.ev===null,'order final tidak diproses ulang')

console.log('\n[D] Partial → refund proporsional')
r=await SMM.placeOrder(await fresh(u),{serviceId:1,link:'https://instagram.com/p',quantity:200}) // 5000
ok((await fresh(u)).balance===2500,'order 200 unit = Rp5.000')
prov.orders[101].status='Partial';prov.orders[101].remains='50'
s=await SMM.refreshOrder(u.id,'101',{force:true})
f=await fresh(u);ok(s.ev==='partial'&&f.balance===2500+1250,'sisa 50/200 → refund Rp1.250')
ok(f.tx.find(x=>x.id==='101').refAmt===1250,'refAmt tercatat')

console.log('\n[E] Batal oleh pengguna → refund penuh')
r=await SMM.placeOrder(await fresh(u),{serviceId:1,link:'https://instagram.com/c',quantity:100}) // 2500
const b0=(await fresh(u)).balance
const c=await SMM.requestCancel(await fresh(u),'102')
f=await fresh(u);ok(c.o.status==='cancelled'&&f.balance===b0+2500,'batal → status cancelled, saldo kembali penuh')
try{await SMM.requestCancel(f,'102')}catch(e){err=e}ok(err.code==='state','batal ulang ditolak')
r=await SMM.placeOrder(f,{serviceId:2,link:'https://tiktok.com/v',quantity:100})
try{await SMM.requestCancel(await fresh(u),'103')}catch(e){err=e}ok(err.code==='nocancel','layanan tanpa fitur batal ditolak')

console.log('\n[F] Refill')
try{await SMM.requestRefill(await fresh(u),'103')}catch(e){err=e}ok(err.code==='norefill','layanan tanpa refill ditolak')
let rr=await SMM.requestRefill(await fresh(u),'100')
ok(rr.o.refillId==='1'&&rr.view.refill.status==='pending','refill diminta, id=1')
try{await SMM.requestRefill(await fresh(u),'100')}catch(e){err=e}ok(err.code==='wait','refill kedua saat masih diproses ditolak')
prov.rfSt='Completed'
let q=await SMM.refreshRefill(u.id,'100');ok(q.ev==='refill_done','refill_status Completed → refill_done')
q=await SMM.refreshRefill(u.id,'100');ok(q.ev===null,'tidak dobel')

console.log('\n[G] Sinkron massal (cron)')
r=await SMM.placeOrder(await fresh(u),{serviceId:1,link:'https://instagram.com/sync',quantity:100})
const pid=r.order.id;prov.orders[pid].status='Completed'
const sy=await SMM.sync(Date.now()+20000)
f=await fresh(u);ok(f.tx.find(x=>x.id===pid).status==='success'&&sy.events>=1,'sync menyelesaikan order')

console.log('\n[H] API v2 (format panel SMM)')
{const t=await fresh(u);t.balance+=50000;await save(t)}
const req={headers:new Headers()}
let a=await SMM.v2({key:'salah',action:'services'},req);ok(a.status===401,'key salah → 401')
a=await SMM.v2({key:u.apikey,action:'services'},req);ok(a.status===200&&a.body[0].service===1&&a.body[0].rate==='25000','services: rate per 1000 sudah markup')
a=await SMM.v2({key:u.apikey,action:'balance'},req);ok(a.body.currency==='IDR','balance')
a=await SMM.v2({key:u.apikey,action:'add',service:'1',link:'https://instagram.com/v2',quantity:'100'},req);ok(typeof a.body.order==='number','add → {order:number}')
const np=a.body.order
a=await SMM.v2({key:u.apikey,action:'status',order:String(np)},req);ok(a.body.status==='Pending'&&a.body.currency==='IDR','status single')
a=await SMM.v2({key:u.apikey,action:'status',orders:np+',99999'},req);ok(a.body[np].status==='Pending'&&a.body['99999'].error,'status multi + error ID asing')
const other=await mk(5000)
a=await SMM.v2({key:other.apikey,action:'status',order:String(np)},req);ok(a.status===404,'order milik orang lain tidak bisa dilihat')
a=await SMM.v2({key:u.apikey,action:'cancel',orders:String(np)},req);ok(a.body[0].cancel===1,'cancel → 1')
a=await SMM.v2({key:u.apikey,action:'zzz'},req);ok(a.status===400,'action tak dikenal → 400')

console.log('\n[I] Fitur dimatikan')
await SMM.saveCfgS({on:false})
try{await SMM.placeOrder(await fresh(u),{serviceId:1,link:'https://a.co/off',quantity:100})}catch(e){err=e}ok(err.code==='off','order ditolak saat fitur mati')
ok(!(await SMM.enabled()),'enabled()=false → tombol hilang')
console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
