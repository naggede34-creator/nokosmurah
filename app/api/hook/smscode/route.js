// ===========================================================================
// Webhook SMSCode — kode OTP masuk SEKETIKA, tanpa menunggu sapuan cron.
// Dipasang dari admin > Integrasi > SMSCode (tombol "Pasang webhook"), yang
// mendaftarkan alamat ini ke SMSCode lalu menyimpan secret-nya.
//
// Dua lapis penjagaan:
//  1) Tanda tangan HMAC-SHA256 (header X-Webhook-Signature) diperiksa kalau
//     secret-nya sudah tersimpan. Tidak cocok = ditolak.
//  2) ISI BODY TIDAK PERNAH DIPERCAYA. Badan permintaan hanya dipakai sebagai
//     pemberitahuan "order sekian berubah"; status & kodenya selalu ditanyakan
//     ulang ke SMSCode lewat jalur biasa (syncOrder). Jadi webhook palsu paling
//     banter membuat satu pemeriksaan sia-sia, tidak bisa mengarang OTP.
// ===========================================================================
import crypto from 'crypto'
import {kv} from '../../../../lib/db'
import {save} from '../../../../lib/auth'
import {getSec} from '../../../../lib/settings'
import {syncOrder} from '../../../../lib/sync'

export const dynamic='force-dynamic'
export const maxDuration=30
const J=(o,s=200)=>Response.json(o,{status:s})

export const GET=()=>J({ok:true,service:'smscode-webhook'})

const cocok=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b))
 return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}

export async function POST(req){
 const raw=await req.text().catch(()=>'')
 let ev={};try{ev=raw?JSON.parse(raw):{}}catch(e){}
 const sec=await getSec().catch(()=>({}))
 const rahasia=sec.SMSCODE_HOOK_SECRET||''
 if(rahasia){
  const kirim=String(req.headers.get('x-webhook-signature')||'').replace(/^sha256=/,'')
  const punya=crypto.createHmac('sha256',rahasia).update(raw).digest('hex')
  if(!cocok(kirim,punya))return J({ok:false,error:'signature tidak cocok'},401)}
 // Pekerjaannya diselesaikan DULU, baru dibalas. SMSCode memutus setelah 3 detik dan tidak
 // pernah mengulang, tapi pekerjaan yang ditunda sesudah balasan bisa ikut dimatikan runtime —
 // jadi lebih aman membiarkan mereka mencatat timeout daripada kehilangan kode OTP-nya.
 try{await tangani(ev)}catch(e){}
 return J({ok:true})
}

async function tangani(ev){
 const d=(ev&&ev.data)||{}
 const id=String(d.order_id==null?'':d.order_id).slice(0,80)
 if(!id)return
 // satu order tidak diproses dua kali berbarengan (webhook + cron bisa bersamaan)
 if(!await kv.lock('scwh:'+id,15000))return
 try{
  const uid=await kv.get('o:'+id);if(!uid)return
  const u=await kv.get('u:'+uid);if(!u)return
  const o=(u.tx||[]).find(x=>x.type==='order'&&x.id===id)
  // ID order antar penyedia bisa mirip: pastikan ini memang order SMSCode
  if(!o||o.server!=='smscode_s1'||o.status!=='pending')return
  if(await syncOrder(u,o))await save(u)}
 finally{await kv.unlock('scwh:'+id)}
}
