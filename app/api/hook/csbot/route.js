// Webhook bot Telegram Customer Service. Dipasang dari admin > Integrasi > Bot Customer Service.
// Dilindungi secret_token (header x-telegram-bot-api-secret-token) yang dibuat saat webhook dipasang.
import crypto from 'crypto'
import {getSec} from '../../../../lib/settings'
import {csbotHandle} from '../../../../lib/csbot'

export const dynamic='force-dynamic'
export const maxDuration=30
const J=(o,s=200)=>Response.json(o,{status:s})
export const GET=()=>J({ok:true,service:'cs-bot-webhook'})
const cocok=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}

export async function POST(req){
 const sec=await getSec().catch(()=>({}))
 const rahasia=sec.CSBOT_HOOK_SECRET||''
 if(!rahasia||!cocok(req.headers.get('x-telegram-bot-api-secret-token')||'',rahasia))return J({error:'forbidden'},403)
 const upd=await req.json().catch(()=>null)
 // diselesaikan dulu baru dibalas, supaya balasan ke pengguna tidak hilang saat fungsi dihentikan
 if(upd){try{await csbotHandle(upd)}catch(e){}}
 return J({ok:true})}
