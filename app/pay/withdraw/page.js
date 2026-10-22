'use client'
import {useState,useEffect,useCallback} from 'react'
import PayShell,{api,rp,dt,ago,Toast} from '../../../components/PayShell'
const fmt=s=>String(Math.max(0,Math.floor(+s||0))).replace(/\B(?=(\d{3})+(?!\d))/g,'.')
const STL={pending:'MENUNGGU',success:'SUKSES',rejected:'DITOLAK',processing:'DIPROSES'}
// Tarik dana MANUAL: user mengajukan, saldo langsung terpotong, admin yang mengirim lalu menyetujui.
export default function Tarik(){
 const [me,setMe]=useState(),[code,setCode]=useState(''),[nom,setNom]=useState(''),[dest,setDest]=useState(''),[nama,setNama]=useState('')
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[ok,setOk]=useState(null)
 const load=useCallback(async()=>{const r=await api('v1/pay/me');if(!r.error)setMe(r);else setMsg(r.error)},[])
 useEffect(()=>{load();const t=setInterval(load,20000);return()=>clearInterval(t)},[load])
 const nominal=Math.floor(+String(nom).replace(/\D/g,'')||0)
 const fee=me?Math.min(nominal,Math.round(nominal*(+me.wdPct||0)/100)+(+me.wdFee||0)):0
 const terima=Math.max(0,nominal-fee)
 const m=me&&me.wdMethods.find(x=>x.code===code)
 const bank=m&&m.type==='bank'
 const tooLow=me&&nominal>0&&nominal<me.wdMin,tooHigh=me&&nominal>me.wdMax
 const kirim=async()=>{
  if(!m)return setMsg('Pilih tujuan dulu')
  if(!confirm(`Ajukan tarik ${rp(nominal)} ke ${m.name} ${dest} a.n. ${nama}?\nSaldo terpotong ${rp(nominal)}, kamu terima ${rp(terima)}.`))return
  setBusy(true);const r=await api('v1/pay/withdraw',{method:code,account:dest,account_name:nama,nominal});setBusy(false)
  if(r.error)return setMsg(r.error)
  setOk(r);setNom('');load()}
 return <PayShell me={me?{balance:me.balance,name:me.name}:null}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  {ok&&<section className="pc"><div className="qr-done">
   <div className="qr-tick" style={{background:'linear-gradient(180deg,#fdfdff,#c6cddb)',color:'#0a1024',textShadow:'none'}}>⏳</div>
   <h2 style={{margin:0,fontSize:22}}>WD DIAJUKAN!</h2>
   <div className="qr-amt mono">{rp(ok.nominal)}<small style={{marginTop:6}}>KE {ok.method_name} · {ok.destination}</small></div>
   <div className="pay-note warn" style={{textAlign:'left'}}>{ok.message||me.wdNote}</div>
   <p style={{color:'var(--t2)',fontSize:13,margin:0}}>Diterima {rp(ok.net)} (biaya {rp(ok.fee)}) · ID {ok.transaction_id}</p>
   <button className="pb gh" onClick={()=>setOk(null)}>Tutup</button></div></section>}

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">↗</span><div><h2>Tarik dana</h2><p>Ajukan penarikan ke e-wallet atau bank — diproses manual oleh admin</p></div></div>
   {!me?<div className="pay-sk" style={{height:120}}/>:!me.wdOn?<div className="pay-note bad">Penarikan dana sedang dinonaktifkan admin.</div>:<>
    <div className="pay-note">Saldo <b className="mono">{rp(me.balance)}</b> · minimal <b className="mono">{rp(me.wdMin)}</b> · maksimal <b className="mono">{rp(me.wdMax)}</b> · biaya WD <b className="mono">{me.wdPct}%</b>{me.wdFee>0?<> + <b className="mono">{rp(me.wdFee)}</b></>:null}</div>
    <div className="pay-fld"><label className="pf-l" htmlFor="wl">Tujuan</label>
     <div className="wd-grid">{me.wdMethods.length===0?<span style={{color:'var(--t3)',fontSize:13}}>Semua metode sedang dimatikan admin.</span>
      :me.wdMethods.map(x=><button type="button" key={x.code} className={'wd-m'+(code===x.code?' on':'')} onClick={()=>setCode(x.code)}>
       <i>{x.type==='bank'?'🏦':'📱'}</i>{x.name}</button>)}</div></div>
    {m&&<>
     <div className="pay-fld"><label className="pf-l" htmlFor="ds">{bank?'Nomor rekening':'Nomor e-wallet'}</label>
      <input id="ds" className="pin mono" inputMode="numeric" placeholder={bank?'1234567890':'081234567890'} value={dest} onChange={e=>setDest(e.target.value.replace(/\D/g,'').slice(0,20))}/></div>
     <div className="pay-fld"><label className="pf-l" htmlFor="nm">Nama pemilik {bank?'rekening':'akun'}</label>
      <input id="nm" className="pin" placeholder="Sesuai nama di aplikasi / buku tabungan" value={nama} maxLength={60} onChange={e=>setNama(e.target.value)}/></div>
     <div className="pay-fld"><label className="pf-l" htmlFor="nj">Nominal ditarik</label>
      <input id="nj" className="pin mono" inputMode="numeric" placeholder={`Rp${fmt(me.wdMin)} - Rp${fmt(me.wdMax)}`}
       value={nom?'Rp'+fmt(nom):''} onChange={e=>setNom(e.target.value.replace(/\D/g,'').slice(0,10))}/>
      <div className="pay-row" style={{marginTop:8}}>{[me.wdMin,50000,100000,500000].filter((v,i,a)=>v<=me.wdMax&&a.indexOf(v)===i).map(v=>
       <button type="button" key={v} className="pb gh sm" onClick={()=>setNom(String(v))}>{fmt(v)}</button>)}
       <button type="button" className="pb gh sm" onClick={()=>setNom(String(Math.min(me.balance,me.wdMax)))}>Semua saldo</button></div></div>
     {nominal>0&&<div className={'pay-note '+(tooLow||tooHigh?'bad':'warn')}>
      {tooLow?<>Nominal minimal <b className="mono">{rp(me.wdMin)}</b>.</>:tooHigh?<>Nominal maksimal <b className="mono">{rp(me.wdMax)}</b>.</>
       :<>Saldo terpotong <b className="mono">{rp(nominal)}</b> · biaya <b className="mono">{rp(fee)}</b> · kamu terima <b className="mono">{rp(terima)}</b>.<br/>Pastikan nomor &amp; nama benar — dana yang sudah dikirim tidak bisa ditarik kembali.</>}</div>}
     <div className="pay-note">⏳ {me.wdNote}</div>
     <button className="pb wide" style={{marginTop:14}} disabled={busy||!m||dest.length<5||nama.trim().length<2||nominal<me.wdMin||nominal>me.wdMax||nominal>me.balance} onClick={kirim}>
      {busy?'Mengajukan…':nominal>me.balance?'Saldo tidak cukup':'↗ Ajukan tarik '+rp(nominal)}</button></>}
   </>}
  </section>

  {me&&me.wd&&me.wd.length>0&&<section className="pc">
   <div className="pc-h"><span className="pc-ic">🕘</span><div><h2>Penarikan terakhir</h2><p>Status berubah dari menunggu menjadi sukses setelah admin memproses</p></div></div>
   <div className="pay-list">{me.wd.slice(0,8).map(x=><div key={x.transaction_id} className="pay-it">
    <span className="ic">↗</span>
    <span className="mid"><b className="mono">{rp(x.nominal)}</b><small>{x.method_name} · {x.destination} · {ago(x.created_at)}</small></span>
    <span className="amt"><span className={'st '+x.status}>{STL[x.status]||x.status}</span><small style={{display:'block',marginTop:4}}>terima {rp(x.net)}</small></span></div>)}</div>
  </section>}
 </PayShell>}
