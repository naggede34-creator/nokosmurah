import {kv} from '../../../lib/db'
import {who,save,hash,check,rid} from '../../../lib/auth'
import {P,SERVERS,upDep} from '../../../lib/providers'
import {notify} from '../../../lib/telegram'
export const dynamic='force-dynamic'
const J=(d,s=200,h)=>Response.json(d,{status:s,headers:h})
const E=(m,s=400)=>J({error:m},s)
const cfgGet=async()=>(await kv.get('cfg'))||{markup:10,broadcast:'',off:[]}
const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()})}
const refund=(u,o)=>{if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)}}
const cookie=t=>({'Set-Cookie':`sid=${t};Path=/;HttpOnly;SameSite=Lax;Max-Age=2592000${process.env.NODE_ENV==='production'?';Secure':''}`})
async function session(u){const t=rid();await kv.set('s:'+t,u.id);return cookie(t)}
async function h(req,{params}){
 const p=params.p.join('/'),b=req.method==='POST'?await req.json().catch(()=>({})):{},q=Object.fromEntries(new URL(req.url).searchParams)
 const cfg=await cfgGet()
 try{
 if(p==='auth/login'||p==='auth/register'){const ip=(req.headers.get('x-forwarded-for')||'x').split(',')[0].trim();if(await kv.incr(`lg:${ip}:${Math.floor(Date.now()/60000)}`)>12)return E('Terlalu banyak percobaan, coba lagi 1 menit',429)}
 if(p==='auth/register'){
  const email=String(b.email||'').toLowerCase().trim()
  if(!/^\S+@\S+\.\S+$/.test(email)||String(b.password||'').length<6)return E('Email/password tidak valid (min 6 karakter)')
  if(await kv.get('e:'+email))return E('Email sudah terdaftar')
  const u={id:rid(),email,name:b.name||email.split('@')[0],pass:hash(b.password),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString()}
  await save(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id)
  await kv.set('idx',[...((await kv.get('idx'))||[]),u.id])
  await notify(`👤 Pengguna baru\n${u.name} (${email})`);return J({ok:1},200,await session(u))}
 if(p==='auth/login'){
  const id=await kv.get('e:'+String(b.email||'').toLowerCase().trim()),u=id&&await kv.get('u:'+id)
  if(!u||!check(String(b.password||''),u.pass))return E('Email atau password salah',401)
  return J({ok:1},200,await session(u))}
 if(p==='auth/logout')return J({ok:1},200,{'Set-Cookie':'sid=;Path=/;Max-Age=0'})
 if(p.startsWith('admin/')){
  if(req.headers.get('x-admin')!==process.env.ADMIN_PASSWORD)return E('unauthorized',401)
  const a=p.slice(6);let t=null
  if(b.email){const id=await kv.get('e:'+b.email.toLowerCase());t=id&&await kv.get('u:'+id);if(!t)return E('user tidak ada',404)}
  if(a==='data'){const ids=(await kv.get('idx'))||[];const us=await Promise.all(ids.map(i=>kv.get('u:'+i)));return J({cfg,users:us.map(({pass,tx,mut,...x})=>x)})}
  if(a==='testnotif')return J(await notify('✅ Tes notifikasi Artapedia ID berhasil'))
  if(a==='addsaldo'){mut(t,+b.amount,'Admin tambah');await save(t);await notify(`🛠 Admin tambah saldo\n${t.email}\n+Rp${b.amount}`);return J({balance:t.balance})}
  if(a==='delsaldo'){mut(t,-b.amount,'Admin kurangi');await save(t);await notify(`🛠 Admin kurangi saldo\n${t.email}\n-Rp${b.amount}`);return J({balance:t.balance})}
  if(a==='ban'||a==='unban'){t.banned=a==='ban';await save(t);await notify(`🛠 Admin ${a}\n${t.email}`);return J({ok:1})}
  if(a==='markup'){cfg.markup=+b.percent;await kv.set('cfg',cfg);return J(cfg)}
  if(a==='broadcast'){cfg.broadcast=b.text||'';await kv.set('cfg',cfg);await notify('📢 Broadcast: '+cfg.broadcast);return J(cfg)}
  if(a==='server'){cfg.off=b.on?cfg.off.filter(s=>s!==b.server):[...new Set([...cfg.off,b.server])];await kv.set('cfg',cfg);return J(cfg)}
  return E('not found',404)}
 const u=await who(req);if(!u)return E('API key tidak ada/tidak valid, atau belum login',401)
 if(u.banned)return E('Akun ditangguhkan',403)
 if((/^Bearer /.test(req.headers.get('authorization')||'')||q.api_key)&&p.startsWith('v1/')){
  const sc=p==='v1/order'&&req.method==='POST'?['o',20]:p==='v1/deposit'&&req.method==='POST'?['d',6]:null
  const w=Math.floor(Date.now()/60000),reset=(w+1)*60,retry=Math.max(1,reset-Math.floor(Date.now()/1000))
  const n=await kv.incr(`rl:${u.id}:a:${w}`),m=sc?await kv.incr(`rl:${u.id}:${sc[0]}:${w}`):0
  req.__rl={remaining:Math.max(0,60-n),reset}
  if(n>60||(sc&&m>sc[1]))return J({error:`Rate limit exceeded. Coba lagi dalam ${retry} detik.`,retryAfter:retry},429,{'Retry-After':String(retry),'X-RateLimit-Limit':'60','X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(reset)})}
 if(p==='v1/me')return J({name:u.name,email:u.email,balance:u.balance,joinedAt:u.joinedAt,apikey:u.apikey,broadcast:cfg.broadcast})
 if(p==='v1/apikey'&&req.method==='POST'){await kv.set('k:'+u.apikey,null);u.apikey=rid();await kv.set('k:'+u.apikey,u.id);await save(u);return J({apikey:u.apikey})}
 if(p==='v1/servers')return J({items:SERVERS.filter(s=>!cfg.off.includes(s.server))})
 if(p==='v1/mutasi')return J({items:(u.mut||[]).slice(0,100)})
 if(p==='v1/support'){await notify(`💬 CS dari ${u.name} (${u.email}):\n${String(b.text||'').slice(0,800)}`);return J({ok:1})}
 const sv=q.server||b.server||'warungnokos_s1'
 if(['v1/services','v1/countries','v1/order'].includes(p)){
  if(!P[sv])return E('server tidak dikenal');if(cfg.off.includes(sv))return E('server dimatikan',503)}
 const mk=x=>Math.ceil(x*(1+cfg.markup/100))
 if(p==='v1/services')return J({server:sv,items:await P[sv].services()})
 if(p==='v1/countries'){
  if(!q.service_id)return E('service_id wajib')
  const items=(await P[sv].countries(q.service_id)).map(c=>({...c,pricelist:c.pricelist.map(x=>({...x,sell_price:mk(x.price)}))}))
  return J({server:sv,items})}
 if(p==='v1/order'&&req.method==='POST'){
  if(!b.serviceId||!b.countryId||b.providerId==null)return E('serviceId, countryId, providerId wajib')
  let base=null
  for(const c of await P[sv].countries(b.serviceId))for(const x of c.pricelist)if(x.provider_id==b.providerId&&(!b.countryId||x.country_id==b.countryId))base=x.price
  if(base==null)return E('harga tidak ditemukan, cek providerId')
  const price=mk(base);if(u.balance<price)return E('Saldo tidak cukup')
  mut(u,-price,'Order nokos');await save(u)
  let o;try{o=await P[sv].order({...b,server:sv})}catch(e){mut(u,price,'Refund gagal order');await save(u);await notify(`⚠️ Order gagal\n${u.name}\n${e.message}`);return E(e.message,502)}
  const rec={type:'order',id:o.id,server:sv,serviceId:b.serviceId,serviceName:b.serviceName||b.serviceId,countryName:b.countryName||'',phone:o.phone,price,status:'pending',otp:null,msg:null,cost:o.cost,expiredAt:o.expiredAt,refunded:false,at:Date.now()}
  u.tx.unshift(rec);await kv.set('o:'+o.id,u.id);await save(u)
  await notify(`📱 Beli nokos\n${u.name}\n${rec.serviceName} ${o.phone}\nRp${price}`)
  return J({orderId:o.id,server:sv,phoneNumber:o.phone,price,expiredAt:o.expiredAt,createdAt:new Date(rec.at).toISOString(),balance:u.balance})}
 const view=o=>({orderId:o.id,server:o.server,serviceName:o.serviceName,phoneNumber:o.phone,price:o.price,status:o.status,otpCode:o.otp,otpMsg:o.msg,refunded:o.refunded,expiredAt:o.expiredAt,createdAt:new Date(o.at).toISOString()})
 if(p==='v1/orders'){
  const lim=Math.min(+q.limit||50,100),pg=+q.page||1,all=u.tx.filter(x=>x.type==='order')
  return J({page:pg,limit:lim,items:all.slice((pg-1)*lim,pg*lim).map(view)})}
 if(p==='v1/orders/status'||p==='v1/orders/cancel'){
  const oid=q.order_id||b.order_id,o=u.tx.find(x=>x.type==='order'&&x.id===oid);if(!o)return E('Pesanan tidak ditemukan',404)
  if(o.status==='pending'&&!P[o.server])return E('Server order ini sudah tidak tersedia',503)
  if(o.status==='pending'){
   if(p.endsWith('cancel')){
    const wait=Math.ceil((o.at+120000-Date.now())/1000)
    if(wait>0)return E(`Order baru bisa dibatalkan setelah 2 menit. Tunggu ${wait} detik.`,400)
    try{await P[o.server].cancel(o.id)}catch(e){return E('Pembatalan ditolak provider: '+e.message,502)}
    o.status='cancelled';refund(u,o);await notify(`❌ Order dibatalkan\n${u.name} ${o.phone}\nRefund Rp${o.price}`)}
   else{
    const s=await P[o.server].status(o.id)
    if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;await notify(`🔑 OTP diterima\n${u.name}\n${o.serviceName} ${o.phone}\nKode: ${o.otp}`)}
    else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';refund(u,o)}}
   await save(u)}
  return J({...view(o),balance:u.balance})}
 if(p==='v1/deposit/methods')return J(await upDep.methods())
 if(p==='v1/deposit'&&req.method==='POST'){
  const amount=Math.floor(+b.amount);if(!(amount>=1000&&amount<=5000000))return E('Nominal 1.000 - 5.000.000')
  if(!b.provider)return E('provider wajib (lihat /v1/deposit/methods)')
  if(u.tx.filter(x=>x.type==='deposit'&&x.status==='pending').length>=3)return E('Terlalu banyak QRIS belum dibayar')
  const d=await upDep.create(amount,b.provider)
  const rec={type:'deposit',id:d.order_id,amount,total:d.total_amount,fee:d.admin_fee,qr:d.qr_string,qrImg:d.qr_image,exp:d.expired_at,status:'pending',credited:false,at:Date.now()}
  u.tx.unshift(rec);await kv.set('d:'+rec.id,u.id);await save(u)
  await notify(`💰 Deposit PENDING\n${u.name}\nRp${amount}\n${rec.id}`)
  return J({order_id:rec.id,total_amount:rec.total,admin_fee:rec.fee,qr_string:rec.qr,qr_image:rec.qrImg,expired_at:rec.exp})}
 if(p==='v1/deposit'){
  if(!q.order_id)return J({items:u.tx.filter(x=>x.type==='deposit').slice(0,20)})
  const o=u.tx.find(x=>x.type==='deposit'&&x.id===q.order_id);if(!o)return E('Deposit tidak ditemukan',404)
  if(o.status==='pending'){const st=(await upDep.check(o.id)).status
   if(st==='completed'){o.status='completed';if(!o.credited){o.credited=true;mut(u,o.amount,'Deposit '+o.id)};await notify(`✅ Deposit SUKSES\n${u.name}\nRp${o.amount}`)}
   else if(['expired','canceled','failed'].includes(st))o.status=st
   await save(u)}
  return J({order_id:o.id,status:o.status,credited:o.credited,balance:u.balance,qr_string:o.qr,qr_image:o.qrImg,total_amount:o.total})}
 return E('Endpoint tidak ditemukan',404)
 }catch(e){return E(e.message||'Server error',500)}}
async function H(req,ctx){const r=await h(req,ctx),l=req.__rl
 if(l&&!r.headers.has('X-RateLimit-Limit')){r.headers.set('X-RateLimit-Limit','60');r.headers.set('X-RateLimit-Remaining',String(l.remaining));r.headers.set('X-RateLimit-Reset',String(l.reset))}
 return r}
export {H as GET,H as POST}
