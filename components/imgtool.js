'use client'
// Pengecil gambar di browser: dipakai panel admin & halaman reseller supaya
// berkas yang dikirim ke server selalu di bawah ~280KB.
export const shrinkImg=(f,limit=280000)=>new Promise((res,rej)=>{
 const r=new FileReader();r.onerror=rej
 r.onload=()=>{const im=new Image();im.onerror=rej
  im.onload=()=>{for(const [m,q] of [[1000,.85],[800,.75],[640,.65],[520,.55]]){
   const k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas')
   c.width=Math.round(im.width*k);c.height=Math.round(im.height*k)
   c.getContext('2d').drawImage(im,0,0,c.width,c.height)
   const o=c.toDataURL('image/jpeg',q);if(o.length<=limit)return res(o)}
   rej(new Error('big'))}
  im.src=r.result}
 r.readAsDataURL(f)})
