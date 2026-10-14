'use client'
import {useState} from 'react'
import {motion,useScroll,useTransform,useReducedMotion,AnimatePresence} from 'framer-motion'
import {Zap,Tag,ShieldCheck,Plug,QrCode,MessageCircle,Gift,Users,Menu,X,ArrowRight,BookOpen,Check,Server,Landmark,Rocket} from 'lucide-react'
import Mascot from '../components/Mascot'
import Mascot3D from '../components/Mascot3D'
import {Announcements,Leaderboard,useBoard} from '../components/Boards'
import SocialButtons from '../components/SocialButtons'
import ThemeToggle from '../components/ThemeToggle'
import Backdrop from '../components/ui/Backdrop'
import GlassButton from '../components/ui/GlassButton'
import AnimatedCard from '../components/ui/AnimatedCard'
import {AnimatedText,CountUp} from '../components/ui/AnimatedText'

const F=[[Zap,'Otomatis','Nomor & kode OTP masuk tanpa nunggu admin'],[Tag,'Harga murah','Beberapa server, pilih yang paling hemat'],[ShieldCheck,'Jaminan OTP','Kode telat? Nomor diganti otomatis atau saldo balik'],[Plug,'API siap pakai','Sambungkan ke web atau bot kamu'],[QrCode,'Deposit QRIS','Mulai dari Rp2.000, saldo masuk otomatis'],[MessageCircle,'Customer service','Chat langsung dengan admin saat jam layanan'],[Gift,'Bonus deposit','Cashback saldo otomatis tiap kamu isi saldo'],[Users,'Ajak teman','Bagikan kode ajakan, kamu dan temanmu dapat saldo']]
const S=[['Daftar & masuk','Buat akun gratis pakai email.'],['Isi saldo','Deposit lewat QRIS, minimal Rp2.000.'],['Pilih nomor','Pilih server, aplikasi, negara lalu ORDER.'],['Terima OTP','Kode muncul otomatis di halaman Nokos.']]
const NAV=[['Fitur','#fitur'],['Server','#server'],['Deposit','#deposit'],['Cara beli','#cara'],['Pengumuman','#info'],['Leaderboard','#info'],['API','/docs']]
const APPS=['WhatsApp','Telegram','Google','Facebook','Instagram','TikTok','Shopee','Tokopedia','Gojek','Grab','Discord','Line','Twitter / X','DANA','OVO','Tinder']
const SRV=[['Server Plus','Utama','Jalur utama, stok melimpah & rate sukses tertinggi.'],['Server Express','Global','Cadangan saat stok server utama kosong.'],['JasaOTP 1','Pilih operator','Pilih Telkomsel, Indosat, dll atau acak.'],['JasaOTP 2','Banyak varian','Beberapa varian harga, pilih yang pas.'],['JasaOTP 3','Simpel','Satu harga per layanan, langsung order.'],['JasaOTP 4','Global','Banyak negara & varian harga.'],['JasaOTP 5','Multi provider','Varian dari banyak provider.']]
const BANK=['BRI','BNI','CIMB Niaga','Permata','Maybank','Bank Neo Commerce','Artha Graha','Sahabat Sampoerna']
const TNC=['Saldo yang sudah masuk tidak dapat ditarik.','Nomor yang tidak menerima OTP otomatis direfund.','Dilarang dipakai untuk tindakan melanggar hukum.','Akun melanggar aturan dapat dibanned.']

function Nav(){
 const [open,setOpen]=useState(false)
 return <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
  <div className="fx-glass mx-auto flex max-w-6xl items-center gap-2 rounded-2xl px-3 py-2 sm:px-4">
   <a href="/" className="fx-t1 mr-auto flex items-center gap-2 whitespace-nowrap font-extrabold no-underline"><Mascot size={34} float={false} look={false}/><span className="cxl-bt">Artapedia ID</span></a>
   <nav className="hidden items-center gap-1 md:flex">{NAV.map(([t,h])=><a key={t} href={h} className="fx-link rounded-xl px-3 py-2 text-sm font-semibold no-underline">{t}</a>)}</nav>
   <ThemeToggle className="ml-1"/>
   <GlassButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Masuk</GlassButton>
   <GlassButton href="/register" size="sm">Daftar</GlassButton>
   <button aria-label="Menu" aria-expanded={open} onClick={()=>setOpen(o=>!o)} className="fx-icon fx-t1 grid h-10 w-10 cursor-pointer place-items-center rounded-xl md:hidden">{open?<X size={20}/>:<Menu size={20}/>}</button>
  </div>
  <AnimatePresence>{open&&<motion.div initial={{opacity:0,y:-10,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-10}} className="fx-glass mx-auto mt-2 grid max-w-6xl gap-1 rounded-2xl p-2 md:hidden">
   {[...NAV,['Masuk','/login']].map(([t,h])=><a key={t} href={h} onClick={()=>setOpen(false)} className="fx-link rounded-xl px-4 py-3 font-semibold no-underline">{t}</a>)}</motion.div>}</AnimatePresence></header>}

function Hero(){
 const d=useBoard(),rm=useReducedMotion()
 const {scrollY}=useScroll()
 const yArt=useTransform(scrollY,[0,600],[0,rm?0:90]),yTxt=useTransform(scrollY,[0,600],[0,rm?0:-40]),op=useTransform(scrollY,[0,500],[1,rm?1:.25])
 // Angka Pengguna & OTP sukses bisa diatur admin (Admin > Beranda). Kosong di admin = angka asli.
 const stat=[[d&&d.users,'Pengguna'],[d&&d.orders,'OTP sukses'],['24/7','Pesan diproses otomatis']]
 return <section className="relative overflow-hidden px-5 pb-14 pt-32 sm:pt-36">
  <Backdrop/>
  <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
   <motion.div style={{y:yTxt,opacity:op}}>
    <motion.span initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="fx-glass fx-t2 cxl-live inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold">
     <i className="relative flex h-2 w-2"><i className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" style={{background:'var(--fx-blue2)'}}/><i className="relative inline-flex h-2 w-2 rounded-full" style={{background:'var(--fx-blue)'}}/></i>Server aktif, pesanan diproses otomatis</motion.span>
    <h1 className="cxl-h1 fx-t1 m-0 mt-5 text-[40px] font-black leading-[1.05] tracking-tight sm:text-6xl">
     <AnimatedText text="Nokos & OTP otomatis," delay={.1}/><br/>
     <AnimatedText text="murah dan cepat." wordClass="fx-text-grad" delay={.45}/></h1>
    <motion.p initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:.9,duration:.6}} className="fx-t2 mb-0 mt-5 max-w-[520px] text-[17px] leading-relaxed">Beli nomor virtual untuk verifikasi WhatsApp, Telegram dan ratusan aplikasi lain. Deposit QRIS instan, refund otomatis kalau kode tidak masuk.</motion.p>
    <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:1.05,duration:.6}} className="mt-7 flex flex-wrap gap-3">
     <GlassButton href="/register" size="lg" iconRight={ArrowRight}>Mulai sekarang</GlassButton>
     <GlassButton href="#cara" variant="silver" size="lg">Cara beli OTP</GlassButton>
     <GlassButton href="/docs" variant="ghost" size="lg" icon={BookOpen}>API Docs</GlassButton></motion.div>
    <motion.dl initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:1.3}} className="fx-metal m-0 mt-9 grid max-w-[540px] grid-cols-3 overflow-hidden rounded-2xl">
     {stat.map(([v,l],i)=><div key={l} className={'px-4 py-3.5 sm:px-5 '+(i?'fx-divl':'')}>
      <dt className="fx-t1 text-[26px] font-extrabold tabular-nums sm:text-[30px]">{typeof v==='string'?v:v==null?'–':<CountUp value={v}/>}</dt>
      <dd className="fx-t2 m-0 text-[12.5px] leading-snug">{l}</dd></div>)}</motion.dl>
   </motion.div>
   <motion.div style={{y:yArt}} initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} transition={{duration:.9,delay:.3,ease:[.22,1,.36,1]}} className="cxl-art order-first lg:order-none"><span className="cxl-burst b1">POW!</span><span className="cxl-bub">Halo! Mau nomor OTP murah?</span><Mascot3D size={420}/><span className="cxl-burst b2">24/7</span></motion.div>
  </div></section>}

export default function Home(){
 const d=useBoard()
 return <div className="fx-theme cxl relative min-h-screen overflow-x-hidden">
  <Nav/><Hero/>
  <div className="cxl-strip" aria-label="Aplikasi yang didukung"><div className="cxl-strip-in" aria-hidden>{[...APPS,...APPS,...APPS].map((a,i)=><span key={i}>★ {a}</span>)}</div></div>
  <section id="fitur" className="relative mx-auto max-w-6xl px-5 py-16" style={{perspective:1200}}>
   <motion.h2 initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} className="cxl-sh fx-t1 m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">Kenapa Artapedia ID?</motion.h2>
   <p className="fx-t2 mb-8 mt-2 max-w-xl">Semua yang kamu butuh untuk beli nomor OTP, tanpa ribet.</p>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {F.map(([I,t,p],i)=><AnimatedCard key={t} delay={(i%4)*.07} className="fx-glass cxl-pan h-full p-5">
     <span className="cxl-no">{i+1}</span><span className="fx-icon grid h-12 w-12 place-items-center rounded-2xl"><I size={24}/></span>
     <b className="fx-t1 mt-4 block text-[17px]">{t}</b><p className="fx-t2 m-0 mt-1.5 text-sm leading-relaxed">{p}</p></AnimatedCard>)}</div></section>
  <section id="server" className="relative mx-auto max-w-6xl px-5 py-16">
   <h2 className="cxl-sh fx-t1 m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">7 Server nokos</h2>
   <p className="fx-t2 mb-8 mt-2 max-w-xl">Banyak pilihan server dan harga, bandingkan lalu pilih yang paling hemat.</p>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {SRV.map(([n,b,d],i)=><AnimatedCard key={n} delay={(i%3)*.07} className="fx-glass cxl-pan cxl-sv h-full p-5">
     <div className="flex items-center gap-3"><span className="fx-icon grid h-12 w-12 place-items-center rounded-2xl"><Server size={22}/></span><div><b className="fx-t1 block text-[18px]">{n}</b><em className="cxl-tag">{b}</em></div></div>
     <p className="fx-t2 m-0 mt-3 text-sm leading-relaxed">{d}</p></AnimatedCard>)}
    <AnimatedCard delay={.2} className="fx-glass cxl-pan cxl-sv h-full p-5 sm:col-span-2 lg:col-span-1"><b className="fx-t1 block text-[18px]">Jaminan OTP 🛡️</b><p className="fx-t2 m-0 mt-2 text-sm leading-relaxed">Kode telat? Nomor diganti otomatis. Tetap gagal, saldo kembali penuh. Berlaku di semua server.</p></AnimatedCard></div></section>
  <section id="deposit" className="relative mx-auto max-w-6xl px-5 py-16">
   <h2 className="cxl-sh fx-t1 m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">Isi saldo, mudah banget</h2>
   <p className="fx-t2 mb-8 mt-2 max-w-xl">Pilih QRIS atau Virtual Account bank. Saldo masuk otomatis, ada ID Deposit di setiap transaksi.</p>
   <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
    <AnimatedCard className="fx-glass cxl-pan h-full p-6"><span className="fx-icon grid h-14 w-14 place-items-center rounded-2xl"><QrCode size={28}/></span>
     <b className="fx-t1 mt-4 block text-[22px]">QRIS</b><p className="fx-t2 m-0 mt-1.5 text-sm leading-relaxed">Bayar pakai e-wallet atau m-banking apa saja. Mulai Rp2.000, rute pembayaran dipilih otomatis dan pindah sendiri kalau ada gangguan.</p>
     <span className="cxl-tag mt-4 inline-block">+ Cashback tiap deposit</span></AnimatedCard>
    <AnimatedCard className="fx-glass cxl-pan h-full p-6"><span className="fx-icon grid h-14 w-14 place-items-center rounded-2xl"><Landmark size={28}/></span>
     <b className="fx-t1 mt-4 block text-[22px]">Virtual Account</b><p className="fx-t2 m-0 mt-1.5 text-sm leading-relaxed">Transfer lewat ATM / m-banking. Mulai Rp10.000.</p>
     <div className="mt-4 flex flex-wrap gap-2">{BANK.map(b=><span key={b} className="cxl-chip">{b}</span>)}</div></AnimatedCard></div></section>
  <section id="cara" className="relative mx-auto max-w-6xl px-5 py-16">
   <h2 className="cxl-sh fx-t1 m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">Cara membeli OTP</h2>
   <div className="relative mt-10 grid gap-4 md:grid-cols-4">
    <motion.span aria-hidden initial={{scaleX:0}} whileInView={{scaleX:1}} viewport={{once:true}} transition={{duration:1.2,ease:'easeOut'}} className="fx-rule absolute left-[12%] right-[12%] top-6 hidden h-px origin-left md:block"/>
    {S.map(([t,p],i)=><AnimatedCard key={t} tilt={false} delay={i*.1} className="cxl-pan fx-glass p-5 text-center">
     <span className="cxl-step relative mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-white shadow-glow">{i+1}</span>
     <b className="fx-t1 mt-4 block">{t}</b><p className="fx-t2 m-0 mt-1 text-sm">{p}</p></AnimatedCard>)}</div></section>
  <section id="info" className="relative mx-auto max-w-6xl px-5 py-16">
   <div className="fx-glass rounded-[32px] p-4 sm:p-8">
    <div className="mb-3 flex items-baseline justify-between"><h2 className="fx-t1 m-0 text-2xl font-extrabold">Pengumuman terbaru</h2><a href="/pengumuman" className="fx-a text-sm">Lihat semua</a></div>
    <Announcements limit={3} dense/>
    <div className="mb-3 mt-10 flex items-baseline justify-between"><h2 className="fx-t1 m-0 text-2xl font-extrabold">Leaderboard global</h2><a href="/leaderboard" className="fx-a text-sm">Selengkapnya</a></div>
    <Leaderboard limit={5} data={d}/></div></section>
  <section className="relative mx-auto max-w-4xl px-5 py-10">
   <div className="cxl-cta"><span className="cxl-burst b3">GRATIS!</span><h2>SIAP BELI OTP?</h2><p>Daftar 30 detik, deposit mulai Rp2.000, nomor langsung jalan.</p><GlassButton href="/register" size="lg" icon={Rocket}>Daftar sekarang</GlassButton></div></section>
  <section className="relative mx-auto max-w-3xl px-5 py-10">
   <AnimatedCard tilt={false} className="fx-glass p-6 sm:p-8"><h2 className="fx-t1 m-0 text-xl font-extrabold">Syarat &amp; Ketentuan</h2>
    <ul className="m-0 mt-4 grid list-none gap-2.5 p-0">{TNC.map(t=><li key={t} className="fx-t2 flex gap-2.5 text-[15px]"><Check size={18} className="mt-0.5 shrink-0" style={{color:'var(--fx-blue)'}}/>{t}</li>)}</ul></AnimatedCard></section>
  <footer className="relative mx-auto max-w-3xl px-5 pb-12 pt-6 text-center">
   <SocialButtons variant="theme" className="mx-auto max-w-md"/>
   <div className="mt-6 flex justify-center"><ThemeToggle/></div>
   <p className="fx-t3 mt-6 text-[13px]">© Artapedia ID · Penyedia layanan OTP berbasis nomor tanpa kartu fisik</p></footer></div>}
