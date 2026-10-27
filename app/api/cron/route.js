import {kv} from '../../../lib/db'
import {save} from '../../../lib/auth'
import {syncUser} from '../../../lib/sync'
import {depCheck,applyDep,depPendList,depPendRm,depPendAdd,depLateList,depLateRm,recheckDep} from '../../../lib/deposit'
import {payWeekly,payMonthly} from '../../../lib/bonus'
import {autoBackup} from '../../../lib/backup'
import {tgTick} from '../../../lib/tgbot'
import {autoTick} from '../../../lib/autoclean'
import {bcaTick} from '../../../lib/bcall'
import {sweepWd as rsSweepWd} from '../../../lib/reseller'
import * as PAY from '../../../lib/paygw'
import * as AGW from '../../../lib/agw'
import {getCfg} from '../../../lib/bonus'
import * as SMM from '../../../lib/smm'
import * as DM from '../../../lib/dailymsg'
export const maxDuration=60
export const dynamic='force-dynamic'
// Panggil tiap 1 menit: cron-job.org -> GET /api/cron?secret=CRON_SECRET (atau header Authorization: Bearer CRON_SECRET)
// Selain sinkron order/deposit, cron ini juga: bagikan hadiah leaderboard mingguan (tiap Senin 00:00 WIB & bulanan tiap tanggal 1 00:00 WIB) & backup otomatis ke Telegram owner.

// Sapu deposit yang belum selesai LANGSUNG dari daftar 'dpend' (tidak memindai seluruh pengguna).
// Dulu deposit ikut sinkron per-pengguna, jadi kalau pengguna sudah banyak, cron kehabisan waktu 60 detik
// dan deposit pengguna di urutan belakang tidak pernah dicek -> saldo "kadang masuk kadang tidak".
// Sekali jalan: masukkan deposit lama (yang dibuat sebelum daftar ini ada) ke 'dpend'.
async function backfill(){
 if(await kv.get('dpend:init'))return 0
 let n=0,after=''
 for(;;){const r=await kv.scanPrefix('u:',after,200)
  for(const {v:u} of r.items)for(const x of (u&&u.tx)||[])if(x.type==='deposit'&&x.status==='pending'){await depPendAdd(x.id,u.id);n++}
  after=r.last;if(r.done)break}
 await kv.set('dpend:init',Date.now());return n}
// Sapu QRIS gateway yang belum dibayar (penarikan dana diproses manual oleh admin, tidak disapu).
async function sweepPay(deadline){
 let cfg=null;try{cfg=await getCfg()}catch(e){return {error:e.message}}
 if(!PAY.payCfg(cfg).on)return {off:true}
 const list=((await kv.get('paypend'))||[]).map(e=>{const [ref,uid]=String(e).split('|');return {ref,uid}}).filter(x=>x.ref&&x.uid)
 let settled=0
 for(let i=0;i<list.length&&Date.now()<deadline;i+=6){
  await Promise.all(list.slice(i,i+6).map(async ({ref,uid})=>{
   try{const acc=await PAY.peek(uid);const r=acc&&(acc.dep||[]).find(x=>x.ref===ref)
    if(!r){await kv.srem('paypend',ref+'|'+uid);return}
    if(r.status!=='pending'){await kv.srem('paypend',ref+'|'+uid);return}
    const out=await PAY.checkQris(cfg,uid,r.id)
    if(out&&out.status!=='pending')settled++}catch(e){}}))}
 return {checked:list.length,settled}
}
async function sweepInstant(deadline){try{return await PAY.sweepInstant(deadline)}catch(e){return {error:e.message}}}
async function sweepDeposits(deadline){
 const list=await depPendList();let done=0,still=0
 // dicek paralel per rombongan 8 supaya cepat, bukan satu-satu
 for(let i=0;i<list.length&&Date.now()<deadline;i+=8){
  await Promise.all(list.slice(i,i+8).map(async ({id,uid})=>{
   try{
    const u=await kv.get('u:'+uid)
    const o=u&&(u.tx||[]).find(x=>x.type==='deposit'&&x.id===id)
    if(!o||o.status!=='pending'){await depPendRm(id);return}
    if(await applyDep(u,o,await depCheck(o))){await save(u);done++}else still++
   }catch(e){still++}}))}
 // Sapuan SUSULAN: deposit yang sudah dicap kedaluwarsa/gagal tetap ditanya ulang selama 24 jam,
 // supaya pembayaran yang masuk telat tidak hilang begitu saja.
 let late=0,lateOk=0
 try{
  const ls=await depLateList()
  for(const {id,uid,at} of ls){
   if(Date.now()>deadline)break
   if(Date.now()-at>24*36e5){await depLateRm(id);continue}
   late++
   try{const u=await kv.get('u:'+uid)
    const o=u&&(u.tx||[]).find(x=>x.type==='deposit'&&x.id===id)
    if(!o||o.status==='completed'||o.status==='canceled'){await depLateRm(id);continue}
    const r=await recheckDep(u,o)
    if(r.changed){await save(u);lateOk++;await depLateRm(id)}}catch(e){}}
 }catch(e){}
 return {checked:list.length,settled:done,pending:still,susulan:late,susulanMasuk:lateOk}
}
export async function GET(req){
 const s=process.env.CRON_SECRET,a=req.headers.get('authorization')||'',q=new URL(req.url).searchParams.get('secret')
 if(!s||(a!=='Bearer '+s&&q!==s))return Response.json({error:'unauthorized'},{status:401})
 const t0=Date.now()
 // DEPOSIT PALING DULU: saldo pengguna tidak boleh tertunda gara-gara pekerjaan lain kehabisan waktu
 let dep=null;try{await backfill();dep=await sweepDeposits(t0+25000)}catch(e){dep={error:e.message}}
 let pay=null;try{pay=await sweepPay(t0+40000)}catch(e){pay={error:e.message}}
 // Suntik Sosmed: status order (proses/sukses/batal/sebagian) + refill ditanyakan ke penyedia dalam satu rombongan, lalu notifikasi + struk dikirim
 let smm=null;try{smm=await SMM.sync(t0+42000)}catch(e){smm={error:e.message}}
 let inst=null;try{inst=await sweepInstant(t0+45000)}catch(e){inst={error:e.message}}
 // Gateway SMP (khusus admin): tagihan kedaluwarsa + ulang webhook yang gagal
 let agw=null;try{agw=await AGW.sweep(t0+43000)}catch(e){agw={error:e.message}}
 // maintenance otomatis harian (12:00 & 03:00 WIB, 3 menit) + pembersihan sampah. Tidak mengganggu deposit: deposit sudah disapu paling dulu.
 let au=null;try{au=await autoTick(t0+34000)}catch(e){au={error:e.message}}
 let dm=null;try{dm=await DM.tick()}catch(e){dm={error:e.message}}   // pesan otomatis pagi/siang/magrib/malam
 let bk=null;try{bk=await autoBackup()}catch(e){bk={error:e.message}}
 let bc=null;try{bc=await tgTick()}catch(e){bc={error:e.message}}
 // broadcast admin ke SEMUA bot (utama, reseller tanpa modal, reseller mandiri, bot tambahan) dilanjutkan di sini
 let bca=null;try{bca=await bcaTick(Math.max(4000,Math.min(30000,t0+48000-Date.now())))}catch(e){bca={error:e.message}}
 // sinkron order yang masih menunggu OTP, dengan batas waktu supaya sisa pekerjaan di bawah tetap jalan
 let n=0,skipped=0;const cur=(await kv.get('tmp:cron:cur'))||''
 const ids=(await kv.get('idx'))||[],st=Math.max(0,ids.indexOf(cur)+1)
 const order=[...ids.slice(st),...ids.slice(0,st)]   // lanjut dari posisi terakhir: tidak ada pengguna yang terus terlewat
 let last=cur
 for(const id of order){
  if(Date.now()>t0+50000){skipped=order.length-order.indexOf(id);break}
  const u=await kv.get('u:'+id);last=id
  if(u&&(u.tx||[]).some(x=>x.status==='pending'&&x.type!=='deposit'&&x.type!=='smm'))n+=await syncUser(u)}
 await kv.set('tmp:cron:cur',skipped?last:'')
 // penarikan reseller yang masih diproses ikut disegarkan walau pemiliknya tidak membuka halaman
 let rswd=0;try{rswd=await rsSweepWd(20)}catch(e){}
 let wk=null,mo=null
 try{wk=await payWeekly()}catch(e){wk={error:e.message}}
 try{mo=await payMonthly()}catch(e){mo={error:e.message}}
 return Response.json({deposits:dep,gateway:pay,smm,dm,instant:inst,gatewaySmp:agw,resellerWd:rswd,updated:n,skipped,weekly:wk?(wk.error||'dibagikan'):null,monthly:mo?(mo.error||'dibagikan'):null,backup:bk?(bk.ok?'terkirim':bk.error):null,broadcast:bc?(bc.error||(bc.done?'selesai':bc.i+'/'+bc.ids.length)):null,broadcastAll:bca?(bca.error||(bca.done?'selesai':bca.seen+' dipindai')):null,auto:au,ms:Date.now()-t0})}
