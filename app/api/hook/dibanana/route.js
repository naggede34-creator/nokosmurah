// Webhook Dibanana (otp.received) — OTP masuk seketika tanpa menunggu sapuan cron.
// Alamat ini ditempel di dibanana.id > Profile > Webhook, lalu Webhook Secret-nya disalin ke
// admin > Integrasi > Dibanana (kolom "Webhook Secret").
// ISI BODY TIDAK DIPERCAYA: hanya dipakai sebagai pemicu, status & kode OTP ditanya ulang
// ke Dibanana lewat jalur biasa (syncOrder). Webhook palsu tidak bisa mengarang OTP.
import crypto from 'crypto'
import {kv} from '../../../../lib/db'
import {save} from '../../../../lib/auth'
import {getSec} from '../../../../lib/settings'
import {syncOrder} from '../../../../lib/sync'

export const dynamic='force-dynamic'
export const maxDuration=30
const J=(o,s=200)=>Response.json(o,{status:s})
export const GET=()=>J({ok:true,service:'dibanana-webhook'})
const cocok=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}

export async function POST(req){
 const raw=await req.text().catch(()=>'')
 let ev={};try{ev=raw?JSON.parse(raw):{}}catch(e){}
 const sec=await getSec().catch(()=>({}))
 const rahasia=sec.DIBANANA_HOOK_SECRET||''
 if(rahasia){
  const kirim=String(req.headers.get('x-banana-signature')||'')
  const punya='sha256='+crypto.createHmac('sha256',rahasia).update(raw).digest('hex')
  if(!cocok(kirim,punya))return J({ok:false,error:'signature tidak cocok'},401)}
 try{await tangani(ev)}catch(e){}
 return J({ok:true})}

async function tangani(ev){
 if(!ev||(ev.event&&ev.event!=='otp.received'))return
 // ID order di situs ini diberi awalan "dbn" supaya tidak bentrok dengan penyedia lain
 const raw=String(ev.order_id==null?'':ev.order_id).replace(/[^0-9]/g,'').slice(0,20)
 if(!raw)return
 const id='dbn'+raw
 if(!await kv.lock('dbnwh:'+id,15000))return
 try{
  const uid=await kv.get('o:'+id);if(!uid)return
  const u=await kv.get('u:'+uid);if(!u)return
  const o=(u.tx||[]).find(x=>x.type==='order'&&x.id===id)
  if(!o||!String(o.server).startsWith('dibanana_')||o.status!=='pending')return
  if(await syncOrder(u,o))await save(u)}
 finally{await kv.unlock('dbnwh:'+id)}}
