import crypto from 'crypto'
import {kv} from './db'
export const rid=()=>crypto.randomBytes(16).toString('hex')
export const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex')
export const check=(p,h)=>hash(p,h.split(':')[0])===h
export const save=u=>kv.set('u:'+u.id,u)
export async function who(req){
 const a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams
 const key=a.startsWith('Bearer ')?a.slice(7):q.get('api_key')
 let id=key&&await kv.get('k:'+key),ses=0
 if(!id){const c=(req.headers.get('cookie')||'').match(/sid=([a-f0-9]+)/);const v=c&&await kv.get('s:'+c[1]);if(v){const [i,ts]=String(v).split('|');id=i;ses=+ts||0}}
 if(!id)return null
 const u=await kv.get('u:'+id)
 // sesi yang dibuat sebelum password direset otomatis tidak berlaku lagi
 if(u&&!key&&u.pwAt&&ses<u.pwAt)return null
 return u||null}
