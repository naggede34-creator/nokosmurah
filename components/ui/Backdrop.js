'use client'
import {useMemo} from 'react'

// Latar animasi: blob gradient melayang + partikel naik pelan. Seed tetap => tidak ada hydration mismatch.
const rnd=seed=>()=>(seed=(seed*16807)%2147483647)/2147483647
export default function Backdrop({tone='dark',particles=22,grid=true}){
 const ps=useMemo(()=>{const r=rnd(42);return Array.from({length:particles},()=>({l:r()*100,s:2+r()*4,d:r()*14,t:10+r()*12,o:.25+r()*.55}))},[particles])
 const c=tone==='dark'?['bg-indigo-500/45','bg-sky-500/35','bg-fuchsia-500/25']:['bg-indigo-300/50','bg-sky-300/50','bg-orange-200/60']
 return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
  <div className={`absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full blur-3xl animate-blob motion-reduce:animate-none ${c[0]}`}/>
  <div className={`absolute top-1/3 -right-32 h-[460px] w-[460px] rounded-full blur-3xl animate-blob motion-reduce:animate-none ${c[1]}`} style={{animationDelay:'-6s'}}/>
  <div className={`absolute -bottom-40 left-1/4 h-[380px] w-[380px] rounded-full blur-3xl animate-blob motion-reduce:animate-none ${c[2]}`} style={{animationDelay:'-12s'}}/>
  {tone==='dark'&&grid&&<div className="fx-grid absolute inset-0"/>}
  <div className="motion-reduce:hidden">{ps.map((p,i)=><i key={i} className={`absolute bottom-[-10px] block rounded-full animate-rise ${tone==='dark'?'bg-white':'bg-indigo-400'}`} style={{left:p.l+'%',width:p.s,height:p.s,opacity:p.o,animationDelay:'-'+p.d+'s',animationDuration:p.t+'s'}}/>)}</div>
 </div>}
