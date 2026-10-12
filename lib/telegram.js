import {kv} from './db'
import {getSec} from './settings'
import {getBots} from './tgpush'
// Sensor email: ar***n@gmail.com
export const mask=e=>{e=String(e||'');const [a,d]=e.split('@');if(!d)return a?a.slice(0,2)+'***':'***';return a.slice(0,Math.min(2,a.length))+'***'+(a.length>3?a.slice(-1):'')+'@'+d}
export const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const wib=()=>new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'
const LINE='━━━━━━━━━━━━━━━━━━'
export const wibAt=ms=>{const d=new Date(+ms);return isNaN(d)||!ms?'-':d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}
// Lencana status di bawah judul
const BADGE={pending:'🟡 MENUNGGU',ok:'🟢 BERHASIL',fail:'🔴 GAGAL',warn:'🟠 PERHATIAN',info:'🔵 INFO',admin:'🛠 ADMIN'}
// Ikon otomatis per label baris
const ICON=[['pengguna','👤'],['email','📧'],['nama','🪪'],['diajak','🎟'],['pengajak','🤝'],['total pengguna','👥'],['nominal','💵'],['total bayar','💳'],['biaya','🧮'],['bonus','🎁'],['total masuk','💎'],['saldo','👛'],['metode','🏦'],['rute','🛣'],['layanan','📱'],['nomor lama','📵'],['nomor baru','📲'],['nomor','☎️'],['kode','🔑'],['harga','🏷'],['jaminan','🛡'],['server','🖥'],['refund','↩️'],['error','⚠️'],['pesan','💬'],['batas','⏳'],['dibuat','🕐'],['status','📍'],['juara','🏆'],['#','🏅'],['tombol','🔘'],['sumber','🤖'],['telegram','✈️'],['admin','🛠'],['sasaran','🎯'],['terkirim','📬'],['gagal','🚫']]
const ic=k=>{k=String(k).toLowerCase();for(const [a,b] of ICON)if(k.startsWith(a))return b;return '▫️'}
// n = string ATAU {i:emoji, t:judul, st:'pending|ok|fail|warn|info|admin', id:['ID Deposit',kode], rows:[[label,nilai],...], note:'teks'}
// Tombol link di bawah pesan diatur admin (dashboard admin -> Notifikasi), disimpan di cfg.buttons
export async function notify(n){
  const sc=await getSec(),t=sc.TELEGRAM_BOT_TOKEN,c=sc.TELEGRAM_CHAT_ID
  if(!t||!c)return {ok:false,error:'Token bot / Chat ID Telegram belum diisi (admin > Integrasi)'}
  if(typeof n==='string')n={i:'📢',t:n}
  const bots=await getBots(),bot=bots.find(x=>x.on!==false&&x.username)
  let text
  if(n.src==='bot'){
   // Gaya khusus untuk transaksi lewat BOT: kartu bergaris tebal, beda dari notifikasi web (┣ ┗)
   const rows=(n.rows||[]).filter(r=>r&&r[1]!==undefined&&r[1]!==null&&r[1]!=='')
   text=`┏━━ 🤖 <b>BOT · ${esc(String(n.t).toUpperCase())}</b>\n`
   if(n.st&&BADGE[n.st])text+=`┃ ${BADGE[n.st]}\n`
   text+=`┣━━━━━━━━━━━━━━━━━━\n`
   if(n.id&&n.id[1])text+=`┃ 🧾 <b>${esc(n.id[0])}</b>\n┃    <code>${esc(n.id[1])}</code>\n┣━━━━━━━━━━━━━━━━━━\n`
   rows.forEach(([k,v])=>{text+=`┃ ${ic(k)} ${esc(k)}  <b>${esc(v)}</b>\n`})
   text+=`┗━━━━━━━━━━━━━━━━━━\n`
   if(n.note)text+=`💬 <i>${esc(n.note)}</i>\n`
   text+=`🕒 ${wib()}\n✨ <b>Artapedia ID</b> · via Bot Telegram${bot?' @'+esc(bot.username):''}`
  }else{
  text=`<b>${n.i||'🔔'} ${esc(String(n.t).toUpperCase())}</b>\n`
  if(n.st&&BADGE[n.st])text+=`${BADGE[n.st]}\n`
  text+=`${LINE}\n`
  if(n.id&&n.id[1])text+=`🧾 <b>${esc(n.id[0])}</b>\n┗ <code>${esc(n.id[1])}</code>\n${LINE}\n`
  const rows=(n.rows||[]).filter(r=>r&&r[1]!==undefined&&r[1]!==null&&r[1]!=='')
  rows.forEach(([k,v],j)=>{text+=`${j===rows.length-1?'┗':'┣'} ${ic(k)} <b>${esc(k)}</b> ⟶ <code>${esc(v)}</code>\n`})
  if(n.note)text+=`${rows.length?'\n':''}💬 <i>${esc(n.note)}</i>\n`
  text+=`${LINE}\n🕒 ${wib()}\n🌍 <b>Artapedia ID</b> · Nokos &amp; OTP otomatis`}
  let btn=[];try{btn=((await kv.get('cfg'))||{}).buttons||[]}catch(e){}
  btn=btn.filter(b=>b&&b.text&&/^https?:\/\//.test(b.url||''))
  const kb=[];if(n.src==='bot'&&bot)kb.push([{text:'🤖 Buka Bot',url:'https://t.me/'+bot.username,style:'success'}])
  for(let i=0;i<btn.length;i+=2)kb.push(btn.slice(i,i+2).map(b=>({text:b.text,url:b.url})))
  try{const r=await fetch(`https://api.telegram.org/bot${t}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:c,text,parse_mode:'HTML',disable_web_page_preview:true,...(kb.length?{reply_markup:{inline_keyboard:kb}}:{})})});const d=await r.json();return {ok:!!d.ok,error:d.description}}
  catch(e){return {ok:false,error:e.message}}}

// Kirim file (backup) ke chat PRIBADI owner. BACKUP_CHAT_ID boleh lebih dari satu, pisahkan koma. Tidak pernah ke channel publik.
export async function sendFile(buf,name,caption,mime='application/gzip'){
  const sc=await getSec(),t=sc.TELEGRAM_BOT_TOKEN,ids=(sc.BACKUP_CHAT_ID||'').split(',').map(x=>x.trim()).filter(Boolean)
  if(!t)return {ok:false,error:'Token bot Telegram belum diisi (admin > Integrasi)'}
  if(!ids.length)return {ok:false,error:'Chat ID backup belum diisi (isi dengan chat ID Telegram pribadi owner, admin > Integrasi)'}
  const err=[]
  for(const id of ids){
    try{const f=new FormData();f.append('chat_id',id);f.append('caption',String(caption||'').slice(0,1000));f.append('document',new Blob([buf],{type:mime}),name)
      const r=await fetch(`https://api.telegram.org/bot${t}/sendDocument`,{method:'POST',body:f}),d=await r.json().catch(()=>({}))
      if(!d.ok)err.push(id+': '+(d.description||('HTTP '+r.status)))}catch(e){err.push(id+': '+e.message)}}
  return err.length?{ok:false,error:err.join(' | ')}:{ok:true}}
