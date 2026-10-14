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
export const CANCEL_WAIT=0   // tombol batal langsung bisa dipakai (sebelumnya 3 menit)
export const GUARANTEE_WAIT=240000 // jaminan OTP: ganti nomor otomatis jika 4 menit belum ada kode
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
export async function syncUser(u){let ch=0
 for(const o of u.tx.filter(x=>x.status==='pending')){try{
  if(o.type==='order'){const s=await P[o.server].status(o.id)
   if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;ch=1;await fireOtp(u,o)
    const hs=String((await getSec().catch(()=>({}))).SITE_URL||'').replace(/^https?:\/\//,'').replace(/\/+$/,'')||'artapedia.id'
    let pg=null;try{pg=await strukPng({...o,orderId:o.id,phoneNumber:o.phone,createdAt:new Date(o.at).toISOString()},'order',hs)}catch(e){}
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
   else if(await replaceIfNeeded(u,o))ch=1}
  else if(o.type==='deposit'){if(await applyDep(u,o,await depCheck(o)))ch=1}
 }catch(e){}}
 if(ch)await save(u);return ch}
