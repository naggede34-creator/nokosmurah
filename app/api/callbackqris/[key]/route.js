// ===========================================================================
// Callback SMP Payment (H2H QRIS): POST /api/callbackqris/<SMP_SECRET>
// Format & kode balasan mengikuti dokumentasi SMP Payment.
//
// Penjagaan:
//  1) Key di URL harus sama dengan SMP_SECRET (dibandingkan timing-safe), kalau tidak 401.
//  2) us_username dicek terhadap SMP_USERNAME (kalau diisi), kalau tidak 401 "Username invalid".
//  3) rrn adalah referensi unik: rrn yang sudah diproses dibalas "RRN already processed"
//     dan TIDAK PERNAH mengkreditkan saldo dua kali.
//  4) Pembayaran dicocokkan lewat total (nominal + kode unik). Yang tidak cocok dengan
//     tagihan mana pun dicatat di daftar 'smp:orphan' dan dikabarkan ke channel admin,
//     lalu tetap dibalas sukses supaya SMP tidak mengirim ulang tanpa henti.
// ===========================================================================
import crypto from 'crypto'
import {kv} from '../../../../lib/db'
import {getSec} from '../../../../lib/settings'
import {smpFind,PAID,RRN,ORPHAN} from '../../../../lib/smp'
import {recheckDep} from '../../../../lib/deposit'
import {notify,mask,rp} from '../../../../lib/telegram'

export const dynamic='force-dynamic'
export const maxDuration=30
const J=(o,s=200)=>Response.json(o,{status:s})
const OK={responseCode:'2005200',responseMessage:'Request has been processed successfully'}
const DUP={responseCode:'2005201',responseMessage:'RRN already processed'}
const BADUSER={responseCode:'4015200',responseMessage:'Username invalid'}

const cocok=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b))
 return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}

export const GET=()=>J({ok:true,service:'smp-payment-callback'})

export async function POST(req,{params}){
 const sec=await getSec().catch(()=>({}))
 let key='';try{key=decodeURIComponent(params.key||'')}catch(e){}
 if(!sec.SMP_SECRET||!cocok(key,sec.SMP_SECRET))return J({responseCode:'4015200',responseMessage:'Unauthorized'},401)
 const b=await req.json().catch(()=>null)
 if(!b||typeof b!=='object')return J({responseCode:'4005200',responseMessage:'Invalid payload'},400)
 // username harus sama dengan akun SMP milik kita (kalau sudah diisi di Integrasi)
 if(sec.SMP_USERNAME&&String(b.us_username||'')!==sec.SMP_USERNAME)return J(BADUSER,401)
 const rrn=String(b.rrn||b.tr_id||'').slice(0,80)
 const nominal=Math.round(parseFloat(String((b.amount&&b.amount.value)??b.amount??'').replace(',','.')))
 if(!rrn||!(nominal>0))return J({responseCode:'4005200',responseMessage:'Invalid payload'},400)
 if(await kv.get(RRN(rrn)))return J(DUP)
 // satu rrn tidak diproses dua kali berbarengan (SMP bisa mengirim ulang cepat)
 if(!await kv.lock('smp:rrnl:'+rrn,30000))return J(DUP)
 try{
  if(await kv.get(RRN(rrn)))return J(DUP)
  const info={rrn,nominal,issuer:String(b.issuer||''),payer:String(b.PayerName||'').slice(0,40),at:Date.now(),waktu:String(b.timestamp||'')}
  const m=await smpFind(nominal)
  const uid=m&&await kv.get('d:'+m.id)
  const u=uid&&await kv.get('u:'+uid)
  const o=u&&(u.tx||[]).find(x=>x.type==='deposit'&&x.id===m.id&&x.gw==='smp')
  if(!o||o.total!==nominal){
   // tidak ada tagihan yang cocok: catat untuk dicek admin, jangan kredit apa pun
   const l=(await kv.get(ORPHAN))||[];l.unshift(info);await kv.set(ORPHAN,l.slice(0,100))
   await kv.set(RRN(rrn),{orphan:1,at:info.at})
   notify({i:'⚠️',t:'Pembayaran SMP tanpa tagihan',st:'warn',rows:[['Nominal',rp(nominal)],['Penerbit',info.issuer||'-'],['Pembayar',info.payer||'-'],['RRN',rrn],['Waktu',info.waktu||'-']],
    note:'Tidak ada deposit SMP yang cocok (mungkin sudah dibatalkan atau kedaluwarsa). Cek manual lalu kreditkan lewat admin.'}).catch(()=>{})
   return J(OK)}
  // tandai LUNAS dulu, baru kredit lewat jalur yang sama dengan gateway lain
  await kv.set(PAID(o.id),info)
  let hasil={status:o.status}
  try{hasil=await recheckDep(u,o)}catch(e){}
  await kv.set(RRN(rrn),{id:o.id,at:info.at})
  if(o.status!=='completed')
   notify({i:'⚠️',t:'Deposit SMP sudah dibayar tapi belum masuk saldo',st:'warn',id:['ID Deposit',o.id],rows:[['Pengguna',mask(u.email)],['Nominal',rp(nominal)],['Status',String(hasil.status||o.status)],['RRN',rrn]],
    note:'Penanda lunas sudah disimpan. Pakai tombol "Periksa & kreditkan sekarang" di admin › Deposit.'}).catch(()=>{})
  return J(OK)}
 catch(e){
  // gagal di tengah jalan: balas 500 supaya SMP mengirim ulang (rrn belum ditandai selesai)
  return J({responseCode:'5005200',responseMessage:'Internal error'},500)}
 finally{await kv.unlock('smp:rrnl:'+rrn)}}
