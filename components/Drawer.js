'use client'
import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {motion,AnimatePresence} from 'framer-motion'
import {X,Gift,Trophy,Users,Wallet,Megaphone,KeyRound,MessageCircle,FileText,LogOut,ChevronRight,Plus,UserRound,Bell,Zap} from 'lucide-react'

// Drawer menu (garis 3 di pojok atas). Menu promo: Cashback, Leaderboard, Referral
// (dulu 3 kartu di beranda dashboard; tombol "Isi saldo" / "Lihat" / "Ajak" tetap berfungsi).
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const row={hidden:{opacity:0,x:24},show:{opacity:1,x:0}}
export default function Drawer({open,onClose,me,promo,go,logout}){
 const [mt,setMt]=useState(false)
 useEffect(()=>setMt(true),[])
 useEffect(()=>{if(!open)return;const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[open,onClose])
 if(!mt)return null
 const b=promo&&promo.bonus,w=promo&&promo.weekly,r=promo&&promo.ref
 const cb=b&&b.on&&b.pct>0,lb=w&&w.on&&(w.prizes||[]).length>0,rf=r&&r.on&&(r.referrer>0||r.referee>0)
 const pick=k=>{onClose();go(k)}
 const PROMO=[
  {k:'cashback',I:Gift,c:'#16c47f',t:cb?(b.boost?'Bonus spesial! ':'')+'Cashback '+b.pct+'% tiap deposit':'Cashback deposit',s:cb?'Min. deposit '+rp(b.minAmt)+' dapat bonus saldo':'Belum aktif',btn:'Isi saldo'},
  {k:'lb',I:Trophy,c:'#ff9a1a',t:lb?'Pembeli terbanyak dapat hadiah!':'Leaderboard',s:lb?'Juara 1 minggu ini dapat '+rp(w.prizes[0]):'Peringkat pembeli teratas',btn:'Lihat'},
  {k:'ref',I:Users,c:'#6366f1',t:rf?'Ajak teman, dapat saldo':'Referral',s:rf?'Kamu '+rp(r.referrer)+', temanmu '+rp(r.referee):'Program belum aktif',btn:'Ajak'}]
 const MENU=[['profil','Profil saya',UserRound],['pay','QRIS Gateway',Zap],['api','API Key & Docs developer',KeyRound],['notif','Notifikasi HP',Bell],['mutasi','Mutasi saldo',Wallet],['ann','Pengumuman',Megaphone],['cs','Customer Service',MessageCircle],['tnc','Syarat & Ketentuan',FileText]]
 return createPortal(<AnimatePresence>{open&&<div className="fx-light" style={{background:'none'}}>
  <motion.div key="bk" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-[500] bg-[#060a1f]/55 backdrop-blur-sm"/>
  <motion.aside key="pn" role="dialog" aria-modal="true" aria-label="Menu"
   initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',stiffness:320,damping:34}}
   drag="x" dragConstraints={{left:0,right:0}} dragElastic={{left:0,right:.5}} onDragEnd={(_,i)=>i.offset.x>90&&onClose()}
   className="fixed bottom-0 right-0 top-0 z-[501] flex w-[88vw] max-w-[380px] flex-col overflow-y-auto rounded-l-[28px] bg-white/95 p-4 shadow-[-30px_0_80px_-20px_rgba(2,6,40,.6)] backdrop-blur-xl">
   <div className="flex items-center gap-3">
    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-white shadow-lift">{(me.name||'?')[0].toUpperCase()}</span>
    <div className="min-w-0 flex-1"><b className="block truncate text-[#14203d]">{me.name}</b><small className="block truncate text-slate-500">{me.email}</small></div>
    <button aria-label="Tutup menu" onClick={onClose} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-0 bg-slate-100 text-slate-600"><X size={20}/></button></div>
   <motion.button whileTap={{scale:.97}} onClick={()=>pick('deposit')} className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-2xl border-0 bg-gradient-to-br from-[#1f2b4d] to-[#3b3f9e] px-4 py-3.5 text-left text-white shadow-lift">
    <span><small className="block text-[12px] opacity-70">Saldo tersedia</small><b className="text-xl">{rp(me.balance)}</b></span>
    <span className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold"><Plus size={16}/>Isi saldo</span></motion.button>
   <motion.div initial="hidden" animate="show" transition={{staggerChildren:.05,delayChildren:.12}} className="mt-5 grid gap-2.5">
    <small className="px-1 text-[12px] font-bold text-slate-500">Promo & hadiah</small>
    {PROMO.map(p=><motion.div key={p.k} variants={row} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
     <button onClick={()=>pick(p.k)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{background:p.c}}><p.I size={22}/></span>
      <span className="min-w-0"><b className="block text-[14.5px] leading-tight text-[#14203d]">{p.t}</b><small className="block text-[12.5px] leading-snug text-slate-500">{p.s}</small></span></button>
     <button onClick={()=>pick(p.k==='cashback'?'deposit':p.k)} className="shrink-0 cursor-pointer rounded-xl border-0 bg-[#14203d] px-3.5 py-2 text-[13px] font-bold text-white">{p.btn}</button></motion.div>)}
    <small className="mt-3 px-1 text-[12px] font-bold text-slate-500">Menu</small>
    {MENU.map(([k,t,I])=><motion.button key={k} variants={row} whileTap={{scale:.98}} onClick={()=>['cs','profil','pay'].includes(k)?(location.href='/'+k):pick(k)} className="flex cursor-pointer items-center gap-3 rounded-2xl border-0 bg-slate-50 px-3.5 py-3 text-left text-[15px] font-semibold text-[#14203d]">
     <I size={20} className="text-slate-500"/><span className="flex-1">{t}</span>
     {k==='cs'&&me.csUnread>0&&<span className="grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{me.csUnread}</span>}<ChevronRight size={18} className="text-slate-400"/></motion.button>)}
    <motion.button variants={row} whileTap={{scale:.98}} onClick={logout} className="mt-1 flex cursor-pointer items-center gap-3 rounded-2xl border-0 bg-red-50 px-3.5 py-3 text-left text-[15px] font-bold text-red-600"><LogOut size={20}/>Keluar</motion.button>
   </motion.div></motion.aside></div>}</AnimatePresence>,document.body)}
