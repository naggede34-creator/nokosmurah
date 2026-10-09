'use client'
import {useEffect,useState} from 'react'
import {motion,animate,useMotionValue,useReducedMotion} from 'framer-motion'

// Teks muncul per kata (mask reveal). wordClass dipasang di tiap kata (mis. 'fx-text-grad').
export function AnimatedText({text,className='',wordClass='',delay=0}){
 const rm=useReducedMotion(),words=String(text).split(' ')
 return <span className={className} aria-label={text}>{words.map((w,i)=>
  <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom pb-[.08em]">
   <motion.span className={'inline-block '+wordClass} initial={rm?false:{y:'115%'}} animate={{y:0}} transition={{duration:.75,delay:delay+i*.07,ease:[.22,1,.36,1]}}>{w}{i<words.length-1?'\u00a0':''}</motion.span>
  </span>)}</span>}

// Angka menghitung naik. format() boleh diganti (mis. rupiah).
export function CountUp({value,format=v=>Math.round(v).toLocaleString('id-ID'),duration=.9,className=''}){
 const mv=useMotionValue(0),[t,setT]=useState(()=>format(0))
 useEffect(()=>{const u=mv.on('change',v=>setT(format(v)));const c=animate(mv,+value||0,{duration,ease:'easeOut'});return()=>{c.stop();u()}},[value])// eslint-disable-line
 return <span className={className}>{t}</span>}
