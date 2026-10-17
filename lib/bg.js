// Pekerjaan latar belakang yang aman di serverless.
// Di Vercel, fungsi "dibekukan" begitu respons terkirim, jadi promise yang tidak ditunggu bisa terputus
// di tengah jalan. waitUntil menahan fungsi tetap hidup sampai pekerjaan itu selesai, TANPA membuat
// pengguna menunggu. Ini cara yang sama dipakai paket @vercel/functions, ditulis di sini supaya tidak
// perlu menambah dependensi. Di luar Vercel (dev lokal / VPS) promise cukup dibiarkan jalan sendiri.
export function bg(p){
 try{
  const q=Promise.resolve(p).catch(()=>{})
  const ctx=globalThis[Symbol.for('@vercel/request-context')]
  const c=ctx&&typeof ctx.get==='function'?ctx.get():null
  if(c&&typeof c.waitUntil==='function')c.waitUntil(q)
 }catch(e){}
 return p}
