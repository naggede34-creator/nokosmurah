// Mesin bot Telegram Artapedia ID. Satu webhook per bot: app/api/tg/[id]/route.js -> handle(bot, update)
// Pengguna: beli nokos, isi saldo, riwayat, mutasi, referral, buka web. Admin: panel lengkap (saldo, ban, broadcast, pembayaran, maintenance, dll).
// Semua navigasi memakai SATU pesan yang diedit (rapi, tidak spam) dan tombol inline berwarna.
import crypto from 'crypto'
import {kv} from './db'
import {save,rid,hash} from './auth'
import {tg,getBots,esc,B,U,kb,pushUser,pushAdmins,quiet} from './tgpush'
import {P,SERVERS} from './providers'
import {getCfg,mut,ensureRef,sellPrice,allUsers} from './bonus'
import {METHODS,ROUTES,methodsList,createDeposit,depCheck,depCancel,applyDep,toMs,readiness} from './deposit'
import {notify,mask,rp,wibAt} from './telegram'
import {getSec} from './settings'
import {replaceIfNeeded} from './sync'
import {fireOtp} from './webhook'
import {runBackup} from './backup'

const L='━━━━━━━━━━━━━━━━━━'
const sid=id=>crypto.createHash('md5').update(String(id)).digest('hex').slice(0,10)
const stOf=s=>({success:'🟢',pending:'🟡',cancelled:'⚫',expired:'🔴',completed:'🟢',canceled:'⚫',failed:'🔴'}[s]||'⚪')
const stName=s=>({success:'Berhasil',pending:'Menunggu',cancelled:'Dibatalkan',expired:'Kedaluwarsa',completed:'Berhasil',canceled:'Dibatalkan',failed:'Gagal'}[s]||s)
const PER=8
const getSt=async id=>(await kv.get('tmp:tg:'+id))||{}
const setSt=(id,s)=>kv.set('tmp:tg:'+id,s)
const num=x=>{x=Math.floor(+String(x).replace(/[^\d]/g,''));return Number.isFinite(x)?x:0}
const wibDayStart=()=>{const d=new Date(Date.now()+7*36e5);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-7*36e5}
const BASE=s=>String(s||'').replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'')

// ---------- pengiriman pesan ----------
const send=(c,text,k)=>tg(c.bot.token,'sendMessage',{chat_id:c.chat,text,parse_mode:'HTML',disable_web_page_preview:true,...(k?{reply_markup:k}:{})})
async function show(c,text,k,keepPhoto){
 if(c.mid){
  if(c.isPhoto&&!keepPhoto){tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid});return send(c,text,k)}
  const r=await tg(c.bot.token,c.isPhoto?'editMessageCaption':'editMessageText',{chat_id:c.chat,message_id:c.mid,...(c.isPhoto?{caption:text}:{text,disable_web_page_preview:true}),parse_mode:'HTML',reply_markup:k||{inline_keyboard:[]}})
  if(r.ok||/not modified/i.test(r.description||''))return r}
 return send(c,text,k)}
const toast=(c,text,alert)=>{if(!c.cbq||c.answered)return;c.answered=true;return tg(c.bot.token,'answerCallbackQuery',{callback_query_id:c.cbq,text:String(text||'').slice(0,190),show_alert:!!alert})}

// ---------- akun ----------
async function getUser(c){
 const id=c.from.id,uid=await kv.get('tg:'+id);let u=uid&&await kv.get('u:'+uid)
 const name=[c.from.first_name,c.from.last_name].filter(Boolean).join(' ').trim()||c.from.username||('User '+id)
 if(u){let ch=false;if(u.tgBot!==c.bot.id){u.tgBot=c.bot.id;ch=true};if(u.tgBlocked){u.tgBlocked=false;ch=true};if((c.from.username||'')!==(u.tgUser||'')){u.tgUser=c.from.username||'';ch=true};if(ch)await save(u);return u}
 // akun baru otomatis (email palsu .invalid; bisa dihubungkan / diberi password web lewat menu Akun)
 const email=`tg${id}@telegram.invalid`
 let rf=null;if(c.ref&&c.cfg.ref.on){const rfid=await kv.get('rc:'+c.ref);rf=rfid&&await kv.get('u:'+rfid);if(!rf||rf.banned)rf=null}
 u={id:rid(),email,name,pass:hash(rid()),balance:0,apikey:rid(),banned:false,tx:[],mut:[],joinedAt:new Date().toISOString(),refBy:rf?rf.id:null,refPaid:false,tgId:id,tgUser:c.from.username||'',tgBot:c.bot.id,via:'telegram'}
 await save(u);await ensureRef(u);await kv.set('e:'+email,u.id);await kv.set('k:'+u.apikey,u.id);await kv.set('tg:'+id,u.id)
 await kv.sadd('idx',u.id);await kv.sadd('tgidx',id)
 const total=((await kv.get('idx'))||[]).length
 await notify({src:'bot',i:'👤',t:'Pengguna baru',st:'ok',rows:[['Nama',String(name).slice(0,2)+'***'],['Telegram',c.from.username?'@'+c.from.username:'ID '+id],['Total pengguna',total],...(rf?[['Diajak oleh',mask(rf.email)]]:[])],note:'Mendaftar lewat bot Telegram'})
 return u}
const okOrders=u=>(u.tx||[]).filter(x=>x.type==='order'&&x.status==='success')

// ---------- tampilan: menu utama ----------
const siteOf=c=>BASE(c.cfg.site.baseUrl||c.sec.SITE_URL||c.bot.site||'')
function mainMenu(c,u){
 const ok=okOrders(u),web=siteOf(c)
 const text=`<b>✦ ARTAPEDIA ID ✦</b>\n<i>Nomor kosong &amp; OTP otomatis · 24 jam</i>\n${L}\n👋 Halo, <b>${esc(u.name)}</b>\n👛 Saldo   <b>${rp(u.balance)}</b>\n📦 Order   <b>${ok.length} sukses</b>\n${L}\nPilih menu di bawah 👇`
 const rows=[[B('🛒 Beli Nokos','buy','success'),B('💰 Isi Saldo','dep','success')],
  [B('👤 Akun Saya','acc'),B('📜 Riwayat Order','his:0')],
  [B('🧾 Mutasi Saldo','mut:0'),B('🎁 Ajak Teman','ref','success')],
  [web?U('🌐 Buka Web Artapedia',web+'/dashboard','primary'):B('🌐 Web Artapedia','web'),B('💬 Bantuan','help','primary')]]
 if(c.adm)rows.push([B('🛠 Panel Admin','a','danger')])
 return [text,kb(rows)]}
async function menu(c,u,note){const [t,k]=mainMenu(c,u);return show(c,(note?note+'\n\n':'')+t,k)}

// ---------- akun / riwayat / mutasi / referral / bantuan ----------
async function accView(c,u){
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),tgOnly=/@telegram\.invalid$/.test(u.email)
 const text=`<b>👤 AKUN SAYA</b>\n${L}\n🪪 Nama     <b>${esc(u.name)}</b>\n📧 Email    <code>${esc(u.email)}</code>\n👛 Saldo    <b>${rp(u.balance)}</b>\n📦 Order    <b>${ok.length}</b> sukses\n💳 Belanja  <b>${rp(spent)}</b>\n🕐 Gabung   ${wibAt(Date.parse(u.joinedAt))}\n${L}\n${tgOnly?'<i>Akun ini dibuat dari Telegram. Buat password web agar bisa masuk di situs dengan email di atas.</i>':'<i>Akun web &amp; bot memakai saldo yang sama.</i>'}`
 return show(c,text,kb([[B('💰 Isi Saldo','dep','success'),B('📜 Riwayat','his:0')],[B('🔑 Buat Password Web','pw','success'),B('🔗 Hubungkan Akun Web','lnk','primary')],[B('🏠 Menu Utama','m','primary')]]))}
async function hisView(c,u,page){
 const all=(u.tx||[]).filter(x=>x.type==='order'),pg=Math.max(0,+page||0),items=all.slice(pg*5,pg*5+5)
 let text=`<b>📜 RIWAYAT ORDER</b>\n${L}\n`
 if(!items.length)text+='<i>Belum ada order. Yuk beli nokos pertamamu!</i>'
 const rows=items.map(o=>[B(`${stOf(o.status)} ${String(o.serviceName).slice(0,18)} · ${o.phone}`,'ord:'+sid(o.id),o.status==='success'?'success':o.status==='pending'?'primary':'danger')])
 const nav=[];if(pg>0)nav.push(B('⬅️ Sebelumnya','his:'+(pg-1)));if((pg+1)*5<all.length)nav.push(B('Berikutnya ➡️','his:'+(pg+1)))
 if(items.length)text+=`Halaman ${pg+1}/${Math.ceil(all.length/5)} · ketuk order untuk detail`
 return show(c,text,kb([...rows,nav,[B('🛒 Beli Lagi','buy','success'),B('🏠 Menu','m','primary')]]))}
async function mutView(c,u,page){
 const all=u.mut||[],pg=Math.max(0,+page||0),items=all.slice(pg*8,pg*8+8)
 let text=`<b>🧾 MUTASI SALDO</b>\n${L}\n`
 if(!items.length)text+='<i>Belum ada mutasi.</i>'
 for(const m of items)text+=`${m.amt>=0?'🟢':'🔴'} <b>${m.amt>=0?'+':'-'}${rp(Math.abs(m.amt))}</b> → ${rp(m.bal)}\n   <i>${esc(String(m.note||'').slice(0,40))} · ${wibAt(m.at)}</i>\n`
 const nav=[];if(pg>0)nav.push(B('⬅️ Sebelumnya','mut:'+(pg-1)));if((pg+1)*8<all.length)nav.push(B('Berikutnya ➡️','mut:'+(pg+1)))
 return show(c,text,kb([nav,[B('💰 Isi Saldo','dep','success'),B('🏠 Menu','m','primary')]]))}
async function refView(c,u){
 await ensureRef(u);const cf=c.cfg.ref,web=siteOf(c)
 const text=`<b>🎁 AJAK TEMAN</b>\n${L}\n🔖 Kode kamu  <code>${esc(u.refCode||'-')}</code>\n👥 Teman      <b>${u.refCount||0}</b>\n💎 Bonus      <b>${rp(u.refEarn||0)}</b>\n${L}\n${cf.on?`Kamu dapat <b>${rp(cf.referrer)}</b> dan temanmu <b>${rp(cf.referee)}</b> setelah ia deposit minimal <b>${rp(cf.minDep)}</b>.`:'<i>Program ajakan sedang dinonaktifkan.</i>'}\n\n🔗 Link bot:\n<code>https://t.me/${esc(c.bot.username)}?start=ref_${esc(u.refCode||'')}</code>${web?`\n🌐 Link web:\n<code>${esc(web)}/register?ref=${esc(u.refCode||'')}</code>`:''}`
 return show(c,text,kb([[U('📤 Bagikan Link','https://t.me/share/url?url='+encodeURIComponent('https://t.me/'+c.bot.username+'?start=ref_'+(u.refCode||''))+'&text='+encodeURIComponent('Beli nomor OTP murah & otomatis di Artapedia ID'),'success')],[B('🏠 Menu','m','primary')]]))}
async function helpView(c){
 const web=siteOf(c),btn=(c.cfg.buttons||[]).filter(b=>b&&b.text&&/^https?:\/\//.test(b.url||'')).slice(0,4)
 const text=`<b>💬 BANTUAN</b>\n${L}\n1️⃣ <b>Isi Saldo</b> lewat QRIS / Virtual Account.\n2️⃣ <b>Beli Nokos</b>, pilih server, aplikasi &amp; negara.\n3️⃣ Kode OTP dikirim <b>otomatis</b> ke chat ini.\n4️⃣ Kalau OTP tak masuk, batalkan: saldo kembali.\n${L}\n<i>Perlu bantuan lain? Hubungi CS lewat tombol di bawah.</i>`
 return show(c,text,kb([web?[U('💬 Chat CS di Web',web+'/cs','success')]:[],...btn.map(b=>[U(b.text,b.url,'primary')]),[B('🏠 Menu','m','primary')]]))}

// ---------- password web / hubungkan akun ----------
async function pwView(c,u){
 const tk=rid();await kv.set('pr:'+tk,{id:u.id,exp:Date.now()+30*60000});const web=siteOf(c)
 if(!web)return show(c,'⚠️ URL situs belum diisi admin (Integrasi › URL situs).',kb([[B('⬅️ Kembali','acc','primary')]]))
 return show(c,`<b>🔑 PASSWORD WEB</b>\n${L}\nBuka link di bawah untuk membuat password. Berlaku <b>30 menit</b>, sekali pakai.\n\nSetelah itu masuk di web dengan email:\n<code>${esc(u.email)}</code>`,kb([[U('🔐 Buat Password Sekarang',web+'/reset?token='+tk,'success')],[B('⬅️ Kembali','acc','primary')]]))}
async function lnkView(c){
 await setSt(c.from.id,{k:'link'})
 return show(c,`<b>🔗 HUBUNGKAN AKUN WEB</b>\n${L}\nPunya akun di web Artapedia? Hubungkan agar saldo &amp; riwayatnya sama.\n\n1️⃣ Buka web › Dashboard › <b>Hubungkan Telegram</b>\n2️⃣ Salin kode yang muncul\n3️⃣ <b>Kirim kodenya ke chat ini</b> 👇\n\n<i>Syarat: saldo akun bot ini harus Rp0 dan tidak ada order berjalan.</i>`,kb([[B('❌ Batal','m','danger')]]))}
async function doLink(c,u,code){
 code=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')
 const r=code&&await kv.get('tmp:tgl:'+code);await setSt(c.from.id,{})
 if(!r||r.exp<Date.now())return show(c,'❌ Kode tidak valid atau sudah kedaluwarsa. Buat kode baru di web.',kb([[B('🔄 Coba Lagi','lnk','primary'),B('🏠 Menu','m','danger')]]))
 const w=await kv.get('u:'+r.uid);if(!w||w.banned)return show(c,'❌ Akun web tidak ditemukan / diblokir.',kb([[B('🏠 Menu','m','primary')]]))
 if(w.id===u.id)return show(c,'✅ Akun ini sudah terhubung.',kb([[B('🏠 Menu','m','success')]]))
 if(w.tgId&&w.tgId!==c.from.id)return show(c,'❌ Akun web itu sudah terhubung ke Telegram lain.',kb([[B('🏠 Menu','m','primary')]]))
 if(u.balance>0||(u.tx||[]).some(x=>x.status==='pending'))return show(c,'❌ Akun bot punya saldo / order berjalan. Habiskan dulu, atau minta admin memindahkan.',kb([[B('🏠 Menu','m','primary')]]))
 w.tgId=c.from.id;w.tgUser=c.from.username||'';w.tgBot=c.bot.id;await save(w);await kv.set('tg:'+c.from.id,w.id);await kv.del('tmp:tgl:'+code)
 // hapus akun bot kosong supaya tidak menggandakan data
 await kv.del('u:'+u.id);await kv.del('e:'+u.email);await kv.del('k:'+u.apikey)
 const idx=((await kv.get('idx'))||[]).filter(x=>x!==u.id);await kv.set('idx',idx)
 await notify({src:'bot',i:'🔗',t:'Akun web terhubung',st:'ok',rows:[['Pengguna',mask(w.email)],['Telegram',c.from.username?'@'+c.from.username:'ID '+c.from.id]]})
 return show(c,`✅ <b>Terhubung!</b>\nAkun <code>${esc(mask(w.email))}</code> kini bisa dipakai di bot. Saldo: <b>${rp(w.balance)}</b>`,kb([[B('🏠 Menu Utama','m','success')]]))}

// ---------- BELI NOKOS ----------
const maintBlock=c=>{const m=c.cfg.maint||{};return m.on?(m.msg||'Situs sedang maintenance, pesanan & deposit baru dihentikan sementara.'):''}
function svList(c){return SERVERS.map(s=>({...s,...((c.cfg.srv||{})[s.server]||{})})).filter(s=>!c.cfg.off.includes(s.server)&&(!s.needs||c.sec[s.needs]))}
async function buyStart(c,u){
 const mb=maintBlock(c);if(mb)return show(c,`<b>🛠 MAINTENANCE</b>\n${L}\n${esc(mb)}`,kb([[B('🏠 Menu','m','primary')]]))
 const sv=svList(c);if(!sv.length)return show(c,'⚠️ Belum ada server nokos yang aktif.',kb([[B('🏠 Menu','m','primary')]]))
 const m=(c.cfg.maint||{}).srv||{}
 const rows=sv.map(s=>{const i=SERVERS.findIndex(x=>x.server===s.server),mm=m[s.server]&&m[s.server].on;return [B(`${mm?'🛠':'🖥'} ${s.name}${s.badge?' · '+s.badge:''}`,'bs:'+i,mm?'danger':'success')]})
 let text=`<b>🛒 BELI NOKOS</b>\n${L}\n👛 Saldo kamu <b>${rp(u.balance)}</b>\n\nPilih <b>server</b> nomor:\n`
 for(const s of sv)text+=`▫️ <b>${esc(s.name)}</b> — <i>${esc(s.description||'')}</i>\n`
 return show(c,text,kb([...rows,[B('🏠 Menu','m','primary')]]))}
async function pickServer(c,u,i){
 const s=SERVERS[+i];if(!s||!P[s.server])return toast(c,'Server tidak dikenal',1)
 const mm=((c.cfg.maint||{}).srv||{})[s.server];if(mm&&mm.on)return toast(c,mm.msg||'Server ini sedang maintenance',1)
 await toast(c,'Memuat aplikasi...')
 let items;try{items=await P[s.server].services()}catch(e){return show(c,'⚠️ Gagal memuat aplikasi: '+esc(e.message),kb([[B('🔄 Coba Lagi','bs:'+i,'primary'),B('⬅️ Server','buy','danger')]]))}
 items=items.map(x=>({c:x.service_code,n:x.service_name}))
 await setSt(c.from.id,{k:'buy',sv:s.server,items,q:''});return svPage(c,0)}
async function svPage(c,page){
 const st=await getSt(c.from.id);if(st.k!=='buy')return show(c,'Sesi habis. Mulai lagi.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const q=(st.q||'').toLowerCase(),items=q?st.items.filter(x=>x.n.toLowerCase().includes(q)):st.items
 const tp=Math.max(1,Math.ceil(items.length/PER)),pg=Math.min(Math.max(0,+page||0),tp-1),cur=items.slice(pg*PER,pg*PER+PER)
 const sn=(SERVERS.find(x=>x.server===st.sv)||{}).name
 let text=`<b>📱 PILIH APLIKASI</b>\n${L}\n🖥 Server <b>${esc(sn)}</b>${q?`\n🔍 Pencarian <b>${esc(st.q)}</b>`:''}\n📚 ${items.length} aplikasi · hal ${pg+1}/${tp}\n\n<i>Ketik nama aplikasi untuk mencari (mis. whatsapp).</i>`
 if(!cur.length)text+='\n\n⚠️ Tidak ada hasil.'
 const rows=cur.map(x=>[B('📲 '+x.n.slice(0,40),'bp:'+st.items.indexOf(x),'primary')])
 const nav=[];if(pg>0)nav.push(B('⬅️','bl:'+(pg-1)));nav.push(B(`${pg+1}/${tp}`,'bl:'+pg));if(pg<tp-1)nav.push(B('➡️','bl:'+(pg+1)))
 const tools=[B('🔍 Cari','bq','success')];if(q)tools.push(B('✖️ Hapus Cari','bx','danger'))
 return show(c,text,kb([...rows,nav,tools,[B('⬅️ Server','buy','primary'),B('🏠 Menu','m','danger')]]))}
async function pickService(c,u,i){
 const st=await getSt(c.from.id);if(st.k!=='buy')return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const s=st.items[+i];if(!s)return toast(c,'Aplikasi tidak ditemukan',1)
 await toast(c,'Memuat harga...')
 let cs;try{cs=await P[st.sv].countries(s.c)}catch(e){return show(c,'⚠️ Gagal memuat harga: '+esc(e.message),kb([[B('⬅️ Kembali','bl:0','primary')]]))}
 const opts=[];for(const ct of cs)for(const x of ct.pricelist||[])opts.push({cn:ct.name,fl:ct.flag||'',cid:x.country_id,pid:x.provider_id,pn:x.provider_name||'',base:x.price,price:sellPrice(c.cfg,st.sv,x.price),stock:x.stock})
 opts.sort((a,b)=>a.price-b.price)
 await setSt(c.from.id,{...st,sid:s.c,sname:s.n,opts:opts.slice(0,120),g:0});return optPage(c,u,0)}
async function optPage(c,u,page){
 const st=await getSt(c.from.id);if(st.k!=='buy'||!st.opts)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const tp=Math.max(1,Math.ceil(st.opts.length/PER)),pg=Math.min(Math.max(0,+page||0),tp-1),cur=st.opts.slice(pg*PER,pg*PER+PER)
 let text=`<b>🌍 PILIH NEGARA &amp; HARGA</b>\n${L}\n📲 <b>${esc(st.sname)}</b>\n👛 Saldo <b>${rp(u.balance)}</b>\n📚 ${st.opts.length} pilihan · hal ${pg+1}/${tp}`
 if(!st.opts.length)text+='\n\n⚠️ Stok kosong untuk aplikasi ini. Coba server lain.'
 const rows=cur.map((o,j)=>[B(`${o.fl||'🌐'} ${o.cn.slice(0,16)}${o.pn?' · '+o.pn.slice(0,12):''} · ${rp(o.price)}${o.stock!=null?' · '+o.stock:''}`,'bo:'+(pg*PER+j),u.balance>=o.price?'success':'danger')])
 const nav=[];if(pg>0)nav.push(B('⬅️','bt:'+(pg-1)));nav.push(B(`${pg+1}/${tp}`,'bt:'+pg));if(pg<tp-1)nav.push(B('➡️','bt:'+(pg+1)))
 return show(c,text+'\n\n<i>🟢 saldo cukup · 🔴 saldo kurang</i>',kb([...rows,nav,[B('⬅️ Aplikasi','bl:0','primary'),B('🏠 Menu','m','danger')]]))}
async function confirmView(c,u,i,g){
 const st=await getSt(c.from.id),o=st.k==='buy'&&st.opts&&st.opts[+i];if(!o)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 if(g!=null){st.g=+g?1:0;await setSt(c.from.id,st)}
 const fee=st.g?Math.ceil(o.price*0.1):0,total=o.price+fee
 const text=`<b>🧾 KONFIRMASI PESANAN</b>\n${L}\n📲 Aplikasi  <b>${esc(st.sname)}</b>\n🌍 Negara    <b>${esc(o.cn)}</b>${o.pn?`\n🛰 Varian    <b>${esc(o.pn)}</b>`:''}\n🏷 Harga     <b>${rp(o.price)}</b>\n🛡 Jaminan   <b>${st.g?'Aktif +'+rp(fee):'Tidak'}</b>\n${L}\n💳 Total     <b>${rp(total)}</b>\n👛 Saldo     <b>${rp(u.balance)}</b>${u.balance<total?'\n\n⚠️ <b>Saldo tidak cukup.</b> Isi saldo dulu.':''}\n\n<i>Jaminan OTP: nomor diganti otomatis bila kode belum masuk 4 menit; gagal total = refund penuh.</i>`
 const rows=[[B(st.g?'🛡 Jaminan: ON (ketuk matikan)':'🛡 Jaminan: OFF (ketuk aktifkan)','bg:'+i+':'+(st.g?0:1),st.g?'success':'primary')]]
 rows.push(u.balance>=total?[B('✅ Beli Sekarang','bgo:'+i,'success')]:[B('💰 Isi Saldo','dep','success')])
 rows.push([B('⬅️ Pilihan Lain','bt:0','primary'),B('❌ Batal','m','danger')])
 return show(c,text,kb(rows))}
async function placeOrder(c,u0,i){
 const st=await getSt(c.from.id),o=st.k==='buy'&&st.opts&&st.opts[+i];if(!o)return show(c,'Sesi habis.',kb([[B('🛒 Beli Nokos','buy','success')]]))
 const mb=maintBlock(c);if(mb)return show(c,'🛠 '+esc(mb),kb([[B('🏠 Menu','m','primary')]]))
 const u=await kv.get('u:'+u0.id);if(u.banned)return show(c,'⛔ Akun ditangguhkan.')
 // harga dicek ulang ke penyedia (tidak percaya data lama)
 let base=null;try{for(const ct of await P[st.sv].countries(st.sid))for(const x of ct.pricelist)if(x.provider_id==o.pid&&x.country_id==o.cid)base=x.price}catch(e){}
 if(base==null)return show(c,'⚠️ Stok / harga berubah. Pilih ulang.',kb([[B('🔄 Pilih Ulang','bt:0','primary')]]))
 const sell=sellPrice(c.cfg,st.sv,base);if(sell!==o.price)return show(c,`⚠️ Harga berubah menjadi <b>${rp(sell)}</b>. Pilih ulang untuk melanjutkan.`,kb([[B('🔄 Pilih Ulang','bt:0','primary')]]))
 const g=!!st.g,fee=g?Math.ceil(sell*0.1):0,price=sell+fee
 if(u.balance<price)return show(c,'⚠️ Saldo tidak cukup.',kb([[B('💰 Isi Saldo','dep','success'),B('🏠 Menu','m','primary')]]))
 mut(u,-price,'Order nokos (bot)');await save(u)
 let r;try{r=await P[st.sv].order({serviceId:st.sid,countryId:o.cid,providerId:o.pid,serviceName:st.sname,countryName:o.cn,server:st.sv})}
 catch(e){mut(u,price,'Refund gagal order');await save(u)
  await notify({src:'bot',i:'⚠️',t:'Order gagal (saldo kembali)',st:'fail',rows:[['Pengguna',mask(u.email)],['Layanan',st.sname],['Server',st.sv],['Harga',rp(price)],['Error',String(e.message).slice(0,200)]]})
  return show(c,`❌ <b>Order gagal</b>\n${esc(String(e.message).slice(0,200))}\n\n<i>Saldo sudah dikembalikan.</i>`,kb([[B('🔄 Coba Lagi','bt:0','primary'),B('🏠 Menu','m','danger')]]))}
 const rec={type:'order',id:r.id,server:st.sv,serviceId:st.sid,serviceName:st.sname,countryName:o.cn,countryId:o.cid,providerId:o.pid,phone:r.phone,price,fee,guarantee:g,status:'pending',otp:null,msg:null,cost:r.cost,expiredAt:r.expiredAt,refunded:false,at:Date.now(),via:'telegram'}
 u.tx.unshift(rec);await kv.set('o:'+r.id,u.id);await save(u);await setSt(c.from.id,{})
 await notify({src:'bot',i:'📱',t:'Pembelian nokos',st:'pending',id:['ID Order',r.id],rows:[['Pengguna',mask(u.email)],['Layanan',st.sname+' · '+o.cn],['Nomor',r.phone],['Harga',rp(price)],['Jaminan OTP',g?'Aktif (+'+rp(fee)+')':'Tidak'],['Server',st.sv],['Batas tunggu OTP',wibAt(r.expiredAt)],['Saldo sekarang',rp(u.balance)]],note:'Menunggu kode OTP masuk'})
 return orderView(c,u,rec,'✅ <b>Pesanan dibuat!</b> OTP akan dikirim otomatis ke chat ini.')}
function orderView(c,u,o,note){
 const done=o.status!=='pending'
 let text=`<b>📱 DETAIL ORDER</b>\n${L}\n${stOf(o.status)} Status   <b>${stName(o.status)}</b>\n📲 Layanan  <b>${esc(o.serviceName)}</b>${o.countryName?' · '+esc(o.countryName):''}\n☎️ Nomor    <code>${esc(o.phone)}</code>\n🏷 Harga    <b>${rp(o.price)}</b>${o.guarantee?'\n🛡 Jaminan OTP aktif':''}`
 if(o.otp)text+=`\n🔐 Kode     <code>${esc(o.otp)}</code>`
 if(o.status==='pending')text+=`\n⏳ Batas    ${wibAt(o.expiredAt)}`
 text+=`\n${L}\n🆔 <code>${esc(o.id)}</code>`
 if(note)text=note+'\n\n'+text
 const s=sid(o.id)
 const rows=o.status==='pending'?[[B('🔄 Cek OTP','oc:'+s,'success'),B('❌ Batalkan','ox:'+s,'danger')]]:[]
 rows.push([B('🛒 Beli Lagi','buy','success'),B('🏠 Menu','m','primary')])
 return show(c,text,kb(rows))}
const findOrder=(u,s)=>(u.tx||[]).find(x=>x.type==='order'&&sid(x.id)===s)
async function pollOrder(c,u,o){
 if(o.status!=='pending')return
 const s=await P[o.server].status(o.id)
 if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;o.tgSent=true;await fireOtp(u,o)
  await notify({src:'bot',i:'🔑',t:'OTP diterima',st:'ok',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)],['Server',o.server]],note:o.guarantee?'Order memakai Jaminan OTP':'Transaksi selesai (done)'})}
 else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)}
  await notify({src:'bot',i:'⌛',t:'Order expired + refund',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]]})}
 else await replaceIfNeeded(u,o)}
async function ordCheck(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findOrder(u,s);if(!o)return toast(c,'Order tidak ditemukan',1)
 const was=o.status+o.phone
 try{await pollOrder(c,u,o)}catch(e){return toast(c,'Gagal cek: '+e.message,1)}
 await save(u)
 if(o.status==='pending'&&was===o.status+o.phone){await toast(c,'⏳ OTP belum masuk, coba lagi sebentar lagi')}
 return orderView(c,u,o,o.status==='success'?'🎉 <b>OTP masuk!</b>':o.status==='expired'?'⌛ <b>Order kedaluwarsa.</b> Saldo dikembalikan.':o.replaced&&was!==o.status+o.phone?'🔁 <b>Nomor diganti otomatis</b> (Jaminan OTP).':'')}
async function ordCancelAsk(c,u,s){
 const o=findOrder(u,s);if(!o||o.status!=='pending')return toast(c,'Order sudah tidak bisa dibatalkan',1)
 return show(c,`<b>❌ BATALKAN ORDER?</b>\n${L}\n☎️ <code>${esc(o.phone)}</code>\n💸 Refund <b>${rp(o.price)}</b> kembali ke saldo.\n\n<i>Kalau OTP ternyata sudah masuk, order tidak dibatalkan.</i>`,kb([[B('✅ Ya, Batalkan','oxy:'+s,'danger'),B('↩️ Tidak','ord:'+s,'success')]]))}
async function ordCancel(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findOrder(u,s);if(!o||o.status!=='pending')return toast(c,'Order sudah tidak bisa dibatalkan',1)
 let s0=null;try{s0=await P[o.server].status(o.id)}catch(e){}
 if(s0&&s0.otp){o.status='success';o.otp=s0.otp;o.msg=s0.msg;o.tgSent=true;await fireOtp(u,o);await save(u);return orderView(c,u,o,'ℹ️ Kode OTP ternyata sudah masuk, order selesai.')}
 try{await P[o.server].cancel(o.id)}catch(e){return toast(c,'Ditolak provider: '+String(e.message).slice(0,120),1)}
 o.status='cancelled';if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)};await save(u)
 await notify({src:'bot',i:'❌',t:'Order dibatalkan',st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)]],note:'Dibatalkan pengguna, saldo sudah kembali'})
 return orderView(c,u,o,'✅ <b>Order dibatalkan.</b> Saldo sudah kembali.')}

// ---------- ISI SALDO ----------
async function depStart(c,u){
 const mb=maintBlock(c);if(mb)return show(c,`<b>🛠 MAINTENANCE</b>\n${L}\n${esc(mb)}`,kb([[B('🏠 Menu','m','primary')]]))
 const ml=await methodsList(c.cfg)
 if(!ml.length)return show(c,'⚠️ Belum ada metode pembayaran aktif. Hubungi admin.',kb([[B('🏠 Menu','m','primary')]]))
 const text=`<b>💰 ISI SALDO</b>\n${L}\n👛 Saldo kamu <b>${rp(u.balance)}</b>\n${c.cfg.bonus.on?`🎁 Bonus deposit <b>${c.cfg.bonus.pct}%</b> (min ${rp(c.cfg.bonus.minAmt)})\n`:''}\nPilih <b>metode pembayaran</b>:`
 return show(c,text,kb([...ml.map(m=>[B((m.type==='va'?'🏦 ':'📲 ')+m.name,'dm:'+m.provider,m.type==='va'?'primary':'success')]),[B('🏠 Menu','m','danger')]]))}
const AMTS=[5000,10000,20000,50000,100000,200000]
async function depAmount(c,u,m){
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return toast(c,'Metode tidak tersedia',1)
 const ok=AMTS.filter(a=>a>=x.min&&a<=x.max),rows=[];for(let i=0;i<ok.length;i+=3)rows.push(ok.slice(i,i+3).map(a=>B(rp(a),'da:'+m+':'+a,'success')))
 await setSt(c.from.id,{k:'amt',m})
 return show(c,`<b>💵 NOMINAL — ${esc(x.name)}</b>\n${L}\nPilih nominal atau <b>ketik angka</b> sendiri.\n📉 Minimal <b>${rp(x.min)}</b>\n📈 Maksimal <b>${rp(x.max)}</b>`,kb([...rows,[B('⬅️ Metode','dep','primary'),B('🏠 Menu','m','danger')]]))}
async function depConfirm(c,u,m,amt){
 const ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m);if(!x)return show(c,'⚠️ Metode tidak tersedia.',kb([[B('⬅️ Metode','dep','primary')]]))
 if(!(amt>=x.min&&amt<=x.max))return show(c,`⚠️ Nominal ${esc(x.name)} harus ${rp(x.min)} – ${rp(x.max)}.`,kb([[B('⬅️ Pilih Nominal','dm:'+m,'primary')]]))
 const bn=c.cfg.bonus.on&&amt>=c.cfg.bonus.minAmt?Math.floor(amt*c.cfg.bonus.pct/100):0
 return show(c,`<b>🧾 KONFIRMASI DEPOSIT</b>\n${L}\n🏦 Metode   <b>${esc(x.name)}</b>\n💵 Nominal  <b>${rp(amt)}</b>${bn?`\n🎁 Bonus    <b>~${rp(c.cfg.bonus.max?Math.min(bn,c.cfg.bonus.max):bn)}</b>`:''}\n${L}\n<i>Biaya layanan (jika ada) tampil di tagihan.</i>`,kb([[B('✅ Buat Tagihan','dgo:'+m+':'+amt,'success')],[B('⬅️ Ubah Nominal','dm:'+m,'primary'),B('❌ Batal','m','danger')]]))}
const qrUrl=q=>'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data='+encodeURIComponent(q)
function depCaption(o,u,note){
 const m=(METHODS[o.method]||METHODS.qris).name
 let t=`<b>💳 TAGIHAN DEPOSIT</b>\n${L}\n🏦 Metode   <b>${esc(m)}</b>\n💵 Nominal  <b>${rp(o.amount)}</b>\n${o.fee>0?`🧮 Biaya    <b>${rp(o.fee)}</b>\n`:''}💳 Total bayar <b>${rp(o.total)}</b>\n`
 if(o.va)t+=`🔢 No. VA   <code>${esc(o.va)}</code>\n`
 if(o.expMs)t+=`⏳ Batas    ${wibAt(o.expMs)}\n`
 t+=`${L}\n${stOf(o.status)} Status <b>${stName(o.status)}</b>\n🆔 <code>${esc(o.id)}</code>`
 if(o.status==='pending')t+=`\n\n<i>${o.va?'Transfer sesuai total ke nomor VA.':'Scan QR dengan e-wallet / m-banking apa saja.'} Saldo masuk otomatis &amp; bot akan memberi tahu.</i>`
 return (note?note+'\n\n':'')+t}
async function depCreate(c,u0,m,amt){
 const mb=maintBlock(c);if(mb)return show(c,'🛠 '+esc(mb),kb([[B('🏠 Menu','m','primary')]]))
 const u=await kv.get('u:'+u0.id),ml=await methodsList(c.cfg),x=ml.find(y=>y.provider===m)
 if(!x||!(amt>=x.min&&amt<=x.max))return show(c,'⚠️ Metode / nominal tidak valid.',kb([[B('⬅️ Metode','dep','primary')]]))
 if(u.tx.filter(y=>y.type==='deposit'&&y.status==='pending').length>=3)return show(c,'⚠️ Terlalu banyak tagihan belum dibayar. Batalkan salah satu dulu.',kb([[B('📜 Tagihan Saya','dl','primary'),B('🏠 Menu','m','danger')]]))
 await toast(c,'Membuat tagihan...')
 let d;try{d=await createDeposit(c.cfg,m,amt)}catch(e){return show(c,`❌ ${esc(e.message)}`,kb([[B('🔄 Coba Lagi','dm:'+m,'primary'),B('🏠 Menu','m','danger')]]))}
 const rec={type:'deposit',id:d.id,amount:amt,total:d.total,fee:d.fee,qr:d.qr,qrImg:d.qrImg,va:d.va||'',method:m,gw:d.gw,exp:d.exp,expMs:toMs(d.exp),status:'pending',credited:false,at:Date.now(),via:'telegram'}
 u.tx.unshift(rec);await kv.set('d:'+rec.id,u.id);await save(u);await setSt(c.from.id,{})
 await notify({src:'bot',i:'💰',t:'Deposit menunggu bayar',st:'pending',id:['ID Deposit',rec.id],rows:[['Pengguna',mask(u.email)],['Metode',x.name],['Rute',ROUTES[d.gw]],['Nominal',rp(amt)],['Biaya layanan',d.fee>0?rp(d.fee):''],['Total bayar',rp(d.total)],['Batas bayar',rec.expMs?wibAt(rec.expMs):''],['Saldo sekarang',rp(u.balance)]],note:'Pengguna belum membayar'})
 const k=depKb(rec),cap=depCaption(rec,u),img=/^https?:\/\//.test(rec.qrImg||'')?rec.qrImg:(rec.qr?qrUrl(rec.qr):'')
 if(c.mid)tg(c.bot.token,'deleteMessage',{chat_id:c.chat,message_id:c.mid})
 if(img){const r=await tg(c.bot.token,'sendPhoto',{chat_id:c.chat,photo:img,caption:cap,parse_mode:'HTML',reply_markup:k});if(r.ok)return r}
 return send(c,cap,k)}
const depKb=o=>kb(o.status==='pending'?[[B('🔄 Cek Status','dk:'+sid(o.id),'success'),B('❌ Batalkan','dx:'+sid(o.id),'danger')],[B('🏠 Menu','m','primary')]]:[[B('💰 Isi Lagi','dep','success'),B('🏠 Menu','m','primary')]])
const findDep=(u,s)=>(u.tx||[]).find(x=>x.type==='deposit'&&sid(x.id)===s)
async function depCheckBtn(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findDep(u,s);if(!o)return toast(c,'Tagihan tidak ditemukan',1)
 if(o.status==='pending'){quiet.add(o.id);try{if(await applyDep(u,o,await depCheck(o)))await save(u)}catch(e){quiet.delete(o.id);return toast(c,'Gagal cek: '+e.message,1)}quiet.delete(o.id)}
 if(o.status==='pending')return toast(c,'⏳ Belum dibayar. Selesaikan pembayaran lalu cek lagi.')
 const f=await kv.get('u:'+u.id);return show(c,depCaption(o,f||u,o.status==='completed'?'🎉 <b>Pembayaran diterima!</b>'+(o.bonus?` Bonus ${rp(o.bonus)}.`:''):''),depKb(o),true)}
async function depCancelAsk(c,u,s){
 const o=findDep(u,s);if(!o||o.status!=='pending')return toast(c,'Tagihan sudah tidak aktif',1)
 return show(c,`<b>❌ BATALKAN TAGIHAN?</b>\n${L}\n💵 ${rp(o.amount)} · ${esc((METHODS[o.method]||METHODS.qris).name)}\n\n<i>Kalau sudah terlanjur dibayar, saldo tetap masuk.</i>`,kb([[B('✅ Ya, Batalkan','dxy:'+s,'danger'),B('↩️ Tidak','dk:'+s,'success')]]),true)}
async function depCancelDo(c,u0,s){
 const u=await kv.get('u:'+u0.id),o=findDep(u,s);if(!o||o.status!=='pending')return toast(c,'Tagihan sudah tidak aktif',1)
 try{if(await depCheck(o)==='completed'){await applyDep(u,o,'completed');await save(u);return show(c,depCaption(o,u,'ℹ️ Ternyata sudah dibayar, saldo masuk.'),depKb(o),true)}}catch(e){}
 await depCancel(o);o.status='canceled';await save(u)
 await notify({src:'bot',i:'🚫',t:'Deposit dibatalkan',st:'warn',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],['Metode',(METHODS[o.method]||METHODS.qris).name+' · '+(ROUTES[o.gw]||'-')],['Dibuat',wibAt(o.at)]]})
 return show(c,depCaption(o,u,'🚫 <b>Tagihan dibatalkan.</b>'),depKb(o),true)}
async function depList(c,u){
 const items=(u.tx||[]).filter(x=>x.type==='deposit').slice(0,6)
 let text=`<b>📜 TAGIHAN DEPOSIT</b>\n${L}\n`+(items.length?'':'<i>Belum ada deposit.</i>')
 const rows=items.map(o=>[B(`${stOf(o.status)} ${rp(o.amount)} · ${(METHODS[o.method]||METHODS.qris).name}`,'dk:'+sid(o.id),o.status==='pending'?'primary':o.status==='completed'?'success':'danger')])
 return show(c,text+(items.length?'Ketuk untuk detail / cek status.':''),kb([...rows,[B('💰 Isi Saldo','dep','success'),B('🏠 Menu','m','primary')]]))}

// ---------- ADMIN ----------
const findUser=async q=>{q=String(q||'').trim().replace(/^@/,'')
 let id=null
 if(/^[a-f0-9]{32}$/i.test(q))id=q.toLowerCase();else if(q.includes('@'))id=await kv.get('e:'+q.toLowerCase());else if(/^\d{5,}$/.test(q))id=await kv.get('tg:'+q)
 return id&&await kv.get('u:'+id)}
async function adminMenu(c,note){
 const bots=await getBots(),tgN=((await kv.get('tgidx'))||[]).length,m=c.cfg.maint||{}
 const text=`${note?note+'\n\n':''}<b>🛠 PANEL ADMIN</b>\n${L}\n🤖 Bot aktif   <b>${bots.filter(b=>b.on!==false).length}</b>\n✈️ User bot    <b>${tgN}</b>\n🛠 Maintenance <b>${m.on?'🔴 ON':'🟢 OFF'}</b>\n💳 Metode aktif <b>${Object.values(c.cfg.dep.methods).filter(x=>x.on).length}</b>\n${L}\nPilih aksi 👇`
 return show(c,text,kb([
  [B('📊 Statistik','a:st','primary'),B('👤 Cek User','a:us','primary')],
  [B('➕ Add Saldo','a:add','success'),B('➖ Del Saldo','a:del','danger')],
  [B('⛔ Ban','a:ban','danger'),B('♻️ Unban','a:unban','success')],
  [B('📢 Broadcast Biasa','a:bc0','primary'),B('📌 Broadcast + Pin','a:bc1','success')],
  [B('💳 Metode Pembayaran','a:pay','primary'),B(m.on?'🛠 Maintenance: ON':'🛠 Maintenance: OFF','a:mt',m.on?'danger':'success')],
  [B('🖥 Server Nokos','a:sv','primary'),B('💰 Markup','a:mk','primary')],
  [B('📣 Banner Web','a:bw','primary'),B('💾 Backup Sekarang','a:bk','success')],
  [B('🔔 Tes Notif Channel','a:tn','primary'),B('🏠 Menu User','m','danger')]]))}
async function adminStats(c){
 const us=await allUsers(),t0=wibDayStart();let bal=0,ban=0,ordT=0,ordAll=0,depT=0,pend=0,tgN=0,sales=0
 for(const u of us){bal+=+u.balance||0;if(u.banned)ban++;if(u.tgId)tgN++
  for(const x of u.tx||[]){if(x.type==='order'){if(x.status==='success'){ordAll++;sales+=x.price;if(x.at>=t0)ordT++}if(x.status==='pending')pend++}
   if(x.type==='deposit'&&x.status==='completed'&&x.at>=t0)depT+=x.amount}}
 const text=`<b>📊 STATISTIK</b>\n${L}\n👥 Pengguna    <b>${us.length}</b>\n✈️ Dari Telegram <b>${tgN}</b>\n⛔ Dibanned    <b>${ban}</b>\n👛 Total saldo <b>${rp(bal)}</b>\n${L}\n📦 Order hari ini <b>${ordT}</b>\n📦 Order total    <b>${ordAll}</b>\n⏳ Order berjalan <b>${pend}</b>\n💵 Deposit hari ini <b>${rp(depT)}</b>\n🏷 Total penjualan <b>${rp(sales)}</b>`
 return show(c,text,kb([[B('🔄 Refresh','a:st','success'),B('⬅️ Panel','a','primary')]]))}
async function userCard(c,u,note){
 const ok=okOrders(u),spent=ok.reduce((a,x)=>a+x.price,0),dep=(u.tx||[]).filter(x=>x.type==='deposit'&&x.status==='completed').reduce((a,x)=>a+x.amount,0)
 const text=`${note?note+'\n\n':''}<b>👤 DETAIL USER</b>\n${L}\n🪪 <b>${esc(u.name)}</b>\n📧 <code>${esc(u.email)}</code>\n🆔 <code>${esc(u.id)}</code>\n✈️ Telegram ${u.tgId?`<code>${u.tgId}</code>${u.tgUser?' @'+esc(u.tgUser):''}`:'-'}\n${L}\n👛 Saldo  <b>${rp(u.balance)}</b>\n📦 Order  <b>${ok.length}</b> · ${rp(spent)}\n💵 Deposit <b>${rp(dep)}</b>\n📍 Status ${u.banned?'⛔ <b>BANNED</b>':'🟢 <b>Aktif</b>'}\n🕐 Gabung ${wibAt(Date.parse(u.joinedAt))}\n🔓 Login  ${u.lastLogin?wibAt(u.lastLogin):'-'}\n🌐 IP     <code>${esc(u.lastIp||'-')}</code>`
 return show(c,text,kb([[B('➕ Saldo','ua:add:'+u.id,'success'),B('➖ Saldo','ua:del:'+u.id,'danger')],
  [u.banned?B('♻️ Unban','ua:unban:'+u.id,'success'):B('⛔ Ban','ua:ban:'+u.id,'danger'),B('🔑 Link Reset','ua:rst:'+u.id,'primary')],
  [u.tgId?B('✉️ Kirim Pesan','ua:msg:'+u.id,'primary'):B('✉️ (belum terhubung)','a:us','primary'),B('🔄 Refresh','ua:ref:'+u.id,'primary')],
  [B('⬅️ Panel','a','primary')]]))}
async function adminAct(c,op,u,amount){
 const adm=(c.from.username?'@'+c.from.username:'ID '+c.from.id)
 if(op==='add'||op==='del'){
  const f=await kv.get('u:'+u.id);mut(f,op==='add'?amount:-amount,op==='add'?'Admin tambah (bot)':'Admin kurangi (bot)');await save(f)
  await notify({src:'bot',i:'🛠',t:op==='add'?'Admin tambah saldo':'Admin kurangi saldo',st:'admin',rows:[['Pengguna',mask(f.email)],['Nominal',(op==='add'?'+':'-')+rp(amount)],['Saldo sekarang',rp(f.balance)],['Admin',adm]]})
  await pushUser(f,`<b>${op==='add'?'💰 SALDO BERTAMBAH':'💸 SALDO DIKURANGI'}</b>\n${L}\n${op==='add'?'➕':'➖'} <b>${rp(amount)}</b>\n👛 Saldo sekarang <b>${rp(f.balance)}</b>`)
  return f}
 if(op==='ban'||op==='unban'){const f=await kv.get('u:'+u.id);f.banned=op==='ban';await save(f)
  await notify({src:'bot',i:op==='ban'?'⛔':'♻️',t:'Admin '+op+' akun',st:'admin',rows:[['Pengguna',mask(f.email)],['Admin',adm]]})
  if(op==='unban')await pushUser(f,'<b>♻️ AKUN DIPULIHKAN</b>\nAkunmu sudah aktif kembali.')
  return f}
 return u}
async function askAmount(c,op,u){
 await setSt(c.from.id,{k:'amount',op,uid:u.id})
 return show(c,`<b>${op==='add'?'➕ ADD SALDO':'➖ DEL SALDO'}</b>\n${L}\n👤 <code>${esc(u.email)}</code>\n👛 Saldo <b>${rp(u.balance)}</b>\n\nKetik <b>nominal</b> (angka saja, mis. <code>10000</code>):`,kb([[B('❌ Batal','a','danger')]]))}
async function askUser(c,op){
 await setSt(c.from.id,{k:'finduser',op})
 const T={add:'➕ ADD SALDO',del:'➖ DEL SALDO',ban:'⛔ BAN USER',unban:'♻️ UNBAN USER',view:'👤 CEK USER'}
 return show(c,`<b>${T[op]}</b>\n${L}\nKirim <b>email</b>, <b>ID Telegram</b>, atau <b>ID user</b>:`,kb([[B('❌ Batal','a','danger')]]))}
async function payView(c,note){
 const cfg=await getCfg(),rd=await readiness(cfg).catch(()=>({}))
 let text=`${note?note+'\n\n':''}<b>💳 METODE PEMBAYARAN</b>\n${L}\n<b>Rute (gateway)</b>\n`
 for(const r of Object.keys(ROUTES))text+=`${cfg.dep.routes[r].on?'🟢':'⚪'} ${ROUTES[r]} ${rd[r]?'· siap':'· <i>kredensial belum diisi</i>'}\n`
 text+=`\n<b>Metode untuk pengguna</b>\n`+Object.keys(METHODS).map(k=>`${cfg.dep.methods[k].on?'🟢':'⚪'} ${METHODS[k].name}`).join('\n')+`\n${L}\n<i>Ketuk untuk menyalakan / mematikan.</i>`
 const rr=Object.keys(ROUTES).map(r=>B((cfg.dep.routes[r].on?'🟢 ':'⚪ ')+ROUTES[r],'a:pr:'+r,cfg.dep.routes[r].on?'success':'danger'))
 const mm=Object.keys(METHODS),rows=[];for(let i=0;i<mm.length;i+=2)rows.push(mm.slice(i,i+2).map(k=>B((cfg.dep.methods[k].on?'🟢 ':'⚪ ')+METHODS[k].name,'a:pm:'+k,cfg.dep.methods[k].on?'success':'danger')))
 return show(c,text,kb([rr,...rows,[B('⬅️ Panel','a','primary')]]))}
async function mtView(c,note){
 const cfg=await getCfg(),m=cfg.maint||{}
 let text=`${note?note+'\n\n':''}<b>🛠 MAINTENANCE</b>\n${L}\n🌐 Seluruh situs  <b>${m.on?'🔴 AKTIF':'🟢 Normal'}</b>\n🎛 Mode  <b>${m.mode==='soft'?'Banner (order & deposit diblokir)':'Layar penuh'}</b>\n💬 Pesan  <i>${esc(m.msg||'(bawaan)')}</i>\n${L}\n<b>Per server</b>\n`+SERVERS.map(s=>`${((m.srv||{})[s.server]||{}).on?'🔴':'🟢'} ${esc(((cfg.srv||{})[s.server]||{}).name||s.name)}`).join('\n')
 const srv=SERVERS.map((s,i)=>B((((m.srv||{})[s.server]||{}).on?'🔴 ':'🟢 ')+(((cfg.srv||{})[s.server]||{}).name||s.name),'a:mts:'+i,((m.srv||{})[s.server]||{}).on?'danger':'success'))
 const rows=[];for(let i=0;i<srv.length;i+=2)rows.push(srv.slice(i,i+2))
 return show(c,text,kb([[m.on?B('🟢 Matikan Maintenance','a:mt:0','success'):B('🔴 Hidupkan Maintenance','a:mt:1','danger')],
  [B(m.mode==='soft'?'🖼 Ganti: Layar Penuh':'🏷 Ganti: Banner','a:mtm','primary'),B('💬 Ubah Pesan','a:mtt','primary')],...rows,[B('⬅️ Panel','a','primary')]]))}
async function setMaint(c,fn){
 const cfg=await getCfg(),was=cfg.maint||{},o={on:!!was.on,mode:was.mode==='soft'?'soft':'full',msg:was.msg||'',srv:{...(was.srv||{})}};fn(o)
 cfg.maint=o;await kv.set('cfg',cfg)
 const nOn=Object.values(o.srv).filter(x=>x.on).length
 if(!!was.on!==o.on||nOn!==Object.values(was.srv||{}).filter(x=>x.on).length)await notify({src:'bot',i:'🛠',t:o.on?'Maintenance AKTIF':'Maintenance dinonaktifkan',st:'admin',rows:[['Seluruh situs',o.on?'Aktif ('+(o.mode==='soft'?'banner':'layar penuh')+')':'Mati'],['Server maintenance',nOn],['Admin',c.from.username?'@'+c.from.username:'ID '+c.from.id]],note:o.msg||''})}
async function svAdmin(c,note){
 const cfg=await getCfg()
 const text=`${note?note+'\n\n':''}<b>🖥 SERVER NOKOS</b>\n${L}\n`+SERVERS.map(s=>`${cfg.off.includes(s.server)?'⚪ Mati':'🟢 Aktif'} · ${esc(((cfg.srv||{})[s.server]||{}).name||s.name)}`).join('\n')+`\n${L}\n<i>Server mati tidak tampil untuk pengguna.</i>`
 const b=SERVERS.map((s,i)=>B((cfg.off.includes(s.server)?'⚪ ':'🟢 ')+(((cfg.srv||{})[s.server]||{}).name||s.name),'a:svt:'+i,cfg.off.includes(s.server)?'danger':'success')),rows=[];for(let i=0;i<b.length;i+=2)rows.push(b.slice(i,i+2))
 return show(c,text,kb([...rows,[B('⬅️ Panel','a','primary')]]))}
async function mkView(c,note){
 const cfg=await getCfg()
 return show(c,`${note?note+'\n\n':''}<b>💰 MARKUP HARGA</b>\n${L}\n📈 Markup umum <b>${cfg.markup}%</b>\n🔢 Pembulatan <b>${cfg.mkRound?'Rp'+cfg.mkRound:'tidak ada'}</b>\n${L}\n<i>Pilih persen baru atau ketik angka. Markup per server diatur di web › 💰 Markup.</i>`,kb([[5,10,15,20].map(p=>B(p+'%','a:mk:'+p,cfg.markup===p?'success':'primary')),[25,30,40,50].map(p=>B(p+'%','a:mk:'+p,cfg.markup===p?'success':'primary')),[B('✏️ Ketik Persen','a:mkc','primary')],[B('⬅️ Panel','a','primary')]]))}

// ---------- BROADCAST ----------
export async function startBroadcast({text,photo,pin,by,botId}){
 const ids=((await kv.get('tgidx'))||[]).map(String)
 const job={id:rid().slice(0,10),text,photo:photo||'',pin:!!pin,ids,i:0,ok:0,fail:0,by:by||0,bot:botId||'',at:Date.now(),done:false}
 await kv.set('tmp:bc:'+job.id,job);await kv.set('tmp:bcjob',job.id);return job}
export async function bcStep(job,ms=40000){
 const bots=await getBots(),bot=bots.find(b=>b.id===job.bot&&b.on!==false)||bots.find(b=>b.on!==false);if(!bot){job.done=true;job.err='Tidak ada bot aktif';await kv.set('tmp:bc:'+job.id,job);return job}
 const end=Date.now()+ms
 while(job.i<job.ids.length&&Date.now()<end){
  const batch=job.ids.slice(job.i,job.i+20)
  const rs=await Promise.all(batch.map(async id=>{
   const r=job.photo?await tg(bot.token,'sendPhoto',{chat_id:id,photo:job.photo,caption:job.text.slice(0,1000),parse_mode:'HTML'}):await tg(bot.token,'sendMessage',{chat_id:id,text:job.text,parse_mode:'HTML',disable_web_page_preview:true})
   if(r.ok&&job.pin)await tg(bot.token,'pinChatMessage',{chat_id:id,message_id:r.result.message_id,disable_notification:true})
   if(!r.ok&&/blocked|deactivated|chat not found|kicked/i.test(r.description||'')){const uid=await kv.get('tg:'+id),u=uid&&await kv.get('u:'+uid);if(u){u.tgBlocked=true;await save(u)}}
   return r.ok}))
  job.ok+=rs.filter(Boolean).length;job.fail+=rs.filter(x=>!x).length;job.i+=batch.length
  await kv.set('tmp:bc:'+job.id,job);await new Promise(r=>setTimeout(r,800))}
 if(job.i>=job.ids.length&&!job.done){job.done=true;await kv.set('tmp:bc:'+job.id,job);await kv.del('tmp:bcjob')
  await notify({src:'bot',i:'📢',t:job.pin?'Broadcast + Pin selesai':'Broadcast selesai',st:'admin',rows:[['Sasaran',job.ids.length],['Terkirim',job.ok],['Gagal',job.fail]],note:job.text.replace(/<[^>]+>/g,'').slice(0,200)})
  if(job.by)await tg(bot.token,'sendMessage',{chat_id:job.by,text:`<b>📢 BROADCAST SELESAI</b>\n${L}\n🎯 Sasaran  <b>${job.ids.length}</b>\n📬 Terkirim <b>${job.ok}</b>\n🚫 Gagal    <b>${job.fail}</b>${job.pin?'\n📌 Pesan disematkan':''}`,parse_mode:'HTML'})}
 return job}
// dipanggil cron tiap menit: lanjutkan broadcast yang belum selesai
export async function tgTick(){const id=await kv.get('tmp:bcjob');if(!id)return null;const job=await kv.get('tmp:bc:'+id);if(!job||job.done){await kv.del('tmp:bcjob');return null};return bcStep(job,45000)}

async function bcAsk(c,pin){
 await setSt(c.from.id,{k:'bc',pin:pin?1:0})
 const n=((await kv.get('tgidx'))||[]).length
 return show(c,`<b>${pin?'📌 BROADCAST + PIN':'📢 BROADCAST BIASA'}</b>\n${L}\n🎯 Sasaran <b>${n}</b> pengguna bot\n\nKirim <b>teks</b> pesan (boleh format HTML: <code>&lt;b&gt;tebal&lt;/b&gt;</code>, <code>&lt;i&gt;miring&lt;/i&gt;</code>) atau <b>foto + caption</b>.${pin?'\n\n📌 Pesan akan <b>otomatis disematkan</b> di chat tiap pengguna.':''}`,kb([[B('❌ Batal','a','danger')]]))}

// ---------- router ----------
async function onText(c,u,text,m){
 const st=await getSt(c.from.id)
 if(/^\/(cancel|batal)/i.test(text)){await setSt(c.from.id,{});return menu(c,u)}
 if(c.adm&&st.k==='bc'){
  const photo=m.photo?m.photo[m.photo.length-1].file_id:'',body=(m.caption||m.text||'').trim();if(!body&&!photo)return send(c,'Kirim teks atau foto + caption.')
  await setSt(c.from.id,{k:'bcok',pin:st.pin,text:body,photo})
  const head=`<b>👁 PRATINJAU ${st.pin?'(PIN)':''}</b>\n${L}\n`
  return send(c,head+(photo?'🖼 <i>(foto terlampir)</i>\n':'')+body.slice(0,900)+`\n${L}\nKirim ke <b>${((await kv.get('tgidx'))||[]).length}</b> pengguna?`,kb([[B('✅ Kirim Sekarang','a:bcgo','success'),B('❌ Batal','a','danger')]]))}
 if(c.adm&&st.k==='finduser'){
  const t=await findUser(text);if(!t)return send(c,'❌ User tidak ditemukan. Coba lagi atau /cancel.')
  if(st.op==='view'){await setSt(c.from.id,{});return userCard({...c,mid:0},t)}
  if(st.op==='add'||st.op==='del'){return askAmount({...c,mid:0},st.op,t)}
  await setSt(c.from.id,{});const f=await adminAct(c,st.op,t);return userCard({...c,mid:0},f,st.op==='ban'?'⛔ <b>User dibanned.</b>':'♻️ <b>User di-unban.</b>')}
 if(c.adm&&st.k==='amount'){
  const n=num(text);if(n<=0||n>1e9)return send(c,'❌ Nominal tidak valid. Ketik angka, mis. <code>10000</code>.')
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{});if(!t)return send(c,'User tidak ditemukan.')
  const f=await adminAct(c,st.op,t,n);return userCard({...c,mid:0},f,`${st.op==='add'?'✅ <b>Saldo ditambah':'✅ <b>Saldo dikurangi'} ${rp(n)}.</b>`)}
 if(c.adm&&st.k==='usermsg'){
  const t=await kv.get('u:'+st.uid);await setSt(c.from.id,{});const ok=t&&await pushUser(t,`<b>📩 PESAN DARI ADMIN</b>\n${L}\n${esc(text)}`)
  return send(c,ok?'✅ Pesan terkirim.':'❌ Gagal kirim (user belum terhubung / memblokir bot).',kb([[B('⬅️ Panel','a','primary')]]))}
 if(c.adm&&st.k==='mtmsg'){await setSt(c.from.id,{});await setMaint(c,o=>{o.msg=text.slice(0,300)});return mtView({...c,mid:0},'✅ Pesan maintenance disimpan.')}
 if(c.adm&&st.k==='bw'){await setSt(c.from.id,{});const cfg=await getCfg();cfg.broadcast=text.slice(0,500);await kv.set('cfg',cfg)
  await notify({src:'bot',i:'📣',t:'Banner web diubah',st:'admin',note:cfg.broadcast});return adminMenu({...c,mid:0},'✅ Banner di beranda dashboard web diperbarui.')}
 if(c.adm&&st.k==='mkc'){const p=+String(text).replace(',','.');if(!(p>=0&&p<=500))return send(c,'❌ Isi angka 0–500.');await setSt(c.from.id,{});const cfg=await getCfg();cfg.markup=p;await kv.set('cfg',cfg);return mkView({...c,mid:0},'✅ Markup umum diubah.')}
 if(st.k==='link')return doLink({...c,mid:0},u,text)
 if(st.k==='buy'&&!st.opts){st.q=text.slice(0,40);await setSt(c.from.id,st);return svPage({...c,mid:0},0)}
 if(st.k==='amt'){const n=num(text);return depConfirm({...c,mid:0},u,st.m,n)}
 return menu({...c,mid:0},u)}

async function onCallback(c,u,d){
 const [a,x,y,z]=d.split(':')
 // menu & navigasi pengguna
 if(a==='m'){await setSt(c.from.id,{});return menu(c,u)}
 if(a==='acc')return accView(c,u)
 if(a==='his')return hisView(c,u,x)
 if(a==='mut')return mutView(c,u,x)
 if(a==='ref')return refView(c,u)
 if(a==='help')return helpView(c)
 if(a==='web')return toast(c,'URL situs belum diisi admin',1)
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
 if(a==='ord'){const o=findOrder(u,x);return o?orderView(c,u,o):toast(c,'Order tidak ditemukan',1)}
 if(a==='oc')return ordCheck(c,u,x)
 if(a==='ox')return ordCancelAsk(c,u,x)
 if(a==='oxy')return ordCancel(c,u,x)
 if(a==='dep')return depStart(c,u)
 if(a==='dm')return depAmount(c,u,x)
 if(a==='da')return depConfirm(c,u,x,num(y))
 if(a==='dgo')return depCreate(c,u,x,num(y))
 if(a==='dk')return depCheckBtn(c,u,x)
 if(a==='dx')return depCancelAsk(c,u,x)
 if(a==='dxy')return depCancelDo(c,u,x)
 if(a==='dl')return depList(c,u)
 // admin
 if(a==='a'||a==='ua'){
  if(!c.adm)return toast(c,'Khusus admin',1)
  if(a==='ua'){const t=await kv.get('u:'+y);if(!t)return toast(c,'User tidak ditemukan',1)
   if(x==='ref')return userCard(c,t)
   if(x==='add'||x==='del')return askAmount(c,x,t)
   if(x==='ban'||x==='unban'){const f=await adminAct(c,x,t);return userCard(c,f,x==='ban'?'⛔ <b>User dibanned.</b>':'♻️ <b>User di-unban.</b>')}
   if(x==='rst'){const tk=rid();await kv.set('pr:'+tk,{id:t.id,exp:Date.now()+30*60000});const w=siteOf(c);return show(c,`<b>🔑 LINK RESET</b>\n${L}\n👤 <code>${esc(t.email)}</code>\n<code>${esc(w)}/reset?token=${tk}</code>\n\n<i>Berlaku 30 menit, sekali pakai.</i>`,kb([[B('⬅️ Kembali','ua:ref:'+t.id,'primary')]]))}
   if(x==='msg'){await setSt(c.from.id,{k:'usermsg',uid:t.id});return show(c,`<b>✉️ KIRIM PESAN</b>\n${L}\nKe <code>${esc(t.email)}</code>\nKetik pesannya:`,kb([[B('❌ Batal','a','danger')]]))}
   return}
  if(!x){await setSt(c.from.id,{});return adminMenu(c)}
  if(x==='st')return adminStats(c)
  if(x==='us')return askUser(c,'view')
  if(['add','del','ban','unban'].includes(x))return askUser(c,x)
  if(x==='bc0')return bcAsk(c,false)
  if(x==='bc1')return bcAsk(c,true)
  if(x==='bcgo'){const st=await getSt(c.from.id);if(st.k!=='bcok')return toast(c,'Sesi habis',1)
   await setSt(c.from.id,{});await toast(c,'Mengirim...');const job=await startBroadcast({text:st.text,photo:st.photo,pin:st.pin,by:c.chat,botId:c.bot.id})
   await show(c,`<b>📡 BROADCAST BERJALAN</b>\n${L}\n🎯 Sasaran <b>${job.ids.length}</b>\n<i>Laporan dikirim setelah selesai.</i>`,kb([[B('⬅️ Panel','a','primary')]]))
   return bcStep(job,40000)}
  if(x==='pay')return payView(c)
  if(x==='pr'){const cfg=await getCfg();if(!ROUTES[y])return;cfg.dep.routes[y].on=!cfg.dep.routes[y].on;await kv.set('cfg',cfg);return payView(c)}
  if(x==='pm'){const cfg=await getCfg();if(!METHODS[y])return;cfg.dep.methods[y].on=!cfg.dep.methods[y].on;await kv.set('cfg',cfg);return payView(c)}
  if(x==='mt'&&y!=null){await setMaint(c,o=>{o.on=y==='1'});return mtView(c)}
  if(x==='mt')return mtView(c)
  if(x==='mtm'){await setMaint(c,o=>{o.mode=o.mode==='soft'?'full':'soft'});return mtView(c)}
  if(x==='mtt'){await setSt(c.from.id,{k:'mtmsg'});return show(c,`<b>💬 PESAN MAINTENANCE</b>\n${L}\nKetik pesan yang tampil ke pengguna:`,kb([[B('❌ Batal','a:mt','danger')]]))}
  if(x==='mts'){const s=SERVERS[+y];if(s)await setMaint(c,o=>{const e=o.srv[s.server]||{on:false,msg:''};o.srv[s.server]={on:!e.on,msg:e.msg||''}});return mtView(c)}
  if(x==='sv')return svAdmin(c)
  if(x==='svt'){const s=SERVERS[+y];if(s){const cfg=await getCfg();cfg.off=cfg.off.includes(s.server)?cfg.off.filter(k=>k!==s.server):[...new Set([...cfg.off,s.server])];await kv.set('cfg',cfg)};return svAdmin(c)}
  if(x==='mk'&&y){const p=+y;if(p>=0&&p<=500){const cfg=await getCfg();cfg.markup=p;await kv.set('cfg',cfg)};return mkView(c,'✅ Markup diubah ke '+y+'%.')}
  if(x==='mk')return mkView(c)
  if(x==='mkc'){await setSt(c.from.id,{k:'mkc'});return show(c,`<b>✏️ MARKUP</b>\n${L}\nKetik persen baru (0–500), mis. <code>12.5</code>:`,kb([[B('❌ Batal','a:mk','danger')]]))}
  if(x==='bw'){await setSt(c.from.id,{k:'bw'});return show(c,`<b>📣 BANNER WEB</b>\n${L}\nTeks ini tampil di beranda dashboard pengguna. Ketik teks baru (atau <code>-</code> untuk menghapus):`,kb([[B('❌ Batal','a','danger')]]))}
  if(x==='bk'){await toast(c,'Membuat backup...');let r;try{r=await runBackup('manual')}catch(e){r={ok:false,error:e.message}};return adminMenu(c,r.ok?'✅ Backup terkirim ke chat owner.':'❌ Backup gagal: '+esc(r.error||'-'))}
  if(x==='tn'){const r=await notify({src:'bot',i:'✅',t:'Tes notifikasi bot',st:'ok',rows:[['Status','Terhubung'],['Admin',c.from.username?'@'+c.from.username:'ID '+c.from.id]],note:'Kalau pesan ini masuk ke channel, notifikasi bot sudah siap.'});return adminMenu(c,r.ok?'✅ Notifikasi tes terkirim ke channel.':'❌ '+esc(r.error||'gagal'))}}
}

export async function handle(bot,upd){
 try{
  if(upd.my_chat_member){const m=upd.my_chat_member;if(m.chat.type==='private'){const uid=await kv.get('tg:'+m.from.id),u=uid&&await kv.get('u:'+uid);if(u){u.tgBlocked=m.new_chat_member.status==='kicked';await save(u)}}return}
  const cb=upd.callback_query,m=upd.message
  const from=(cb||m||{}).from;if(!from||from.is_bot)return
  const msg=cb?cb.message:m;if(!msg||msg.chat.type!=='private')return
  const cfg=await getCfg(),sec=await getSec()
  const c={bot,chat:msg.chat.id,from,mid:cb?msg.message_id:0,isPhoto:!!(cb&&msg.photo),cbq:cb&&cb.id,cfg,sec,adm:(bot.admins||[]).map(String).includes(String(from.id))}
  if(await kv.incr(`rl:tg:${from.id}:${Math.floor(Date.now()/60000)}`)>60){if(cb)await toast(c,'Terlalu cepat, tunggu sebentar');return}
  const text=cb?'':(m.text||m.caption||'').trim()
  const sm=text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);if(sm&&sm[1]&&/^ref_/i.test(sm[1]))c.ref=sm[1].slice(4).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)
  const u=await getUser(c)
  if(u.banned){if(cb)await tg(bot.token,'answerCallbackQuery',{callback_query_id:cb.id});return send(c,'<b>⛔ AKUN DITANGGUHKAN</b>\nAkunmu diblokir. Hubungi admin bila ada kesalahan.')}
  if(cb){try{return await onCallback(c,u,cb.data||'')}finally{if(!c.answered)await tg(bot.token,'answerCallbackQuery',{callback_query_id:cb.id})}}
  if(/^\/start/i.test(text)||/^\/(menu|home)/i.test(text)){await setSt(from.id,{});return menu(c,u)}
  if(/^\/id/i.test(text))return send(c,`🆔 ID Telegram kamu: <code>${from.id}</code>`)
  if(/^\/admin/i.test(text)){if(!c.adm)return send(c,'⛔ Kamu bukan admin bot ini. ID kamu: <code>'+from.id+'</code>');await setSt(from.id,{});return adminMenu({...c,mid:0})}
  const lk=text.match(/^\/link\s+(\S+)/i);if(lk)return doLink(c,u,lk[1])
  if(text||m.photo)return await onText(c,u,text,m)
 }catch(e){console.error('tgbot',e)}}
