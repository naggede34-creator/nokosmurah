import crypto from 'crypto'
import {kv} from '../../../lib/db'
import {who,save,hash,check,rid,clientIp,validIp,normIp} from '../../../lib/auth'
import * as BAN from '../../../lib/ban'
import {checkUrl,newSecret,deliver,fireOtp,rsPayCut} from '../../../lib/webhook'
import {P,SERVERS,UPSTREAM,sc,dbn,isRestock,RESTOCK_MSG} from '../../../lib/providers'
import {csbotNotify,csbotSetup,csCall,csIds,csbotReady} from '../../../lib/csbot'
import {notify,mask,rp,wibAt} from '../../../lib/telegram'
import {replaceIfNeeded,cancelBlock,markCancel,cancelMsg,retryCancel,unwindRs,expireIfLate,isLate} from '../../../lib/sync'
import {getSec,secInfo,secSave,SEC} from '../../../lib/settings'
import {METHODS,ROUTES,ROUTES_V2,ROUTES_RS,methodsList,readiness,createDeposit,depCheck,depCancel,applyDep,toMs,depPendAdd,recheckDep} from '../../../lib/deposit'
import {getCfg,giveWelcome,creditDeposit,refundOnce,ensureRef,bonusPct,weekStart,WEEK,weekRows,payWeekly,payMonthly,monthStart,monthEnd} from '../../../lib/bonus'
import {sendMail} from '../../../lib/mail'
import {getBots,saveBots,tg,pushUser,botSetup} from '../../../lib/tgpush'
import {startBroadcast,bcStep} from '../../../lib/tgbot'
import {autoStatus,autoSave,autoDry,autoRunNow,removeUser} from '../../../lib/autoclean'
import {bcaInfo,startAll as bcaStart,bcaStep,bcaGet,bcaCancel,brief as bcaBrief} from '../../../lib/bcall'
import {bg} from '../../../lib/bg'
import {feedList,feedAddBg,feedBust} from '../../../lib/livefeed'
import {h2hReady,instNominals,h2hCheck} from '../../../lib/h2h'
import {aiOn,askNona,FALLBACK,csName,cleanTrain} from '../../../lib/aics'
import {runBackup,backupPage,importItems,wipeAll,reindexUsers,userStats,usersPage,contents as bkContents} from '../../../lib/backup'
import * as PAY from '../../../lib/paygw'
import {strukPng,strukSign,strukUrl} from '../../../lib/strukimg'
import * as JOB from '../../../lib/jobs'
import * as RSL from '../../../lib/reseller'
import {smpReady} from '../../../lib/smp'
import * as KEL from '../../../lib/kelola'
import * as AGWA from '../../../lib/agwadmin'
import {publicKey as pushKey,subscribe as pushSub,unsubscribe as pushUnsub,push as pushSend,count as pushCount,devices as pushDevices,KEY_ADMIN,keyUser} from '../../../lib/push'
export const dynamic='force-dynamic'
export const maxDuration=60
const J=(d,s=200,h)=>Response.json(d,{status:s,headers:h})
const E=(m,s=400)=>J({error:m},s)
const cfgGet=getCfg
// Struk gambar untuk ditempelkan ke notifikasi. Tidak pernah melempar: kalau gagal,
// notifikasinya tetap terkirim sebagai teks biasa.
const strukOrder=async(o,host,showOtp)=>{try{return await strukPng({...o,orderId:o.id,phoneNumber:o.phone,createdAt:new Date(o.at).toISOString(),showOtp:!!showOtp},'order',host)}catch(e){return null}}
const strukDep=async(o,host)=>{try{return await strukPng({order_id:o.id,amount:o.amount,total_amount:o.total,bonus:o.bonus||0,method_name:(METHODS[o.method]||METHODS.qris).name,status:o.status,createdAt:new Date(o.at).toISOString()},'deposit',host)}catch(e){return null}}
const host=req=>{try{return new URL(req.url).host}catch(e){return 'artapedia.id'}}
const site=req=>(req.__sec&&req.__sec.SITE_URL)||((req.headers.get('x-forwarded-proto')||'https')+'://'+(req.headers.get('x-forwarded-host')||req.headers.get('host')))
const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()})}
// refund dipusatkan di lib/bonus.js (berkunci, aman dari refund ganda saat cron & pengguna bersamaan)
const refund=(u,o)=>refundOnce(u,o)
const LBC=['blue','green','red','yellow','purple','ink']   // warna label server
const POPT=['pink','blue','yellow','green','purple']       // tema popup
// Penjaga klik ganda: permintaan yang sama (aksi+pengguna+nominal) ditolak selama beberapa detik,
// supaya admin yang menekan tombol dua kali tidak menambah/mengurangi saldo dua kali.
const sekali=(k,ms=5000)=>kv.lock('once:'+k,ms)
const DOBEL='Permintaan yang sama baru saja diproses. Cek saldonya dulu sebelum mengulang.'
const cookie=t=>({'Set-Cookie':`sid=${t};Path=/;HttpOnly;SameSite=Lax;Max-Age=2592000${process.env.NODE_ENV==='production'?';Secure':''}`})
async function session(u,req){const t=rid();await kv.set('s:'+t,u.id+'|'+Date.now())
 // catat IP & waktu login (dipakai halaman detail user di admin)
 try{if(req){const ip=clientIp(req)||'-',now=Date.now(),l=Array.isArray(u.ips)?u.ips:[],ex=l.find(x=>x.ip===ip)
  u.lastLogin=now;u.lastIp=ip;u.lastUa=(req.headers.get('user-agent')||'').slice(0,160);u.logins=(u.logins||0)+1
  u.ips=[{ip,at:now,n:(ex?ex.n:0)+1,first:ex?ex.first:now},...l.filter(x=>x.ip!==ip)].slice(0,15);await save(u)}}catch(e){}
 return cookie(t)}
// ---- Customer service: jam 09.00-17.00 dan 18.00-22.00 WIB ----
// Jam layanan CS + saklar admin. Kalau admin mematikan CS, alasannya yang ditampilkan ke pengguna.
const csInfo=cfg=>{const w=new Date(Date.now()+7*36e5),m=w.getUTCHours()*60+w.getUTCMinutes()
 const jam=(m>=540&&m<1020)||(m>=1080&&m<1320),cs=(cfg||{}).cs||{}
 const mati=cs.on===false,ai=!mati&&!!cs.ai
 return {open:!mati&&(jam||ai),ai,aiName:ai?csName(cfg):'',hours:'09.00 - 17.00 dan 18.00 - 22.00 WIB',off:mati,offMsg:mati?(cs.msg||'Customer service sedang dinonaktifkan sementara.'):''}}
const csGet=async id=>(await kv.get('cs:'+id))||{msgs:[],au:0,uu:0,at:0}
const okImg=i=>typeof i==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(i)&&i.length<=300000
async function csPush(u,from,text,img,x={}){
 const t=await csGet(u.id);t.msgs.push({from,text,...(img?{img}:{}),...(x.ai?{ai:1}:{}),at:Date.now()});if(from==='admin'&&!x.ai)t.esc=false;t.msgs=t.msgs.slice(-200);t.at=Date.now()
 while(t.msgs.length>5&&JSON.stringify(t.msgs).length>8e6)t.msgs.shift()
 if(from==='user')t.au++;else t.uu++
 await kv.set('cs:'+u.id,t)
 const ix=(await kv.get('csidx'))||[];if(!ix.includes(u.id))await kv.sadd('csidx',u.id)
 // Notifikasi ke HP (Web Push): pesan pengguna membangunkan HP admin, balasan admin membangunkan HP pengguna.
 // Berjalan walaupun browser sudah ditutup; kegagalannya tidak boleh menggagalkan pengiriman chat.
 const body=(text||'').slice(0,120)||(img?'📷 Mengirim foto':'Pesan baru')
 try{
  if(from==='user'){if(x.quiet)return t
   await pushSend(KEY_ADMIN,{t:'💬 Chat CS · '+mask(u.email),b:body,u:'/admin',tag:'cs-'+u.id,ring:3}).catch(()=>{});await csbotNotify(u,text,img)}
  else await pushSend(keyUser(u.id),{t:'💬 Balasan Customer Service',b:body,u:'/cs',tag:'cs',ring:2})}
 catch(e){}
 return t}

// ---- Mode CS 2: Nona Cantikan (AI) menjawab otomatis ----
const _sl=ms=>new Promise(r=>setTimeout(r,ms))
async function csAiRun(uid){
 const lk='csai:'+uid;if(!await kv.lock(lk,70000))return
 try{
  for(let n=0;n<3;n++){
   const u=await kv.get('u:'+uid);if(!u)return
   const cfg=await getCfg();if(!aiOn(cfg))return
   let t=await csGet(uid);const last=t.msgs[t.msgs.length-1]
   if(!last||last.from!=='user')return
   // admin manusia baru saja turun tangan di chat ini -> Nona diam supaya tidak bentrok
   const hum=[...t.msgs].reverse().find(m=>m.from==='admin'&&!m.ai)
   if(hum&&hum.at<=last.at&&Date.now()-hum.at<20*60000)return
   t.typ=Date.now();await kv.set('cs:'+uid,t)
   await _sl(800+Math.floor(Math.random()*900))
   let r;try{r=await askNona({u,cfg,msgs:t.msgs.slice(0,-1),text:last.text,hadImg:!!last.img})}
   catch(e){r={text:FALLBACK,esc:true,err:e.message}}
   const c=await csPush(u,'admin',r.text,null,{ai:1})
   c.typ=0;if(r.esc)c.esc=true;else c.au=0
   await kv.set('cs:'+uid,c)
   if(r.err)await notify({i:'⚠️',t:'Nona AI gagal membalas',st:'info',note:String(r.err).slice(0,300)}).catch(()=>{})
   if(r.esc){try{
    await pushSend(KEY_ADMIN,{t:'🙋 Nona butuh admin · '+mask(u.email),b:(last.text||'📷 Foto').slice(0,120),u:'/admin',tag:'cs-'+u.id,ring:3}).catch(()=>{})
    await csbotNotify(u,'🙋 Nona meneruskan ke admin: '+(last.text||''),last.img)}catch(e){}}}
 }catch(e){}
 finally{await kv.unlock(lk)}}
// ---- Leaderboard ----
// Data manual (admin > Beranda) disimpan di kv "lb_manual": [{id,name,balance,trx,spent}]. Hanya tampil di tab Saldo & Transaksi,
// TIDAK ikut hadiah mingguan/bulanan (hadiah hanya untuk pengguna asli). Nama berupa email otomatis disensor.
const lbName=n=>{n=String(n||'').trim();return /^\S+@\S+\.\S+$/.test(n)?mask(n):n.slice(0,40)}
// Papan peringkat memuat SEMUA pengguna, jadi mahal. Dulu dihitung ulang tiap 30 detik per instance dan
// setiap pengunjung yang kebetulan datang saat cache basi harus menunggu seluruh perhitungan.
// Sekarang: segar 3 menit; kalau basi, pengunjung langsung dapat data lama dan perhitungan ulang jalan
// di latar (satu proses saja per instance, tidak menumpuk).
async function boardFull(){
 const c=globalThis.__lb
 if(c&&Date.now()-c.t<180000)return c
 if(!globalThis.__lbp){const p=boardBuild().finally(()=>{globalThis.__lbp=null});p.catch(()=>{});globalThis.__lbp=p;bg(p)}
 return c||globalThis.__lbp}
async function boardBuild(){
 const ids=(await kv.get('idx'))||[]
 // pelanggan bot reseller (u.rs) punya toko sendiri, tidak ikut papan peringkat platform
 const us=(await kv.mget(ids.map(i=>'u:'+i))).filter(x=>x&&!x.rs)
 // Satu papan GLOBAL: tiap baris memuat saldo, jumlah transaksi, berapa kali deposit,
 // dan transaksi sukses. Berlaku untuk pengguna asli maupun yang ditambah admin.
 // (Kolom "transaksi gagal" sengaja dihapus atas permintaan pemilik situs.)
 const real=us.map(u=>{const tx=u.tx||[]
  const ord=tx.filter(x=>x.type==='order')
  const ok=ord.filter(x=>x.status==='success')
  return {u:mask(u.email),balance:+u.balance||0,trx:ord.length,dep:tx.filter(x=>x.type==='deposit'&&x.status==='completed').length,
   ok:ok.length,spent:ok.reduce((a,x)=>a+x.price,0),banned:u.banned}}).filter(r=>!r.banned)
 const man=((await kv.get('lb_manual'))||[]).map(e=>{const ok=Math.max(0,+e.ok||0)
  return {u:lbName(e.name),balance:+e.balance||0,trx:Math.max(+e.trx||0,ok),dep:+e.dep||0,ok,spent:+e.spent||0,banned:false}})
 const rows=[...real,...man]
 // peringkat: jumlah transaksi terbanyak, lalu saldo, lalu jumlah deposit (sesuai yang ditampilkan di papan)
 // yang masuk papan: pernah transaksi, pernah deposit, atau punya saldo
 const aktif=rows.filter(r=>r.ok>0||r.trx>0||r.dep>0||r.balance>0)
 const global=[...aktif].sort((a,b)=>b.trx-a.trx||b.balance-a.balance||b.dep-a.dep).slice(0,50).map(({banned,...r})=>r)
 const cf=await getCfg(),st=cf.stats||{},realStat={users:us.length,orders:real.reduce((a,r)=>a+r.ok,0)}
 const ov=x=>x!==''&&x!=null&&/^\d+$/.test(String(x))?+x:null
 const sum=k=>aktif.reduce((a,r)=>a+r[k],0)
 const d={global,total:{users:aktif.length,saldo:sum('balance'),trx:sum('trx'),dep:sum('dep'),ok:sum('ok')},
  users:ov(st.users)??realStat.users,orders:ov(st.orders)??realStat.orders}
 return globalThis.__lb={t:Date.now(),d,r:realStat}}
const board=async()=>(await boardFull()).d
const lbClean=b=>{const name=String(b.name||'').trim().slice(0,60);if(!name)return {error:'Isi email atau nama dulu'}
 const n=x=>Math.min(1e12,Math.max(0,Math.floor(+x||0)))
 const ok=n(b.ok)
 return {data:{name,balance:n(b.balance),trx:Math.max(n(b.trx),ok),dep:n(b.dep),ok,spent:n(b.spent)}}}

// ---- Login / daftar lewat Google & GitHub (OAuth 2.0, tanpa library tambahan) ----
const OA={
 google:{name:'Google',auth:'https://accounts.google.com/o/oauth2/v2/auth',scope:'openid email profile',id:'GOOGLE_CLIENT_ID',secret:'GOOGLE_CLIENT_SECRET'},
 github:{name:'GitHub',auth:'https://github.com/login/oauth/authorize',scope:'read:user user:email',id:'GITHUB_CLIENT_ID',secret:'GITHUB_CLIENT_SECRET'}}
const oaOn=(sec,k)=>!!(sec[OA[k].id]&&sec[OA[k].secret])
const oaCookie=(v,age)=>`oas=${v};Path=/;HttpOnly;SameSite=Lax;Max-Age=${age}${process.env.NODE_ENV==='production'?';Secure':''}`
const redir=(url,cookies=[])=>{const hd=new Headers({Location:url});for(const c of cookies)hd.append('Set-Cookie',c);return new Response(null,{status:302,headers:hd})}
async function oaProfile(k,sec,code,redirectUri){
 const jf=async(url,init)=>{const r=await fetch(url,{...init,signal:AbortSignal.timeout(12000)});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error_description||d.message||('HTTP '+r.status));return d}
 if(k==='google'){
  const t=await jf('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:sec.GOOGLE_CLIENT_ID,client_secret:sec.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'})})
  const d=await jf('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+t.access_token}})
  if(!d.email||d.email_verified===false)throw Error('Email Google belum terverifikasi')
  return {email:String(d.email).toLowerCase().trim(),name:d.name||''}}
 const t=await jf('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({code,client_id:sec.GITHUB_CLIENT_ID,client_secret:sec.GITHUB_CLIENT_SECRET,redirect_uri:redirectUri})})
 if(!t.access_token)throw Error(t.error_description||'Token GitHub tidak diterima')
 const H={Authorization:'Bearer '+t.access_token,Accept:'application/vnd.github+json','User-Agent':'artapedia-id'}
 const me=await jf('https://api.github.com/user',{headers:H}),em=await jf('https://api.github.com/user/emails',{headers:H}).catch(()=>[])
 const e=(Array.isArray(em)?em:[]).find(x=>x.primary&&x.verified)||(Array.isArray(em)?em:[]).find(x=>x.verified)
 if(!e)throw Error('Email GitHub yang terverifikasi tidak ditemukan. Verifikasi email di GitHub dulu.')
 return {email:String(e.email).toLowerCase().trim(),name:me.name||me.login||''}}
async function oaUser(prof,rc,cfg,ip){
 const email=prof.email,id=await kv.get('e:'+email),ex=id&&await kv.get('u:'+id)
 if(ex)return {u:ex,isNew:false}
 let rf=null
 if(rc&&cfg.ref.on){const rfid=await kv.get('rc:'+rc);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)rf=null}
 const u={id:rid(),email,name:prof.name||email.split('@')[0],pass:hash(rid()),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),refBy:rf?rf.id:null,refPaid:false}
 const wb=await giveWelcome(u,cfg,ip)
 await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id)
 await kv.sadd('idx',u.id)
 const total=((await kv.get('idx'))||[]).length
 await notify({i:'👤',t:'Pengguna baru bergabung',st:'ok',rows:[['Nama',String(u.name).slice(0,2)+'***'],['Email',mask(email)],['Total pengguna',total],...(rf?[['Diajak oleh',mask(rf.email)]]:[]),...(wb?[['Saldo gratis',rp(wb)]]:[])],note:'Daftar lewat '+(prof.via||'OAuth')+'. Selamat datang di Artapedia ID!'})
 return {u,isNew:true}}
async function h(req,{params}){
 const p=params.p.join('/'),b=req.method==='POST'?await req.json().catch(()=>({})):{},q=Object.fromEntries(new URL(req.url).searchParams)
 const cfg=await cfgGet(),sec=await getSec();req.__sec=sec
 const svList=()=>SERVERS.map(s=>({...s,...((cfg.srv||{})[s.server]||{})}))
 try{
 // Pintu masuk ditutup untuk IP yang diblokir admin: login, daftar, login sosial, dan
 // seluruh API pengguna. Panel admin, webhook penyedia, dan layar /api/ban tidak terkena,
 // supaya blokirnya tetap bisa dibuka dan pengguna tetap bisa membaca alasannya.
 if(/^(auth\/(login|register|forgot|reset|google|github)|v1\/)/.test(p)){
  const bi=await BAN.ipBanned(clientIp(req))
  if(bi)return J({error:'Akses dari jaringan ini diblokir. Hubungi admin kalau menurutmu ini keliru.',banned:true,ip:bi.ip},403)}
 if(p==='auth/login'||p==='auth/register'||p==='auth/forgot'||p==='auth/reset'){const ip=(req.headers.get('x-forwarded-for')||'x').split(',')[0].trim();if(await kv.incr(`lg:${ip}:${Math.floor(Date.now()/60000)}`)>12)return E('Terlalu banyak percobaan, coba lagi 1 menit',429)}
 if(p==='auth/register'){
  const email=String(b.email||'').toLowerCase().trim()
  if(!/^\S+@\S+\.\S+$/.test(email)||String(b.password||'').length<6)return E('Email/password tidak valid (min 6 karakter)')
  if(await kv.get('e:'+email))return E('Email sudah terdaftar')
  const rc=String(b.ref||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);let rf=null
  if(rc&&cfg.ref.on){const rfid=await kv.get('rc:'+rc);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)return E('Kode ajakan tidak valid')}
  const u={id:rid(),email,name:b.name||email.split('@')[0],pass:hash(b.password),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),regIp:clientIp(req),refBy:rf?rf.id:null,refPaid:false}
  const wb=await giveWelcome(u,cfg,u.regIp)
  await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id)
  await kv.sadd('idx',u.id)
  await notify({i:'👤',t:'Pengguna baru bergabung',st:'ok',rows:[['Nama',String(u.name).slice(0,2)+'***'],['Email',mask(email)],['Total pengguna',((await kv.get('idx'))||[]).length],...(rf?[['Diajak oleh',mask(rf.email)]]:[]),...(wb?[['Saldo gratis',rp(wb)]]:[])],note:'Selamat datang di Artapedia ID!'});return J({ok:1},200,await session(u,req))}
 if(p==='auth/login'){
  const id=await kv.get('e:'+String(b.email||'').toLowerCase().trim()),u=id&&await kv.get('u:'+id)
  if(!u||!check(String(b.password||''),u.pass))return E('Email atau password salah',401)
  return J({ok:1},200,await session(u,req))}
 if(p==='auth/forgot'){
  const email=String(b.email||'').toLowerCase().trim(),id=await kv.get('e:'+email),u=id&&await kv.get('u:'+id)
  if(u&&Date.now()-(u.prAt||0)>60000){
   const tk=rid();await kv.set('pr:'+tk,{id:u.id,exp:Date.now()+30*60000});u.prAt=Date.now();await save(u)
   const link=site(req)+'/reset?token='+tk
   const m=await sendMail(email,'Reset password Artapedia ID',`<div style="font-family:Arial,sans-serif;max-width:480px"><h2>Reset password</h2><p>Halo ${String(u.name||'').replace(/[<>&]/g,'')},</p><p>Klik tombol di bawah untuk membuat password baru. Link berlaku 30 menit dan hanya bisa dipakai sekali.</p><p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Buat password baru</a></p><p style="color:#64748b;font-size:13px">Kalau bukan kamu yang meminta, abaikan email ini. Password lamamu tetap aman.</p></div>`)
   await notify({i:'🔐',t:'Permintaan reset password',st:'info',rows:[['Pengguna',mask(email)],['Email terkirim',m.ok?'Ya':'Belum']],note:m.ok?'':'Email belum terkirim: '+m.error+'. Buat link manual di /admin lalu kirim ke pengguna.'})}
  return J({ok:1,msg:'Jika email terdaftar, link reset password sudah dikirim. Cek juga folder spam.'})}
 if(p==='auth/reset'){
  const tk=String(b.token||''),r=/^[a-f0-9]{32}$/.test(tk)&&await kv.get('pr:'+tk)
  if(!r||r.exp<Date.now())return E('Link reset tidak valid atau sudah kedaluwarsa. Minta link baru.')
  if(String(b.password||'').length<6)return E('Password minimal 6 karakter')
  const u=await kv.get('u:'+r.id);if(!u)return E('Akun tidak ditemukan',404)
  u.pass=hash(String(b.password));u.pwAt=Date.now();await save(u);await kv.set('pr:'+tk,null)
  await notify({i:'🔐',t:'Password direset',st:'ok',rows:[['Pengguna',mask(u.email)]]});return J({ok:1})}

 // ---- OAuth: daftar provider aktif, mulai login, callback ----
 // daftar semua bot reseller (publik, halaman /bot-reseller)
 if(p==='bot-reseller')return J({items:await RSL.publicList()},200,{'Cache-Control':'public, s-maxage=30, stale-while-revalidate=60'})
 // status maintenance (publik, dipakai halaman depan untuk menampilkan pengumuman / layar maintenance)
 if(p==='maintenance'){const m=cfg.maint||{};return J({on:!!m.on,mode:m.mode==='soft'?'soft':'full',msg:m.msg||'',until:m.auto&&m.until?+m.until:0,auto:!!m.auto,now:Date.now(),srv:Object.fromEntries(Object.entries(m.srv||{}).filter(([,x])=>x&&x.on).map(([k,x])=>[k,x.msg||'']))},200,{'Cache-Control':'no-store'})}
 // Status blokir untuk layar ban: dilihat dari IP pengunjung DAN dari sesi/kunci yang dipakai.
 const kontakBan=async()=>{
  let a=[];try{a=(await kv.get('site_buttons'))||[]}catch(e){}
  let out=a.filter(x=>x&&x.is_active!==false&&x.url).map(x=>({label:x.label||'Hubungi admin',url:x.url}))
  if(!out.length)out=(cfg.buttons||[]).filter(x=>x&&x.url).map(x=>({label:x.text||'Hubungi admin',url:x.url}))
  return out.filter(x=>/^https?:\/\//.test(x.url)).slice(0,4)}
 if(p==='ban'){
  const ip=clientIp(req)
  const bi=await BAN.ipBanned(ip)
  let acc=null;try{const me=await who(req);if(me&&me.banned)acc=me}catch(e){}
  if(!bi&&!acc)return J({banned:false},200,{'Cache-Control':'no-store'})
  const src=acc||null
  return J({banned:true,ip:ip||'',ipBan:!!bi,
   email:src?mask(src.email):'',at:(src&&src.banAt)||(bi&&bi.at)||0,
   reason:(src&&src.banReason)||'',
   // tombol kontak (Telegram/WA dsb) supaya pengguna yang kena blokir tetap bisa mengadu.
   // Sumber utama tombol footer; kalau belum diisi, pakai tombol notifikasi di cfg.buttons.
   btn:await kontakBan()},200,{'Cache-Control':'no-store'})}
 if(p==='auth/providers')return J({google:oaOn(sec,'google'),github:oaOn(sec,'github')})
 {const m=p.match(/^auth\/(google|github)(\/callback)?$/)
  if(m){const k=m[1],o=OA[k],ru=site(req)+'/api/auth/'+k+'/callback'
   if(!oaOn(sec,k))return redir(site(req)+'/login?oauth_err='+encodeURIComponent('Login '+o.name+' belum diaktifkan admin'))
   if(!m[2]){
    const ip=(req.headers.get('x-forwarded-for')||'x').split(',')[0].trim();if(await kv.incr(`lg:${ip}:${Math.floor(Date.now()/60000)}`)>20)return redir(site(req)+'/login?oauth_err='+encodeURIComponent('Terlalu banyak percobaan, coba lagi 1 menit'))
    const st=rid(),rc=String(q.ref||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)
    const url=o.auth+'?'+new URLSearchParams({client_id:sec[o.id],redirect_uri:ru,response_type:'code',scope:o.scope,state:st,...(k==='google'?{prompt:'select_account'}:{})})
    return redir(url,[oaCookie(st+'.'+k+'.'+rc,600)])}
   // callback
   const fail=msg=>redir(site(req)+'/login?oauth_err='+encodeURIComponent(msg),[oaCookie('',0)])
   if(q.error)return fail('Login '+o.name+' dibatalkan')
   const ck=((req.headers.get('cookie')||'').match(/(?:^|;\s*)oas=([^;]*)/)||[])[1]||'',[cs,ck2,crc]=ck.split('.')
   if(!q.code||!q.state||!cs||cs!==q.state||ck2!==k)return fail('Sesi login kedaluwarsa, coba lagi')
   try{
    const prof=await oaProfile(k,sec,q.code,ru);prof.via=o.name
    const {u}=await oaUser(prof,/^[A-Z0-9]{0,12}$/.test(crc||'')?crc:'',cfg,clientIp(req))
    if(u.banned)return fail('Akun ini diblokir')
    const hd=new Headers({Location:site(req)+'/dashboard'});hd.append('Set-Cookie',(await session(u,req))['Set-Cookie']);hd.append('Set-Cookie',oaCookie('',0))
    return new Response(null,{status:302,headers:hd})
   }catch(e){return fail('Login '+o.name+' gagal: '+(e.message||'error'))}}}
 if(p==='auth/logout')return J({ok:1},200,{'Set-Cookie':'sid=;Path=/;Max-Age=0'})
 // ---- Webhook deposit (Pakasir). Isi body TIDAK dipercaya: status selalu dicek ulang ke gateway ----
 if(p==='hook/deposit'){
  const id=String(b.order_id||b.deposit_id||b.id||'').slice(0,80),uid=id&&await kv.get('d:'+id),u=uid&&await kv.get('u:'+uid)
  if(u){const o=u.tx.find(x=>x.type==='deposit'&&x.id===id);if(o&&o.status==='pending'){let st='pending';try{st=await depCheck(o)}catch(e){};if(await applyDep(u,o,st))await save(u)}}
  return J({ok:1})}
 // ---- Publik (tanpa login) ----

 // =====================================================================
 // QRIS GATEWAY — Public API (dipanggil aplikasi/server milik merchant).
 // Autentikasi: API key (?apikey= / X-API-Key / Bearer) + whitelist IP + HMAC opsional.
 // Semua balasan memakai bentuk {success:boolean, ...} supaya seragam & mudah dipakai.
 // =====================================================================
 if(p==='pay/receipt'||p.startsWith('pay/receipt/')){
  const id=p.slice('pay/receipt/'.length)||q.id||''
  const uid=await kv.get('payref:'+id)||await kv.get('payrcp:'+id)
  const acc=uid&&await PAY.peek(uid)
  const r=acc&&(acc.dep||[]).find(x=>x.id===id||x.ref===id)
  if(!r||!q.t||q.t!==r.tok)return J({success:false,message:'Struk tidak ditemukan'},404)
  const own=await kv.get('u:'+uid)
  return J({success:true,receipt:PAY.receiptView(r,own?mask(own.email):'')})}
 if(p.startsWith('pay/')){
  const S=(d,st=200)=>J({success:true,...d},st),F=(m,st=400)=>J({success:false,message:m},st)
  const hk=req.headers.get('x-api-key')||((req.headers.get('authorization')||'').match(/^Bearer\s+(\S+)/)||[])[1]||q.apikey||''
  const acc=await PAY.byKey(hk)
  if(!acc)return F('API Key tidak valid atau tidak ditemukan',401)
  if(!acc.on)return F('Akun gateway dibekukan. Hubungi admin.',403)
  const ip=clientIp(req)
  if((acc.ipw||[]).length&&!acc.ipw.includes(ip))return F('IP '+(ip||'tidak terdeteksi')+' tidak terdaftar di whitelist',403)
  if(acc.secret){
   const ts=req.headers.get('x-timestamp')||'',sg=req.headers.get('x-signature')||''
   if(!ts||!sg)return F('Signature wajib dikirim (X-Signature & X-Timestamp) karena API Secret aktif',401)
   if(Math.abs(Date.now()-(+ts||0))>300000)return F('X-Timestamp kedaluwarsa (selisih lebih dari 5 menit)',401)
   const raw=req.method==='POST'?JSON.stringify(b):''
   const exp=crypto.createHmac('sha256',acc.secret).update(`${req.method}\n/api/${p}\n${raw}\n${ts}`).digest('hex')
   if(exp.length!==sg.length||!crypto.timingSafeEqual(Buffer.from(exp),Buffer.from(sg)))return F('Signature tidak cocok',401)}
  // rate limit: create QRIS 5/menit, selebihnya 300/menit
  {const w=Math.floor(Date.now()/60000),tight=p==='pay/deposit/create'
   const n=await kv.incr(`rl:pay:${acc.uid}:${tight?'c':'a'}:${w}`),lim=tight?5:300
   if(n>lim)return J({success:false,message:'Rate limit terlampaui, coba lagi sebentar'},429,{'Retry-After':String(Math.max(1,(w+1)*60-Math.floor(Date.now()/1000)))})}
  const own=await kv.get('u:'+acc.uid)
  try{
   if(p==='pay/account'){const sm=PAY.summary(acc)
    return S({user:{id:acc.uid,username:own?String(own.name||'').slice(0,40):'',email:own?own.email:'',status:acc.on?'active':'suspended',
     wallet:{balance:sm.balance}},stats:{total_in:sm.all.gross,total_net:sm.all.net,total_out:sm.out.sum,pending:sm.pending}})}
   if(p==='pay/transactions'){
    const page=Math.max(1,+q.page||1),lim=Math.min(50,Math.max(1,+q.limit||10))
    let rows=[...(acc.dep||[]).map(x=>({...PAY.depView(x),type:'deposit',created:x.at})),
              ...(acc.wd||[]).map(x=>({...PAY.wdView(x),type:'withdraw',created:x.at}))]
    if(q.type)rows=rows.filter(x=>x.type===q.type)
    if(q.status)rows=rows.filter(x=>x.status===q.status)
    if(q.date_from){const t=Date.parse(q.date_from);if(!isNaN(t))rows=rows.filter(x=>x.created>=t)}
    if(q.date_to){const t=Date.parse(q.date_to)+864e5;if(!isNaN(t))rows=rows.filter(x=>x.created<t)}
    rows.sort((a,c)=>c.created-a.created)
    return S({data:rows.slice((page-1)*lim,page*lim).map(({created,...x})=>x),
     meta:{page,limit:lim,total:rows.length,totalPages:Math.ceil(rows.length/lim)||1}})}
   if(p==='pay/deposit/create'&&req.method==='POST'){
    const r=await PAY.createQris(cfg,acc.uid,b.amount,'api');return S({deposit:PAY.depView(r)})}
   if(p.startsWith('pay/deposit/check/')){
    const r=await PAY.checkQris(cfg,acc.uid,decodeURIComponent(p.slice('pay/deposit/check/'.length)))
    if(!r)return F('Transaksi tidak ditemukan',404)
    return S({status:r.status,deposit:PAY.depView(r),
     message:r.status==='paid'?'Pembayaran diterima, saldo sudah ditambahkan.':r.status==='pending'?'Menunggu pembayaran.':'Transaksi '+r.status})}
   if(p.startsWith('pay/deposit/cancel/')&&req.method==='POST'){
    const r=await PAY.cancelQris(cfg,acc.uid,decodeURIComponent(p.slice('pay/deposit/cancel/'.length)))
    return S({status:r.status,message:'QRIS berhasil dibatalkan'})}
   if(p==='pay/deposit/history'){
    const page=Math.max(1,+q.page||1),lim=Math.min(50,Math.max(1,+q.limit||10))
    let rows=(acc.dep||[]);if(q.status)rows=rows.filter(x=>x.status===q.status)
    if(q.search)rows=rows.filter(x=>x.id.includes(q.search)||String(x.ref).includes(q.search))
    return S({data:rows.slice((page-1)*lim,page*lim).map(PAY.depView),total:rows.length,page,limit:lim,pages:Math.ceil(rows.length/lim)||1})}
   if(p==='pay/withdraw/methods'){const pc=PAY.payCfg(cfg)
    return S({enabled:pc.wdOn,min:pc.wdMin,max:pc.wdMax,fee_percent:pc.wdPct,fee_flat:pc.wdFee,
     methods:PAY.wdMethodList(cfg).filter(m=>m.on).map(({code,name,type})=>({code,name,type})),
     instant:{enabled:!!(pc.wdOn&&pc.instOn!==false&&await h2hReady()),method:'DANA',fee:PAY.instFeeOf(cfg),nominals:await instNominals()}})}
   if(p==='pay/withdraw/create'&&req.method==='POST'){
    const r=await PAY.withdraw(cfg,acc.uid,b)
    if(!r.instant)notify({i:'💸',t:'Pengajuan WD gateway (API)',st:'pending',id:['ID WD',r.id],rows:[['Merchant',own?mask(own.email):acc.uid],['Tujuan',r.methodName+' · '+r.dest+' · '+r.destName],['Nominal',rp(r.nominal)],['Biaya',rp(r.fee)],['Diterima',rp(r.net)]],note:'Proses di admin > QRIS Gateway > Penarikan dana'}).catch(()=>{})
    return S({withdraw:PAY.wdView(r),status:r.status,message:PAY.wdMsg(r)},201)}
   if(p==='pay/withdraw/history'){
    const a2=await PAY.getAcc(acc.uid)
    const page=Math.max(1,+q.page||1),lim=Math.min(50,Math.max(1,+q.limit||10))
    let rows=(a2.wd||[]);if(q.status)rows=rows.filter(x=>x.status===q.status)
    return S({data:rows.slice((page-1)*lim,page*lim).map(PAY.wdView),total:rows.length,page,limit:lim,pages:Math.ceil(rows.length/lim)||1})}
   return F('Endpoint tidak ditemukan',404)}
  catch(e){return F(e.message||'Server error',400)}}
 // Gambar struk untuk notifikasi HP. Tanpa cookie, tapi wajib bertanda tangan yang benar.
 if(p==='struk/img'){
  const kind=String(q.k||''),uid=String(q.u||''),id=String(q.i||'')
  if(!kind||!uid||!id)return E('Parameter kurang',400)
  if(q.s!==await strukSign(kind,uid,id))return E('Tautan struk tidak sah',403)
  const ow=await kv.get('u:'+uid);if(!ow)return E('Tidak ditemukan',404)
  let item=null
  if(kind==='order')item=(ow.tx||[]).find(x=>x.type==='order'&&x.id===id)
  else if(kind==='deposit'){const x=(ow.tx||[]).find(y=>y.type==='deposit'&&y.id===id)
   if(x)item={order_id:x.id,amount:x.amount,total_amount:x.total,bonus:x.bonus||0,method_name:(METHODS[x.method]||METHODS.qris).name,status:x.status,createdAt:new Date(x.at).toISOString()}}
  if(!item)return E('Transaksi tidak ditemukan',404)
  const png=await strukPng(kind==='order'?{...item,orderId:item.id,phoneNumber:item.phone,createdAt:new Date(item.at).toISOString(),showOtp:true}:item,kind,new URL(req.url).host)
  if(!png)return E('Gambar struk tidak tersedia',503)
  return new Response(png,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600','Content-Length':String(png.length)}})}
 if(p==='v1/push/key')return J({key:await pushKey()})
 if(p==='v1/announcements')return J({items:(await kv.get('ann'))||[]})
 if(p==='v1/leaderboard')return J(await board())
 if(p==='v1/promo'){const now=Date.now(),b2=cfg.bonus,ws=weekStart();return J({
  bonus:{on:!!b2.on,pct:bonusPct(cfg,now),basePct:+b2.pct||0,boost:(b2.days||[]).length>0&&bonusPct(cfg,now)!==(+b2.pct||0),minAmt:b2.minAmt,max:b2.max,days:b2.days||[],dayPct:b2.dayPct},
  ref:{on:!!cfg.ref.on,referrer:cfg.ref.referrer,referee:cfg.ref.referee,minDep:cfg.ref.minDep},
  weekly:{on:!!cfg.weekly.on,metric:cfg.weekly.metric,prizes:cfg.weekly.prizes,min:cfg.weekly.min,end:ws+WEEK},
  monthly:{on:!!cfg.monthly.on,metric:cfg.monthly.metric,prizes:cfg.monthly.prizes,min:cfg.monthly.min,end:monthEnd()},
  site:{baseUrl:cfg.site.baseUrl||site(req),docsUrl:cfg.site.docsUrl||'/docs'},
  // popup yang aktif saja; isinya sudah dibersihkan saat admin menyimpan
  pops:(cfg.pops||[]).filter(x=>x&&x.on).map(x=>({id:x.id,badge:x.badge||'',title:x.title||'',body:x.body||'',img:x.img||'',theme:x.theme||'pink',mode:x.mode||'jeda',days:+x.days||0,delay:+x.delay||0,skip:x.skip||'',only:x.only||'',btns:(x.btns||[]).map(y=>({t:y.t,href:y.href||'',kind:y.kind||'go'}))})),
  cs:(()=>{const i=csInfo(cfg);return {on:!i.off,msg:i.offMsg,open:i.open,hours:i.hours}})(),
  intro:{on:cfg.intro.on!==false},
  apk:{on:!!cfg.apk.on,url:cfg.apk.url||'',ver:cfg.apk.ver||'',size:cfg.apk.size||'',note:cfg.apk.note||'',updated:+cfg.apk.updated||0}})}
 if(p.startsWith('admin/')){
  // Masuk admin lewat dua jalan: password env, atau token sekali-pakai dari pintu rahasia (ketuk n kali).
  // Token disimpan di server dengan masa berlaku, jadi yang dipegang browser bukan password aslinya.
  const key=req.headers.get('x-admin')||''
  let okAdm=!!process.env.ADMIN_PASSWORD&&key===process.env.ADMIN_PASSWORD
  if(!okAdm&&/^[a-f0-9]{32}$/.test(key)){const t=await kv.get('tmp:adm:'+key)
   if(t&&t.exp>Date.now())okAdm=true;else if(t)await kv.del('tmp:adm:'+key)}
  if(!okAdm)return E('unauthorized',401)
  const a=p.slice(6);let t=null
  if(b.email){const id=await kv.get('e:'+b.email.toLowerCase());t=id&&await kv.get('u:'+id);if(!t)return E('user tidak ada',404)}
  // ---- Kelola: daftar & hapus massal bot reseller, clean transaksi gagal + sampah web ----
  // (backup / impor / pulihkan memakai jalur backup/* yang sudah ada)
  // Tiap langkah Kelola bekerja dalam batas waktu (budget, ms) yang dikirim browser. Browser mengecilkan budget & mengulang
  // sendiri kalau server tetap kehabisan waktu (mis. paket hosting dengan batas fungsi pendek).
  const bud=x=>{const n=Math.floor(+x);return Date.now()+(n>=2000&&n<=45000?n:25000)}
  if(a==='kelola/bots'){try{return J(await KEL.listBots(b.state,bud(b.budget)))}catch(e){return E(e.message)}}
  if(a==='kelola/saldo'){try{return J(await KEL.serverBalances())}catch(e){return E(e.message)}}
  if(a==='kelola/bots/del'){
   if(b.unused!==true&&b.zero!==true&&!(Array.isArray(b.ids)&&b.ids.length))return E('Pilih bot yang mau dihapus dulu')
   try{return J(await KEL.delBots({ids:b.ids,unused:b.unused===true,zero:b.zero===true,inclMoney:b.inclMoney===true,minDays:b.minDays},bud(b.budget)))}catch(e){return E(e.message)}}
  if(a==='kelola/clean'){
   try{return J(await KEL.cleanStep(b.state,!!b.dry,bud(b.budget)))}catch(e){return E(e.message)}}
  if(a==='data'){const ids=(await kv.get('idx'))||[];const us=await kv.mget(ids.map(i=>'u:'+i));return J({cfg,servers:svList(),secSet:{WN_KEY:!!sec.WN_KEY,SMSCODE_KEY:!!sec.SMSCODE_KEY,DIBANANA_KEY:!!sec.DIBANANA_KEY,CSBOT_TOKEN:!!sec.CSBOT_TOKEN},depReady:await readiness(cfg),hook:site(req)+'/api/hook/deposit',ann:(await kv.get('ann'))||[],lb:(await kv.get('lb_manual'))||[],live:(await kv.get('live_manual'))||[],livecfg:(await kv.get('live_cfg'))||{},real:(await boardFull()).r,users:us.filter(Boolean).map(({pass,tx,mut,...x})=>({...x,trx:(tx||[]).length+(mut||[]).length}))})}
  if(a==='testnotif')return J(await notify({i:'✅',t:'Tes notifikasi berhasil',st:'ok',rows:[['Status','Terhubung'],['Tombol aktif',(cfg.buttons||[]).length]],note:'Kalau pesan ini masuk lengkap dengan tombol, notifikasi sudah siap.'}))
  if(a==='addsaldo'||a==='delsaldo'){
   const tambah=a==='addsaldo'
   const n=Math.floor(Math.abs(+b.amount||0))
   if(!(n>0))return E('Isi nominal dulu')
   if(n>50000000)return E('Nominal terlalu besar')
   if(!tambah&&(+t.balance||0)<n)return E('Saldo pengguna hanya '+rp(t.balance)+', tidak cukup untuk dikurangi')
   if(!await sekali(a+':'+t.id+':'+n))return E(DOBEL,429)
   mut(t,tambah?n:-n,tambah?'Admin tambah':'Admin kurangi');await save(t)
   await notify({i:'🛠',t:tambah?'Admin tambah saldo':'Admin kurangi saldo',st:'admin',rows:[['Pengguna',mask(t.email)],['Nominal',(tambah?'+':'-')+rp(n)],['Saldo sekarang',rp(t.balance)]]})
   return J({balance:t.balance})}
  if(a==='ban'||a==='unban'){
   // Ban ikut memblokir IP akun itu dan akun lain yang nyambung (IP/Telegram sama).
   // Kirim ip:false kalau mau membanned satu akun saja tanpa merambat.
   const r=a==='ban'?await BAN.banUser(t,{ip:b.ip!==false,reason:b.reason})
                    :await BAN.unbanUser(t)
   await notify({i:a==='ban'?'⛔':'♻️',t:'Admin '+a+' akun',st:'admin',
    rows:[['Pengguna',mask(t.email)],['IP ikut '+(a==='ban'?'diblokir':'dibuka'),(r.ips||[]).join(', ')||'-'],
     ['Akun terkait',(r.akun||[]).length?(r.akun||[]).map(x=>mask(x.email)).join(', '):'-'],
     ['Alasan',a==='ban'?String(b.reason||'').slice(0,80):'']]})
   return J({ok:1,ips:r.ips||[],akun:r.akun||[]})}
  // Pratinjau dampak ban sebelum ditekan: IP apa saja dan akun mana saja yang ikut kena.
  if(a==='ban/preview')return J(await BAN.banPreview(t))
  // Daftar IP yang sedang diblokir + buka satu IP saja
  if(a==='ban/ips')return J({items:Object.entries(await BAN.ipList()).map(([ip,d])=>({ip,...d})).sort((x,y)=>(y.at||0)-(x.at||0))})
  if(a==='ban/ip/open')return J({ok:await BAN.ipUnban(String(b.ip||''))?1:0,items:Object.entries(await BAN.ipList()).map(([ip,d])=>({ip,...d}))})
  if(a==='markup'){
   // markup umum (%), override per server ({pct,flat}), dan pembulatan ke atas. Harga baru langsung berlaku di web & API.
   const num=(v,lo,hi)=>{const x=+v;return Number.isFinite(x)?Math.min(hi,Math.max(lo,x)):null}
   if(b.percent!==undefined&&b.percent!==''){const p=num(b.percent,0,500);if(p==null)return E('Persen markup tidak valid');cfg.markup=p}
   if(b.servers&&typeof b.servers==='object'){
    const ids=new Set(svList().map(s=>s.server)),o={}
    for(const [k,v] of Object.entries(b.servers)){if(!ids.has(k)||!v||typeof v!=='object')continue
     const pct=v.pct===''||v.pct==null?null:num(v.pct,0,500),flat=Math.round(num(v.flat||0,0,1e6)||0)
     if(pct!=null||flat>0)o[k]={pct,flat}}
    cfg.mks=o}
   if(b.round!==undefined)cfg.mkRound=[0,50,100,500,1000].includes(+b.round)?+b.round:0
   await kv.set('cfg',cfg);return J(cfg)}
  if(a==='broadcast'){cfg.broadcast=b.text||'';await kv.set('cfg',cfg);await notify({i:'📢',t:'Broadcast baru',st:'info',note:cfg.broadcast});return J(cfg)}
  // ---- Integrasi (pengganti env) ----
  // ---- Detail user lengkap (halaman admin) ----
  if(a==='user/detail'){const u=await kv.get('u:'+b.id);if(!u)return E('User tidak ditemukan',404)
   const tx=u.tx||[],ords=tx.filter(x=>x.type==='order'),deps=tx.filter(x=>x.type==='deposit'),okO=ords.filter(x=>x.status==='success'),okD=deps.filter(x=>x.status==='completed')
   const {pass,tx:_t,mut:_m,apikey,hook,...rest}=u,cs=await csGet(u.id)
   return J({user:{...rest,apikeyHint:apikey?'••••'+apikey.slice(-6):'',hook:hook?{url:hook.url,on:!!hook.on,last:hook.last||null}:null},
    stats:{orders:ords.length,ordersOk:okO.length,ordersPending:ords.filter(x=>x.status==='pending').length,spent:okO.reduce((q,x)=>q+x.price,0),deposits:deps.length,depositOk:okD.length,depositSum:okD.reduce((q,x)=>q+x.amount,0),mutCount:(u.mut||[]).length,csMsgs:cs.msgs.length,csUnread:cs.au},
    orders:ords.slice(0,100).map(x=>({id:x.id,at:x.at,service:x.serviceName,country:x.countryName,phone:x.phone,price:x.price,status:x.status,otp:x.otp,server:x.server,guarantee:!!x.guarantee,refunded:!!x.refunded,via:x.via||'web'})),
    deposits:deps.slice(0,50).map(x=>({id:x.id,at:x.at,amount:x.amount,total:x.total,method:x.method,status:x.status,bonus:x.bonus||0,via:x.via||'web'})),
    mut:(u.mut||[]).slice(0,150)})}
  // ---- Pilih anggota: hapus massal. Akun bersaldo, punya order berjalan, reseller, atau admin dilewati demi keamanan ----
  if(a==='user/bulkdel'){
   const ids=[...new Set((Array.isArray(b.ids)?b.ids:[]).map(String))].slice(0,500)
   if(!ids.length)return E('Belum ada anggota yang dipilih')
   const done=[],skip=[]
   for(const id of ids){
    const u=await kv.get('u:'+id);if(!u){skip.push({id,why:'tidak ditemukan'});continue}
    if(u.isAdmin||u.admin){skip.push({id,email:u.email,why:'akun admin'});continue}
    if((+u.balance||0)>0&&!b.force){skip.push({id,email:u.email,why:'saldo masih ada'});continue}
    if((u.tx||[]).some(x=>x.type==='order'&&x.status==='pending')){skip.push({id,email:u.email,why:'ada order berjalan'});continue}
    const rs=await kv.get('rs:'+u.id);if(rs&&rs.uid&&(rs.bot||rs.balance||rs.stok||rs.sold||rs.earn)){skip.push({id,email:u.email,why:'akun reseller aktif'});continue}
    try{await removeUser(u);done.push(u.email)}catch(e){skip.push({id,email:u.email,why:'gagal dihapus'})}}
   if(done.length)await notify({i:'🗑️',t:'Hapus anggota (manual)',st:'info',note:done.length+' anggota dihapus admin'+(skip.length?', '+skip.length+' dilewati':'')})
   return J({deleted:done.length,skipped:skip})}
  if(a==='user/kick'){if(!t)return E('Isi email pengguna dulu');t.pwAt=Date.now();await save(t);return J({ok:1})}
  if(a==='user/note'){const x=await kv.get('u:'+b.id);if(!x)return E('User tidak ditemukan',404);x.note=String(b.note||'').slice(0,500);await save(x);return J({ok:1})}
  if(a==='user/tgmsg'){const x=await kv.get('u:'+b.id);if(!x)return E('User tidak ditemukan',404);if(!x.tgId)return E('User ini belum menghubungkan Telegram')
   const txt=String(b.text||'').trim().slice(0,1000);if(!txt)return E('Isi pesan dulu');const ok=await pushUser(x,'<b>📩 PESAN DARI ADMIN</b>\n━━━━━━━━━━━━━━━━━━\n'+txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));return ok?J({ok:1}):E('Gagal kirim (user memblokir bot / bot nonaktif)')}
  // ---- Bot Telegram (dibuat & dikelola admin) ----
  if(a==='bots/list'){const bots=await getBots(),n=((await kv.get('tgidx'))||[]).length
   const items=await Promise.all(bots.map(async x=>{const w=await tg(x.token,'getWebhookInfo').catch(()=>null);const r=w&&w.result||{}
    return {id:x.id,username:x.username,name:x.name,admins:x.admins||[],on:x.on!==false,at:x.at,site:x.site,hint:'••••'+x.token.slice(-6),webhook:{url:r.url||'',pending:r.pending_update_count||0,error:r.last_error_message||'',errorAt:r.last_error_date?r.last_error_date*1000:0}}}))
   const j=await kv.get('tmp:bcjob'),job=j&&await kv.get('tmp:bc:'+j)
   return J({items,users:n,site:site(req),job:job?{i:job.i,total:job.ids.length,ok:job.ok,fail:job.fail,pin:job.pin}:null})}
  if(a==='bots/add'){
   const token=String(b.token||'').trim();if(!/^\d{6,12}:[\w-]{30,}$/.test(token))return E('Format token salah. Ambil dari @BotFather, contoh 123456789:AAH...')
   const bots=await getBots();if(bots.length>=5)return E('Maksimal 5 bot')
   const me=await tg(token,'getMe');if(!me.ok)return E('Token ditolak Telegram: '+(me.description||'tidak valid'))
   if(bots.some(x=>String(x.id)===String(me.result.id)))return E('Bot ini sudah ditambahkan')
   const url=site(req);if(!/^https:\/\//.test(url))return E('Webhook Telegram wajib HTTPS. Buka admin lewat domain https:// atau isi URL situs di Integrasi.')
   const admins=[...new Set(String(b.admins||'').split(/[\s,;]+/).filter(x=>/^\d{5,}$/.test(x)))].slice(0,20)
   const bot={id:String(me.result.id),token,username:me.result.username,name:me.result.first_name,secret:rid().slice(0,32),admins,on:true,site:url,at:Date.now()}
   const r=await botSetup(bot);if(!r.ok)return E('Gagal memasang webhook: '+r.error)
   bots.push(bot);await saveBots(bots)
   await notify({i:'🤖',t:'Bot Telegram ditambahkan',st:'admin',rows:[['Bot','@'+bot.username],['Admin bot',admins.length]],note:'Bot siap dipakai. Kirim /start ke bot.'})
   return J({ok:1,username:bot.username})}
  if(a==='bots/save'){const bots=await getBots(),x=bots.find(y=>String(y.id)===String(b.id));if(!x)return E('Bot tidak ditemukan',404)
   if(b.admins!==undefined)x.admins=[...new Set(String(b.admins||'').split(/[\s,;]+/).filter(v=>/^\d{5,}$/.test(v)))].slice(0,20)
   if(b.on!==undefined)x.on=!!b.on
   await saveBots(bots)
   if(x.on===false)await tg(x.token,'deleteWebhook',{});else{const r=await botSetup(x);if(!r.ok)return E('Gagal memasang webhook: '+r.error)}
   return J({ok:1})}
  if(a==='bots/refresh'){const bots=await getBots(),x=bots.find(y=>String(y.id)===String(b.id));if(!x)return E('Bot tidak ditemukan',404)
   const url=site(req);if(!/^https:\/\//.test(url))return E('Webhook Telegram wajib HTTPS')
   x.site=url;x.secret=rid().slice(0,32);const r=await botSetup(x);if(!r.ok)return E('Gagal memasang webhook: '+r.error);await saveBots(bots);return J({ok:1,url:r.url})}
  if(a==='bots/del'){const bots=await getBots(),x=bots.find(y=>String(y.id)===String(b.id));if(!x)return E('Bot tidak ditemukan',404)
   await tg(x.token,'deleteWebhook',{});await saveBots(bots.filter(y=>y!==x));return J({ok:1})}
  if(a==='bots/test'){const bots=await getBots(),x=bots.find(y=>String(y.id)===String(b.id));if(!x)return E('Bot tidak ditemukan',404)
   if(!(x.admins||[]).length)return E('Isi ID Telegram admin dulu')
   const res=[];for(const ad of x.admins){const r=await tg(x.token,'sendMessage',{chat_id:ad,text:'<b>✅ BOT TERHUBUNG</b>\n━━━━━━━━━━━━━━━━━━\nKetik /admin untuk membuka panel admin.',parse_mode:'HTML'});res.push(ad+': '+(r.ok?'terkirim':(r.description||'gagal')))}
   return J({ok:true,info:res.join(' | ')})}
  // ---- Maintenance otomatis harian + pembersihan sampah (lib/autoclean.js) ----
  if(a==='auto/get')return J(await autoStatus())
  if(a==='auto/save'){await autoSave(b.cfg||{});return J(await autoStatus())}
  if(a==='auto/dry')return J(await autoDry(Date.now()+40000))
  if(a==='auto/run'){try{await autoRunNow(Date.now()+25000);return J(await autoStatus())}catch(e){return E(e.message)}}
  // ---- Broadcast admin ke SEMUA bot (utama, reseller tanpa modal, reseller mandiri, bot tambahan) ----
  if(a==='bcall/info')return J(await bcaInfo())
  if(a==='bcall/start'){
   let job;try{job=await bcaStart({text:b.text,photo:b.photo,pin:!!b.pin,by:0,targets:b.targets})}catch(e){return E(e.message)}
   const r=await bcaStep(job,25000);return J({ok:1,job:bcaBrief(r)})}
  if(a==='bcall/status'){const j=await bcaGet(b.id);return J({job:j?bcaBrief(j):null})}
  if(a==='bcall/cancel')return J({ok:await bcaCancel()})
  if(a==='bots/broadcast'){
   const text=String(b.text||'').trim();if(!text)return E('Isi pesan dulu')
   if(!(await getBots()).some(x=>x.on!==false))return E('Belum ada bot aktif')
   if(await kv.get('tmp:bcjob'))return E('Masih ada broadcast yang berjalan. Tunggu selesai.')
   const job=await startBroadcast({text,pin:!!b.pin,by:0});if(!job.ids.length)return E('Belum ada pengguna bot')
   const r=await bcStep(job,45000);return J({ok:1,total:r.ids.length,sent:r.ok,fail:r.fail,done:!!r.done})}
  if(a==='sec/get')return J({items:await secInfo()})
  if(a==='sec/set'){try{return J({items:await secSave(b.values||{})})}catch(e){return E(e.message)}}
  if(a==='sec/test'){const t=String(b.target||'')
   try{
    if(t==='dibanana'){const d=await dbn('/balance')
     return J({ok:true,info:'Terhubung ke Dibanana · saldo '+rp(+d.balance||0)+' '+(d.currency||'IDR')})}
    if(t==='csbot'){const sc2=await getSec();if(!sc2.CSBOT_TOKEN)return J({ok:false,info:'Token bot CS belum diisi'});const ids=csIds(sc2)
     if(!ids.length)return J({ok:false,info:'ID Telegram admin CS belum diisi'})
     const me=await csCall(sc2.CSBOT_TOKEN,'getMe');if(!me.ok)return J({ok:false,info:'Token tidak valid: '+(me.description||'')})
     const out=[];for(const id of ids){const r=await csCall(sc2.CSBOT_TOKEN,'sendMessage',{chat_id:id,parse_mode:'HTML',text:'✅ <b>Tes Bot Customer Service berhasil</b>\nChat dari pengguna web akan masuk ke sini. Reply pesan notifikasi untuk membalas.'});out.push(id+(r.ok?' ✓':' ✕ '+(r.description||'gagal')))}
     return J({ok:out.every(x=>x.endsWith('✓')),info:'@'+me.result.username+' · '+out.join(' · ')+(out.some(x=>x.includes('✕'))?' (ID belum menekan START di bot ini?)':'')})}
    if(t==='smscode'){const d=await sc('/balance')
     return J({ok:true,info:'Terhubung ke SMSCode · saldo '+rp(+((d||{}).balance)||0)+' '+((d||{}).currency||'IDR')})}
    if(t==='wn'||t==='arta'){const d=(await UPSTREAM('/api/user/profile')).data||{}
     return J({ok:true,info:'Terhubung ke WarungNokos · '+(d.username||d.email||'akun')+' · saldo '+rp(d.balance||0)})}
    if(t==='telegram'){const r=await notify({i:'✅',t:'Tes notifikasi berhasil',st:'ok',rows:[['Status','Terhubung']]});return J({ok:!!r.ok,info:r.ok?'Pesan tes terkirim ke channel':r.error})}
    if(t==='pakasir'){const s2=await getSec();if(!s2.PAKASIR_SLUG||!s2.PAKASIR_KEY)return J({ok:false,info:'Slug / API key Pakasir belum diisi'})
     const r=await fetch((s2.PAKASIR_BASE||'https://app.pakasir.com')+'/api/transactiondetail?project='+encodeURIComponent(s2.PAKASIR_SLUG)+'&amount=1000&order_id=TEST'+Date.now()+'&api_key='+encodeURIComponent(s2.PAKASIR_KEY),{cache:'no-store',signal:AbortSignal.timeout(15000)})
     return J(r.status===401||r.status===403?{ok:false,info:'Ditolak Pakasir (HTTP '+r.status+'). Cek slug & API key.'}:{ok:true,info:'Pakasir merespons (HTTP '+r.status+'), kredensial tidak ditolak. Uji sebenarnya: buat deposit kecil.'})}
    if(t==='agenh2h')return J(await h2hCheck())
    return E('target tidak dikenal')
   }catch(e){return J({ok:false,info:e.message})}}
  // ---- Deposit: rute (gateway) on/off + bobot acak, metode on/off, batas nominal ----
  // Selamatkan deposit yang terlanjur tertahan (dibuat sebelum perbaikan, atau gateway sempat
  // menjawab aneh). Menyapu SEMUA pengguna, menanyakan ulang ke gateway, dan mengkreditkan
  // yang ternyata sudah lunas. Aman diulang: kredit ganda dijaga oleh field `credited`.
  if(a==='dep/rescue'){
   const hari=Math.min(60,Math.max(1,Math.floor(+b.days)||7)),batas=Date.now()-hari*864e5
   const t0=Date.now();let dicek=0,masuk=0,total=0,after='';const hasil=[]
   for(;;){const r=await kv.scanPrefix('u:',after,100)
    for(const {v:u} of r.items){
     if(!u||!Array.isArray(u.tx))continue
     for(const o of u.tx){
      if(o.type!=='deposit'||!['pending','expired','failed'].includes(o.status))continue
      if((o.at||0)<batas){total++;continue}
      total++;if(Date.now()-t0>45000)continue
      dicek++
      try{const rr=await recheckDep(u,o)
       if(rr.changed&&o.status==='completed'){await save(u);masuk++
        hasil.push({email:mask(u.email),id:o.id,amount:o.amount})}}catch(e){}}}
    after=r.last;if(r.done)break}
   if(masuk)await notify({i:'🛟',t:'Deposit tertahan diselamatkan',st:'ok',
    rows:[['Diperiksa',dicek],['Masuk saldo',masuk],['Rentang',hari+' hari terakhir']],
    note:hasil.slice(0,10).map(x=>`${x.email} · ${rp(x.amount)}`).join('\n')})
   return J({total,dicek,masuk,hasil:hasil.slice(0,50),ms:Date.now()-t0})}
  if(a==='dep/save'){const d=b.dep||{},n=(x,lo,hi,df)=>{x=Math.floor(+x);return isNaN(x)?df:Math.min(hi,Math.max(lo,x))}
   const mn=n(d.min,500,10000000,2000),mx=n(d.max,mn,50000000,10000000)
   cfg.dep={min:mn,max:mx,engine:d.engine==='v2'?'v2':'v1',
    routes:Object.fromEntries(Object.keys(ROUTES).map(k=>[k,{on:!!((d.routes||{})[k]||{}).on,w:n(((d.routes||{})[k]||{}).w,1,100,1)}])),
    routes2:Object.fromEntries(ROUTES_V2.map(k=>[k,{on:!!((d.routes2||{})[k]||{}).on,w:1}])),
    // bot reseller tanpa modal (mesin 'rs'); kalau klien lama tidak mengirimnya, pakai nilai yang sudah tersimpan
    routes3:Object.fromEntries(ROUTES_RS.map(k=>[k,{on:d.routes3?!!((d.routes3||{})[k]||{}).on:!!(((cfg.dep||{}).routes3||{})[k]||{on:true}).on,w:1}])),
    ...((cfg.dep||{}).routes4?{routes4:cfg.dep.routes4}:{}),
    methods:Object.fromEntries(Object.keys(METHODS).map(k=>[k,{on:!!((d.methods||{})[k]||{}).on}]))}
   await kv.set('cfg',cfg);return J({dep:cfg.dep,depReady:await readiness(cfg)})}
  // ---- Server nokos: nama/lencana/deskripsi  ----
  if(a==='srv/save'){const ids=SERVERS.map(s=>s.server),o={}
   for(const id of ids){const x=(b.srv||{})[id]||{};o[id]={name:String(x.name||'').trim().slice(0,40),badge:String(x.badge||'').trim().slice(0,24),description:String(x.description||'').trim().slice(0,160)}
    for(const k of Object.keys(o[id]))if(!o[id][k])delete o[id][k]
    // label server: bebas ditambah / diubah / dihapus admin, maksimal 6 per server
    const lb=(Array.isArray(x.labels)?x.labels:[]).map(y=>({t:String((y||{}).t||'').trim().slice(0,18),c:LBC.includes((y||{}).c)?y.c:'blue'})).filter(y=>y.t).slice(0,6)
    if(lb.length)o[id].labels=lb}
   // negara yang dipindai Dibanana per server (1=ekonomi, 2=premium, 3=khusus, 4=wa_luar), kode ISO-2 mis. id,my,sg
   const dc={};for(let i=1;i<=4;i++){const v=String(((b.dbn||{}).countries||{})[i]||'').split(',').map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]/g,'')).filter(Boolean).slice(0,100);if(v.length)dc[i]=v.join(',')}
   cfg.dbn={countries:dc}
   cfg.srv=o
   // negara yang dipindai untuk daftar layanan WarungNokos Server 2
   cfg.wn={countries:String((b.wn||{}).countries||'').split(',').map(x=>x.trim().replace(/[^A-Za-z0-9 _-]/g,'')).filter(Boolean).slice(0,30).join(','),
    max:Math.min(30,Math.max(1,Math.floor(+(b.wn||{}).max)||10))}
   await kv.set('cfg',cfg);return J({srv:cfg.srv,wn:cfg.wn,dbn:cfg.dbn,servers:svList()})}
  if(a==='maint/save'){
   const m=b.maint||{},clip=(x,n)=>String(x||'').trim().slice(0,n),o={on:!!m.on,mode:m.mode==='soft'?'soft':'full',msg:clip(m.msg,300),srv:{}}
   for(const id of SERVERS.map(x=>x.server)){const x=(m.srv||{})[id];if(x&&(x.on||x.msg))o.srv[id]={on:!!x.on,msg:clip(x.msg,200)}}
   const was=cfg.maint||{};cfg.maint=o;await kv.set('cfg',cfg)
   const nOn=Object.values(o.srv).filter(x=>x.on).length
   if(!!was.on!==o.on||nOn!==Object.values(was.srv||{}).filter(x=>x.on).length)await notify({i:'🛠',t:o.on?'Maintenance situs AKTIF':'Maintenance dinonaktifkan',st:'admin',rows:[['Seluruh situs',o.on?'Aktif ('+(o.mode==='soft'?'banner':'layar penuh')+')':'Mati'],['Server maintenance',nOn]],note:o.msg||''})
   return J({maint:cfg.maint})}
  // ---- Popup promosi: simpan seluruh daftar (tambah / ubah / hapus / tombol / gambar) ----
  if(a==='pop/save'){
   const arr=Array.isArray(b.pops)?b.pops:[]
   if(arr.length>12)return E('Maksimal 12 popup')
   const cl=(x,n)=>String(x==null?'':x).trim().slice(0,n)
   const out=[]
   for(const x of arr){
    const img=cl(x.img,400000)
    if(img&&!okImg(img))return E('Gambar popup tidak valid atau terlalu besar (maks ~280KB, JPEG/PNG/WebP)')
    const t=cl(x.title,70)
    if(!t)return E('Judul popup wajib diisi')
    out.push({id:cl(x.id,24)||rid().slice(0,10),on:x.on!==false,badge:cl(x.badge,16),title:t,
     body:cl(x.body,900),img,theme:POPT.includes(x.theme)?x.theme:'pink',
     mode:['jeda','buka','selalu'].includes(x.mode)?x.mode:'jeda',
     days:Math.min(90,Math.max(0,Math.floor(+x.days||0))),delay:Math.min(30,Math.max(0,+x.delay||0)),
     skip:cl(x.skip,200),only:cl(x.only,200),
     btns:(Array.isArray(x.btns)?x.btns:[]).map(y=>({t:cl((y||{}).t,30),href:cl((y||{}).href,300),kind:(y||{}).kind==='no'?'no':'go'})).filter(y=>y.t).slice(0,4)})}
   cfg.pops=out;await kv.set('cfg',cfg);return J({pops:cfg.pops})}
  // ---- Animasi pembuka: saklar on/off ----
  if(a==='intro/save'){cfg.intro={on:b.on!==false};await kv.set('cfg',cfg);return J({intro:cfg.intro})}
  // ---- Aplikasi APK ----
  if(a==='apk/save'){
   const u2=String(b.url||'').trim()
   if(b.on&&!/^https?:\/\/\S+$/.test(u2)&&!u2.startsWith('/'))return E('Isi tautan APK yang benar (http/https) atau matikan dulu')
   cfg.apk={on:!!b.on,url:u2.slice(0,400),ver:String(b.ver||'').trim().slice(0,20),size:String(b.size||'').trim().slice(0,20),
    note:String(b.note||'').trim().slice(0,600),updated:Date.now()}
   await kv.set('cfg',cfg);return J({apk:cfg.apk})}
  // ---- Saklar customer service (+ alasan kalau dimatikan) ----
  if(a==='cs/mode'){
   const on=b.on!==false,msg=String(b.msg||'').trim().slice(0,300),ai=!!b.ai
   if(!on&&!msg)return E('Isi dulu alasan kenapa CS dimatikan, supaya pengguna tahu')
   if(on&&ai&&!(await getSec()).NEOXR_KEY)return E('Isi API key Neoxr dulu di menu Integrasi > Nona AI, baru Mode CS 2 bisa dinyalakan')
   cfg.cs={...cfg.cs,on,msg,ai};await kv.set('cfg',cfg)
   await notify({i:on?'💬':'🚫',t:on?(ai?'Mode CS 2 (Nona AI) DINYALAKAN':'Customer service DIBUKA'):'Customer service DIMATIKAN',st:'admin',rows:[['Status',on?(ai?'Aktif · Nona Cantikan (AI) menjawab otomatis 24 jam':'Aktif (ikut jam layanan)'):'Mati'],['Alasan',msg]]})
   return J({cs:cfg.cs})}
  // Latih AI: nama CS, gaya bicara, catatan, dan daftar "kalau ditanya X jawab Y"
  if(a==='cs/ai/save'){
   let v;try{v=cleanTrain(b)}catch(e){return E(e.message)}
   const was=csName(cfg);cfg.cs={...cfg.cs,...v};await kv.set('cfg',cfg)
   await notify({i:'🧠',t:'Pelatihan AI customer service diperbarui',st:'admin',rows:[['Nama CS',v.name+(was!==v.name?' (dulu '+was+')':'')],['Latihan',v.train.length+' contoh'],['Catatan',v.notes?v.notes.length+' karakter':'-']]}).catch(()=>{})
   return J({cs:cfg.cs})}
  // Tes cepat AI dari admin (tidak menyimpan chat). Boleh membawa draf latihan yang belum disimpan.
  if(a==='cs/ai/test'){
   try{const dr=b.draft?cleanTrain(b.draft):{},tc={...cfg,cs:{...cfg.cs,...dr}}
    const r=await askNona({u:{name:'Tester',balance:12500,joinedAt:new Date().toISOString(),tx:[],mut:[]},cfg:tc,msgs:[],text:String(b.text||'Halo, cara deposit gimana?').slice(0,300),hadImg:false})
    return J({ok:1,text:r.text,esc:r.esc,used:r.used||0,name:csName(tc)})}catch(e){return E(e.message)}}
  if(a==='server'){cfg.off=b.on?cfg.off.filter(s=>s!==b.server):[...new Set([...cfg.off,b.server])];await kv.set('cfg',cfg);return J(cfg)}
  // Tombol link di bawah notifikasi channel
  if(a==='buttons'){cfg.buttons=(Array.isArray(b.buttons)?b.buttons:[]).map(x=>({text:String(x.text||'').slice(0,40),url:String(x.url||'').trim()})).filter(x=>x.text&&/^https?:\/\//.test(x.url)).slice(0,6);await kv.set('cfg',cfg);return J(cfg)}
  // Beranda: angka Pengguna & OTP sukses (kosong = otomatis) + data manual leaderboard (tambah / ubah / hapus)
  if(a==='stats'){const f=x=>{x=String(x??'').trim();return x===''?'':/^\d{1,9}$/.test(x)?String(+x):null},u=f(b.users),o=f(b.orders)
   if(u===null||o===null)return E('Isi angka bulat 0 atau lebih, atau kosongkan untuk memakai angka asli')
   cfg.stats={users:u,orders:o};await kv.set('cfg',cfg);globalThis.__lb=null;return J(cfg.stats)}
  if(a==='lb/add'){const v=lbClean(b);if(v.error)return E(v.error);const l=(await kv.get('lb_manual'))||[];if(l.length>=50)return E('Maksimal 50 data manual')
   l.push({id:rid().slice(0,10),...v.data});await kv.set('lb_manual',l);globalThis.__lb=null;return J({items:l})}
  if(a==='lb/edit'){const v=lbClean(b);if(v.error)return E(v.error);const l=(await kv.get('lb_manual'))||[],i=l.findIndex(x=>x.id===b.id);if(i<0)return E('Data tidak ditemukan',404)
   l[i]={...l[i],...v.data};await kv.set('lb_manual',l);globalThis.__lb=null;return J({items:l})}
  if(a==='lb/del'){const l=((await kv.get('lb_manual'))||[]).filter(x=>x.id!==b.id);await kv.set('lb_manual',l);globalThis.__lb=null;return J({items:l})}
  // ---- Live transaksi: data manual + angka tambahan (kv "live_manual" & "live_cfg") ----
  if(a==='live/add'||a==='live/edit'){
   const nm=String(b.name||'').trim().slice(0,60),sv=String(b.service||'').trim().slice(0,40)
   if(!nm)return E('Isi nama dulu');if(!sv)return E('Isi layanan dulu (mis. WhatsApp)')
   const n=x=>Math.min(1e12,Math.max(0,Math.floor(+x||0))),st=['proses','sukses','batal'].includes(b.st)?b.st:'sukses'
   const v={name:nm,service:sv,country:String(b.country||'').trim().slice(0,30),price:n(b.price),st}
   const l=(await kv.get('live_manual'))||[]
   if(a==='live/add'){if(l.length>=60)return E('Maksimal 60 data manual, hapus yang lama dulu');l.push({id:rid().slice(0,10),...v,at:Date.now()})}
   else{const i=l.findIndex(x=>x.id===b.id);if(i<0)return E('Data tidak ditemukan',404);l[i]={...l[i],...v}}
   await kv.set('live_manual',l);feedBust();return J({items:l})}
  if(a==='live/del'){const l=((await kv.get('live_manual'))||[]).filter(x=>x.id!==b.id);await kv.set('live_manual',l);feedBust();return J({items:l})}
  if(a==='live/num'){const n=x=>x===''||x==null?0:Math.min(1e9,Math.max(0,Math.floor(+x||0)))
   const c={trx:n(b.trx),proses:n(b.proses),sukses:n(b.sukses)};await kv.set('live_cfg',c);feedBust();return J({cfg:c})}
  // Pengumuman
  if(a==='ann/add'){
   const title=String(b.title||'').trim().slice(0,120),body=String(b.body||'').trim().slice(0,3000);if(!title)return E('Judul wajib diisi')
   let img='';if(b.img){img=String(b.img);if(!/^data:image\/(jpeg|png|webp|gif);base64,/.test(img))return E('Format gambar tidak valid');if(img.length>700000)return E('Gambar terlalu besar (maks ~500KB)')}
   const ann=(await kv.get('ann'))||[];ann.unshift({id:rid().slice(0,10),title,body,img,at:Date.now()});await kv.set('ann',ann.slice(0,50))
   await notify({i:'📣',t:'Pengumuman baru: '+title,st:'info',note:body.slice(0,300)});return J({items:ann})}
  if(a==='ann/del'){const ann=((await kv.get('ann'))||[]).filter(x=>x.id!==b.id);await kv.set('ann',ann);return J({items:ann})}
  // Customer service (sisi admin)
  if(a==='cs/list'){const ix=(await kv.get('csidx'))||[];const th=await Promise.all(ix.map(async id=>{const u=await kv.get('u:'+id),c=await csGet(id);return u&&{uid:id,email:u.email,name:u.name,unread:c.au,esc:!!c.esc,at:c.at,last:((c.msgs[c.msgs.length-1]||{}).text||'')||((c.msgs[c.msgs.length-1]||{}).img?'📷 Foto':'')}}));return J({items:th.filter(Boolean).sort((x,y)=>y.at-x.at)})}
  if(a==='cs/thread'){const c=await csGet(b.uid);c.au=0;await kv.set('cs:'+b.uid,c)
   // ikut kirim data pengguna supaya admin bisa lihat saldo & ubah saldo tanpa pindah tab
   const x=await kv.get('u:'+b.uid)
   const ok=x?(x.tx||[]).filter(y=>y.type==='order'&&y.status==='success'):[]
   return J({msgs:c.msgs,user:x?{uid:x.id,email:x.email,name:x.name,balance:x.balance,banned:!!x.banned,
    tg:!!x.tgId,orders:ok.length,spent:ok.reduce((q,y)=>q+y.price,0),joinedAt:x.joinedAt,
    pending:(x.tx||[]).filter(y=>y.status==='pending').length}:null})}
  // Ubah saldo LANGSUNG dari ruang chat CS, sekalian (opsional) memberi tahu pengguna di chat itu juga.
  if(a==='cs/saldo'){
   const x=await kv.get('u:'+b.uid);if(!x)return E('Pengguna tidak ditemukan',404)
   const n=Math.floor(Math.abs(+b.amount||0));if(!(n>0))return E('Isi nominal dulu')
   if(n>50000000)return E('Nominal terlalu besar')
   const tambah=b.kind!=='del'
   if(!tambah&&x.balance<n)return E('Saldo pengguna hanya '+rp(x.balance)+', tidak cukup untuk dikurangi')
   const ket=String(b.note||'').trim().slice(0,60)
   if(!await sekali('cssaldo:'+x.id+':'+(tambah?'+':'-')+n))return E(DOBEL,429)
   mut(x,tambah?n:-n,(tambah?'Admin tambah':'Admin kurangi')+(ket?' · '+ket:''))
   await save(x)
   let c=await csGet(b.uid)
   if(b.tell!==false){
    const teks=(tambah?'✅ Saldo kamu sudah ditambah '+rp(n):'ℹ️ Saldo kamu dikurangi '+rp(n))
     +(ket?' ('+ket+')':'')+'. Saldo sekarang '+rp(x.balance)+'.'
    c=await csPush(x,'admin',teks,'')}
   await notify({i:'🛠',t:tambah?'Admin tambah saldo (lewat chat CS)':'Admin kurangi saldo (lewat chat CS)',st:'admin',
    rows:[['Pengguna',mask(x.email)],['Nominal',(tambah?'+':'-')+rp(n)],['Keterangan',ket],['Saldo sekarang',rp(x.balance)]]})
   return J({ok:1,balance:x.balance,msgs:c.msgs})}
  if(a==='cs/reply'){const u=await kv.get('u:'+b.uid),text=String(b.text||'').trim().slice(0,1000);if(b.img&&!okImg(b.img))return E('Foto tidak valid / terlalu besar');if(!u||(!text&&!b.img))return E('Data tidak valid');const c=await csPush(u,'admin',text,b.img);c.au=0;await kv.set('cs:'+u.id,c);return J({msgs:c.msgs})}
  // ---- Promo: referral, bonus deposit, hadiah mingguan ----
  if(a==='promo'){
   const n=x=>Math.max(0,Math.floor(+x||0)),r=b.ref||{},bo=b.bonus||{},w=b.weekly||{},mo=b.monthly||{},wasOff=!cfg.weekly.on,moOff=!cfg.monthly.on
   cfg.welcome={on:!!(b.welcome||{}).on,amt:Math.min(100000,n((b.welcome||{}).amt))}
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
  if(a==='tap/save'){const t=b.tap||{}
   const em=String(t.emails||'').split(/[\s,;]+/).map(x=>x.toLowerCase().trim()).filter(x=>/^\S+@\S+\.\S+$/.test(x)).slice(0,20)
   cfg.tap={on:!!t.on,n:Math.min(100,Math.max(3,Math.floor(+t.n)||20)),emails:em}
   await kv.set('cfg',cfg);return J({tap:cfg.tap})}
  if(a==='backup/status')return J({meta:(await kv.get('bk:meta'))||null,chat:!!sec.BACKUP_CHAT_ID,token:!!sec.TELEGRAM_BOT_TOKEN,cfg:cfg.backup,stats:await userStats().catch(()=>null),isi:await bkContents().catch(()=>null)})
  if(a==='backup/users')return J(await usersPage(b.after||''))
  if(a==='backup/reindex')return J(await reindexUsers(true))
  if(a==='backup/now')return J(await runBackup('manual'))
  if(a==='backup/cfg'){cfg.backup={on:!!b.on,hours:Math.min(720,Math.max(1,Math.floor(+b.hours)||24))};await kv.set('cfg',cfg);return J(cfg.backup)}
  if(a==='backup/page')return J(await backupPage(b.cursor))
  // safety:false = lewati backup pengaman (browser sudah memintanya terpisah lewat backup/now, supaya satu panggilan tidak kehabisan waktu)
  if(a==='backup/wipe'){if(b.confirm!=='HAPUS')return E('Konfirmasi salah');let sf=null;if(b.safety!==false){try{sf=(await runBackup('manual')).ok}catch(e){}}await wipeAll();return J({ok:1,safety:sf})}
  if(a==='backup/import'){try{return J({n:await importItems(b.items)})}catch(e){return E(e.message)}}
  // ---- Notifikasi HP admin (Web Push). Tetap bunyi walau Chrome ditutup. ----
  // ---- Ringkasan uang (tab Ringkasan admin). Dipindai dari semua pengguna, di-cache 60 detik. ----
  if(a==='uang'){
   const c=globalThis.__uang;if(c&&Date.now()-c.t<60000&&!b.fresh)return J(c.d)
   const ids=(await kv.get('idx'))||[]
   const us=(await kv.mget(ids.map(i=>'u:'+i))).filter(Boolean)
   const DAY=864e5,now=Date.now()
   // batas awal hari ini menurut WIB (UTC+7)
   const wibMid=(()=>{const w=new Date(now+7*36e5);return Date.UTC(w.getUTCFullYear(),w.getUTCMonth(),w.getUTCDate())-7*36e5})()
   const Z=()=>({omzet:0,modal:0,laba:0,trx:0,dep:0,depN:0,bonus:0,gagal:0,refund:0})
   const per={hari:Z(),minggu:Z(),bulan:Z(),semua:Z()}
   const days=[...Array(7)].map((_,i)=>({at:wibMid-(6-i)*DAY,omzet:0,modal:0,laba:0,trx:0}))
   let saldo=0,pending=0,userBaru=0
   for(const u of us){
    saldo+=+u.balance||0
    if(u.joinedAt&&Date.parse(u.joinedAt)>=wibMid)userBaru++
    for(const x of (u.tx||[])){
     const t=+x.at||0,buckets=[per.semua]
     if(t>=wibMid)buckets.push(per.hari)
     if(t>=now-7*DAY)buckets.push(per.minggu)
     if(t>=now-30*DAY)buckets.push(per.bulan)
     if(x.type==='order'){
      if(x.status==='success'){const jual=+x.price||0,modal=+x.cost||0
       for(const g of buckets){g.omzet+=jual;g.modal+=modal;g.laba+=jual-modal;g.trx++}
       const d=days.find(y=>t>=y.at&&t<y.at+DAY)
       if(d){d.omzet+=jual;d.modal+=modal;d.laba+=jual-modal;d.trx++}}
      else if(x.status==='pending')pending++
      else for(const g of buckets){g.gagal++;if(x.refunded)g.refund+=+x.price||0}}
     else if(x.type==='deposit'&&x.status==='completed')
      for(const g of buckets){g.dep+=+x.amount||0;g.depN++;g.bonus+=(+x.bonus||0)+(+x.refBonus||0)}}}
   // laba gateway QRIS (produk terpisah)
   let gw=0;try{const gids=(await kv.get('payidx'))||[]
    for(const acc of (await Promise.all(gids.map(i=>PAY.peek(i)))).filter(Boolean))gw+=PAY.summary(acc).all.fee}catch(e){}
   const d={per,days,saldo,pending,userBaru,users:us.length,gatewayLaba:gw,at:Date.now()}
   globalThis.__uang={t:Date.now(),d};return J(d)}
  // ---- QRIS Gateway (admin) ----
  if(a==='pay/data'){
   const ids=(await kv.get('payidx'))||[]
   const accs=(await Promise.all(ids.map(i=>PAY.peek(i)))).filter(Boolean)
   const own=await Promise.all(accs.map(x=>kv.get('u:'+x.uid)))
   const tot=accs.reduce((o,x)=>{const sm=PAY.summary(x)
    o.saldo+=sm.balance;o.masuk+=sm.all.gross;o.laba+=sm.all.fee;o.keluar+=sm.out.sum;o.trx+=sm.all.count;return o},{saldo:0,masuk:0,laba:0,keluar:0,trx:0})
   return J({cfg:PAY.payCfg(cfg),methods:PAY.wdMethodList(cfg),total:tot,smp:{ok:await smpReady()},h2h:await (async()=>{
     return {ok:await h2hReady(),report:site(req)+'/api/agenh2h/callback',log:((await kv.get('h2hlog'))||[]).slice(0,10)}})(),wd:await PAY.adminWdList(),
    merchants:accs.map((x,i)=>{const sm=PAY.summary(x),o=own[i]
     return {uid:x.uid,email:o?mask(o.email):'(terhapus)',name:o?o.name:'',on:x.on,balance:sm.balance,
      trx:sm.all.count,gross:sm.all.gross,fee:sm.all.fee,out:sm.out.sum,pending:sm.pending,at:x.at}})
     .sort((x,y)=>y.gross-x.gross)})}
  if(a==='pay/save'){const n=(x,lo,hi,df)=>{x=+x;return isNaN(x)?df:Math.min(hi,Math.max(lo,x))}
   const v=b.pay||{}
   const wm={};for(const m of PAY.WD_METHODS)wm[m.code]=(v.wdMethods||{})[m.code]!==false
   const wdMin=Math.floor(n(v.wdMin,1000,10000000,5000)),wdMax=Math.floor(n(v.wdMax,1000,100000000,10000000))
   if(wdMax<wdMin)return E('Tarik dana maksimal harus lebih besar dari minimal')
   cfg.pay={...PAY.payCfg(cfg),on:!!v.on,wdOn:!!v.wdOn,name:String(v.name||'Artapedia Pay').slice(0,40),
    fee:n(v.fee,0,50,2),feeFlat:Math.floor(n(v.feeFlat,0,100000,0)),
    min:Math.floor(n(v.min,500,10000000,1000)),max:Math.floor(n(v.max,1000,100000000,10000000)),
    wdMin,wdMax,wdPct:n(v.wdPct,0,50,3),wdFee:Math.floor(n(v.wdFee,0,100000,0)),instOn:v.instOn!==false,instFee:Math.floor(n(v.instFee,0,100000,2000)),wdMethods:wm,v2:true}
   await kv.set('cfg',cfg);return J({pay:cfg.pay})}
  // ---- Admin proses penarikan dana manual: acc / tolak ----
  if(a==='pay/wd'){
   const id=String(b.id||''),act=b.act==='ok'?'ok':'no';if(!id)return E('ID penarikan kosong')
   if(!await sekali('paywd:'+id+':'+act))return E(DOBEL,429)
   try{const r=await PAY.adminWdAct(id,act,b.note)
    const o=await kv.get('u:'+r.uid)
    await notify({i:act==='ok'?'✅':'❌',t:act==='ok'?'WD gateway disetujui':'WD gateway ditolak',st:act==='ok'?'ok':'fail',id:['ID WD',r.w.id],
     rows:[['Merchant',o?mask(o.email):r.uid],['Tujuan',r.w.methodName+' · '+r.w.dest],['Nominal',rp(r.w.nominal)],['Diterima',rp(r.w.net)]],note:act==='ok'?'':'Saldo dikembalikan ke merchant'})
    return J({ok:1,status:r.w.status,wd:await PAY.adminWdList()})}catch(e){return E(e.message)}}
  if(a==='pay/toggle'){const r=await PAY.setOn(b.uid,!!b.on);return J({ok:1,on:r.a.on})}
  // ---- Admin ubah saldo QRIS Gateway merchant ----
  if(a==='pay/saldo'){
   const uid=String(b.uid||'');if(!uid)return E('Pilih merchant dulu')
   const n=Math.floor(Math.abs(+b.amount||0));if(!n)return E('Nominal harus lebih dari 0')
   const delta=b.kind==='del'?-n:n
   if(!await sekali('paysaldo:'+uid+':'+delta))return E(DOBEL,429)
   try{const acc=await PAY.adminSaldo(uid,delta,b.note||(delta>0?'Admin tambah saldo':'Admin kurangi saldo'))
    const o=await kv.get('u:'+uid)
    await notify({i:'🛠',t:delta>0?'Admin tambah saldo gateway':'Admin kurangi saldo gateway',st:'admin',
     rows:[['Merchant',o?mask(o.email):uid],['Nominal',(delta>0?'+':'-')+rp(n)],['Saldo sekarang',rp(acc.balance)],['Catatan',String(b.note||'')]]})
    return J({ok:1,balance:acc.balance})}catch(e){return E(e.message)}}
  if(a==='pay/test')return J({ok:await smpReady(),error:(await smpReady())?'':'SMP Payment belum diisi (SMP_QRIS + SMP_SECRET)'})
  // ---- Gateway SMP (khusus admin): API key developer, tagihan QRIS SMP, webhook, dokumentasi ----
  // Di sini sudah lolos pemeriksaan admin di atas. Logikanya ada di lib/agwadmin.js.
  if(a.startsWith('agw/')){const r=await AGWA.handle(a.slice(4),b,{site:site(req)});return J(r.body,r.status)}
  // ---- Admin: webhook SMSCode (OTP masuk seketika, tanpa menunggu sapuan cron) ----
  // SMSCode mengirim order.otp_received / completed / expired / canceled ke alamat kita.
  // Isi kirimannya tidak dipercaya: dipakai hanya sebagai pemicu, statusnya ditanya ulang.
  if(a==='smscode/hook'){
   const url=site(req)+'/api/hook/smscode'
   const act=String(b.act||'status')
   try{
    if(act==='on'){
     if(!/^https:\/\//.test(url))return E('Webhook wajib HTTPS. Buka admin lewat domain https:// atau isi URL situs di Integrasi.')
     const r=await sc('/webhook',{method:'PATCH',body:{webhook_url:url}})
     const rahasia=String((r||{}).webhook_secret||'')
     if(rahasia)await secSave({SMSCODE_HOOK_SECRET:rahasia})
     return J({ok:1,url:(r||{}).webhook_url||url,secret:!!rahasia,pasang:1})}
    if(act==='off'){
     await sc('/webhook',{method:'PATCH',body:{webhook_url:''}})
     await secSave({SMSCODE_HOOK_SECRET:''})
     return J({ok:1,url:'',secret:false,mati:1})}
    if(act==='test'){
     const r=await sc('/webhook/test',{method:'POST'})
     return J({ok:1,status:(r||{}).status_code})}
    const r=await sc('/webhook')
    return J({ok:1,url:(r||{}).webhook_url||'',secret:!!sec.SMSCODE_HOOK_SECRET,milik:((r||{}).webhook_url||'')===url,harus:url})}
   catch(e){return E(e.message)}}
  // ---- Admin: webhook bot Customer Service (chat web <-> Telegram) ----
  if(a==='csbot/hook'){
   const url=site(req)+'/api/hook/csbot',act=String(b.act||'status'),tok=sec.CSBOT_TOKEN
   if(!tok)return E('Isi token bot Customer Service dulu, simpan, lalu pasang webhook')
   try{
    if(act==='on'){
     if(!/^https:\/\//.test(url))return E('Webhook wajib HTTPS. Buka admin lewat domain https:// atau isi URL situs di Integrasi.')
     // jangan menimpa webhook bot jualan: token harus beda dari semua bot yang terdaftar & bot notifikasi
     if((await getBots()).some(x=>x.token===tok)||tok===sec.TELEGRAM_BOT_TOKEN)return E('Token ini sudah dipakai bot lain di situs. Buat bot BARU di @BotFather khusus Customer Service.')
     const rahasia=crypto.randomBytes(24).toString('hex')
     const r=await csbotSetup(tok,url,rahasia);if(!r.ok)return E(r.error)
     await secSave({CSBOT_HOOK_SECRET:rahasia})
     return J({ok:1,url,username:r.username,secret:true,milik:true,harus:url})}
    if(act==='off'){await csCall(tok,'deleteWebhook',{drop_pending_updates:false});await secSave({CSBOT_HOOK_SECRET:''});return J({ok:1,url:'',secret:false,mati:1})}
    const w=await csCall(tok,'getWebhookInfo'),me=await csCall(tok,'getMe')
    if(!w.ok)return E('Token tidak valid: '+(w.description||''))
    const wu=(w.result||{}).url||''
    return J({ok:1,url:wu,username:me.ok?me.result.username:'',secret:!!sec.CSBOT_HOOK_SECRET,milik:wu===url,harus:url,pending:(w.result||{}).pending_update_count||0,err:(w.result||{}).last_error_message||'',ready:csbotReady(sec)})}
   catch(e){return E(e.message)}}
  // ---- Admin: semua transaksi pembelian nokos ----
  // Dipindai langsung dari seluruh pengguna (termasuk pelanggan bot reseller) supaya
  // admin tidak perlu membuka akun satu per satu. Ringkasan jumlah selalu dihitung dari
  // SEMUA order, bukan hanya yang lolos saringan.
  if(a==='orders'){
   const stF=String(b.status||'all'),q=String(b.q||'').trim().toLowerCase()
   const svF=String(b.server||''),lim=Math.min(300,Math.floor(+b.limit)||120)
   const norm=v=>{const x=String(v||'').toLowerCase();return x==='canceled'?'cancelled':x}
   const stat={pending:0,success:0,expired:0,cancelled:0,failed:0,total:0,omzet:0,modal:0,refund:0}
   const out=[];const rsUid=new Set()
   let after='',pengguna=0
   for(;;){
    const r=await kv.scanPrefix('u:',after,200)
    for(const {v:u} of r.items){
     if(!u||!u.id)continue
     pengguna++
     for(const o of (u.tx||[])){
      if(o.type!=='order')continue
      const st=norm(o.status)
      stat.total++;if(stat[st]!=null)stat[st]++
      if(st==='success'){stat.omzet+=+o.price||0;stat.modal+=+o.cost||0}
      if(o.refunded)stat.refund+=+o.price||0
      if(stF!=='all'&&st!==stF)continue
      if(svF&&o.server!==svF)continue
      if(q&&![o.id,o.phone,o.serviceName,o.countryName,u.email,u.name,u.tgUser,u.tgId].some(v=>String(v||'').toLowerCase().includes(q)))continue
      if(u.rs)rsUid.add(u.rs)
      out.push({id:o.id,at:o.at,status:st,server:o.server,serviceName:o.serviceName,countryName:o.countryName||'',
       phone:o.phone,price:+o.price||0,cost:+o.cost||0,fee:+o.fee||0,guarantee:!!o.guarantee,otp:o.otp||'',
       refunded:!!o.refunded,replaced:!!o.replaced,cancelQueued:!!o.cancelReq,expiredAt:o.expiredAt||0,late:isLate(o),
       via:o.via||'web',uid:u.id,email:u.email||'',name:u.name||'',tgUser:u.tgUser||'',tgId:u.tgId||'',rs:u.rs||''})}}
    after=r.last;if(r.done)break}
   out.sort((x,y)=>(y.at||0)-(x.at||0))
   // nama toko reseller diambil sekali per toko, bukan per baris
   const toko={}
   for(const uid of rsUid){try{const rr=await kv.get('rs:'+uid);if(rr)toko[uid]=rr.brand||''}catch(e){}}
   return J({items:out.slice(0,lim).map(x=>({...x,brand:x.rs?(toko[x.rs]||'(toko)'):''})),
    cocok:out.length,stat,pengguna,servers:SERVERS.map(x=>({server:x.server,name:x.name}))})}
  // Segarkan satu order: tanya status terbaru ke penyedia (OTP bisa saja sudah masuk).
  if(a==='orders/check'){
   const u=await kv.get('u:'+String(b.uid||''));if(!u)return E('Pengguna tidak ditemukan',404)
   const o=(u.tx||[]).find(x=>x.type==='order'&&x.id===String(b.id||''));if(!o)return E('Order tidak ditemukan',404)
   if(o.status!=='pending')return J({ok:1,status:o.status,otp:o.otp||''})
   if(!P[o.server])return E('Server order ini sudah tidak tersedia',503)
   try{const st=await P[o.server].status(o.id)
    if(st.otp){o.status='success';o.otp=st.otp;o.msg=st.msg;await fireOtp(u,o);await save(u)
     return J({ok:1,status:'success',otp:o.otp})}
    if(['expired','cancelled','canceled'].includes(st.state)||Date.now()>o.expiredAt){
     o.status='expired';if(await refund(u,o))await unwindRs(u,o);await save(u)
     return J({ok:1,status:'expired',refund:o.price})}
    if(o.cancelReq)await retryCancel(u,o)
    await save(u)
    return J({ok:1,status:o.status,otp:o.otp||''})}
   catch(e){
    if(await expireIfLate(u,o,e.message)){await save(u);return J({ok:1,status:'expired',refund:o.price,late:true})}
    return E('Gagal menanyakan status ke penyedia: '+e.message+(o.expiredAt?' · batas tunggu '+wibAt(o.expiredAt):''),502)}}
  // Bereskan SEMUA order yang menggantung: sudah lewat batas tunggu tapi masih "menunggu".
  // Dipakai untuk membereskan sisa-sisa order yang dulu tertahan karena penyedia error.
  if(a==='orders/sweep'){
   if(!await sekali('ordsweep',5000))return E(DOBEL,429)
   let after='',beres=0,balik=0,otp=0,sisa=0
   const t0=Date.now()
   for(;;){
    const r=await kv.scanPrefix('u:',after,200)
    for(const {v:u0} of r.items){
     if(!u0||!u0.id)continue
     const pend=(u0.tx||[]).filter(x=>x.type==='order'&&x.status==='pending'&&isLate(x))
     if(!pend.length)continue
     const u=await kv.get('u:'+u0.id);if(!u)continue
     for(const o of (u.tx||[]).filter(x=>x.type==='order'&&x.status==='pending'&&isLate(x))){
      if(Date.now()-t0>40000){sisa++;continue}
      // OTP bisa saja sudah masuk tapi belum sempat tercatat: itu diselesaikan dulu
      try{const st=P[o.server]&&await P[o.server].status(o.id)
       if(st&&st.otp){o.status='success';o.otp=st.otp;o.msg=st.msg;await fireOtp(u,o);await save(u);otp++;continue}}catch(e){}
      const sebelum=+u.balance||0
      if(await expireIfLate(u,o,'dibereskan admin')){beres++;balik+=Math.max(0,(+u.balance||0)-sebelum)}}
     await save(u)}
    after=r.last;if(r.done||Date.now()-t0>45000)break}
   if(beres||otp)await notify({i:'🧹',t:'Order menggantung dibereskan admin',st:'admin',
    rows:[['Dikembalikan',String(beres)+' order'],['Total refund',rp(balik)],['Ternyata sukses',String(otp)],['Belum sempat',String(sisa)]],
    note:'Order yang sudah lewat batas tunggu tapi masih berstatus menunggu'})
   return J({ok:1,beres,balik,otp,sisa})}
  // Batalkan order yang masih menunggu, atas nama admin. Saldo pemiliknya kembali penuh.
  if(a==='orders/cancel'){
   const uid=String(b.uid||''),oid=String(b.id||'')
   if(!uid||!oid)return E('Pilih ordernya dulu')
   if(!await sekali('ordcancel:'+oid))return E(DOBEL,429)
   const u=await kv.get('u:'+uid);if(!u)return E('Pengguna tidak ditemukan',404)
   const o=(u.tx||[]).find(x=>x.type==='order'&&x.id===oid);if(!o)return E('Order tidak ditemukan',404)
   if(o.status!=='pending')return E('Order ini sudah tidak menunggu (status: '+o.status+')')
   if(!P[o.server])return E('Server order ini sudah tidak tersedia',503)
   // OTP yang sudah telanjur masuk tidak boleh dibatalkan: nanti refundnya dobel
   let st=null;try{st=await P[o.server].status(o.id)}catch(e){}
   if(st&&st.otp){o.status='success';o.otp=st.otp;o.msg=st.msg;await fireOtp(u,o);await save(u)
    return E('Kode OTP ternyata sudah masuk, order tidak dibatalkan',409)}
   try{await P[o.server].cancel(o.id)}
   catch(e){markCancel(o,e);await save(u)
    return J({ok:1,queued:true,status:'pending',message:cancelMsg(),providerError:String(e.message||'').slice(0,160)},202)}
   o.status='cancelled';o.cancelReq=0
   const balik=await refund(u,o)
   if(balik)await unwindRs(u,o)
   await save(u)
   try{const {pushUser:pu,msgRefund:mr}=await import('../../../lib/tgpush')
    await pu(u,mr(o,u,'DIBATALKAN ADMIN'))}catch(e){}
   await notify({i:'❌',t:'Order dibatalkan admin',st:'admin',id:['ID Order',o.id],
    rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',balik?rp(o.price):'(sudah pernah)'],['Saldo sekarang',rp(u.balance)]],
    note:'Dibatalkan lewat panel admin'})
   return J({ok:1,status:'cancelled',refund:balik?o.price:0,balance:u.balance})}
  // ---- Admin: reseller (daftar + ubah saldo dompet reseller) ----
  // Buka/tutup pendaftaran reseller + slot bot per mode (tanpa modal / stok mandiri)
  if(a==='rs/reg')return J({...(await RSL.regStatus())})
  if(a==='rs/reg/save'){
   const {was,cfg:nw}=await RSL.saveRegCfg(b.cfg||{});const st=await RSL.regStatus()
   const ch=[];for(const m of ['komisi','mandiri']){const x=was[m],y=nw[m]
    if(x.open!==y.open||x.slots!==y.slots)ch.push([RSL.MODES[m],(y.open?'DIBUKA':'DITUTUP')+' · slot '+st[m].used+'/'+y.slots])}
   if(was.depPct!==nw.depPct)ch.push(['Komisi deposit reseller',nw.depPct+'%'])
   if(ch.length)await notify({i:'🏪',t:'Pendaftaran reseller diubah',st:'admin',rows:ch,note:'Hanya berlaku untuk pendaftar baru. Bot reseller yang sudah aktif tidak terpengaruh.'}).catch(()=>{})
   return J({...st})}
  if(a==='rs/list'){
   const items=await RSL.listAll(),own=await Promise.all(items.map(x=>kv.get('u:'+x.uid)))
   const tot=items.reduce((o,x)=>{o.saldo+=x.balance;o.untung+=x.earn;o.terjual+=x.sold;o.pelanggan+=x.cust;return o},{saldo:0,untung:0,terjual:0,pelanggan:0})
   return J({total:tot,items:items.map((x,i)=>({...x,email:own[i]?own[i].email:'(terhapus)',name:own[i]?own[i].name:''}))})}
  // ---- Daftar pelanggan semua bot reseller + ubah saldo mereka ----
  if(a==='rs/cust')return J(await RSL.customers({uid:String(b.uid||''),q:String(b.q||''),limit:Math.min(500,Math.floor(+b.limit)||300)}))
  if(a==='rs/cust/saldo'){
   const id=String(b.id||'');if(!id)return E('Pilih pelanggan dulu')
   const n=Math.floor(Math.abs(+b.amount||0));if(!n)return E('Nominal harus lebih dari 0')
   const delta=b.kind==='del'?-n:n
   const cu=await kv.get('u:'+id);if(!cu||!cu.rs)return E('Pelanggan reseller tidak ditemukan',404)
   if(delta<0&&(+cu.balance||0)<n)return E('Saldo pelanggan tidak cukup untuk dikurangi sebanyak itu')
   if(!await sekali('rscust:'+id+':'+delta))return E(DOBEL,429)
   mut(cu,delta,String(b.note||'').slice(0,60)||(delta>0?'Admin tambah saldo':'Admin kurangi saldo'))
   await save(cu)
   const rs=await RSL.getRs(cu.rs)
   // pelanggan bot reseller dikabari lewat botnya sendiri, bukan bot platform
   RSL.chNotify(cu.rs,`<b>${delta>0?'➕ SALDO DITAMBAH ADMIN':'➖ SALDO DIKURANGI ADMIN'}</b>\n━━━━━━━━━━━━━━━━━━\n👤 Pelanggan  <b>${String(cu.name||'-').replace(/[<>&]/g,'').slice(0,24)}</b>\n💵 Nominal  <b>${(delta>0?'+':'-')+rp(n)}</b>\n👛 Saldo sekarang  <b>${rp(cu.balance)}</b>`).catch(()=>{})
   await notify({i:'🛠',t:delta>0?'Admin tambah saldo pelanggan reseller':'Admin kurangi saldo pelanggan reseller',st:'admin',
    rows:[['Toko',rs.brand||'-'],['Pelanggan',cu.tgUser?'@'+cu.tgUser:(cu.name||cu.id)],['Nominal',(delta>0?'+':'-')+rp(n)],['Saldo sekarang',rp(cu.balance)],['Catatan',String(b.note||'')]]})
   return J({ok:1,balance:cu.balance})}
  // QRIS milik admin: dipakai reseller mandiri saat mengisi saldo stok.
  if(a==='qris/save'){
   const img=String(b.img||'')
   if(img&&!okImg(img))return E('Gambar QRIS tidak valid atau terlalu besar (maks ~280KB)')
   cfg.qris={img,name:String(b.name||'').trim().slice(0,40),nmid:String(b.nmid||'').trim().slice(0,30),note:String(b.note||'').trim().slice(0,200)}
   await kv.set('cfg',cfg);return J({qris:cfg.qris})}
  // Permintaan isi saldo stok dari reseller mandiri
  if(a==='rs/stokreq')return J({items:await RSL.stokReqAll(60)})
  if(a==='rs/stokreq/img')return J(await RSL.stokReqImg(String(b.uid||''),String(b.id||''))||{})
  if(a==='rs/stokreq/ok'){
   try{const r=await RSL.stokReqReview(String(b.uid||''),String(b.id||''),b.ok!==false)
    return J({ok:1,hasil:r,items:await RSL.stokReqAll(60)})}
   catch(e){return E(e.message)}}
  // Admin menambah / mengurangi SALDO STOK reseller mandiri (mis. untuk koreksi).
  if(a==='rs/stok'){
   const uid=String(b.uid||'');if(!uid)return E('Pilih reseller dulu')
   const abs=Math.round(Math.abs(+b.amount||0));if(!abs)return E('Nominal harus lebih dari 0')
   const n=b.kind==='del'?-abs:(Math.round(+b.amount||0)<0?-abs:abs)
   const ada=await kv.get('rs:'+uid);if(!ada||!ada.uid)return E('Reseller tidak ditemukan',404)
   if(!await sekali('rsstokadm:'+uid+':'+n))return E(DOBEL,429)
   try{const acc=await RSL.stokAdd(uid,n,String(b.note||'Penyesuaian admin'))
    await notify({i:'📦',t:n>0?'Admin menambah saldo stok reseller':'Admin mengurangi saldo stok reseller',st:'admin',
     rows:[['Toko',acc.brand||'-'],['Nominal',(n>0?'+':'')+rp(n)],['Saldo stok',rp(acc.stok)]]})
    return J({ok:1,stok:acc.stok})}catch(e){return E(e.message)}}
  if(a==='rs/saldo'){
   const uid=String(b.uid||'');if(!uid)return E('Pilih reseller dulu')
   const rsAda=await kv.get('rs:'+uid)
   if(rsAda&&rsAda.mode==='mandiri')return E('Reseller ini mode STOK MANDIRI: dia tidak punya dompet komisi. Pakai tombol saldo stok (+/- Saldo Stok).')
   const n=Math.floor(Math.abs(+b.amount||0));if(!n)return E('Nominal harus lebih dari 0')
   const delta=b.kind==='del'?-n:n
   if(!await sekali('rssaldo:'+uid+':'+delta))return E(DOBEL,429)
   try{const acc=await RSL.adminSaldo(uid,delta,b.note||(delta>0?'Admin tambah saldo':'Admin kurangi saldo'))
    const o=await kv.get('u:'+uid)
    await notify({i:'🛠',t:delta>0?'Admin tambah saldo reseller':'Admin kurangi saldo reseller',st:'admin',
     rows:[['Reseller',o?mask(o.email):uid],['Toko',acc.brand||'-'],['Nominal',(delta>0?'+':'-')+rp(n)],['Saldo sekarang',rp(acc.balance)],['Catatan',String(b.note||'')]]})
    return J({ok:1,balance:acc.balance})}catch(e){return E(e.message)}}
  // ---- Job / saldo gratis ----
  if(a==='job/list')return J({jobs:await JOB.allJobs(),pending:await JOB.pending(),stats:await JOB.stats()})
  if(a==='job/save'){try{return J({ok:1,job:await JOB.saveJob(b.job||{})})}catch(e){return E(e.message)}}
  if(a==='job/del'){try{return J({ok:1,sisa:await JOB.delJob(String(b.id||''))})}catch(e){return E(e.message)}}
  if(a==='job/toggle'){try{return J({ok:1,job:await JOB.toggleJob(String(b.id||''),!!b.on)})}catch(e){return E(e.message)}}
  if(a==='job/sub'){const r=await JOB.subImage(String(b.id||''));return r?J(r):E('Kiriman tidak ditemukan',404)}
  if(a==='job/review'){try{return J(await JOB.review(String(b.id||''),!!b.ok,b.reason))}catch(e){return E(e.message)}}
  if(a==='push/key')return J({key:await pushKey(),devices:await pushCount(KEY_ADMIN)})
  if(a==='push/status')return J({key:await pushKey(),list:await pushDevices(KEY_ADMIN)})
  if(a==='push/subscribe'){try{await pushSub(KEY_ADMIN,b.sub,b.label||'HP admin');return J({ok:1,devices:await pushCount(KEY_ADMIN)})}catch(e){return E(e.message)}}
  if(a==='push/unsubscribe'){await pushUnsub(KEY_ADMIN,String(b.endpoint||''));return J({ok:1,devices:await pushCount(KEY_ADMIN)})}
  if(a==='push/test'){const r=await pushSend(KEY_ADMIN,{t:'🔔 Tes notifikasi Artapedia',b:'Kalau ini bunyi & bergetar, notifikasi chat CS sudah aktif.',u:'/admin',tag:'tes',ring:2})
   if(!r.total)return J({ok:false,error:'Belum ada HP yang didaftarkan. Buka /admin DI HP yang mau berbunyi, lalu tekan "Aktifkan notifikasi HP" di sana.',list:[]})
   return J({ok:r.sent>0,...r,list:await pushDevices(KEY_ADMIN)})}
  return E('not found',404)}
 const u=await who(req);if(!u){if(req.__ipBlock)return E(`IP ${req.__ipBlock} tidak ada di whitelist API key ini. Tambahkan di dashboard > API Key > Whitelist IP.`,403);return E('API key tidak ada/tidak valid, atau belum login',401)}
 if(u.banned)return E('Akun ditangguhkan',403)
 if((/^Bearer /.test(req.headers.get('authorization')||'')||q.api_key)&&p.startsWith('v1/')){
  const sc=p==='v1/order'&&req.method==='POST'?['o',20]:p==='v1/deposit'&&req.method==='POST'?['d',6]:null
  const w=Math.floor(Date.now()/60000),reset=(w+1)*60,retry=Math.max(1,reset-Math.floor(Date.now()/1000))
  const n=await kv.incr(`rl:${u.id}:a:${w}`),m=sc?await kv.incr(`rl:${u.id}:${sc[0]}:${w}`):0
  req.__rl={remaining:Math.max(0,60-n),reset}
  if(n>60||(sc&&m>sc[1]))return J({error:`Rate limit exceeded. Coba lagi dalam ${retry} detik.`,retryAfter:retry},429,{'Retry-After':String(retry),'X-RateLimit-Limit':'60','X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(reset)})}
 if(p==='v1/me'){await ensureRef(u);return J({name:u.name,email:u.email,balance:u.balance,joinedAt:u.joinedAt,apikey:u.apikey,broadcast:cfg.broadcast,csUnread:(await csGet(u.id)).uu,refCode:u.refCode,refCount:u.refCount||0,refEarn:u.refEarn||0,refPending:!!(u.refBy&&!u.refPaid),tgLinked:!!u.tgId,hasPassword:!!u.pass})}
 // ---- Pintu rahasia: ketuk logo di kaki dashboard n kali ----
 // Keputusan ada di SERVER: jumlah ketukan, daftar email yang boleh, dan masa berlaku token.
 // Browser cuma melapor sudah mengetuk berapa kali; tanpa sesi login yang sah, laporannya diabaikan.
 if(p==='v1/tap'&&req.method==='POST'){
  const t=cfg.tap||{}
  // 'code' dipakai browser untuk membedakan "belum cukup" (diam saja, teruskan menghitung)
  // dari penolakan sungguhan (hentikan hitungan dan tampilkan alasannya).
  if(!t.on)return J({error:'Pintu ini sedang dimatikan',code:'off'},403)
  if(Math.floor(+b.n||0)<t.n)return J({error:'Ketukan belum cukup',code:'kurang'},403)
  const em=String(u.email||'').toLowerCase()
  if((t.emails||[]).length&&!t.emails.includes(em))return J({error:'Akun ini tidak diizinkan membuka panel admin',code:'email'},403)
  if(await kv.incr(`rl:tap:${u.id}:${Math.floor(Date.now()/60000)}`)>12)return J({error:'Terlalu sering, coba lagi 1 menit',code:'limit'},429)
  const tok=rid()
  await kv.set('tmp:adm:'+tok,{uid:u.id,email:em,exp:Date.now()+8*36e5})
  // (notifikasi "masuk admin lewat pintu rahasia" sengaja tidak dikirim ke channel)
  return J({ok:1,token:tok})}
 // ---- Bot reseller (halaman /reseller) ----
 if(p.startsWith('v1/reseller')){
  const base=(cfg.site.baseUrl||sec.SITE_URL||site(req)||'').replace(/\/+$/,'')
  try{
   if(p==='v1/reseller')return J({...(await RSL.view(u.id)),webBal:+u.balance||0,adminQris:{...(cfg.qris||{}),img:(cfg.qris&&cfg.qris.img)||'/qris-admin.png'}})
   if(p==='v1/reseller/wallets')return J(await RSL.wallets())
   if(p==='v1/reseller/products')return J(await RSL.products(String(q.wallet||'')))
   if(req.method!=='POST')return E('Endpoint tidak ditemukan',404)
   if(p==='v1/reseller/tnc'){await RSL.accept(u.id);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/bot'){await RSL.createBot(u.id,b,base);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/bot/del'){await RSL.delBot(u.id);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/refresh'){await RSL.refresh(u.id);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/markup'){if(b.rp!==undefined||b.server!==undefined)await RSL.setMarkupRp(u.id,b.server||'all',b.rp);else await RSL.setMarkup(u.id,b.markup);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/brand'){await RSL.setBrand(u.id,b.brand);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/channel'){await RSL.setChannel(u.id,b);return J(await RSL.view(u.id))}
   // bahasa + kurs tampilan bot
   if(p==='v1/reseller/lang'){await RSL.setLang(u.id,b.lang,b.rate);return J(await RSL.view(u.id))}
   // QRIS manual milik reseller (khusus mode mandiri)
   if(p==='v1/reseller/qris'){await RSL.setQris(u.id,b);return J(await RSL.view(u.id))}
   // Isi saldo stok: dipindahkan dari saldo akun web milik reseller sendiri.
   if(p==='v1/reseller/stok'){
    const a0=await RSL.getRs(u.id)
    if(!RSL.isMandiri(a0))return E('Saldo stok hanya untuk mode mandiri')
    const n=Math.floor(Math.abs(+b.amount||0))
    if(!(n>=1000))return E('Minimal Rp1.000')
    if(b.kind==='tarik'){
     if((+a0.stok||0)<n)return E('Saldo stok hanya '+rp(a0.stok))
     if(!await sekali('rsstok:'+u.id+':'+n))return E(DOBEL,429)
     await RSL.stokAdd(u.id,-n,'Dipindahkan ke saldo akun')
     const f=(await kv.get('u:'+u.id))||u;mut(f,n,'Tarik saldo stok reseller');await save(f)
     return J({...(await RSL.view(u.id)),ok:1,webBal:f.balance})}
    const f=(await kv.get('u:'+u.id))||u
    if((+f.balance||0)<n)return E('Saldo akunmu hanya '+rp(f.balance)+'. Isi saldo dulu di halaman Deposit.')
    if(!await sekali('rsstok:'+u.id+':'+n))return E(DOBEL,429)
    mut(f,-n,'Isi saldo stok reseller');await save(f)
    await RSL.stokAdd(u.id,n,'Isi dari saldo akun')
    return J({...(await RSL.view(u.id)),ok:1,webBal:f.balance})}
   // Isi saldo stok lewat SMP Payment (otomatis): buat tagihan QRIS dinamis, saldo masuk lewat callback
   if(p==='v1/reseller/stok/req'){
    if(!await sekali('rsstokreq:'+u.id+':'+Math.floor(+b.amount||0)))return E(DOBEL,429)
    try{const r=await RSL.stokSmpNew(u.id,b.amount);return J({ok:1,hasil:r})}
    catch(e){return E(e.message)}}
   // cek status tagihan stok (polling ringan: hanya membaca penanda lunas, tidak memanggil gateway)
   if(p==='v1/reseller/stok/check'){
    try{const r=await RSL.stokSmpCheck(u.id,String(b.id||''))
     const lunas=r.status==='diterima'
     return J({ok:1,hasil:r,lunas,...(lunas?await RSL.view(u.id):{})})}
    catch(e){return E(e.message)}}
   if(p==='v1/reseller/stok/cancel'){
    try{const r=await RSL.stokSmpCancel(u.id,String(b.id||''));return J({...(await RSL.view(u.id)),ok:1,hasil:r})}
    catch(e){return E(e.message)}}
   // ACC / tolak bukti transfer pelanggan (mode mandiri)
   if(p==='v1/reseller/dep'){
    const r=await RSL.depReview(u.id,String(b.id||''),b.ok!==false)
    if(r&&r.status==='diterima'){const cu=await kv.get('u:'+r.cust)
     if(cu){mut(cu,r.amount,'Deposit QRIS toko');await save(cu)
      // deposit SUKSES: channel toko (bahasa toko) + channel admin, dua-duanya pakai struk
      RSL.chDepMan(u.id,r,'lunas',cu.balance).catch(()=>{})
      const {pushUser:pu}=await import('../../../lib/tgpush')
      pu(cu,`<b>✅ Deposit diterima</b>\n━━━━━━━━━━━━━━━━━━\n💵 ${rp(r.amount)} sudah masuk ke saldomu.\n👛 Saldo sekarang ${rp(cu.balance)}`).catch(()=>{})}}
    return J({...(await RSL.view(u.id)),ok:1,hasil:r})}
   if(p==='v1/reseller/channel/test'){await RSL.testCh(u.id);return J({ok:1,...(await RSL.view(u.id))})}
   // 'trx', bukan 'wd': view() juga punya kunci 'wd' (daftar riwayat) dan akan saling menimpa
   if(p==='v1/reseller/withdraw'){const r=await RSL.withdraw(u.id,b);return J({...(await RSL.view(u.id)),ok:1,trx:r})}
  }catch(e){return E(e.message)}
  return E('Endpoint tidak ditemukan',404)}
 // ---- Job / saldo gratis (halaman /job) ----
 if(p==='v1/job')return J(await JOB.listForUser(u))
 if(p==='v1/job/submit'&&req.method==='POST'){
  try{return J(await JOB.submitJob(u,String(b.jobId||''),b.photo,b.note))}catch(e){return E(e.message)}}
 // ---- Profil pengguna (halaman /profil) ----
 if(p==='v1/profile'){
  await ensureRef(u)
  if(req.method==='GET'){
   const tx=u.tx||[],ok=tx.filter(x=>x.type==='order'&&x.status==='success'),dp=tx.filter(x=>x.type==='deposit'&&x.status==='completed')
   return J({name:u.name,email:u.email,balance:u.balance,joinedAt:u.joinedAt,refCode:u.refCode,refCount:u.refCount||0,refEarn:u.refEarn||0,
    tgLinked:!!u.tgId,devices:await pushCount(keyUser(u.id)),
    lastLogin:u.lastLogin||0,lastIp:u.lastIp||'',logins:u.logins||0,ipw:(u.ipw||[]).length,hook:!!(u.hook&&u.hook.url&&u.hook.on),
    stats:{orders:ok.length,spent:ok.reduce((a,x)=>a+x.price,0),deposits:dp.length,deposited:dp.reduce((a,x)=>a+x.amount,0),bonus:dp.reduce((a,x)=>a+(x.bonus||0),0)}})}
  if(req.method==='POST'){
   if(req.__key)return E('Profil hanya bisa diubah dari dashboard (login)',403)
   if(b.name!=null){const nm=String(b.name).trim().slice(0,40);if(nm.length<2)return E('Nama minimal 2 karakter');u.name=nm}
   if(b.newPassword!=null){
    const np=String(b.newPassword)
    if(np.length<6)return E('Password baru minimal 6 karakter')
    if(!check(String(b.oldPassword||''),u.pass))return E('Password lama salah')
    u.pass=hash(np);u.pwAt=Date.now()}
   await save(u)
   if(b.newPassword!=null){await notify({i:'🔐',t:'Password diganti sendiri',st:'info',rows:[['Pengguna',mask(u.email)]],note:'Diganti dari halaman Profil. Sesi lain otomatis keluar.'})
    return J({ok:1,name:u.name,reauth:1},200,await session(u,req))}
   return J({ok:1,name:u.name})}
  return E('not found',404)}
 if(p==='v1/apikey'&&req.method==='POST'){
  if(req.__key)return E('Buat ulang key hanya bisa dari dashboard (login), tidak lewat API key',403)
  await kv.del('k:'+u.apikey);u.apikey=rid();await kv.set('k:'+u.apikey,u.id);await save(u)
  await notify({i:'🔑',t:'API key dibuat ulang',st:'info',rows:[['Pengguna',mask(u.email)]],note:'Key lama sudah tidak berlaku'})
  return J({apikey:u.apikey})}
 // ---- Keamanan API key (whitelist IP) & Webhook OTP. Hanya lewat login dashboard, bukan lewat API key ----
 if(p==='v1/tglink'&&req.method==='POST'){
  if(req.__key)return E('Hanya bisa dari dashboard (login)',403)
  const bots=(await getBots()).filter(x=>x.on!==false&&x.username)
  if(!bots.length)return E('Bot Telegram belum diaktifkan admin',404)
  if(!b.bot)return J({bots:bots.map(x=>({id:x.id,username:x.username,name:x.name||x.username})),linked:!!u.tgId})   // langkah 1: daftar bot yang aktif
  const bot=bots.find(x=>String(x.id)===String(b.bot));if(!bot)return E('Bot tidak ditemukan / sedang nonaktif',404)
  const code=rid().slice(0,8).toUpperCase();await kv.set('tmp:tgl:'+code,{uid:u.id,bot:bot.id,exp:Date.now()+10*60000})
  return J({code,expiresIn:600,bot:bot.username,linked:!!u.tgId})}
 if(p.startsWith('v1/security')||p.startsWith('v1/webhook')){
  if(req.__key)return E('Pengaturan ini hanya bisa diubah dari dashboard (login)',403)
  const hk=()=>({url:(u.hook||{}).url||'',on:!!(u.hook&&u.hook.on),secret:(u.hook||{}).secret||'',last:(u.hook||{}).last||null})
  if(p==='v1/security'&&req.method==='GET')return J({ipw:u.ipw||[],yourIp:clientIp(req),hook:hk()})
  if(p==='v1/security'&&req.method==='POST'){
   const raw=Array.isArray(b.ipw)?b.ipw:String(b.ipw||'').split(/[\s,;]+/),list=[...new Set(raw.map(normIp).filter(Boolean))]
   if(list.length>20)return E('Maksimal 20 IP')
   const bad=list.find(x=>!validIp(x));if(bad)return E('Bukan alamat IP yang valid: '+String(bad).slice(0,60))
   u.ipw=list;await save(u);return J({ipw:u.ipw})}
  if(p==='v1/webhook'&&req.method==='POST'){
   const url=String(b.url||'').trim()
   if(!url){u.hook={...(u.hook||{}),url:'',on:false};await save(u);return J({hook:hk()})}
   const c=await checkUrl(url);if(!c.ok)return E(c.error)
   u.hook={...(u.hook||{}),url:c.url,on:b.on!==false,secret:(u.hook||{}).secret||newSecret()};await save(u);return J({hook:hk()})}
  if(p==='v1/webhook/secret'&&req.method==='POST'){u.hook={...(u.hook||{}),secret:newSecret()};await save(u);return J({hook:hk()})}
  if(p==='v1/webhook/test'&&req.method==='POST'){
   if(!u.hook||!u.hook.url)return E('Isi dan simpan URL webhook dulu')
   if(await kv.incr('rl:'+u.id+':wh:'+Math.floor(Date.now()/60000))>5)return E('Terlalu sering, coba lagi 1 menit',429)
   const r=await deliver(u,'webhook.test',{message:'Tes webhook dari Artapedia ID',order_id:'TEST-'+Date.now().toString(36).toUpperCase(),phone:'628000000000',service:'Tes',otp:'123456',sent_at:new Date().toISOString()});await save(u)
   return J({ok:r.ok,code:r.code,error:r.error||'',hook:hk()})}
  return E('not found',404)}
 if(p==='v1/live'){try{return J(await feedList(),200,{'Cache-Control':'no-store'})}catch(err){return E('Gagal memuat transaksi',503)}}
 if(p==='v1/servers')return J({maintenance:cfg.maint&&cfg.maint.on?{mode:cfg.maint.mode,msg:cfg.maint.msg||''}:null,items:svList().filter(s=>!cfg.off.includes(s.server)&&(!s.needs||sec[s.needs])).map(({needs,...s})=>{const m=((cfg.maint||{}).srv||{})[s.server];return m&&m.on?{...s,maintenance:true,maintMsg:m.msg||'Server sedang maintenance'}:s})})
 if(p==='v1/mutasi')return J({items:(u.mut||[]).slice(0,100)})
 // ---- Customer service (sisi pengguna) ----
 if(p==='v1/cs'){
  const info=csInfo(cfg),c=await csGet(u.id)
  if(req.method==='POST'){
   const text=String(b.text||'').trim().slice(0,1000);if(b.img&&!okImg(b.img))return E('Foto tidak valid atau terlalu besar (maks ~200KB)');if(!text&&!b.img)return E('Pesan kosong')
   if(info.off)return E(info.offMsg,403)
   if(!info.open)return E('Customer service sedang tutup. Jam layanan: '+info.hours,403)
   if(await kv.incr(`cs:${u.id}:${Math.floor(Date.now()/60000)}`)>8)return E('Terlalu cepat, tunggu sebentar',429)
   const ai=aiOn(cfg),t=await csPush(u,'user',text,b.img,ai?{quiet:1}:{})
   if(ai){t.typ=Date.now();await kv.set('cs:'+u.id,t);bg(csAiRun(u.id))}
   return J({open:true,hours:info.hours,ai:info.ai,aiName:info.aiName,typing:ai,msgs:t.msgs})}
  if(c.uu){c.uu=0;await kv.set('cs:'+u.id,c)}
  return J({...info,typing:!!(c.typ&&Date.now()-c.typ<45000),msgs:c.msgs})}
 // ---- Notifikasi HP pengguna (Web Push) ----
 if(p==='v1/push/status')return J({key:await pushKey(),list:await pushDevices(keyUser(u.id))})
 if(p.startsWith('v1/push/')&&req.method==='POST'){
  if(req.__key)return E('Hanya bisa dari dashboard (login)',403)
  if(p==='v1/push/subscribe'){try{await pushSub(keyUser(u.id),b.sub,b.label||'HP saya');return J({ok:1,devices:await pushCount(keyUser(u.id))})}catch(e){return E(e.message)}}
  if(p==='v1/push/unsubscribe'){await pushUnsub(keyUser(u.id),String(b.endpoint||''));return J({ok:1,devices:await pushCount(keyUser(u.id))})}
  if(p==='v1/push/status')return J({key:await pushKey(),list:await pushDevices(keyUser(u.id))})
  if(p==='v1/push/test'){const r=await pushSend(keyUser(u.id),{t:'🔔 Tes notifikasi Artapedia ID',b:'Notifikasi aktif. Kamu akan dikabari saat CS membalas & deposit masuk.',u:'/dashboard',tag:'tes',ring:1})
   if(!r.total)return J({ok:false,error:'Belum ada perangkat yang didaftarkan di HP ini',list:[]})
   return J({ok:r.sent>0,...r,list:await pushDevices(keyUser(u.id))})}
  return E('not found',404)}
 // ---- QRIS Gateway: dipakai halaman /pay (login dashboard, bukan API key) ----
 if(p.startsWith('v1/pay')){
  if(req.__key)return E('Halaman gateway hanya bisa dibuka lewat login dashboard',403)
  const pc=PAY.payCfg(cfg)
  const acc=()=>PAY.getAcc(u.id)
  try{
   if(p==='v1/pay/me'){const a=await acc()
    return J({on:pc.on,name:pc.name,fee:pc.fee,feeFlat:pc.feeFlat,min:pc.min,max:pc.max,wdMin:pc.wdMin,wdMax:pc.wdMax,wdPct:pc.wdPct,wdFee:pc.wdFee,wdOn:pc.wdOn,
     wdMethods:PAY.wdMethodList(cfg).filter(m=>m.on).map(({code,name,type})=>({code,name,type})),wdNote:PAY.WD_NOTE,
      inst:{on:!!(pc.wdOn&&pc.instOn!==false&&((PAY.wdMethodList(cfg).find(m=>m.code==='DANA')||{}).on)&&await h2hReady()),fee:PAY.instFeeOf(cfg),nominals:await instNominals(),note:PAY.INST_NOTE},
     acc:{on:a.on,key:a.key,hasSecret:!!a.secret,ipw:a.ipw||[],hook:{url:(a.hook||{}).url||'',on:!!(a.hook||{}).on,secret:(a.hook||{}).secret||'',last:(a.hook||{}).last||null}},
     yourIp:clientIp(req),...PAY.summary(a),
     dep:(a.dep||[]).slice(0,30).map(PAY.depView),wd:(a.wd||[]).slice(0,30).map(PAY.wdView)})}
   if(p==='v1/pay/qris'&&req.method==='POST'){const r=await PAY.createQris(cfg,u.id,b.amount,'web');return J(PAY.depView(r))}
   if(p==='v1/pay/qris'){const r=await PAY.checkQris(cfg,u.id,q.id);if(!r)return E('Transaksi tidak ditemukan',404)
    const a=await acc();return J({...PAY.depView(r),balance:a.balance})}
   if(p==='v1/pay/qris/cancel'&&req.method==='POST'){const r=await PAY.cancelQris(cfg,u.id,b.id);return J(PAY.depView(r))}
   if(p==='v1/pay/withdraw'&&req.method==='POST'){const r=await PAY.withdraw(cfg,u.id,b);const a=await acc()
    if(!r.instant)notify({i:'💸',t:'Pengajuan WD gateway',st:'pending',id:['ID WD',r.id],rows:[['Merchant',mask(u.email)],['Tujuan',r.methodName+' · '+r.dest+' · '+r.destName],['Nominal',rp(r.nominal)],['Biaya',rp(r.fee)],['Diterima',rp(r.net)]],note:'Proses di admin > QRIS Gateway > Penarikan dana'}).catch(()=>{})
    return J({...PAY.wdView(r),balance:a.balance,message:PAY.wdMsg(r)})}
   if(p==='v1/pay/history'){const a=await acc()
    const lim=Math.min(200,Math.max(1,+q.limit||100))
    return J({balance:a.balance,dep:(a.dep||[]).slice(0,lim).map(PAY.depView),wd:(a.wd||[]).slice(0,lim).map(PAY.wdView)})}
   if(p==='v1/pay/key'&&req.method==='POST'){const a=await PAY.regenKey(u.id)
    await notify({i:'🔑',t:'API key gateway dibuat ulang',st:'info',rows:[['Pengguna',mask(u.email)]],note:'Key lama sudah tidak berlaku'})
    return J({key:a.key})}
   if(p==='v1/pay/secret'&&req.method==='POST'){const r=await PAY.setSecret(u.id,!!b.on);return J({secret:r.secret,hasSecret:!!r.secret})}
   if(p==='v1/pay/ipw'&&req.method==='POST'){
    const raw=Array.isArray(b.ipw)?b.ipw:String(b.ipw||'').split(/[\s,;]+/),list=[...new Set(raw.map(normIp).filter(Boolean))]
    if(list.length>20)return E('Maksimal 20 IP')
    const bad=list.find(x=>!validIp(x));if(bad)return E('Bukan alamat IP yang valid: '+String(bad).slice(0,60))
    const {a}=await PAY.setIpw(u.id,list);return J({ipw:a.ipw})}
   if(p==='v1/pay/hook'&&req.method==='POST'){const h=await PAY.setHook(u.id,b.url,b.on);return J({hook:{url:h.url,on:h.on,secret:h.secret,last:h.last||null}})}
   if(p==='v1/pay/hook/secret'&&req.method==='POST'){const h=await PAY.hookSecret(u.id);return J({hook:{url:h.url,on:h.on,secret:h.secret,last:h.last||null}})}
   if(p==='v1/pay/hook/test'&&req.method==='POST'){
    if(await kv.incr('rl:'+u.id+':payhk:'+Math.floor(Date.now()/60000))>5)return E('Terlalu sering, coba lagi 1 menit',429)
    const r=await PAY.fireHook(u.id,'test.ping',{message:'Tes webhook dari '+pc.name,transaction_id:'APY-TEST',amount:10000,status:'paid'})
    const a=await acc();return J({ok:r.ok,code:r.code,error:r.error||'',hook:{url:(a.hook||{}).url||'',on:!!(a.hook||{}).on,last:(a.hook||{}).last||null}})}
   return E('Endpoint tidak ditemukan',404)}
  catch(e){return E(e.message||'Server error',400)}}
 if(p==='v1/support')return E('Gunakan /v1/cs',410)
 const sv=q.server||b.server||'warungnokos_s1'
 if(['v1/services','v1/countries','v1/order'].includes(p)){
  if(!P[sv])return E('server tidak dikenal');if(cfg.off.includes(sv))return E('server dimatikan',503)
  const ms=((cfg.maint||{}).srv||{})[sv];if(ms&&ms.on)return J({error:ms.msg||'Server ini sedang maintenance, coba lagi nanti atau pakai server lain',maintenance:true},503)
  if(p==='v1/order'&&req.method==='POST'&&cfg.maint&&cfg.maint.on)return J({error:cfg.maint.msg||'Situs sedang maintenance, pesanan baru dihentikan sementara',maintenance:true},503)}
 // harga jual = modal + markup (umum atau per server) + tambahan Rp per server, dibulatkan ke atas sesuai pengaturan admin
 const mk=x=>{const o=(cfg.mks||{})[sv]||{},pct=o.pct==null?(+cfg.markup||0):+o.pct,st=+cfg.mkRound||0;let v=Math.ceil(x*(1+pct/100))+(+o.flat||0);if(st>1)v=Math.ceil(v/st)*st;return v}
 if(p==='v1/services')return J({server:sv,items:await P[sv].services()})
 if(p==='v1/countries'){
  if(!q.service_id)return E('service_id wajib')
  const items=(await P[sv].countries(q.service_id)).map(c=>({...c,pricelist:c.pricelist.map(x=>({...x,sell_price:mk(x.price)}))}))
  return J({server:sv,items})}
 if(p==='v1/order'&&req.method==='POST'){
  // Berkunci per pengguna: klik ganda / dua tab tidak bisa membuat dua order sekaligus
  // (dulu bisa dapat dua nomor dan saldo terpotong dua kali).
  if(!await kv.lock('ord:'+u.id,25000))return E('Pesanan sebelumnya masih diproses, tunggu sebentar lalu coba lagi',429)
  try{return await (async()=>{
  if(!b.serviceId||!b.countryId||b.providerId==null)return E('serviceId, countryId, providerId wajib')
  let base=null
  for(const c of await P[sv].countries(b.serviceId))for(const x of c.pricelist)if(x.provider_id==b.providerId&&(!b.countryId||x.country_id==b.countryId))base=x.price
  if(base==null)return E('harga tidak ditemukan, cek providerId')
  const sell=mk(base),guarantee=false,fee=0,price=sell
  if(u.balance<price)return E('Saldo tidak cukup')
  // URUTAN AMAN: pesan nomor ke penyedia DULU. Saldo baru dipotong setelah nomor benar-benar didapat,
  // jadi kalau order gagal / timeout, saldo tidak pernah terpotong (tidak ada yang perlu di-refund).
  // Order gagal TIDAK dikirim ke channel Telegram (atas permintaan admin): pembeli cukup melihat pesan errornya.
  let o;try{o=await P[sv].order({...b,server:sv})}
  catch(e){
   // Saldo akun penyedia habis: pembeli melihat pesan restok (bukan "saldo tidak cukup"), admin diberi tahu (maks 1x / 30 menit / server)
   if(isRestock(e)){if(await kv.lock('restock:'+sv,30*60000))await notify({i:'📦',t:'Saldo server nokos HABIS — perlu restok',st:'warn',rows:[['Server',sv],['Pesan penyedia',String(e.message).slice(0,160)]],note:'Pembeli melihat: '+RESTOCK_MSG}).catch(()=>{});return E(RESTOCK_MSG,503)}
   return E(e.message,502)}
  // baca ulang data terbaru tepat sebelum memotong (mencegah tertimpa data lama)
  const f=(await kv.get('u:'+u.id))||u
  if(f.balance<price){try{await P[sv].cancel(o.id)}catch(_){}
   await notify({i:'⚠️',t:'Order dibatalkan (saldo tidak cukup saat konfirmasi)',st:'warn',rows:[['Pengguna',mask(f.email)],['Layanan',b.serviceName||b.serviceId],['Harga',rp(price)],['Saldo sekarang',rp(f.balance)]]});return E('Saldo tidak cukup',402)}
  mut(f,-price,'Order nokos')
  const rec={type:'order',id:o.id,server:sv,serviceId:b.serviceId,serviceName:b.serviceName||b.serviceId,countryName:b.countryName||'',countryId:b.countryId,providerId:b.providerId,operatorId:b.operatorId,phone:o.phone,price,fee,guarantee,status:'pending',otp:null,msg:null,cost:o.cost,expiredAt:o.expiredAt,refunded:false,at:Date.now()}
  f.tx.unshift(rec)
  try{await kv.set('o:'+o.id,f.id);await save(f)}catch(e){try{await P[sv].cancel(o.id)}catch(_){};return E('Gagal menyimpan pesanan. Saldo tidak terpotong, silakan coba lagi.',503)}
  feedAddBg(f.id,rec.at)   // masuk ke Live transaksi
  await notify({photo:await strukOrder(rec,host(req)),photoName:'struk-'+rec.id+'.png',i:'📱',t:'Pembelian nokos baru',st:'pending',id:['ID Order',o.id],rows:[['Pengguna',mask(f.email)],['Layanan',rec.serviceName+(rec.countryName?' · '+rec.countryName:'')],['Nomor',o.phone],['Harga',rp(price)],['Jaminan OTP',guarantee?'Aktif (+'+rp(fee)+')':'Tidak'],['Server',sv],['Batas tunggu OTP',wibAt(o.expiredAt)],['Saldo sekarang',rp(f.balance)]],note:'Menunggu kode OTP masuk'})
  return J({orderId:o.id,server:sv,phoneNumber:o.phone,price,fee,guarantee,expiredAt:o.expiredAt,createdAt:new Date(rec.at).toISOString(),balance:f.balance})})()}
  finally{await kv.unlock('ord:'+u.id)}}
 const view=o=>({orderId:o.id,server:o.server,cancelQueued:!!o.cancelReq,serviceId:o.serviceId,serviceName:o.serviceName,countryName:o.countryName,phoneNumber:o.phone,price:o.price,fee:o.fee||0,guarantee:!!o.guarantee,replaced:!!o.replaced,status:o.status,otpCode:o.otp,otpMsg:o.msg,refunded:o.refunded,expiredAt:o.expiredAt,createdAt:new Date(o.at).toISOString()})
 if(p==='v1/orders'){
  const lim=Math.min(+q.limit||50,100),pg=+q.page||1,all=u.tx.filter(x=>x.type==='order')
  return J({page:pg,limit:lim,items:all.slice((pg-1)*lim,pg*lim).map(view)})}
 if(p==='v1/orders/status'||p==='v1/orders/cancel'){
  const oid=q.order_id||b.order_id,o=u.tx.find(x=>x.type==='order'&&x.id===oid);if(!o)return E('Pesanan tidak ditemukan',404)
  if(o.status==='pending'&&!P[o.server])return E('Server order ini sudah tidak tersedia',503)
  if(o.status==='pending'&&await expireIfLate(u,o,'batas tunggu lewat')){await save(u);return J({...view(o),balance:u.balance})}
  if(p.endsWith('cancel')){const why=cancelBlock(o);if(why)return E(why,o.status==='pending'?400:409)}
  if(o.status==='pending'){
   if(p.endsWith('cancel')){
    // cek dulu: kalau OTP ternyata sudah masuk, order selesai (bukan dibatalkan) supaya tidak refund ganda
    let s0=null;try{s0=await P[o.server].status(o.id)}
    catch(e){if(await expireIfLate(u,o,e.message)){await save(u);return J({...view(o),balance:u.balance})}}
    if(s0&&s0.otp){o.status='success';o.otp=s0.otp;o.msg=s0.msg;await rsPayCut(u,o);await save(u);return E('Kode OTP sudah masuk, pesanan tidak bisa dibatalkan',409)}
    // Ditolak penyedia (sering karena gangguan di sisi mereka): permintaannya disimpan
    // dan dicoba ulang otomatis oleh cron sampai berhasil, lalu saldo dikembalikan.
    try{await P[o.server].cancel(o.id)}
    catch(e){markCancel(o,e);await save(u)
     return J({...view(o),balance:u.balance,cancelQueued:true,
      message:cancelMsg(),providerError:String(e.message||'').slice(0,160)},202)}
    o.status='cancelled';if(await refund(u,o))await unwindRs(u,o);await notify({i:'❌',t:'Order dibatalkan',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]],note:'Dibatalkan pengguna, saldo sudah kembali'})}
   else{
    let s=null
    try{s=await P[o.server].status(o.id)}
    catch(e){if(await expireIfLate(u,o,e.message)){await save(u);return J({...view(o),balance:u.balance})};throw e}
    if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;await fireOtp(u,o);await notify({photo:await strukOrder(o,host(req),false),photoName:'struk-'+o.id+'.png',i:'🔑',t:'OTP diterima',st:'ok',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)],['Server',o.server]],note:o.guarantee?'Order memakai Jaminan OTP':'Transaksi selesai (done)'})}
    else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';await refund(u,o)}
    else if(o.cancelReq)await retryCancel(u,o)
    else await replaceIfNeeded(u,o)}
   await save(u)}
  return J({...view(o),balance:u.balance})}
 if(p==='v1/deposit/methods')return J({methods:await methodsList(cfg),min:cfg.dep.min,max:cfg.dep.max})
 const dview=x=>({order_id:x.id,method:x.method||'qris',method_name:(METHODS[x.method]||METHODS.qris).name,amount:x.amount,total_amount:x.total,admin_fee:x.fee||0,bonus:x.bonus||0,status:x.status,qr_string:x.qr,qr_image:x.qrImg,va_number:x.va||'',expired_at:x.exp,createdAt:new Date(x.at).toISOString()})
 // Tombol "Saya sudah bayar": tanya ulang ke gateway dan kreditkan kalau memang sudah lunas.
 // Berlaku juga untuk deposit yang terlanjur dicap kedaluwarsa — uangnya bisa saja masuk telat.
 if(p==='v1/deposit/recheck'&&req.method==='POST'){
  const id=String(b.order_id||q.order_id||'')
  const o=u.tx.find(x=>x.type==='deposit'&&x.id===id);if(!o)return E('Deposit tidak ditemukan',404)
  if(o.status==='completed')return J({status:'completed',credited:true,balance:u.balance,msg:'Deposit ini sudah masuk.'})
  if(await kv.incr(`rl:rck:${u.id}:${Math.floor(Date.now()/20000)}`)>3)return E('Sabar ya, cek lagi beberapa detik.',429)
  const r=await recheckDep(u,o)
  if(r.changed)await save(u)
  const f=(await kv.get('u:'+u.id))||u
  return J({status:o.status,credited:!!o.credited,balance:f.balance,changed:!!r.changed,
   msg:o.status==='completed'?'Pembayaran ketemu! Saldo sudah masuk.'
    :r.error?'Gateway belum bisa dihubungi: '+String(r.error).slice(0,120)+'. Coba lagi sebentar.'
    :o.status==='expired'?'Pembayaran belum terlihat dan tagihan sudah lewat batas. Kalau kamu sudah transfer, hubungi CS dengan bukti transfernya.'
    :'Pembayaran belum terlihat di gateway. Biasanya butuh 1-3 menit setelah transfer — tekan lagi sebentar lagi.'})}
 if(p==='v1/deposit/cancel'&&req.method==='POST'){
  const o=u.tx.find(x=>x.type==='deposit'&&x.id===(b.order_id||q.order_id));if(!o)return E('Deposit tidak ditemukan',404)
  if(o.status!=='pending')return E('Deposit ini sudah '+o.status+', tidak bisa dibatalkan')
  // cek dulu: kalau ternyata sudah dibayar, saldo dikreditkan, bukan dibatalkan
  try{if(await depCheck(o)==='completed'){await applyDep(u,o,'completed');await save(u);return E('Deposit ternyata sudah dibayar, saldo sudah masuk')}}catch(e){}
  await depCancel(o);o.status='canceled';await save(u)
  await notify({i:'🚫',t:'Deposit dibatalkan pengguna',st:'warn',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Metode',(METHODS[o.method]||METHODS.qris).name+' · '+(ROUTES[o.gw]||'-')],['Dibuat',wibAt(o.at)]]})
  return J({ok:1,status:'canceled'})}
 if(p==='v1/deposit'&&req.method==='POST'){
  if(cfg.maint&&cfg.maint.on)return J({error:cfg.maint.msg||'Situs sedang maintenance, deposit baru dihentikan sementara',maintenance:true},503)
  // provider = kode metode dari /v1/deposit/methods (qris, bri_va, ...). Nilai lama/tidak dikenal dianggap qris.
  const method=METHODS[b.provider]?b.provider:'qris',ml=await methodsList(cfg),m=ml.find(x=>x.provider===method)
  if(!m)return E('Metode deposit ini sedang dinonaktifkan atau belum tersedia')
  const amount=Math.floor(+b.amount),fmt=n=>'Rp'+n.toLocaleString('id-ID')
  if(!(amount>=m.min&&amount<=m.max))return E(`Nominal deposit ${m.name} minimal ${fmt(m.min)} dan maksimal ${fmt(m.max)}`)
  if(u.tx.filter(x=>x.type==='deposit'&&x.status==='pending').length>=3)return E('Terlalu banyak deposit belum dibayar. Batalkan salah satu dulu.')
  const d=await createDeposit(cfg,method,amount)
  const rec={type:'deposit',id:d.id,amount,total:d.total,fee:d.fee,qr:d.qr,qrImg:d.qrImg,va:d.va||'',method,gw:d.gw,exp:d.exp,expMs:toMs(d.exp),status:'pending',credited:false,at:Date.now()}
  u.tx.unshift(rec);await kv.set('d:'+rec.id,u.id);await depPendAdd(rec.id,u.id);await save(u)
  await notify({photo:await strukDep(rec,host(req)),photoName:'struk-'+rec.id+'.png',i:'💰',t:'Deposit menunggu pembayaran',st:'pending',id:['ID Deposit',rec.id],rows:[['Pengguna',mask(u.email)],['Metode',m.name],['Rute',ROUTES[d.gw]],['Nominal',rp(amount)],['Biaya layanan',d.fee>0?rp(d.fee):''],['Total bayar',rp(d.total)],['Batas bayar',rec.expMs?wibAt(rec.expMs):''],['Saldo sekarang',rp(u.balance)]],note:'Pengguna belum membayar'})
  return J(dview(rec))}
 if(p==='v1/deposit'){
  if(!q.order_id)return J({items:u.tx.filter(x=>x.type==='deposit').slice(0,20).map(dview)})
  const o=u.tx.find(x=>x.type==='deposit'&&x.id===q.order_id);if(!o)return E('Deposit tidak ditemukan',404)
  if(o.status==='pending'){if(await applyDep(u,o,await depCheck(o)))await save(u)}
  return J({...dview(o),credited:o.credited,balance:u.balance})}
 return E('Endpoint tidak ditemukan',404)
 }catch(e){return E(e.message||'Server error',500)}}
async function H(req,ctx){
 // Apa pun yang terjadi, balasan HARUS JSON. Kalau tidak (mis. database terputus sesaat sebelum blok try di h()), Next membalas
 // teks biasa dan browser menampilkan "Unexpected token ... is not valid JSON".
 let r;try{r=await h(req,ctx)}catch(e){return J({error:'Server error: '+String((e&&e.message)||e).slice(0,160)},500)}
 const l=req.__rl
 if(l&&!r.headers.has('X-RateLimit-Limit')){r.headers.set('X-RateLimit-Limit','60');r.headers.set('X-RateLimit-Remaining',String(l.remaining));r.headers.set('X-RateLimit-Reset',String(l.reset))}
 return r}
export {H as GET,H as POST}
