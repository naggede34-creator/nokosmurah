'use client'
import {useState,useEffect,useRef} from 'react'
import {usePathname} from 'next/navigation'
import {ting,unlock} from './sound'
const HIDE=['/login','/register','/deposit']
// Tombol Customer Service melayang (bulat, pojok kanan bawah) di semua halaman.
export default function CsFab(){
 const path=usePathname()||'',[n,setN]=useState(0),[off,setOff]=useState(false),last=useRef(null)
 useEffect(()=>{const u=()=>unlock();document.addEventListener('pointerdown',u,{once:true});return()=>document.removeEventListener('pointerdown',u)},[])
 // CS dimatikan admin: tombolnya tetap ada (biar pengguna bisa baca alasannya) tapi tampil 'tidur'
 useEffect(()=>{let on=true;fetch('/api/v1/promo').then(r=>r.json()).then(d=>{if(on&&d&&d.cs)setOff(d.cs.on===false)}).catch(()=>{});return()=>{on=false}},[])
 useEffect(()=>{
  if(path.startsWith('/cs')||path.startsWith('/pay')||path.startsWith('/struk')||HIDE.includes(path))return
  let on=true
  const f=async()=>{try{const d=await fetch('/api/v1/me').then(r=>r.json());const c=d.error?0:(d.csUnread||0);if(!on)return;if(last.current!==null&&c>last.current)ting();last.current=c;setN(c)}catch(e){}}
  f();const t=setInterval(f,6000);return()=>{on=false;clearInterval(t)}},[path])
 if(path.startsWith('/cs')||HIDE.includes(path)||path.startsWith('/admin')||path.startsWith('/pay')||path.startsWith('/struk'))return null
 return <a href="/cs" aria-label={off?'Customer Service sedang tutup':'Customer Service'} className={'fab'+(path.startsWith('/dashboard')?' up':'')+(n&&!off?' wob':'')+(off?' off':'')}><span>{off?'😴':'💬'}</span>{n>0&&!off&&<b>{n>9?'9+':n}</b>}</a>}
