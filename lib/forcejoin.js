// ===========================================================================
// FORCE JOIN: pengguna bot wajib join channel/grup dulu sebelum bisa memakai bot.
//  - Bot utama: pengaturan global di cfg.fj (diatur admin bot lewat Panel Admin > Force Join).
//  - Bot reseller: pengaturan per toko di data reseller (a.fj), diatur pemilik toko lewat Panel Toko > Force Join.
//  - Pengecekan lewat getChatMember: bot WAJIB jadi admin di channel/grup tujuan.
//  - Aman: kalau pengecekan gagal (bot bukan admin, channel dihapus, Telegram error) pengguna TIDAK dikunci,
//    supaya salah setel tidak mematikan seluruh bot. Admin/pemilik toko selalu bebas.
// ===========================================================================
import {tg} from './tgpush'

export const FJ_MAX=5
export const fjNorm=f=>({on:!!(f&&f.on),
 chats:(Array.isArray(f&&f.chats)?f.chats:[]).filter(x=>x&&x.id).slice(0,FJ_MAX).map(x=>({id:String(x.id),title:String(x.title||'').slice(0,60),user:String(x.user||'').replace(/^@/,'').slice(0,40),link:String(x.link||'').slice(0,200)}))})

// @nama · nama · t.me/nama · https://t.me/nama · -1001234567890. Tautan undangan privat (t.me/+xxx) tidak bisa dibaca.
export function fjParse(text){
 let t=String(text||'').trim()
 if(/t\.me\/(\+|joinchat)/i.test(t))return {error:'Tautan undangan privat tidak bisa dipakai. Kirim @username channel, atau ID angkanya (mis. -1001234567890).'}
 t=t.replace(/^https?:\/\//i,'').replace(/^t\.me\//i,'').replace(/^@/,'').split(/[/?\s]/)[0]
 if(/^-?\d{6,}$/.test(t))return {chat:t.startsWith('-')?t:'-100'+t}
 if(/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(t))return {chat:'@'+t}
 return {error:'Format tidak dikenali. Kirim @username channel atau ID angkanya.'}}

// Cek channel + pastikan bot adalah admin di sana. Mengembalikan {ok,chat:{id,title,user,link}} atau {ok:false,error}.
export async function fjResolve(token,input){
 const p=fjParse(input);if(p.error)return {ok:false,error:p.error}
 const r=await tg(token,'getChat',{chat_id:p.chat})
 if(!r.ok)return {ok:false,error:'Channel tidak ditemukan. Pastikan username/ID benar dan bot sudah ditambahkan sebagai admin di sana.'}
 const ch=r.result||{}
 if(!['channel','supergroup','group'].includes(ch.type))return {ok:false,error:'Itu bukan channel atau grup.'}
 const me=await tg(token,'getChatMember',{chat_id:ch.id,user_id:+String(token).split(':')[0]})
 if(!me.ok||!['administrator','creator'].includes((me.result||{}).status))return {ok:false,error:'Bot belum jadi <b>admin</b> di '+(ch.title||'channel itu')+'. Jadikan bot admin dulu, lalu kirim lagi.'}
 let link=ch.username?'https://t.me/'+ch.username:String(ch.invite_link||'')
 if(!link){const e=await tg(token,'exportChatInviteLink',{chat_id:ch.id});if(e.ok&&e.result)link=String(e.result)}
 if(!link)return {ok:false,error:'Channel privat ini butuh tautan undangan. Beri bot izin <b>Undang pengguna lewat tautan</b>, lalu kirim lagi.'}
 return {ok:true,chat:{id:String(ch.id),title:String(ch.title||ch.username||ch.id).slice(0,60),user:String(ch.username||''),link}}}

// Cache hasil "sudah join" 90 detik per bot+pengguna+channel supaya tidak memanggil Telegram di setiap pesan.
const memJoin=()=>globalThis.__fjm||(globalThis.__fjm=new Map())
const OK_ST=['creator','administrator','member']
// Mengembalikan daftar channel yang BELUM di-join pengguna. Pengecekan yang gagal dianggap sudah join (fail-open).
export async function fjMissing(token,chats,userId){
 const m=memJoin(),now=Date.now()
 if(m.size>5000)m.clear()
 const res=await Promise.all(chats.map(async ch=>{
  const k=token.split(':')[0]+':'+userId+':'+ch.id,c=m.get(k)
  if(c&&now-c<90000)return null
  const r=await tg(token,'getChatMember',{chat_id:ch.id,user_id:+userId},8000)
  if(!r.ok)return null
  const s=r.result||{}
  const joined=OK_ST.includes(s.status)||(s.status==='restricted'&&s.is_member!==false)
  if(joined){m.set(k,now);return null}
  return ch}))
 return res.filter(Boolean)}
export const fjForget=(token,userId)=>{const m=memJoin(),p=token.split(':')[0]+':'+userId+':';for(const k of [...m.keys()])if(k.startsWith(p))m.delete(k)}
