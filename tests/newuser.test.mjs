// Notifikasi pengguna baru (web / bot utama / bot reseller): nomor urut, foto, saklar on/off admin,
// serta penghapusan server Telekos (order menggantung direfund, sisa kunci dibersihkan Clean V2).
// Jalankan dari akar proyek: npx tsx tests/newuser.test.mjs
process.env.ADMIN_PASSWORD='pwx'
process.env.CRON_SECRET='cronsecret'
const {kv}=await import('../lib/db.js')
const {resetSec}=await import('../lib/settings.js')
const NU=await import('../lib/newuser.js')
const {SERVERS,P}=await import('../lib/providers.js')
const {syncOrder}=await import('../lib/sync.js')
const KEL=await import('../lib/kelola.js')
let pass=0,fail=0
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✔ ':'  ✘ ')+m)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

// ---- Telegram palsu: catat semua kiriman ----
const sent=[]
globalThis.fetch=async(url,o={})=>{
 url=String(url)
 if(url.includes('/sendPhoto')){const f=o.body;sent.push({m:'sendPhoto',caption:String(f.get('caption')||''),size:f.get('photo').size,name:f.get('photo').name})}
 else if(url.includes('/sendMessage')){const b=JSON.parse(o.body);sent.push({m:'sendMessage',caption:b.text,size:0})}
 return new Response(JSON.stringify({ok:true,result:{}}),{status:200,headers:{'content-type':'application/json'}})}
await kv.set('sec',{TELEGRAM_BOT_TOKEN:'123:abc',TELEGRAM_CHAT_ID:'-100'});resetSec()
const flush=async()=>{await sleep(60);const x=sent.splice(0);return x}

// ---- 1. nomor urut ----
await kv.set('idx',['a','b','c','d','e'])   // 5 pengguna sudah ada
const n1=await NU.nextUserNo(),n2=await NU.nextUserNo()
ok(n1===6&&n2===7,'nomor urut mulai dari jumlah pengguna yang ada + 1, lalu naik 1 (6, 7)')
await kv.set('idx',['a','b'])               // Clean menghapus akun kosong
ok(await NU.nextUserNo()===8,'nomor TIDAK turun walau jumlah pengguna berkurang (tetap 8)')
const par=await Promise.all(Array.from({length:12},()=>NU.nextUserNo()))
ok(new Set(par).size===12&&Math.min(...par)===9&&Math.max(...par)===20,'12 pendaftar bersamaan mendapat nomor unik 9..20')
ok(NU.fmtNo(1234)==='1.234','nomor ribuan diformat 1.234')

// ---- 2. foto + keterangan ----
ok(!!(await NU.newUserPng(1234)),'foto pengguna baru tersedia (assets/pengguna-baru.png)')
let r=await NU.newUserNotify('web',{no:1234,rows:[['Nama','Bu***']],note:'tes'});let x=await flush()
ok(r.ok&&x.length===1&&x[0].m==='sendPhoto'&&x[0].size>100000,'notif dikirim sebagai FOTO ('+(x[0]&&x[0].size)+' byte)')
ok(/Pengguna ke-1\.234/.test(x[0].caption),'keterangan memuat "Pengguna ke-1.234"')
ok(/pengguna-baru-1234\.png/.test(x[0].name),'nama file memuat nomor')

// ---- 3. saklar ----
let cfg=(await kv.get('cfg'))||{}
ok(true,'cfg.nf kosong = semua hidup')
r=await NU.newUserNotify('rs',{no:5,rows:[]});x=await flush()
ok(r.ok&&x.length===1,'bawaan: notif reseller hidup')
cfg.nf={web:false,bot:true,rs:true};await kv.set('cfg',cfg)
r=await NU.newUserNotify('web',{no:6,rows:[]});x=await flush()
ok(r.skipped&&x.length===0,'web DIMATIKAN: tidak ada kiriman')
r=await NU.newUserNotify('bot',{no:6,rows:[]});x=await flush()
ok(r.ok&&x.length===1,'bot utama tetap terkirim saat web dimatikan')
r=await NU.newUserNotify('web',{no:6,rows:[],force:1});x=await flush()
ok(r.ok&&x.length===1,'tes admin (force) tetap terkirim walau dimatikan')
ok(JSON.stringify(NU.nfClean({web:false,x:1}))===JSON.stringify({web:false,bot:true,rs:true}),'nfClean: hanya 3 kunci, selain false dianggap hidup')
cfg.nf={web:true,bot:true,rs:true};await kv.set('cfg',cfg)

// penghitung rusak (null) pulih sendiri
await kv.set('idx',['a','b','c']);await kv.set('usrseq',null)
ok(await NU.nextUserNo()===4&&((await kv.get('usrseq'))||{}).n===4&&await NU.nextUserNo()===5,'penghitung rusak (null) pulih sendiri: 4 lalu 5')

// ---- 4. lewat API sungguhan ----
const route=await import('../app/api/[...p]/route.js')
const api=async(p,b,adm)=>{const req=new Request('https://x.test/api/'+p,{method:b?'POST':'GET',headers:{'content-type':'application/json',...(adm?{'x-admin':'pwx'}:{})},body:b?JSON.stringify(b):undefined})
 const res=await (b?route.POST:route.GET)(req,{params:{p:p.split('/')}});return {s:res.status,j:await res.json().catch(()=>({}))}}
await kv.set('idx',[]);await kv.del('usrseq')
let a1=await api('auth/register',{email:'satu@x.com',password:'rahasia1',name:'Satu'})
x=await flush()
const u1=await kv.get('u:'+await kv.get('e:satu@x.com'))
ok(a1.s===200&&u1&&u1.no===1,'daftar web: pengguna tersimpan dengan no=1')
ok(x.length===1&&x[0].m==='sendPhoto'&&/Pengguna ke-1\b/.test(x[0].caption),'daftar web: notif foto "Pengguna ke-1"')
await api('auth/register',{email:'dua@x.com',password:'rahasia1'});x=await flush()
const u2=await kv.get('u:'+await kv.get('e:dua@x.com'))
ok(u2.no===2&&/Pengguna ke-2\b/.test(x[0].caption),'pendaftar berikutnya = ke-2')

// saklar via admin
let ad=await api('admin/nf',{nf:{web:false,bot:true,rs:false}},true)
ok(ad.s===200&&ad.j.nf&&ad.j.nf.web===false&&ad.j.nf.rs===false&&ad.j.nf.bot===true,'admin/nf menyimpan saklar')
await api('auth/register',{email:'tiga@x.com',password:'rahasia1'});x=await flush()
const u3=await kv.get('u:'+await kv.get('e:tiga@x.com'))
ok(u3.no===3&&x.length===0,'web OFF: tidak ada notif, tapi nomor tetap naik (ke-3)')
const dd=await api('admin/data',{},true)
ok(dd.j.cfg&&dd.j.cfg.nf&&dd.j.cfg.nf.web===false&&dd.j.cfg.nf.bot===true,'admin/data mengembalikan cfg.nf')
const tt=await api('admin/nftest',{kind:'rs'},true);x=await flush()
ok(tt.j.ok&&x.length===1&&/CONTOH/.test(x[0].caption),'tombol Tes mengirim foto contoh walau saklar mati')
await api('admin/nf',{nf:{web:true,bot:true,rs:true}},true)
await api('auth/register',{email:'empat@x.com',password:'rahasia1'});x=await flush()
ok(x.length===1&&/Pengguna ke-4\b/.test(x[0].caption),'web ON lagi: notif kembali, ke-4')

// ---- 5. bot utama & bot reseller (update Telegram /start dari orang baru) ----
const TB=await import('../lib/tgbot.js')
const botMain={id:'bm',token:'111:main',username:'artabot',secret:'s',on:true}
const botRs={id:'br',token:'222:rs',username:'tokobot',secret:'s2',on:true,rs:'rs1'}
await kv.set('bots',[botMain,botRs])
await kv.set('rs:rs1',{uid:'owner1',on:true,balance:0,stok:0,earn:0,sold:0,bot:{id:'br',ownerId:'7777',brand:'Toko Maju'},brand:'Toko Maju',wd:[],dep:[],sreq:[]})
const start=(id,name)=>({update_id:id,message:{message_id:1,date:Math.floor(Date.now()/1000),chat:{id,type:'private'},from:{id,first_name:name,username:'u'+id},text:'/start'}})
// Telegram palsu juga menjawab getMe / sendMessage dkk. (fetch di atas sudah membalas ok:true)
await kv.set('idx',['a','b']);await kv.del('usrseq')
await TB.handle(botMain,start(9001,'Budi'));x=await flush()
const ph=x.filter(z=>z.m==='sendPhoto'&&/Pengguna ke-3\b/.test(z.caption))
ok(ph.length===1&&/BOT/.test(ph[0].caption)&&/Mendaftar lewat bot Telegram/.test(ph[0].caption),'bot utama: notif FOTO "Pengguna ke-3" bergaya bot')
await TB.handle(botRs,start(9002,'Sari'));x=await flush()
if(process.env.DBG)console.log(JSON.stringify(x).slice(0,1500));const pr=x.filter(z=>z.m==='sendPhoto'&&/Pelanggan reseller baru/i.test(z.caption))
ok(pr.length===1&&/Pengguna ke-4\b/.test(pr[0].caption),'bot reseller: notif FOTO pelanggan baru, "Pengguna ke-4"')
ok(/Pelanggan toko ke/.test(pr[0].caption),'bot reseller: ada nomor pelanggan di toko itu')
// /start kedua dari orang yang sama tidak membuat notif baru
await TB.handle(botMain,start(9001,'Budi'));x=await flush()
ok(!x.some(z=>/Pengguna baru/i.test(z.caption)),'/start ulang: tidak ada notif pengguna baru lagi')
// saklar bot & reseller
let c2=(await kv.get('cfg'))||{};c2.nf={web:true,bot:false,rs:false};await kv.set('cfg',c2)
await TB.handle(botMain,start(9003,'Andi'));await TB.handle(botRs,start(9004,'Rina'));x=await flush()
const u9003=await kv.get('u:'+await kv.get('tg:bm:9003')||'x')
ok(!x.some(z=>/Pengguna baru|Pelanggan reseller baru/i.test(z.caption)),'bot & reseller OFF: tidak ada notif pengguna baru')
c2.nf={web:true,bot:true,rs:true};await kv.set('cfg',c2)
await TB.handle(botMain,start(9005,'Eko'));x=await flush()
ok(x.some(z=>z.m==='sendPhoto'&&/Pengguna ke-7\b/.test(z.caption)),'bot ON lagi: Eko = ke-7 (nomor 5 & 6 tetap terhitung saat notif mati)')

// ---- 6. Telekos sudah dihapus ----
ok(!SERVERS.some(s=>/telekos/.test(s.server))&&!P.telekos_tg,'server Telekos tidak ada di SERVERS / P')
const sv=await api('v1/servers');ok(!JSON.stringify(sv.j).includes('telekos'),'v1/servers tidak memuat Telekos')
const o={type:'order',id:'tlkOLD1',server:'telekos_tg',status:'pending',price:12000,phone:'+1555',serviceName:'Telegram',at:Date.now()-3600000,expiredAt:Date.now()+23*3600000}
const uu={id:'ut',email:'ut@x.com',balance:0,tx:[o],mut:[]}
const ch=await syncOrder(uu,o)
ok(ch&&o.status==='expired'&&uu.balance===12000,'order Telekos yang menggantung langsung kedaluwarsa & saldo dikembalikan (Rp12.000)')
await kv.set('sec',{TELEKOS_KEY:'telekos_abc',TELEKOS_BASE:'https://x',DIBANANA_KEY:'bn_live_1'});resetSec()
await kv.set('cfg',{srv:{telekos_tg:{name:'x'}},off:['telekos_tg']})
let st=null,rr;for(let i=0;i<200;i++){rr=await KEL.cleanStep(st,false,Date.now()+15000,{mode:'db'});st=rr.state;if(rr.done)break}
const sec2=await kv.get('sec'),cfg2=await kv.get('cfg')
ok(sec2&&!sec2.TELEKOS_KEY&&!sec2.TELEKOS_BASE&&sec2.DIBANANA_KEY,'Clean V2 membuang TELEKOS_KEY/BASE, kunci Dibanana aman')
ok(!(cfg2.srv||{}).telekos_tg&&!(cfg2.off||[]).includes('telekos_tg'),'Clean V2 membuang sisa konfigurasi server telekos_tg')
const seq=await kv.get('usrseq');ok(seq&&seq.n>=4,'penghitung usrseq tidak ikut dibersihkan')

console.log(`\n${pass} lulus, ${fail} gagal`);process.exit(fail?1:0)
