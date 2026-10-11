import {getSec} from './settings'
// Kirim email via Resend (https://resend.com). Opsional: tanpa RESEND_API_KEY, admin bisa buat link reset manual dari /admin.
export async function sendMail(to,subject,html){
 const sc=await getSec(),k=sc.RESEND_API_KEY,from=sc.MAIL_FROM
 if(!k||!from)return {ok:false,error:'API key Resend / alamat pengirim belum diisi (admin > Integrasi)'}
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html})})
  const d=await r.json().catch(()=>({}));return r.ok?{ok:true}:{ok:false,error:d.message||('HTTP '+r.status)}}catch(e){return {ok:false,error:e.message}}}
