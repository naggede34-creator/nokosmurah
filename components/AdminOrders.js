'use client'
import {useState,useEffect,useCallback} from 'react'

const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':'):'-'
const sisa=t=>{const d=Math.floor((+t-Date.now())/1000);if(!t||d<=0)return 'habis'
 return Math.floor(d/60)+'m '+String(d%60).padStart(2,'0')+'s'}
// Lencana status: satu warna per keadaan supaya sekali lihat langsung kebaca.
const ST={pending:['🟡','Menunggu','warn'],success:['🟢','Sukses','ok'],expired:['⌛','Kedaluwarsa','red'],
 cancelled:['🚫','Dibatalkan','red'],failed:['🔴','Gagal','red']}
const SARING=[['all','Semua'],['pending','🟡 Menunggu'],['success','🟢 Sukses'],['expired','⌛ Kedaluwarsa'],['cancelled','🚫 Dibatalkan']]

export default function AdminOrders({call}){
 const [d,setD]=useState(null),[st,setSt]=useState('pending'),[q,setQ]=useState(''),[sv,setSv]=useState('')
 const [busy,setBusy]=useState(''),[auto,setAuto]=useState(true)
 // detik berjalan: hitung mundur sisa waktu order ikut bergerak tanpa memuat ulang data
 const [,tik]=useState(0)

 const load=useCallback(async(o={})=>{
  const r=await call('orders',{status:o.status??st,q:o.q??q,server:o.server??sv,limit:200})
  if(!r.error)setD(r)},[call,st,q,sv])
 useEffect(()=>{load()},[load])
 // daftar menunggu disegarkan sendiri: OTP bisa masuk kapan saja
 useEffect(()=>{if(!auto)return;const t=setInterval(()=>load(),20000);return ()=>clearInterval(t)},[auto,load])
 useEffect(()=>{const t=setInterval(()=>tik(x=>x+1),1000);return ()=>clearInterval(t)},[])

 const cek=async o=>{setBusy('c'+o.id)
  const r=await call('orders/check',{uid:o.uid,id:o.id});setBusy('')
  if(r.error)return alert(r.error)
  alert(r.status==='success'?('Kode OTP sudah masuk: '+r.otp):r.status==='expired'?('Kedaluwarsa, saldo dikembalikan '+rp(r.refund)):'Masih menunggu kode OTP.')
  load()}
 const batal=async o=>{
  if(!confirm(`Batalkan order ${o.serviceName} · ${o.phone}?\nSaldo ${rp(o.price)} dikembalikan ke ${o.email||o.name||o.uid}.`))return
  setBusy('x'+o.id)
  const r=await call('orders/cancel',{uid:o.uid,id:o.id});setBusy('')
  if(r.error)return alert(r.error)
  alert(r.queued?r.message:('Dibatalkan. Saldo kembali '+rp(r.refund||0)+'.'))
  load()}

 if(!d)return <div className="card">Memuat transaksi nokos…</div>
 const s=d.stat||{},items=d.items||[]
 const untung=(+s.omzet||0)-(+s.modal||0)
 return <>
  <div className="card"><h3>🧾 Ringkasan transaksi nokos</h3>
   <p className="muted">Dihitung dari <b>semua</b> pesanan seluruh pengguna ({d.pengguna} akun), termasuk pelanggan bot reseller — bukan cuma yang tampil di daftar bawah.</p>
   <div className="ad-kpi4">
    <div><small>Menunggu</small><b>{s.pending||0}</b></div>
    <div><small>Sukses</small><b>{s.success||0}</b></div>
    <div><small>Kedaluwarsa</small><b>{s.expired||0}</b></div>
    <div><small>Dibatalkan</small><b>{s.cancelled||0}</b></div>
    <div><small>Omzet (sukses)</small><b>{rp(s.omzet)}</b></div>
    <div><small>Untung kotor</small><b>{rp(untung)}</b></div></div></div>

  <div className="card"><h3>📋 Daftar transaksi{d.cocok!=null?` (${items.length} dari ${d.cocok})`:''}</h3>
   <div className="tabs" style={{margin:'6px 0 10px'}}>
    {SARING.map(([v,l])=><button key={v} className={'btn '+(st===v?'blue':'sil')} style={{padding:'6px 12px',fontSize:13}}
     onClick={()=>{setSt(v);load({status:v})}}>{l}</button>)}</div>
   <div className="ad-g">
    <label>Cari<input placeholder="ID order / nomor / layanan / email / username TG" value={q}
     onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load({q:e.target.value})}/></label>
    <label>Server<select value={sv} onChange={e=>{setSv(e.target.value);load({server:e.target.value})}}>
     <option value="">— semua server —</option>
     {(d.servers||[]).map(x=><option key={x.server} value={x.server}>{x.name} ({x.server})</option>)}</select></label></div>
   <div className="tabs" style={{margin:'8px 0 12px'}}>
    <button className="btn" onClick={()=>load()}>🔄 Segarkan</button>
    <button className={'btn '+(auto?'blue':'sil')} onClick={()=>setAuto(!auto)}>{auto?'⏱ Segarkan otomatis: ON':'⏱ Segarkan otomatis: OFF'}</button>
    <button className="btn sil" onClick={()=>{setQ('');setSv('');setSt('all');load({q:'',server:'',status:'all'})}}>Tampilkan semua</button></div>

   {!items.length?<p className="muted">Tidak ada transaksi yang cocok dengan saringan ini.</p>
   :<div className="jba-list">{items.map(o=>{const [ic,nm,cl]=ST[o.status]||['▫️',o.status,'']
     const pembeli=o.email||o.name||o.uid
     return <div key={o.uid+o.id} className="jba-row">
      <span className="jba-ic">{ic}</span>
      <div style={{minWidth:0,flex:1}}>
       <b>{o.serviceName}{o.countryName?' · '+o.countryName:''} — {rp(o.price)}</b>
       <small><span className="mono">{o.phone}</span> · modal {rp(o.cost)}{o.guarantee?' · 🛡 jaminan':''}{o.replaced?' · nomor diganti':''}
        {o.otp?<> · <b style={{color:'#14804a'}}>OTP {o.otp}</b></>:null}
        {o.status==='pending'?' · sisa '+sisa(o.expiredAt):''}</small>
       <small>{pembeli}{o.tgUser?' · @'+o.tgUser:(o.tgId?' · ID '+o.tgId:'')}{o.brand?' · 🏪 '+o.brand:''}</small>
       <small>{dt(o.at)} · {o.via==='telegram'?'🤖 bot':'🌐 web'} · {o.server} · <span className="mono">{o.id}</span></small>
       <small style={{marginTop:4}}>
        <span className={'chip2 '+cl}>{ic} {nm}</span>
        {o.cancelQueued?<span className="chip2 warn" style={{marginLeft:6}}>⏳ batal diantre</span>:null}
        {o.refunded?<span className="chip2 blue" style={{marginLeft:6}}>↩️ direfund</span>:null}</small></div>
      {o.status==='pending'&&<div className="tabs" style={{gap:6}}>
        <button className="btn sil" disabled={!!busy} onClick={()=>cek(o)}>{busy==='c'+o.id?'…':'🔄 Cek OTP'}</button>
        <button className="btn" style={{background:'#ef4444',color:'#fff',borderColor:'#ef4444'}} disabled={!!busy||o.cancelQueued}
         onClick={()=>batal(o)}>{busy==='x'+o.id?'…':(o.cancelQueued?'Diantre':'❌ Batalkan')}</button></div>}
     </div>})}</div>}
   <p className="muted" style={{marginTop:10}}>Membatalkan order mengembalikan saldo pembeli <b>penuh</b> dan menarik kembali komisi / saldo stok resellernya. Kalau penyedia menolak, pembatalannya diantre lalu dicoba ulang otomatis sampai berhasil.</p></div>
 </>
}
