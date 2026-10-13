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
// Kunci dibuat SEKALI lalu dipakai selamanya. Pembuatannya dikunci: kalau dua proses
// (serverless bisa jalan paralel) membuat pasangan kunci berbeda lalu saling menimpa,
// HP yang terlanjur mendaftar dengan kunci lama akan ditolak push service (403) dan
// notifikasinya tidak pernah sampai -- tanpa pesan error apa pun.
const genKeys=()=>{const {publicKey,privateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'})
 return {pub:b64u(publicKey.export({type:'spki',format:'der'}).subarray(-65)),
         priv:b64u(privateKey.export({type:'pkcs8',format:'der'})),at:Date.now()}}
export async function vapid(){
 const c=globalThis.__vapid;if(c)return c
 let v=await kv.get('vapid')
 if(!v||!v.pub||!v.priv){
  if(await kv.lock('vapid',15000)){
   try{v=await kv.get('vapid')                       // baca ulang: mungkin proses lain sudah membuatnya
    if(!v||!v.pub||!v.priv){v=genKeys();await kv.set('vapid',v)}}
   finally{await kv.unlock('vapid')}}
  else{for(let i=0;i<10&&!(v&&v.pub);i++){await new Promise(r=>setTimeout(r,300));v=await kv.get('vapid')}
   if(!v||!v.pub){v=genKeys();await kv.set('vapid',v)}}}
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
// Return {ok, code, err, gone}. gone=true = langganan sudah tidak berlaku dan harus dihapus:
//  404/410 = HP mencabut izin / aplikasi dihapus
//  403     = tanda tangan VAPID tidak cocok (HP mendaftar memakai kunci lama) -> harus daftar ulang
export async function sendOne(sub,data){
 try{
  const ep=String(sub&&sub.endpoint||'');if(!/^https:\/\//.test(ep))return {ok:false,gone:true,err:'Alamat langganan tidak valid'}
  const k=sub.keys||{};if(!k.p256dh||!k.auth)return {ok:false,gone:true,err:'Kunci langganan tidak lengkap'}
  const body=encrypt(JSON.stringify(data),k.p256dh,k.auth),u=new URL(ep)
  const r=await fetch(ep,{method:'POST',headers:{
    Authorization:'vapid t='+await jwt(u.origin)+', k='+await publicKey(),
    'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',
    TTL:'1800',Urgency:'high',Topic:String(data&&data.tag||'artapedia').replace(/[^A-Za-z0-9_-]/g,'').slice(0,32)||'artapedia'},
   body,signal:AbortSignal.timeout(12000)})
  if(r.status>=200&&r.status<300)return {ok:true,code:r.status}
  let txt='';try{txt=(await r.text()).slice(0,200)}catch(e){}
  const gone=r.status===404||r.status===410||r.status===403
  return {ok:false,code:r.status,gone,
   err:r.status===403?'Ditolak push service (403): HP ini terdaftar dengan kunci lama. Tekan "Aktifkan notifikasi HP" sekali lagi di HP itu.'
     :r.status===404||r.status===410?'Langganan sudah dicabut HP/browser ('+r.status+'). Aktifkan lagi di HP itu.'
     :r.status===413?'Isi notifikasi terlalu besar (413).'
     :r.status===429?'Terlalu sering, ditolak sementara oleh push service (429).'
     :'Push service membalas HTTP '+r.status+(txt?' · '+txt:'')}}
 catch(e){return {ok:false,err:'Gagal menghubungi push service: '+e.message}}}

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
// Daftar perangkat untuk ditampilkan ke pemilik (TANPA kunci rahasianya)
export const devices=async k=>(await list(k)).map(x=>({id:idOf(x.endpoint),label:x.label||'Perangkat',at:x.at||0,
 svc:svcName(x.endpoint),last:x.last||null}))
const idOf=ep=>String(ep||'').slice(-12)
const svcName=ep=>/fcm\.googleapis|android\.googleapis/.test(ep)?'Google (Chrome/Android)'
 :/mozilla|autopush/.test(ep)?'Mozilla (Firefox)':/notify\.windows|microsoft/.test(ep)?'Microsoft (Edge)'
 :/web\.push\.apple/.test(ep)?'Apple (Safari/iPhone)':'Lainnya'

// Kirim ke semua perangkat pada satu daftar.
// Hasil tiap perangkat DISIMPAN (field last) supaya pemilik bisa melihat kenapa notifikasi tidak sampai,
// dan langganan yang sudah tidak berlaku dibuang otomatis.
export async function push(k,data){
 const l=await list(k);if(!l.length)return {sent:0,total:0,results:[]}
 const res=await Promise.all(l.map(s=>sendOne(s,data)))
 const now=Date.now()
 const keep=l.map((s,i)=>({...s,last:{at:now,ok:!!res[i].ok,code:res[i].code||0,err:res[i].err||''}}))
             .filter((_,i)=>!res[i].gone)
 await kv.set(k,keep)
 return {sent:res.filter(r=>r.ok).length,total:l.length,removed:l.length-keep.length,
  results:l.map((s,i)=>({device:s.label||'Perangkat',svc:svcName(s.endpoint),ok:!!res[i].ok,code:res[i].code||0,err:res[i].err||''}))}}
