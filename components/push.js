'use client'
// Helper Web Push di sisi browser: daftarkan service worker, minta izin notifikasi,
// lalu kirim langganan ke server. Dipakai halaman admin (notif chat CS masuk) dan dashboard pengguna.
const b64=s=>{const pad='='.repeat((4-s.length%4)%4),raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'))
 return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
export const supported=()=>typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window
export const permission=()=>supported()?Notification.permission:'unsupported'

export async function register(){
 if(!supported())throw Error('Browser ini belum mendukung notifikasi. Pakai Chrome di Android, atau di iPhone pasang dulu situs ini ke Layar Utama lewat Safari › Bagikan › Tambahkan ke Layar Utama.')
 return navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(()=>navigator.serviceWorker.ready)}

// api(path, body) disuntik pemanggil supaya halaman admin bisa memakai header x-admin sendiri.
export async function enable(api,keyPath,subPath,label){
 const reg=await register()
 const perm=await Notification.requestPermission()
 if(perm!=='granted')throw Error(perm==='denied'
  ?'Izin notifikasi diblokir. Buka ikon gembok di address bar › Notifikasi › Izinkan, lalu coba lagi.'
  :'Izin notifikasi belum diberikan.')
 const k=await api(keyPath);if(!k||!k.key)throw Error(k&&k.error||'Kunci notifikasi server belum siap')
 let sub=await reg.pushManager.getSubscription()
 if(sub&&sub.options&&sub.options.applicationServerKey){
  const cur=btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  if(cur!==k.key){await sub.unsubscribe();sub=null}}       // kunci server berganti -> daftar ulang
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(k.key)})
 const r=await api(subPath,{sub:sub.toJSON(),label:label||navigator.userAgent.slice(0,60)})
 if(r&&r.error)throw Error(r.error)
 return r}

export async function disable(api,offPath){
 const reg=await register(),sub=await reg.pushManager.getSubscription()
 if(sub){await api(offPath,{endpoint:sub.endpoint});await sub.unsubscribe()}
 return true}

// Nada panggilan nyaring saat tab masih terbuka (service worker tidak bisa memutar suara sendiri).
let au=null,stop=null
export function ringtone(seconds=12){
 try{
  if(!au){au=new Audio('/ring.wav');au.loop=true}
  au.currentTime=0;au.volume=1;au.play().catch(()=>{})
  clearTimeout(stop);stop=setTimeout(()=>{try{au.pause()}catch(e){}},seconds*1000)
 }catch(e){}}
export function hushRingtone(){try{clearTimeout(stop);au&&au.pause()}catch(e){}}

// Dengarkan pesan dari service worker (dikirim saat push datang & tab masih hidup)
export function onPush(fn){
 if(!supported())return()=>{}
 const h=e=>{if(e.data&&e.data.type==='push')fn(e.data.data||{})}
 navigator.serviceWorker.addEventListener('message',h)
 return()=>navigator.serviceWorker.removeEventListener('message',h)}
