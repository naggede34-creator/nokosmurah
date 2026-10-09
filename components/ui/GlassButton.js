'use client'
import {motion,useReducedMotion} from 'framer-motion'
import {Loader2} from 'lucide-react'

// Tombol reusable: primary (biru + kilau shimmer) / silver / glass / light / ghost / danger / sun. Warna ikut tema (token --fx-*).
// Pakai `href` untuk link, tanpa href jadi <button>.
const V={
 primary:'text-white bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 shadow-lift border border-white/20 fx-shine',
 sun:'text-[#3b1d00] bg-gradient-to-br from-amber-300 to-orange-400 border border-white/40 shadow-lift fx-shine',
 silver:'fx-btn-silver',
 glass:'fx-glass fx-t1',
 light:'text-[#14203d] bg-white border border-[#dbe5f7] shadow-sm',
 ghost:'fx-btn-ghost',
 danger:'text-white bg-gradient-to-br from-rose-500 to-red-600 border border-white/20'}
const S={sm:'h-10 px-4 text-sm',md:'h-12 px-5 text-[15px]',lg:'h-14 px-7 text-base'}

export default function GlassButton({href,variant='primary',size='md',loading=false,disabled=false,icon:Icon,iconRight:IconR,block=false,className='',children,...p}){
 const rm=useReducedMotion(),off=disabled||loading,Comp=href?motion.a:motion.button
 const extra=href?{href}:{type:p.type||'button',disabled:off}
 return <Comp
  {...extra} {...p}
  whileHover={off||rm?undefined:{y:-2,scale:1.03}}
  whileTap={off||rm?undefined:{scale:.97}}
  transition={{type:'spring',stiffness:420,damping:22}}
  aria-busy={loading||undefined}
  className={`relative inline-flex items-center justify-center gap-2 rounded-2xl font-bold select-none no-underline transition-opacity ${off?'opacity-55 cursor-not-allowed':'cursor-pointer'} ${block?'w-full':''} ${V[variant]||V.primary} ${S[size]} ${className}`}>
  {loading?<Loader2 size={18} className="animate-spin"/>:Icon&&<Icon size={18}/>}
  <span>{children}</span>{IconR&&!loading&&<IconR size={18}/>}
 </Comp>}
