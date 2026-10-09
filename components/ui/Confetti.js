'use client'
import {useMemo} from 'react'
import {motion,useReducedMotion} from 'framer-motion'

// Confetti ringan tanpa library: ~70 potongan kertas ditembak dari tengah layar.
const COL=['#6ea0ff','#8b7bff','#ffb703','#ff7a1a','#34d399','#f472b6','#ffffff']
export default function Confetti({n=70}){
 const rm=useReducedMotion()
 const items=useMemo(()=>{let s=11;const r=()=>(s=(s*16807)%2147483647)/2147483647,w=typeof window!=='undefined'?Math.min(window.innerWidth,560):420
  return Array.from({length:n},(_,i)=>({x:(r()-.5)*w*1.5,up:-(120+r()*260),fall:300+r()*420,rot:r()*900-450,w:6+r()*6,h:8+r()*10,c:COL[i%COL.length],d:r()*.2,t:1.8+r()*1.2}))},[n])
 if(rm)return null
 return <div aria-hidden className="pointer-events-none fixed inset-x-0 top-[40%] z-[600] flex justify-center">
  {items.map((p,i)=><motion.i key={i} className="absolute block rounded-[2px]" style={{width:p.w,height:p.h,background:p.c}}
   initial={{x:0,y:0,opacity:1,rotate:0}} animate={{x:[0,p.x*.7,p.x],y:[0,p.up,p.fall],opacity:[1,1,0],rotate:p.rot}}
   transition={{duration:p.t,delay:p.d,ease:'easeOut',times:[0,.35,1]}}/>)}</div>}
