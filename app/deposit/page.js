'use client'
import {useState,useEffect,useCallback} from 'react'
import {motion,AnimatePresence} from 'framer-motion'
import {ArrowLeft,QrCode,Check,Gift,Clock,Landmark,Copy,ShieldCheck,Zap} from 'lucide-react'
import Backdrop from '../../components/ui/Backdrop'
import GlassButton from '../../components/ui/GlassButton'
import Skeleton from '../../components/ui/Skeleton'
import Struk from '../../components/Struk'
import Confetti from '../../components/ui/Confetti'
import {CountUp} from '../../components/ui/AnimatedText'
import {usePromo} from '../../components/Promo'
import Toast from '../../components/ui/Toast'

// Halaman /deposit. Endpoint & aturan bisnis sama dengan tab Deposit lama di dashboard:
// v1/deposit/methods, POST v1/deposit, GET v1/deposit?order_id=, POST v1/deposit/cancel.
// Metode (QRIS / Virtual Account) & batas nominal datang dari server (diatur admin > Deposit). Rute gateway di belakang QRIS diacak server, tidak terlihat di sini.
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
 const [struk,setStruk]=useState(null)
 const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(null),[now,setNow]=useState(Date.now()),[qrOk,setQrOk]=useState(false),[span,setSpan]=useState(1)
 const loadMe=useCallback(async()=>{try{const m=await api('v1/me');if(m.error){location.href='/login';return}setMe(m)}catch(e){}},[])
 const loadList=useCallback(async()=>{try{setList((await api('v1/deposit')).items||[])}catch(e){setList([])}},[])
 useEffect(()=>{loadMe();loadList()
  api('v1/deposit/methods').then(d=>{const a=Array.isArray(d.methods)?d.methods:[];setMethods(a);setProv(a[0]&&a[0].provider||'')}).catch(()=>setMethods([]))},[loadMe,loadList])
 useEffect(()=>{if(!dep)return;setQrOk(false);setSpan(Math.max(1,Math.floor((toMs(dep.expired_at)-Date.now())/1000)||1));const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[dep&&dep.order_id])
 // polling status pembayaran tiap 5 detik
 useEffect(()=>{if(!dep)return;const cur=dep
  const t=setInterval(async()=>{let d;try{d=await api('v1/deposit?order_id='+cur.order_id)}catch(e){return}
   if(d.status&&d.status!=='pending'){setDep(null);loadMe();loadList()
    if(d.status==='completed')setDone({amount:cur.amount,balance:d.balance,id:cur.order_id,order_id:cur.order_id,method_name:cur.method_name,bonus:(d.bonus||0),status:'completed',createdAt:cur.createdAt});else setMsg('Deposit '+(ST[d.status]||d.status))}},5000)
  return()=>clearInterval(t)},[dep,loadMe,loadList])

 const sm=methods&&methods.find(m=>m.provider===prov),MIN=(sm&&sm.min)||2000,MAX=(sm&&sm.max)||10000000,isVA=!!sm&&sm.type==='va'
 const an=Math.floor(+amt||0),valid=an>=MIN&&an<=MAX
 const b=promo&&promo.bonus,bonus=b&&b.on&&b.pct>0&&valid&&an>=b.minAmt?Math.min(Math.floor(an*b.pct/100),b.max>0?b.max:1e12):0
 const copy=(t,m)=>{try{navigator.clipboard.writeText(t);setMsg(m)}catch(e){setMsg(String(t))}}
 const mkDep=async()=>{setBusy(true);let d;try{d=await api('v1/deposit',{amount:an,provider:prov})}catch(e){d={error:'Gagal terhubung ke server'}};setBusy(false)
  if(d.error)setMsg(d.error);else{setDep({...d,amount:an});loadList()}}
 const cancelDep=async id=>{if(!confirm('Batalkan deposit ini?'))return;const d=await api('v1/deposit/cancel',{order_id:id})
  if(d.error)setMsg(d.error);else{setMsg('Deposit dibatalkan');if(dep&&dep.order_id===id)setDep(null)}loadMe();loadList()}
 const ex=dep?toMs(dep.expired_at):0,rem=ex?Math.max(0,Math.floor((ex-now)/1000)):null

 return <main className="fx-light cxd relative min-h-screen overflow-x-hidden">
  <Backdrop tone="light" particles={10}/>
  <div className="relative z-10 mx-auto max-w-[480px] px-4 pb-64 pt-4">
   <header className="flex items-center gap-3">
    <motion.a whileTap={{scale:.9}} href="/dashboard" aria-label="Kembali ke dashboard" className="fx-glass-l grid h-11 w-11 place-items-center rounded-2xl text-[#14203d] no-underline"><ArrowLeft size={20}/></motion.a>
    <h1 className="cxd-t m-0 flex-1">ISI SALDO!</h1>
    {me===undefined?<Skeleton className="h-10 w-28"/>:me&&<motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}} className="fx-glass-l rounded-2xl px-3.5 py-2 text-right"><small className="block text-[11px] leading-none text-slate-500">Saldo</small><b className="mono text-[15px]">{rr(me.balance)}</b></motion.div>}
   </header>

   <Toast msg={msg} onClose={()=>setMsg('')} ms={4500}/>

   <AnimatePresence mode="wait" initial={false}>
   {!dep?<motion.div key="form" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} transition={{duration:.3}}>
    {/* 1. metode pembayaran */}
    <h2 className="cxd-h">1. Metode pembayaran</h2>
    <div className="grid gap-3" style={{perspective:900}}>
     {methods===null&&<><Skeleton className="h-[78px]"/><Skeleton className="h-[78px]"/></>}
     {methods&&methods.length===0&&<div className="fx-glass-l rounded-2xl p-4 text-sm text-slate-600">Metode pembayaran belum tersedia. Coba lagi beberapa saat.</div>}
     {methods&&methods.filter(m=>m.type!=='va').map((m,i)=>{const sel=prov===m.provider
      return <motion.button key={m.provider} type="button" onClick={()=>setProv(m.provider)} aria-pressed={sel}
       initial={{opacity:0,y:18}} animate={{opacity:1,y:sel?-4:0,scale:sel?1.025:1}} transition={{delay:i*.07,type:'spring',stiffness:300,damping:22}}
       whileHover={{y:-5}} whileTap={{scale:.97}}
       className="relative flex cursor-pointer items-center gap-3.5 rounded-2xl border border-[#dbe5f7] bg-white p-4 text-left" style={{transformStyle:'preserve-3d'}}>
       {sel&&<motion.span layoutId="mring" className="pointer-events-none absolute inset-0 rounded-2xl" style={{boxShadow:'0 0 0 2px #6366f1,0 22px 40px -16px rgba(79,70,229,.6)'}} transition={{type:'spring',stiffness:380,damping:30}}/>}
       <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift" style={{transform:'translateZ(24px)'}}><QrCode size={24}/></span>
       <span className="min-w-0 flex-1"><b className="flex items-center gap-2 text-[16px] text-[#14203d]">{m.name}<em className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold not-italic text-emerald-700"><Zap size={11} className="mr-0.5 inline"/>Otomatis</em></b><small className="block text-[13px] text-slate-500">{m.description}</small></span>
       <AnimatePresence>{sel&&<motion.span initial={{scale:0,rotate:-90}} animate={{scale:1,rotate:0}} exit={{scale:0}} className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-white"><Check size={16}/></motion.span>}</AnimatePresence>
      </motion.button>})}
     {methods&&methods.some(m=>m.type==='va')&&<div>
      <p className="m-0 mb-2 mt-1 flex items-center gap-1.5 text-[13px] font-bold text-slate-500"><Landmark size={15}/>Virtual Account bank</p>
      <div className="grid grid-cols-2 gap-2.5">{methods.filter(m=>m.type==='va').map(m=>{const sel=prov===m.provider
       return <motion.button key={m.provider} type="button" onClick={()=>setProv(m.provider)} aria-pressed={sel} whileTap={{scale:.96}} whileHover={{y:-2}}
        className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-3 text-left text-[14px] font-extrabold ${sel?'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_0_0_2px_#6366f1]':'border-[#dbe5f7] bg-white text-[#14203d]'}`}>
        <Landmark size={18} className="shrink-0"/><span className="min-w-0 flex-1 leading-tight">{m.name}</span>{sel&&<Check size={16} className="shrink-0"/>}</motion.button>})}</div></div>}
    </div>

    {/* 2. nominal */}
    <h2 className="cxd-h">2. Nominal deposit</h2>
    <div className="fx-glass-l rounded-3xl p-4">
     <div className="fx-scroll-x -mx-1 flex gap-2 px-1 pb-1">
      {CHIPS.filter(v=>v>=MIN&&v<=MAX).map((v,i)=><motion.button key={v} type="button" onClick={()=>setAmt(String(v))} initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}} transition={{delay:.1+i*.04,type:'spring',stiffness:400,damping:20}} whileTap={{scale:.92}} whileHover={{y:-2}}
       className={`relative shrink-0 cursor-pointer rounded-full border px-4 py-2 text-[14px] font-extrabold ${an===v?'border-transparent text-white':'border-[#dbe5f7] bg-white text-[#14203d]'}`}>
       {an===v&&<motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-lift" transition={{type:'spring',stiffness:420,damping:30}}/>}
       <span className="relative">{K(v)}</span></motion.button>)}</div>
     <div className="relative mt-3"><span className="mono pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">Rp</span>
      <input inputMode="numeric" aria-label="Nominal deposit" placeholder="Atau ketik nominal" className="fx-in-l fx-pl mono" value={amt?(+amt).toLocaleString('id-ID'):''} onChange={e=>setAmt(e.target.value.replace(/\D/g,'').slice(0,8))}/></div>
     <p className={`m-0 mt-2 text-[13px] ${amt&&!valid?'font-bold text-red-500':'text-slate-500'}`}>{amt&&!valid?`Nominal harus ${rr(MIN)} - ${rr(MAX)}`:`Minimal ${rr(MIN)} · maksimal ${rr(MAX)}`}</p>
     <AnimatePresence>
      {b&&b.on&&b.pct>0&&<motion.div key={bonus>0?'on':'off'} initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="overflow-hidden"><div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-bold ${bonus>0?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600'}`}><Gift size={18}/>{bonus>0?`Kamu dapat bonus +${rr(bonus)} (${b.pct}%)`:`Deposit minimal ${rr(b.minAmt)} dapat bonus saldo ${b.pct}%`}</div></motion.div>}
     </AnimatePresence>
    </div>

    {/* riwayat */}
    {(list===null||list.length>0)&&<>
     <h2 className="cxd-h">Riwayat deposit</h2>
     <div className="grid gap-2.5">
      {list===null&&<Skeleton className="h-16"/>}
      {list&&list.map((x,i)=><motion.div key={x.order_id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.04}} className="flex items-center gap-3 rounded-2xl border border-[#e2e8f4] bg-white/80 p-3.5">
       <div className="min-w-0 flex-1"><b className="mono block text-[15px]">{rr(x.amount)}</b><small className="text-slate-500">{x.method_name||'QRIS'} · {new Date(x.createdAt).toLocaleString('id-ID')}</small><br/><span className="cxd-ids mono">ID {x.order_id}</span></div>
       {x.status==='pending'?<div className="flex gap-2"><button type="button" onClick={()=>setDep(x)} className="cursor-pointer rounded-xl border-0 bg-indigo-50 px-3 py-2 text-[13px] font-bold text-indigo-700">{x.va_number?'Lihat VA':'Lihat QR'}</button><button type="button" onClick={()=>cancelDep(x.order_id)} className="cursor-pointer rounded-xl border-0 bg-red-50 px-3 py-2 text-[13px] font-bold text-red-600">Batalkan</button></div>
       :<div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${x.status==='completed'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{ST[x.status]||x.status}</span>
        {x.status==='completed'&&<button type="button" onClick={()=>setStruk(x)} className="cursor-pointer rounded-xl border-0 bg-indigo-50 px-3 py-2 text-[13px] font-bold text-indigo-700">🧾</button>}</div>}</motion.div>)}</div></>}
   </motion.div>

   :<motion.div key="pay" initial={{opacity:0,y:30,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-20}} transition={{duration:.35}} className="mt-6">
    <div className="fx-glass-l rounded-[28px] p-5 text-center">
     <small className="text-slate-500">Bayar tepat</small>
     <div className="mono cxd-amt tracking-tight">{rr(dep.total_amount)}</div>
     {dep.admin_fee>0&&<small className="text-slate-500">termasuk biaya layanan {rr(dep.admin_fee)}</small>}
     <div className="cxd-id"><div className="min-w-0 flex-1"><small>ID DEPOSIT</small><b className="mono">{dep.order_id}</b></div><button type="button" aria-label="Salin ID deposit" onClick={()=>copy(dep.order_id,'ID deposit disalin')}><Copy size={16}/></button></div>
     {dep.va_number?<div className="mx-auto mt-4 max-w-[320px] rounded-3xl border border-indigo-100 bg-white p-4 text-left shadow-lift">
       <small className="flex items-center gap-1.5 text-slate-500"><Landmark size={15}/>{dep.method_name||'Virtual Account'}</small>
       <div className="mono mt-1 break-all text-[26px] font-extrabold tracking-wider text-[#14203d]">{dep.va_number}</div>
       <button type="button" onClick={()=>{try{navigator.clipboard.writeText(dep.va_number);setMsg('Nomor VA disalin')}catch(e){setMsg(dep.va_number)}}} className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border-0 bg-indigo-50 px-4 py-2.5 text-[14px] font-bold text-indigo-700"><Copy size={16}/>Salin nomor VA</button>
       <p className="m-0 mt-3 text-[12.5px] text-slate-500">Transfer sesuai nominal di atas lewat m-banking / ATM. Jangan dibulatkan.</p></div>
     :<div className="relative mx-auto mt-4 grid h-[260px] w-[260px] place-items-center rounded-3xl bg-white p-3 shadow-lift cxd-qr" style={{perspective:800}}>
      {!qrOk&&<Skeleton className="absolute inset-3"/>}
      <motion.img alt="Kode QRIS" width="240" height="240" initial={{opacity:0,rotateY:-60}} animate={{opacity:qrOk?1:0,rotateY:qrOk?0:-60}} transition={{duration:.6,ease:[.22,1,.36,1]}} onLoad={()=>setQrOk(true)}
       src={dep.qr_image||'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(dep.qr_string)}/></div>}
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
    <GlassButton block size="lg" icon={isVA?Landmark:QrCode} loading={busy} disabled={!valid||!prov} onClick={mkDep}>{isVA?'Buat Virtual Account':'Buat QRIS'}</GlassButton>
    <p className="m-0 mt-2 flex items-center justify-center gap-1.5 text-center text-[12px] text-slate-500"><ShieldCheck size={14}/>Saldo masuk otomatis · biaya layanan (jika ada) tampil di halaman bayar</p>
   </div></motion.div>}</AnimatePresence>

  {/* sukses */}
  {struk&&<Struk item={struk} kind="deposit" onClose={()=>setStruk(null)} onMsg={setMsg}/>}
  <AnimatePresence>{done&&<motion.div key="ok" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[500] grid place-items-center bg-[#060a1f]/60 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Deposit berhasil">
   <Confetti/>
   <motion.div initial={{scale:.8,y:40,rotateX:25}} animate={{scale:1,y:0,rotateX:0}} transition={{type:'spring',stiffness:240,damping:20}} style={{transformPerspective:900}} className="fx-glass-l w-full max-w-[380px] rounded-[30px] p-7 text-center">
    <div className="mx-auto w-fit"><Check3D/></div>
    <h2 className="cxd-t m-0 mt-4">DEPOSIT BERHASIL!</h2>
    <div className="mono mt-1 text-[30px] font-extrabold text-emerald-600">+{rr(done.amount)}</div>
    {done.balance!=null&&<p className="mb-0 mt-1 text-slate-500">Saldo sekarang <b className="mono text-[#14203d]"><CountUp value={done.balance} format={v=>'Rp'+Math.round(v).toLocaleString('id-ID')}/></b></p>}
    {done.id&&<div className="cxd-id"><div className="min-w-0 flex-1"><small>ID DEPOSIT</small><b className="mono">{done.id}</b></div><button type="button" aria-label="Salin ID deposit" onClick={()=>copy(done.id,'ID deposit disalin')}><Copy size={16}/></button></div>}
    <div className="mt-6 grid gap-3"><GlassButton block onClick={()=>setStruk(done)}>🧾 Bagikan struk</GlassButton><GlassButton href="/dashboard" variant="light" block>Ke dashboard</GlassButton><GlassButton variant="light" block onClick={()=>setDone(null)}>Isi saldo lagi</GlassButton></div>
   </motion.div></motion.div>}</AnimatePresence>
 </main>}
