'use client'
import {useState,useEffect} from 'react'
import '../app/board3d.css'
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
const nf=n=>(+n||0).toLocaleString('id-ID')
// Angka besar diringkas di podium supaya muat di layar HP (nilai lengkap tetap ada di title).
const kc=n=>{n=+n||0;if(n>=1e9)return 'Rp'+(n/1e9).toFixed(n>=1e10?0:1).replace('.',',')+' M';if(n>=1e6)return 'Rp'+(n/1e6).toFixed(n>=1e7?0:1).replace('.',',')+' jt';return rp(n)}
const MEDAL=['👑','🥈','🥉']
// LEADERBOARD GLOBAL — satu papan, tanpa tab. Hanya 3 angka: saldo, jumlah transaksi, jumlah deposit.
// Urutan: transaksi terbanyak, lalu saldo, lalu deposit. Isinya pengguna asli + data yang ditambahkan admin.
function Podium({r,i,mine}){return <div className={'lb3-pd p'+i+(r.u===mine?' me':'')}>
 <span className="lb3-md" aria-hidden="true">{MEDAL[i]}</span>
 <b className="lb3-nm" title={r.u}>{r.u}</b>{r.u===mine&&<em className="lb3-me">Kamu</em>}
 <ul><li title={rp(r.balance)}><small>Saldo</small><b>{kc(r.balance)}</b></li><li><small>Transaksi</small><b>{nf(r.trx)}</b></li><li><small>Deposit</small><b>{nf(r.dep)}x</b></li></ul>
 <div className="lb3-st" aria-label={'Peringkat '+(i+1)}><span>{i+1}</span></div></div>}
export function Leaderboard({me,limit=25,data}){
 const own=useBoard(),d=data||own,mine=me?mask(me):null
 if(!d)return <div className="bd-skel"/>
 const rows=(d.global||[]).slice(0,limit),t=d.total||{}
 const top=rows.slice(0,3),rest=rows.slice(3)
 // susunan podium: juara 2 di kiri, juara 1 di tengah, juara 3 di kanan
 const order=top.length===3?[1,0,2]:top.map((_,i)=>i)
 return <div className="lb3">
  <div className="lb3-tot">
   <div><small>Total saldo</small><b>{kc(t.saldo)}</b></div>
   <div><small>Transaksi</small><b>{nf(t.trx)}</b></div>
   <div><small>Deposit</small><b>{nf(t.dep)}x</b></div></div>
  {!rows.length&&<div className="bd-empty">Belum ada data. Jadilah yang pertama!</div>}
  {top.length>0&&<div className={'lb3-pod n'+top.length}>{order.map(i=><Podium key={i} r={top[i]} i={i} mine={mine}/>)}</div>}
  {rest.map((r,k)=><div key={k} className={'lb3-row'+(r.u===mine?' me':'')}>
   <span className="lb3-rk">{k+4}</span>
   <div className="lb3-who"><b title={r.u}>{r.u}</b>{r.u===mine&&<em className="lb3-me">Kamu</em>}</div>
   <div className="lb3-ss">
    <span><small>Saldo</small><b title={rp(r.balance)}>{kc(r.balance)}</b></span>
    <span><small>Transaksi</small><b>{nf(r.trx)}</b></span>
    <span><small>Deposit</small><b>{nf(r.dep)}x</b></span></div></div>)}</div>}
