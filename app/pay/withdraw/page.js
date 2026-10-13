'use client'
import {useState,useEffect,useCallback} from 'react'
import PayShell,{api,rp,dt,ago,Toast} from '../../../components/PayShell'
const fmt=s=>String(Math.max(0,Math.floor(+s||0))).replace(/\B(?=(\d{3})+(?!\d))/g,'.')
export default function Tarik(){
 const [me,setMe]=useState(),[w,setW]=useState(null),[wallet,setWallet]=useState(''),[prods,setProds]=useState(null)
 const [code,setCode]=useState(''),[nom,setNom]=useState(''),[dest,setDest]=useState(''),[busy,setBusy]=useState('')
 const [msg,setMsg]=useState(''),[ok,setOk]=useState(null)
 const load=useCallback(async()=>{const r=await api('v1/pay/me');if(!r.error)setMe(r)},[])
 useEffect(()=>{load();api('v1/pay/wallets').then(r=>{if(r.error)setMsg(r.error);else setW(r)})},[load])
 useEffect(()=>{if(!wallet)return;setProds(null);setCode('')
  api('v1/pay/products?wallet='+encodeURIComponent(wallet)).then(r=>{if(r.error)setMsg(r.error);else setProds(r.products||[])})},[wallet])
 const pr=(prods||[]).find(x=>String(x.code)===code)
 const open=pr&&pr.open_denom
 const nominal=open?Math.floor(+String(nom).replace(/\D/g,'')||0):(pr?+pr.nominal||0:0)
 const biaya=me?(+me.wdFee||0):0
 const total=pr?(open?nominal+Math.max(0,+pr.fee||0)+biaya:(+pr.sell_price||0)+biaya):0
 const kirim=async()=>{
  if(!pr)return setMsg('Pilih produk tujuan dulu')
  if(!confirm(`Tarik ${rp(nominal)} ke ${wallet} ${dest}?\nSaldo terpotong ${rp(total)}.`))return
  setBusy('go');const r=await api('v1/pay/withdraw',{wallet,product_code:code,phone:dest,nominal});setBusy('')
  if(r.error)return setMsg(r.error)
  setOk(r);setMsg(r.status==='success'?'Dana terkirim':'Penarikan sedang diproses');setNom('');load()}
 const types=(w&&w.types)||{}
 const isVa=types[wallet]==='va'
 return <PayShell me={me?{balance:me.balance,name:me.name}:null}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  {ok&&<section className="pc"><div className="qr-done">
   <div className="qr-tick" style={{background:ok.status==='success'?'linear-gradient(145deg,#34d399,#059669)':'linear-gradient(145deg,#fbbf24,#d97706)'}}>{ok.status==='success'?'✓':'⏳'}</div>
   <h2 style={{margin:0,fontSize:20}}>{ok.status==='success'?'Dana terkirim':'Sedang diproses'}</h2>
   <div className="qr-amt mono">{rp(ok.nominal)}<small style={{marginTop:6}}>KE {ok.wallet} · {ok.destination}</small></div>
   <p style={{color:'var(--t2)',fontSize:13,margin:0}}>Saldo terpotong {rp(ok.total)} (biaya {rp(ok.fee)}) · ID {ok.transaction_id}</p>
   <button className="pb gh" onClick={()=>setOk(null)}>Tutup</button></div></section>}

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">↗</span><div><h2>Tarik dana</h2><p>Langsung ke e-wallet atau Virtual Account bank — otomatis, tanpa menunggu persetujuan</p></div></div>
   {!me?<div className="pay-sk" style={{height:120}}/>:!me.wdOn?<div className="pay-note bad">Penarikan dana sedang dinonaktifkan admin.</div>:<>
    <div className="pay-note">Saldo tersedia <b className="mono">{rp(me.balance)}</b> · minimal tarik <b className="mono">{rp(me.wdMin)}</b>{biaya>0?<> · biaya layanan <b className="mono">{rp(biaya)}</b></>:null}</div>
    <div className="pay-fld"><label className="pf-l" htmlFor="wl">Tujuan</label>
     <select id="wl" className="pin" value={wallet} onChange={e=>setWallet(e.target.value)}>
      <option value="">{w?'— pilih e-wallet / bank —':'Memuat daftar…'}</option>
      {(w&&w.wallets||[]).map(x=><option key={x} value={x}>{x}{types[x]==='va'?' (Virtual Account)':''}</option>)}</select></div>
    {wallet&&<div className="pay-fld"><label className="pf-l" htmlFor="pd">Produk</label>
     {prods===null?<div className="pay-sk" style={{height:48}}/>
      :<select id="pd" className="pin" value={code} onChange={e=>setCode(e.target.value)}>
       <option value="">— pilih nominal —</option>
       {prods.map(x=><option key={x.code} value={x.code}>{x.name}{x.open_denom?'':' · '+rp(x.sell_price)}</option>)}</select>}</div>}
    {open&&<div className="pay-fld"><label className="pf-l" htmlFor="nm">Nominal</label>
     <input id="nm" className="pin mono" inputMode="numeric" placeholder={`Rp${fmt(pr.min)} - Rp${fmt(pr.max)}`}
      value={nom?'Rp'+fmt(nom):''} onChange={e=>setNom(e.target.value.replace(/\D/g,''))}/></div>}
    {pr&&<div className="pay-fld"><label className="pf-l" htmlFor="ds">{isVa?'Nomor Virtual Account':'Nomor HP e-wallet'}</label>
     <input id="ds" className="pin mono" inputMode="numeric" placeholder={isVa?'8887001234567890':'081234567890'}
      value={dest} onChange={e=>setDest(e.target.value.replace(/\D/g,''))}/></div>}
    {pr&&nominal>0&&<div className="pay-note warn">Saldo terpotong <b className="mono">{rp(total)}</b> untuk mengirim <b className="mono">{rp(nominal)}</b>. Pastikan nomor tujuan benar — dana yang sudah terkirim tidak bisa ditarik kembali.</div>}
    <button className="pb wide" style={{marginTop:14}} disabled={!!busy||!pr||!dest||nominal<=0||total>me.balance} onClick={kirim}>
     {busy?'Mengirim…':total>me.balance?'Saldo tidak cukup':'↗ Tarik '+rp(nominal)}</button>
   </>}
  </section>

  {me&&me.wd&&me.wd.length>0&&<section className="pc">
   <div className="pc-h"><span className="pc-ic">🕘</span><div><h2>Penarikan terakhir</h2><p>Status diperbarui otomatis</p></div></div>
   <div className="pay-list">{me.wd.slice(0,8).map(x=><div key={x.transaction_id} className="pay-it">
    <span className="ic">↗</span>
    <span className="mid"><b className="mono">{rp(x.nominal)}</b><small>{x.wallet} · {x.destination} · {ago(x.created_at)}</small></span>
    <span className="amt"><span className={'st '+x.status}>{x.status}</span><small style={{display:'block',marginTop:4}}>-{rp(x.total)}</small></span></div>)}</div>
  </section>}
 </PayShell>}
