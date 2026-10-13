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

// ---------------------------------------------------------------------------
// Nada panggilan saat tab masih terbuka (service worker tidak bisa memutar suara sendiri).
// PENTING: browser menolak memutar suara sebelum pengguna pernah menyentuh halaman.
// primeAudio() dipanggil pada sentuhan pertama supaya nada bisa dibunyikan nanti tanpa sentuhan.
let au=null,stop=null,primed=false,actx=null
export function primeAudio(){
 if(primed)return true
 try{
  actx=actx||new (window.AudioContext||window.webkitAudioContext)()
  if(actx.state==='suspended')actx.resume()
  if(!au){au=new Audio('/ring.wav');au.loop=true;au.preload='auto'}
  const v=au.volume;au.volume=0
  const pr=au.play()
  if(pr&&pr.then)pr.then(()=>{au.pause();au.currentTime=0;au.volume=v}).catch(()=>{au.volume=v})
  else{au.pause();au.currentTime=0;au.volume=v}
  primed=true}catch(e){}
 return primed}
if(typeof window!=='undefined'){
 const h=()=>primeAudio()
 window.addEventListener('pointerdown',h,{once:false,passive:true})
 window.addEventListener('keydown',h,{once:false,passive:true})}

// Nada "ting-tung" lewat WebAudio: tidak butuh berkas, dipakai sebagai cadangan kalau ring.wav diblokir.
function tingtung(){
 try{
  actx=actx||new (window.AudioContext||window.webkitAudioContext)()
  if(actx.state==='suspended')actx.resume()
  const t=actx.currentTime
  ;[[1318.5,0,.55],[987.8,.34,.9]].forEach(([f,d,len])=>{
   for(const [m,type,vol] of [[1,'sine',1],[2,'triangle',.45],[3,'sine',.2]]){
    const o=actx.createOscillator(),g=actx.createGain();o.type=type;o.frequency.value=f*m
    g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(vol,t+d+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d+len)
    o.connect(g);g.connect(actx.destination);o.start(t+d);o.stop(t+d+len+.05)}})
 }catch(e){}}

export function ringtone(seconds=12){
 try{if(navigator.vibrate)navigator.vibrate([400,150,400,150,600])}catch(e){}
 tingtung()                                   // selalu bunyi walau berkas gagal dimuat
 try{
  if(!au){au=new Audio('/ring.wav');au.loop=true}
  au.currentTime=0;au.volume=1
  const pr=au.play();if(pr&&pr.catch)pr.catch(()=>{})
  clearTimeout(stop);stop=setTimeout(()=>{try{au.pause()}catch(e){}},seconds*1000)
 }catch(e){}}
export function hushRingtone(){try{clearTimeout(stop);au&&au.pause()}catch(e){}}

// Notifikasi dari halaman yang sedang terbuka (bukan lewat push). Dipakai panel admin
// supaya chat masuk tetap terlihat & berbunyi walau Web Push belum/ gagal aktif.
export async function localNotify(title,body,url){
 ringtone(10)
 try{
  if(!supported()||Notification.permission!=='granted')return false
  const reg=await navigator.serviceWorker.ready
  reg.active&&reg.active.postMessage({type:'ring',data:{t:title,b:body,u:url||'/admin',tag:'cs-lokal',ring:1}})
  return true}catch(e){return false}}

// Dengarkan pesan dari service worker (dikirim saat push datang & tab masih hidup)
export function onPush(fn){
 if(!supported())return()=>{}
 const h=e=>{if(e.data&&e.data.type==='push')fn(e.data.data||{})}
 navigator.serviceWorker.addEventListener('message',h)
 return()=>navigator.serviceWorker.removeEventListener('message',h)}
