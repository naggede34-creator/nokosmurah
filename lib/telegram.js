import {kv} from './db'
// Sensor email: ar***n@gmail.com
export const mask=e=>{e=String(e||'');const [a,d]=e.split('@');if(!d)return a?a.slice(0,2)+'***':'***';return a.slice(0,Math.min(2,a.length))+'***'+(a.length>3?a.slice(-1):'')+'@'+d}
export const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const wib=()=>new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'
const LINE='━━━━━━━━━━━━━━━━'
// n = string ATAU {i:emoji, t:judul, rows:[[label,nilai],...], note:'teks'}
// Tombol link di bawah pesan diatur admin (dashboard admin -> Notifikasi), disimpan di cfg.buttons
export async function notify(n){
  const t=process.env.TELEGRAM_BOT_TOKEN,c=process.env.TELEGRAM_CHAT_ID
  if(!t||!c)return {ok:false,error:'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi'}
  if(typeof n==='string')n={i:'📢',t:n}
  let text=`<b>${n.i||'🔔'} ${esc(n.t)}</b>\n${LINE}\n`
  for(const [k,v] of n.rows||[])text+=`▫️ <b>${esc(k)}</b>  <code>${esc(v)}</code>\n`
  if(n.note)text+=`\n💬 <i>${esc(n.note)}</i>\n`
  text+=`${LINE}\n🕒 ${wib()}\n🌍 <b>Artapedia ID</b> · Nokos &amp; OTP otomatis`
  let btn=[];try{btn=((await kv.get('cfg'))||{}).buttons||[]}catch(e){}
  btn=btn.filter(b=>b&&b.text&&/^https?:\/\//.test(b.url||''))
  const rows=[];for(let i=0;i<btn.length;i+=2)rows.push(btn.slice(i,i+2).map(b=>({text:b.text,url:b.url})))
  try{const r=await fetch(`https://api.telegram.org/bot${t}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:c,text,parse_mode:'HTML',disable_web_page_preview:true,...(rows.length?{reply_markup:{inline_keyboard:rows}}:{})})});const d=await r.json();return {ok:!!d.ok,error:d.description}}
  catch(e){return {ok:false,error:e.message}}}

// Kirim file (backup) ke chat PRIBADI owner. BACKUP_CHAT_ID boleh lebih dari satu, pisahkan koma. Tidak pernah ke channel publik.
export async function sendFile(buf,name,caption){
  const t=process.env.TELEGRAM_BOT_TOKEN,ids=(process.env.BACKUP_CHAT_ID||'').split(',').map(x=>x.trim()).filter(Boolean)
  if(!t)return {ok:false,error:'TELEGRAM_BOT_TOKEN belum diisi'}
  if(!ids.length)return {ok:false,error:'BACKUP_CHAT_ID belum diisi (isi dengan chat ID Telegram pribadi owner)'}
  const err=[]
  for(const id of ids){
    try{const f=new FormData();f.append('chat_id',id);f.append('caption',String(caption||'').slice(0,1000));f.append('document',new Blob([buf],{type:'application/gzip'}),name)
      const r=await fetch(`https://api.telegram.org/bot${t}/sendDocument`,{method:'POST',body:f}),d=await r.json().catch(()=>({}))
      if(!d.ok)err.push(id+': '+(d.description||('HTTP '+r.status)))}catch(e){err.push(id+': '+e.message)}}
  return err.length?{ok:false,error:err.join(' | ')}:{ok:true}}
