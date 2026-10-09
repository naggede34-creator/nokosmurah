'use client'
import {useRef} from 'react'
import {motion,useMotionValue,useSpring,useTransform,useReducedMotion} from 'framer-motion'
import Mascot from './Mascot'

// Panggung 3D untuk hero landing & halaman auth: maskot + cincin orbit + chip OTP yang mengorbit.
// Seluruh panggung miring mengikuti kursor (perspective), dan mengambang lewat <Mascot/>.
const CHIPS=[{t:'OTP 937',l:'50%',tp:'0%'},{t:'✅ 2610',l:'96%',tp:'58%'},{t:'🔑 4821',l:'6%',tp:'72%'}]
export default function Mascot3D({size=360,className=''}){
 const ref=useRef(null),rm=useReducedMotion()
 const mx=useMotionValue(0),my=useMotionValue(0),sx=useSpring(mx,{stiffness:110,damping:15}),sy=useSpring(my,{stiffness:110,damping:15})
 const rx=useTransform(sy,[-.5,.5],[14,-14]),ry=useTransform(sx,[-.5,.5],[-18,18])
 const move=e=>{if(rm||e.pointerType==='touch'||!ref.current)return;const r=ref.current.getBoundingClientRect();mx.set((e.clientX-r.left)/r.width-.5);my.set((e.clientY-r.top)/r.height-.5)}
 const leave=()=>{mx.set(0);my.set(0)}
 const spin=(d,rev)=>rm?{}:{animate:{rotate:rev?-360:360},transition:{duration:d,repeat:Infinity,ease:'linear'}}
 return <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={'relative mx-auto '+className} style={{width:size,maxWidth:'100%',aspectRatio:'1 / 1',perspective:1100}}>
  <motion.div className="relative h-full w-full" style={{rotateX:rm?0:rx,rotateY:rm?0:ry,transformStyle:'preserve-3d'}}>
   <div className="absolute inset-[10%] rounded-full bg-gradient-to-br from-indigo-500/50 via-sky-400/30 to-fuchsia-400/20 blur-3xl" style={{transform:'translateZ(-80px)'}}/>
   <motion.div className="absolute inset-[3%] rounded-full border border-white/20" style={{z:-30,rotateX:68}} {...spin(26)}/>
   <motion.div className="absolute inset-[-4%] rounded-full border border-dashed border-white/15" style={{z:-50,rotateX:68}} {...spin(40,true)}/>
   <div className="absolute inset-[14%]" style={{transform:'translateZ(70px)'}}><Mascot size="100%"/></div>
   <motion.div className="absolute inset-0" style={{transform:'translateZ(30px)'}} {...spin(30)}>
    {CHIPS.map(c=><div key={c.t} className="absolute" style={{left:c.l,top:c.tp}}>
     <motion.div style={{x:'-50%',y:'-50%'}} {...spin(30,true)}><div className="fx-glass mono whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] font-bold text-white">{c.t}</div></motion.div></div>)}
   </motion.div>
  </motion.div></div>}
