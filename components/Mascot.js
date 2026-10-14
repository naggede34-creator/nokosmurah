'use client'
import {useEffect,useRef} from 'react'
import {motion,useMotionValue,useSpring,useReducedMotion} from 'framer-motion'

// Maskot Artapedia ID (burung elang berbaju zirah) — gambar milik pemilik situs, public/maskot.webp (PNG cadangan: public/maskot.png).
// Tetap mengambang, sedikit miring mengikuti kursor, dan punya bayangan di bawahnya supaya terasa 3D.
// Prop dipertahankan sama seperti versi SVG lama: size (angka px atau string CSS), float, look, className.
export default function Mascot({size=160,float=true,look=true,className=''}){
 const rm=useReducedMotion(),ref=useRef(null)
 const rx=useMotionValue(0),ry=useMotionValue(0)
 const srx=useSpring(rx,{stiffness:150,damping:18}),sry=useSpring(ry,{stiffness:150,damping:18})
 useEffect(()=>{
  if(!look||rm)return
  const f=e=>{const r=ref.current&&ref.current.getBoundingClientRect();if(!r)return
   const dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2)
   const k=Math.min(1,Math.hypot(dx,dy)/420)
   ry.set(Math.max(-10,Math.min(10,dx/26))*k);rx.set(Math.max(-8,Math.min(8,-dy/32))*k)}
  window.addEventListener('pointermove',f,{passive:true})
  return()=>window.removeEventListener('pointermove',f)},[look,rm,rx,ry])
 const naik=rm||!float?{}:{animate:{y:[0,-11,0]},transition:{duration:4.2,repeat:Infinity,ease:'easeInOut'}}
 return <motion.div ref={ref} className={className}
  style={{width:size,height:size,display:'inline-block',position:'relative',perspective:700}} {...naik}>
  <motion.img src="/maskot.webp" alt="Maskot Artapedia ID" draggable={false}
   style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',rotateX:srx,rotateY:sry,
    filter:'drop-shadow(0 14px 18px rgba(11,27,69,.42))',userSelect:'none',pointerEvents:'none'}}/>
 </motion.div>}
