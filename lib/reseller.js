// ===========================================================================
// BOT RESELLER — "jualan nokos tanpa modal"
// Pengguna mendaftarkan bot Telegram miliknya sendiri. Bot itu menjual nokos ke
// PELANGGAN DIA, dengan harga = harga platform + markup yang dia tentukan.
// Selisih markup masuk ke dompet reseller dan bisa ditarik otomatis lewat AustinPay.
//
// Catatan desain:
//  - Bot reseller memakai mesin bot yang sama (lib/tgbot.js), hanya dengan bendera
//    `bot.rs = <uid reseller>`. Jadi tidak ada dua mesin bot yang harus dirawat.
//  - Pelanggan bot reseller punya akun TERPISAH dari akun web (kunci `tgr:<uid>:<tgId>`),
//    supaya saldo pelanggan satu reseller tidak tercampur dengan reseller lain
//    maupun dengan saldo akun web.
//  - Deposit di bot reseller DIPAKSA lewat Pakasir saja (permintaan pemilik situs).
//  - Dompet reseller hanya bertambah dari markup. Modal/biaya nokos ditanggung platform,
//    karena uang deposit pelanggan masuk ke platform.
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {getSec} from './settings'
import {tg,getBots,saveBots,botSetup} from './tgpush'
import * as A from './austin'
import {notify,mask,rp} from './telegram'

export const KEY=uid=>'rs:'+uid
export const MARK_MIN=0, MARK_MAX=100
export const WD_MIN=10000          // minimal tarik
const nid=()=>crypto.randomBytes(8).toString('hex')
const clampMark=v=>{const x=Math.round(+v*10)/10;return isNaN(x)?5:Math.min(MARK_MAX,Math.max(MARK_MIN,x))}

const DEF=uid=>({uid,on:true,bot:null,markup:5,brand:'',ch:{id:'',user:''},balance:0,earn:0,sold:0,cust:0,wd:[],log:[],at:Date.now(),tnc:0})
export async function getRs(uid){const a=await kv.get(KEY(uid));return a&&a.uid?a:DEF(uid)}
// Tulis aman dari tabrakan (dua proses menulis bersamaan): baca ulang lalu coba lagi.
async function mutate(uid,fn){
 for(let i=0;i<6;i++){
  const a=await getRs(uid),rev=a.__rev||0
  const out=fn(a);if(out===false)return {a,out:false}
  a.wd=(a.wd||[]).slice(0,300);a.log=(a.log||[]).slice(0,300)
  if(await kv.casSet(KEY(uid),a,rev))return {a,out}
  await new Promise(r=>setTimeout(r,60+i*60))}
 throw Error('Gagal menyimpan data reseller, coba lagi')}

export const accept=uid=>mutate(uid,a=>{a.tnc=Date.now();return true}).then(r=>r.a)

// ---------- daftar / hapus bot ----------
export async function createBot(uid,b,site){
 const a=await getRs(uid)
 if(a.bot)throw Error('Satu akun hanya boleh punya satu bot reseller. Hapus bot lama dulu.')
 if(!a.tnc)throw Error('Setujui syarat & ketentuan dulu')
 const token=String(b.token||'').trim()
 if(!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token))throw Error('Token bot tidak valid. Salin ulang dari @BotFather.')
 const ownerId=String(b.ownerId||'').replace(/\D/g,'')
 if(!/^\d{5,15}$/.test(ownerId))throw Error('ID Telegram owner harus angka (kirim /id ke bot mana pun untuk melihatnya)')
 const want=String(b.username||'').trim().replace(/^@/,'')
 const ownerUser=String(b.ownerUser||'').trim().replace(/^@/,'')
 if(!/^[A-Za-z0-9_]{4,32}$/.test(ownerUser))throw Error('Username Telegram owner tidak valid (tanpa @, 4-32 huruf/angka/garis bawah)')
 const brand=String(b.brand||'').trim().slice(0,32)
 if(brand.length<3)throw Error('Nama toko minimal 3 huruf')
 const ch=parseCh(b)
 const markup=clampMark(b.markup)
 if(!String(site||'').startsWith('https://'))throw Error('Alamat situs harus HTTPS supaya webhook Telegram bisa dipasang')

 const me=await tg(token,'getMe')
 if(!me.ok||!me.result)throw Error('Token ditolak Telegram: '+(me.description||'tidak dikenal'))
 const uname=me.result.username||''
 if(want&&want.toLowerCase()!==uname.toLowerCase())throw Error(`Username bot tidak cocok. Token ini milik @${uname}.`)
 const bots=await getBots()
 if(bots.some(x=>x.token===token))throw Error('Bot ini sudah terdaftar')
 if(bots.filter(x=>x.rs).length>=200)throw Error('Kuota bot reseller penuh, hubungi admin')

 const bot={id:nid(),token,username:uname,name:me.result.first_name||uname,secret:crypto.randomBytes(16).toString('hex'),
  admins:[ownerId],on:true,site,at:Date.now(),rs:uid,brand,ownerUser}
 const w=await botSetup(bot)
 if(!w.ok)throw Error('Gagal memasang webhook: '+w.error)
 await saveBots([...bots,bot])
 const {a:out}=await mutate(uid,x=>{x.bot={id:bot.id,username:uname,name:bot.name,ownerId,ownerUser,at:bot.at}
  x.brand=brand;x.markup=markup;x.on=true;x.ch=ch;return true})
 notify({i:'🏪',t:'Bot reseller baru',st:'ok',rows:[['Bot','@'+uname],['Toko',brand],['Markup',markup+'%'],['Owner','@'+ownerUser]],
  note:'Reseller baru bergabung'}).catch(()=>{})
 return out}

export async function delBot(uid){
 const a=await getRs(uid);if(!a.bot)throw Error('Kamu belum punya bot reseller')
 const bots=await getBots(),bot=bots.find(x=>x.id===a.bot.id)
 if(bot){try{await tg(bot.token,'deleteWebhook',{drop_pending_updates:true})}catch(e){}
  await saveBots(bots.filter(x=>x.id!==bot.id))}
 const {a:out}=await mutate(uid,x=>{x.bot=null;return true})
 return out}

export async function refresh(uid){
 const a=await getRs(uid);if(!a.bot)throw Error('Kamu belum punya bot reseller')
 const bot=(await getBots()).find(x=>x.id===a.bot.id);if(!bot)throw Error('Data bot hilang, daftarkan ulang')
 const w=await botSetup(bot);if(!w.ok)throw Error(w.error)
 return {ok:1,url:w.url}}

export async function setMarkup(uid,pct){
 const m=clampMark(pct)
 const {a}=await mutate(uid,x=>{x.markup=m;return true})
 const bots=await getBots(),i=bots.findIndex(x=>x.rs===uid)
 if(i>=0){bots[i]={...bots[i],markupAt:Date.now()};await saveBots(bots)}
 return a}
export async function setBrand(uid,brand){
 const s=String(brand||'').trim().slice(0,32);if(s.length<3)throw Error('Nama toko minimal 3 huruf')
 const {a}=await mutate(uid,x=>{x.brand=s;return true})
 const bots=await getBots(),i=bots.findIndex(x=>x.rs===uid)
 if(i>=0){bots[i]={...bots[i],brand:s};await saveBots(bots)}
 return a}

// ---------- channel notifikasi milik reseller ----------
// id channel Telegram: -1001234567890 (supergroup/channel) atau angka biasa.
// username channel (tanpa @) hanya dipakai untuk tombol "Buka channel" di notifikasi.
export function parseCh(b){
 const id=String(b.chId==null?'':b.chId).trim()
 const user=String(b.chUser||'').trim().replace(/^@/,'')
 if(!id&&!user)return {id:'',user:''}
 if(id&&!/^-?\d{5,20}$/.test(id))throw Error('ID channel harus angka, contoh -1001234567890 (ambil dari @userinfobot)')
 if(user&&!/^[A-Za-z0-9_]{4,32}$/.test(user))throw Error('Username channel tidak valid (tanpa @, 4-32 huruf/angka/garis bawah)')
 if(!id)throw Error('Isi juga ID channel-nya, username saja tidak cukup untuk mengirim notifikasi')
 return {id,user}}
export async function setChannel(uid,b){
 const ch=parseCh(b)
 const {a}=await mutate(uid,x=>{x.ch=ch;return true})
 return a}
// Kirim notifikasi ke channel milik reseller, memakai BOT RESELLER itu sendiri.
// Tidak pernah melempar: channel adalah pelengkap, bukan syarat transaksi berhasil.
export async function chNotify(uid,text,markup){
 try{
  const a=await getRs(uid);const ch=a.ch||{}
  if(!ch.id||!a.bot)return {ok:false,error:'Channel belum diatur'}
  const bot=(await getBots()).find(x=>x.id===a.bot.id);if(!bot)return {ok:false,error:'Bot tidak ditemukan'}
  const r=await tg(bot.token,'sendMessage',{chat_id:ch.id,text,parse_mode:'HTML',disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})})
  if(!r.ok)return {ok:false,error:r.description||'ditolak Telegram'}
  return {ok:true}}
 catch(e){return {ok:false,error:e.message}}}
// Tombol uji dari halaman /reseller: pesan contoh + pesan error yang bisa dibaca pemilik toko.
export async function testCh(uid){
 const a=await getRs(uid)
 if(!(a.ch&&a.ch.id))throw Error('Isi ID channel dulu, lalu simpan')
 const r=await chNotify(uid,`<b>🔔 TES NOTIFIKASI CHANNEL</b>\n━━━━━━━━━━━━━━━━━━\nKalau pesan ini masuk, semua transaksi di <b>${String(a.brand||'tokomu').replace(/[<>&]/g,'')}</b> akan dikabarkan ke sini.`)
 if(!r.ok)throw Error('Gagal kirim ke channel: '+r.error+'. Pastikan botmu sudah dijadikan ADMIN di channel itu dan ID channelnya benar.')
 return {ok:1}}

// Kartu siap pakai untuk channel reseller. Nomor & identitas pembeli DISAMARKAN
// karena channel biasanya publik — pemilik toko tetap tahu ada transaksi apa.
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const rpx=n=>'Rp'+(+n||0).toLocaleString('id-ID')
export const samar=v=>{const t=String(v||'');return t.length<7?t:t.slice(0,4)+'•••••'+t.slice(-3)}
export const card=(ic,judul,baris,catatan)=>`<b>${ic} ${esc(judul)}</b>\n━━━━━━━━━━━━━━━━━━\n`+
 baris.filter(x=>x&&x[1]!==''&&x[1]!=null).map(([k,v])=>`${k}  <b>${esc(v)}</b>`).join('\n')+
 (catatan?`\n━━━━━━━━━━━━━━━━━━\n<i>${esc(catatan)}</i>`:'')
// OTP masuk — dipanggil dari bot, dari sinkron cron, dan dari web.
export const chOtp=(uid,o)=>chNotify(uid,card('🔑','OTP DITERIMA',[
 ['📲 Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['☎️ Nomor',samar(o.phone)],
 ['💵 Harga',rpx(o.price)],['💰 Untungmu',o.rsCut?rpx(o.rsCut):''],['🆔 Order',o.id]],'Transaksi selesai'))
// Deposit pelanggan — st: 'pending' | 'lunas'
export const chDep=(uid,o,st,saldo)=>chNotify(uid,st==='lunas'
 ? card('✅','DEPOSIT MASUK',[['💵 Nominal',rpx(o.amount)],['🏦 Metode','QRIS'],['👛 Saldo pelanggan',saldo==null?'':rpx(saldo)],['🆔 ID',o.id]],'Saldo pelanggan sudah bertambah otomatis')
 : card('💰','DEPOSIT MENUNGGU BAYAR',[['💵 Nominal',rpx(o.amount)],['💳 Total bayar',rpx(o.total)],['🏦 Metode','QRIS'],['🆔 ID',o.id]],'Pelanggan belum membayar'))

// ---------- pendapatan ----------
// Dipanggil mesin bot setiap pelanggan berhasil memesan nokos.
export async function addEarn(uid,amount,note){
 // n negatif dipakai saat order di-refund: bagian reseller ditarik kembali.
 const n=Math.floor(+amount||0);if(!n)return null
 const {a}=await mutate(uid,x=>{x.balance=Math.round((+x.balance||0)+n);x.earn=Math.round((+x.earn||0)+n)
  if(n>0)x.sold=(+x.sold||0)+1;else x.sold=Math.max(0,(+x.sold||0)-1)
  x.log=[{t:n>0?'earn':'back',amt:n,bal:x.balance,note:String(note||'').slice(0,80),at:Date.now()},...(x.log||[])]
  return true})
 return a}
// Admin menambah / mengurangi saldo dompet reseller.
// Sama seperti gateway: pengurangan tidak boleh membuat saldo minus.
export async function adminSaldo(uid,delta,note){
 const n=Math.round(+delta||0);if(!n)throw Error('Nominal harus lebih dari 0')
 // uid WAJIB sudah punya catatan reseller: tanpa penjagaan ini, salah ketik uid akan
 // diam-diam membuat rekening reseller baru dan saldonya hilang entah ke mana.
 const ada=await kv.get(KEY(uid));if(!ada||!ada.uid)throw Error('Reseller tidak ditemukan')
 const {a,out}=await mutate(uid,x=>{
  const bal=Math.round((+x.balance||0)+n)
  if(bal<0)return false
  x.balance=bal
  x.log=[{t:n>0?'adm+':'adm-',amt:n,bal,note:String(note||(n>0?'Admin tambah saldo':'Admin kurangi saldo')).slice(0,80),at:Date.now()},...(x.log||[])]
  return true})
 if(out===false)throw Error('Saldo reseller tidak cukup untuk dikurangi sebanyak itu')
 return a}
// Daftar semua reseller untuk panel admin.
export async function listAll(){
 const out=[];let after=''
 for(;;){const r=await kv.scanPrefix('rs:',after,200)
  for(const e of r.items){const a=e.v
   if(a&&a.uid)out.push({uid:a.uid,brand:a.brand||'',markup:a.markup,balance:a.balance||0,earn:a.earn||0,
    sold:a.sold||0,cust:a.cust||0,on:a.on!==false,bot:a.bot?{username:a.bot.username,ownerUser:a.bot.ownerUser,ownerId:a.bot.ownerId}:null,at:a.at})}
  after=r.last;if(r.done)break}
 return out.sort((x,y)=>y.earn-x.earn)}
export const addCust=uid=>mutate(uid,x=>{x.cust=(+x.cust||0)+1;return true}).then(r=>r.a).catch(()=>null)

// ---------- penarikan otomatis (AustinPay) ----------
export const wallets=()=>A.iwWallets()
export const products=w=>A.iwProducts(w)

export async function withdraw(uid,b){
 const a0=await getRs(uid)
 if(!a0.bot)throw Error('Daftarkan bot reseller dulu')
 const wallet=String(b.wallet||'').trim(),code=String(b.product_code||'').trim()
 const dest=String(b.phone||'').replace(/[\s-]/g,'')
 if(!wallet||!code)throw Error('Pilih dompet dan produk tujuan dulu')
 if(!/^[0-9]{5,20}$/.test(dest))throw Error('Nomor tujuan harus 5-20 digit angka')
 const list=(await A.iwProducts(wallet)).products||[]
 const pr=list.find(x=>String(x.code)===code)
 if(!pr)throw Error('Produk tidak ditemukan di dompet '+wallet)
 let nominal,cost
 if(pr.open_denom){
  nominal=Math.floor(+b.nominal||0)
  const lo=Math.max(1,+pr.min||1),hi=+pr.max||1e9
  if(!(nominal>=lo&&nominal<=hi))throw Error(`Nominal harus antara Rp${lo.toLocaleString('id-ID')} - Rp${hi.toLocaleString('id-ID')}`)
  cost=nominal+Math.max(0,+pr.fee||0)}
 else{nominal=Math.floor(+pr.nominal||0);cost=Math.floor(+pr.sell_price||0)
  if(!cost)throw Error('Harga produk tidak tersedia')}
 if(nominal<WD_MIN)throw Error(`Penarikan minimal Rp${WD_MIN.toLocaleString('id-ID')}`)

 const rec={id:nid(),wallet,code,phone:dest,nominal,fee:Math.max(0,cost-nominal),total:cost,
  status:'processing',ref:'',msg:'',refunded:false,at:Date.now()}
 // Saldo dipotong DULU di satu tulis atomik, jadi dua permintaan bersamaan tidak bisa menarik dua kali.
 const {out}=await mutate(uid,x=>{
  if((+x.balance||0)<cost)return false
  x.balance=Math.round((+x.balance||0)-cost)
  x.wd=[rec,...(x.wd||[])]
  x.log=[{t:'wd',amt:-cost,bal:x.balance,note:'Tarik ke '+wallet+' '+dest,at:rec.at},...(x.log||[])]
  return true})
 if(out===false)throw Error('Saldo reseller tidak cukup. Butuh '+rp(cost)+'.')
 await kv.sadd('rswd',uid)

 let res=null,err=null
 try{res=await A.iwCreate({wallet,product_code:code,phone:dest,...(pr.open_denom?{nominal}:{})})}
 catch(e){err=e.message}
 const st=err?'failed':String((res&&res.status)||'processing').toLowerCase()
 await mutate(uid,x=>{const r=(x.wd||[]).find(y=>y.id===rec.id);if(!r)return false
  r.status=st==='success'?'success':st==='failed'?'failed':'processing'
  r.ref=String((res&&res.id)||'');r.msg=err||String((res&&res.message)||'')
  if(r.status==='failed'&&!r.refunded){r.refunded=true;x.balance=Math.round((+x.balance||0)+r.total)
   x.log=[{t:'refund',amt:r.total,bal:x.balance,note:'Penarikan gagal, saldo kembali',at:Date.now()},...(x.log||[])]}
  return true})
 const fin=(await getRs(uid)).wd.find(x=>x.id===rec.id)
 if(fin.status==='failed')throw Error('Penarikan gagal: '+(fin.msg||'ditolak penyedia')+'. Saldo sudah dikembalikan.')
 notify({i:'🏧',t:'Reseller menarik dana',st:'ok',rows:[['Toko',a0.brand||'-'],['Dompet',wallet],['Tujuan',dest],['Nominal',rp(nominal)],['Total potong',rp(cost)],['Status',fin.status]]}).catch(()=>{})
 return fin}

// Sinkron penarikan yang masih diproses
export async function syncWd(uid){
 const a=await getRs(uid)
 const open=(a.wd||[]).filter(x=>x.status==='processing'&&x.ref)
 if(!open.length){await kv.srem('rswd',uid);return 0}
 let n=0
 for(const w of open.slice(0,10)){
  let st=null
  try{const h=await A.iwHistory({id:w.ref})
   const row=(h.transactions||h.data||[]).find(x=>String(x.id)===String(w.ref))
   st=row&&String(row.status||'').toLowerCase()}catch(e){continue}
  if(!st||st==='processing'||st==='pending')continue
  await mutate(uid,x=>{const r=(x.wd||[]).find(y=>y.id===w.id);if(!r||r.status!=='processing')return false
   r.status=st==='success'?'success':'failed'
   if(r.status==='failed'&&!r.refunded){r.refunded=true;x.balance=Math.round((+x.balance||0)+r.total)
    x.log=[{t:'refund',amt:r.total,bal:x.balance,note:'Penarikan gagal, saldo kembali',at:Date.now()},...(x.log||[])]}
   return true});n++}
 return n}

// ---------- tampilan untuk halaman /reseller ----------
export async function view(uid){
 await syncWd(uid).catch(()=>{})
 const a=await getRs(uid)
 let hook=null
 if(a.bot){const bot=(await getBots()).find(x=>x.id===a.bot.id)
  if(bot){const info=await tg(bot.token,'getWebhookInfo').catch(()=>null)
   hook={ok:!!(info&&info.ok&&info.result&&info.result.url),pending:(info&&info.result&&info.result.pending_update_count)||0,
    error:(info&&info.result&&info.result.last_error_message)||''}}}
 return {on:a.on,tnc:a.tnc,bot:a.bot,brand:a.brand,markup:a.markup,ch:a.ch||{id:'',user:''},balance:a.balance,earn:a.earn,sold:a.sold,cust:a.cust,
  wd:(a.wd||[]).slice(0,30),log:(a.log||[]).slice(0,40),hook,wdMin:WD_MIN}}

// Disapu cron: penarikan yang masih diproses ikut diperbarui walau pemiliknya tidak membuka halaman.
export async function sweepWd(limit=20){
 const ids=((await kv.get('rswd'))||[]).slice(0,limit);let n=0
 for(const uid of ids){try{n+=await syncWd(uid)}catch(e){}}
 return n}
