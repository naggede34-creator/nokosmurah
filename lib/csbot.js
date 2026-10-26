// ===========================================================================
// Bot Telegram Customer Service (terpisah dari bot jualan / bot notifikasi channel).
//
//  - Setiap pengguna mengirim chat di /cs  -> bot mengirim pesannya ke admin CS
//    (semua ID di CSBOT_CHAT_ID, pisahkan koma), lengkap dengan foto bila ada.
//  - Admin membalas LANGSUNG dari Telegram, tiga cara:
//      1) Geser / "Reply" pada pesan notifikasi dari bot  (paling cepat)
//      2) Ketuk tombol "💬 Balas", lalu ketik pesan biasa (target tersimpan)
//      3) /daftar -> pilih pengguna yang belum dibalas -> ketik pesan
//    Teks maupun FOTO bisa dikirim sebagai balasan. Balasan masuk ke ruang chat
//    /cs pengguna seperti balasan dari panel admin (plus notifikasi HP pengguna).
//
// Token & ID diisi di /admin > Integrasi > Bot Customer Service. Webhook dipasang
// dengan satu tombol di sana. Tidak ada yang tersimpan di kode / env.
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {getSec} from './settings'
import {push as pushSend,KEY_ADMIN,keyUser} from './push'
import {save} from './auth'
import {notify,mask,rp as rupiah} from './telegram'
import {adminCmd,adminText,adminCb} from './csadmin'

const API=process.env.TG_API||'https://api.telegram.org'
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
export const csIds=sec=>String((sec&&sec.CSBOT_CHAT_ID)||'').split(/[,\s]+/).map(x=>x.trim()).filter(x=>/^-?\d+$/.test(x))
export const csbotReady=sec=>!!(sec&&sec.CSBOT_TOKEN&&csIds(sec).length)

async function call(token,method,body,ms=10000){
 try{const r=await fetch(`${API}/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(ms)})
  return (await r.json().catch(()=>null))||{ok:false,description:'HTTP '+r.status}}
 catch(e){return {ok:false,description:e.message}}}
export const csCall=call

// data:image/...;base64,xxxx -> Blob untuk sendPhoto
const blobOf=img=>{const m=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(img||''));if(!m)return null
 return {blob:new Blob([Buffer.from(m[2],'base64')],{type:m[1]}),ext:m[1].split('/')[1]}}
async function sendPhoto(token,chat,img,caption,ms=15000){
 const b=blobOf(img);if(!b)return {ok:false,description:'foto tidak valid'}
 try{const f=new FormData();f.append('chat_id',String(chat));f.append('photo',b.blob,'cs.'+b.ext);f.append('caption',String(caption||'').slice(0,1000));f.append('parse_mode','HTML')
  const r=await fetch(`${API}/bot${token}/sendPhoto`,{method:'POST',body:f,signal:AbortSignal.timeout(ms)})
  return (await r.json().catch(()=>null))||{ok:false,description:'HTTP '+r.status}}
 catch(e){return {ok:false,description:e.message}}}

const label=u=>esc(u.name||u.email||u.id)
const info=u=>`👤 <b>${label(u)}</b>\n📧 ${esc(u.email||'-')}\n🆔 ID Pengguna: <code>${esc(u.id)}</code>`
const MARK=/ID Pengguna:\s*([A-Za-z0-9_-]+)/

// ---------- web -> Telegram ----------
// Dipanggil dari csPush() saat PENGGUNA mengirim chat. Tidak pernah melempar error.
export async function csbotNotify(u,text,img){
 try{
  const sec=await getSec();if(!csbotReady(sec))return
  const t=sec.CSBOT_TOKEN,body=String(text||'').trim()
  const msg=`💬 <b>CHAT CS BARU</b>\n━━━━━━━━━━━━━━━━━━\n${info(u)}\n━━━━━━━━━━━━━━━━━━\n${body?esc(body):'<i>(tanpa teks)</i>'}\n\n<i>Geser/Reply pesan ini untuk membalas.</i>`
  const kb={inline_keyboard:[[{text:'💬 Balas',callback_data:'r:'+u.id,style:'success'},{text:'📋 Daftar chat',callback_data:'ls'}],[{text:'➕ Tambah saldo',callback_data:'sa:'+u.id},{text:'➖ Kurangi saldo',callback_data:'sd:'+u.id}]]}
  await Promise.all(csIds(sec).map(async chat=>{
   if(img)await sendPhoto(t,chat,img,`📷 Foto dari <b>${label(u)}</b>\n🆔 ID Pengguna: <code>${esc(u.id)}</code>`)
   const r=await call(t,'sendMessage',{chat_id:chat,text:msg,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:kb})
   // pesan terakhir dari pengguna ini jadi target balasan bawaan untuk chat itu
   if(r.ok)await kv.set('csbot:t:'+chat,u.id).catch(()=>{})}))
 }catch(e){}}

// ---------- Telegram -> web ----------
const csGet=async id=>(await kv.get('cs:'+id))||{msgs:[],au:0,uu:0,at:0}
// Sama dengan csPush(...,'admin',...) di route.js, versi ringkas untuk jalur bot.
export async function csAdminReply(uid,text,img){
 const u=await kv.get('u:'+uid);if(!u)throw Error('Pengguna tidak ditemukan')
 const t=await csGet(uid);t.msgs.push({from:'admin',text:String(text||'').slice(0,1000),...(img?{img}:{}),at:Date.now()})
 t.msgs=t.msgs.slice(-200);t.at=Date.now();t.uu++;t.au=0
 while(t.msgs.length>5&&JSON.stringify(t.msgs).length>8e6)t.msgs.shift()
 await kv.set('cs:'+uid,t)
 const ix=(await kv.get('csidx'))||[];if(!ix.includes(uid))await kv.sadd('csidx',uid)
 try{await pushSend(keyUser(uid),{t:'💬 Balasan Customer Service',b:(String(text||'').slice(0,120))||'📷 Foto',u:'/cs',tag:'cs',ring:2})}catch(e){}
 return u}

// Unduh foto dari Telegram (pilih ukuran terbesar yang masih muat batas chat web ±200KB)
async function tgPhoto(token,photos){
 const ok=(photos||[]).filter(p=>!p.file_size||p.file_size<=210000).pop()
 if(!ok)return {err:'Foto terlalu besar (maks ±200KB). Kirim sebagai foto biasa / kecilkan dulu.'}
 const f=await call(token,'getFile',{file_id:ok.file_id});if(!f.ok)return {err:'Gagal mengambil foto dari Telegram'}
 try{const r=await fetch(`${API}/file/bot${token}/${f.result.file_path}`,{signal:AbortSignal.timeout(15000)})
  const buf=Buffer.from(await r.arrayBuffer());const img='data:image/jpeg;base64,'+buf.toString('base64')
  if(img.length>300000)return {err:'Foto terlalu besar (maks ±200KB).'}
  return {img}}catch(e){return {err:'Gagal mengunduh foto'}}}

const say=(t,chat,text,extra={})=>call(t,'sendMessage',{chat_id:chat,text,parse_mode:'HTML',disable_web_page_preview:true,...extra})

async function daftar(t,chat){
 const ix=(await kv.get('csidx'))||[]
 const rows=(await Promise.all(ix.map(async id=>{const [u,c]=await Promise.all([kv.get('u:'+id),csGet(id)]);return u&&{u,c}}))).filter(Boolean)
 const unread=rows.filter(x=>x.c.au>0).sort((a,b)=>b.c.at-a.c.at).slice(0,10)
 if(!unread.length)return say(t,chat,'✅ Tidak ada chat yang menunggu balasan.')
 return say(t,chat,`📋 <b>Chat belum dibalas</b> (${unread.length})\nPilih pengguna lalu ketik balasanmu:`,
  {reply_markup:{inline_keyboard:unread.map(x=>[{text:`💬 ${String(x.u.name||x.u.email||x.u.id).slice(0,24)} (${x.c.au})`,callback_data:'r:'+x.u.id}])}})}

async function pilih(t,chat,uid){
 const u=await kv.get('u:'+uid);if(!u)return say(t,chat,'⚠️ Pengguna tidak ditemukan.')
 await kv.set('csbot:t:'+chat,uid)
 const c=await csGet(uid);if(c.au){c.au=0;await kv.set('cs:'+uid,c)}
 const last=c.msgs.slice(-4).map(m=>`${m.from==='admin'?'🛠 Admin':'👤 User'}: ${esc((m.text||'📷 Foto').slice(0,200))}`).join('\n')
 return say(t,chat,`${info(u)}\n━━━━━━━━━━━━━━━━━━\n${last||'<i>Belum ada obrolan</i>'}\n━━━━━━━━━━━━━━━━━━\n✍️ <b>Ketik balasanmu sekarang</b> (teks atau foto). /selesai untuk berhenti.`,
  {reply_markup:{inline_keyboard:[[{text:'➕ Tambah saldo',callback_data:'sa:'+uid},{text:'➖ Kurangi saldo',callback_data:'sd:'+uid}]]}})}


// ===========================================================================
// SALDO (add / del) lewat bot CS — hanya untuk ID Telegram yang terdaftar sebagai admin CS.
//   /saldo   [email|id]
//   /addsaldo [email|id] <nominal> [catatan]     (alias /tambahsaldo)
//   /delsaldo [email|id] <nominal> [catatan]     (alias /kurangsaldo)
// Tanpa email/id, bot memakai pengguna yang sedang jadi target balasan (atau pesan yang di-Reply).
// Tombol ➕/➖ di notifikasi chat juga tersedia. Setiap perubahan WAJIB dikonfirmasi dulu (✅ Ya).
// Memakai jalur yang sama dengan tombol tambah/kurang saldo di panel admin: tercatat di mutasi
// pengguna, aman dari tulis bersamaan (save), dan dikabarkan ke channel admin.
// ===========================================================================
export const SALDO_MAX=50000000
const OP_TTL=5*60000

// "10000", "10.000", "10rb", "10k", "1,5jt" -> angka rupiah (0 kalau tidak valid)
export const nominal=s=>{
 s=String(s||'').toLowerCase().trim()
 const m=/^(\d+(?:[.,]\d+)*)(k|rb|ribu|jt|juta)?$/.exec(s);if(!m)return 0
 let v=m[1];const mul=({k:1e3,rb:1e3,ribu:1e3,jt:1e6,juta:1e6})[m[2]]||1
 v=/^\d{1,3}([.,]\d{3})+$/.test(v)?v.replace(/[.,]/g,''):v.replace(',','.')
 const n=Math.round(parseFloat(v)*mul);return isFinite(n)&&n>0?n:0}

// email -> pengguna, atau ID pengguna langsung
export async function cariUser(q){
 q=String(q||'').trim();if(!q)return null
 if(q.includes('@')){const id=await kv.get('e:'+q.toLowerCase());return id?await kv.get('u:'+id):null}
 if(!/^[A-Za-z0-9_-]{4,64}$/.test(q))return null
 return await kv.get('u:'+q)}

// Ubah saldo pengguna (delta + / -). Dipakai bot; mirip addsaldo/delsaldo di panel admin.
export async function ubahSaldo(uid,delta,catatan,via='Bot CS'){
 const n=Math.abs(Math.round(delta))
 if(!(n>0))throw Error('Nominal harus lebih dari 0')
 if(n>SALDO_MAX)throw Error('Nominal terlalu besar (maks '+rupiah(SALDO_MAX)+')')
 const u=await kv.get('u:'+uid);if(!u)throw Error('Pengguna tidak ditemukan')
 if(delta<0&&(+u.balance||0)<n)throw Error('Saldo pengguna hanya '+rupiah(u.balance)+', tidak cukup untuk dikurangi '+rupiah(n))
 const sebelum=+u.balance||0
 u.balance=sebelum+(delta<0?-n:n);(u.mut=u.mut||[]).unshift({amt:delta<0?-n:n,bal:u.balance,note:delta<0?'Admin kurangi':'Admin tambah',at:Date.now()})
 await save(u)
 notify({i:'🛠',t:delta<0?'Admin kurangi saldo':'Admin tambah saldo',st:'admin',
  rows:[['Pengguna',mask(u.email)],['Nominal',(delta<0?'-':'+')+rupiah(n)],['Saldo sekarang',rupiah(u.balance)],['Lewat',via],['Catatan',String(catatan||'')]]}).catch(()=>{})
 return {u,sebelum,sesudah:+u.balance||0,n}}

const rowUser=(u,extra='')=>`${info(u)}\n👛 Saldo: <b>${rupiah(u.balance)}</b>${extra}`

// Minta konfirmasi sebelum benar-benar mengubah saldo
async function konfirmasi(t,chat,uid,delta,catatan){
 const u=await kv.get('u:'+uid);if(!u)return void await say(t,chat,'⚠️ Pengguna tidak ditemukan.')
 const n=Math.abs(delta)
 if(!(n>0))return void await say(t,chat,'⚠️ Nominal tidak valid. Contoh: <code>10000</code>, <code>10.000</code>, <code>10rb</code>, <code>1,5jt</code>')
 if(n>SALDO_MAX)return void await say(t,chat,'⚠️ Nominal terlalu besar (maks '+rupiah(SALDO_MAX)+').')
 if(delta<0&&(+u.balance||0)<n)return void await say(t,chat,`⚠️ Saldo <b>${label(u)}</b> hanya ${rupiah(u.balance)}, tidak cukup untuk dikurangi ${rupiah(n)}.`)
 const tok=crypto.randomBytes(6).toString('hex')
 await kv.set('tmp:csbot:op:'+tok,{uid,delta,note:String(catatan||'').slice(0,100),chat,exp:Date.now()+OP_TTL})
 const after=(+u.balance||0)+delta
 return void await say(t,chat,`${delta<0?'➖ <b>KURANGI SALDO</b>':'➕ <b>TAMBAH SALDO</b>'}\n━━━━━━━━━━━━━━━━━━\n${info(u)}\n━━━━━━━━━━━━━━━━━━\nSaldo sekarang  <b>${rupiah(u.balance)}</b>\nPerubahan  <b>${delta<0?'-':'+'}${rupiah(n)}</b>\nSaldo setelahnya  <b>${rupiah(after)}</b>${catatan?`\nCatatan  <i>${esc(String(catatan).slice(0,100))}</i>`:''}\n\nLanjutkan?`,
  {reply_markup:{inline_keyboard:[[{text:'✅ Ya, proses',callback_data:'sy:'+tok},{text:'❌ Batal',callback_data:'sn:'+tok}]]}})}

async function eksekusi(t,chat,tok){
 const key='tmp:csbot:op:'+tok
 if(!await kv.lock('csbot:op:'+tok,15000))return void await say(t,chat,'⏳ Sedang diproses, jangan tekan dua kali.')
 try{
  const op=await kv.get(key)
  if(!op)return void await say(t,chat,'ℹ️ Permintaan ini sudah diproses atau dibatalkan.')
  if(op.chat!==chat)return void await say(t,chat,'⛔ Permintaan ini dibuat di chat lain.')
  await kv.del(key)                                       // sekali pakai: tidak mungkin diproses dua kali
  if(Date.now()>op.exp)return void await say(t,chat,'⌛ Permintaan kedaluwarsa (lebih dari 5 menit). Ulangi perintahnya.')
  try{const r=await ubahSaldo(op.uid,op.delta,op.note)
   return void await say(t,chat,`✅ <b>${op.delta<0?'Saldo dikurangi':'Saldo ditambah'}</b>\n${info(r.u)}\n━━━━━━━━━━━━━━━━━━\nSebelum  ${rupiah(r.sebelum)}\nPerubahan  <b>${op.delta<0?'-':'+'}${rupiah(r.n)}</b>\nSekarang  <b>${rupiah(r.sesudah)}</b>`)}
  catch(e){return void await say(t,chat,'⚠️ Gagal: '+esc(e.message))}}
 finally{await kv.unlock('csbot:op:'+tok)}}

// Tujuan bawaan perintah saldo: pesan yang di-Reply, lalu target balasan tersimpan
async function targetBawaan(chat,m){
 const rpl=m&&m.reply_to_message
 if(rpl){const mm=MARK.exec(String(rpl.text||rpl.caption||''));if(mm)return mm[1]}
 return String(await kv.get('csbot:t:'+chat)||'')}

async function perintahSaldo(t,chat,m,cmd,rest){
 const tok=rest.split(/\s+/).filter(Boolean)
 if(cmd==='saldo'){
  const u=tok[0]?await cariUser(tok[0]):await (async()=>{const id=await targetBawaan(chat,m);return id?await kv.get('u:'+id):null})()
  if(!u)return void await say(t,chat,tok[0]?'⚠️ Pengguna tidak ditemukan. Pakai email lengkap atau ID Pengguna.':'ℹ️ Pakai: <code>/saldo email@pengguna.com</code> (atau Reply pesan chat pengguna)')
  return void await say(t,chat,rowUser(u),{reply_markup:{inline_keyboard:[[{text:'➕ Tambah saldo',callback_data:'sa:'+u.id},{text:'➖ Kurangi saldo',callback_data:'sd:'+u.id}]]}})}
 const tambah=cmd==='addsaldo'||cmd==='tambahsaldo'
 const bantuan=`ℹ️ Pakai:\n<code>${tambah?'/addsaldo':'/delsaldo'} email@pengguna.com 10000 catatan</code>\n<code>${tambah?'/addsaldo':'/delsaldo'} 10000</code>  (untuk pengguna yang sedang jadi target / yang di-Reply)\n\nNominal boleh <code>10000</code>, <code>10.000</code>, <code>10rb</code>, <code>1,5jt</code>.`
 if(!tok.length)return void await say(t,chat,bantuan)
 let uid='',n=0,catatan=''
 const t0=tok[0]
 if(nominal(t0)>0&&!t0.includes('@')&&t0.length<20){   // tanpa identitas: pakai target bawaan
  uid=await targetBawaan(chat,m);n=nominal(t0);catatan=tok.slice(1).join(' ')
  if(!uid)return void await say(t,chat,'ℹ️ Belum ada target. Sebutkan email / ID Pengguna, atau Reply pesan chat pengguna.\n\n'+bantuan)}
 else{
  const u=await cariUser(t0);if(!u)return void await say(t,chat,'⚠️ Pengguna <code>'+esc(t0.slice(0,60))+'</code> tidak ditemukan. Pakai email lengkap atau ID Pengguna.')
  uid=u.id;n=nominal(tok[1]);catatan=tok.slice(2).join(' ')
  if(!n)return void await say(t,chat,'⚠️ Nominal tidak valid.\n\n'+bantuan)}
 return void await konfirmasi(t,chat,uid,tambah?n:-n,catatan)}

// Setelah menekan ➕/➖: bot menunggu nominal di pesan berikutnya (berlaku 2 menit)
async function mintaNominal(t,chat,uid,tambah){
 const u=await kv.get('u:'+uid);if(!u)return void await say(t,chat,'⚠️ Pengguna tidak ditemukan.')
 await kv.set('tmp:csbot:ask:'+chat,{uid,tambah,exp:Date.now()+2*60000})
 return void await say(t,chat,`${tambah?'➕':'➖'} <b>${tambah?'Tambah':'Kurangi'} saldo</b>\n${rowUser(u)}\n\n✍️ Ketik <b>nominal</b> (mis. <code>10000</code> atau <code>10rb</code>), boleh diikuti catatan.\n/batal untuk membatalkan.`)}

// true = pesan ini sudah dipakai sebagai jawaban nominal
async function jawabNominal(t,chat,txt){
 const ask=await kv.get('tmp:csbot:ask:'+chat);if(!ask)return false
 if(Date.now()>ask.exp||!txt){await kv.del('tmp:csbot:ask:'+chat);return false}
 const tok=txt.split(/\s+/),n=nominal(tok[0])
 if(!n){await kv.del('tmp:csbot:ask:'+chat);return false}   // bukan nominal: anggap balasan chat biasa
 await kv.del('tmp:csbot:ask:'+chat)
 await konfirmasi(t,chat,ask.uid,ask.tambah?n:-n,tok.slice(1).join(' '))
 return true}

export async function csbotHandle(upd){
 const sec=await getSec(),t=sec.CSBOT_TOKEN;if(!t)return
 const ids=csIds(sec)
 // tombol inline
 if(upd.callback_query){
  const q=upd.callback_query,chat=String((q.message&&q.message.chat&&q.message.chat.id)||q.from.id)
  if(!ids.includes(chat)&&!ids.includes(String(q.from.id))){await call(t,'answerCallbackQuery',{callback_query_id:q.id,text:'Tidak diizinkan',show_alert:true});return}
  await call(t,'answerCallbackQuery',{callback_query_id:q.id})
  const d=String(q.data||'')
  // Panel admin web di bot CS: hanya ID Telegram PRIBADI yang terdaftar (anggota grup tidak ikut berhak)
  if(/^A[A-Z]/.test(d)){if(!ids.includes(String(q.from.id)))return void await say(t,chat,'⛔ Panel admin hanya untuk ID Telegram pribadi yang terdaftar di Bot Customer Service.');return void await adminCb(t,chat,q.message&&q.message.message_id,d).catch(e=>say(t,chat,'⚠️ Gagal: '+esc(e.message)))}
  if(d==='ls')return void await daftar(t,chat)
  if(d.startsWith('r:'))return void await pilih(t,chat,d.slice(2))
  if(d.startsWith('sa:'))return void await mintaNominal(t,chat,d.slice(3),true)
  if(d.startsWith('sd:'))return void await mintaNominal(t,chat,d.slice(3),false)
  if(d.startsWith('sy:'))return void await eksekusi(t,chat,d.slice(3))
  if(d.startsWith('sn:')){await kv.del('tmp:csbot:op:'+d.slice(3));return void await say(t,chat,'❌ Dibatalkan. Saldo tidak diubah.')}
  return}
 const m=upd.message;if(!m||!m.chat)return
 const chat=String(m.chat.id),from=String(m.from&&m.from.id||''),txt=String(m.text||m.caption||'').trim()
 const boleh=ids.includes(chat)||ids.includes(from)
 if(/^\/(start|id)\b/i.test(txt)){
  if(!boleh)return void await say(t,chat,`🆔 ID Telegram kamu: <code>${esc(from)}</code>\nChat ID ini: <code>${esc(chat)}</code>\n\nBot ini khusus admin CS. Minta pemilik situs memasukkan ID di atas ke <i>admin › Integrasi › Bot Customer Service</i>.`)
  return void await say(t,chat,`✅ <b>Bot Customer Service aktif</b>\n\nChat dari pengguna web akan masuk ke sini.\n• <b>Reply</b> pesan notifikasi untuk membalas\n• atau ketuk 💬 Balas lalu ketik pesan\n• /daftar — chat belum dibalas\n• /selesai — lepas target balasan\n• /saldo — lihat saldo pengguna\n• /addsaldo — tambah saldo pengguna\n• /delsaldo — kurangi saldo pengguna\n• /admin — 🛠 panel admin web (kelola seluruh web dari sini)\n• /aksi — semua aksi admin web\n\n🆔 ID kamu: <code>${esc(from)}</code>`)}
 if(!boleh)return
 // Panel admin web (/admin, /aksi, formulir terpandu): khusus ID pribadi admin
 if(ids.includes(from)){
  if(await adminCmd(t,chat,txt,m).catch(e=>{say(t,chat,'⚠️ Gagal: '+esc(e.message));return true}))return
  if(!m.photo&&!txt.startsWith('/')&&await adminText(t,chat,txt,m).catch(e=>{say(t,chat,'⚠️ Gagal: '+esc(e.message));return true}))return}
 if(/^\/daftar\b/i.test(txt))return void await daftar(t,chat)
 if(/^\/selesai\b/i.test(txt)){await kv.del('csbot:t:'+chat);return void await say(t,chat,'👌 Target balasan dilepas.')}
 if(/^\/batal\b/i.test(txt)){await kv.del('tmp:csbot:ask:'+chat);return void await say(t,chat,'👌 Dibatalkan.')}
 const sm=/^\/(addsaldo|tambahsaldo|delsaldo|kurangsaldo|saldo)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(txt)
 if(sm)return void await perintahSaldo(t,chat,m,sm[1].toLowerCase(),String(sm[2]||'').trim())
 if(txt.startsWith('/'))return
 // habis menekan ➕/➖: pesan berikutnya yang berupa nominal dipakai sebagai nominal, bukan balasan chat
 if(!m.photo&&await jawabNominal(t,chat,txt))return
 // tentukan tujuan: reply ke notifikasi > target tersimpan
 let uid=''
 const rp=m.reply_to_message
 if(rp){const mm=MARK.exec(String(rp.text||rp.caption||''));if(mm)uid=mm[1]}
 if(!uid)uid=String(await kv.get('csbot:t:'+chat)||'')
 if(!uid)return void await say(t,chat,'ℹ️ Belum ada tujuan. <b>Reply</b> pesan chat dari pengguna, atau pilih lewat /daftar.')
 let img=''
 if(m.photo){const p=await tgPhoto(t,m.photo);if(p.err)return void await say(t,chat,'⚠️ '+p.err);img=p.img}
 if(!txt&&!img)return void await say(t,chat,'ℹ️ Kirim teks atau foto sebagai balasan.')
 try{const u=await csAdminReply(uid,txt.slice(0,1000),img)
  await kv.set('csbot:t:'+chat,uid)
  await say(t,chat,`✅ Terkirim ke <b>${label(u)}</b>`,{reply_to_message_id:m.message_id,allow_sending_without_reply:true})}
 catch(e){await say(t,chat,'⚠️ Gagal: '+esc(e.message))}}

// Dipakai tombol admin (pasang / uji / matikan webhook)
export async function csbotSetup(token,url,secret){
 const me=await call(token,'getMe');if(!me.ok)return {ok:false,error:'Token bot tidak valid: '+(me.description||'getMe gagal')}
 const w=await call(token,'setWebhook',{url,secret_token:secret,allowed_updates:['message','callback_query'],max_connections:20,drop_pending_updates:true})
 if(!w.ok)return {ok:false,error:w.description||'setWebhook gagal'}
 await call(token,'setMyCommands',{commands:[{command:'start',description:'ℹ️ Info & ID Telegram'},{command:'daftar',description:'📋 Chat belum dibalas'},{command:'selesai',description:'👌 Lepas target balasan'},{command:'saldo',description:'👛 Lihat saldo pengguna'},{command:'addsaldo',description:'➕ Tambah saldo pengguna'},{command:'delsaldo',description:'➖ Kurangi saldo pengguna'},{command:'admin',description:'🛠 Panel admin web'},{command:'aksi',description:'🧰 Semua aksi admin web'},{command:'batal',description:'❌ Batalkan input / formulir'}]})
 return {ok:true,username:me.result.username,name:me.result.first_name}}
