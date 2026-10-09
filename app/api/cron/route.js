import {kv} from '../../../lib/db'
import {syncUser} from '../../../lib/sync'
export const maxDuration=60
export const dynamic='force-dynamic'
// Panggil tiap 1 menit: cron-job.org -> GET /api/cron?secret=CRON_SECRET (atau header Authorization: Bearer CRON_SECRET)
export async function GET(req){
 const s=process.env.CRON_SECRET,a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams.get('secret')
 if(!s||(a!=='Bearer '+s&&q!==s))return Response.json({error:'unauthorized'},{status:401})
 let n=0;for(const id of (await kv.get('idx'))||[]){const u=await kv.get('u:'+id);if(u&&u.tx.some(x=>x.status==='pending'))n+=await syncUser(u)}
 return Response.json({updated:n})}
