// ===========================================================================
// Report URL H2H SMP (Solusi Media Pulsa, tipe IRS): GET/POST /api/h2hreport/<SMP_H2H_SECRET>
// Provider mengirim laporan status akhir transaksi penarikan instan. Bentuk laporannya tidak ada di dokumentasi,
// jadi penerima ini TOLERAN (query string / JSON / form / teks biasa) dan hati-hati:
//  - idtrx dicocokkan ke catatan milik kita (kunci h2hid:<idtrx>); laporan transaksi lain dicatat saja, tidak diapa-apakan.
//  - hanya laporan JELAS berhasil/gagal yang mengubah status; sisanya cuma dicatat di "Laporan H2H terbaru" (admin > Gateway).
//  - laporan yang bertentangan dengan status yang sudah final TIDAK mengubah apa pun, tapi dikabarkan ke channel admin.
// Key di URL dibandingkan timing-safe. Balasan selalu "OK" (200) untuk laporan yang sah supaya provider tidak mengirim ulang terus.
// ===========================================================================
import crypto from 'crypto'
import {kv} from '../../../../lib/db'
import {getSec} from '../../../../lib/settings'
import {parseReport,klasifikasi} from '../../../../lib/h2h'
import {applyH2hReport} from '../../../../lib/paygw'
import {notify,rp} from '../../../../lib/telegram'

export const dynamic='force-dynamic'
export const maxDuration=30
const cocok=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b))
 return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}
const txt=(s,st=200)=>new Response(s,{status:st,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}})

async function handle(req,{params}){
 const sec=await getSec().catch(()=>({}))
 let key='';try{key=decodeURIComponent(params.key||'')}catch(e){}
 if(!sec.SMP_H2H_SECRET||!cocok(key,sec.SMP_H2H_SECRET))return txt('unauthorized',401)
 try{
  const body=req.method==='POST'?await req.text().catch(()=>''):''
  const rp0=parseReport(new URL(req.url).searchParams,body)
  const k=klasifikasi(rp0.statusText)
  let idtrx='',out={matched:false}
  for(const c of rp0.idc){if(await kv.get('h2hid:'+c)){idtrx=c;out=await applyH2hReport(c,{...k,sn:k.sn||rp0.sn});break}}
  // catatan untuk admin: 20 laporan terakhir (supaya format asli provider kelihatan)
  const log=(await kv.get('h2hlog'))||[]
  log.unshift({at:Date.now(),m:req.method,matched:!!out.matched,state:k.state,applied:!!out.applied,conflict:!!out.conflict,raw:rp0.raw})
  await kv.set('h2hlog',log.slice(0,20))
  if(out.conflict&&out.w){
   const w=out.w
   await notify({i:'⚠️',t:'Laporan H2H bertentangan',st:'fail',id:['ID Penarikan',w.id],
    rows:[['Status kita',w.status==='success'?'Sukses':'Ditolak (saldo dikembalikan)'],['Laporan provider',k.state==='success'?'BERHASIL':'GAGAL'],['Nominal',rp(w.nominal)],['Tujuan','DANA '+String(w.dest||'').slice(0,4)+'•••'+String(w.dest||'').slice(-3)]],
    note:'Tidak ada yang diubah otomatis. Cek riwayat transaksi di panel provider lalu sesuaikan manual (mis. tambah saldo merchant kalau DANA sebenarnya sudah terkirim).'}).catch(()=>{})}
  return txt('OK')
 }catch(e){return txt('error',500)}}
export const GET=handle,POST=handle
