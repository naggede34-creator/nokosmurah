'use client'
import {useState,useEffect,useCallback} from 'react'
// Panel admin: daftar reseller + tambah/kurangi saldo dompet reseller mereka.
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(+t).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'}):'-'
export default function AdminReseller({call}){
 const [d,setD]=useState(null),[q,setQ]=useState(''),[sel,setSel]=useState(null)
 const [amt,setAmt]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState('')
 const load=useCallback(async()=>{const r=await call('rs/list');if(!r.error)setD(r)},[call])
 useEffect(()=>{load()},[load])
 const ubah=async kind=>{
  const n=Math.floor(+String(amt).replace(/\D/g,'')||0)
  if(!sel)return alert('Pilih reseller dulu')
  if(!n)return alert('Isi nominalnya dulu')
  if(kind==='del'&&!confirm(`Kurangi saldo ${sel.brand||sel.email} sebanyak ${rp(n)}?`))return
  setBusy(kind);const r=await call('rs/saldo',{uid:sel.uid,amount:n,kind,note});setBusy('')
  if(r.error)return alert(r.error)
  setAmt('');setNote('');alert('Saldo sekarang '+rp(r.balance));load()}
 if(!d)return <div className="card">Memuat data reseller…</div>
 const t=d.total||{},items=(d.items||[]).filter(x=>{const s=q.trim().toLowerCase()
  return !s||[x.email,x.name,x.brand,x.bot&&x.bot.username].some(v=>String(v||'').toLowerCase().includes(s))})
 return <>
  <div className="card"><h3>🏪 Reseller</h3>
   <p className="muted">Pemilik bot reseller beserta dompet keuntungannya. Saldo di sini adalah uang yang bisa mereka tarik lewat AustinPay — jadi menambah saldo berarti menambah kewajiban bayar.</p>
   <div className="ad-kpi" style={{marginTop:4}}>
    <div><small>Reseller</small><b>{(d.items||[]).length}</b></div>
    <div><small>Saldo tertahan</small><b>{rp(t.saldo)}</b></div>
    <div><small>Total untung mereka</small><b>{rp(t.untung)}</b></div>
    <div><small>Pelanggan</small><b>{t.pelanggan||0}</b></div></div></div>

  <div className="card"><h3>Daftar reseller ({items.length})</h3>
   <input placeholder="🔍 Cari email / nama toko / username bot…" value={q} onChange={e=>setQ(e.target.value)}/>
   {!items.length?<p className="muted">Belum ada reseller.</p>
   :<div className="jba-list">{items.map(x=><div key={x.uid} className={'jba-row'+(sel&&sel.uid===x.uid?' on':'')}>
     <span className="jba-ic">🏪</span>
     <div style={{minWidth:0,flex:1}}><b>{x.brand||'(tanpa nama toko)'}</b>
      <small>{x.email} · {x.bot?'@'+x.bot.username:'bot dihapus'} · markup {x.markup}%</small>
      <small>Saldo {rp(x.balance)} · untung {rp(x.earn)} · terjual {x.sold}x · {x.cust} pelanggan · sejak {dt(x.at)}</small></div>
     <button className={'btn '+(sel&&sel.uid===x.uid?'blue':'sil')} onClick={()=>setSel(sel&&sel.uid===x.uid?null:x)}>
      {sel&&sel.uid===x.uid?'Terpilih':'Pilih'}</button></div>)}</div>}</div>

  {sel&&<div className="card"><h3>💼 Ubah saldo · {sel.brand||sel.email}</h3>
   <p className="muted">Saldo sekarang <b>{rp(sel.balance)}</b>. Pengurangan ditolak kalau membuat saldonya minus.</p>
   <div className="ad-g">
    <label>Nominal (Rp)<input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="50000"/></label>
    <label>Catatan (opsional)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Koreksi manual / bonus"/></label></div>
   <div className="tabs" style={{marginTop:10}}>
    <button className="btn blue" disabled={!!busy} onClick={()=>ubah('add')}>{busy==='add'?'Memproses…':'➕ Tambah saldo'}</button>
    <button className="btn sil" disabled={!!busy} onClick={()=>ubah('del')}>{busy==='del'?'Memproses…':'➖ Kurangi saldo'}</button>
    <button className="btn sil" onClick={()=>setSel(null)}>Batal</button></div></div>}
 </>}
