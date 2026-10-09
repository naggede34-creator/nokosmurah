'use client'
import {useRef} from 'react'
import {motion,useMotionValue,useSpring,useTransform,useMotionTemplate,useReducedMotion} from 'framer-motion'

// Kartu reusable: scroll-reveal + 3D tilt mengikuti kursor + kilau cahaya.
// tilt={false} / reveal={false} untuk mematikan. Otomatis diam jika "reduce motion" aktif.
export default function AnimatedCard({children,className='',tilt=true,reveal=true,glow=true,delay=0,depth=28,...p}){
 const ref=useRef(null),rm=useReducedMotion(),on=tilt&&!rm
 const px=useMotionValue(.5),py=useMotionValue(.5)
 const sx=useSpring(px,{stiffness:220,damping:22}),sy=useSpring(py,{stiffness:220,damping:22})
 const rx=useTransform(sy,[0,1],[9,-9]),ry=useTransform(sx,[0,1],[-11,11])
 const gx=useTransform(sx,v=>v*100+'%'),gy=useTransform(sy,v=>v*100+'%')
 const shine=useMotionTemplate`radial-gradient(240px circle at ${gx} ${gy},var(--fx-shine,rgba(255,255,255,.2)),transparent 62%)`
 const move=e=>{if(!on||e.pointerType==='touch'||!ref.current)return;const r=ref.current.getBoundingClientRect();px.set((e.clientX-r.left)/r.width);py.set((e.clientY-r.top)/r.height)}
 const leave=()=>{px.set(.5);py.set(.5)}
 return <motion.div ref={ref}
  initial={reveal&&!rm?{opacity:0,y:34,scale:.96}:false}
  whileInView={reveal&&!rm?{opacity:1,y:0,scale:1}:undefined}
  viewport={{once:true,margin:'-50px'}}
  transition={{duration:.6,delay,ease:[.22,1,.36,1]}}
  style={{rotateX:on?rx:0,rotateY:on?ry:0,transformPerspective:900,transformStyle:'preserve-3d'}}
  onPointerMove={move} onPointerLeave={leave}
  className={`group relative rounded-3xl ${className}`} {...p}>
  {glow&&on&&<motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{background:shine}}/>}
  <div className="relative" style={{transform:on?`translateZ(${depth}px)`:undefined}}>{children}</div>
 </motion.div>}
