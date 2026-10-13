/* Service worker Artapedia ID.
   Tugasnya hanya satu: menerima Web Push dan memunculkan notifikasi di HP,
   TERMASUK saat tab/Chrome sudah ditutup (selama HP tidak dalam mode hemat baterai ketat).

   Catatan jujur soal "bunyi keras": nada notifikasi web ditentukan oleh SISTEM (Android/Windows),
   bukan oleh situs. Yang bisa kita lakukan -- dan sudah dilakukan di sini:
     1. getaran panjang bertingkat (vibrate) + notifikasi diulang beberapa kali (ring),
     2. requireInteraction: notifikasi TIDAK hilang sendiri sampai diketuk,
     3. kalau ada tab Artapedia yang masih hidup, tab itu disuruh memutar nada panggilan nyaring (loop).
   Supaya sekeras nada panggilan: di Android buka Setelan > Notifikasi > Chrome > Chat CS,
   pilih "Mendesak/Urgent" dan nada yang nyaring. Atau pasang situs ini ke layar utama (Install app). */
const TAG='artapedia-cs'
self.addEventListener('install',e=>self.skipWaiting())
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()))

const wait=ms=>new Promise(r=>setTimeout(r,ms))
const VIB=[500,180,500,180,500,180,900]

async function tellClients(d){
 const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true})
 for(const c of cs)c.postMessage({type:'push',data:d})
 return cs}

async function ring(d){
 const title=d.t||'Artapedia ID',body=d.b||'',url=d.u||'/',tag=d.tag||TAG
 const times=Math.max(1,Math.min(5,+d.ring||1))
 const live=await tellClients(d)                       // tab yang terbuka memutar nada panggilan
 for(let i=0;i<times;i++){
  await self.registration.showNotification(title,{
   body,icon:'/icon-192.png',badge:'/icon-192.png',image:d.img||undefined,
   vibrate:VIB,tag,renotify:true,requireInteraction:true,silent:false,
   timestamp:Date.now(),data:{url},
   actions:[{action:'open',title:'Buka'},{action:'close',title:'Tutup'}]})
  if(i<times-1)await wait(2500)}
 return live}

self.addEventListener('push',e=>{
 let d={};try{d=e.data?e.data.json():{}}catch(x){d={t:'Artapedia ID',b:e.data?e.data.text():''}}
 e.waitUntil(ring(d))})

self.addEventListener('notificationclick',e=>{
 e.notification.close()
 if(e.action==='close')return
 const url=(e.notification.data&&e.notification.data.url)||'/'
 e.waitUntil((async()=>{
  const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true})
  for(const c of cs){if(c.url.includes(url)&&'focus' in c)return c.focus()}
  for(const c of cs){if('navigate' in c){try{await c.navigate(url)}catch(x){}return c.focus()}}
  return self.clients.openWindow(url)})())})

// pesan dari halaman: "tes notifikasi lokal" tanpa lewat server
self.addEventListener('message',e=>{if(e.data&&e.data.type==='ring')ring(e.data.data||{})})
