// Gambar banner bot, dilayani lewat alamat situs sendiri.
// Dipakai pesan kaya (sendRichMessage) yang hanya bisa menampilkan gambar lewat TAUTAN,
// sedangkan banner hasil unggahan admin/pemilik toko tersimpan sebagai file_id Telegram.
// Token bot TIDAK pernah ikut di tautan: berkasnya diambil di server lalu diteruskan.
import {kv} from '../../../../lib/db'
import {getBots,tg} from '../../../../lib/tgpush'
export const dynamic='force-dynamic'
export async function GET(req,{params}){
 const id=String((params||{}).id||'')
 const bot=(await getBots()).find(b=>String(b.id)===id)
 if(!bot)return new Response('bot tidak ditemukan',{status:404})
 const bn=await kv.get('tgbn:'+id)
 const site=(bot.site||'').replace(/\/+$/,'')
 // belum ada banner kustom → pakai banner bawaan situs
 if(!bn||!bn.f)return Response.redirect((site||'')+'/bot-banner.jpg',302)
 if(/^https?:\/\//.test(String(bn.f)))return Response.redirect(String(bn.f),302)
 try{
  const g=await tg(bot.token,'getFile',{file_id:bn.f})
  const path=g&&g.ok&&g.result&&g.result.file_path
  if(!path)return Response.redirect((site||'')+'/bot-banner.jpg',302)
  const api=(process.env.TG_API||'https://api.telegram.org').replace(/\/+$/,'')
  const r=await fetch(`${api}/file/bot${bot.token}/${path}`,{cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!r.ok)return Response.redirect((site||'')+'/bot-banner.jpg',302)
  const buf=Buffer.from(await r.arrayBuffer())
  const ext=String(path).split('.').pop().toLowerCase()
  const type=ext==='png'?'image/png':ext==='webp'?'image/webp':ext==='mp4'?'video/mp4':ext==='gif'?'image/gif':'image/jpeg'
  return new Response(buf,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=900','Content-Length':String(buf.length)}})}
 catch(e){return Response.redirect((site||'')+'/bot-banner.jpg',302)}}
