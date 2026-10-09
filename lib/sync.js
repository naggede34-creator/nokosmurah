import {save} from './auth'
import {kv} from './db'
import {P,upDep} from './providers'
import {notify,mask,rp} from './telegram'
import {creditDeposit} from './bonus'
const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()})}
export const CANCEL_WAIT=180000   // batal baru bisa setelah 3 menit
export const GUARANTEE_WAIT=240000 // jaminan OTP: ganti nomor otomatis jika 4 menit belum ada kode
// Jaminan OTP: kode belum masuk 4 menit -> nomor diganti otomatis (1x). Kalau tetap gagal, order expired -> refund penuh (termasuk biaya jaminan).
export async function replaceIfNeeded(u,o){
 if(!o.guarantee||o.replaced||o.status!=='pending'||Date.now()-o.at<GUARANTEE_WAIT)return false
 try{
  const n=await P[o.server].order({serviceId:o.serviceId,countryId:o.countryId,providerId:o.providerId,operatorId:o.operatorId,serviceName:o.serviceName,countryName:o.countryName,server:o.server})
  try{await P[o.server].cancel(o.id)}catch(e){}
  const old=o.phone;o.replaced=true;o.oldPhone=old;o.id=n.id;o.phone=n.phone;o.expiredAt=n.expiredAt
  await kv.set('o:'+n.id,u.id)
  await notify({i:'🔁',t:'Nomor diganti otomatis (Jaminan OTP)',rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor lama',old],['Nomor baru',n.phone]]})
  return true}catch(e){return false}}
export async function syncUser(u){let ch=0
 for(const o of u.tx.filter(x=>x.status==='pending')){try{
  if(o.type==='order'){const s=await P[o.server].status(o.id)
   if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;ch=1;await notify({i:'🔑',t:'OTP diterima',rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Kode',o.otp],['Harga',rp(o.price)]],note:o.guarantee?'Order memakai Jaminan OTP':''})}
   else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)};ch=1;await notify({i:'⌛',t:'Order expired + refund',rows:[['Pengguna',mask(u.email)],['Layanan',o.serviceName],['Nomor',o.phone],['Refund',rp(o.price)]]})}
   else if(await replaceIfNeeded(u,o))ch=1}
  else if(o.type==='deposit'){const s=(await upDep.check(o.id)).status
   if(s==='completed'){o.status='completed';if(!o.credited)await creditDeposit(u,o);ch=1;await notify({i:'✅',t:'Deposit sukses',rows:[['Pengguna',mask(u.email)],['Nominal',rp(o.amount)],...(o.bonus?[['Bonus deposit','+'+rp(o.bonus)]]:[]),['Saldo sekarang',rp(u.balance)],['ID',o.id]]})}
   else if(['expired','canceled','failed'].includes(s)){o.status=s;ch=1}}
 }catch(e){}}
 if(ch)await save(u);return ch}
