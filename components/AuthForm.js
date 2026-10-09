'use client'
import {useState,useEffect} from 'react'
import {motion,AnimatePresence,useReducedMotion} from 'framer-motion'
import {Mail,Lock,User,Gift,Eye,EyeOff,ArrowRight,ArrowLeft,ShieldCheck,Zap,QrCode} from 'lucide-react'
import Backdrop from './ui/Backdrop'
import GlassButton from './ui/GlassButton'
import Mascot3D from './Mascot3D'
import Mascot from './Mascot'
import {useSiteButtons} from './SocialButtons'

// Satu form untuk /login dan /register (+ lupa password). Logika & endpoint sama persis dengan versi lama.
const api=(p,b)=>fetch('/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json())
const ENV_TG=process.env.NEXT_PUBLIC_TG_URL||'#'
const COPY={
 login:{h:'Masuk ke Artapedia ID',p:'Masuk dulu untuk membeli nomor dan memakai layanan.',btn:'Masuk',sw:'Belum punya akun? Daftar'},
 register:{h:'Buat akun gratis',p:'Daftar 30 detik, deposit mulai Rp2.000.',btn:'Daftar',sw:'Sudah punya akun? Masuk'},
 forgot:{h:'Lupa password',p:'Masukkan email akunmu, kami kirim link untuk membuat password baru.',btn:'Kirim link reset',sw:'Kembali masuk'}}
const PTS=[[Zap,'OTP masuk otomatis, tanpa menunggu admin'],[QrCode,'Deposit QRIS, saldo masuk sendiri'],[ShieldCheck,'Kode tidak datang? Saldo kembali otomatis']]

function Field({icon:Icon,type='text',right,...p}){
 const [on,setOn]=useState(false),rm=useReducedMotion()
 return <motion.div className="relative" animate={rm?undefined:{scale:on?1.015:1}} transition={{type:'spring',stiffness:380,damping:24}}>
  <motion.span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" animate={{color:on?'#9db8ff':'rgba(226,232,255,.5)',x:on?2:0}}><Icon size={18}/></motion.span>
  <input {...p} type={type} className="fx-in" onFocus={()=>setOn(true)} onBlur={()=>setOn(false)}/>
  {right&&<span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>}</motion.div>}

const strength=p=>{let s=0;if(p.length>=6)s++;if(p.length>=10)s++;if(/[A-Z]/.test(p)&&/[a-z]/.test(p))s++;if(/\d/.test(p)&&/[^A-Za-z0-9]/.test(p))s++;return s}

export default function AuthForm({initialMode='login'}){
 const [m,setM]=useState(initialMode),[f,setF]=useState({}),[err,setErr]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false),[show,setShow]=useState(false)
 const sb=useSiteButtons(),tg=((sb||[]).find(b=>/t\.me|telegram/i.test((b.url||'')+(b.label||'')))||{}).url||ENV_TG
 useEffect(()=>{
  const q=new URLSearchParams(location.search),r=(q.get('ref')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12)
  if(r){setM('register');setF(x=>({...x,ref:r}))}
  fetch('/api/v1/me').then(r=>r.json()).then(d=>{if(!d.error)location.href='/dashboard'}).catch(()=>{})},[])
 const set=k=>e=>setF(x=>({...x,[k]:e.target.value}))
 const go=async()=>{setBusy(true);setErr('');setOk('')
  const d=await api(m==='forgot'?'auth/forgot':'auth/'+m,f).catch(()=>({error:'Gagal terhubung ke server'}));setBusy(false)
  if(d.error)setErr(d.error);else if(m==='forgot')setOk(d.msg||'Link reset dikirim.');else location.href='/dashboard'}
 const sw=x=>{setM(x);setErr('');setOk('');if(x!=='forgot'&&typeof history!=='undefined')history.replaceState(null,'',(x==='register'?'/register':'/login')+location.search)}
 const c=COPY[m],st=strength(f.password||'')
 return <main className="fx-dark relative min-h-screen overflow-x-hidden">
  <Backdrop tone="dark"/>
  <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-5 py-8 lg:grid-cols-2 lg:gap-12">
   {/* sisi kiri: maskot 3D (desktop) */}
   <motion.section initial={{opacity:0,x:-30}} animate={{opacity:1,x:0}} transition={{duration:.8,ease:[.22,1,.36,1]}} className="hidden lg:block">
    <a href="/" className="mb-8 inline-flex items-center gap-2 text-lg font-extrabold text-white no-underline"><Mascot size={36} float={false} look={false}/>Artapedia ID</a>
    <h1 className="m-0 text-[44px] font-black leading-[1.08] tracking-tight text-white">Nomor OTP murah,<br/><span className="fx-text-grad">masuk dalam hitungan detik.</span></h1>
    <ul className="mt-6 grid list-none gap-3 p-0">{PTS.map(([I,t])=><li key={t} className="flex items-center gap-3 text-[15px] text-slate-300"><span className="fx-glass grid h-9 w-9 place-items-center rounded-xl text-sky-300"><I size={18}/></span>{t}</li>)}</ul>
    <div className="mt-6"><Mascot3D size={340}/></div>
   </motion.section>
   {/* sisi kanan: kartu kaca */}
   <section className="mx-auto w-full max-w-[440px]">
    <div className="mb-4 flex justify-center lg:hidden"><Mascot size={120}/></div>
    <motion.div initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.7,ease:[.22,1,.36,1]}} className="fx-glass relative rounded-[28px] p-6 sm:p-8">
     <AnimatePresence mode="wait" initial={false}>
      <motion.form key={m} onSubmit={e=>{e.preventDefault();if(!busy)go()}} noValidate
       initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-24}} transition={{duration:.25}}>
       <h2 className="m-0 text-[26px] font-extrabold tracking-tight text-white">{c.h}</h2>
       <p className="mb-5 mt-1.5 text-[14.5px] leading-relaxed text-slate-300">{c.p}</p>
       <div className="grid gap-3">
        {m==='register'&&<Field icon={User} placeholder="Nama" autoComplete="name" value={f.name||''} onChange={set('name')}/>}
        <Field icon={Mail} type="email" placeholder="Email" autoComplete="email" inputMode="email" value={f.email||''} onChange={set('email')}/>
        {m!=='forgot'&&<Field icon={Lock} type={show?'text':'password'} placeholder="Password (min 6 karakter)" autoComplete={m==='login'?'current-password':'new-password'} value={f.password||''} onChange={set('password')}
          right={<button type="button" aria-label={show?'Sembunyikan password':'Tampilkan password'} onClick={()=>setShow(s=>!s)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-slate-300 hover:bg-white/10">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>}/>}
        {m==='register'&&<>
         <div className="flex gap-1.5 px-1" aria-hidden>{[0,1,2,3].map(i=><motion.i key={i} className="h-1.5 flex-1 rounded-full" animate={{backgroundColor:i<st?['#f87171','#fbbf24','#34d399','#34d399'][st-1]:'rgba(255,255,255,.12)'}}/>)}</div>
         <Field icon={Gift} placeholder="Kode ajakan teman (opsional)" value={f.ref||''} onChange={e=>setF(x=>({...x,ref:e.target.value.toUpperCase()}))}/></>}
       </div>
       <AnimatePresence>
        {err&&<motion.p key="e" role="alert" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="mb-0 mt-3 overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm font-bold text-red-200">{err}</motion.p>}
        {ok&&<motion.p key="o" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="mb-0 mt-3 overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-200"><b>{ok}</b><br/><span className="text-[13px] text-slate-300">Email tidak masuk? <a href={tg} className="text-sky-300 underline">Hubungi admin</a> untuk minta link reset manual.</span></motion.p>}
       </AnimatePresence>
       <GlassButton type="submit" size="lg" block loading={busy} iconRight={ArrowRight} className="mt-5">{busy?'Memproses...':c.btn}</GlassButton>
       <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={()=>sw(m==='register'?'login':m==='login'?'register':'login')} className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-bold text-sky-300 hover:text-white">{m==='forgot'&&<ArrowLeft size={15}/>}{c.sw}</button>
        {m==='login'&&<button type="button" onClick={()=>sw('forgot')} className="cursor-pointer border-0 bg-transparent p-0 text-slate-400 underline hover:text-white">Lupa password?</button>}
       </div>
      </motion.form>
     </AnimatePresence>
    </motion.div>
    <p className="mt-5 text-center text-xs text-slate-400"><a href="/" className="text-slate-300 no-underline hover:text-white">← Kembali ke beranda</a></p>
   </section>
  </div></main>}
