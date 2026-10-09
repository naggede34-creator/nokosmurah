import crypto from 'crypto'
import {kv} from './db'
export const rid=()=>crypto.randomBytes(16).toString('hex')
export const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex')
export const check=(p,h)=>hash(p,h.split(':')[0])===h
export const save=u=>kv.set('u:'+u.id,u)
export async function who(req){
 const a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams
 const key=a.startsWith('Bearer ')?a.slice(7):q.get('api_key')
 let id=key&&await kv.get('k:'+key)
 if(!id){const c=(req.headers.get('cookie')||'').match(/sid=([a-f0-9]+)/);id=c&&await kv.get('s:'+c[1])}
 return id?kv.get('u:'+id):null}
