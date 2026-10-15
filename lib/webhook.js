// Webhook OTP: saat kode OTP masuk, kirim POST JSON bertanda tangan HMAC ke URL milik pengguna.
import crypto from 'crypto'
import {pushUser,msgOtp} from './tgpush'
import {strukPng} from './strukimg'
import {getSec} from './settings'
import dns from 'dns/promises'
import net from 'net'
const v4priv=ip=>{const [a,b,c]=ip.split('.').map(Number);return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===192&&b===0&&c===0)||(a===198&&(b===18||b===19))}
const priv=ip=>{ip=String(ip).toLowerCase();if(net.isIPv4(ip))return v4priv(ip)
 const m=ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);if(m)return v4priv(m[1])
 return ip==='::'||ip==='::1'||/^f[cd]/.test(ip)||/^fe[89ab]/.test(ip)||/^ff/.test(ip)}
// Validasi URL webhook: wajib https, tanpa user:pass, dan host tidak boleh mengarah ke jaringan internal (anti-SSRF)
export async function checkUrl(raw){
 let u;try{u=new URL(String(raw||'').trim())}catch(e){return {ok:false,error:'URL tidak valid'}}
 if(u.protocol!=='https:')return {ok:false,error:'URL webhook harus diawali https://'}
 if(u.username||u.password)return {ok:false,error:'URL tidak boleh memuat username/password'}
 if(String(raw).length>300)return {ok:false,error:'URL terlalu panjang (maks 300 karakter)'}
 const h=u.hostname.replace(/^\[|\]$/g,'')
 if(/^localhost$|\.local$|\.internal$/i.test(h))return {ok:false,error:'Host internal tidak diizinkan'}
 try{const ips=net.isIP(h)?[h]:(await dns.lookup(h,{all:true})).map(x=>x.address)
  if(!ips.length||ips.some(priv))return {ok:false,error:'Host mengarah ke alamat internal/privat, tidak diizinkan'}}
 catch(e){return {ok:false,error:'Domain tidak ditemukan (DNS gagal)'}}
 return {ok:true,url:u.toString()}}
export const newSecret=()=>'whsec_'+crypto.randomBytes(24).toString('hex')
export const sign=(secret,ts,body)=>'sha256='+crypto.createHmac('sha256',secret).update(ts+'.'+body).digest('hex')
async function post(url,secret,event,payload){
 const body=JSON.stringify({event,...payload}),ts=String(Math.floor(Date.now()/1000))
 const r=await fetch(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(7000),headers:{'Content-Type':'application/json','User-Agent':'Artapedia-Webhook/1.0','X-Artapedia-Event':event,'X-Artapedia-Timestamp':ts,'X-Artapedia-Signature':sign(secret,ts,body)},body})
 return r.status}
// Kirim 1x + 1x ulang bila gagal / 5xx. Hasil terakhir dicatat di u.hook.last (pemanggil yang menyimpan u).
export async function deliver(u,event,payload){
 const h=u.hook;if(!h||!h.url||!h.secret)return {ok:false,error:'Webhook belum diatur'}
 const c=await checkUrl(h.url);let res
 if(!c.ok)res={ok:false,code:0,error:c.error}
 else{res={ok:false,code:0,error:''}
  for(let i=0;i<2&&!res.ok;i++){
   try{const code=await post(c.url,h.secret,event,payload);res={ok:code>=200&&code<300,code,error:code>=200&&code<300?'':'Balasan HTTP '+code}}
   catch(e){res={ok:false,code:0,error:String(e.name==='TimeoutError'?'Timeout (7 detik)':e.message||'gagal').slice(0,120)}}
   if(!res.ok&&i===0&&(res.code===0||res.code>=500))await new Promise(r=>setTimeout(r,1200));else if(!res.ok)break}}
 h.last={at:Date.now(),ok:res.ok,code:res.code,error:res.error,event,order:payload.order_id||null}
 return res}
// Dipanggil saat OTP masuk. Tidak pernah melempar error & hanya sekali per order (o.hooked).
export async function fireOtp(u,o){
 try{if(!o.tgSent){o.tgSent=true
  // struk DM pengguna boleh memuat kode OTP: ini pesan pribadi ke pemiliknya sendiri
  const hs=String((await getSec().catch(()=>({}))).SITE_URL||'').replace(/^https?:\/\//,'').replace(/\/+$/,'')||'artapedia.id'
  // pelanggan bot reseller: struk & label mengikuti bahasa toko
  let L=null;if(u.rs){try{const {pack}=await import('./rslang');L=pack(await (await import('./reseller')).getRs(u.rs))}catch(e){}}
  let pg=null;try{pg=await strukPng({...o,orderId:o.id,phoneNumber:o.phone,createdAt:new Date(o.at).toISOString(),showOtp:true},'order',hs,L)}catch(e){}
  await pushUser(u,msgOtp(o),null,pg)}}catch(e){}
 try{if(!u.hook||!u.hook.on||!u.hook.url||o.hooked)return;o.hooked=true
  await deliver(u,'otp.received',{order_id:o.id,status:'success',phone:o.phone,service:o.serviceName,service_id:o.serviceId,country:o.countryName||'',otp:o.otp,message:o.msg||'',price:o.price,server:o.server,guarantee:!!o.guarantee,created_at:new Date(o.at).toISOString(),received_at:new Date().toISOString()})
 }catch(e){}}
