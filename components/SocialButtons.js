'use client'
import {useEffect,useState} from 'react'
import {motion} from 'framer-motion'
import {Send,MessageCircle,Link2,Instagram,Youtube,Facebook} from 'lucide-react'
import Skeleton from './ui/Skeleton'

// Tombol sosial dinamis (diatur admin di /admin/settings/buttons, data dari /api/site-buttons).
// Kalau API gagal dipanggil, jatuh ke env NEXT_PUBLIC_TG_URL / NEXT_PUBLIC_WA_URL.
const ENV=[['Telegram',process.env.NEXT_PUBLIC_TG_URL],['WhatsApp',process.env.NEXT_PUBLIC_WA_URL]].filter(([,u])=>u&&u!=='#').map(([label,url],i)=>({id:'env'+i,label,icon_url:'',url,order:i}))
export function useSiteButtons(){
 const [items,setItems]=useState(null)
 useEffect(()=>{let on=true
  fetch('/api/site-buttons').then(r=>r.json()).then(d=>on&&setItems(Array.isArray(d.items)?d.items:ENV)).catch(()=>on&&setItems(ENV))
  return()=>{on=false}},[])
 return items}

// ikon & warna bawaan kalau admin belum upload logo
export function brandOf(b){
 const k=((b.url||'')+' '+(b.label||'')).toLowerCase()
 if(/t\.me|telegram/.test(k))return {Icon:Send,color:'#229ed9'}
 if(/wa\.me|whatsapp/.test(k))return {Icon:MessageCircle,color:'#25d366'}
 if(/instagram/.test(k))return {Icon:Instagram,color:'#e1306c'}
 if(/youtu/.test(k))return {Icon:Youtube,color:'#ff0033'}
 if(/facebook|fb\.com/.test(k))return {Icon:Facebook,color:'#1877f2'}
 return {Icon:Link2,color:'#6366f1'}}
export const BtnIcon=({b,size=20,box=38})=>{const {Icon,color}=brandOf(b)
 return <span className="grid shrink-0 place-items-center overflow-hidden rounded-xl text-white" style={{width:box,height:box,background:b.icon_url?'#fff':color}}>
  {b.icon_url?<img src={b.icon_url} alt="" loading="lazy" className="h-full w-full object-contain p-1"/>:<Icon size={size}/>}</span>}

// variant: 'light' (kartu putih, dashboard) | 'dark' (kaca gelap, landing)
export default function SocialButtons({items,variant='light',className=''}){
 const own=useSiteButtons(),list=items||own
 if(list===null)return <div className={'grid grid-cols-2 gap-3 '+className}><Skeleton className="h-[62px]"/><Skeleton className="h-[62px]"/></div>
 if(!list.length)return null
 const cls=variant==='dark'?'fx-glass text-white':'bg-white border border-[#e1e8f3] text-[#1b2745] shadow-sm'
 return <div className={'grid grid-cols-2 gap-3 '+className}>
  {list.map((b,i)=><motion.a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer"
   initial={{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:i*.06,type:'spring',stiffness:260,damping:22}}
   whileHover={{y:-3,scale:1.02}} whileTap={{scale:.97}}
   className={`flex min-w-0 items-center gap-3 rounded-2xl px-4 py-3.5 font-bold no-underline [&:last-child:nth-child(odd)]:col-span-2 ${cls}`}>
   <BtnIcon b={b}/><span className="truncate">{b.label}</span></motion.a>)}</div>}
