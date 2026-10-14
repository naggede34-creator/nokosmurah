import crypto from 'crypto'
import {kv} from '../../../lib/db'
import {who,save,hash,check,rid,clientIp,validIp,normIp} from '../../../lib/auth'
import {checkUrl,newSecret,deliver,fireOtp} from '../../../lib/webhook'
import {P,SERVERS,UPSTREAM,dz} from '../../../lib/providers'
import {notify,mask,rp,wibAt} from '../../../lib/telegram'
import {replaceIfNeeded,CANCEL_WAIT} from '../../../lib/sync'
import {getSec,secInfo,secSave,SEC} from '../../../lib/settings'
import {METHODS,ROUTES,ROUTES_V2,methodsList,readiness,createDeposit,depCheck,depCancel,applyDep,toMs,depPendAdd,recheckDep} from '../../../lib/deposit'
import {getCfg,creditDeposit,refundOnce,ensureRef,bonusPct,weekStart,WEEK,weekRows,payWeekly,payMonthly,monthStart,monthEnd} from '../../../lib/bonus'
import {sendMail} from '../../../lib/mail'
import {getBots,saveBots,tg,pushUser,botSetup} from '../../../lib/tgpush'
import {startBroadcast,bcStep} from '../../../lib/tgbot'
import {runBackup,backupPage,importItems,wipeAll,reindexUsers,userStats,usersPage,contents as bkContents} from '../../../lib/backup'
import * as PAY from '../../../lib/paygw'
import {strukPng,strukSign,strukUrl} from '../../../lib/strukimg'
import * as JOB from '../../../lib/jobs'
import * as RSL from '../../../lib/reseller'
import * as AUS from '../../../lib/austin'
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
 const mati=cs.on===false
 return {open:!mati&&jam,hours:'09.00 - 17.00 dan 18.00 - 22.00 WIB',off:mati,offMsg:mati?(cs.msg||'Customer service sedang dinonaktifkan sementara.'):''}}
const csGet=async id=>(await kv.get('cs:'+id))||{msgs:[],au:0,uu:0,at:0}
const okImg=i=>typeof i==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(i)&&i.length<=300000
async function csPush(u,from,text,img){
 const t=await csGet(u.id);t.msgs.push({from,text,...(img?{img}:{}),at:Date.now()});t.msgs=t.msgs.slice(-200);t.at=Date.now()
 while(t.msgs.length>5&&JSON.stringify(t.msgs).length>8e6)t.msgs.shift()
 if(from==='user')t.au++;else t.uu++
 await kv.set('cs:'+u.id,t)
 const ix=(await kv.get('csidx'))||[];if(!ix.includes(u.id))await kv.sadd('csidx',u.id)
 // Notifikasi ke HP (Web Push): pesan pengguna membangunkan HP admin, balasan admin membangunkan HP pengguna.
 // Berjalan walaupun browser sudah ditutup; kegagalannya tidak boleh menggagalkan pengiriman chat.
 const body=(text||'').slice(0,120)||(img?'📷 Mengirim foto':'Pesan baru')
 try{
  if(from==='user')await pushSend(KEY_ADMIN,{t:'💬 Chat CS · '+mask(u.email),b:body,u:'/admin',tag:'cs-'+u.id,ring:3})
  else await pushSend(keyUser(u.id),{t:'💬 Balasan Customer Service',b:body,u:'/cs',tag:'cs',ring:2})}
 catch(e){}
 return t}
// ---- Leaderboard ----
// Data manual (admin > Beranda) disimpan di kv "lb_manual": [{id,name,balance,trx,spent}]. Hanya tampil di tab Saldo & Transaksi,
// TIDAK ikut hadiah mingguan/bulanan (hadiah hanya untuk pengguna asli). Nama berupa email otomatis disensor.
const lbName=n=>{n=String(n||'').trim();return /^\S+@\S+\.\S+$/.test(n)?mask(n):n.slice(0,40)}
async function boardFull(){
 const c=globalThis.__lb;if(c&&Date.now()-c.t<30000)return c
 const ids=(await kv.get('idx'))||[]
 // pelanggan bot reseller (u.rs) punya toko sendiri, tidak ikut papan peringkat platform
 const us=(await Promise.all(ids.map(i=>kv.get('u:'+i)))).filter(x=>x&&!x.rs)
 // Satu papan GLOBAL: tiap baris memuat saldo, jumlah transaksi, berapa kali deposit,
 // transaksi sukses, dan transaksi gagal. Berlaku untuk pengguna asli maupun yang ditambah admin.
 const GAGAL=['expired','cancelled','canceled','failed']
 const real=us.map(u=>{const tx=u.tx||[]
  const ord=tx.filter(x=>x.type==='order')
  const ok=ord.filter(x=>x.status==='success')
  return {u:mask(u.email),balance:+u.balance||0,trx:ord.length,dep:tx.filter(x=>x.type==='deposit'&&x.status==='completed').length,
   ok:ok.length,gagal:ord.filter(x=>GAGAL.includes(x.status)).length,spent:ok.reduce((a,x)=>a+x.price,0),banned:u.banned}}).filter(r=>!r.banned)
 const man=((await kv.get('lb_manual'))||[]).map(e=>{const ok=Math.max(0,+e.ok||0),gg=Math.max(0,+e.gagal||0)
  return {u:lbName(e.name),balance:+e.balance||0,trx:Math.max(+e.trx||0,ok+gg),dep:+e.dep||0,ok,gagal:gg,spent:+e.spent||0,banned:false}})
 const rows=[...real,...man]
 // peringkat: transaksi sukses terbanyak, lalu saldo, lalu total transaksi
 // yang masuk papan: pernah transaksi, pernah deposit, atau punya saldo
 const aktif=rows.filter(r=>r.ok>0||r.trx>0||r.dep>0||r.balance>0)
 const global=[...aktif].sort((a,b)=>b.ok-a.ok||b.balance-a.balance||b.trx-a.trx).slice(0,50).map(({banned,...r})=>r)
 const cf=await getCfg(),st=cf.stats||{},realStat={users:us.length,orders:real.reduce((a,r)=>a+r.ok,0)}
 const ov=x=>x!==''&&x!=null&&/^\d+$/.test(String(x))?+x:null
 const sum=k=>aktif.reduce((a,r)=>a+r[k],0)
 const d={global,total:{users:aktif.length,saldo:sum('balance'),trx:sum('trx'),dep:sum('dep'),ok:sum('ok'),gagal:sum('gagal')},
  users:ov(st.users)??realStat.users,orders:ov(st.orders)??realStat.orders}
 return globalThis.__lb={t:Date.now(),d,r:realStat}}
const board=async()=>(await boardFull()).d
const lbClean=b=>{const name=String(b.name||'').trim().slice(0,60);if(!name)return {error:'Isi email atau nama dulu'}
 const n=x=>Math.min(1e12,Math.max(0,Math.floor(+x||0)))
 const ok=n(b.ok),gagal=n(b.gagal)
 return {data:{name,balance:n(b.balance),trx:Math.max(n(b.trx),ok+gagal),dep:n(b.dep),ok,gagal,spent:n(b.spent)}}}

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
async function oaUser(prof,rc,cfg){
 const email=prof.email,id=await kv.get('e:'+email),ex=id&&await kv.get('u:'+id)
 if(ex)return {u:ex,isNew:false}
 let rf=null
 if(rc&&cfg.ref.on){const rfid=await kv.get('rc:'+rc);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)rf=null}
 const u={id:rid(),email,name:prof.name||email.split('@')[0],pass:hash(rid()),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),refBy:rf?rf.id:null,refPaid:false}
 await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id)
 await kv.sadd('idx',u.id)
 const total=((await kv.get('idx'))||[]).length
 await notify({i:'👤',t:'Pengguna baru bergabung',st:'ok',rows:[['Nama',String(u.name).slice(0,2)+'***'],['Email',mask(email)],['Total pengguna',total],...(rf?[['Diajak oleh',mask(rf.email)]]:[])],note:'Daftar lewat '+(prof.via||'OAuth')+'. Selamat datang di Artapedia ID!'})
 return {u,isNew:true}}
async function h(req,{params}){
 const p=params.p.join('/'),b=req.method==='POST'?await req.json().catch(()=>({})):{},q=Object.fromEntries(new URL(req.url).searchParams)
 const cfg=await cfgGet(),sec=await getSec();req.__sec=sec
 const svList=()=>SERVERS.map(s=>({...s,...((cfg.srv||{})[s.server]||{})}))
 try{
 if(p==='auth/login'||p==='auth/register'||p==='auth/forgot'||p==='auth/reset'){const ip=(req.headers.get('x-forwarded-for')||'x').split(',')[0].trim();if(await kv.incr(`lg:${ip}:${Math.floor(Date.now()/60000)}`)>12)return E('Terlalu banyak percobaan, coba lagi 1 menit',429)}
 if(p==='auth/register'){
  const email=String(b.email||'').toLowerCase().trim()
  if(!/^\S+@\S+\.\S+$/.test(email)||String(b.password||'').length<6)return E('Email/password tidak valid (min 6 karakter)')
  if(await kv.get('e:'+email))return E('Email sudah terdaftar')
  const rc=String(b.ref||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);let rf=null
  if(rc&&cfg.ref.on){const rfid=await kv.get('rc:'+rc);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)return E('Kode ajakan tidak valid')}
  const u={id:rid(),email,name:b.name||email.split('@')[0],pass:hash(b.password),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),regIp:clientIp(req),refBy:rf?rf.id:null,refPaid:false}
  await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id)
  await kv.sadd('idx',u.id)
  await notify({i:'👤',t:'Pengguna baru bergabung',st:'ok',rows:[['Nama',String(u.name).slice(0,2)+'***'],['Email',mask(email)],['Total pengguna',((await kv.get('idx'))||[]).length],...(rf?[['Diajak oleh',mask(rf.email)]]:[])],note:'Selamat datang di Artapedia ID!'});return J({ok:1},200,await session(u,req))}
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
 // status maintenance (publik, dipakai halaman depan untuk menampilkan pengumuman / layar maintenance)
 if(p==='maintenance'){const m=cfg.maint||{};return J({on:!!m.on,mode:m.mode==='soft'?'soft':'full',msg:m.msg||'',srv:Object.fromEntries(Object.entries(m.srv||{}).filter(([,x])=>x&&x.on).map(([k,x])=>[k,x.msg||'']))},200,{'Cache-Control':'no-store'})}
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
    const {u}=await oaUser(prof,/^[A-Z0-9]{0,12}$/.test(crc||'')?crc:'',cfg)
    if(u.banned)return fail('Akun ini diblokir')
    const hd=new Headers({Location:site(req)+'/dashboard'});hd.append('Set-Cookie',(await session(u,req))['Set-Cookie']);hd.append('Set-Cookie',oaCookie('',0))
    return new Response(null,{status:302,headers:hd})
   }catch(e){return fail('Login '+o.name+' gagal: '+(e.message||'error'))}}}
 if(p==='auth/logout')return J({ok:1},200,{'Set-Cookie':'sid=;Path=/;Max-Age=0'})
 // ---- Webhook deposit (Pakasir & Ditznesia). Isi body TIDAK dipercaya: status selalu dicek ulang ke gateway ----
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
   if(p==='pay/withdraw/wallets'){const w=await PAY.wallets()
    return S({wallets:w.wallets||[],wallet_types:w.wallet_types||{},wallet_has_fixed:w.wallet_has_fixed||{},wallet_has_open_denom:w.wallet_has_open_denom||{}})}
   if(p==='pay/withdraw/products'){if(!q.wallet)return F('Parameter wallet wajib diisi')
    const pr=await PAY.products(q.wallet);return S({products:pr.products||[]})}
   if(p==='pay/withdraw/create'&&req.method==='POST'){
    const r=await PAY.withdraw(cfg,acc.uid,b);return S({withdraw:PAY.wdView(r),status:r.status,message:r.status==='success'?'Dana berhasil dikirim ke tujuan':'Penarikan sedang diproses'})}
   if(p==='pay/withdraw/history'){
    await PAY.syncWd(acc.uid).catch(()=>{})
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
  pops:(cfg.pops||[]).filter(x=>x&&x.on).map(x=>({id:x.id,badge:x.badge||'',title:x.title||'',body:x.body||'',img:x.img||'',theme:x.theme||'pink',days:+x.days||0,delay:+x.delay||0,skip:x.skip||'',only:x.only||'',btns:(x.btns||[]).map(y=>({t:y.t,href:y.href||'',kind:y.kind||'go'}))})),
  cs:(()=>{const i=csInfo(cfg);return {on:!i.off,msg:i.offMsg,open:i.open,hours:i.hours}})(),
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
  if(a==='data'){const ids=(await kv.get('idx'))||[];const us=await Promise.all(ids.map(i=>kv.get('u:'+i)));return J({cfg,servers:svList(),secSet:{ARTA_KEY:!!sec.ARTA_KEY,DITZ_KEY:!!sec.DITZ_KEY},depReady:await readiness(cfg),hook:site(req)+'/api/hook/deposit',ann:(await kv.get('ann'))||[],lb:(await kv.get('lb_manual'))||[],real:(await boardFull()).r,users:us.filter(Boolean).map(({pass,tx,mut,...x})=>x)})}
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
  if(a==='ban'||a==='unban'){t.banned=a==='ban';await save(t);await notify({i:a==='ban'?'⛔':'♻️',t:'Admin '+a+' akun',st:'admin',rows:[['Pengguna',mask(t.email)]]});return J({ok:1})}
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
    if(t==='ditz'){const d=await dz('/profile');return J({ok:true,info:'Terhubung · '+(d.name||d.email||'akun')+' · saldo '+rp(d.balance)})}
    if(t==='arta'){await UPSTREAM('/deposit/methods');return J({ok:true,info:'Terhubung ke Artapedia'})}
    if(t==='telegram'){const r=await notify({i:'✅',t:'Tes notifikasi berhasil',st:'ok',rows:[['Status','Terhubung']]});return J({ok:!!r.ok,info:r.ok?'Pesan tes terkirim ke channel':r.error})}
    if(t==='pakasir'){const s2=await getSec();if(!s2.PAKASIR_SLUG||!s2.PAKASIR_KEY)return J({ok:false,info:'Slug / API key Pakasir belum diisi'})
     const r=await fetch((s2.PAKASIR_BASE||'https://app.pakasir.com')+'/api/transactiondetail?project='+encodeURIComponent(s2.PAKASIR_SLUG)+'&amount=1000&order_id=TEST'+Date.now()+'&api_key='+encodeURIComponent(s2.PAKASIR_KEY),{cache:'no-store',signal:AbortSignal.timeout(15000)})
     return J(r.status===401||r.status===403?{ok:false,info:'Ditolak Pakasir (HTTP '+r.status+'). Cek slug & API key.'}:{ok:true,info:'Pakasir merespons (HTTP '+r.status+'), kredensial tidak ditolak. Uji sebenarnya: buat deposit kecil.'})}
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
    methods:Object.fromEntries(Object.keys(METHODS).map(k=>[k,{on:!!((d.methods||{})[k]||{}).on}]))}
   await kv.set('cfg',cfg);return J({dep:cfg.dep,depReady:await readiness(cfg)})}
  // ---- Server nokos: nama/lencana/deskripsi + negara JasaOTP ----
  if(a==='srv/save'){const ids=SERVERS.map(s=>s.server),o={}
   for(const id of ids){const x=(b.srv||{})[id]||{};o[id]={name:String(x.name||'').trim().slice(0,40),badge:String(x.badge||'').trim().slice(0,24),description:String(x.description||'').trim().slice(0,160)}
    for(const k of Object.keys(o[id]))if(!o[id][k])delete o[id][k]
    // label server: bebas ditambah / diubah / dihapus admin, maksimal 6 per server
    const lb=(Array.isArray(x.labels)?x.labels:[]).map(y=>({t:String((y||{}).t||'').trim().slice(0,18),c:LBC.includes((y||{}).c)?y.c:'blue'})).filter(y=>y.t).slice(0,6)
    if(lb.length)o[id].labels=lb}
   const cc={};for(let i=1;i<=5;i++){const v=String(((b.ditz||{}).countries||{})[i]||'').split(',').map(x=>x.trim().replace(/[^A-Za-z0-9_-]/g,'')).filter(Boolean).slice(0,30);if(v.length)cc[i]=v.join(',')}
   cfg.srv=o;cfg.ditz={countries:cc,max:Math.min(30,Math.max(1,Math.floor(+(b.ditz||{}).max)||10))};await kv.set('cfg',cfg);return J({srv:cfg.srv,ditz:cfg.ditz,servers:svList()})}
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
     days:Math.min(90,Math.max(0,Math.floor(+x.days||0))),delay:Math.min(30,Math.max(0,+x.delay||0)),
     skip:cl(x.skip,200),only:cl(x.only,200),
     btns:(Array.isArray(x.btns)?x.btns:[]).map(y=>({t:cl((y||{}).t,30),href:cl((y||{}).href,300),kind:(y||{}).kind==='no'?'no':'go'})).filter(y=>y.t).slice(0,4)})}
   cfg.pops=out;await kv.set('cfg',cfg);return J({pops:cfg.pops})}
  // ---- Aplikasi APK ----
  if(a==='apk/save'){
   const u2=String(b.url||'').trim()
   if(b.on&&!/^https?:\/\/\S+$/.test(u2)&&!u2.startsWith('/'))return E('Isi tautan APK yang benar (http/https) atau matikan dulu')
   cfg.apk={on:!!b.on,url:u2.slice(0,400),ver:String(b.ver||'').trim().slice(0,20),size:String(b.size||'').trim().slice(0,20),
    note:String(b.note||'').trim().slice(0,600),updated:Date.now()}
   await kv.set('cfg',cfg);return J({apk:cfg.apk})}
  // ---- Saklar customer service (+ alasan kalau dimatikan) ----
  if(a==='cs/mode'){
   const on=b.on!==false,msg=String(b.msg||'').trim().slice(0,300)
   if(!on&&!msg)return E('Isi dulu alasan kenapa CS dimatikan, supaya pengguna tahu')
   cfg.cs={on,msg};await kv.set('cfg',cfg)
   await notify({i:on?'💬':'🚫',t:on?'Customer service DIBUKA':'Customer service DIMATIKAN',st:'admin',rows:[['Status',on?'Aktif (ikut jam layanan)':'Mati'],['Alasan',msg]]})
   return J({cs:cfg.cs})}
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
  // Pengumuman
  if(a==='ann/add'){
   const title=String(b.title||'').trim().slice(0,120),body=String(b.body||'').trim().slice(0,3000);if(!title)return E('Judul wajib diisi')
   let img='';if(b.img){img=String(b.img);if(!/^data:image\/(jpeg|png|webp|gif);base64,/.test(img))return E('Format gambar tidak valid');if(img.length>700000)return E('Gambar terlalu besar (maks ~500KB)')}
   const ann=(await kv.get('ann'))||[];ann.unshift({id:rid().slice(0,10),title,body,img,at:Date.now()});await kv.set('ann',ann.slice(0,50))
   await notify({i:'📣',t:'Pengumuman baru: '+title,st:'info',note:body.slice(0,300)});return J({items:ann})}
  if(a==='ann/del'){const ann=((await kv.get('ann'))||[]).filter(x=>x.id!==b.id);await kv.set('ann',ann);return J({items:ann})}
  // Customer service (sisi admin)
  if(a==='cs/list'){const ix=(await kv.get('csidx'))||[];const th=await Promise.all(ix.map(async id=>{const u=await kv.get('u:'+id),c=await csGet(id);return u&&{uid:id,email:u.email,name:u.name,unread:c.au,at:c.at,last:((c.msgs[c.msgs.length-1]||{}).text||'')||((c.msgs[c.msgs.length-1]||{}).img?'📷 Foto':'')}}));return J({items:th.filter(Boolean).sort((x,y)=>y.at-x.at)})}
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
  if(a==='backup/wipe'){if(b.confirm!=='HAPUS')return E('Konfirmasi salah');let sf=null;try{sf=(await runBackup('manual')).ok}catch(e){}await wipeAll();return J({ok:1,safety:sf})}
  if(a==='backup/import'){try{return J({n:await importItems(b.items)})}catch(e){return E(e.message)}}
  // ---- Notifikasi HP admin (Web Push). Tetap bunyi walau Chrome ditutup. ----
  // ---- Ringkasan uang (tab Ringkasan admin). Dipindai dari semua pengguna, di-cache 60 detik. ----
  if(a==='uang'){
   const c=globalThis.__uang;if(c&&Date.now()-c.t<60000&&!b.fresh)return J(c.d)
   const ids=(await kv.get('idx'))||[]
   const us=(await Promise.all(ids.map(i=>kv.get('u:'+i)))).filter(Boolean)
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
   return J({cfg:PAY.payCfg(cfg),total:tot,austin:await AUS.status(),
    merchants:accs.map((x,i)=>{const sm=PAY.summary(x),o=own[i]
     return {uid:x.uid,email:o?mask(o.email):'(terhapus)',name:o?o.name:'',on:x.on,balance:sm.balance,
      trx:sm.all.count,gross:sm.all.gross,fee:sm.all.fee,out:sm.out.sum,pending:sm.pending,at:x.at}})
     .sort((x,y)=>y.gross-x.gross)})}
  if(a==='pay/save'){const n=(x,lo,hi,df)=>{x=+x;return isNaN(x)?df:Math.min(hi,Math.max(lo,x))}
   const v=b.pay||{}
   cfg.pay={...PAY.payCfg(cfg),on:!!v.on,wdOn:!!v.wdOn,name:String(v.name||'Artapedia Pay').slice(0,40),
    fee:n(v.fee,0,20,0.7),feeFlat:Math.floor(n(v.feeFlat,0,100000,0)),
    min:Math.floor(n(v.min,500,10000000,1000)),max:Math.floor(n(v.max,1000,100000000,10000000)),
    wdMin:Math.floor(n(v.wdMin,0,10000000,10000)),wdFee:Math.floor(n(v.wdFee,0,100000,0)),
    expMin:Math.floor(n(v.expMin,2,60,10))}
   await kv.set('cfg',cfg);return J({pay:cfg.pay})}
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
  if(a==='pay/test')return J(await AUS.status())
  // ---- Admin: reseller (daftar + ubah saldo dompet reseller) ----
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
  if(a==='rs/saldo'){
   const uid=String(b.uid||'');if(!uid)return E('Pilih reseller dulu')
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
  await notify({i:'🔓',t:'Masuk admin lewat pintu rahasia',st:'admin',rows:[['Pengguna',mask(u.email)],['Ketukan',Math.floor(+b.n||0)+'x'],['IP',clientIp(req)||'-']],note:'Kalau ini bukan kamu, segera ubah daftar email di /admin › Sistem.'})
  return J({ok:1,token:tok})}
 // ---- Bot reseller (halaman /reseller) ----
 if(p.startsWith('v1/reseller')){
  const base=(cfg.site.baseUrl||sec.SITE_URL||site(req)||'').replace(/\/+$/,'')
  try{
   if(p==='v1/reseller')return J(await RSL.view(u.id))
   if(p==='v1/reseller/wallets')return J(await RSL.wallets())
   if(p==='v1/reseller/products')return J(await RSL.products(String(q.wallet||'')))
   if(req.method!=='POST')return E('Endpoint tidak ditemukan',404)
   if(p==='v1/reseller/tnc'){await RSL.accept(u.id);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/bot'){await RSL.createBot(u.id,b,base);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/bot/del'){await RSL.delBot(u.id);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/refresh'){await RSL.refresh(u.id);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/markup'){await RSL.setMarkup(u.id,b.markup);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/brand'){await RSL.setBrand(u.id,b.brand);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/channel'){await RSL.setChannel(u.id,b);return J(await RSL.view(u.id))}
   if(p==='v1/reseller/channel/test'){await RSL.testCh(u.id);return J({ok:1,...(await RSL.view(u.id))})}
   // 'trx', bukan 'wd': view() juga punya kunci 'wd' (daftar riwayat) dan akan saling menimpa
   if(p==='v1/reseller/withdraw'){const r=await RSL.withdraw(u.id,b);return J({ok:1,trx:r,...(await RSL.view(u.id))})}
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
   const t=await csPush(u,'user',text,b.img)
   return J({open:true,hours:info.hours,msgs:t.msgs})}
  if(c.uu){c.uu=0;await kv.set('cs:'+u.id,c)}
  return J({...info,msgs:c.msgs})}
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
    return J({on:pc.on,name:pc.name,fee:pc.fee,feeFlat:pc.feeFlat,min:pc.min,max:pc.max,wdMin:pc.wdMin,wdFee:pc.wdFee,wdOn:pc.wdOn,
     acc:{on:a.on,key:a.key,hasSecret:!!a.secret,ipw:a.ipw||[],hook:{url:(a.hook||{}).url||'',on:!!(a.hook||{}).on,secret:(a.hook||{}).secret||'',last:(a.hook||{}).last||null}},
     yourIp:clientIp(req),...PAY.summary(a),
     dep:(a.dep||[]).slice(0,30).map(PAY.depView),wd:(a.wd||[]).slice(0,30).map(PAY.wdView)})}
   if(p==='v1/pay/qris'&&req.method==='POST'){const r=await PAY.createQris(cfg,u.id,b.amount,'web');return J(PAY.depView(r))}
   if(p==='v1/pay/qris'){const r=await PAY.checkQris(cfg,u.id,q.id);if(!r)return E('Transaksi tidak ditemukan',404)
    const a=await acc();return J({...PAY.depView(r),balance:a.balance})}
   if(p==='v1/pay/qris/cancel'&&req.method==='POST'){const r=await PAY.cancelQris(cfg,u.id,b.id);return J(PAY.depView(r))}
   if(p==='v1/pay/wallets'){const w=await PAY.wallets()
    return J({wallets:w.wallets||[],types:w.wallet_types||{},fixed:w.wallet_has_fixed||{},open:w.wallet_has_open_denom||{}})}
   if(p==='v1/pay/products'){if(!q.wallet)return E('Pilih dompet dulu');return J({products:(await PAY.products(q.wallet)).products||[]})}
   if(p==='v1/pay/withdraw'&&req.method==='POST'){const r=await PAY.withdraw(cfg,u.id,b);const a=await acc();return J({...PAY.wdView(r),balance:a.balance})}
   if(p==='v1/pay/history'){await PAY.syncWd(u.id).catch(()=>{});const a=await acc()
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
  const sell=mk(base),guarantee=!!b.guarantee,fee=guarantee?Math.ceil(sell*0.1):0,price=sell+fee
  if(u.balance<price)return E('Saldo tidak cukup')
  // URUTAN AMAN: pesan nomor ke penyedia DULU. Saldo baru dipotong setelah nomor benar-benar didapat,
  // jadi kalau order gagal / timeout, saldo tidak pernah terpotong (tidak ada yang perlu di-refund).
  // Order gagal TIDAK dikirim ke channel Telegram (atas permintaan admin): pembeli cukup melihat pesan errornya.
  let o;try{o=await P[sv].order({...b,server:sv})}
  catch(e){return E(e.message,502)}
  // baca ulang data terbaru tepat sebelum memotong (mencegah tertimpa data lama)
  const f=(await kv.get('u:'+u.id))||u
  if(f.balance<price){try{await P[sv].cancel(o.id)}catch(_){}
   await notify({i:'⚠️',t:'Order dibatalkan (saldo tidak cukup saat konfirmasi)',st:'warn',rows:[['Pengguna',mask(f.email)],['Layanan',b.serviceName||b.serviceId],['Harga',rp(price)],['Saldo sekarang',rp(f.balance)]]});return E('Saldo tidak cukup',402)}
  mut(f,-price,'Order nokos')
  const rec={type:'order',id:o.id,server:sv,serviceId:b.serviceId,serviceName:b.serviceName||b.serviceId,countryName:b.countryName||'',countryId:b.countryId,providerId:b.providerId,operatorId:b.operatorId,phone:o.phone,price,fee,guarantee,status:'pending',otp:null,msg:null,cost:o.cost,expiredAt:o.expiredAt,refunded:false,at:Date.now()}
  f.tx.unshift(rec)
  try{await kv.set('o:'+o.id,f.id);await save(f)}catch(e){try{await P[sv].cancel(o.id)}catch(_){};return E('Gagal menyimpan pesanan. Saldo tidak terpotong, silakan coba lagi.',503)}
  await notify({photo:await strukOrder(rec,host(req)),photoName:'struk-'+rec.id+'.png',i:'📱',t:'Pembelian nokos baru',st:'pending',id:['ID Order',o.id],rows:[['Pengguna',mask(f.email)],['Layanan',rec.serviceName+(rec.countryName?' · '+rec.countryName:'')],['Nomor',o.phone],['Harga',rp(price)],['Jaminan OTP',guarantee?'Aktif (+'+rp(fee)+')':'Tidak'],['Server',sv],['Batas tunggu OTP',wibAt(o.expiredAt)],['Saldo sekarang',rp(f.balance)]],note:'Menunggu kode OTP masuk'})
  return J({orderId:o.id,server:sv,phoneNumber:o.phone,price,fee,guarantee,expiredAt:o.expiredAt,createdAt:new Date(rec.at).toISOString(),balance:f.balance})})()}
  finally{await kv.unlock('ord:'+u.id)}}
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
    if(wait>0)return E(`Order baru bisa dibatalkan setelah ${Math.ceil(CANCEL_WAIT/60000)} menit. Tunggu ${wait} detik.`,400)
    // cek dulu: kalau OTP ternyata sudah masuk, order selesai (bukan dibatalkan) supaya tidak refund ganda
    let s0=null;try{s0=await P[o.server].status(o.id)}catch(e){}
    if(s0&&s0.otp){o.status='success';o.otp=s0.otp;o.msg=s0.msg;await save(u);return E('Kode OTP sudah masuk, pesanan tidak bisa dibatalkan',409)}
    try{await P[o.server].cancel(o.id)}catch(e){return E('Pembatalan ditolak provider: '+e.message,502)}
    o.status='cancelled';await refund(u,o);await notify({i:'❌',t:'Order dibatalkan',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]],note:'Dibatalkan pengguna, saldo sudah kembali'})}
   else{
    const s=await P[o.server].status(o.id)
    if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;await fireOtp(u,o);await notify({photo:await strukOrder(o,host(req),false),photoName:'struk-'+o.id+'.png',i:'🔑',t:'OTP diterima',st:'ok',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)],['Server',o.server]],note:o.guarantee?'Order memakai Jaminan OTP':'Transaksi selesai (done)'})}
    else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';await refund(u,o)}
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
async function H(req,ctx){const r=await h(req,ctx),l=req.__rl
 if(l&&!r.headers.has('X-RateLimit-Limit')){r.headers.set('X-RateLimit-Limit','60');r.headers.set('X-RateLimit-Remaining',String(l.remaining));r.headers.set('X-RateLimit-Reset',String(l.reset))}
 return r}
export {H as GET,H as POST}
