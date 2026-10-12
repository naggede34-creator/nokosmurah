import {getBots} from '../../../../lib/tgpush'
import {handle} from '../../../../lib/tgbot'
export const dynamic='force-dynamic'
export const maxDuration=60
// Webhook Telegram per bot: POST /api/tg/<botId>. Dilindungi secret_token yang dibuat saat bot ditambahkan di admin.
export async function POST(req,{params}){
 const bot=(await getBots()).find(b=>String(b.id)===String(params.id))
 if(!bot||bot.on===false)return Response.json({ok:true})
 if(req.headers.get('x-telegram-bot-api-secret-token')!==bot.secret)return Response.json({error:'forbidden'},{status:403})
 const upd=await req.json().catch(()=>null)
 if(upd)await handle(bot,upd)
 return Response.json({ok:true})}
export const GET=()=>Response.json({ok:true,service:'artapedia-telegram-webhook'})
