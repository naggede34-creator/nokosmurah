import {kv} from '../../../lib/db'
import {who,save,hash,check,rid} from '../../../lib/auth'
import {P,SERVERS,upDep} from '../../../lib/providers'
import {notify,mask,rp} from '../../../lib/telegram'
import {replaceIfNeeded,CANCEL_WAIT} from '../../../lib/sync'
import {getCfg,creditDeposit,ensureRef,bonusPct,weekStart,WEEK,weekRows,payWeekly,payMonthly,monthStart,monthEnd} from '../../../lib/bonus'
import {sendMail} from '../../../lib/mail'
import {runBackup,backupPage,importItems,wipeAll} from '../../../lib/backup'
export const dynamic='force-dynamic'
export const maxDuration=60
const J=(d,s=200,h)=>Response.json(d,{status:s,headers:h})
const E=(m,s=400)=>J({error:m},s)
const DEP_MIN=2000,DEP_MAX=10000000
const cfgGet=getCfg
const site=req=>process.env.SITE_URL||((req.headers.get('x-forwarded-proto')||'https')+'://'+(req.headers.get('x-forwarded-host')||req.headers.get('host')))
const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()})}
const refund=(u,o)=>{if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)}}
const cookie=t=>({'Set-Cookie':`sid=${t};Path=/;HttpOnly;SameSite=Lax;Max-Age=2592000${process.env.NODE_ENV==='production'?';Secure':''}`})
async function session(u){const t=rid();await kv.set('s:'+t,u.id+'|'+Date.now());return cookie(t)}
// ---- Customer service: jam 09.00-17.00 dan 18.00-22.00 WIB ----
const csInfo=()=>{const w=new Date(Date.now()+7*36e5),m=w.getUTCHours()*60+w.getUTCMinutes();return {open:(m>=540&&m<1020)||(m>=1080&&m<1320),hours:'09.00 - 17.00 dan 18.00 - 22.00 WIB'}}
const csGet=async id=>(await kv.get('cs:'+id))||{msgs:[],au:0,uu:0,at:0}
const okImg=i=>typeof i==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(i)&&i.length<=300000
async function csPush(u,from,text,img){
 const t=await csGet(u.id);t.msgs.push({from,text,...(img?{img}:{}),at:Date.now()});t.msgs=t.msgs.slice(-200);t.at=Date.now()
 while(t.msgs.length>5&&JSON.stringify(t.msgs).length>8e6)t.msgs.shift()
 if(from==='user')t.au++;else t.uu++
 await kv.set('cs:'+u.id,t)
 const ix=(await kv.get('csidx'))||[];if(!ix.includes(u.id))await kv.set('csidx',[...ix,u.id]);return t}
// ---- Leaderboard ----
async function board(){
 const c=globalThis.__lb;if(c&&Date.now()-c.t<30000)return c.d
 const ids=(await kv.get('idx'))||[],us=(await Promise.all(ids.map(i=>kv.get('u:'+i)))).filter(Boolean)
 const rows=us.map(u=>{const ok=(u.tx||[]).filter(x=>x.type==='order'&&x.status==='success');return {u:mask(u.email),balance:u.balance,trx:ok.length,spent:ok.reduce((a,x)=>a+x.price,0),banned:u.banned}}).filter(r=>!r.banned)
 const top=(k,f)=>[...rows].filter(f).sort((a,b)=>b[k]-a[k]).slice(0,10).map(({banned,...r})=>r)
 const d={bal:top('balance',r=>r.balance>0),trx:top('trx',r=>r.trx>0),users:us.length,orders:rows.reduce((a,r)=>a+r.trx,0)}
 const cf=await getCfg(),w=cf.weekly,ws=weekStart()
 d.week={on:w.on,metric:w.metric,prizes:w.prizes,min:w.min,start:ws,end:ws+WEEK}
 d.wk=weekRows(us,ws,ws+WEEK,w.metric).slice(0,10).map(r=>({u:mask(r.email),trx:r.trx,spent:r.spent}))
 d.last=await kv.get('wk:last')
 const mo=cf.monthly,ms=monthStart()
 d.month={on:mo.on,metric:mo.metric,prizes:mo.prizes,min:mo.min,start:ms,end:monthEnd()}
 d.mo=weekRows(us,ms,monthEnd(),mo.metric).slice(0,10).map(r=>({u:mask(r.email),trx:r.trx,spent:r.spent}))
 d.lastMonth=await kv.get('mo:last')
 globalThis.__lb={t:Date.now(),d};return d}
async function h(req,{params}){
 const p=params.p.join('/'),b=req.method==='POST'?await req.json().catch(()=>({})):{},q=Object.fromEntries(new URL(req.url).searchParams)
 const cfg=await cfgGet()
 try{
 if(p==='auth/login'||p==='auth/register'||p==='auth/forgot'||p==='auth/reset'){const ip=(req.headers.get('x-forwarded-for')||'x').split(',')[0].trim();if(await kv.incr(`lg:${ip}:${Math.floor(Date.now()/60000)}`)>12)return E('Terlalu banyak percobaan, coba lagi 1 menit',429)}
 if(p==='auth/register'){
  const email=String(b.email||'').toLowerCase().trim()
  if(!/^\S+@\S+\.\S+$/.test(email)||String(b.password||'').length<6)return E('Email/password tidak valid (min 6 karakter)')
  if(await kv.get('e:'+email))return E('Email sudah terdaftar')
  const rc=String(b.ref||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);let rf=null
  if(rc&&cfg.ref.on){const rfid=await kv.get('rc:'+rc);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)return E('Kode ajakan tidak valid')}
  const u={id:rid(),email,name:b.name||email.split('@')[0],pass:hash(b.password),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),refBy:rf?rf.id:null,refPaid:false}
  await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id)
  await kv.set('idx',[...((await kv.get('idx'))||[]),u.id])
  await notify({i:'👤',t:'Pengguna baru bergabung',rows:[['Nama',String(u.name).slice(0,2)+'***'],['Email',mask(email)],['Total pengguna',((await kv.get('idx'))||[]).length],...(rf?[['Diajak oleh',mask(rf.email)]]:[])],note:'Selamat datang di Artapedia ID!'});return J({ok:1},200,await session(u))}
 if(p==='auth/login'){
  const id=await kv.get('e:'+String(b.email||'').toLowerCase().trim()),u=id&&await kv.get('u:'+id)
  if(!u||!check(String(b.password||''),u.pass))return E('Email atau password salah',401)
  return J({ok:1},200,await session(u))}
 if(p==='auth/forgot'){
  const email=String(b.email||'').toLowerCase().trim(),id=await kv.get('e:'+email),u=id&&await kv.get('u:'+id)
  if(u&&Date.now()-(u.prAt||0)>60000){
   const tk=rid();await kv.set('pr:'+tk,{id:u.id,exp:Date.now()+30*60000});u.prAt=Date.now();await save(u)
   const link=site(req)+'/reset?token='+tk
   const m=await sendMail(email,'Reset password Artapedia ID',`<div style="font-family:Arial,sans-serif;max-width:480px"><h2>Reset password</h2><p>Halo ${String(u.name||'').replace(/[<>&]/g,'')},</p><p>Klik tombol di bawah untuk membuat password baru. Link berlaku 30 menit dan hanya bisa dipakai sekali.</p><p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Buat password baru</a></p><p style="color:#64748b;font-size:13px">Kalau bukan kamu yang meminta, abaikan email ini. Password lamamu tetap aman.</p></div>`)
   await notify({i:'🔐',t:'Permintaan reset password',rows:[['Pengguna',mask(email)],['Email terkirim',m.ok?'Ya':'Belum']],note:m.ok?'':'Email belum terkirim: '+m.error+'. Buat link manual di /admin lalu kirim ke pengguna.'})}
  return J({ok:1,msg:'Jika email terdaftar, link reset password sudah dikirim. Cek juga folder spam.'})}
 if(p==='auth/reset'){
  const tk=String(b.token||''),r=/^[a-f0-9]{32}$/.test(tk)&&await kv.get('pr:'+tk)
  if(!r||r.exp<Date.now())return E('Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.')
  if(String(b.password||'').length<6)return E('Password minimal 6 karakter')
  const u=await kv.get('u:'+r.id);if(!u)return E('Akun tidak ditemukan',404)
  u.pass=hash(String(b.password));u.pwAt=Date.now();await save(u);await kv.set('pr:'+tk,null)
  await notify({i:'🔐',t:'Password direset',rows:[['Pengguna',mask(u.email)]]});return J({ok:1})}
 if(p==='auth/logout')return J({ok:1},200,{'Set-Cookie':'sid=;Path=/;Max-Age=0'})
 // ---- Publik (tanpa login) ----
 if(p==='v1/announcements')return J({items:(await kv.get('ann'))||[]})
 if(p==='v1/leaderboard')return J(await board())
 if(p==='v1/promo'){const now=Date.now(),b2=cfg.bonus,ws=weekStart();return J({
  bonus:{on:!!b2.on,pct:bonusPct(cfg,now),basePct:+b2.pct||0,boost:(b2.days||[]).length>0&&bonusPct(cfg,now)!==(+b2.pct||0),minAmt:b2.minAmt,max:b2.max,days:b2.days||[],dayPct:b2.dayPct},
  ref:{on:!!cfg.ref.on,referrer:cfg.ref.referrer,referee:cfg.ref.referee,minDep:cfg.ref.minDep},
  weekly:{on:!!cfg.weekly.on,metric:cfg.weekly.metric,prizes:cfg.weekly.prizes,min:cfg.weekly.min,end:ws+WEEK},
  monthly:{on:!!cfg.monthly.on,metric:cfg.monthly.metric,prizes:cfg.monthly.prizes,min:cfg.monthly.min,end:monthEnd()},
  site:{baseUrl:cfg.site.baseUrl||site(req),docsUrl:cfg.site.docsUrl||'/docs'}})}
 if(p.startsWith('admin/')){
  if(req.headers.get('x-admin')!==process.env.ADMIN_PASSWORD)return E('unauthorized',401)
  const a=p.slice(6);let t=null
  if(b.email){const id=await kv.get('e:'+b.email.toLowerCase());t=id&&await kv.get('u:'+id);if(!t)return E('user tidak ada',404)}
  if(a==='data'){const ids=(await kv.get('idx'))||[];const us=await Promise.all(ids.map(i=>kv.get('u:'+i)));return J({cfg,ann:(await kv.get('ann'))||[],users:us.filter(Boolean).map(({pass,tx,mut,...x})=>x)})}
  if(a==='testnotif')return J(await notify({i:'✅',t:'Tes notifikasi berhasil',rows:[['Status','Terhubung'],['Tombol aktif',(cfg.buttons||[]).length]],note:'Kalau pesan ini masuk lengkap dengan tombol, notifikasi sudah siap.'}))
  if(a==='addsaldo'){mut(t,+b.amount,'Admin tambah');await save(t);await notify({i:'🛠',t:'Admin tambah saldo',rows:[['Pengguna',mask(t.email)],['Nominal','+'+rp(b.amount)],['Saldo sekarang',rp(t.balance)]]});return J({balance:t.balance})}
  if(a==='delsaldo'){mut(t,-b.amount,'Admin kurangi');await save(t);await notify({i:'🛠',t:'Admin kurangi saldo',rows:[['Pengguna',mask(t.email)],['Nominal','-'+rp(b.amount)],['Saldo sekarang',rp(t.balance)]]});return J({balance:t.balance})}
  if(a==='ban'||a==='unban'){t.banned=a==='ban';await save(t);await notify({i:a==='ban'?'⛔':'♻️',t:'Admin '+a+' akun',rows:[['Pengguna',mask(t.email)]]});return J({ok:1})}
  if(a==='markup'){cfg.markup=+b.percent;await kv.set('cfg',cfg);return J(cfg)}
  if(a==='broadcast'){cfg.broadcast=b.text||'';await kv.set('cfg',cfg);await notify({i:'📢',t:'Broadcast baru',note:cfg.broadcast});return J(cfg)}
  if(a==='server'){cfg.off=b.on?cfg.off.filter(s=>s!==b.server):[...new Set([...cfg.off,b.server])];await kv.set('cfg',cfg);return J(cfg)}
  // Tombol link di bawah notifikasi channel
  if(a==='buttons'){cfg.buttons=(Array.isArray(b.buttons)?b.buttons:[]).map(x=>({text:String(x.text||'').slice(0,40),url:String(x.url||'').trim()})).filter(x=>x.text&&/^https?:\/\//.test(x.url)).slice(0,6);await kv.set('cfg',cfg);return J(cfg)}
  // Pengumuman
  if(a==='ann/add'){
   const title=String(b.title||'').trim().slice(0,120),body=String(b.body||'').trim().slice(0,3000);if(!title)return E('Judul wajib diisi')
   let img='';if(b.img){img=String(b.img);if(!/^data:image\/(jpeg|png|webp|gif);base64,/.test(img))return E('Format gambar tidak valid');if(img.length>700000)return E('Gambar terlalu besar (maks ~500KB)')}
   const ann=(await kv.get('ann'))||[];ann.unshift({id:rid().slice(0,10),title,body,img,at:Date.now()});await kv.set('ann',ann.slice(0,50))
   await notify({i:'📣',t:'Pengumuman baru: '+title,note:body.slice(0,300)});return J({items:ann})}
  if(a==='ann/del'){const ann=((await kv.get('ann'))||[]).filter(x=>x.id!==b.id);await kv.set('ann',ann);return J({items:ann})}
  // Customer service (sisi admin)
  if(a==='cs/list'){const ix=(await kv.get('csidx'))||[];const th=await Promise.all(ix.map(async id=>{const u=await kv.get('u:'+id),c=await csGet(id);return u&&{uid:id,email:u.email,name:u.name,unread:c.au,at:c.at,last:((c.msgs[c.msgs.length-1]||{}).text||'')||((c.msgs[c.msgs.length-1]||{}).img?'📷 Foto':'')}}));return J({items:th.filter(Boolean).sort((x,y)=>y.at-x.at)})}
  if(a==='cs/thread'){const c=await csGet(b.uid);c.au=0;await kv.set('cs:'+b.uid,c);return J({msgs:c.msgs})}
  if(a==='cs/reply'){const u=await kv.get('u:'+b.uid),text=String(b.text||'').trim().slice(0,1000);if(b.img&&!okImg(b.img))return E('Foto tidak valid / terlalu besar');if(!u||(!text&&!b.img))return E('Data tidak valid');const c=await csPush(u,'admin',text,b.img);c.au=0;await kv.set('cs:'+u.id,c);return J({msgs:c.msgs})}
  // ---- Promo: referral, bonus deposit, hadiah mingguan ----
  if(a==='promo'){
   const n=x=>Math.max(0,Math.floor(+x||0)),r=b.ref||{},bo=b.bonus||{},w=b.weekly||{},mo=b.monthly||{},wasOff=!cfg.weekly.on,moOff=!cfg.monthly.on
   cfg.ref={on:!!r.on,referrer:n(r.referrer),referee:n(r.referee),minDep:Math.max(2000,n(r.minDep)),maxRef:n(r.maxRef)||100}
   cfg.bonus={on:!!bo.on,minAmt:Math.max(2000,n(bo.minAmt)),pct:Math.min(50,Math.max(0,+bo.pct||0)),max:n(bo.max),days:[...new Set((Array.isArray(bo.days)?bo.days:[]).map(Number).filter(x=>x>=0&&x<=6))],dayPct:Math.min(50,Math.max(0,+bo.dayPct||0))}
   const pz=(Array.isArray(w.prizes)?w.prizes:String(w.prizes||'').split(',')).map(n).filter(x=>x>0).slice(0,10)
   cfg.weekly={on:!!w.on,metric:w.metric==='spent'?'spent':'trx',prizes:pz,min:Math.max(1,n(w.min))}
   const pm=(Array.isArray(mo.prizes)?mo.prizes:String(mo.prizes||'').split(',')).map(n).filter(x=>x>0).slice(0,10)
   cfg.monthly={on:!!mo.on,metric:mo.metric==='spent'?'spent':'trx',prizes:pm,min:Math.max(1,n(mo.min))}
   if(cfg.weekly.on&&wasOff)await kv.set('wk:init',weekStart())
   if(cfg.monthly.on&&moOff)await kv.set('mo:init',monthStart())
   await kv.set('cfg',cfg);globalThis.__lb=null;return J(cfg)}
  if(a==='weekly/pay'){const r=await payWeekly();return J({done:!!r,res:r})}
  if(a==='monthly/pay'){const r=await payMonthly();return J({done:!!r,res:r})}
  // ---- Link / Base URL untuk dokumentasi API ----
  if(a==='site'){const u=x=>{x=String(x||'').trim().replace(/\/+$/,'');return x===''||/^https?:\/\/[^\s]+$/.test(x)||/^\/[^\s]*$/.test(x)?x:null}
   const bu=u(b.baseUrl),du=u(b.docsUrl);if(bu===null||du===null)return E('Link harus diawali http:// atau https:// (docs boleh /docs)')
   cfg.site={baseUrl:bu.slice(0,200),docsUrl:du.slice(0,200)};await kv.set('cfg',cfg);return J(cfg.site)}
  if(a==='weekly/last')return J({last:await kv.get('wk:last')})
  // ---- Lupa password: admin buat link reset manual ----
  if(a==='resetlink'){if(!t)return E('Isi email pengguna dulu');const tk=rid();await kv.set('pr:'+tk,{id:t.id,exp:Date.now()+30*60000});return J({link:site(req)+'/reset?token='+tk})}
  // ---- Backup / restore ----
  if(a==='backup/status')return J({meta:(await kv.get('bk:meta'))||null,chat:!!process.env.BACKUP_CHAT_ID,token:!!process.env.TELEGRAM_BOT_TOKEN,cfg:cfg.backup})
  if(a==='backup/now')return J(await runBackup('manual'))
  if(a==='backup/cfg'){cfg.backup={on:!!b.on,hours:Math.min(720,Math.max(1,Math.floor(+b.hours)||24))};await kv.set('cfg',cfg);return J(cfg.backup)}
  if(a==='backup/page')return J(await backupPage(b.cursor))
  if(a==='backup/wipe'){if(b.confirm!=='HAPUS')return E('Konfirmasi salah');let sf=null;try{sf=(await runBackup('manual')).ok}catch(e){}await wipeAll();return J({ok:1,safety:sf})}
  if(a==='backup/import'){try{return J({n:await importItems(b.items)})}catch(e){return E(e.message)}}
  return E('not found',404)}
 const u=await who(req);if(!u)return E('API key tidak ada/tidak valid, atau belum login',401)
 if(u.banned)return E('Akun ditangguhkan',403)
 if((/^Bearer /.test(req.headers.get('authorization')||'')||q.api_key)&&p.startsWith('v1/')){
  const sc=p==='v1/order'&&req.method==='POST'?['o',20]:p==='v1/deposit'&&req.method==='POST'?['d',6]:null
  const w=Math.floor(Date.now()/60000),reset=(w+1)*60,retry=Math.max(1,reset-Math.floor(Date.now()/1000))
  const n=await kv.incr(`rl:${u.id}:a:${w}`),m=sc?await kv.incr(`rl:${u.id}:${sc[0]}:${w}`):0
  req.__rl={remaining:Math.max(0,60-n),reset}
  if(n>60||(sc&&m>sc[1]))return J({error:`Rate limit exceeded. Coba lagi dalam ${retry} detik.`,retryAfter:retry},429,{'Retry-After':String(retry),'X-RateLimit-Limit':'60','X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(reset)})}
 if(p==='v1/me'){await ensureRef(u);return J({name:u.name,email:u.email,balance:u.balance,joinedAt:u.joinedAt,apikey:u.apikey,broadcast:cfg.broadcast,csUnread:(await csGet(u.id)).uu,refCode:u.refCode,refCount:u.refCount||0,refEarn:u.refEarn||0,refPending:!!(u.refBy&&!u.refPaid)})}
 if(p==='v1/apikey'&&req.method==='POST'){await kv.set('k:'+u.apikey,null);u.apikey=rid();await kv.set('k:'+u.apikey,u.id);await save(u);return J({apikey:u.apikey})}
 if(p==='v1/servers')return J({items:SERVERS.filter(s=>!cfg.off.includes(s.server))})
 if(p==='v1/mutasi')return J({items:(u.mut||[]).slice(0,100)})
 // ---- Customer service (sisi pengguna) ----
 if(p==='v1/cs'){
  const info=csInfo(),c=await csGet(u.id)
  if(req.method==='POST'){
   const text=String(b.text||'').trim().slice(0,1000);if(b.img&&!okImg(b.img))return E('Foto tidak valid atau terlalu besar (maks ~200KB)');if(!text&&!b.img)return E('Pesan kosong')
   if(!info.open)return E('Customer service sedang tutup. Jam layanan: '+info.hours,403)
   if(await kv.incr(`cs:${u.id}:${Math.floor(Date.now()/60000)}`)>8)return E('Terlalu cepat, tunggu sebentar',429)
   const t=await csPush(u,'user',text,b.img)
   await notify({i:'💬',t:'Pesan Customer Service',rows:[['Dari',mask(u.email)],['Pesan',(text.slice(0,300)||'-')+(b.img?'  📷 +foto':'')]],note:'Balas lewat dashboard admin > CS'})
   return J({open:true,hours:info.hours,msgs:t.msgs})}
  if(c.uu){c.uu=0;await kv.set('cs:'+u.id,c)}
  return J({...info,msgs:c.msgs})}
 if(p==='v1/support')return E('Gunakan /v1/cs',410)
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
  const sell=mk(base),guarantee=!!b.guarantee,fee=guarantee?Math.ceil(sell*0.1):0,price=sell+fee
  if(u.balance<price)return E('Saldo tidak cukup')
  mut(u,-price,'Order nokos');await save(u)
  let o;try{o=await P[sv].order({...b,server:sv})}catch(e){mut(u,price,'Refund gagal order');await save(u);await notify({i:'⚠️',t:'Order gagal',rows:[['Pengguna',mask(u.email)],['Layanan',b.serviceName||b.serviceId],['Error',e.message]]});return E(e.message,502)}
  const rec={type:'order',id:o.id,server:sv,serviceId:b.serviceId,serviceName:b.serviceName||b.serviceId,countryName:b.countryName||'',countryId:b.countryId,providerId:b.providerId,operatorId:b.operatorId,phone:o.phone,price,fee,guarantee,status:'pending',otp:null,msg:null,cost:o.cost,expiredAt:o.expiredAt,refunded:false,at:Date.now()}
  u.tx.unshift(rec);await kv.set('o:'+o.id,u.id);await save(u)
  await notify({i:'📱',t:'Pembelian nokos baru',rows:[['Pengguna',mask(u.email)],['Layanan',rec.serviceName+(rec.countryName?' · '+rec.countryName:'')],['Nomor',o.phone],['Harga',rp(price)+(guarantee?' (+Jaminan OTP)':'')],['Server',sv]]})
  return J({orderId:o.id,server:sv,phoneNumber:o.phone,price,fee,guarantee,expiredAt:o.expiredAt,createdAt:new Date(rec.at).toISOString(),balance:u.balance})}
 const view=o=>({orderId:o.id,server:o.server,serviceId:o.serviceId,serviceName:o.serviceName,countryName:o.countryName,phoneNumber:o.phone,price:o.price,fee:o.fee||0,guarantee:!!o.guarantee,replaced:!!o.replaced,status:o.status,otpCode:o.otp,otpMsg:o.msg,refunded:o.refunded,expiredAt:o.expiredAt,createdAt:new Date(o.at).toISOString()})
 if(p==='v1/orders'){
  const lim=Math.min(+q.limit||50,100),pg=+q.page||1,all=u.tx.filter(x=>x.type==='order')
  return J({page:pg,limit:lim,items:all.slice((pg-1)*lim,pg*lim).map(view)})}
 if(p==='v1/orders/status'||p==='v1/orders/cancel'){
  const oid=q.order_id||b.order_id,o=u.tx.find(x=>x.type==='order'&&x.id===oid);if(!o)return E('Pesanan tidak ditemukan',404)
  if(o.status==='pending'&&!P[o.server])return E('Server order ini sudah tidak tersedia',503)
  if(o.status==='pending'){
   if(p.endsWith('cancel')){
    const wait=Math.ceil((o.at+CANCEL_WAIT-Date.now())/1000)
    if(wait>0)return E(`Order baru bisa dibatalkan setelah 3 menit. Tunggu ${wait} detik.`,400)
    try{await P[o.server].cancel(o.id)}catch(e){return E('Pembatalan ditolak provider: '+e.message,502)}
    o.status='cancelled';refund(u,o);await notify({i:'❌',t:'Order dibatalkan',rows:[['Pengguna',mask(u.email)],['Nomor',o.phone],['Refund',rp(o.price)]]})}
   else{
    const s=await P[o.server].status(o.id)
    if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;await notify({i:'🔑',t:'OTP diterima',rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)]],note:o.guarantee?'Order memakai Jaminan OTP':''})}
    else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';refund(u,o)}
    else await replaceIfNeeded(u,o)}
   await save(u)}
  return J({...view(o),balance:u.balance})}
 if(p==='v1/deposit/methods')return J(await upDep.methods())
 if(p==='v1/deposit/cancel'&&req.method==='POST'){
  const o=u.tx.find(x=>x.type==='deposit'&&x.id===(b.order_id||q.order_id));if(!o)return E('Deposit tidak ditemukan',404)
  if(o.status!=='pending')return E('Deposit ini sudah '+o.status+', tidak bisa dibatalkan')
  // cek dulu: kalau ternyata sudah dibayar, saldo dikreditkan, bukan dibatalkan
  try{if((await upDep.check(o.id)).status==='completed'){o.status='completed';if(!o.credited)await creditDeposit(u,o);await save(u);return E('Deposit ternyata sudah dibayar, saldo sudah masuk')}}catch(e){}
  await upDep.cancel(o.id);o.status='canceled';await save(u)
  await notify({i:'🚫',t:'Deposit dibatalkan pengguna',rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['ID',o.id]]})
  return J({ok:1,status:'canceled'})}
 if(p==='v1/deposit'&&req.method==='POST'){
  const amount=Math.floor(+b.amount);if(!(amount>=DEP_MIN&&amount<=DEP_MAX))return E('Nominal deposit minimal Rp2.000 dan maksimal Rp10.000.000')
  if(!b.provider)return E('provider wajib (lihat /v1/deposit/methods)')
  if(u.tx.filter(x=>x.type==='deposit'&&x.status==='pending').length>=3)return E('Terlalu banyak QRIS belum dibayar. Batalkan salah satu dulu.')
  const d=await upDep.create(amount,b.provider)
  const rec={type:'deposit',id:d.order_id,amount,total:d.total_amount,fee:d.admin_fee,qr:d.qr_string,qrImg:d.qr_image,exp:d.expired_at,status:'pending',credited:false,at:Date.now()}
  u.tx.unshift(rec);await kv.set('d:'+rec.id,u.id);await save(u)
  await notify({i:'💰',t:'Deposit menunggu pembayaran',rows:[['Pengguna',mask(u.email)],['Nominal',rp(amount)],['Total bayar',rp(d.total_amount)],['ID',rec.id]]})
  return J({order_id:rec.id,total_amount:rec.total,admin_fee:rec.fee,qr_string:rec.qr,qr_image:rec.qrImg,expired_at:rec.exp})}
 if(p==='v1/deposit'){
  if(!q.order_id)return J({items:u.tx.filter(x=>x.type==='deposit').slice(0,20).map(x=>({order_id:x.id,amount:x.amount,total_amount:x.total,status:x.status,qr_string:x.qr,qr_image:x.qrImg,expired_at:x.exp,createdAt:new Date(x.at).toISOString()}))})
  const o=u.tx.find(x=>x.type==='deposit'&&x.id===q.order_id);if(!o)return E('Deposit tidak ditemukan',404)
  if(o.status==='pending'){const st=(await upDep.check(o.id)).status
   if(st==='completed'){o.status='completed';if(!o.credited)await creditDeposit(u,o);await notify({i:'✅',t:'Deposit sukses',rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],...(o.bonus?[['Bonus deposit','+'+rp(o.bonus)]]:[]),['Saldo sekarang',rp(u.balance)]]})}
   else if(['expired','canceled','failed'].includes(st))o.status=st
   await save(u)}
  return J({order_id:o.id,status:o.status,credited:o.credited,balance:u.balance,qr_string:o.qr,qr_image:o.qrImg,total_amount:o.total})}
 return E('Endpoint tidak ditemukan',404)
 }catch(e){return E(e.message||'Server error',500)}}
async function H(req,ctx){const r=await h(req,ctx),l=req.__rl
 if(l&&!r.headers.has('X-RateLimit-Limit')){r.headers.set('X-RateLimit-Limit','60');r.headers.set('X-RateLimit-Remaining',String(l.remaining));r.headers.set('X-RateLimit-Reset',String(l.reset))}
 return r}
export {H as GET,H as POST}
