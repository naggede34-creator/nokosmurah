'use client'
import {useState,useEffect,useRef} from 'react'
import {usePathname} from 'next/navigation'
import {ting,unlock} from './sound'
const HIDE=['/login','/register','/deposit']
// Tombol Customer Service melayang (bulat, pojok kanan bawah) di semua halaman.
export default function CsFab(){
 const path=usePathname()||'',[n,setN]=useState(0),last=useRef(null)
 useEffect(()=>{const u=()=>unlock();document.addEventListener('pointerdown',u,{once:true});return()=>document.removeEventListener('pointerdown',u)},[])
 useEffect(()=>{
  if(path.startsWith('/cs')||HIDE.includes(path))return
  let on=true
  const f=async()=>{try{const d=await fetch('/api/v1/me').then(r=>r.json());const c=d.error?0:(d.csUnread||0);if(!on)return;if(last.current!==null&&c>last.current)ting();last.current=c;setN(c)}catch(e){}}
  f();const t=setInterval(f,6000);return()=>{on=false;clearInterval(t)}},[path])
 if(path.startsWith('/cs')||HIDE.includes(path)||path.startsWith('/admin'))return null
 return <a href="/cs" aria-label="Customer Service" className={'fab'+(path.startsWith('/dashboard')?' up':'')+(n?' wob':'')}><span>💬</span>{n>0&&<b>{n>9?'9+':n}</b>}</a>}
