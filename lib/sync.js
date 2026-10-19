import {save} from './auth'
import {kv} from './db'
import {P} from './providers'
import {notify,mask,rp,wibAt} from './telegram'
import {pushUser,msgRefund} from './tgpush'
import {depCheck,applyDep} from './deposit'
import {strukPng} from './strukimg'
import {getSec} from './settings'
import {fireOtp} from './webhook'
import {refundOnce} from './bonus'
const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()})}
// Aturan pembatalan nokos (web, API, bot Telegram): baru boleh dibatalkan SETELAH 3 menit sejak order
// dibuat, dan hanya selama order masih menunggu OTP. Order yang sudah sukses (kode masuk) TIDAK bisa
// dibatalkan. (Pembatalan oleh admin dari panel tidak terkena aturan ini.)
export const CANCEL_WAIT=180000
// Sisa detik sebelum order boleh dibatalkan (0 = sudah boleh).
export const cancelWaitSec=o=>Math.max(0,Math.ceil(((+o.at||0)+CANCEL_WAIT-Date.now())/1000))
// Alasan order TIDAK boleh dibatalkan sekarang, atau '' kalau boleh.
export const cancelBlock=o=>{
 if(!o)return 'Pesanan tidak ditemukan'
 if(o.status==='success')return 'Pembelian sudah sukses (kode OTP sudah masuk), jadi tidak bisa dibatalkan.'
 if(o.status==='cancelled'||o.status==='canceled')return 'Pesanan ini sudah dibatalkan.'
 if(o.status==='expired')return 'Pesanan ini sudah kedaluwarsa dan saldonya sudah dikembalikan.'
 if(o.status!=='pending')return 'Pesanan ini tidak bisa dibatalkan (status: '+o.status+').'
 const w=cancelWaitSec(o)
 if(w>0)return 'Pesanan baru bisa dibatalkan setelah 3 menit sejak dibuat. Tunggu '+Math.floor(w/60)+':'+String(w%60).padStart(2,'0')+' lagi.'
 return ''}
export const GUARANTEE_WAIT=240000 // jaminan OTP: ganti nomor otomatis jika 4 menit belum ada kode
// ---------- pembatalan yang ditolak penyedia ----------
// Penyedia nomor kadang menolak pembatalan (masih terlalu baru di sisi mereka, atau
// server mereka sedang gangguan). Dulu pengguna cuma melihat "ditolak provider" lalu
// tidak terjadi apa-apa. Sekarang permintaannya DISIMPAN dan dicoba ulang otomatis:
// percobaan pertama di menit ke-4 sejak order, lalu tiap menit sampai berhasil.
// (CANCEL_AUTO_MS / CANCEL_RETRY_MS hanya dipakai saat pengujian otomatis; di server
//  sungguhan biarkan kosong supaya tetap menit ke-4 dan ulang tiap menit.)
export const AUTO_CANCEL=+process.env.CANCEL_AUTO_MS||240000   // menit ke-4 sejak order dibuat
export const CANCEL_RETRY=+process.env.CANCEL_RETRY_MS||60000  // jarak percobaan berikutnya
export function markCancel(o,err){
 if(!o.cancelReq)o.cancelReq=Date.now()
 o.cancelAt=Math.max((+o.at||Date.now())+AUTO_CANCEL,Date.now()+CANCEL_RETRY)
 o.cancelErr=String((err&&err.message)||err||'').slice(0,160)
 return o}
// Satu kalimat yang dipakai di web maupun di semua bot, supaya pesannya seragam.
export const cancelMsg=()=>`Pembatalan otomatis dialihkan ke menit ke-${Math.max(1,Math.round(AUTO_CANCEL/60000))} — mohon tunggu. Ini terjadi karena server penyedia nomor sedang gangguan, bukan dari server kami. Begitu bisa, pesanan dibatalkan otomatis dan saldomu kembali penuh.`
// Coba batalkan order yang permintaannya tertunda. true = berhasil dibatalkan sekarang.
export async function retryCancel(u,o){
 if(!o||o.status!=='pending'||!o.cancelReq)return false
 if(Date.now()<(+o.cancelAt||0))return false
 try{await P[o.server].cancel(o.id)}
 catch(e){markCancel(o,e);return false}
 o.status='cancelled';o.cancelReq=0
 if(await refundOnce(u,o,'Refund order dibatalkan')&&u.rs){
  const RS=await import('./reseller')
  if(o.rsCut)RS.addEarn(u.rs,-o.rsCut,'Refund '+o.id).catch(()=>{})
  if(o.rsStok)RS.stokAdd(u.rs,o.rsStok,'Refund '+o.id).catch(()=>{})}
 try{await pushUser(u,msgRefund(o,u,'DIBATALKAN'))}catch(e){}
 let rsRow=[];if(u.rs){try{rsRow=await (await import('./reseller')).rows(u.rs)}catch(e){}}
 try{await notify({src:o.via==='telegram'?'bot':undefined,i:'❌',t:'Order dibatalkan otomatis'+(rsRow.length?' (reseller)':''),st:'warn',
  id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)],...rsRow],
  note:'Penyedia sempat menolak pembatalan, dicoba ulang otomatis sampai berhasil'})}catch(e){}
 return true}
// Order dari bot reseller: saat order batal/expired, bagian reseller harus ditarik kembali —
// mode komisi: markup-nya; mode stok mandiri: saldo stok yang dipotong saat order dibuat.
// Dipakai bersama oleh pembatalan dari web, dari bot, dan dari panel admin.
export async function unwindRs(u,o){
 if(!u||!u.rs||!o)return
 try{const RS=await import('./reseller')
  if(o.rsCut)await RS.addEarn(u.rs,-o.rsCut,'Refund '+o.id).catch(()=>{})
  if(o.rsStok)await RS.stokAdd(u.rs,o.rsStok,'Refund '+o.id).catch(()=>{})}catch(e){}}
// ---------- jaring pengaman: order menggantung ----------
// Penyedia kadang TIDAK BISA ditanya sama sekali: servernya mati, atau ordernya sudah
// mereka hapus/batalkan sendiri sehingga dijawab 404. Dulu error itu ditelan diam-diam,
// ordernya tetap "menunggu" SELAMANYA, dan saldo pembeli tidak pernah kembali —
// inilah penyebab keluhan "sudah batal tapi saldo tidak kembali".
// Sekarang: begitu LEWAT BATAS TUNGGU (+2 menit), order dikedaluwarsakan dan saldonya
// dikembalikan, dijawab atau tidak oleh penyedia.
// (LATE_MS hanya untuk pengujian otomatis; di server sungguhan biarkan kosong = 2 menit)
export const LATE=+process.env.LATE_MS||120000
export const isLate=o=>!!o&&o.status==='pending'&&(+o.expiredAt||0)>0&&Date.now()>(+o.expiredAt||0)+LATE
export async function expireIfLate(u,o,sebab){
 if(!isLate(o))return false
 o.status='expired'
 const balik=await refundOnce(u,o,'Refund order kedaluwarsa')
 if(balik)await unwindRs(u,o)
 try{await pushUser(u,msgRefund(o,u,'KEDALUWARSA'))}catch(e){}
 let rsRow=[];if(u.rs){try{rsRow=await (await import('./reseller')).rows(u.rs)}catch(e){}}
 try{await notify({src:o.via==='telegram'?'bot':undefined,i:'⌛',t:'Order kedaluwarsa + refund'+(rsRow.length?' (reseller)':''),st:'warn',
  id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],
   ['Refund',balik?rp(o.price):'(sudah pernah)'],['Saldo sekarang',rp(u.balance)],...rsRow],
  note:'Penyedia tidak bisa ditanya ('+String(sebab||'tidak menjawab').slice(0,80)+'), saldo dikembalikan otomatis'})}catch(e){}
 return true}
// Jaminan OTP: kode belum masuk 4 menit -> nomor diganti otomatis (1x). Kalau tetap gagal, order expired -> refund penuh (termasuk biaya jaminan).
export async function replaceIfNeeded(u,o){
 if(!o.guarantee||o.replaced||o.status!=='pending'||Date.now()-o.at<GUARANTEE_WAIT)return false
 try{
  const n=await P[o.server].order({serviceId:o.serviceId,countryId:o.countryId,providerId:o.providerId,operatorId:o.operatorId,serviceName:o.serviceName,countryName:o.countryName,server:o.server})
  try{await P[o.server].cancel(o.id)}catch(e){}
  const old=o.phone;o.replaced=true;o.oldPhone=old;o.id=n.id;o.phone=n.phone;o.expiredAt=n.expiredAt
  await kv.set('o:'+n.id,u.id)
  await notify({src:o.via==='telegram'?'bot':undefined,i:'🔁',t:'Nomor diganti otomatis (Jaminan OTP)',st:'info',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor lama',old],['Nomor baru',n.phone]]})
  return true}catch(e){return false}}
// Satu order ditanyakan ke penyedia lalu diselesaikan: OTP masuk, kedaluwarsa + refund,
// antrean pembatalan, atau ganti nomor (Jaminan OTP). Dipakai sinkron cron maupun webhook
// penyedia, supaya akibat yang ditimbulkan persis sama lewat jalur mana pun.
// Tidak menyimpan sendiri: pemanggil yang memutuskan kapan save(u) dipanggil.
export async function syncOrder(u,o){let ch=0
 try{
  {const s=await P[o.server].status(o.id)
   if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;ch=1;await fireOtp(u,o)
    const hs=String((await getSec().catch(()=>({}))).SITE_URL||'').replace(/^https?:\/\//,'').replace(/\/+$/,'')||'artapedia.id'
    const {PACK_ID}=await import('./rslang')
    let pg=null;try{pg=await strukPng({...o,orderId:o.id,phoneNumber:o.phone,createdAt:new Date(o.at).toISOString()},'order',hs,PACK_ID)}catch(e){}
    let rsRow=[]
    if(u.rs){const RS=await import('./reseller');RS.chOtp(u.rs,o,pg).catch(()=>{});try{rsRow=await RS.rows(u.rs)}catch(e){}}
    await notify({photo:pg,photoName:'struk-'+o.id+'.png',src:o.via==='telegram'?'bot':undefined,i:'🔑',t:'OTP diterima'+(rsRow.length?' (reseller)':''),st:'ok',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName+(o.countryName?' · '+o.countryName:'')],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)],['Server',o.server],...rsRow],note:o.guarantee?'Order memakai Jaminan OTP':'Transaksi selesai (done)'})}
   else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired'
    if(await refundOnce(u,o)&&u.rs){const RS=await import('./reseller')
     // mode komisi: markup ditarik kembali · mode mandiri: saldo stok dikembalikan
     if(o.rsCut)RS.addEarn(u.rs,-o.rsCut,'Refund '+o.id).catch(()=>{})
     if(o.rsStok)RS.stokAdd(u.rs,o.rsStok,'Refund '+o.id).catch(()=>{})}
    ch=1;await pushUser(u,msgRefund(o,u,'KEDALUWARSA'))
   let rsRow2=[];if(u.rs){try{rsRow2=await (await import('./reseller')).rows(u.rs)}catch(e){}}
   await notify({src:o.via==='telegram'?'bot':undefined,i:'⌛',t:'Order expired + refund'+(rsRow2.length?' (reseller)':''),st:'warn',id:['ID Order',o.id],rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)],['Saldo sekarang',rp(u.balance)],...rsRow2],note:'Kode OTP tidak masuk, saldo dikembalikan penuh'})}
   // permintaan batal yang tertunda diurus dulu: nomornya tidak boleh ikut diganti
   else if(await expireIfLate(u,o,'batas tunggu lewat'))ch=1
   else if(o.cancelReq){await retryCancel(u,o);ch=1}
   else if(await replaceIfNeeded(u,o))ch=1}
 }catch(e){
  // penyedia gagal ditanya: order yang sudah lewat batas tetap dikembalikan saldonya
  try{if(await expireIfLate(u,o,e.message))ch=1}catch(_){}}
 return ch}
export async function syncUser(u){let ch=0
 for(const o of u.tx.filter(x=>x.status==='pending')){try{
  if(o.type==='order'){if(await syncOrder(u,o))ch=1}
  else if(o.type==='deposit'){if(await applyDep(u,o,await depCheck(o)))ch=1}
 }catch(e){}}
 if(ch)await save(u);return ch}
