import {save} from './auth'
import {P,upDep} from './providers'
import {notify} from './telegram'
const mut=(u,a,n)=>{u.balance+=a;(u.mut=u.mut||[]).unshift({amt:a,bal:u.balance,note:n,at:Date.now()})}
export async function syncUser(u){let ch=0
 for(const o of u.tx.filter(x=>x.status==='pending')){try{
  if(o.type==='order'){const s=await P[o.server].status(o.id)
   if(s.otp){o.status='success';o.otp=s.otp;o.msg=s.msg;ch=1;await notify(`🔑 OTP diterima\n${u.name}\n${o.serviceName} ${o.phone}\nKode: ${o.otp}`)}
   else if(['expired','cancelled','canceled'].includes(s.state)||Date.now()>o.expiredAt){o.status='expired';if(!o.refunded){o.refunded=true;mut(u,o.price,'Refund '+o.id)};ch=1;await notify(`⌛ Order expired + refund\n${u.name} ${o.phone}`)}}
  else if(o.type==='deposit'){const s=(await upDep.check(o.id)).status
   if(s==='completed'){o.status='completed';if(!o.credited){o.credited=true;mut(u,o.amount,'Deposit '+o.id)};ch=1;await notify(`✅ Deposit SUKSES\n${u.name}\nRp${o.amount}`)}
   else if(['expired','canceled','failed'].includes(s)){o.status=s;ch=1}}
 }catch(e){}}
 if(ch)await save(u);return ch}
