'use client'
import {useState,useEffect} from 'react'
import './botrs.css'
// Halaman publik: semua bot reseller resmi Arta Pedia + Telegram CS masing-masing toko.
const MODE={komisi:'💸 Tanpa modal',mandiri:'📦 Stok mandiri'}
export default function BotReseller(){
 const [items,setItems]=useState(null),[q,setQ]=useState(''),[err,setErr]=useState('')
 useEffect(()=>{fetch('/api/bot-reseller').then(r=>r.json()).then(d=>{if(d.error)setErr(d.error);else setItems(d.items||[])}).catch(()=>setErr('Gagal memuat daftar bot. Coba lagi sebentar.'))},[])
 const s=q.trim().toLowerCase()
 const list=(items||[]).filter(x=>!s||[x.brand,x.bot,x.cs].some(v=>String(v||'').toLowerCase().includes(s)))
 return <div className="brs">
  <div className="brs-top"><a href="/dashboard">‹ Dashboard</a></div>
  <section className="brs-hero">
   <span className="brs-chip">🤖 RESMI ARTA PEDIA</span>
   <h1>Daftar Bot Reseller</h1>
   <p>Ini adalah <b>semua list reseller bot nokos Arta Pedia</b>. Kalian bisa membeli nokos juga lewat bot-bot ini semua.</p>
   {items&&<div className="brs-count"><b>{items.length}</b> bot aktif</div>}</section>

  <div className="brs-warn" role="note">
   <span className="brs-wi">⚠️</span>
   <div><b>Penting, baca dulu</b>
    <p>Jika salah satu bot ini ada yang melakukan <b>penipuan</b>, silakan chat <b>Customer Service Arta Pedia</b>. Ingat, ini <b>hanya bot reseller Arta Pedia</b>. Jika ada apa-apa, laporkan ke <b>Customer Service Arta Pedia resmi</b> ya.</p>
    <a className="brs-btn rep" href="/cs">💬 Lapor ke CS Arta Pedia resmi</a></div></div>

  {items&&items.length>0&&<input className="brs-q" placeholder="🔍 Cari nama toko / username bot…" value={q} onChange={e=>setQ(e.target.value)}/>}

  {err&&<div className="brs-empty">{err}</div>}
  {!items&&!err&&<div className="brs-grid">{[0,1,2,3].map(i=><div key={i} className="brs-card sk"/>)}</div>}
  {items&&!items.length&&<div className="brs-empty">Belum ada bot reseller yang aktif.</div>}
  {items&&items.length>0&&!list.length&&<div className="brs-empty">Tidak ada bot yang cocok dengan pencarianmu.</div>}
  <div className="brs-grid">{list.map((x,i)=><div key={x.bot} className="brs-card" style={{animationDelay:Math.min(i,12)*.05+'s'}}>
   <div className="brs-ava">🤖</div>
   <div className="brs-info">
    <b className="brs-name">{x.brand}</b>
    <span className="brs-tag">{MODE[x.mode]||MODE.komisi}</span>
    <div className="brs-row"><small>Bot</small><span>@{x.bot}</span></div>
    <div className="brs-row"><small>Tele CS</small><span>{x.cs?'@'+x.cs:'-'}</span></div></div>
   <div className="brs-acts">
    <a className="brs-btn go" href={'https://t.me/'+x.bot} target="_blank" rel="noopener noreferrer">🛒 Buka bot</a>
    {x.cs&&<a className="brs-btn cs" href={'https://t.me/'+x.cs} target="_blank" rel="noopener noreferrer">💬 Chat CS</a>}</div></div>)}</div>
 </div>}
