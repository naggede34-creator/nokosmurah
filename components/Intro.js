'use client'
import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
// Animasi pembuka gaya komik 3D memakai maskot & logo asli Artapedia ID:
// hitungan 1-100, maskot terbang masuk, papan logo muncul, lalu dua papan layanan.
// Lama 10 detik, selalu bisa dilewati lewat tombol SKIP. Hanya muncul sekali per kunjungan
// (sessionStorage) supaya tidak mengganggu saat pindah halaman, dan otomatis dilewati
// kalau pengguna memilih "kurangi gerakan" di pengaturan HP-nya.
const KEY='arta-intro'
export const DURASI=10000
export default function Intro(){
 const [on,setOn]=useState(false)
 const [n,setN]=useState(0)
 const t0=useRef(0),raf=useRef(0)
 useEffect(()=>{
  let sudah=true
  try{sudah=sessionStorage.getItem(KEY)==='1'}catch(e){}
  const diam=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
  if(sudah||diam){try{sessionStorage.setItem(KEY,'1')}catch(e){};return}
  try{sessionStorage.setItem(KEY,'1')}catch(e){}
  // gambar disiapkan lebih dulu supaya tidak muncul separuh jalan
  for(const u of ['/maskot.webp','/banner-arta.jpg']){const im=new Image();im.src=u}
  setOn(true);document.body.style.overflow='hidden'
  t0.current=performance.now()
  const tick=now=>{const p=Math.min(1,(now-t0.current)/DURASI)
   setN(Math.round(p*100))
   if(p>=1){tutup();return}
   raf.current=requestAnimationFrame(tick)}
  raf.current=requestAnimationFrame(tick)
  return ()=>cancelAnimationFrame(raf.current)},[])
 const tutup=()=>{cancelAnimationFrame(raf.current);document.body.style.overflow='';setOn(false)}
 if(!on||typeof document==='undefined')return null
 // babak: 0 = maskot masuk, 1 = papan logo, 2 = papan layanan, 3 = ajakan masuk
 const babak=n<22?0:n<48?1:n<80?2:3
 return createPortal(
  <div className="itr" role="dialog" aria-label="Animasi pembuka Artapedia ID">
   <div className="itr-sky"/><div className="itr-dots"/>
   <div className="itr-rays" style={{animationDuration:'14s'}}/>
   <div className={'itr-stage b'+babak}>
    <img className="itr-mascot" src="/maskot.webp" alt="Maskot Artapedia ID" draggable={false}/>
    <div className="itr-logo"><img src="/banner-arta.jpg" alt="Artapedia ID — nokos OTP 24 jam"/></div>
    <div className="itr-panels">
     <div className="itr-panel p1"><b>BELI NOKOS MURAH</b><small>Nomor &amp; OTP otomatis 24 jam</small></div>
     <div className="itr-panel p2"><b>QRIS GATEWAY</b><small>Terima pembayaran, cair otomatis</small></div></div>
    <div className="itr-go">AYO MULAI!</div></div>
   <div className="itr-bot">
    <div className="itr-num"><b>{n}</b><span>%</span></div>
    <div className="itr-bar"><i style={{width:n+'%'}}/></div>
    <button className="itr-skip" onClick={tutup}>LEWATI ⏭</button></div>
  </div>,document.body)}
