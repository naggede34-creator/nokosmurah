'use client'
import {useEffect} from 'react'
// Daftarkan service worker sekali per kunjungan. Tanpa ini, notifikasi HP (Web Push) tidak bisa aktif.
// Service worker hanya berjalan di https (atau localhost); di http biasa pendaftaran dilewati tanpa error.
export default function SwReg(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator))return
  if(location.protocol!=='https:'&&location.hostname!=='localhost')return
  const t=setTimeout(()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{})},1200)
  return()=>clearTimeout(t)},[])
 return null}
