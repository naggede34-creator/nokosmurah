// Dasar bot Telegram (sengaja ringan: hanya bergantung ke db) supaya bisa dipanggil dari lib mana pun tanpa circular import.
// Bot disimpan di kv "bots": [{id,token,username,name,secret,admins:[telegramId],on,site,at}]
import {kv} from './db'

export const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
// cache 5 detik: webhook bot dipanggil sangat sering, tidak perlu baca database tiap pesan
export const getBots=async()=>{const m=globalThis.__tgb;if(m&&Date.now()-m.t<5000)return m.v;const b=await kv.get('bots'),v=Array.isArray(b)?b:[];globalThis.__tgb={t:Date.now(),v};return v}
export const saveBots=async b=>{await kv.set('bots',b);globalThis.__tgb=null}
// id deposit yang sedang dicek lewat tombol bot (layar sudah diperbarui, jadi DM otomatis dilewati)
export const quiet=globalThis.__tgq||(globalThis.__tgq=new Set())

// Panggil Bot API. Selalu mengembalikan objek ({ok:false,description} saat gagal), tidak pernah melempar.
export async function tg(token,method,body,ms=15000){
 try{const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(ms)})
  const d=await r.json().catch(()=>null);return d||{ok:false,description:'HTTP '+r.status}}
 catch(e){return {ok:false,description:e.message}}}

// Tombol inline berwarna. style: primary (biru) | success (hijau) | danger (merah).
// Warna tampil di Telegram versi terbaru (rilis setelah 9 Feb 2026); klien lama tetap menampilkan tombol biasa.
export const B=(text,data,style='primary')=>({text,callback_data:String(data).slice(0,64),style})
export const U=(text,url,style='primary')=>({text,url,style})
// Tombol salin: sekali ketuk menyalin teks ke clipboard (nomor, kode OTP, nomor VA)
export const C=(text,val,style='primary')=>({text,copy_text:{text:String(val).slice(0,256)},style})
export const kb=rows=>({inline_keyboard:rows.filter(r=>r&&r.length)})

// Kirim DM ke pengguna yang akunnya terhubung ke Telegram. Return true kalau terkirim.
export async function pushUser(u,text,markup){
 try{if(!u||!u.tgId||u.tgBlocked)return false
  const bots=(await getBots()).filter(b=>b.on!==false),bot=bots.find(b=>b.id===u.tgBot)||bots[0];if(!bot)return false
  const r=await tg(bot.token,'sendMessage',{chat_id:u.tgId,text,parse_mode:'HTML',disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})})
  return !!r.ok}catch(e){return false}}

// Kirim ke semua admin bot (semua bot aktif)
export async function pushAdmins(text,markup){
 for(const b of (await getBots()).filter(x=>x.on!==false))for(const a of b.admins||[])await tg(b.token,'sendMessage',{chat_id:a,text,parse_mode:'HTML',disable_web_page_preview:true,...(markup?{reply_markup:markup}:{})})}

const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const L='━━━━━━━━━━━━━━━━━━'
// Template DM otomatis (OTP masuk, deposit masuk, order gagal)
export const msgOtp=o=>`<b>🔑 OTP DITERIMA</b>\n${L}\n📱 <b>${esc(o.serviceName)}</b>${o.countryName?' · '+esc(o.countryName):''}\n☎️ Nomor  <code>${esc(o.phone)}</code>\n🔐 Kode   <code>${esc(o.otp)}</code>\n${L}\n<i>Ketuk kode untuk menyalin. Selesai ✅</i>`
export const msgDep=(o,u)=>`<b>✅ DEPOSIT BERHASIL</b>\n${L}\n💵 Nominal  <b>${rp(o.amount)}</b>\n${o.bonus?`🎁 Bonus    <b>+${rp(o.bonus)}</b>\n`:''}${o.refBonus?`🤝 Ajakan   <b>+${rp(o.refBonus)}</b>\n`:''}👛 Saldo    <b>${rp(u.balance)}</b>\n${L}\n<i>Terima kasih sudah top up!</i>`
export const msgRefund=(o,u,why)=>`<b>↩️ ORDER ${esc(why)}</b>\n${L}\n📱 ${esc(o.serviceName)}\n☎️ <code>${esc(o.phone)}</code>\n💸 Refund  <b>${rp(o.price)}</b>\n👛 Saldo   <b>${rp(u.balance)}</b>\n${L}\n<i>Saldo sudah kembali otomatis.</i>`

// Pasang webhook + menu perintah + deskripsi untuk satu bot (dipanggil saat bot ditambahkan / disegarkan dari admin)
export async function botSetup(bot){
 const url=String(bot.site||'').replace(/\/+$/,'')+'/api/tg/'+bot.id
 const w=await tg(bot.token,'setWebhook',{url,secret_token:bot.secret,allowed_updates:['message','callback_query','my_chat_member'],max_connections:40})
 if(!w.ok)return {ok:false,error:w.description||'setWebhook gagal'}
 const base=[{command:'start',description:'🏠 Menu utama'},{command:'menu',description:'📋 Tampilkan menu'},{command:'id',description:'🆔 Lihat ID Telegram'},{command:'cancel',description:'❌ Batalkan proses'}]
 await tg(bot.token,'setMyCommands',{commands:base})
 for(const a of bot.admins||[])await tg(bot.token,'setMyCommands',{commands:[...base,{command:'admin',description:'🛠 Panel admin'}],scope:{type:'chat',chat_id:a}})
 await tg(bot.token,'setMyShortDescription',{short_description:'Nomor kosong & OTP otomatis 24 jam · Artapedia ID'})
 await tg(bot.token,'setMyDescription',{description:'✦ Artapedia ID ✦\nBeli nomor virtual & terima OTP otomatis, isi saldo QRIS / Virtual Account, semua langsung dari Telegram.\n\nKetuk START untuk mulai.'})
 return {ok:true,url}}
