// Pesan suara (VN) untuk chat Customer Service. Audio disimpan terpisah ('csa:<id>') supaya daftar pesan tetap ringan;
// pesan hanya membawa {id,dur}. Hanya pemilik chat (dan admin) yang bisa memutar.
import {kv} from './db'
import {rid} from './auth'
export const AUD_MAX=600*1024, DUR_MAX=90
const MIME=/^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|m4a|wav|x-wav)(;.*)?$/i
export class AudError extends Error{}
export async function audSave(uid,{b64,mime,dur}){
 b64=String(b64||'');mime=String(mime||'')
 if(!b64||!MIME.test(mime))throw new AudError('Format pesan suara tidak didukung')
 if(!/^[A-Za-z0-9+/=]+$/.test(b64))throw new AudError('Data suara tidak valid')
 if(Math.floor(b64.length*3/4)>AUD_MAX)throw new AudError('Pesan suara terlalu besar (maks ~600 KB / 90 detik)')
 const d=Math.min(DUR_MAX,Math.max(1,Math.round(+dur||0)))
 const id=rid().slice(0,12),base=mime.split(';')[0].toLowerCase()
 await kv.set('csa:'+id,{uid:String(uid),mime:base,b64})
 return {id,dur:d,mime:base}}
export const audGet=async id=>{const f=await kv.get('csa:'+String(id));return f&&{uid:f.uid,mime:f.mime,b64:f.b64,buf:Buffer.from(f.b64,'base64')}}
export const audDel=id=>kv.del('csa:'+String(id)).catch(()=>{})
