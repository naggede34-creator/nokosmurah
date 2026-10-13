// Mesin bot Telegram Artapedia ID. Satu webhook per bot: app/api/tg/[id]/route.js -> handle(bot, update)
// Dirancang cepat: tombol dijawab seketika, data penyedia di-cache, database dibaca paralel, OTP dipantau langsung.
// Tampilan: satu pesan yang diedit (tanpa spam), kartu <blockquote>, tombol inline berwarna, tombol salin.
import crypto from 'crypto'
import {kv} from './db'
import {save,rid,hash} from './auth'
import {tg,getBots,esc,B,U,C,kb,pushUser,quiet} from './tgpush'
import {P,SERVERS} from './providers'
import {getCfg,mut,ensureRef,sellPrice,allUsers} from './bonus'
import {METHODS,ROUTES,methodsList,createDeposit,depCheck,depCancel,applyDep,toMs,readiness} from './deposit'
import {notify,mask,rp,wibAt} from './telegram'
import {getSec} from './settings'
import {replaceIfNeeded} from './sync'
import {fireOtp} from './webhook'
import {runBackup} from './backup'

// ---------- util ----------
const sid=id=>crypto.createHash('md5').update(String(id)).digest('hex').slice(0,10)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const stOf=s=>({success:'🟢',pending:'🟡',cancelled:'⚫',expired:'🔴',completed:'🟢',canceled:'⚫',failed:'🔴'}[s]||'⚪')
const stName=s=>({success:'Berhasil',pending:'Menunggu',cancelled:'Dibatalkan',expired:'Kedaluwarsa',completed:'Berhasil',canceled:'Dibatalkan',failed:'Gagal'}[s]||s)
const getSt=async id=>(await kv.get('tmp:tg:'+id))||{}
const setSt=(id,s)=>kv.set('tmp:tg:'+id,s)
const num=x=>{x=Math.floor(+String(x).replace(/[^\d]/g,''));return Number.isFinite(x)?x:0}
// nominal bebas: 15000 · 15.000 · Rp15.000 · 15k · 15rb · 1,5jt
const parseAmt=t=>{t=String(t||'').toLowerCase().replace(/rp\.?|\s/g,'');const m=t.match(/^(\d[\d.,]*)(k|rb|ribu|jt|juta)?$/);if(!m)return 0
 const mul=m[2]?(/^(jt|juta)$/.test(m[2])?1e6:1e3):1
 const n=m[2]?parseFloat(m[1].replace(',','.').replace(/\.(?=.*\.)/g,'')):parseInt(m[1].replace(/[.,]/g,''),10)
 return Number.isFinite(n)?Math.floor(n*mul):0}
const wibDayStart=()=>{const d=new Date(Date.now()+7*36e5);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-7*36e5}
const BASE=s=>String(s||'').replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'')
const jam=()=>new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).replace('.',':')
const salam=()=>{const h=(new Date().getUTCHours()+7)%24;return h<11?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam'}
const sisa=ms=>{const m=Math.max(0,Math.ceil((ms-Date.now())/60000));return m<=0?'habis':m+' menit'}
// komponen tampilan
const Q=(...l)=>'<blockquote>'+l.flat().filter(Boolean).join('\n')+'</blockquote>'
const H=(ic,t,sub)=>`<b>${ic} ${t}</b>`+(sub?`\n<i>${sub}</i>`:'')
const BACK=[B('🏠 Menu Utama','m','primary')]
// cache ringan di memori instance (hemat panggilan ke penyedia & database)
const memo=(k,ttl,fn)=>{const m=globalThis.__tgm||(globalThis.__tgm={}),c=m[k];if(c&&Date.now()-c.t<ttl)return c.p
 const p=Promise.resolve().then(fn);m[k]={t:Date.now(),p};p.catch(()=>{if(m[k]&&m[k].p===p)delete m[k]});return p}
const cfgFast=async()=>{const m=globalThis.__tgc;if(m&&Date.now()-m.t<4000)return m.v;const v=await getCfg();globalThis.__tgc={t:Date.now(),v};return v}
const putCfg=async cfg=>{await kv.set('cfg',cfg);globalThis.__tgc=null}
const svItems=sv=>memo('sv:'+sv,90000,async()=>(await P[sv].services()).map(x=>({c:x.service_code,n:String(x.service_name)})).sort((a,b)=>a.n.localeCompare(b.n)))
const ctRaw=(sv,sid)=>memo(`ct:${sv}:${sid}`,30000,()=>P[sv].countries(sid))
// tabel monospasi bergaris (mirip tabel Field | Detail)
const tbl=rows=>{const cl=x=>String(x).replace(/[^\x20-\x7E]/g,'').trim().slice(0,17),r=rows.map(([k,v])=>[cl(k),cl(v)||'-']),w1=Math.max(5,...r.map(x=>x[0].length)),w2=Math.max(6,...r.map(x=>x[1].length))
 const ln=(a,b,c)=>a+'─'.repeat(w1+2)+b+'─'.repeat(w2+2)+c,row=(k,v)=>`│ ${k.padEnd(w1)} │ ${v.padEnd(w2)} │`
 return '<pre>'+esc([ln('┌','┬','┐'),row('Field','Detail'),ln('├','┼','┤'),...r.map(x=>row(x[0],x[1])),ln('└','┴','┘')].join('\n'))+'</pre>'}
// font hias (Unicode Sans-Serif Bold) untuk label menu bot
const fx=t=>String(t).replace(/[A-Za-z0-9]/g,ch=>{const c=ch.charCodeAt(0);return String.fromCodePoint(c>=97?0x1D5EE+(c-97):c>=65?0x1D5D4+(c-65):0x1D7EC+(c-48))})
const shopStats=()=>memo('shopstats',300000,async()=>{const us=await allUsers();let ord=0,inc=0;for(const u of us)for(const x of u.tx||[])if(x.type==='order'&&x.status==='success'){ord++;inc+=x.price};return {users:us.length,ord,inc}})
const lvl=n=>n>=200?'Platinum':n>=50?'Gold':n>=10?'Silver':'Reguler'
const runtime=at=>{const m=Math.max(0,Math.floor((Date.now()-(+at||Date.now()))/60000));return `${Math.floor(m/1440)}d ${Math.floor(m%1440/60)}h ${m%60}m`}
const ov=x=>x!==''&&x!=null&&/^\d+$/.test(String(x))?+x:null
const POP=['whatsapp','telegram','facebook','instagram','tiktok','google','shopee','gojek','grab','tokopedia','twitter','discord','dana','ovo']

// ---------- pengiriman pesan ----------
const send=(c,text,k)=>tg(c.bot.token,'sendMessage',{chat_id:c.chat,text,parse_mode:'HTML',disable_web_page_preview:true,...(k?{reply_markup:k}:{})})
const typing=c=>{tg(c.bot.token,'sendChatAction',{chat_id:c.chat,action:'typing'})}
async function show(c,text,k,keepPhoto){
 if(c.mid){
  if(c.isPhoto&&!keepPhoto){tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid});return send(c,text,k)}
  const r=await tg(c.bot.token,c.isPhoto?'editMessageCaption':'editMessageText',{chat_id:c.chat,message_id:c.mid,...(c.isPhoto?{caption:text}:{text,disable_web_page_preview:true}),parse_mode:'HTML',reply_markup:k||{inline_keyboard:[]}})
  if(r.ok||/not modified/i.test(r.description||''))return r}
 return send(c,text,k)}
// jawab tombol: hanya sekali. Dipakai juga untuk popup teks.
const toast=(c,text,alert)=>{if(!c.cbq||c.answered)return;c.answered=true;return tg(c.bot.token,'answerCallbackQuery',{callback_query_id:c.cbq,text:String(text||'').slice(0,190),show_alert:!!alert})}

// ---------- akun ----------
async function getUser(c){
 const id=c.from.id,uid=await kv.get('tg:'+id);let u=uid&&await kv.get('u:'+uid)
 const name=[c.from.first_name,c.from.last_name].filter(Boolean).join(' ').trim()||c.from.username||('User '+id)
 if(u){let ch=false;if(u.tgBot!==c.bot.id){u.tgBot=c.bot.id;ch=true};if(u.tgBlocked){u.tgBlocked=false;ch=true};if((c.from.username||'')!==(u.tgUser||'')){u.tgUser=c.from.username||'';ch=true};if(ch)await save(u);return u}
 const cfg=await getCfg(),email=`tg${id}@telegram.invalid`
 let rf=null;if(c.ref&&cfg.ref.on){const rfid=await kv.get('rc:'+c.ref);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)rf=null}
 u={id:rid(),email,name,pass:hash(rid()),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),refBy:rf?rf.id:null,refPaid:false,tgId:id,tgUser:c.from.username||'',tgBot:c.bot.id,via:'telegram'}
 await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id);await kv.set('tg:'+id,u.id)
 await kv.sadd('idx',u.id);await kv.sadd('tgidx',id)
 const total=((await kv.get('idx'))||[]).length
 await notify({src:'bot',i:'👤',t:'Pengguna baru',st:'ok',rows:[['Nama',String(name).slice(0,2)+'***'],['Telegram',c.from.username?'@'+c.from.username:'ID '+id],['Total pengguna',total],...(rf?[['Diajak oleh',mask(rf.email)]]:[])],note:'Mendaftar lewat bot Telegram'})
 return u}
const okOrders=u=>(u.tx||[]).filter(x=>x.type==='order'&&x.status==='success')
const siteOf=c=>BASE(c.cfg.site.baseUrl||c.sec.SITE_URL||c.bot.site||'')

// ---------- menu utama (banner + kotak nama + teks Information + tombol) ----------
const BANNER_V=2   // naikkan angka ini bila public/bot-banner.jpg diganti, supaya cache lama dibuang
const DEFAULT_BANNER=c=>{const w=siteOf(c);return w?w+'/bot-banner.jpg':''}
async function mainMenu(c,u){
 const ok=okOrders(u),web=siteOf(c),m=c.cfg.maint||{}
 const st=await Promise.race([shopStats(),sleep(900).then(()=>null)]),cs=c.cfg.stats||{}
 const trx=(ov(cs.orders)??(st?st.ord:'-'))+(st||ov(cs.orders)!=null?'x':''),usr=ov(cs.users)??(st?st.users:'-')
 const L=(ic,k,v)=>`${ic} <b>${fx(k)}</b>  ›  ${v}`
 const text=`<blockquote><b>✦ ${fx('ARTA PEDIA ID')}</b>${m.on?'  ·  🔴 Maintenance':''}</blockquote>\n`+
  `<i>${salam()}, ${esc(String(u.name).slice(0,24))} ✨</i>\n\n`+
  `<b>${fx('Information')}</b>\n`+
  `<blockquote>${[L('👤','Nama',esc(String(u.name).slice(0,24))),L('🏅','Status',c.adm?'Admin':lvl(ok.length)),L('💰','Saldo',rp(u.balance)),L('🛒','Order Kamu',ok.length+'x'),L('🔁','Transaksi',trx),L('⏱','Runtime',runtime(c.bot.at)),L('👥','Users',usr)].join('\n')}</blockquote>\n`+
  `💡 <i>Pilih menu yang tersedia di bawah ini.</i>`
 const k=[[B('🛍 Belanja Nokos','buy','primary')],
  [B('💰 Isi Saldo','dep','success'),B('📜 Riwayat','his:0')],
  [B('👤 Akun','acc'),B('🎁 Ajak Teman','ref','success')],
  [web?U('🌐 Buka Web',web+'/dashboard'):B('🌐 Web','web'),B('💬 Bantuan','help')]]
 if(c.adm)k.push([B('🛠 Panel Admin','a','danger')])
 return [text,kb(k)]}
const SENDM={photo:['sendPhoto','photo'],video:['sendVideo','video'],animation:['sendAnimation','animation']}
async function menu(c,u,note){
 const [t0,k]=await mainMenu(c,u),text=(note?note+'\n\n':'')+t0
 let bn=await kv.get('tgbn:'+c.bot.id);if(bn&&bn.auto&&bn.v!==BANNER_V)bn=null   // banner bawaan versi lama -> ganti yang baru
 if(!bn){const url=DEFAULT_BANNER(c);if(url)bn={t:'photo',f:url+'?v='+BANNER_V,auto:1}}
 const old=c.mid,clean=()=>{if(old)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:old})}
 if(bn&&SENDM[bn.t]&&text.length<=1000){
  const [mt,fld]=SENDM[bn.t],r=await tg(c.bot.token,mt,{chat_id:c.chat,[fld]:bn.f,caption:text,parse_mode:'HTML',reply_markup:k,...(bn.t==='video'?{supports_streaming:true}:{})})
  if(r.ok){clean()
   // simpan file_id supaya pengiriman berikutnya instan (tanpa Telegram mengunduh gambar lagi)
   if(bn.auto&&r.result&&r.result.photo){kv.set('tgbn:'+c.bot.id,{t:'photo',f:r.result.photo[r.result.photo.length-1].file_id,auto:1,v:BANNER_V})}
   return r}
  if(!bn.auto)kv.del('tgbn:'+c.bot.id)}   // banner buatan admin rusak -> kembali ke bawaan
 const r=await send(c,text,k);if(r.ok)clean();return r}

// ---------- akun / riwayat / mutasi / referral / bantuan ----------
async function accView(c,u){
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),tgOnly=/@telegram\.invalid$/.test(u.email)
 const text=`<blockquote><b>👤 AKUN SAYA</b></blockquote>\n${tbl([['Nama',u.name],['Status',c.adm?'Admin':lvl(ok.length)],['Saldo',rp(u.balance)],['Order',ok.length+'x'],['Belanja',rp(spent)],['Bergabung',wibAt(Date.parse(u.joinedAt)).replace(' WIB','')]])}\n📧 <code>${esc(u.email)}</code>\n<i>${tgOnly?'Akun dibuat dari Telegram. Buat password agar bisa masuk di web.':'Akun web &amp; bot memakai saldo yang sama.'}</i>`
 return show(c,text,kb([[B('💰 Isi Saldo','dep','success'),B('📜 Riwayat','his:0')],[B('🔑 Password Web','pw','success'),B('🔗 Hubungkan Web','lnk')],BACK]))}
async function hisView(c,u,page){
 const all=(u.tx||[]).filter(x=>x.type==='order'),pg=Math.max(0,+page||0),items=all.slice(pg*5,pg*5+5)
 const text=`${H('📜','RIWAYAT ORDER',all.length?`${all.length} order · hal ${pg+1}/${Math.ceil(all.length/5)}`:'')}\n\n`+(items.length?'Ketuk order untuk melihat detail 👇':'<i>Belum ada order. Yuk beli nokos pertamamu!</i>')
 const rows=items.map(o=>[B(`${stOf(o.status)} ${String(o.serviceName).slice(0,16)} · ${o.phone}`,'ord:'+sid(o.id),o.status==='success'?'success':o.status==='pending'?'primary':'danger')])
 const nav=[];if(pg>0)nav.push(B('⬅️ Baru','his:'+(pg-1)));if((pg+1)*5<all.length)nav.push(B('Lama ➡️','his:'+(pg+1)))
 return show(c,text,kb([...rows,nav,[B('🛒 Beli Lagi','buy','success'),...BACK]]))}
async function mutView(c,u,page){
 const all=u.mut||[],pg=Math.max(0,+page||0),items=all.slice(pg*8,pg*8+8)
 const text=`${H('🧾','MUTASI SALDO',all.length?`hal ${pg+1}/${Math.ceil(all.length/8)}`:'')}\n\n`+(items.length?Q(items.map(m=>`${m.amt>=0?'🟢':'🔴'} <b>${m.amt>=0?'+':'-'}${rp(Math.abs(m.amt))}</b> → ${rp(m.bal)}\n<i>${esc(String(m.note||'').slice(0,34))} · ${wibAt(m.at)}</i>`).join('\n')):'<i>Belum ada mutasi.</i>')
 const nav=[];if(pg>0)nav.push(B('⬅️ Baru','mut:'+(pg-1)));if((pg+1)*8<all.length)nav.push(B('Lama ➡️','mut:'+(pg+1)))
 return show(c,text,kb([nav,[B('💰 Isi Saldo','dep','success'),...BACK]]))}
async function refView(c,u){
 await ensureRef(u);const cf=c.cfg.ref,web=siteOf(c),link=`https://t.me/${c.bot.username}?start=ref_${u.refCode||''}`
 const text=`${H('🎁','AJAK TEMAN','Dapat bonus tiap teman yang deposit')}\n\n${Q(`🔖 Kode  <code>${esc(u.refCode||'-')}</code>`,`👥 Teman  <b>${u.refCount||0}</b>`,`💎 Bonus  <b>${rp(u.refEarn||0)}</b>`)}\n${cf.on?`Kamu dapat <b>${rp(cf.referrer)}</b>, temanmu dapat <b>${rp(cf.referee)}</b> setelah deposit min. <b>${rp(cf.minDep)}</b>.`:'<i>Program ajakan sedang nonaktif.</i>'}\n\n🔗 <code>${esc(link)}</code>`
 return show(c,text,kb([[U('📤 Bagikan Link','https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('Beli nomor OTP murah & otomatis di Artapedia ID'),'success'),C('📋 Salin Link',link)],...(web?[[C('🌐 Salin Link Web',web+'/register?ref='+(u.refCode||''))]]:[]),BACK]))}
async function helpView(c){
 const web=siteOf(c),btn=(c.cfg.buttons||[]).filter(b=>b&&b.text&&/^https?:\/\//.test(b.url||'')).slice(0,4)
 const text=`${H('💬','BANTUAN')}\n\n${Q('1️⃣ <b>Isi saldo</b> via QRIS / Virtual Account','2️⃣ <b>Beli nokos</b>: server → aplikasi → negara','3️⃣ Kode <b>OTP dikirim otomatis</b> ke chat ini','4️⃣ OTP tak masuk? Batalkan, saldo kembali')}\n<i>Butuh bantuan lain? Hubungi CS di bawah.</i>`
 return show(c,text,kb([web?[U('💬 Chat CS di Web',web+'/cs','success')]:[],...btn.map(b=>[U(b.text,b.url)]),BACK]))}
async function webView(c){return show(c,'⚠️ URL situs belum diisi admin.',kb([BACK]))}

// ---------- password web / hubungkan akun ----------
async function pwView(c,u){
 const web=siteOf(c);if(!web)return show(c,'⚠️ URL situs belum diisi admin.',kb([[B('⬅️ Kembali','acc')]]))
 const tk=rid();await kv.set('pr:'+tk,{id:u.id,exp:Date.now()+30*60000})
 return show(c,`${H('🔑','PASSWORD WEB','Link berlaku 30 menit, sekali pakai')}\n\nBuat password lewat tombol di bawah, lalu masuk di web dengan email:\n<code>${esc(u.email)}</code>`,kb([[U('🔐 Buat Password',web+'/reset?token='+tk,'success'),C('📋 Salin Email',u.email)],[B('⬅️ Kembali','acc')]]))}
async function lnkView(c){
 await setSt(c.from.id,{k:'link'})
 return show(c,`${H('🔗','HUBUNGKAN AKUN WEB','Saldo &amp; riwayat jadi satu')}\n\n${Q('1️⃣ Web › Dashboard › Beranda › <b>Hubungkan Telegram</b> › pilih bot ini','2️⃣ Salin kode yang muncul','3️⃣ <b>Kirim kodenya ke chat ini</b> 👇')}\n<i>Syarat: saldo akun bot Rp0 dan tidak ada order berjalan.</i>`,kb([[B('❌ Batal','m','danger')]]))}
async function doLink(c,u,code){
 code=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')
 const r=code&&await kv.get('tmp:tgl:'+code);await setSt(c.from.id,{})
 if(!r||r.exp<Date.now())return show(c,'❌ Kode tidak valid atau kedaluwarsa. Buat kode baru di web.',kb([[B('🔄 Coba Lagi','lnk'),B('🏠 Menu','m','danger')]]))
 if(r.bot&&r.bot!==c.bot.id){const ob=(await getBots()).find(x=>x.id===r.bot);return show(c,`❌ Kode ini dibuat untuk bot <b>@${esc(ob?ob.username:'lain')}</b>. Kirim kodenya di sana, atau buat kode baru untuk bot ini di web.`,kb([BACK]))}
 const w=await kv.get('u:'+r.uid);if(!w||w.banned)return show(c,'❌ Akun web tidak ditemukan / diblokir.',kb([BACK]))
 if(w.id===u.id)return show(c,'✅ Akun ini sudah terhubung.',kb([BACK]))
 if(w.tgId&&w.tgId!==c.from.id)return show(c,'❌ Akun web itu sudah terhubung ke Telegram lain.',kb([BACK]))
 if(u.balance>0||(u.tx||[]).some(x=>x.status==='pending'))return show(c,'❌ Akun bot punya saldo / order berjalan. Habiskan dulu, atau minta admin memindahkan.',kb([BACK]))
 w.tgId=c.from.id;w.tgUser=c.from.username||'';w.tgBot=c.bot.id;await save(w);await kv.set('tg:'+c.from.id,w.id);await kv.del('tmp:tgl:'+code)
 await kv.del('u:'+u.id);await kv.del('e:'+u.email);await kv.del('k:'+u.apikey)
 await kv.set('idx',((await kv.get('idx'))||[]).filter(x=>x!==u.id))
 await notify({src:'bot',i:'🔗',t:'Akun web terhubung',st:'ok',rows:[['Pengguna',mask(w.email)],['Telegram',c.from.username?'@'+c.from.username:'ID '+c.from.id]]})
 return show(c,`${H('✅','TERHUBUNG')}\n\n${Q(`📧 <code>${esc(mask(w.email))}</code>`,`👛 Saldo  <b>${rp(w.balance)}</b>`)}`,kb([[B('🏠 Menu Utama','m','success')]]))}

// ---------- BELI NOKOS ----------
const maintBlock=c=>{const m=c.cfg.maint||{};return m.on?(m.msg||'Situs sedang maintenance, pesanan & deposit baru dihentikan sementara.'):''}
const maintView=(c,mb)=>show(c,`${H('🛠','MAINTENANCE')}\n\n${Q(esc(mb))}`,kb([BACK]))
function svList(c){return SERVERS.map(s=>({...s,...((c.cfg.srv||{})[s.server]||{})})).filter(s=>!c.cfg.off.includes(s.server)&&(!s.needs||c.sec[s.needs]))}
async function buyStart(c,u){
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 const sv=svList(c);if(!sv.length)return show(c,'⚠️ Belum ada server nokos yang aktif.',kb([BACK]))
 const m=(c.cfg.maint||{}).srv||{}
 const rows=sv.map(s=>{const i=SERVERS.findIndex(x=>x.server===s.server),mm=m[s.server]&&m[s.server].on;return [B(`${mm?'🛠':'🖥'} ${s.name}${s.badge?' · '+s.badge:''}`,'bs:'+i,mm?'danger':'success')]})
 const text=`${H('🛒','BELI NOKOS','Langkah 1 dari 3 · pilih server')}\n\n${Q(`👛 Saldo  <b>${rp(u.balance)}</b>`)}\n`+sv.map(s=>`▫️ <b>${esc(s.name)}</b> — <i>${esc(s.description||'')}</i>`).join('\n')
 return show(c,text,kb([...rows,BACK]))}
async function pickServer(c,u,i){
 const s=SERVERS[+i];if(!s||!P[s.server])return show(c,'⚠️ Server tidak dikenal.',kb([[B('⬅️ Server','buy')]]))
 const mm=((c.cfg.maint||{}).srv||{})[s.server];if(mm&&mm.on)return show(c,`${H('🛠','SERVER MAINTENANCE')}\n\n${Q(esc(mm.msg||'Server ini sedang maintenance, coba server lain.'))}`,kb([[B('⬅️ Pilih Server','buy')]]))
 typing(c);let items;try{items=await svItems(s.server)}catch(e){return show(c,'⚠️ Gagal memuat aplikasi: '+esc(e.message),kb([[B('🔄 Coba Lagi','bs:'+i),B('⬅️ Server','buy','danger')]]))}
 await setSt(c.from.id,{k:'buy',sv:s.server,q:''});return svPage(c,0)}
async function svPage(c,page){
 const st=await getSt(c.from.id);if(st.k!=='buy'||!st.sv)return show(c,'Sesi habis. Mulai lagi.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 let all;try{all=await svItems(st.sv)}catch(e){return show(c,'⚠️ Gagal memuat aplikasi: '+esc(e.message),kb([[B('🔄 Coba Lagi','bl:0'),...BACK]]))}
 const q=(st.q||'').toLowerCase(),idx=x=>all.indexOf(x)
 const pop=!q?POP.map(p=>all.find(x=>x.n.toLowerCase().includes(p))).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,6):[]
 const list=(q?all.filter(x=>x.n.toLowerCase().includes(q)):all.filter(x=>!pop.includes(x))),PER=10
 const tp=Math.max(1,Math.ceil(list.length/PER)),pg=Math.min(Math.max(0,+page||0),tp-1),cur=list.slice(pg*PER,pg*PER+PER)
 const sn=(SERVERS.find(x=>x.server===st.sv)||{}).name
 const text=`${H('📱','PILIH APLIKASI','Langkah 2 dari 3')}\n\n${Q(`🖥 Server  <b>${esc(sn)}</b>`,q?`🔍 Cari  <b>${esc(st.q)}</b>`:'',`📚 ${q?list.length+' hasil dari '+all.length+' aplikasi':all.length+' aplikasi'}`)}\n<i>💡 Ketik nama aplikasi untuk mencari (mis. whatsapp)</i>${(!cur.length&&!pop.length)?'\n\n⚠️ Tidak ada hasil.':''}`
 const rows=[]
 if(pg===0)for(let i=0;i<pop.length;i+=3)rows.push(pop.slice(i,i+3).map(x=>B('⭐ '+x.n.slice(0,14),'bp:'+idx(x),'success')))
 for(let i=0;i<cur.length;i+=2)rows.push(cur.slice(i,i+2).map(x=>B(x.n.slice(0,22),'bp:'+idx(x))))
 const nav=[];if(pg>0)nav.push(B('⬅️','bl:'+(pg-1)));nav.push(B(`${pg+1}/${tp}`,'bl:'+pg));if(pg<tp-1)nav.push(B('➡️','bl:'+(pg+1)))
 const tools=[B('🔍 Cari','bq','success')];if(q)tools.push(B('✖️ Hapus','bx','danger'))
 return show(c,text,kb([...rows,nav,tools,[B('⬅️ Server','buy'),B('🏠 Menu','m','danger')]]))}
async function pickService(c,u,i){
 const st=await getSt(c.from.id);if(st.k!=='buy')return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 let s;try{s=(await svItems(st.sv))[+i]}catch(e){}
 if(!s)return show(c,'⚠️ Aplikasi tidak ditemukan. Muat ulang daftar.',kb([[B('🔄 Muat Ulang','bl:0')]]))
 typing(c);let cs;try{cs=await ctRaw(st.sv,s.c)}catch(e){return show(c,'⚠️ Gagal memuat harga: '+esc(e.message),kb([[B('🔄 Coba Lagi','bp:'+i),B('⬅️ Kembali','bl:0')]]))}
 const opts=[];for(const ct of cs)for(const x of ct.pricelist||[])opts.push({cn:ct.name,fl:ct.flag||'',cid:x.country_id,pid:x.provider_id,pn:x.provider_name||'',price:sellPrice(c.cfg,st.sv,x.price),stock:x.stock})
 opts.sort((a,b)=>a.price-b.price)
 await setSt(c.from.id,{k:'buy',sv:st.sv,sid:s.c,sname:s.n,opts:opts.slice(0,60),g:0});return optPage(c,u,0)}
async function optPage(c,u,page){
 const st=await getSt(c.from.id);if(st.k!=='buy'||!st.opts)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const PER=8,tp=Math.max(1,Math.ceil(st.opts.length/PER)),pg=Math.min(Math.max(0,+page||0),tp-1),cur=st.opts.slice(pg*PER,pg*PER+PER)
 const text=`${H('🌍','NEGARA &amp; HARGA','Langkah 3 dari 3')}\n\n${Q(`📲 <b>${esc(st.sname)}</b>`,`👛 Saldo  <b>${rp(u.balance)}</b>`,`📚 ${st.opts.length} pilihan`)}\n${st.opts.length?'<i>🟢 saldo cukup · 🔴 saldo kurang · angka = stok</i>':'⚠️ Stok kosong untuk aplikasi ini. Coba server lain.'}`
 const rows=cur.map((o,j)=>[B(`${o.fl||'🌐'} ${o.cn.slice(0,14)}${o.pn?' · '+o.pn.slice(0,10):''} · ${rp(o.price)}${o.stock!=null?' · '+o.stock:''}`,'bo:'+(pg*PER+j),u.balance>=o.price?'success':'danger')])
 const nav=[];if(pg>0)nav.push(B('⬅️','bt:'+(pg-1)));nav.push(B(`${pg+1}/${tp}`,'bt:'+pg));if(pg<tp-1)nav.push(B('➡️','bt:'+(pg+1)))
 return show(c,text,kb([...rows,nav,[B('⬅️ Aplikasi','bl:0'),B('🏠 Menu','m','danger')]]))}
async function confirmView(c,u,i,g){
 const st=await getSt(c.from.id),o=st.k==='buy'&&st.opts&&st.opts[+i];if(!o)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 if(g!=null){st.g=+g?1:0;await setSt(c.from.id,st)}
 const fee=st.g?Math.ceil(o.price*0.1):0,total=o.price+fee,cukup=u.balance>=total
 const text=`${H('🧾','KONFIRMASI PESANAN')}\n\n${Q(`📲 <b>${esc(st.sname)}</b>`,`🌍 ${esc(o.cn)}${o.pn?' · '+esc(o.pn):''}`,`🏷 Harga  <b>${rp(o.price)}</b>`,`🛡 Jaminan OTP  <b>${st.g?'Aktif +'+rp(fee):'Tidak'}</b>`)}\n${Q(`💳 Total  <b>${rp(total)}</b>`,`👛 Saldo  <b>${rp(u.balance)}</b>${cukup?'':'  ⚠️ kurang '+rp(total-u.balance)}`)}\n<i>🛡 Jaminan: nomor diganti otomatis bila OTP belum masuk 4 menit; gagal total = refund penuh.</i>`
 return show(c,text,kb([[B(st.g?'🛡 Jaminan ON · ketuk matikan':'🛡 Jaminan OFF · ketuk aktifkan','bg:'+i+':'+(st.g?0:1),st.g?'success':'primary')],
  cukup?[B('✅ Beli Sekarang','bgo:'+i,'success')]:[B('💰 Isi Saldo','dep','success')],[B('⬅️ Pilihan Lain','bt:0'),B('❌ Batal','m','danger')]]))}
async function placeOrder(c,u0,i){
 const st=await getSt(c.from.id),o=st.k==='buy'&&st.opts&&st.opts[+i];if(!o)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 // kunci anti klik ganda (dua ketukan cepat tidak boleh membeli dua kali)
 if(await kv.incr(`rl:ord:${c.from.id}:${Math.floor(Date.now()/4000)}`)>1)return
 typing(c)
 const [u,raw]=await Promise.all([kv.get('u:'+u0.id),ctRaw(st.sv,st.sid).catch(()=>null)])
 if(u.banned)return show(c,'⛔ Akun ditangguhkan.')
 let base=null;if(raw)for(const ct of raw)for(const x of ct.pricelist)if(x.provider_id==o.pid&&x.country_id==o.cid)base=x.price
 if(base==null)return show(c,'⚠️ Stok / harga berubah. Pilih ulang.',kb([[B('🔄 Pilih Ulang','bt:0')]]))
 const sell=sellPrice(c.cfg,st.sv,base);if(sell!==o.price)return show(c,`⚠️ Harga berubah menjadi <b>${rp(sell)}</b>. Pilih ulang untuk melanjutkan.`,kb([[B('🔄 Pilih Ulang','bt:0')]]))
 const g=!!st.g,fee=g?Math.ceil(sell*0.1):0,price=sell+fee
 if(u.balance<price)return show(c,'⚠️ Saldo tidak cukup.',kb([[B('💰 Isi Saldo','dep','success'),...BACK]]))
 // URUTAN AMAN: pesan nomor DULU, saldo dipotong setelah berhasil. Gagal/timeout = saldo tidak pernah terpotong.
 let r;try{r=await P[st.sv].order({serviceId:st.sid,countryId:o.cid,providerId:o.pid,serviceName:st.sname,countryName:o.cn,server:st.sv})}
 catch(e){notify({src:'bot',i:'⚠️',t:'Order gagal (saldo tidak terpotong)',st:'fail',rows:[['Pengguna',mask(u.email)],['Layanan',st.sname],['Server',st.sv],['Harga',rp(price)],['Error',String(e.message).slice(0,200)]]})
  return show(c,`${H('❌','ORDER GAGAL')}\n\n${Q(esc(String(e.message).slice(0,200)))}\n<i>Saldo kamu tidak terpotong.</i>`,kb([[B('🔄 Coba Lagi','bt:0'),B('🏠 Menu','m','danger')]]))}
 const f=(await kv.get('u:'+u.id))||u   // data terbaru tepat sebelum memotong
 if(f.balance<price){try{await P[st.sv].cancel(r.id)}catch(_){};return show(c,'⚠️ Saldo tidak cukup saat konfirmasi. Tidak ada saldo terpotong.',kb([[B('💰 Isi Saldo','dep','success'),...BACK]]))}
 mut(f,-price,'Order nokos (bot)')
 const rec={type:'order',id:r.id,server:st.sv,serviceId:st.sid,serviceName:st.sname,countryName:o.cn,countryId:o.cid,providerId:o.pid,phone:r.phone,price,fee,guarantee:g,status:'pending',otp:null,msg:null,cost:r.cost,expiredAt:r.expiredAt,refunded:false,at:Date.now(),via:'telegram'}
 f.tx.unshift(rec)
 try{await Promise.all([kv.set('o:'+r.id,f.id),save(f),setSt(c.from.id,{})])}catch(e){try{await P[st.sv].cancel(r.id)}catch(_){};return show(c,'⚠️ Gagal menyimpan pesanan. Saldo tidak terpotong, coba lagi.',kb([[B('🔄 Coba Lagi','bt:0')]]))}
 notify({src:'bot',i:'📱',t:'Pembelian nokos',st:'pending',id:['ID Order',r.id],rows:[['Pengguna',mask(f.email)],['Layanan',st.sname+' · '+o.cn],['Nomor',r.phone],['Harga',rp(price)],['Jaminan OTP',g?'Aktif (+'+rp(fee)+')':'Tidak'],['Server',st.sv],['Batas tunggu OTP',wibAt(r.expiredAt)],['Saldo sekarang',rp(f.balance)]],note:'Menunggu kode OTP masuk'})
 const res=await orderView(c,f,rec,'✅ <b>Pesanan dibuat!</b> Kode OTP muncul di sini otomatis.')
 // pantau OTP langsung beberapa detik (tanpa menunggu cron 1 menit)
 const mid=(res&&res.result&&res.result.message_id)||c.mid
 if(mid)await watchOrder(c,f.id,r.id,mid)
 return res}
function orderCard(o,note){
 const s=sid(o.id),pend=o.status==='pending'
 const lines=[`📲 <b>${esc(o.serviceName)}</b>${o.countryName?' · '+esc(o.countryName):''}`,`☎️ <code>${esc(o.phone)}</code>`,`🏷 ${rp(o.price)}${o.guarantee?'  🛡 Jaminan':''}`]
 if(o.otp)lines.push(`🔐 Kode OTP  <code>${esc(o.otp)}</code>`)
 if(pend)lines.push(`⏳ Sisa waktu  <b>${sisa(o.expiredAt)}</b>`)
 const head=`<b>📱 ORDER</b>  ${stOf(o.status)} <b>${stName(o.status)}</b>`
 const text=(note?note+'\n\n':'')+head+'\n\n'+Q(lines)+`\n🆔 <code>${esc(o.id)}</code>`
 const rows=[]
 if(pend)rows.push([B('🔄 Cek OTP','oc:'+s,'success'),B('❌ Batalkan','ox:'+s,'danger')])
 const cp=[C('📋 Salin Nomor',o.phone)];if(o.otp)cp.push(C('📋 Salin OTP',o.otp,'success'));rows.push(cp)
 rows.push([B('🛒 Beli Lagi','buy','success'),...BACK])
 return [text,kb(rows)]}
function orderView(c,u,o,note){const [t,k]=orderCard(o,note);return show(c,t,k)}
const findOrder=(u,s)=>(u.tx||[]).find(x=>x.type==='order'&&sid(x.id)===s)
async function pollOrder(u,o,dm){
 if(o.status!=='pending')return
 const s=await P[o.server].status(o.id)
 if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;if(!dm)o.tgSent=true;await fireOtp(u,o)
  notify({src:'bot',i:'🔑',t:'OTP diterima',st:'ok',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)],['Server',o.server]],note:o.guarantee?'Order memakai Jaminan OTP':'Transaksi selesai (done)'})}
 else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)}
  notify({src:'bot',i:'⌛',t:'Order expired + refund',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]]})}
 else await replaceIfNeeded(u,o)}
// Pantau order ±25 detik setelah dibeli: begitu OTP masuk, layar diedit dan user dapat notifikasi baru.
async function watchOrder(c,uid,oid,mid){
 const end=Date.now()+25000
 while(Date.now()<end){
  await sleep(2500)
  const u=await kv.get('u:'+uid),o=u&&(u.tx||[]).find(x=>x.id===oid);if(!o||o.status!=='pending')return
  const was=o.status+o.phone
  try{await pollOrder(u,o,true)}catch(e){continue}
  if(o.status+o.phone!==was){await save(u)
   const [t,k]=orderCard(o,o.status==='success'?'🎉 <b>OTP masuk!</b>':o.status==='expired'?'⌛ <b>Order kedaluwarsa.</b> Saldo dikembalikan.':'🔁 <b>Nomor diganti otomatis</b> (Jaminan OTP).')
   await tg(c.bot.token,'editMessageText',{chat_id:c.chat,message_id:mid,text:t,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:k})
   if(o.status!=='pending')return}}}
async function ordCheck(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findOrder(u,s);if(!o)return show(c,'Order tidak ditemukan.',kb([BACK]))
 const was=o.status+o.phone;typing(c)
 try{await pollOrder(u,o,false)}catch(e){return orderView(c,u,o,'⚠️ Gagal cek: '+esc(String(e.message).slice(0,100)))}
 await save(u)
 return orderView(c,u,o,o.status==='success'?'🎉 <b>OTP masuk!</b>':o.status==='expired'?'⌛ <b>Order kedaluwarsa.</b> Saldo dikembalikan.':was!==o.status+o.phone?'🔁 <b>Nomor diganti otomatis</b> (Jaminan OTP).':`⏳ <i>Belum ada OTP · dicek ${jam()} WIB</i>`)}
async function ordCancelAsk(c,u,s){
 const o=findOrder(u,s);if(!o||o.status!=='pending')return show(c,'Order sudah tidak bisa dibatalkan.',kb([BACK]))
 return show(c,`${H('❌','BATALKAN ORDER?')}\n\n${Q(`☎️ <code>${esc(o.phone)}</code>`,`💸 Refund  <b>${rp(o.price)}</b> ke saldo`)}\n<i>Jika OTP ternyata sudah masuk, order tidak dibatalkan.</i>`,kb([[B('✅ Ya, Batalkan','oxy:'+s,'danger'),B('↩️ Tidak','ord:'+s,'success')]]))}
async function ordCancel(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findOrder(u,s);if(!o||o.status!=='pending')return show(c,'Order sudah tidak bisa dibatalkan.',kb([BACK]))
 let s0=null;try{s0=await P[o.server].status(o.id)}catch(e){}
 if(s0&&s0.otp){o.status='success';o.otp=s0.otp;o.msg=s0.msg;o.tgSent=true;await fireOtp(u,o);await save(u);return orderView(c,u,o,'ℹ️ Kode OTP ternyata sudah masuk, order selesai.')}
 try{await P[o.server].cancel(o.id)}catch(e){return orderView(c,u,o,'⚠️ Ditolak provider: '+esc(String(e.message).slice(0,120)))}
 o.status='cancelled';if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)};await save(u)
 notify({src:'bot',i:'❌',t:'Order dibatalkan',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]],note:'Dibatalkan pengguna, saldo sudah kembali'})
 return orderView(c,u,o,'✅ <b>Order dibatalkan.</b> Saldo sudah kembali.')}

// ---------- ISI SALDO ----------
async function depStart(c,u){
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 const ml=await methodsList(c.cfg)
 if(!ml.length)return show(c,'⚠️ Belum ada metode pembayaran aktif. Hubungi admin.',kb([BACK]))
 const b=c.cfg.bonus
 const text=`${H('💰','ISI SALDO','Langkah 1 dari 2 · pilih metode')}\n\n${Q(`👛 Saldo  <b>${rp(u.balance)}</b>`,b.on?`🎁 Bonus deposit  <b>${b.pct}%</b> (min ${rp(b.minAmt)})`:'')}`
 const rows=[],btn=ml.map(m=>B((m.type==='va'?'🏦 ':'📲 ')+m.name,'dm:'+m.provider,m.type==='va'?'primary':'success'))
 for(let i=0;i<btn.length;i+=2)rows.push(btn.slice(i,i+2))
 return show(c,text,kb([...rows,[B('📜 Tagihan Saya','dl'),B('🏠 Menu','m','danger')]]))}
const AMTS=[5000,10000,20000,50000,100000,200000]
async function depAmount(c,u,m){
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep')]]))
 const ok=AMTS.filter(a=>a>=x.min&&a<=x.max),rows=[];for(let i=0;i<ok.length;i+=3)rows.push(ok.slice(i,i+3).map(a=>B(rp(a),'da:'+m+':'+a,'success')))
 await setSt(c.from.id,{k:'amt',m})   // user juga boleh langsung mengetik angka
 return show(c,`${H('💵','PILIH NOMINAL','Langkah 2 dari 2 · '+esc(x.name))}\n\n${Q(`📉 Minimal  <b>${rp(x.min)}</b>`,`📈 Maksimal  <b>${rp(x.max)}</b>`)}\n<b>Dua cara:</b>\n1️⃣ Ketuk tombol nominal di bawah\n2️⃣ Ketuk <b>✏️ Nominal Sendiri</b> atau langsung <b>ketik angkanya</b>\n<i>Contoh: 15000 · 15.000 · 15k · 1,5jt</i>`,kb([...rows,[B('✏️ Nominal Sendiri','dc:'+m,'primary')],[B('⬅️ Metode','dep'),B('🏠 Menu','m','danger')]]))}
async function depCustom(c,u,m){
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep')]]))
 await setSt(c.from.id,{k:'amt',m})
 return show(c,`${H('✏️','NOMINAL SENDIRI',esc(x.name))}\n\n${Q(`📉 Minimal  <b>${rp(x.min)}</b>`,`📈 Maksimal  <b>${rp(x.max)}</b>`)}\nKetik <b>nominal</b> yang kamu mau di chat 👇\n<i>Contoh: 15000 · 15.000 · 15k · 1,5jt</i>`,kb([[B('⬅️ Pakai Tombol Nominal','dm:'+m),B('❌ Batal','m','danger')]]))}
async function depConfirm(c,u,m,amt){
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep')]]))
 if(!(amt>=x.min&&amt<=x.max)){await setSt(c.from.id,{k:'amt',m});return show(c,`⚠️ <b>${amt>0?'Nominal '+rp(amt)+' di luar batas.':'Nominal tidak terbaca.'}</b>\n${Q(`📉 Minimal  <b>${rp(x.min)}</b>`,`📈 Maksimal  <b>${rp(x.max)}</b>`)}\nKetik angka lagi atau pilih tombol 👇`,kb([[B('✏️ Ketik Lagi','dc:'+m,'primary'),B('💵 Tombol Nominal','dm:'+m,'success')],[B('❌ Batal','m','danger')]]))}
 const b=c.cfg.bonus,bn=b.on&&amt>=b.minAmt?Math.floor(amt*b.pct/100):0
 return show(c,`${H('🧾','KONFIRMASI DEPOSIT')}\n\n${Q(`🏦 Metode  <b>${esc(x.name)}</b>`,`💵 Nominal  <b>${rp(amt)}</b>`,bn?`🎁 Bonus  <b>~${rp(b.max?Math.min(bn,b.max):bn)}</b>`:'')}\n<i>Biaya layanan (jika ada) tampil di tagihan.</i>`,kb([[B('✅ Buat Tagihan','dgo:'+m+':'+amt,'success')],[B('⬅️ Ubah Nominal','dm:'+m),B('❌ Batal','m','danger')]]))}
const qrUrl=q=>'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data='+encodeURIComponent(q)
function depCaption(o,note){
 const m=(METHODS[o.method]||METHODS.qris).name,pend=o.status==='pending'
 const lines=[`🏦 ${esc(m)}`,`💵 Nominal  <b>${rp(o.amount)}</b>`,o.fee>0?`🧮 Biaya  <b>${rp(o.fee)}</b>`:'',`💳 Total bayar  <b>${rp(o.total)}</b>`,o.va?`🔢 No. VA  <code>${esc(o.va)}</code>`:'',o.expMs&&pend?`⏳ Batas  <b>${wibAt(o.expMs)}</b> (${sisa(o.expMs)})`:'']
 return (note?note+'\n\n':'')+`<b>💳 TAGIHAN</b>  ${stOf(o.status)} <b>${stName(o.status)}</b>\n\n${Q(lines)}\n🆔 <code>${esc(o.id)}</code>`+(pend?`\n<i>${o.va?'Transfer sesuai total ke nomor VA.':'Scan QR dengan e-wallet / m-banking apa saja.'} Saldo masuk otomatis.</i>`:'')}
const depKb=o=>kb(o.status==='pending'?[[B('🔄 Cek Status','dk:'+sid(o.id),'success'),B('❌ Batalkan','dx:'+sid(o.id),'danger')],o.va?[C('📋 Salin No. VA',o.va),C('📋 Salin Total',o.total)]:[C('📋 Salin Total',o.total)],BACK]:[[B('💰 Isi Lagi','dep','success'),B('🛒 Beli Nokos','buy','success')],BACK])
const findDep=(u,s)=>(u.tx||[]).find(x=>x.type==='deposit'&&sid(x.id)===s)
async function depCreate(c,u0,m,amt){
 const mb=maintBlock(c);if(mb)return maintView(c,mb)
 if(await kv.incr(`rl:dep:${c.from.id}:${Math.floor(Date.now()/4000)}`)>1)return
 typing(c)
 const [u,ml]=await Promise.all([kv.get('u:'+u0.id),methodsList(c.cfg)]),x=ml.find(y=>y.provider===m)
 if(!x||!(amt>=x.min&&amt<=x.max))return show(c,'⚠️ Metode / nominal tidak valid.',kb([[B('⬅️ Metode','dep')]]))
 if(u.tx.filter(y=>y.type==='deposit'&&y.status==='pending').length>=3)return show(c,'⚠️ Terlalu banyak tagihan belum dibayar. Batalkan salah satu dulu.',kb([[B('📜 Tagihan Saya','dl'),B('🏠 Menu','m','danger')]]))
 let d;try{d=await createDeposit(c.cfg,m,amt)}catch(e){return show(c,`${H('❌','GAGAL MEMBUAT TAGIHAN')}\n\n${Q(esc(e.message))}`,kb([[B('🔄 Coba Lagi','dm:'+m),B('🏠 Menu','m','danger')]]))}
 const rec={type:'deposit',id:d.id,amount:amt,total:d.total,fee:d.fee,qr:d.qr,qrImg:d.qrImg,va:d.va||'',method:m,gw:d.gw,exp:d.exp,expMs:toMs(d.exp),status:'pending',credited:false,at:Date.now(),via:'telegram'}
 u.tx.unshift(rec);await Promise.all([kv.set('d:'+rec.id,u.id),save(u),setSt(c.from.id,{})])
 notify({src:'bot',i:'💰',t:'Deposit menunggu bayar',st:'pending',id:['ID Deposit',rec.id],rows:[['Pengguna',mask(u.email)],['Metode',x.name],['Rute',ROUTES[d.gw]],['Nominal',rp(amt)],['Biaya layanan',d.fee>0?rp(d.fee):''],['Total bayar',rp(d.total)],['Batas bayar',rec.expMs?wibAt(rec.expMs):''],['Saldo sekarang',rp(u.balance)]],note:'Pengguna belum membayar'})
 const k=depKb(rec),cap=depCaption(rec),img=/^https?:\/\//.test(rec.qrImg||'')?rec.qrImg:(rec.qr?qrUrl(rec.qr):'')
 if(c.mid)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid})
 if(img){const r=await tg(c.bot.token,'sendPhoto',{chat_id:c.chat,photo:img,caption:cap,parse_mode:'HTML',reply_markup:k});if(r.ok)return r}
 return send(c,cap,k)}
async function depCheckBtn(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findDep(u,s);if(!o)return show(c,'Tagihan tidak ditemukan.',kb([BACK]))
 if(o.status==='pending'){quiet.add(o.id);try{if(await applyDep(u,o,await depCheck(o)))await save(u)}catch(e){quiet.delete(o.id);return show(c,depCaption(o,'⚠️ Gagal cek: '+esc(String(e.message).slice(0,100))),depKb(o),true)}quiet.delete(o.id)}
 if(o.status==='pending')return show(c,depCaption(o,`⏳ <i>Belum dibayar · dicek ${jam()} WIB</i>`),depKb(o),true)
 return show(c,depCaption(o,o.status==='completed'?'🎉 <b>Pembayaran diterima!</b>'+(o.bonus?` Bonus ${rp(o.bonus)}.`:''):''),depKb(o),true)}
async function depCancelAsk(c,u,s){
 const o=findDep(u,s);if(!o||o.status!=='pending')return show(c,'Tagihan sudah tidak aktif.',kb([BACK]))
 return show(c,`${H('❌','BATALKAN TAGIHAN?')}\n\n${Q(`💵 ${rp(o.amount)} · ${esc((METHODS[o.method]||METHODS.qris).name)}`)}\n<i>Kalau sudah terlanjur dibayar, saldo tetap masuk.</i>`,kb([[B('✅ Ya, Batalkan','dxy:'+s,'danger'),B('↩️ Tidak','dk:'+s,'success')]]),true)}
async function depCancelDo(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findDep(u,s);if(!o||o.status!=='pending')return show(c,'Tagihan sudah tidak aktif.',kb([BACK]))
 try{if(await depCheck(o)==='completed'){quiet.add(o.id);await applyDep(u,o,'completed');quiet.delete(o.id);await save(u);return show(c,depCaption(o,'ℹ️ Ternyata sudah dibayar, saldo masuk.'),depKb(o),true)}}catch(e){quiet.delete(o.id)}
 await depCancel(o);o.status='canceled';await save(u)
 notify({src:'bot',i:'🚫',t:'Deposit dibatalkan',st:'warn',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Metode',(METHODS[o.method]||METHODS.qris).name+' · '+(ROUTES[o.gw]||'-')],['Dibuat',wibAt(o.at)]]})
 return show(c,depCaption(o,'🚫 <b>Tagihan dibatalkan.</b>'),depKb(o),true)}
async function depList(c,u){
 const items=(u.tx||[]).filter(x=>x.type==='deposit').slice(0,6)
 const rows=items.map(o=>[B(`${stOf(o.status)} ${rp(o.amount)} · ${(METHODS[o.method]||METHODS.qris).name}`,'dk:'+sid(o.id),o.status==='pending'?'primary':o.status==='completed'?'success':'danger')])
 return show(c,`${H('📜','TAGIHAN DEPOSIT')}\n\n`+(items.length?'Ketuk untuk detail / cek status 👇':'<i>Belum ada deposit.</i>'),kb([...rows,[B('💰 Isi Saldo','dep','success'),...BACK]]))}

// ---------- ADMIN ----------
const findUser=async q=>{q=String(q||'').trim().replace(/^@/,'')
 let id=null
 if(/^[a-f0-9]{32}$/i.test(q))id=q.toLowerCase();else if(q.includes('@'))id=await kv.get('e:'+q.toLowerCase());else if(/^\d{5,}$/.test(q))id=await kv.get('tg:'+q)
 return id&&await kv.get('u:'+id)}
const ADM=c=>c.from.username?'@'+c.from.username:'ID '+c.from.id
const AB=[B('⬅️ Panel','a')]
async function adminMenu(c,note){
 const [bots,tgN]=await Promise.all([getBots(),kv.get('tgidx')]),m=c.cfg.maint||{}
 const text=`${note?note+'\n\n':''}${H('🛠','PANEL ADMIN',jam()+' WIB')}\n\n${Q(`🤖 Bot aktif  <b>${bots.filter(b=>b.on!==false).length}</b>`,`✈️ User bot  <b>${(tgN||[]).length}</b>`,`${m.on?'🔴':'🟢'} Maintenance  <b>${m.on?'ON':'OFF'}</b>`,`💳 Metode aktif  <b>${Object.values(c.cfg.dep.methods).filter(x=>x.on).length}</b>`)}`
 return show(c,text,kb([
  [B('📊 Statistik','a:st'),B('👤 Cek User','a:us')],
  [B('➕ Add Saldo','a:add','success'),B('➖ Del Saldo','a:del','danger')],
  [B('⛔ Ban','a:ban','danger'),B('♻️ Unban','a:unban','success')],
  [B('📢 Broadcast','a:bc0'),B('📌 Broadcast + Pin','a:bc1','success')],
  [B('💳 Pembayaran','a:pay'),B(m.on?'🛠 Maintenance ON':'🛠 Maintenance OFF','a:mt',m.on?'danger':'success')],
  [B('🖥 Server','a:sv'),B('💰 Markup','a:mk')],
  [B('🖼 Banner Menu Bot','a:bn','success'),B('📣 Banner Web','a:bw')],
  [B('💾 Backup','a:bk','success'),B('🔔 Tes Notif','a:tn')],
  [B('🏠 Menu User','m','danger')]]))}
async function adminStats(c){
 const us=await allUsers(),t0=wibDayStart();let bal=0,ban=0,ordT=0,ordAll=0,depT=0,pend=0,tgN=0,sales=0
 for(const u of us){bal+=+u.balance||0;if(u.banned)ban++;if(u.tgId)tgN++
  for(const x of u.tx||[]){if(x.type==='order'){if(x.status==='success'){ordAll++;sales+=x.price;if(x.at>=t0)ordT++}if(x.status==='pending')pend++}
   if(x.type==='deposit'&&x.status==='completed'&&x.at>=t0)depT+=x.amount}}
 return show(c,`${H('📊','STATISTIK','Diperbarui '+jam()+' WIB')}\n\n${Q(`👥 Pengguna  <b>${us.length}</b>`,`✈️ Dari Telegram  <b>${tgN}</b>`,`⛔ Dibanned  <b>${ban}</b>`,`👛 Total saldo  <b>${rp(bal)}</b>`)}\n${Q(`📦 Order hari ini  <b>${ordT}</b>`,`📦 Order total  <b>${ordAll}</b>`,`⏳ Order berjalan  <b>${pend}</b>`,`💵 Deposit hari ini  <b>${rp(depT)}</b>`,`🏷 Total penjualan  <b>${rp(sales)}</b>`)}`,kb([[B('🔄 Refresh','a:st','success'),...AB]]))}
async function userCard(c,u,note){
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),dep=(u.tx||[]).filter(x=>x.type==='deposit'&&x.status==='completed').reduce((a,x)=>a+x.amount,0)
 const text=`${note?note+'\n\n':''}${H('👤','DETAIL USER',u.banned?'⛔ BANNED':'🟢 Aktif')}\n\n${Q(`🪪 <b>${esc(u.name)}</b>`,`📧 <code>${esc(u.email)}</code>`,`🆔 <code>${esc(u.id)}</code>`,`✈️ ${u.tgId?`<code>${u.tgId}</code>${u.tgUser?' @'+esc(u.tgUser):''}`:'-'}`)}\n${Q(`👛 Saldo  <b>${rp(u.balance)}</b>`,`📦 Order  <b>${ok.length}</b> · ${rp(spent)}`,`💵 Deposit  <b>${rp(dep)}</b>`)}\n${Q(`🕐 Gabung  ${wibAt(Date.parse(u.joinedAt))}`,`🔓 Login  ${u.lastLogin?wibAt(u.lastLogin):'-'}`,`🌐 IP  <code>${esc(u.lastIp||'-')}</code>`)}`
 return show(c,text,kb([[B('➕ Saldo','ua:add:'+u.id,'success'),B('➖ Saldo','ua:del:'+u.id,'danger')],
  [u.banned?B('♻️ Unban','ua:unban:'+u.id,'success'):B('⛔ Ban','ua:ban:'+u.id,'danger'),B('🔑 Link Reset','ua:rst:'+u.id)],
  [u.tgId?B('✉️ Kirim Pesan','ua:msg:'+u.id):B('✉️ Belum terhubung','a:us'),B('🔄 Refresh','ua:ref:'+u.id)],AB]))}
async function adminAct(c,op,u,amount){
 if(op==='add'||op==='del'){
  const f=await kv.get('u:'+u.id);mut(f,op==='add'?amount:-amount,op==='add'?'Admin tambah (bot)':'Admin kurangi (bot)');await save(f)
  notify({src:'bot',i:'🛠',t:op==='add'?'Admin tambah saldo':'Admin kurangi saldo',st:'admin',rows:[['Pengguna',mask(f.email)],['Nominal',(op==='add'?'+':'-')+rp(amount)],['Saldo sekarang',rp(f.balance)],['Admin',ADM(c)]]})
  pushUser(f,`${H(op==='add'?'💰':'💸',op==='add'?'SALDO BERTAMBAH':'SALDO DIKURANGI')}\n\n${Q(`${op==='add'?'➕':'➖'} <b>${rp(amount)}</b>`,`👛 Saldo sekarang  <b>${rp(f.balance)}</b>`)}`)
  return f}
 if(op==='ban'||op==='unban'){const f=await kv.get('u:'+u.id);f.banned=op==='ban';await save(f)
  notify({src:'bot',i:op==='ban'?'⛔':'♻️',t:'Admin '+op+' akun',st:'admin',rows:[['Pengguna',mask(f.email)],['Admin',ADM(c)]]})
  if(op==='unban')pushUser(f,`${H('♻️','AKUN DIPULIHKAN')}\n\nAkunmu sudah aktif kembali.`)
  return f}
 return u}
async function askAmount(c,op,u){
 await setSt(c.from.id,{k:'amount',op,uid:u.id})
 return show(c,`${H(op==='add'?'➕':'➖',op==='add'?'ADD SALDO':'DEL SALDO')}\n\n${Q(`👤 <code>${esc(u.email)}</code>`,`👛 Saldo  <b>${rp(u.balance)}</b>`)}\nKetik <b>nominal</b> (angka saja, mis. <code>10000</code>):`,kb([[B('❌ Batal','a','danger')]]))}
async function askUser(c,op){
 await setSt(c.from.id,{k:'finduser',op})
 const T={add:'➕ ADD SALDO',del:'➖ DEL SALDO',ban:'⛔ BAN USER',unban:'♻️ UNBAN USER',view:'👤 CEK USER'}
 return show(c,`<b>${T[op]}</b>\n\nKirim <b>email</b>, <b>ID Telegram</b>, atau <b>ID user</b>:`,kb([[B('❌ Batal','a','danger')]]))}
async function payView(c,note){
 const cfg=await getCfg(),rd=await readiness(cfg).catch(()=>({}))
 const text=`${note?note+'\n\n':''}${H('💳','METODE PEMBAYARAN','Ketuk untuk nyala / mati')}\n\n<b>Gateway</b>\n${Q(Object.keys(ROUTES).map(r=>`${cfg.dep.routes[r].on?'🟢':'⚪'} ${ROUTES[r]} ${rd[r]?'· siap':'· <i>kredensial belum diisi</i>'}`))}\n<b>Metode untuk pengguna</b>\n${Q(Object.keys(METHODS).map(k=>`${cfg.dep.methods[k].on?'🟢':'⚪'} ${METHODS[k].name}`))}`
 const rr=Object.keys(ROUTES).map(r=>B((cfg.dep.routes[r].on?'🟢 ':'⚪ ')+ROUTES[r],'a:pr:'+r,cfg.dep.routes[r].on?'success':'danger'))
 const mm=Object.keys(METHODS),rows=[];for(let i=0;i<mm.length;i+=2)rows.push(mm.slice(i,i+2).map(k=>B((cfg.dep.methods[k].on?'🟢 ':'⚪ ')+METHODS[k].name,'a:pm:'+k,cfg.dep.methods[k].on?'success':'danger')))
 return show(c,text,kb([rr,...rows,AB]))}
async function mtView(c,note){
 const cfg=await getCfg(),m=cfg.maint||{},nm=s=>((cfg.srv||{})[s.server]||{}).name||s.name
 const text=`${note?note+'\n\n':''}${H('🛠','MAINTENANCE')}\n\n${Q(`🌐 Seluruh situs  <b>${m.on?'🔴 AKTIF':'🟢 Normal'}</b>`,`🎛 Mode  <b>${m.mode==='soft'?'Banner (order &amp; deposit diblokir)':'Layar penuh'}</b>`,`💬 Pesan  <i>${esc(m.msg||'(bawaan)')}</i>`)}\n<b>Per server</b>\n${Q(SERVERS.map(s=>`${((m.srv||{})[s.server]||{}).on?'🔴':'🟢'} ${esc(nm(s))}`))}`
 const srv=SERVERS.map((s,i)=>B((((m.srv||{})[s.server]||{}).on?'🔴 ':'🟢 ')+nm(s),'a:mts:'+i,((m.srv||{})[s.server]||{}).on?'danger':'success')),rows=[];for(let i=0;i<srv.length;i+=2)rows.push(srv.slice(i,i+2))
 return show(c,text,kb([[m.on?B('🟢 Matikan Maintenance','a:mt:0','success'):B('🔴 Hidupkan Maintenance','a:mt:1','danger')],
  [B(m.mode==='soft'?'🖼 Mode: Layar Penuh':'🏷 Mode: Banner','a:mtm'),B('💬 Ubah Pesan','a:mtt')],...rows,AB]))}
async function setMaint(c,fn){
 const cfg=await getCfg(),was=cfg.maint||{},o={on:!!was.on,mode:was.mode==='soft'?'soft':'full',msg:was.msg||'',srv:{...(was.srv||{})}};fn(o)
 cfg.maint=o;await putCfg(cfg)
 const nOn=Object.values(o.srv).filter(x=>x.on).length
 if(!!was.on!==o.on||nOn!==Object.values(was.srv||{}).filter(x=>x.on).length)notify({src:'bot',i:'🛠',t:o.on?'Maintenance AKTIF':'Maintenance dinonaktifkan',st:'admin',rows:[['Seluruh situs',o.on?'Aktif ('+(o.mode==='soft'?'banner':'layar penuh')+')':'Mati'],['Server maintenance',nOn],['Admin',ADM(c)]],note:o.msg||''})}
async function svAdmin(c,note){
 const cfg=await getCfg(),nm=s=>((cfg.srv||{})[s.server]||{}).name||s.name
 const b=SERVERS.map((s,i)=>B((cfg.off.includes(s.server)?'⚪ ':'🟢 ')+nm(s),'a:svt:'+i,cfg.off.includes(s.server)?'danger':'success')),rows=[];for(let i=0;i<b.length;i+=2)rows.push(b.slice(i,i+2))
 return show(c,`${note?note+'\n\n':''}${H('🖥','SERVER NOKOS','Server mati tidak tampil untuk pengguna')}\n\n${Q(SERVERS.map(s=>`${cfg.off.includes(s.server)?'⚪ Mati':'🟢 Aktif'} · ${esc(nm(s))}`))}`,kb([...rows,AB]))}
async function mkView(c,note){
 const cfg=await getCfg()
 return show(c,`${note?note+'\n\n':''}${H('💰','MARKUP HARGA')}\n\n${Q(`📈 Markup umum  <b>${cfg.markup}%</b>`,`🔢 Pembulatan  <b>${cfg.mkRound?'Rp'+cfg.mkRound:'tidak ada'}</b>`)}\n<i>Pilih persen atau ketik angka. Markup per server diatur di web › 💰 Markup.</i>`,kb([[5,10,15,20].map(p=>B(p+'%','a:mk:'+p,cfg.markup===p?'success':'primary')),[25,30,40,50].map(p=>B(p+'%','a:mk:'+p,cfg.markup===p?'success':'primary')),[B('✏️ Ketik Persen','a:mkc')],AB]))}

// ---------- BROADCAST ----------
export async function startBroadcast({text,photo,pin,by,botId}){
 const ids=((await kv.get('tgidx'))||[]).map(String)
 const job={id:rid().slice(0,10),text,photo:photo||'',pin:!!pin,ids,i:0,ok:0,fail:0,by:by||0,bot:botId||'',at:Date.now(),done:false}
 await kv.set('tmp:bc:'+job.id,job);await kv.set('tmp:bcjob',job.id);return job}
export async function bcStep(job,ms=40000){
 const bots=await getBots(),bot=bots.find(b=>b.id===job.bot&&b.on!==false)||bots.find(b=>b.on!==false);if(!bot){job.done=true;job.err='Tidak ada bot aktif';await kv.set('tmp:bc:'+job.id,job);return job}
 const end=Date.now()+ms
 while(job.i<job.ids.length&&Date.now()<end){
  const t0=Date.now(),batch=job.ids.slice(job.i,job.i+25)
  const rs=await Promise.all(batch.map(async id=>{
   const r=job.photo?await tg(bot.token,'sendPhoto',{chat_id:id,photo:job.photo,caption:job.text.slice(0,1000),parse_mode:'HTML'}):await tg(bot.token,'sendMessage',{chat_id:id,text:job.text,parse_mode:'HTML',disable_web_page_preview:true})
   if(r.ok&&job.pin)tg(bot.token,'pinChatMessage',{chat_id:id,message_id:r.result.message_id,disable_notification:true})
   if(!r.ok&&/blocked|deactivated|chat not found|kicked/i.test(r.description||'')){const uid=await kv.get('tg:'+id),u=uid&&await kv.get('u:'+uid);if(u){u.tgBlocked=true;await save(u)}}
   return r.ok}))
  job.ok+=rs.filter(Boolean).length;job.fail+=rs.filter(x=>!x).length;job.i+=batch.length
  await kv.set('tmp:bc:'+job.id,job);const dt=Date.now()-t0;if(dt<1000)await sleep(1000-dt)}
 if(job.i>=job.ids.length&&!job.done){job.done=true;await kv.set('tmp:bc:'+job.id,job);await kv.del('tmp:bcjob')
  notify({src:'bot',i:'📢',t:job.pin?'Broadcast + Pin selesai':'Broadcast selesai',st:'admin',rows:[['Sasaran',job.ids.length],['Terkirim',job.ok],['Gagal',job.fail]],note:job.text.replace(/<[^>]+>/g,'').slice(0,200)})
  if(job.by)await tg(bot.token,'sendMessage',{chat_id:job.by,text:`${H('📢','BROADCAST SELESAI')}\n\n${Q(`🎯 Sasaran  <b>${job.ids.length}</b>`,`📬 Terkirim  <b>${job.ok}</b>`,`🚫 Gagal  <b>${job.fail}</b>`,job.pin?'📌 Pesan disematkan':'')}`,parse_mode:'HTML'})}
 return job}
export async function tgTick(){const id=await kv.get('tmp:bcjob');if(!id)return null;const job=await kv.get('tmp:bc:'+id);if(!job||job.done){await kv.del('tmp:bcjob');return null};return bcStep(job,45000)}
async function bcAsk(c,pin){
 await setSt(c.from.id,{k:'bc',pin:pin?1:0})
 const n=((await kv.get('tgidx'))||[]).length
 return show(c,`${H(pin?'📌':'📢',pin?'BROADCAST + PIN':'BROADCAST')}\n\n${Q(`🎯 Sasaran  <b>${n}</b> pengguna bot`,pin?'📌 Otomatis disematkan di chat pengguna':'')}\nKirim <b>teks</b> pesan (boleh HTML: <code>&lt;b&gt;tebal&lt;/b&gt;</code>) atau <b>foto + caption</b>.`,kb([[B('❌ Batal','a','danger')]]))}

// ---------- router ----------
async function onText(c,u,text,m){
 const st=await getSt(c.from.id),n0={...c,mid:0}
 if(/^\/(cancel|batal)/i.test(text)){await setSt(c.from.id,{});return menu(n0,u)}
 if(c.adm&&st.k==='banner'){
  if(text==='-'){await kv.del('tgbn:'+c.bot.id);await setSt(c.from.id,{});return adminMenu(n0,'✅ Banner kembali ke bawaan.')}
  const md=m.photo?{t:'photo',f:m.photo[m.photo.length-1].file_id}:m.animation?{t:'animation',f:m.animation.file_id}:m.video?{t:'video',f:m.video.file_id}:null
  if(!md)return send(c,'Kirim foto, video, atau GIF (atau <code>-</code> untuk reset).')
  await kv.set('tgbn:'+c.bot.id,md);await setSt(c.from.id,{});return adminMenu(n0,'✅ Banner menu diganti. Ketik /start untuk melihat hasilnya.')}
 if(c.adm&&st.k==='bc'){
  const photo=m.photo?m.photo[m.photo.length-1].file_id:'',body=(m.caption||m.text||'').trim();if(!body&&!photo)return send(c,'Kirim teks atau foto + caption.')
  await setSt(c.from.id,{k:'bcok',pin:st.pin,text:body,photo})
  return send(c,`${H('👁','PRATINJAU',st.pin?'dengan pin':'')}\n\n${Q((photo?'🖼 <i>(foto terlampir)</i>\n':'')+body.slice(0,900))}\nKirim ke <b>${((await kv.get('tgidx'))||[]).length}</b> pengguna?`,kb([[B('✅ Kirim Sekarang','a:bcgo','success'),B('❌ Batal','a','danger')]]))}
 if(c.adm&&st.k==='finduser'){
  const t=await findUser(text);if(!t)return send(c,'❌ User tidak ditemukan. Coba lagi atau /cancel.')
  if(st.op==='view'){await setSt(c.from.id,{});return userCard(n0,t)}
  if(st.op==='add'||st.op==='del')return askAmount(n0,st.op,t)
  await setSt(c.from.id,{});const f=await adminAct(c,st.op,t);return userCard(n0,f,st.op==='ban'?'⛔ <b>User dibanned.</b>':'♻️ <b>User di-unban.</b>')}
 if(c.adm&&st.k==='amount'){
  const n=num(text);if(n<=0||n>1e9)return send(c,'❌ Nominal tidak valid. Ketik angka, mis. <code>10000</code>.')
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{});if(!t)return send(c,'User tidak ditemukan.')
  const f=await adminAct(c,st.op,t,n);return userCard(n0,f,`✅ <b>Saldo ${st.op==='add'?'ditambah':'dikurangi'} ${rp(n)}.</b>`)}
 if(c.adm&&st.k==='usermsg'){
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{});const ok=t&&await pushUser(t,`${H('📩','PESAN DARI ADMIN')}\n\n${Q(esc(text))}`)
  return send(c,ok?'✅ Pesan terkirim.':'❌ Gagal kirim (user belum terhubung / memblokir bot).',kb([AB]))}
 if(c.adm&&st.k==='mtmsg'){await setSt(c.from.id,{});await setMaint(c,o=>{o.msg=text.slice(0,300)});return mtView(n0,'✅ Pesan maintenance disimpan.')}
 if(c.adm&&st.k==='bw'){await setSt(c.from.id,{});const cfg=await getCfg();cfg.broadcast=text==='-'?'':text.slice(0,500);await putCfg(cfg)
  notify({src:'bot',i:'📣',t:'Banner web diubah',st:'admin',note:cfg.broadcast||'(dihapus)'});return adminMenu(n0,'✅ Banner di beranda dashboard web diperbarui.')}
 if(c.adm&&st.k==='mkc'){const p=+String(text).replace(',','.');if(!(p>=0&&p<=500))return send(c,'❌ Isi angka 0–500.');await setSt(c.from.id,{});const cfg=await getCfg();cfg.markup=p;await putCfg(cfg);return mkView(n0,'✅ Markup umum diubah.')}
 if(st.k==='link')return doLink(n0,u,text)
 if(st.k==='buy'&&!st.opts&&st.sv){st.q=text.slice(0,40);await setSt(c.from.id,st);return svPage(n0,0)}
 if(st.k==='amt'){return depConfirm(n0,u,st.m,parseAmt(text))}
 return menu(n0,u)}

async function onCallback(c,u,d){
 const [a,x,y]=d.split(':')
 if(a==='m'){await setSt(c.from.id,{});return menu(c,u)}
 if(a==='acc')return accView(c,u)
 if(a==='his')return hisView(c,u,x)
 if(a==='mut')return mutView(c,u,x)
 if(a==='ref')return refView(c,u)
 if(a==='help')return helpView(c)
 if(a==='web')return webView(c)
 if(a==='pw')return pwView(c,u)
 if(a==='lnk')return lnkView(c)
 if(a==='buy')return buyStart(c,u)
 if(a==='bs')return pickServer(c,u,x)
 if(a==='bl')return svPage(c,x)
 if(a==='bq')return toast(c,'Ketik nama aplikasi di chat, mis. whatsapp')
 if(a==='bx'){const st=await getSt(c.from.id);st.q='';await setSt(c.from.id,st);return svPage(c,0)}
 if(a==='bp')return pickService(c,u,x)
 if(a==='bt')return optPage(c,u,x)
 if(a==='bo')return confirmView(c,u,x,null)
 if(a==='bg')return confirmView(c,u,x,y)
 if(a==='bgo')return placeOrder(c,u,x)
 if(a==='ord'){const o=findOrder(u,x);return o?orderView(c,u,o):show(c,'Order tidak ditemukan.',kb([BACK]))}
 if(a==='oc')return ordCheck(c,u,x)
 if(a==='ox')return ordCancelAsk(c,u,x)
 if(a==='oxy')return ordCancel(c,u,x)
 if(a==='dep')return depStart(c,u)
 if(a==='dm')return depAmount(c,u,x)
 if(a==='dc')return depCustom(c,u,x)
 if(a==='da')return depConfirm(c,u,x,num(y))
 if(a==='dgo')return depCreate(c,u,x,num(y))
 if(a==='dk')return depCheckBtn(c,u,x)
 if(a==='dx')return depCancelAsk(c,u,x)
 if(a==='dxy')return depCancelDo(c,u,x)
 if(a==='dl')return depList(c,u)
 if(a==='a'||a==='ua'){
  if(!c.adm)return show(c,'⛔ Khusus admin.',kb([BACK]))
  if(a==='ua'){const t=await kv.get('u:'+y);if(!t)return show(c,'User tidak ditemukan.',kb([AB]))
   if(x==='ref')return userCard(c,t)
   if(x==='add'||x==='del')return askAmount(c,x,t)
   if(x==='ban'||x==='unban'){const f=await adminAct(c,x,t);return userCard(c,f,x==='ban'?'⛔ <b>User dibanned.</b>':'♻️ <b>User di-unban.</b>')}
   if(x==='rst'){const tk=rid();await kv.set('pr:'+tk,{id:t.id,exp:Date.now()+30*60000});const link=siteOf(c)+'/reset?token='+tk;return show(c,`${H('🔑','LINK RESET','Berlaku 30 menit, sekali pakai')}\n\n${Q(`👤 <code>${esc(t.email)}</code>`)}\n<code>${esc(link)}</code>`,kb([[C('📋 Salin Link',link)],[B('⬅️ Kembali','ua:ref:'+t.id)]]))}
   if(x==='msg'){await setSt(c.from.id,{k:'usermsg',uid:t.id});return show(c,`${H('✉️','KIRIM PESAN')}\n\nKe <code>${esc(t.email)}</code>\nKetik pesannya:`,kb([[B('❌ Batal','a','danger')]]))}
   return}
  if(!x){await setSt(c.from.id,{});return adminMenu(c)}
  if(x==='st')return adminStats(c)
  if(x==='us')return askUser(c,'view')
  if(['add','del','ban','unban'].includes(x))return askUser(c,x)
  if(x==='bc0')return bcAsk(c,false)
  if(x==='bc1')return bcAsk(c,true)
  if(x==='bcgo'){const st=await getSt(c.from.id);if(st.k!=='bcok')return show(c,'Sesi habis.',kb([AB]))
   await setSt(c.from.id,{});toast(c,'Mengirim...');const job=await startBroadcast({text:st.text,photo:st.photo,pin:st.pin,by:c.chat,botId:c.bot.id})
   await show(c,`${H('📡','BROADCAST BERJALAN')}\n\n${Q(`🎯 Sasaran  <b>${job.ids.length}</b>`)}\n<i>Laporan dikirim setelah selesai.</i>`,kb([AB]))
   return bcStep(job,40000)}
  if(x==='pay')return payView(c)
  if(x==='pr'){const cfg=await getCfg();if(!ROUTES[y])return;cfg.dep.routes[y].on=!cfg.dep.routes[y].on;await putCfg(cfg);return payView(c)}
  if(x==='pm'){const cfg=await getCfg();if(!METHODS[y])return;cfg.dep.methods[y].on=!cfg.dep.methods[y].on;await putCfg(cfg);return payView(c)}
  if(x==='mt'&&y!=null){await setMaint(c,o=>{o.on=y==='1'});return mtView(c)}
  if(x==='mt')return mtView(c)
  if(x==='mtm'){await setMaint(c,o=>{o.mode=o.mode==='soft'?'full':'soft'});return mtView(c)}
  if(x==='mtt'){await setSt(c.from.id,{k:'mtmsg'});return show(c,`${H('💬','PESAN MAINTENANCE')}\n\nKetik pesan yang tampil ke pengguna:`,kb([[B('❌ Batal','a:mt','danger')]]))}
  if(x==='mts'){const s=SERVERS[+y];if(s)await setMaint(c,o=>{const e=o.srv[s.server]||{on:false,msg:''};o.srv[s.server]={on:!e.on,msg:e.msg||''}});return mtView(c)}
  if(x==='sv')return svAdmin(c)
  if(x==='svt'){const s=SERVERS[+y];if(s){const cfg=await getCfg();cfg.off=cfg.off.includes(s.server)?cfg.off.filter(k=>k!==s.server):[...new Set([...cfg.off,s.server])];await putCfg(cfg)};return svAdmin(c)}
  if(x==='mk'&&y){const p=+y;if(p>=0&&p<=500){const cfg=await getCfg();cfg.markup=p;await putCfg(cfg)};return mkView(c,'✅ Markup diubah ke '+y+'%.')}
  if(x==='mk')return mkView(c)
  if(x==='mkc'){await setSt(c.from.id,{k:'mkc'});return show(c,`${H('✏️','MARKUP')}\n\nKetik persen baru (0–500), mis. <code>12.5</code>:`,kb([[B('❌ Batal','a:mk','danger')]]))}
  if(x==='bn'){await setSt(c.from.id,{k:'banner'});const bn=await kv.get('tgbn:'+c.bot.id);return show(c,`${H('🖼','BANNER MENU BOT',bn&&!bn.auto?'Banner kustom aktif':'Memakai banner bawaan')}\n\nKirim <b>foto</b>, <b>video</b>, atau <b>GIF</b> sebagai banner di atas menu utama.\n<i>Ukuran ideal 1280×720. Kirim teks <code>-</code> untuk kembali ke banner bawaan.</i>`,kb([[B('❌ Batal','a','danger')]]))}
  if(x==='bw'){await setSt(c.from.id,{k:'bw'});return show(c,`${H('📣','BANNER WEB','Tampil di beranda dashboard pengguna')}\n\nKetik teks baru (atau <code>-</code> untuk menghapus):`,kb([[B('❌ Batal','a','danger')]]))}
  if(x==='bk'){toast(c,'Membuat backup...');let r;try{r=await runBackup('manual')}catch(e){r={ok:false,error:e.message}};return adminMenu(c,r.ok?'✅ Backup terkirim ke chat owner.':'❌ Backup gagal: '+esc(r.error||'-'))}
  if(x==='tn'){const r=await notify({src:'bot',i:'✅',t:'Tes notifikasi bot',st:'ok',rows:[['Status','Terhubung'],['Admin',ADM(c)]],note:'Kalau pesan ini masuk ke channel, notifikasi bot sudah siap.'});return adminMenu(c,r.ok?'✅ Notifikasi tes terkirim ke channel.':'❌ '+esc(r.error||'gagal'))}}
}

export async function handle(bot,upd){
 try{
  if(upd.my_chat_member){const m=upd.my_chat_member;if(m.chat.type==='private'){const uid=await kv.get('tg:'+m.from.id),u=uid&&await kv.get('u:'+uid);if(u){u.tgBlocked=m.new_chat_member.status==='kicked';await save(u)}}return}
  const cb=upd.callback_query,m=upd.message
  const from=(cb||m||{}).from;if(!from||from.is_bot)return
  const msg=cb?cb.message:m;if(!msg||msg.chat.type!=='private')return
  // buang update ganda (Telegram mengirim ulang kalau balasan lambat) supaya tidak terjadi pembelian dobel
  if(upd.update_id!=null&&await kv.incr(`rl:tgu:${bot.id}:${upd.update_id}`)>1)return
  const c={bot,chat:msg.chat.id,from,mid:cb?msg.message_id:0,isPhoto:!!(cb&&(msg.photo||msg.video||msg.animation)),cbq:cb&&cb.id,adm:(bot.admins||[]).map(String).includes(String(from.id))}
  // tombol dijawab SEKETIKA (spinner hilang), tanpa menunggu proses selesai. Hanya 'bq' yang menjawab dengan popup teks.
  if(cb&&cb.data!=='bq'){c.answered=true;c.ackP=tg(bot.token,'answerCallbackQuery',{callback_query_id:cb.id})}
  const text=cb?'':(m.text||m.caption||'').trim()
  const sm=text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);if(sm&&sm[1]&&/^ref_/i.test(sm[1]))c.ref=sm[1].slice(4).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)
  // baca semua yang dibutuhkan sekaligus (paralel)
  const [cfg,sec,rl,u]=await Promise.all([cfgFast(),getSec(),kv.incr(`rl:tg:${from.id}:${Math.floor(Date.now()/60000)}`),getUser(c)])
  c.cfg=cfg;c.sec=sec
  if(rl>90){if(cb)await toast(c,'Terlalu cepat, tunggu sebentar');return}
  if(u.banned)return send(c,`${H('⛔','AKUN DITANGGUHKAN')}\n\nAkunmu diblokir. Hubungi admin bila ada kesalahan.`)
  if(cb){try{return await onCallback(c,u,cb.data||'')}finally{await c.ackP;if(!c.answered)await tg(bot.token,'answerCallbackQuery',{callback_query_id:cb.id})}}
  if(sm&&sm[1]&&/^link_/i.test(sm[1]))return doLink(c,u,sm[1].slice(5))   // tombol 'Hubungkan' di web membuka bot dan langsung menghubungkan
  if(/^\/start/i.test(text)||/^\/(menu|home)/i.test(text)){await setSt(from.id,{});return menu(c,u)}
  if(/^\/id/i.test(text))return send(c,`🆔 ID Telegram kamu: <code>${from.id}</code>`)
  if(/^\/admin/i.test(text)){if(!c.adm)return send(c,'⛔ Kamu bukan admin bot ini. ID kamu: <code>'+from.id+'</code>');await setSt(from.id,{});return adminMenu({...c,mid:0})}
  const lk=text.match(/^\/link\s+(\S+)/i);if(lk)return doLink(c,u,lk[1])
  if(text||m.photo||m.video||m.animation)return await onText(c,u,text,m)
 }catch(e){console.error('tgbot',e)}}
