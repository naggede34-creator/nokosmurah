'use client'
import {useState,useEffect,useCallback} from 'react'
import PayShell,{api,rp,dt,ago,Toast,Copy} from '../../../components/PayShell'
import Struk from '../../../components/Struk'
const ST=['semua','paid','pending','expired','canceled']
export default function Riwayat(){
 const [struk,setStruk]=useState(null)
 const [d,setD]=useState(),[tab,setTab]=useState('in'),[st,setSt]=useState('semua'),[q,setQ]=useState(''),[msg,setMsg]=useState('')
 const load=useCallback(async()=>{const r=await api('v1/pay/history?limit=200');if(!r.error)setD(r);else setMsg(r.error)},[])
 useEffect(()=>{const u=new URLSearchParams(location.search);if(u.get('tab')==='wd')setTab('out');if(u.get('id'))setQ(u.get('id'));load()},[load])
 const rows=d?(tab==='in'?d.dep:d.wd):[]
 const show=rows.filter(x=>(st==='semua'||x.status===st)&&(!q||JSON.stringify(x).toLowerCase().includes(q.toLowerCase())))
 const csv=()=>{
  const head=tab==='in'?['id','nominal','biaya','masuk','dibayar','status','dibuat','lunas']:['id','dompet','tujuan','nominal','biaya','total','status','dibuat']
  const body=show.map(x=>tab==='in'?[x.transaction_id,x.amount,x.fee,x.net,x.total_paid,x.status,x.created_at,x.paid_at||'']
   :[x.transaction_id,x.wallet,x.destination,x.nominal,x.fee,x.total,x.status,x.created_at])
  const t=[head,...body].map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+t],{type:'text/csv;charset=utf-8'}))
  a.download='artapedia-pay-'+tab+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setMsg('CSV diunduh')}
 return <PayShell me={d?{balance:d.balance}:null}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  {struk&&<Struk item={struk.item} kind={struk.kind} onClose={()=>setStruk(null)} onMsg={setMsg}/>}
  <section className="pc">
   <div className="pc-h"><span className="pc-ic">≡</span><div><h2>Riwayat</h2><p>Semua QRIS masuk dan penarikan dana</p></div><span className="sp"/>
    <button className="pb gh sm" onClick={csv} disabled={!show.length}>⬇ CSV</button></div>
   <div className="pay-row" style={{marginBottom:12}}>
    <div className="pay-seg"><button className={tab==='in'?'on':''} onClick={()=>{setTab('in');setSt('semua')}}>QRIS masuk</button>
     <button className={tab==='out'?'on':''} onClick={()=>{setTab('out');setSt('semua')}}>Penarikan</button></div>
   </div>
   <input className="pin" placeholder="Cari ID transaksi / nominal / tujuan…" value={q} onChange={e=>setQ(e.target.value)} style={{marginBottom:10}}/>
   <div className="pay-row" style={{marginBottom:14}}>
    {(tab==='in'?ST:['semua','success','processing','failed']).map(s=>
     <button key={s} className={'pb sm '+(st===s?'':'gh')} onClick={()=>setSt(s)}>{s}</button>)}</div>
   {!d?<div className="pay-sk" style={{height:200}}/>
    :show.length===0?<div className="pay-empty"><span className="em">∅</span>Tidak ada transaksi yang cocok.</div>
    :<div className="pay-list">{show.map(x=>tab==='in'
     ?<div key={x.transaction_id} className="pay-it">
       <span className="ic">▣</span>
       <span className="mid"><b className="mono">{rp(x.amount)}</b>
        <small>{x.transaction_id} · {dt(x.created_at)}{x.status==='paid'?' · masuk '+rp(x.net):''}</small></span>
       <span className="amt"><span className={'st '+x.status}>{x.status}</span>
        <small style={{display:'block',marginTop:5,display:'flex',gap:5,justifyContent:'flex-end'}}>
         <button className="pb gh sm" onClick={()=>setStruk({item:x,kind:'qris'})}>🧾</button>
         <a className="pb gh sm" href={'/struk/'+x.transaction_id+'?t='+x.receipt_token} target="_blank" rel="noreferrer">Bagikan</a></small></span></div>
     :<div key={x.transaction_id} className="pay-it">
       <span className="ic">↗</span>
       <span className="mid"><b className="mono">{rp(x.nominal)}</b>
        <small>{x.wallet} · {x.destination} · {dt(x.created_at)}{x.message?' · '+x.message:''}</small></span>
       <span className="amt"><span className={'st '+x.status}>{x.status}</span>
        <small style={{display:'block',marginTop:4}}>-{rp(x.total)}</small>
        <button className="pb gh sm" style={{marginTop:5}} onClick={()=>setStruk({item:x,kind:'withdraw'})}>🧾 Struk</button></span></div>)}</div>}
   {d&&<p style={{color:'var(--t3)',fontSize:12,marginTop:12}}>{show.length} dari {rows.length} transaksi</p>}
  </section>
 </PayShell>}
