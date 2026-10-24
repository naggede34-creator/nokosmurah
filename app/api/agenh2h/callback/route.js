// ===========================================================================
// Webhook AgenH2H: POST /api/agenh2h/callback  (event transaction.updated / webhook.test)
// Keamanan: header X-PanelH2H-Key harus = AGEN_KEY, dan X-PanelH2H-Signature = HMAC-SHA256(AGEN_SECRET, timestamp + "\n" + RAW_BODY),
// timestamp maksimal selisih 5 menit. Yang gagal diverifikasi ditolak 401 dan TIDAK mengubah apa pun.
// ref_id transaksi = idtrx penarikan kita (kunci h2hid:<idtrx>). Idempoten: laporan ulang tidak menggandakan apa pun.
//  - success/completed -> penarikan sukses; failed/cancelled -> ditolak + saldo dikembalikan; partial/lainnya -> hanya dicatat.
//  - laporan yang bertentangan dengan status final kita TIDAK mengubah apa pun, tapi dikabarkan ke channel admin.
// Balasan 200 {success:true} untuk webhook sah (juga yang tidak cocok dengan penarikan kita) supaya AgenH2H tidak mengulang terus.
// ===========================================================================
import crypto from 'crypto'
import {kv} from '../../../../lib/db'
import {getSec} from '../../../../lib/settings'
import {sign,dataState} from '../../../../lib/h2h'
import {applyH2hReport} from '../../../../lib/paygw'
import {notify,rp} from '../../../../lib/telegram'

export const dynamic='force-dynamic'
export const maxDuration=30
const cocok=(a,b)=>{try{const x=Buffer.from(String(a)),y=Buffer.from(String(b))
 return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch(e){return false}}
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})

export async function POST(req){
 const sec=await getSec().catch(()=>({}))
 if(!sec.AGEN_KEY||!sec.AGEN_SECRET)return J({success:false,message:'belum dikonfigurasi'},401)
 const raw=await req.text().catch(()=>''),h=n=>req.headers.get(n)||''
 const ts=h('x-panelh2h-timestamp'),sg=h('x-panelh2h-signature').toLowerCase()
 if(!/^\d{9,12}$/.test(ts)||Math.abs(Date.now()/1000-(+ts))>300)return J({success:false,message:'timestamp invalid'},401)
 if(!cocok(h('x-panelh2h-key'),sec.AGEN_KEY))return J({success:false,message:'key invalid'},401)
 const exp=crypto.createHmac('sha256',sec.AGEN_SECRET).update(ts+'\n'+raw).digest('hex')
 if(!cocok(exp,sg))return J({success:false,message:'signature invalid'},401)
 let p;try{p=JSON.parse(raw)}catch(e){return J({success:false,message:'invalid json'},400)}
 if(!p||typeof p!=='object')return J({success:false,message:'invalid json'},400)
 if(p.event==='webhook.test')return J({success:true})
 try{
  const d=p.data||{},ref=String(d.ref_id||'').slice(0,80),k=dataState(d)
  let out={matched:false}
  if(ref&&await kv.get('h2hid:'+ref))out=await applyH2hReport(ref,k)
  const log=(await kv.get('h2hlog'))||[]
  log.unshift({at:Date.now(),m:'POST',matched:!!out.matched,state:k.state,applied:!!out.applied,conflict:!!out.conflict,
   raw:JSON.stringify({event:p.event,ref_id:ref,status:d.status,message:String(d.message||'').slice(0,120)}).slice(0,400)})
  await kv.set('h2hlog',log.slice(0,20))
  if(out.conflict&&out.w){
   const w=out.w
   await notify({i:'⚠️',t:'Laporan H2H bertentangan',st:'fail',id:['ID Penarikan',w.id],
    rows:[['Status kita',w.status==='success'?'Sukses':'Ditolak (saldo dikembalikan)'],['Laporan provider',k.state==='success'?'BERHASIL':'GAGAL'],['Nominal',rp(w.nominal)],['Tujuan','DANA '+String(w.dest||'').slice(0,4)+'•••'+String(w.dest||'').slice(-3)]],
    note:'Tidak ada yang diubah otomatis. Cek riwayat transaksi di dashboard AgenH2H lalu sesuaikan manual (mis. tambah saldo merchant kalau DANA sebenarnya sudah terkirim).'}).catch(()=>{})}
  return J({success:true})
 }catch(e){return J({success:false,message:'error'},500)}}
