'use client'
import {useState,useEffect,useCallback} from 'react'
// Panel admin: daftar reseller + tambah/kurangi saldo dompet reseller mereka.
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(+t).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'}):'-'
export default function AdminReseller({call}){
 const [d,setD]=useState(null),[q,setQ]=useState(''),[sel,setSel]=useState(null)
 const [amt,setAmt]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState('')
 // daftar pelanggan semua bot reseller
 const [cu,setCu]=useState(null),[cq,setCq]=useState(''),[cf,setCf]=useState(''),[cs,setCs]=useState(null)
 const [camt,setCamt]=useState(''),[cnote,setCnote]=useState('')
 const load=useCallback(async()=>{const r=await call('rs/list');if(!r.error)setD(r)},[call])
 const loadCu=useCallback(async(uid,qq)=>{const r=await call('rs/cust',{uid:uid??cf,q:qq??cq});if(!r.error)setCu(r)},[call,cf,cq])
 useEffect(()=>{load();loadCu('','')},[load])
 const ubah=async kind=>{
  const n=Math.floor(+String(amt).replace(/\D/g,'')||0)
  if(!sel)return alert('Pilih reseller dulu')
  if(!n)return alert('Isi nominalnya dulu')
  if(kind==='del'&&!confirm(`Kurangi saldo ${sel.brand||sel.email} sebanyak ${rp(n)}?`))return
  setBusy(kind);const r=await call('rs/saldo',{uid:sel.uid,amount:n,kind,note});setBusy('')
  if(r.error)return alert(r.error)
  setAmt('');setNote('');alert('Saldo sekarang '+rp(r.balance));load()}
 const cuSaldo=async kind=>{
  const n=Math.floor(+String(camt).replace(/\D/g,'')||0)
  if(!cs)return alert('Pilih pelanggan dulu')
  if(!n)return alert('Isi nominalnya dulu')
  if(kind==='del'&&!confirm(`Kurangi saldo ${cs.tgUser?'@'+cs.tgUser:cs.name} (${cs.brand}) sebanyak ${rp(n)}?`))return
  setBusy('c'+kind);const r=await call('rs/cust/saldo',{id:cs.id,amount:n,kind,note:cnote});setBusy('')
  if(r.error)return alert(r.error)
  setCamt('');setCnote('');alert('Saldo pelanggan sekarang '+rp(r.balance));setCs(null);loadCu()}
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

  <div className="card"><h3>👥 Pelanggan semua bot reseller{cu?` (${cu.total})`:''}</h3>
   <p className="muted">Pelanggan yang mendaftar lewat bot reseller. Saldo mereka terpisah dari saldo akun web. Menambah saldo di sini sama dengan memberi mereka saldo nokos gratis — biayanya ditanggung kamu, bukan resellernya.</p>
   <div className="ad-g">
    <label>Saring per toko<select value={cf} onChange={e=>{setCf(e.target.value);loadCu(e.target.value)}}>
     <option value="">— semua toko —</option>
     {(cu?cu.toko:[]).map(t=><option key={t.uid} value={t.uid}>{t.brand}{t.bot?' · @'+t.bot:''}</option>)}</select></label>
    <label>Cari<input placeholder="nama / username Telegram / ID" value={cq}
     onChange={e=>setCq(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadCu(undefined,e.target.value)}/></label></div>
   <div className="tabs" style={{margin:'8px 0 12px'}}><button className="btn" onClick={()=>loadCu()}>🔍 Cari</button>
    <button className="btn sil" onClick={()=>{setCq('');setCf('');loadCu('','')}}>Tampilkan semua</button></div>
   {!cu?<p className="muted">Memuat pelanggan…</p>
   :!cu.items.length?<p className="muted">Belum ada pelanggan di bot reseller mana pun.</p>
   :<><div style={{overflowX:'auto'}}><table className="ud-list"><thead><tr><th>Pelanggan</th><th>Toko</th><th>Saldo</th><th>Order</th><th></th></tr></thead>
     <tbody>{cu.items.map(c=><tr key={c.id} className={cs&&cs.id===c.id?'ud-sel':''}>
      <td><b>{c.name||'(tanpa nama)'}</b><small>{c.tgUser?'@'+c.tgUser:'ID '+c.tgId}{c.banned?' · DIBANNED':''}</small></td>
      <td><small>{c.brand}</small></td>
      <td><b>{rp(c.balance)}</b><small>deposit {rp(c.deposit)}</small></td>
      <td>{c.orders}x<small>{rp(c.spent)}</small></td>
      <td><button className={'btn '+(cs&&cs.id===c.id?'blue':'sil')} style={{padding:'5px 10px',fontSize:12}}
       onClick={()=>setCs(cs&&cs.id===c.id?null:c)}>Saldo</button></td></tr>)}</tbody></table></div>
    {cu.shown<cu.total&&<p className="muted">Menampilkan {cu.shown} dari {cu.total} pelanggan. Pakai pencarian atau saringan toko untuk mempersempit.</p>}</>}
   {cs&&<div style={{marginTop:14,padding:14,border:'1px solid #e2e8f5',borderRadius:14,background:'#f8fafd'}}>
    <b>💼 Ubah saldo · {cs.name||cs.tgUser||cs.id} <small className="muted">({cs.brand})</small></b>
    <p className="muted" style={{margin:'4px 0 8px'}}>Saldo sekarang <b>{rp(cs.balance)}</b>. Pengurangan ditolak kalau membuat saldonya minus. Pelanggan &amp; channel resellernya otomatis dikabari.</p>
    <div className="ad-g">
     <label>Nominal (Rp)<input type="number" value={camt} onChange={e=>setCamt(e.target.value)} placeholder="10000"/></label>
     <label>Catatan (opsional)<input value={cnote} onChange={e=>setCnote(e.target.value)} placeholder="Ganti rugi / bonus"/></label></div>
    <div className="tabs" style={{marginTop:10}}>
     <button className="btn blue" disabled={!!busy} onClick={()=>cuSaldo('add')}>{busy==='cadd'?'Memproses…':'➕ Tambah saldo'}</button>
     <button className="btn sil" disabled={!!busy} onClick={()=>cuSaldo('del')}>{busy==='cdel'?'Memproses…':'➖ Kurangi saldo'}</button>
     <button className="btn sil" onClick={()=>setCs(null)}>Batal</button></div></div>}</div>
 </>}