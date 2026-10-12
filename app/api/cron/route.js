import {kv} from '../../../lib/db'
import {syncUser} from '../../../lib/sync'
import {payWeekly,payMonthly} from '../../../lib/bonus'
import {autoBackup} from '../../../lib/backup'
import {tgTick} from '../../../lib/tgbot'
export const maxDuration=60
export const dynamic='force-dynamic'
// Panggil tiap 1 menit: cron-job.org -> GET /api/cron?secret=CRON_SECRET (atau header Authorization: Bearer CRON_SECRET)
// Selain sinkron order/deposit, cron ini juga: bagikan hadiah leaderboard mingguan (tiap Senin 00:00 WIB & bulanan tiap tanggal 1 00:00 WIB) & backup otomatis ke Telegram owner.
export async function GET(req){
 const s=process.env.CRON_SECRET,a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams.get('secret')
 if(!s||(a!=='Bearer '+s&&q!==s))return Response.json({error:'unauthorized'},{status:401})
 // backup dijalankan PALING DULU supaya tidak kehabisan waktu (60 dtk) gara-gara sinkron banyak order
 let bk=null;try{bk=await autoBackup()}catch(e){bk={error:e.message}}
 let bc=null;try{bc=await tgTick()}catch(e){bc={error:e.message}}
 let n=0;for(const id of (await kv.get('idx'))||[]){const u=await kv.get('u:'+id);if(u&&u.tx.some(x=>x.status==='pending'))n+=await syncUser(u)}
 let wk=null,mo=null
 try{wk=await payWeekly()}catch(e){wk={error:e.message}}
 try{mo=await payMonthly()}catch(e){mo={error:e.message}}
 return Response.json({updated:n,weekly:wk?(wk.error||'dibagikan'):null,monthly:mo?(mo.error||'dibagikan'):null,backup:bk?(bk.ok?'terkirim':bk.error):null,broadcast:bc?(bc.error||(bc.done?'selesai':bc.i+'/'+bc.ids.length)):null})}
