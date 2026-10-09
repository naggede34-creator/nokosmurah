'use client'
import {useEffect,useId,useRef} from 'react'
import {motion,useMotionValue,useSpring,useReducedMotion} from 'framer-motion'

// Maskot globe Artapedia: SVG bergradien (efek 3D), mengambang, berkedip, melambai,
// dan matanya mengikuti kursor. Dipakai di landing, auth, dan dashboard.
// size: angka (px) atau string CSS ('100%'). float={false} untuk diam.
export default function Mascot({size=160,float=true,look=true,className=''}){
 const id=useId().replace(/:/g,''),rm=useReducedMotion(),ref=useRef(null)
 const px=useMotionValue(0),py=useMotionValue(0),sx=useSpring(px,{stiffness:180,damping:16}),sy=useSpring(py,{stiffness:180,damping:16})
 useEffect(()=>{
  if(!look||rm)return
  const f=e=>{const r=ref.current&&ref.current.getBoundingClientRect();if(!r)return
   const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),d=Math.hypot(dx,dy)||1,k=Math.min(1,d/260)
   px.set(dx/d*5*k);py.set(dy/d*5*k)}
  window.addEventListener('pointermove',f,{passive:true});return()=>window.removeEventListener('pointermove',f)},[look,rm,px,py])
 const loop=(a,d,extra)=>rm||!float?{}:{animate:a,transition:{duration:d,repeat:Infinity,ease:'easeInOut',...extra}}
 return <motion.div ref={ref} className={className} style={{width:size,height:size,display:'inline-block'}}
  {...loop({y:[0,-10,0]},4.2)}>
  <svg viewBox="0 0 200 220" width="100%" height="100%" role="img" aria-label="Maskot Artapedia ID" style={{overflow:'visible'}}>
   <defs>
    <radialGradient id={id+'s'} cx="34%" cy="28%" r="85%"><stop offset="0" stopColor="#9cc4ff"/><stop offset=".45" stopColor="#3b7fe0"/><stop offset="1" stopColor="#1b2f9e"/></radialGradient>
    <radialGradient id={id+'l'} cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#7df0b0"/><stop offset="1" stopColor="#25b872"/></radialGradient>
    <linearGradient id={id+'a'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd45c"/><stop offset="1" stopColor="#ffa400"/></linearGradient>
    <clipPath id={id+'c'}><circle cx="100" cy="100" r="78"/></clipPath>
    <filter id={id+'b'}><feGaussianBlur stdDeviation="5"/></filter>
   </defs>
   <motion.ellipse cx="100" cy="207" rx="50" ry="8" fill="#0b1a55" opacity=".35" filter={`url(#${id}b)`} {...loop({scaleX:[1,.82,1],opacity:[.35,.2,.35]},4.2)}/>
   {/* lengan kiri (diam) & kanan (melambai) */}
   <path d="M30 122 Q10 132 8 150" stroke={`url(#${id}a)`} strokeWidth="13" strokeLinecap="round" fill="none"/><circle cx="8" cy="152" r="9" fill="#ffc21a"/>
   <motion.g style={{originX:.02,originY:.97}} {...loop({rotate:[0,-22,6,-22,0]},2.6,{times:[0,.25,.5,.75,1],repeatDelay:1.4})}>
    <path d="M170 122 Q192 118 196 94" stroke={`url(#${id}a)`} strokeWidth="13" strokeLinecap="round" fill="none"/><circle cx="196" cy="92" r="9" fill="#ffc21a"/>
   </motion.g>
   <circle cx="100" cy="100" r="78" fill={`url(#${id}s)`}/>
   <g clipPath={`url(#${id}c)`}>
    <motion.g {...loop({x:[-10,10,-10]},14)}>
     <path d="M40 62c14-16 38-20 50-8s4 24-10 29-28 4-40-4z" fill={`url(#${id}l)`} opacity=".9"/>
     <path d="M118 118c12-8 30-6 38 4s-2 24-16 26-28-2-28-14z" fill={`url(#${id}l)`} opacity=".9"/>
     <path d="M104 40c8-6 20-4 22 4s-8 14-16 12-10-10-6-16z" fill={`url(#${id}l)`} opacity=".8"/>
    </motion.g>
    <ellipse cx="72" cy="52" rx="34" ry="18" fill="#fff" opacity=".28" transform="rotate(-28 72 52)"/>
    <circle cx="100" cy="100" r="77" fill="none" stroke="#0b1a55" strokeOpacity=".25" strokeWidth="6" style={{filter:'blur(3px)'}}/>
   </g>
   <circle cx="100" cy="100" r="78" fill="none" stroke="#0b2a6f" strokeWidth="4"/>
   {/* wajah */}
   <motion.g {...loop({scaleY:[1,1,.08,1,1]},4.6,{times:[0,.46,.5,.54,1],ease:'linear'})}>
    <circle cx="76" cy="98" r="14" fill="#fff" stroke="#0b2a6f" strokeWidth="3"/><circle cx="124" cy="98" r="14" fill="#fff" stroke="#0b2a6f" strokeWidth="3"/>
    <motion.circle cx="76" cy="98" r="6.5" fill="#0b2a6f" style={{x:sx,y:sy}}/><motion.circle cx="124" cy="98" r="6.5" fill="#0b2a6f" style={{x:sx,y:sy}}/>
    <circle cx="73" cy="94" r="2.2" fill="#fff"/><circle cx="121" cy="94" r="2.2" fill="#fff"/>
   </motion.g>
   <ellipse cx="62" cy="122" rx="9" ry="5.5" fill="#ff8aa8" opacity=".6"/><ellipse cx="138" cy="122" rx="9" ry="5.5" fill="#ff8aa8" opacity=".6"/>
   <path d="M86 126 Q100 142 114 126" stroke="#0b2a6f" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
  </svg></motion.div>}
