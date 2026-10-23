'use client'
import {useState,useEffect,useRef,useCallback} from 'react'
// Live transaksi: log gaya terminal, dari yang paling lama (atas) sampai yang terbaru (bawah).
// Data dari /api/v1/live (nama disensor, tanpa nomor & kode OTP). Diperbarui tiap 4 detik.
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const hms=t=>new Date(t).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}).replace(/\./g,':')
const day=t=>new Date(t).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'})
const CHIP={proses:'Proses',sukses:'Sukses · OTP diterima',batal:'Batal'}
const FIL=[['semua','Semua'],['proses','Proses'],['sukses','Sukses'],['batal','Batal']]
function Clock(){const [t,setT]=useState(0);useEffect(()=>{setT(Date.now());const i=setInterval(()=>setT(Date.now()),1000);return()=>clearInterval(i)},[]);return <time>{t?hms(t)+' WIB':'--:--:--'}</time>}
export default function Live(){
 const [items,setItems]=useState(null),[add,setAdd]=useState({trx:0,proses:0,sukses:0}),[err,setErr]=useState(false),[f,setF]=useState('semua'),[fresh,setFresh]=useState({}),[pinned,setPinned]=useState(true),[sfx,setSfx]=useState(0)
 const seen=useRef(null),box=useRef(null),pin=useRef(true),first=useRef(true)
 const toBottom=useCallback((smooth)=>{const e=box.current;if(e)e.scrollTo({top:e.scrollHeight,behavior:smooth?'smooth':'auto'})},[])
 const load=useCallback(async()=>{
  try{
   const r=await fetch('/api/v1/live',{cache:'no-store'})
   if(r.status===401||r.status===403){location.href='/login';return}
   const d=await r.json();if(d.error||!Array.isArray(d.items))throw new Error('x')
   const prev=seen.current,fr={};let hit=false
   if(prev)for(const x of d.items){const o=prev.get(x.k);if(!o){fr[x.k]='new';if(x.st==='sukses')hit=true}else if(o!==x.st){fr[x.k]='chg';if(x.st==='sukses')hit=true}}
   seen.current=new Map(d.items.map(x=>[x.k,x.st]))
   setItems(d.items);setAdd(d.add||{trx:0,proses:0,sukses:0});setErr(false)
   if(Object.keys(fr).length){setFresh(fr);setTimeout(()=>setFresh({}),2600)}
   if(hit)setSfx(Date.now())
  }catch(e){setErr(true)}},[])
 useEffect(()=>{load();const i=setInterval(()=>{if(!document.hidden)load()},4000);const v=()=>{if(!document.hidden)load()};document.addEventListener('visibilitychange',v);return()=>{clearInterval(i);document.removeEventListener('visibilitychange',v)}},[load])
 useEffect(()=>{if(!sfx)return;const t=setTimeout(()=>setSfx(0),1900);return()=>clearTimeout(t)},[sfx])
 // tetap di baris terbaru selama pengguna belum menggulir ke atas
 useEffect(()=>{if(!items)return;if(first.current){first.current=false;toBottom(false);return}if(pin.current)toBottom(true)},[items,f,toBottom])
 const onScroll=e=>{const el=e.currentTarget,ok=el.scrollHeight-el.scrollTop-el.clientHeight<48;pin.current=ok;setPinned(ok)}
 const all=items||[],cnt={proses:0,sukses:0,batal:0};all.forEach(x=>cnt[x.st]++)
 const list=f==='semua'?all:all.filter(x=>x.st===f)
 let lastDay=''
 return <div className="app lv"><div className="shell">
  <header className="lv-top">
   <a className="lv-back" href="/dashboard" aria-label="Kembali ke dashboard"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7"/></svg></a>
   <div className="lv-title"><h1>Live Transaksi</h1><p>Pembelian nokos terbaru</p></div>
   <span className="lv-live" aria-label="Tersambung langsung"><i/>LIVE</span></header>
  <div className="lv-stats">
   <div className="lv-stat"><small>Transaksi</small><b>{all.length+(+add.trx||0)}</b></div>
   <div className="lv-stat p"><small>Proses</small><b>{cnt.proses+(+add.proses||0)}</b></div>
   <div className="lv-stat s"><small>Sukses</small><b>{cnt.sukses+(+add.sukses||0)}</b></div></div>
  <div className="lv-fil" role="group" aria-label="Filter status">{FIL.map(([k,t])=><button key={k} type="button" aria-pressed={f===k} className={f===k?'on':''} onClick={()=>{setF(k);pin.current=true}}>{t}</button>)}</div>
  <div className="lv-stage">
   <section className="lv-term" aria-label="Log transaksi langsung">
    <div className="lv-bar"><span className="lv-dots" aria-hidden="true"><i/><i/><i/></span><b>artapedia — live</b><Clock/></div>
    <div className="lv-screen" ref={box} onScroll={onScroll} role="log" aria-live="off">
     <p className="lv-c">$ tail -f transaksi.log</p>
     <p className="lv-c">{'# nama disensor · nomor dan kode OTP tidak ditampilkan'}</p>
     {err&&<p className="lv-e">{'! koneksi terputus, mencoba lagi…'}</p>}
     {!items&&!err&&<p className="lv-c">{'# memuat log…'}</p>}
     {items&&!list.length&&<p className="lv-c">{f==='semua'?'# belum ada transaksi. Log muncul di sini begitu ada yang membeli.':'# tidak ada transaksi dengan status ini.'}</p>}
     {list.map(x=>{const d=day(x.at),sep=d!==lastDay;lastDay=d
      return <div key={x.k}>
       {sep&&<p className="lv-day"><span>{d}</span></p>}
       <div className={'lv-ln '+x.st+(fresh[x.k]?' '+fresh[x.k]:'')}>
        <span className="lv-n">{x.n}</span>
        <span className="lv-b"><i/>{CHIP[x.st]}</span>
        <span className="lv-s">{x.s}{x.c&&<em> · {x.c}</em>}</span>
        <span className="lv-p">{rp(x.p)}</span>
        <span className="lv-pp" aria-hidden="true"><u className="on">Order</u><u className={x.st==='proses'?'run':x.st==='batal'?'bad':'on'}>Proses</u><u className={x.st==='sukses'?'on':x.st==='batal'?'off':''}>OTP</u></span>
        <span className="lv-t">{hms(x.at)}</span>
       </div></div>})}
     <p className="lv-c lv-pr">$ <span className="lv-cur"/></p></div>
    {!pinned&&<button type="button" className="lv-down" onClick={()=>{pin.current=true;setPinned(true);toBottom(true)}}>↓ Terbaru</button>}
    {sfx>0&&<div className="lv-toast" key={sfx} role="status"><i/>OTP baru diterima</div>}
   </section></div>
  <p className="lv-note">Urut dari yang paling lama ke yang terbaru. Pembaruan otomatis tiap 4 detik.</p>
 </div></div>}
