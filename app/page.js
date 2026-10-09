'use client'
import {useRef,useState} from 'react'
import {motion,useScroll,useTransform,useReducedMotion,AnimatePresence} from 'framer-motion'
import {Zap,Tag,ShieldCheck,Plug,QrCode,MessageCircle,Gift,Users,Menu,X,ArrowRight,BookOpen,Check} from 'lucide-react'
import Mascot from '../components/Mascot'
import Mascot3D from '../components/Mascot3D'
import {Announcements,Leaderboard,useBoard} from '../components/Boards'
import SocialButtons from '../components/SocialButtons'
import Backdrop from '../components/ui/Backdrop'
import GlassButton from '../components/ui/GlassButton'
import AnimatedCard from '../components/ui/AnimatedCard'
import {AnimatedText,CountUp} from '../components/ui/AnimatedText'

const F=[[Zap,'Otomatis','Nomor & kode OTP masuk tanpa nunggu admin','#fbbf24'],[Tag,'Harga murah','Beberapa server, pilih yang paling hemat','#34d399'],[ShieldCheck,'Jaminan OTP','Kode telat? Nomor diganti otomatis atau saldo balik','#60a5fa'],[Plug,'API siap pakai','Sambungkan ke web atau bot kamu','#a78bfa'],[QrCode,'Deposit QRIS','Mulai dari Rp2.000, saldo masuk otomatis','#f472b6'],[MessageCircle,'Customer service','Chat langsung dengan admin saat jam layanan','#38bdf8'],[Gift,'Bonus deposit','Cashback saldo otomatis tiap kamu isi saldo','#fb923c'],[Users,'Ajak teman','Bagikan kode ajakan, kamu dan temanmu dapat saldo','#2dd4bf']]
const S=[['Daftar & masuk','Buat akun gratis pakai email.'],['Isi saldo','Deposit lewat QRIS, minimal Rp2.000.'],['Pilih nomor','Pilih server, aplikasi, negara lalu ORDER.'],['Terima OTP','Kode muncul otomatis di halaman Nokos.']]
const NAV=[['Fitur','#fitur'],['Cara beli','#cara'],['Pengumuman','#info'],['Leaderboard','#info'],['API','/docs']]
const TNC=['Saldo yang sudah masuk tidak dapat ditarik.','Nomor yang tidak menerima OTP otomatis direfund.','Dilarang dipakai untuk tindakan melanggar hukum.','Akun melanggar aturan dapat dibanned.']

function Nav(){
 const [open,setOpen]=useState(false)
 return <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
  <div className="fx-glass mx-auto flex max-w-6xl items-center gap-2 rounded-2xl px-3 py-2 sm:px-4">
   <a href="/" className="mr-auto flex items-center gap-2 font-extrabold text-white no-underline"><Mascot size={34} float={false} look={false}/>Artapedia ID</a>
   <nav className="hidden items-center gap-1 md:flex">{NAV.map(([t,h])=><a key={t} href={h} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 no-underline transition hover:bg-white/10 hover:text-white">{t}</a>)}</nav>
   <GlassButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Masuk</GlassButton>
   <GlassButton href="/register" size="sm">Daftar</GlassButton>
   <button aria-label="Menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-0 bg-white/10 text-white md:hidden">{open?<X size={20}/>:<Menu size={20}/>}</button>
  </div>
  <AnimatePresence>{open&&<motion.div initial={{opacity:0,y:-10,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-10}} className="fx-glass mx-auto mt-2 grid max-w-6xl gap-1 rounded-2xl p-2 md:hidden">
   {[...NAV,['Masuk','/login']].map(([t,h])=><a key={t} href={h} onClick={()=>setOpen(false)} className="rounded-xl px-4 py-3 font-semibold text-slate-200 no-underline hover:bg-white/10">{t}</a>)}</motion.div>}</AnimatePresence></header>}

function Hero(){
 const d=useBoard(),rm=useReducedMotion(),ref=useRef(null)
 const {scrollY}=useScroll()
 const yArt=useTransform(scrollY,[0,600],[0,rm?0:90]),yTxt=useTransform(scrollY,[0,600],[0,rm?0:-40]),op=useTransform(scrollY,[0,500],[1,rm?1:.2])
 const stat=[[d&&d.users,'Pengguna'],[d&&d.orders,'OTP sukses'],[null,'Pesan otomatis']]
 return <section ref={ref} className="relative overflow-hidden px-5 pb-16 pt-32 sm:pt-36">
  <Backdrop tone="dark"/>
  <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
   <motion.div style={{y:yTxt,opacity:op}}>
    <motion.span initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="fx-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-slate-200">
     <i className="relative flex h-2 w-2"><i className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none"/><i className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"/></i>Server aktif, pesanan diproses otomatis</motion.span>
    <h1 className="m-0 mt-5 text-[40px] font-black leading-[1.05] tracking-tight text-white sm:text-6xl">
     <AnimatedText text="Nokos & OTP otomatis," delay={.1}/><br/>
     <AnimatedText text="murah dan cepat." wordClass="fx-text-grad" delay={.45}/></h1>
    <motion.p initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:.9,duration:.6}} className="mb-0 mt-5 max-w-[520px] text-[17px] leading-relaxed text-slate-300">Beli nomor virtual untuk verifikasi WhatsApp, Telegram dan ratusan aplikasi lain. Deposit QRIS instan, refund otomatis kalau kode tidak masuk.</motion.p>
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:1.05,duration:.6}} className="mt-7 flex flex-wrap gap-3">
     <GlassButton href="/register" size="lg" iconRight={ArrowRight}>Mulai sekarang</GlassButton>
     <GlassButton href="#cara" variant="glass" size="lg">Cara beli OTP</GlassButton>
     <GlassButton href="/docs" variant="ghost" size="lg" icon={BookOpen}>API Docs</GlassButton></motion.div>
    <motion.dl initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.3}} className="m-0 mt-9 flex gap-8">
     {stat.map(([v,l])=><div key={l}><dt className="text-[26px] font-extrabold text-white">{v==null?(l==='Pesan otomatis'?'24/7':'–'):<CountUp value={v}/>}</dt><dd className="m-0 text-[13px] text-slate-400">{l}</dd></div>)}</motion.dl>
   </motion.div>
   <motion.div style={{y:yArt}} initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} transition={{duration:.9,delay:.3,ease:[.22,1,.36,1]}} className="order-first lg:order-none"><Mascot3D size={420}/></motion.div>
  </div></section>}

export default function Home(){
 const d=useBoard()
 return <div className="fx-dark relative min-h-screen overflow-x-hidden">
  <Nav/><Hero/>
  <section id="fitur" className="relative mx-auto max-w-6xl px-5 py-16" style={{perspective:1200}}>
   <motion.h2 initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Kenapa Artapedia ID?</motion.h2>
   <p className="mb-8 mt-2 max-w-xl text-slate-400">Semua yang kamu butuh untuk beli nomor OTP, tanpa ribet.</p>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {F.map(([I,t,p,c],i)=><AnimatedCard key={t} delay={(i%4)*.07} className="fx-glass h-full p-5">
     <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{background:c+'26',color:c,boxShadow:`0 0 30px -6px ${c}`}}><I size={24}/></span>
     <b className="mt-4 block text-[17px] text-white">{t}</b><p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-400">{p}</p></AnimatedCard>)}</div></section>
  <section id="cara" className="relative mx-auto max-w-6xl px-5 py-16">
   <h2 className="m-0 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Cara membeli OTP</h2>
   <div className="relative mt-10 grid gap-4 md:grid-cols-4">
    <motion.span aria-hidden initial={{scaleX:0}} whileInView={{scaleX:1}} viewport={{once:true}} transition={{duration:1.2,ease:'easeOut'}} className="absolute left-[12%] right-[12%] top-6 hidden h-px origin-left bg-gradient-to-r from-indigo-400/0 via-indigo-300/60 to-indigo-400/0 md:block"/>
    {S.map(([t,p],i)=><AnimatedCard key={t} tilt={false} delay={i*.1} className="p-1 text-center">
     <span className="relative mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-white shadow-glow">{i+1}</span>
     <b className="mt-4 block text-white">{t}</b><p className="m-0 mt-1 text-sm text-slate-400">{p}</p></AnimatedCard>)}</div></section>
  <section id="info" className="relative mx-auto max-w-6xl px-5 py-16">
   <div className="rounded-[32px] bg-white/95 p-4 text-[#14203d] shadow-glow sm:p-8 fx-light">
    <div className="mb-3 flex items-baseline justify-between"><h2 className="m-0 text-2xl font-extrabold">Pengumuman terbaru</h2><a href="/pengumuman" className="text-sm font-bold text-indigo-600 no-underline">Lihat semua</a></div>
    <Announcements limit={3} dense/>
    <div className="mb-3 mt-10 flex items-baseline justify-between"><h2 className="m-0 text-2xl font-extrabold">Leaderboard</h2><a href="/leaderboard" className="text-sm font-bold text-indigo-600 no-underline">Selengkapnya</a></div>
    <Leaderboard limit={5} data={d}/></div></section>
  <section className="relative mx-auto max-w-3xl px-5 py-10">
   <AnimatedCard tilt={false} className="fx-glass p-6 sm:p-8"><h2 className="m-0 text-xl font-extrabold text-white">Syarat &amp; Ketentuan</h2>
    <ul className="m-0 mt-4 grid list-none gap-2.5 p-0">{TNC.map(t=><li key={t} className="flex gap-2.5 text-[15px] text-slate-300"><Check size={18} className="mt-0.5 shrink-0 text-emerald-400"/>{t}</li>)}</ul></AnimatedCard></section>
  <footer className="relative mx-auto max-w-3xl px-5 pb-12 pt-6 text-center">
   <SocialButtons variant="dark" className="mx-auto max-w-md"/>
   <p className="mt-8 text-[13px] text-slate-500">© Artapedia ID · Penyedia layanan OTP berbasis nomor tanpa kartu fisik</p></footer></div>}
