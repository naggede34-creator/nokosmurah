'use client'
import {useState,useEffect,useRef} from 'react'
import {useParams,useSearchParams} from 'next/navigation'
import '../../pay/pay.css'
const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB':'-'
// Struk pembayaran QRIS: bisa dibuka siapa saja yang punya tautannya (butuh token),
// dan bisa diunduh sebagai gambar PNG untuk dibagikan ke pembeli / grup.
export default function Struk(){
 const {id}=useParams(),sp=useSearchParams(),t=sp.get('t')||''
 const [d,setD]=useState(),[err,setErr]=useState(''),[msg,setMsg]=useState('')
 const box=useRef(null)
 useEffect(()=>{let on=true
  const f=async()=>{try{const r=await fetch(`/api/pay/receipt/${encodeURIComponent(id)}?t=${encodeURIComponent(t)}`).then(x=>x.json())
    if(!on)return;r.success?setD(r.receipt):setErr(r.message||'Struk tidak ditemukan')}catch(e){if(on)setErr('Gagal memuat struk')}}
  f();const iv=setInterval(f,6000);return()=>{on=false;clearInterval(iv)}},[id,t])
 // gambar struk digambar di canvas supaya hasilnya rapi & ukurannya pasti
 const unduh=()=>{
  const W=720,H=1040,c=document.createElement('canvas');c.width=W;c.height=H
  const x=c.getContext('2d')
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#0b1226');g.addColorStop(1,'#140f2e')
  x.fillStyle=g;x.fillRect(0,0,W,H)
  x.fillStyle='rgba(124,92,255,.18)';x.beginPath();x.arc(W*.15,90,230,0,7);x.fill()
  x.fillStyle='rgba(34,211,238,.12)';x.beginPath();x.arc(W*.9,180,180,0,7);x.fill()
  const card=(y,h)=>{x.fillStyle='rgba(255,255,255,.055)';x.strokeStyle='rgba(150,165,230,.22)';x.lineWidth=2
   x.beginPath();x.roundRect(44,y,W-88,h,30);x.fill();x.stroke()}
  card(130,780)
  x.textAlign='center';x.fillStyle='#fff';x.font='800 30px system-ui,sans-serif';x.fillText('ARTAPEDIA PAY',W/2,72)
  x.fillStyle='#9fadd6';x.font='600 15px system-ui,sans-serif';x.fillText('Struk Pembayaran QRIS',W/2,100)
  const paid=d.status==='paid'
  x.fillStyle=paid?'#34d399':d.status==='pending'?'#fbbf24':'#fb7185'
  x.beginPath();x.arc(W/2,235,52,0,7);x.fill()
  x.fillStyle='#07122a';x.font='800 52px system-ui,sans-serif';x.fillText(paid?'✓':d.status==='pending'?'⏳':'✕',W/2,253)
  x.fillStyle='#fff';x.font='800 26px system-ui,sans-serif'
  x.fillText(paid?'Pembayaran Berhasil':d.status==='pending'?'Menunggu Pembayaran':'Transaksi '+d.status,W/2,330)
  x.fillStyle='#eef2ff';x.font='800 58px ui-monospace,monospace';x.fillText(rp(d.total_paid||d.amount),W/2,415)
  x.fillStyle='#6b7aa8';x.font='700 14px system-ui,sans-serif';x.fillText('TOTAL DIBAYAR',W/2,443)
  x.strokeStyle='rgba(150,165,230,.25)';x.setLineDash([7,7]);x.beginPath();x.moveTo(80,485);x.lineTo(W-80,485);x.stroke();x.setLineDash([])
  const rows=[['ID Transaksi',d.transaction_id],['Nominal',rp(d.amount)],['Metode','QRIS'],
   ['Waktu dibuat',dt(d.created_at)],...(d.paid_at?[['Waktu dibayar',dt(d.paid_at)]]:[]),['Status',String(d.status).toUpperCase()]]
  let y=530
  for(const [k,v] of rows){
   x.textAlign='left';x.fillStyle='#8b99c4';x.font='600 16px system-ui,sans-serif';x.fillText(k,80,y)
   x.textAlign='right';x.fillStyle='#eef2ff';x.font='700 16px ui-monospace,monospace'
   let s=String(v);while(x.measureText(s).width>330&&s.length>8)s=s.slice(0,-2)
   x.fillText(s,W-80,y);y+=46}
  x.textAlign='center';x.fillStyle='#6b7aa8';x.font='600 13px system-ui,sans-serif'
  x.fillText('Struk ini dibuat otomatis oleh sistem — tidak perlu tanda tangan.',W/2,940)
  x.fillStyle='#7c5cff';x.font='800 16px system-ui,sans-serif';x.fillText(location.host,W/2,975)
  c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b)
   a.download='struk-'+d.transaction_id+'.png';a.click();setMsg('Struk diunduh')},'image/png')}
 const bagikan=async()=>{
  try{if(navigator.share){await navigator.share({title:'Struk pembayaran',text:`Pembayaran ${rp(d.total_paid)} — ${d.transaction_id}`,url:location.href});return}}catch(e){}
  try{await navigator.clipboard.writeText(location.href);setMsg('Tautan struk disalin')}catch(e){setMsg(location.href)}}
 return <div className="pay"><div className="pay-in" style={{maxWidth:520,paddingTop:26}}>
  {msg&&<div className="pay-toast">{msg}</div>}
  {err?<section className="pc"><div className="pay-empty"><span className="em">🧾</span>{err}<br/><small style={{color:'var(--t3)'}}>Tautan struk mungkin salah atau sudah kedaluwarsa.</small></div></section>
  :!d?<section className="pc"><div className="pay-sk" style={{height:320}}/></section>
  :<>
   <section className="pc" ref={box}>
    <div className="qr-done">
     <div className="qr-tick" style={{background:d.status==='paid'?'linear-gradient(145deg,#34d399,#059669)':d.status==='pending'?'linear-gradient(145deg,#fbbf24,#d97706)':'linear-gradient(145deg,#fb7185,#e11d48)'}}>
      {d.status==='paid'?'✓':d.status==='pending'?'⏳':'✕'}</div>
     <h1 style={{margin:0,fontSize:21}}>{d.status==='paid'?'Pembayaran Berhasil':d.status==='pending'?'Menunggu Pembayaran':'Transaksi '+d.status}</h1>
     <div className="qr-amt mono">{rp(d.total_paid||d.amount)}<small style={{marginTop:6}}>TOTAL DIBAYAR</small></div>
    </div>
    {d.status==='pending'&&d.qr_image&&<div className="qr-wrap" style={{marginTop:6}}>
     <div className="qr-box"><img src={d.qr_image} alt="Kode QRIS"/></div>
     <p style={{color:'var(--t2)',fontSize:12.5,margin:0}}>Scan dengan aplikasi apa saja yang mendukung QRIS</p></div>}
    <div style={{marginTop:18,borderTop:'1px dashed var(--line2)',paddingTop:14,display:'grid',gap:11}}>
     {[['ID Transaksi',d.transaction_id],['Nominal',rp(d.amount)],['Metode','QRIS'],['Dibuat',dt(d.created_at)],
       ...(d.paid_at?[['Dibayar',dt(d.paid_at)]]:[]),...(d.merchant?[['Merchant',d.merchant]]:[])].map(([k,v])=>
      <div key={k} style={{display:'flex',justifyContent:'space-between',gap:14,fontSize:13.5}}>
       <span style={{color:'var(--t3)'}}>{k}</span><b className="mono" style={{textAlign:'right',wordBreak:'break-all'}}>{v}</b></div>)}
     <div style={{display:'flex',justifyContent:'space-between',gap:14,fontSize:13.5}}>
      <span style={{color:'var(--t3)'}}>Status</span><span className={'st '+d.status}>{d.status}</span></div>
    </div>
   </section>
   <div className="pay-row" style={{marginTop:14,justifyContent:'center'}}>
    <button className="pb" onClick={unduh}>⬇ Unduh gambar struk</button>
    <button className="pb gh" onClick={bagikan}>🔗 Bagikan</button></div>
   <p style={{textAlign:'center',color:'var(--t3)',fontSize:12,marginTop:18}}>Struk dibuat otomatis oleh sistem — tidak perlu tanda tangan.</p>
  </>}
 </div></div>}
