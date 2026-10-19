process.env.CRON_SECRET='cronsecret'
const {kv}=await import('../lib/db.js')
const {getCfg}=await import('../lib/bonus.js')
const D=await import('../lib/deposit.js')
const {save}=await import('../lib/auth.js')
const {resetSec}=await import('../lib/settings.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}

// ---- QRIS statis valid (CRC benar) ----
const crc=s=>{let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=(c&0x8000)?((c<<1)^0x1021):(c<<1);c&=0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')}
let q='00020101021126260012ID.CO.EXAMPLE.WWW01101234567895204541153033605802ID5909TOKO TEST6007JAKARTA6304'
const QRIS=q+crc(q)
const setSec=async o=>{await kv.set('sec',o);resetSec()}
await setSec({AUSTIN_KEY:'apg_live_x',SMP_SECRET:'sekret123',SMP_QRIS:QRIS,SMP_USERNAME:'jhon'})

// ---- mock fetch ----
const paid=new Set();let austinDown=false;const log=[]
globalThis.fetch=async(url,opt={})=>{
 url=String(url);const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json'}})
 if(url.includes('austinstore.id')){
  if(austinDown)return J({success:false,message:'down'},503)
  if(url.includes('/api/deposit/create')){const b=JSON.parse(opt.body);const id='AUS'+Math.random().toString(36).slice(2,9).toUpperCase();const total=b.amount+137
   return J({success:true,deposit:{transaction_id:id,amount:total,qr_string:QRIS,qr_image:'',expired_at:new Date(Date.now()+30*60000).toISOString()}})}
  if(url.includes('/api/deposit/check/')){const id=decodeURIComponent(url.split('/check/')[1].split('?')[0]);return J({success:true,status:paid.has(id)?'paid':'pending'})}
  if(url.includes('/api/deposit/cancel/'))return J({success:true})
  return J({success:true})}
 return J({ok:false},404)}

console.log('\n[A] Rute deposit bot reseller: Austin & SMP acak')
const cfg0=await getCfg()
ok(cfg0.dep.routes3&&cfg0.dep.routes3.austin.on&&cfg0.dep.routes3.smp.on,'getCfg: routes3 default austin+smp aktif')
const rsCfg=c=>({...c,dep:{...c.dep,engine:'rs'}})   // persis seperti rsCfg() di tgbot.js
let cnt={};for(let i=0;i<400;i++){const d=await D.createDeposit(rsCfg(cfg0),'qris',10000);cnt[d.gw]=(cnt[d.gw]||0)+1}
console.log('   sebaran 400 deposit:',cnt)
ok(cnt.austin>140&&cnt.smp>140&&Object.keys(cnt).length===2,'acak merata, hanya austin & smp (tanpa pakasir/warungnokos)')
const ml=await D.methodsList(rsCfg(cfg0));ok(ml.length===1&&ml[0].provider==='qris','menu deposit reseller hanya QRIS (VA hilang)')
// mesin V1 tidak terpengaruh
const poolV1=D.poolOf(cfg0,'qris');ok(poolV1.includes('pakasir')&&poolV1.includes('warungnokos'),'mesin V1 web biasa tidak berubah')

console.log('\n[B] Failover')
austinDown=true;cnt={};for(let i=0;i<40;i++){const d=await D.createDeposit(rsCfg(cfg0),'qris',10000);cnt[d.gw]=(cnt[d.gw]||0)+1}
ok(cnt.smp===40&&!cnt.austin,'Austin error -> semua otomatis pindah ke SMP (40/40, tanpa gagal)')
austinDown=false
await setSec({AUSTIN_KEY:'apg_live_x'});cnt={};for(let i=0;i<20;i++){const d=await D.createDeposit(rsCfg(cfg0),'qris',10000);cnt[d.gw]=(cnt[d.gw]||0)+1}
ok(cnt.austin===20,'SMP belum diisi -> otomatis hanya Austin')
await setSec({});let err='';try{await D.createDeposit(rsCfg(cfg0),'qris',10000)}catch(e){err=e.message}
ok(/tidak tersedia/.test(err),'dua-duanya belum diisi -> pesan jelas: "'+err+'"')
await setSec({AUSTIN_KEY:'apg_live_x',SMP_SECRET:'sekret123',SMP_QRIS:QRIS,SMP_USERNAME:'jhon'})
const off=rsCfg({...cfg0,dep:{...cfg0.dep,routes3:{austin:{on:true},smp:{on:false}}}});cnt={}
for(let i=0;i<20;i++){const d=await D.createDeposit(off,'qris',10000);cnt[d.gw]=(cnt[d.gw]||0)+1}
ok(cnt.austin===20,'admin matikan saklar SMP -> hanya Austin')

console.log('\n[C] Saldo benar-benar masuk (end-to-end)')
const mk=async id=>{const u={id,rs:'R1',tgId:'555'+id.length,email:id+'@x.com',balance:0,tx:[],mut:[],joinedAt:new Date().toISOString(),refCount:0,refEarn:0};await kv.set('u:'+id,u);await kv.sadd('idx',id);return await kv.get('u:'+id)}
const addDep=async(u,amount,forceGw)=>{let d;for(let i=0;i<50;i++){d=await D.createDeposit(rsCfg(cfg0),'qris',amount);if(!forceGw||d.gw===forceGw)break}
 const rec={type:'deposit',id:d.id,amount,total:d.total,fee:d.fee,qr:d.qr,qrImg:d.qrImg,va:'',method:'qris',gw:d.gw,exp:d.exp,expMs:D.toMs(d.exp),status:'pending',credited:false,at:Date.now(),via:'telegram'}
 u.tx.unshift(rec);await kv.set('d:'+rec.id,u.id);await D.depPendAdd(rec.id,u.id);await save(u);return rec}
// Austin: dibayar -> cron menyapu
let u1=await mk('U1');const rA=await addDep(u1,20000,'austin');ok(rA.gw==='austin','deposit Austin dibuat (total bayar Rp'+rA.total+', biaya '+rA.fee+')')
paid.add(rA.id)
const cron=await import('../app/api/cron/route.js')
let r=await cron.GET(new Request('http://x/api/cron?secret=cronsecret'));let jr=await r.json()
u1=await kv.get('u:U1');ok(u1.balance===20000,'Austin lunas -> cron tiap menit mengkreditkan saldo (saldo='+u1.balance+')')
// SMP: callback
let u2=await mk('U2');const rS=await addDep(u2,30000,'smp');ok(rS.gw==='smp','deposit SMP dibuat (total bayar Rp'+rS.total+')')
const cb=await import('../app/api/callbackqris/[key]/route.js')
const post=(key,body)=>cb.POST(new Request('http://x/api/callbackqris/'+key,{method:'POST',body:JSON.stringify(body)}),{params:{key}})
const body={rrn:'RRN1',amount:{value:String(rS.total)},us_username:'jhon',issuer:'DANA',PayerName:'Budi'}
let x=await post('salah',body);ok(x.status===401,'callback key salah ditolak 401')
x=await post('sekret123',{...body,us_username:'orang'});ok(x.status===401,'callback username salah ditolak 401')
x=await post('sekret123',body);let xb=await x.json();u2=await kv.get('u:U2')
ok(x.status===200&&u2.balance===30000,'callback SMP sah -> saldo masuk (saldo='+u2.balance+')')
x=await post('sekret123',body);xb=await x.json();u2=await kv.get('u:U2')
ok(xb.responseCode==='2005201'&&u2.balance===30000,'callback dobel (RRN sama) tidak mengkredit dua kali')
x=await post('sekret123',{...body,rrn:'RRN2',amount:{value:'12345'}});u2=await kv.get('u:U2')
ok(x.status===200&&u2.balance===30000&&((await kv.get('smp:orphan'))||[]).length===1,'bayar nominal tak dikenal -> dicatat orphan, saldo tidak berubah')
console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
