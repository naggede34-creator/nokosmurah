// ===========================================================================
// Web Push (notifikasi HP walaupun browser/Chrome ditutup) tanpa library tambahan.
// Standarnya: VAPID (RFC 8292) untuk identitas pengirim + aes128gcm (RFC 8291/8188) untuk isi pesan.
// Kunci VAPID dibuat otomatis sekali lalu disimpan di database, jadi tidak perlu diisi di env.
// Langganan disimpan di kv:
//   'push:admin'      -> [subscription, ...]  (HP owner/admin, dapat notif chat CS masuk)
//   'push:u:<id>'     -> [subscription, ...]  (HP pengguna, dapat notif balasan CS / deposit)
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'

const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const unb64=s=>Buffer.from(String(s||'').replace(/-/g,'+').replace(/_/g,'/'),'base64')

// ---------- kunci VAPID ----------
export async function vapid(){
 const c=globalThis.__vapid;if(c)return c
 let v=await kv.get('vapid')
 if(!v||!v.pub||!v.priv){
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'})
  v={pub:b64u(publicKey.export({type:'spki',format:'der'}).subarray(-65)),
     priv:b64u(privateKey.export({type:'pkcs8',format:'der'})),at:Date.now()}
  await kv.set('vapid',v)}
 return globalThis.__vapid=v}
export const publicKey=async()=>(await vapid()).pub
const privKey=v=>crypto.createPrivateKey({key:unb64(v.priv),format:'der',type:'pkcs8'})

// ES256: tanda tangan DER dari Node harus diubah ke r||s mentah 64 byte
function derToRaw(der){
 let i=2;if(der[1]&0x80)i=2+(der[1]&0x7f)
 const rl=der[i+1],r=der.subarray(i+2,i+2+rl),j=i+2+rl,sl=der[j+1],s=der.subarray(j+2,j+2+sl)
 const out=Buffer.alloc(64)
 r.subarray(Math.max(0,r.length-32)).copy(out,32-Math.min(32,r.length))
 s.subarray(Math.max(0,s.length-32)).copy(out,64-Math.min(32,s.length))
 return out}
async function jwt(aud,sub){
 const v=await vapid()
 const head=b64u(JSON.stringify({typ:'JWT',alg:'ES256'}))
 const body=b64u(JSON.stringify({aud,exp:Math.floor(Date.now()/1000)+12*3600,sub:sub||'mailto:admin@artapedia.id'}))
 const sig=b64u(derToRaw(crypto.sign('sha256',Buffer.from(head+'.'+body),{key:privKey(v),dsaEncoding:'der'})))
 return head+'.'+body+'.'+sig}

// ---------- enkripsi isi pesan (aes128gcm) ----------
const hkdf=(salt,ikm,info,len)=>{const prk=crypto.createHmac('sha256',salt).update(ikm).digest()
 return crypto.createHmac('sha256',prk).update(Buffer.concat([info,Buffer.from([1])])).digest().subarray(0,len)}
function encrypt(payload,p256dh,auth){
 const sub=unb64(p256dh),as=unb64(auth)
 const ec=crypto.createECDH('prime256v1');ec.generateKeys()
 const pub=ec.getPublicKey(),shared=ec.computeSecret(sub)
 const salt=crypto.randomBytes(16)
 const prkInfo=Buffer.concat([Buffer.from('WebPush: info\0'),sub,pub])
 const ikm=hkdf(as,shared,prkInfo,32)
 const key=hkdf(salt,ikm,Buffer.from('Content-Encoding: aes128gcm\0'),16)
 const nonce=hkdf(salt,ikm,Buffer.from('Content-Encoding: nonce\0'),12)
 const rec=Buffer.concat([Buffer.from(payload,'utf8'),Buffer.from([2])])   // padding delimiter record terakhir
 const c=crypto.createCipheriv('aes-128-gcm',key,nonce)
 const body=Buffer.concat([c.update(rec),c.final(),c.getAuthTag()])
 const head=Buffer.alloc(21);salt.copy(head,0);head.writeUInt32BE(4096,16);head.writeUInt8(65,20)
 return Buffer.concat([head,pub,body])}

// ---------- kirim ----------
// Return {ok, gone} - gone=true berarti langganan sudah tidak berlaku (HP/browser mencabut izin) dan harus dihapus.
export async function sendOne(sub,data){
 try{
  const ep=String(sub&&sub.endpoint||'');if(!/^https:\/\//.test(ep))return {ok:false,gone:true}
  const k=sub.keys||{};if(!k.p256dh||!k.auth)return {ok:false,gone:true}
  const body=encrypt(JSON.stringify(data),k.p256dh,k.auth),u=new URL(ep)
  const r=await fetch(ep,{method:'POST',headers:{
    Authorization:'vapid t='+await jwt(u.origin)+', k='+await publicKey(),
    'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',
    TTL:'600',Urgency:'high'},body,signal:AbortSignal.timeout(12000)})
  if(r.status===404||r.status===410)return {ok:false,gone:true}
  return {ok:r.status>=200&&r.status<300,code:r.status}}
 catch(e){return {ok:false,error:e.message}}}

export const KEY_ADMIN='push:admin'
export const keyUser=id=>'push:u:'+id
const list=async k=>{const l=await kv.get(k);return Array.isArray(l)?l:[]}
// Simpan langganan (satu endpoint = satu baris, maks 20 perangkat)
export async function subscribe(k,sub,label){
 if(!sub||!sub.endpoint||!(sub.keys&&sub.keys.p256dh&&sub.keys.auth))throw Error('Data langganan notifikasi tidak lengkap')
 const l=(await list(k)).filter(x=>x.endpoint!==sub.endpoint)
 l.unshift({endpoint:sub.endpoint,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth},label:String(label||'').slice(0,60),at:Date.now()})
 await kv.set(k,l.slice(0,20));return l.length}
export async function unsubscribe(k,endpoint){
 await kv.set(k,(await list(k)).filter(x=>x.endpoint!==endpoint));return true}
export const count=async k=>(await list(k)).length
// Kirim ke semua perangkat pada satu daftar; langganan mati otomatis dibersihkan.
export async function push(k,data){
 const l=await list(k);if(!l.length)return {sent:0,total:0}
 const res=await Promise.all(l.map(s=>sendOne(s,data)))
 const dead=l.filter((_,i)=>res[i].gone)
 if(dead.length)await kv.set(k,l.filter((_,i)=>!res[i].gone))
 return {sent:res.filter(r=>r.ok).length,total:l.length,removed:dead.length}}
