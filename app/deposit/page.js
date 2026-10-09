'use client'
import {useState,useEffect,useCallback} from 'react'
import {motion,AnimatePresence} from 'framer-motion'
import {ArrowLeft,QrCode,Check,Gift,Clock,Landmark} from 'lucide-react'
import Backdrop from '../../components/ui/Backdrop'
import GlassButton from '../../components/ui/GlassButton'
import Skeleton from '../../components/ui/Skeleton'
import Confetti from '../../components/ui/Confetti'
import {CountUp} from '../../components/ui/AnimatedText'
import {usePromo} from '../../components/Promo'

// Halaman /deposit. Endpoint & aturan bisnis sama dengan tab Deposit lama di dashboard:
// v1/deposit/methods, POST v1/deposit, GET v1/deposit?order_id=, POST v1/deposit/cancel. Min Rp2.000, maks Rp10.000.000.
const api=async(p,body)=>{const r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return r.json()}
const rr=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const K=v=>v>=1000?(v/1000)+'K':String(v)
const CHIPS=[2000,5000,10000,20000,30000,40000,50000]
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')
const ST={completed:'sukses',canceled:'dibatalkan',expired:'kedaluwarsa',failed:'gagal',pending:'menunggu'}
const toMs=v=>{if(v==null)return 0;if(typeof v==='number')return v<1e12?v*1000:v;const t=Date.parse(v);return isNaN(t)?0:t}

function Check3D(){return <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
 <motion.circle cx="48" cy="48" r="42" fill="#10b981" initial={{scale:0}} animate={{scale:1}} transition={{type:'spring',stiffness:260,damping:16}}/>
 <motion.path d="M28 49l14 14 27-30" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" initial={{pathLength:0}} animate={{pathLength:1}} transition={{delay:.25,duration:.5,ease:'easeOut'}}/></svg>}

export default function Deposit(){
 const promo=usePromo()
 const [me,setMe]=useState(),[methods,setMethods]=useState(null),[prov,setProv]=useState(''),[amt,setAmt]=useState('10000'),[dep,setDep]=useState(null),[list,setList]=useState(null)
 const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(null),[now,setNow]=useState(Date.now()),[qrOk,setQrOk]=useState(false),[span,setSpan]=useState(1)
 const loadMe=useCallback(async()=>{try{const m=await api('v1/me');if(m.error){location.href='/login';return}setMe(m)}catch(e){}},[])
 const loadList=useCallback(async()=>{try{setList((await api('v1/deposit')).items||[])}catch(e){setList([])}},[])
 useEffect(()=>{loadMe();loadList()
  api('v1/deposit/methods').then(d=>{const a=Array.isArray(d.methods)?d.methods:[];setMethods(a);setProv(a[0]&&a[0].provider||'')}).catch(()=>setMethods([]))},[loadMe,loadList])
 useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(''),4500);return()=>clearTimeout(t)},[msg])
 useEffect(()=>{if(!dep)return;setQrOk(false);setSpan(Math.max(1,Math.floor((toMs(dep.expired_at)-Date.now())/1000)||1));const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[dep&&dep.order_id])
 // polling status pembayaran tiap 5 detik
 useEffect(()=>{if(!dep)return;const cur=dep
  const t=setInterval(async()=>{let d;try{d=await api('v1/deposit?order_id='+cur.order_id)}catch(e){return}
   if(d.status&&d.status!=='pending'){setDep(null);loadMe();loadList()
    if(d.status==='completed')setDone({amount:cur.amount,balance:d.balance});else setMsg('Deposit '+(ST[d.status]||d.status))}},5000)
  return()=>clearInterval(t)},[dep,loadMe,loadList])

 const an=Math.floor(+amt||0),valid=an>=2000&&an<=10000000
 const b=promo&&promo.bonus,bonus=b&&b.on&&b.pct>0&&valid&&an>=b.minAmt?Math.min(Math.floor(an*b.pct/100),b.max>0?b.max:1e12):0
 const mkDep=async()=>{setBusy(true);let d;try{d=await api('v1/deposit',{amount:an,provider:prov})}catch(e){d={error:'Gagal terhubung ke server'}};setBusy(false)
  if(d.error)setMsg(d.error);else{setDep({...d,amount:an});loadList()}}
 const cancelDep=async id=>{if(!confirm('Batalkan deposit ini?'))return;const d=await api('v1/deposit/cancel',{order_id:id})
  if(d.error)setMsg(d.error);else{setMsg('Deposit dibatalkan');if(dep&&dep.order_id===id)setDep(null)}loadMe();loadList()}
 const ex=dep?toMs(dep.expired_at):0,rem=ex?Math.max(0,Math.floor((ex-now)/1000)):null

 return <main className="fx-light relative min-h-screen overflow-x-hidden">
  <Backdrop tone="light" particles={10}/>
  <div className="relative z-10 mx-auto max-w-[480px] px-4 pb-64 pt-4">
   <header className="flex items-center gap-3">
    <motion.a whileTap={{scale:.9}} href="/dashboard" aria-label="Kembali ke dashboard" className="fx-glass-l grid h-11 w-11 place-items-center rounded-2xl text-[#14203d] no-underline"><ArrowLeft size={20}/></motion.a>
    <h1 className="m-0 flex-1 text-xl font-extrabold tracking-tight">Isi saldo</h1>
    {me===undefined?<Skeleton className="h-10 w-28"/>:me&&<motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} className="fx-glass-l rounded-2xl px-3.5 py-2 text-right"><small className="block text-[11px] leading-none text-slate-500">Saldo</small><b className="mono text-[15px]">{rr(me.balance)}</b></motion.div>}
   </header>

   <AnimatePresence>{msg&&<motion.div key="m" initial={{opacity:0,y:-12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} role="status" className="fixed inset-x-4 top-4 z-[300] mx-auto max-w-[448px] rounded-2xl bg-[#14203d] px-4 py-3 text-center text-sm font-bold text-white shadow-lg">{msg}</motion.div>}</AnimatePresence>

   <AnimatePresence mode="wait" initial={false}>
   {!dep?<motion.div key="form" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} transition={{duration:.3}}>
    {/* 1. metode pembayaran */}
    <h2 className="mb-2.5 mt-6 text-[15px] font-extrabold text-slate-600">1. Metode pembayaran</h2>
    <div className="grid gap-3" style={{perspective:900}}>
     {methods===null&&<><Skeleton className="h-[78px]"/><Skeleton className="h-[78px]"/></>}
     {methods&&methods.length===0&&<div className="fx-glass-l rounded-2xl p-4 text-sm text-slate-600">Metode pembayaran belum tersedia. Coba lagi beberapa saat.</div>}
     {methods&&methods.map((m,i)=>{const sel=prov===m.provider
      return <motion.button key={m.provider} type="button" onClick={()=>setProv(m.provider)} aria-pressed={sel}
       initial={{opacity:0,y:18}} animate={{opacity:1,y:sel?-4:0,scale:sel?1.025:1}} transition={{delay:i*.07,type:'spring',stiffness:300,damping:22}}
       whileHover={{y:-5}} whileTap={{scale:.97}}
       className="relative flex cursor-pointer items-center gap-3.5 rounded-2xl border border-[#dbe5f7] bg-white p-4 text-left" style={{transformStyle:'preserve-3d'}}>
       {sel&&<motion.span layoutId="mring" className="pointer-events-none absolute inset-0 rounded-2xl" style={{boxShadow:'0 0 0 2px #6366f1,0 22px 40px -16px rgba(79,70,229,.6)'}} transition={{type:'spring',stiffness:380,damping:30}}/>}
       <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift" style={{transform:'translateZ(24px)'}}>{/qris/i.test(m.provider+(m.name||''))?<QrCode size={24}/>:<Landmark size={24}/>}</span>
       <span className="min-w-0 flex-1"><b className="block text-[16px] text-[#14203d]">{m.name||m.label||String(m.provider).toUpperCase()}</b><small className="block text-[13px] text-slate-500">{m.description||'QRIS otomatis, saldo masuk sendiri'}</small></span>
       <AnimatePresence>{sel&&<motion.span initial={{scale:0,rotate:-90}} animate={{scale:1,rotate:0}} exit={{scale:0}} className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-white"><Check size={16}/></motion.span>}</AnimatePresence>
      </motion.button>})}
    </div>

    {/* 2. nominal */}
    <h2 className="mb-2.5 mt-7 text-[15px] font-extrabold text-slate-600">2. Nominal deposit</h2>
    <div className="fx-glass-l rounded-3xl p-4">
     <div className="fx-scroll-x -mx-1 flex gap-2 px-1 pb-1">
      {CHIPS.map((v,i)=><motion.button key={v} type="button" onClick={()=>setAmt(String(v))} initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}} transition={{delay:.1+i*.04,type:'spring',stiffness:400,damping:20}} whileTap={{scale:.92}} whileHover={{y:-2}}
       className={`relative shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[14px] font-extrabold ${an===v?'border-transparent text-white':'border-[#dbe5f7] bg-white text-[#14203d]'}`}>
       {an===v&&<motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-lift" transition={{type:'spring',stiffness:420,damping:30}}/>}
       <span className="relative">{K(v)}</span></motion.button>)}</div>
     <div className="relative mt-3"><span className="mono pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">Rp</span>
      <input inputMode="numeric" aria-label="Nominal deposit" placeholder="Atau ketik nominal" className="fx-in-l mono" style={{paddingLeft:'52px'}} value={amt?(+amt).toLocaleString('id-ID'):''} onChange={e=>setAmt(e.target.value.replace(/\D/g,'').slice(0,8))}/></div>
     <p className={`m-0 mt-2 text-[13px] ${amt&&!valid?'font-bold text-red-500':'text-slate-500'}`}>{amt&&!valid?'Nominal harus Rp2.000 - Rp10.000.000':'Minimal Rp2.000 · maksimal Rp10.000.000'}</p>
     <AnimatePresence>
      {b&&b.on&&b.pct>0&&<motion.div key={bonus>0?'on':'off'} initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-bold ${bonus>0?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}><Gift size={18}/>{bonus>0?`Kamu dapat bonus +${rr(bonus)} (${b.pct}%)`:`Deposit minimal ${rr(b.minAmt)} dapat bonus saldo ${b.pct}%`}</div></motion.div>}
     </AnimatePresence>
    </div>

    {/* riwayat */}
    {(list===null||list.length>0)&&<>
     <h2 className="mb-2.5 mt-7 text-[15px] font-extrabold text-slate-600">Riwayat deposit</h2>
     <div className="grid gap-2.5">
      {list===null&&<Skeleton className="h-16"/>}
      {list&&list.map((x,i)=><motion.div key={x.order_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.04}} className="flex items-center gap-3 rounded-2xl border border-[#e2e8f4] bg-white/80 p-3.5">
       <div className="min-w-0 flex-1"><b className="mono block text-[15px]">{rr(x.amount)}</b><small className="text-slate-500">{new Date(x.createdAt).toLocaleString('id-ID')}</small></div>
       {x.status==='pending'?<div className="flex gap-2"><button type="button" onClick={()=>setDep(x)} className="cursor-pointer rounded-xl border-0 bg-indigo-50 px-3 py-2 text-[13px] font-bold text-indigo-700">Lihat QR</button><button type="button" onClick={()=>cancelDep(x.order_id)} className="cursor-pointer rounded-xl border-0 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-600">Batalkan</button></div>
       :<span className={`rounded-full px-3 py-1 text-xs font-bold ${x.status==='completed'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{ST[x.status]||x.status}</span>}</motion.div>)}</div></>}
   </motion.div>

   :<motion.div key="pay" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20}} transition={{duration:.35}} className="mt-6">
    <div className="fx-glass-l rounded-[28px] p-5 text-center">
     <small className="text-slate-500">Bayar tepat</small>
     <div className="mono text-[34px] font-extrabold tracking-tight">{rr(dep.total_amount)}</div>
     {dep.admin_fee>0&&<small className="text-slate-500">termasuk biaya layanan {rr(dep.admin_fee)}</small>}
     <div className="relative mx-auto mt-4 grid h-[260px] w-[260px] place-items-center rounded-3xl bg-white p-3 shadow-lift" style={{perspective:800}}>
      {!qrOk&&<Skeleton className="absolute inset-3"/>}
      <motion.img alt="Kode QRIS" width="240" height="240" initial={{opacity:0,rotateY:-60}} animate={{opacity:qrOk?1:0,rotateY:qrOk?0:-60}} transition={{duration:.6,ease:[.22,1,.36,1]}} onLoad={()=>setQrOk(true)}
       src={dep.qr_image||'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(dep.qr_string)}/></div>
     {rem!==null&&<div className="mx-auto mt-4 max-w-[260px]"><div className="mb-1.5 flex items-center justify-between text-[13px] text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock size={15}/>Batas bayar</span><b className="mono text-[#14203d]">{fmt(rem)}</b></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><motion.i className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400" animate={{width:Math.min(100,rem/span*100)+'%'}} transition={{duration:1,ease:'linear'}}/></div></div>}
     <p className="mb-0 mt-4 flex items-center justify-center gap-2 text-[13.5px] text-slate-500"><span className="relative flex h-2.5 w-2.5"><i className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none"/><i className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500"/></span>Menunggu pembayaran. Saldo masuk otomatis.</p>
    </div>
    <div className="mt-4 grid gap-3"><GlassButton variant="danger" block onClick={()=>cancelDep(dep.order_id)}>Batalkan deposit</GlassButton><GlassButton variant="light" block onClick={()=>setDep(null)}>Kembali</GlassButton></div>
   </motion.div>}
   </AnimatePresence>
  </div>

  {/* kartu total bayar (sticky) */}
  <AnimatePresence>{!dep&&<motion.div key="tot" initial={{y:140,opacity:0}} animate={{y:0,opacity:1}} exit={{y:140,opacity:0}} transition={{type:'spring',stiffness:260,damping:26,delay:.25}} className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
   <div className="fx-glass-l mx-auto max-w-[480px] rounded-[26px] p-4">
    <div className="mb-3 flex items-end justify-between gap-3">
     <div><small className="text-slate-500">Total bayar</small><div className="mono text-[28px] font-extrabold leading-tight tracking-tight"><CountUp value={valid?an:0} duration={.5} format={v=>'Rp'+Math.round(v).toLocaleString('id-ID')}/></div></div>
     <AnimatePresence>{bonus>0&&<motion.span key="bn" initial={{opacity:0,scale:.6,y:8}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:.6}} className="mb-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">+{rr(bonus)} bonus</motion.span>}</AnimatePresence></div>
    <GlassButton block size="lg" icon={QrCode} loading={busy} disabled={!valid||!prov} onClick={mkDep}>Buat QRIS</GlassButton>
    <p className="m-0 mt-2 text-center text-[12px] text-slate-500">Biaya layanan (jika ada) ditampilkan di halaman pembayaran.</p>
   </div></motion.div>}</AnimatePresence>

  {/* sukses */}
  <AnimatePresence>{done&&<motion.div key="ok" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[500] grid place-items-center bg-[#060a1f]/60 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Deposit berhasil">
   <Confetti/>
   <motion.div initial={{scale:.8,y:40,rotateX:25}} animate={{scale:1,y:0,rotateX:0}} transition={{type:'spring',stiffness:240,damping:20}} style={{transformPerspective:900}} className="fx-glass-l w-full max-w-[380px] rounded-[30px] p-7 text-center">
    <div className="mx-auto w-fit"><Check3D/></div>
    <h2 className="m-0 mt-4 text-2xl font-extrabold">Deposit berhasil</h2>
    <div className="mono mt-1 text-[30px] font-extrabold text-emerald-600">+{rr(done.amount)}</div>
    {done.balance!=null&&<p className="mb-0 mt-1 text-slate-500">Saldo sekarang <b className="mono text-[#14203d]"><CountUp value={done.balance} format={v=>'Rp'+Math.round(v).toLocaleString('id-ID')}/></b></p>}
    <div className="mt-6 grid gap-3"><GlassButton href="/dashboard" block>Ke dashboard</GlassButton><GlassButton variant="light" block onClick={()=>setDone(null)}>Isi saldo lagi</GlassButton></div>
   </motion.div></motion.div>}</AnimatePresence>
 </main>}
