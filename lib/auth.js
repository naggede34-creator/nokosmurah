import crypto from 'crypto'
import net from 'net'
import {kv} from './db'
export const rid=()=>crypto.randomBytes(16).toString('hex')
export const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex')
export const check=(p,h)=>hash(p,h.split(':')[0])===h
export const save=u=>kv.set('u:'+u.id,u)
// IP klien: Vercel mengisi header ini sendiri (tidak bisa dipalsukan klien). Di hosting lain pastikan proxy-mu menimpa x-forwarded-for.
export const normIp=x=>{x=String(x||'').trim().toLowerCase();const m=x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);return m?m[1]:x}
export const clientIp=req=>normIp(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-real-ip')||(req.headers.get('x-forwarded-for')||'').split(',')[0]||'')
export const validIp=x=>net.isIP(normIp(x))>0
export async function who(req){
 const a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams
 const key=a.startsWith('Bearer ')?a.slice(7):q.get('api_key')
 let id=key&&await kv.get('k:'+key),ses=0
 if(!id){const c=(req.headers.get('cookie')||'').match(/sid=([a-f0-9]+)/);const v=c&&await kv.get('s:'+c[1]);if(v){const [i,ts]=String(v).split('|');id=i;ses=+ts||0}}
 if(!id)return null
 const u=await kv.get('u:'+id)
 // sesi yang dibuat sebelum password direset otomatis tidak berlaku lagi
 if(u&&!key&&u.pwAt&&ses<u.pwAt)return null
 if(u&&key&&id){req.__key=true
  // whitelist IP: kalau diisi, API key hanya berlaku dari IP yang terdaftar (login lewat browser tidak terpengaruh)
  const w=Array.isArray(u.ipw)?u.ipw:[];if(w.length){const ip=clientIp(req);if(!w.includes(ip)){req.__ipBlock=ip||'tidak terdeteksi';return null}}}
 return u||null}
