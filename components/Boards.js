'use client'
import {useState,useEffect} from 'react'
const get=p=>fetch('/api/'+p).then(r=>r.json()).catch(()=>({}))
export const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
export const mask=e=>{e=String(e||'');const [a,d]=e.split('@');if(!d)return a?a.slice(0,2)+'***':'***';return a.slice(0,Math.min(2,a.length))+'***'+(a.length>3?a.slice(-1):'')+'@'+d}
export const tgl=t=>new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'
export function useBoard(){const [d,setD]=useState(null);useEffect(()=>{get('v1/leaderboard').then(setD)},[]);return d}
export function Announcements({limit,dense}){
 const [a,setA]=useState(null)
 useEffect(()=>{get('v1/announcements').then(d=>setA(d.items||[]))},[])
 if(!a)return <div className="bd-ann">{[0,1].map(i=><div key={i} className="bd-skel"/>)}</div>
 if(!a.length)return <div className="bd-empty">📭 Belum ada pengumuman.</div>
 return <div className="bd-ann">{a.slice(0,limit||50).map(x=><article key={x.id} className="bd-card">
  {x.img&&<img src={x.img} alt="" className="bd-img"/>}
  <div className="bd-body"><span className="bd-chip">📣 Pengumuman</span><h3>{x.title}</h3><time>{tgl(x.at)}</time>
  {!dense&&x.body&&<p>{x.body}</p>}{dense&&x.body&&<p>{x.body.slice(0,120)}{x.body.length>120?'…':''}</p>}</div></article>)}</div>}
const MD=['🥇','🥈','🥉']
const nf=n=>(+n||0).toLocaleString('id-ID')
// LEADERBOARD GLOBAL — satu papan, tanpa tab.
// Tiap baris: saldo, jumlah transaksi, berapa kali deposit, dan transaksi sukses.
// Isinya pengguna yang mendaftar sendiri + data yang ditambahkan admin.
export function Leaderboard({me,limit=25,data}){
 const own=useBoard(),d=data||own,mine=me?mask(me):null
 if(!d)return <div className="bd-skel"/>
 const rows=(d.global||[]).slice(0,limit),t=d.total||{}
 return <div className="bd-lb">
  <div className="bd-gh"><p>🌍 Satu papan untuk semua. Urutan dihitung dari transaksi sukses terbanyak, lalu saldo.</p>
   <div className="bd-tot">
    <div><small>Peserta</small><b>{nf(t.users)}</b></div>
    <div><small>Total saldo</small><b>{rp(t.saldo)}</b></div>
    <div><small>Transaksi</small><b>{nf(t.trx)}</b></div>
    <div><small>Deposit</small><b>{nf(t.dep)}</b></div>
    <div><small>Sukses</small><b className="ok">{nf(t.ok)}</b></div></div></div>
  {!rows.length&&<div className="bd-empty">Belum ada data. Jadilah yang pertama!</div>}
  {rows.map((r,i)=><div key={i} className={'bd-row g r'+i+(r.u===mine?' me':'')}>
   <span className="bd-rk">{MD[i]||i+1}</span>
   <div className="bd-who"><b>{r.u}</b>{r.u===mine&&<em>Kamu</em>}
    <div className="bd-st">
     <span title="Saldo">👛 <b>{rp(r.balance)}</b></span>
     <span title="Jumlah transaksi">🧾 <b>{nf(r.trx)}</b> transaksi</span>
     <span title="Berapa kali deposit">💳 <b>{nf(r.dep)}</b>x deposit</span>
     <span className="ok" title="Transaksi sukses">✅ <b>{nf(r.ok)}</b> sukses</span></div></div></div>)}</div>}
