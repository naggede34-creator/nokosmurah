'use client'
import {useState,useEffect,useCallback,useMemo} from 'react'
import Toast from '../../components/ui/Toast'
import '../suntik/suntik.css'
// PRODUK LAINNYA — toko produk digital (link, teks, foto, file) yang diatur admin. Kerangka & gaya sama dengan Suntik Sosmed.
const api=async(p,body,m)=>{try{const r=await fetch('/api/'+p,{method:m||(body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return await r.json()}catch(e){return {error:'Koneksi bermasalah, coba lagi'}}}
const rr=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const nf=n=>(+n||0).toLocaleString('id-ID')
const TL={text:'TEKS',link:'LINK',photo:'FOTO',file:'FILE'}
const kb=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB'
const Ico=({p})=><>{p.iconUrl?<img src={p.iconUrl} alt="" loading="lazy" decoding="async"/>:p.emoji}</>
export default function Produk(){
 const [me,setMe]=useState(),[items,setItems]=useState(null),[orders,setOrders]=useState(null),[tab,setTab]=useState('toko'),[msg,setMsg]=useState('')
 const [sel,setSel]=useState(null),[qty,setQty]=useState(1),[busy,setBusy]=useState(false),[q,setQ]=useState('')
 const loadMe=useCallback(async()=>{const m=await api('v1/me');setMe(m.error?null:m)},[])
 const loadOrders=useCallback(async()=>{const d=await api('v1/prod/orders');if(d.items)setOrders(d.items)},[])
 useEffect(()=>{Promise.all([loadMe(),api('v1/prod/list').then(d=>setItems(d.items||[])),loadOrders()])},[loadMe,loadOrders])
 const list=useMemo(()=>(items||[]).filter(p=>!q||(p.name+' '+p.desc).toLowerCase().includes(q.toLowerCase())),[items,q])
 const open=p=>{setSel(p);setQty(1)}
 const max=sel?(sel.stock===null?10:Math.min(10,sel.stock)):1
 const buy=async()=>{if(busy)return;setBusy(true);const d=await api('v1/prod/buy',{id:sel.id,qty});setBusy(false)
  if(d.error){setMsg(d.error);return}setSel(null);setMsg('Pembelian berhasil! Data produk ada di tab Pembelian saya.');setTab('beli')
  await Promise.all([loadMe(),loadOrders(),api('v1/prod/list').then(x=>setItems(x.items||[]))])}
 const copy=t=>{navigator.clipboard&&navigator.clipboard.writeText(t);setMsg('Disalin')}
 if(me===undefined)return <div className="app"><div className="shell sx"><div className="sx-sk" style={{height:190,marginTop:60}}/><div className="sx-sk"/></div></div>
 if(!me){if(typeof window!=='undefined')location.href='/login';return <p style={{padding:20}}>Mengalihkan ke halaman masuk...</p>}
 const total=sel?sel.price*qty:0
 return <div className="app"><div className="shell sx">
  <div className="sx-top"><a className="sx-back" href="/dashboard" aria-label="Kembali ke dashboard">🏠</a><div className="sx-bal"><small>SALDO</small><b>{rr(me.balance)}</b></div></div>
  <div className="sx-hero alt"><span className="sx-new">TOKO</span><span className="sx-kick">ARTAPEDIA ID</span><h1 className="sx-h1">PRODUK<br/><em>LAINNYA</em></h1>
   <p className="sx-sub">Akun, voucher, file, template, dan produk digital lain. Bayar pakai saldo, data langsung dikirim.</p></div>
  <div className="sx-tabs" role="tablist"><button role="tab" aria-selected={tab==='toko'} className={'sx-tab'+(tab==='toko'?' on':'')} onClick={()=>setTab('toko')}>TOKO</button><button role="tab" aria-selected={tab==='beli'} className={'sx-tab'+(tab==='beli'?' on':'')} onClick={()=>setTab('beli')}>PEMBELIAN SAYA{orders&&orders.length>0&&<b>{orders.length}</b>}</button></div>
  {tab==='toko'&&<>
   {items&&items.length>3&&<input className="sx-in" placeholder="Cari produk…" value={q} onChange={e=>setQ(e.target.value)}/>}
   {items===null&&<div className="sx-pgrid">{[0,1,2,3].map(i=><div key={i} className="sx-sk" style={{height:190}}/>)}</div>}
   {items&&items.length===0&&<div className="sx-empty"><div className="em">🛒</div><h3>Belum ada produk</h3><p>Admin belum menambahkan produk. Cek lagi nanti ya.</p></div>}
   {items&&items.length>0&&<div className="sx-pgrid">{list.map(p=>{const out=p.stock===0,low=p.stock!==null&&p.stock>0&&p.stock<=3
    return <button key={p.id} className="sx-prod" disabled={out} onClick={()=>open(p)}><div className="sx-pic"><span className="sx-type">{TL[p.type]}</span><Ico p={p}/></div><b>{p.name}</b>
     <div className="pr"><strong>{p.price?rr(p.price):'GRATIS'}</strong><span className={'sx-stk'+(out?' out':low?' low':'')}>{out?'HABIS':p.stock===null?'READY':'Stok '+nf(p.stock)}</span></div></button>})}</div>}
   {items&&items.length>0&&list.length===0&&<p className="sx-hint">Produk tidak ditemukan.</p>}</>}
  {tab==='beli'&&(orders===null?<div className="sx-sk" style={{height:160}}/>:orders.length===0?<div className="sx-empty"><div className="em">🧾</div><h3>Belum ada pembelian</h3><p>Produk yang kamu beli muncul di sini, lengkap dengan datanya.</p><button className="sx-btn" onClick={()=>setTab('toko')}>LIHAT PRODUK</button></div>:
   orders.map(o=><div key={o.orderId} className="sx-ord" style={{'--c':'#5b4bd1'}}>
    <div className="sx-oh"><div><b>{o.emoji} {o.name}</b><small>#{o.orderId} · {o.qty}× · {rr(o.price)} · {new Date(o.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</small></div><span className="sx-tag success">{TL[o.dataType]}</span></div>
    {o.items.map((it,i)=><div key={i} className="sx-dv"><div className="row"><span>{it}</span>{o.dataType==='link'?<a href={it} target="_blank" rel="noopener noreferrer">BUKA</a>:null}<button onClick={()=>copy(it)}>SALIN</button></div></div>)}
    {o.dataType==='photo'&&o.hasFile&&<img className="sx-dimg" alt={o.name} src={'/api/v1/prod/file?inline=1&id='+o.orderId}/>}
    {o.hasFile&&<div className="sx-acts"><a className="sx-btn s g" href={'/api/v1/prod/file?id='+o.orderId} download>⬇️ Unduh {o.dataType==='photo'?'foto':o.fileName.slice(0,22)} ({kb(o.fileSize)})</a></div>}</div>))}
  <div className="sx-info"><b>Ketentuan singkat</b>Produk digital tidak bisa dikembalikan setelah data terkirim. Simpan datanya dengan aman. Ada kendala? Hubungi CS lewat tombol bantuan.</div>
  {sel&&<div className="sx-bk" onClick={e=>e.target===e.currentTarget&&setSel(null)}><div className="sx-sh" role="dialog" aria-modal="true"><div className="sx-gr"/>
   <div className="sx-pd"><div className="sx-big"><Ico p={sel}/></div><h3>{sel.name}</h3><div className="pc">{sel.price?rr(sel.price):'GRATIS'}</div>
    <div className="sx-meta"><span>{TL[sel.type]}</span><span>{sel.stock===null?'Stok tersedia':'Stok '+nf(sel.stock)}</span>{sel.type==='file'||sel.type==='photo'?<span>Langsung unduh</span>:<span>Langsung dikirim</span>}</div></div>
   {sel.desc&&<div className="sx-desc">{sel.desc}</div>}
   <div className="sx-qty"><b>Jumlah</b><div className="st"><button disabled={qty<=1} onClick={()=>setQty(x=>Math.max(1,x-1))} aria-label="Kurangi">−</button><b>{qty}</b><button disabled={qty>=max} onClick={()=>setQty(x=>Math.min(max,x+1))} aria-label="Tambah">+</button></div></div>
   <div className="sx-total"><small>TOTAL BAYAR</small><b>{rr(total)}</b><p>Saldo kamu {rr(me.balance)}. Data dikirim begitu pembayaran berhasil.</p></div>
   <button className="sx-btn p f" disabled={busy||me.balance<total} onClick={buy}>{busy?'Memproses…':me.balance<total?'Saldo kurang':'BELI SEKARANG'}</button>
   {me.balance<total&&<p className="sx-hint"><a href="/deposit">Isi saldo dulu →</a></p>}</div></div>}
  <Toast msg={msg} onClose={()=>setMsg('')}/>
 </div></div>}
