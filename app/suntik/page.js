'use client'
import {useState,useEffect,useCallback,useMemo,useRef} from 'react'
import dynamic from 'next/dynamic'
import Toast from '../../components/ui/Toast'
import './suntik.css'
const Struk=dynamic(()=>import('../../components/Struk'),{ssr:false})   // hanya diunduh saat tombol Struk ditekan
// SUNTIK SOSMED — tampilan manga 3D. Alur sama dengan Beli Nokos: sheet bertahap platform → layanan → target & jumlah.
// Cepat: data dimuat paralel, daftar layanan di-cache per platform (dan di-prefetch saat jari menyentuh kartu platform),
// polling berhenti saat tab tersembunyi, dan hanya memuat ulang yang berubah.
const api=async(p,body,m)=>{try{const r=await fetch('/api/'+p,{method:m||(body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return await r.json()}catch(e){return {error:'Koneksi bermasalah, coba lagi'}}}
const rr=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const nf=n=>(+n||0).toLocaleString('id-ID')
const ST={pending:'MENUNGGU',processing:'DIPROSES',success:'BERHASIL',partial:'SEBAGIAN',cancelled:'BATAL'}
const fin=o=>['success','partial','cancelled'].includes(o.status)
const SC=new Map()   // cache layanan per platform (hidup selama tab terbuka)
const getSvc=pf=>{if(!SC.has(pf))SC.set(pf,api('v1/smm/services?platform='+encodeURIComponent(pf)).then(d=>{if(d.error)SC.delete(pf);return d}));return SC.get(pf)}
const STEPS=[['Pilih platform'],['Pilih layanan'],['Isi link & jumlah'],['Pantau hasil']]
export default function Suntik(){
 const [me,setMe]=useState(),[plats,setPlats]=useState(null),[orders,setOrders]=useState(null),[msg,setMsg]=useState(''),[struk,setStruk]=useState(null)
 const [sheet,setSheet]=useState(false),[step,setStep]=useState(1),[pf,setPf]=useState(''),[svc,setSvc]=useState(null),[qs,setQs]=useState(''),[sel,setSel]=useState(null),[lim,setLim]=useState(60)
 const [link,setLink]=useState(''),[qty,setQty]=useState(''),[cm,setCm]=useState(''),[busy,setBusy]=useState(''),[tab,setTab]=useState('aktif')
 const ord=useRef([]);ord.current=orders||[]
 const loadOrders=useCallback(async()=>{const d=await api('v1/smm/orders?limit=100');if(d.items)setOrders(d.items)},[])
 const loadMe=useCallback(async()=>{const m=await api('v1/me');if(m.error)setMe(null);else setMe(m)},[])
 useEffect(()=>{Promise.all([loadMe(),loadOrders(),api('v1/smm/platforms').then(setPlats)])},[loadMe,loadOrders])
 useEffect(()=>{if(!me)return;let n=0
  const t=setInterval(async()=>{if(document.hidden)return;n++
   const a=ord.current.filter(o=>!fin(o)).slice(0,6)
   if(a.length){await Promise.all(a.map(o=>api('v1/smm/status?order_id='+o.orderId)));await loadOrders()}
   if(n%8===0)loadMe()},8000)
  return()=>clearInterval(t)},[me,loadOrders,loadMe])
 useEffect(()=>{if(!(sheet&&step===2&&pf))return;let on=true;setSvc(null);setLim(60);getSvc(pf).then(d=>{if(!on)return;setSvc(d.items||[]);if(d.error)setMsg(d.error)});return()=>{on=false}},[sheet,step,pf])
 const open=()=>{setPf('');setSel(null);setQs('');setLink('');setQty('');setCm('');setStep(1);setSheet(true)}
 const pickSvc=s=>{setSel(s);setQty(String(s.min));setCm('');setStep(3)}
 const n=sel?(sel.type==='comments'?cm.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length:Math.floor(+qty||0)):0
 const est=sel?Math.ceil(sel.rate*n/1000-1e-9):0
 const okQ=!!sel&&n>=sel.min&&n<=sel.max
 const buy=async()=>{if(busy)return;setBusy('buy');const d=await api('v1/smm/order',{serviceId:sel.id,link:link.trim(),quantity:n,comments:cm});setBusy('')
  if(d.error){setMsg(d.error);return}setSheet(false);setMsg('Pesanan dibuat! Notifikasi dan struk dikirim otomatis.');setTab('aktif');loadOrders();loadMe()}
 const act=async(o,a)=>{if(busy)return;if(a==='cancel'&&!confirm('Batalkan pesanan ini? Kalau disetujui penyedia, saldo kembali otomatis.'))return
  setBusy(o.orderId+a);const d=await api('v1/smm/'+a,{order_id:o.orderId});setBusy('');setMsg(d.error||(a==='refill'?'Refill diminta ke penyedia':'Permintaan pembatalan dikirim'));loadOrders();loadMe()}
 const color=useMemo(()=>Object.fromEntries(((plats&&plats.items)||[]).map(p=>[p.name,p.c])),[plats])
 const apps=useMemo(()=>{const q=qs.toLowerCase();return (svc||[]).filter(s=>!q||(s.name+' '+s.category).toLowerCase().includes(q))},[svc,qs])
 const shown=apps.slice(0,lim),groups=[...new Set(shown.map(s=>s.category))]
 if(me===undefined)return <div className="app"><div className="shell sx"><div className="sx-sk" style={{height:200,marginTop:60}}/><div className="sx-sk"/><div className="sx-sk"/></div></div>
 if(!me){if(typeof window!=='undefined')location.href='/login';return <p style={{padding:20}}>Mengalihkan ke halaman masuk...</p>}
 const list=orders||[],active=list.filter(o=>!fin(o)),recent=list.filter(o=>fin(o)&&Date.now()-new Date(o.createdAt).getTime()<30*60000),hist=list.filter(fin)
 const show=tab==='aktif'?[...active,...recent]:hist
 const Card=({o})=>{const pg=o.quantity?Math.max(0,Math.min(100,((o.quantity-(o.remains==null?o.quantity:o.remains))/o.quantity)*100)):0
  return <div className="sx-ord" style={{'--c':color[o.platform]||'#2f6df0'}}>
   <div className="sx-oh"><div><b>{o.serviceName}</b><small>Order #{o.orderId} · {nf(o.quantity)} · {rr(o.price)}</small></div><span className={'sx-tag '+o.status}>{ST[o.status]||o.status}</span></div>
   <div className="sx-link"><span style={{flex:1,minWidth:0}}>{o.link}</span><button onClick={()=>{navigator.clipboard&&navigator.clipboard.writeText(o.link);setMsg('Link disalin')}}>SALIN</button></div>
   <div className="sx-gauge"><div className="sx-gh"><span>Progres{o.startCount!=null?' · awal '+nf(o.startCount):''}</span><b>{o.remains==null?'-':nf(o.quantity-o.remains)+' / '+nf(o.quantity)}</b></div>
    <div className={'sx-bar'+(!fin(o)?' live':'')}><i style={{width:(o.status==='success'?100:pg)+'%'}}/></div></div>
   {o.refunded>0&&<div className="sx-note">💸 Saldo dikembalikan {rr(o.refunded)}</div>}
   {o.refill&&<div className="sx-note">♻️ Refill #{o.refill.id}: {o.refill.status==='completed'?'selesai':o.refill.status==='rejected'?'ditolak':'diproses'}</div>}
   {o.cancelQueued&&<div className="sx-note">⏳ Pembatalan menunggu penyedia</div>}
   <div className="sx-acts"><button className="sx-btn s w" onClick={()=>setStruk({item:o,kind:'smm'})}>🧾 Struk</button>
    {o.canRefill?<button className="sx-btn s g" disabled={busy===o.orderId+'refill'} onClick={()=>act(o,'refill')}>♻️ Refill</button>:<button className="sx-btn s b" onClick={()=>{setPf(o.platform);setSel(null);setStep(2);setSheet(true)}}>Pesan lagi</button>}
    {!fin(o)&&<button className="sx-btn s p" disabled={!o.canCancel||busy===o.orderId+'cancel'} onClick={()=>act(o,'cancel')}>Batal</button>}</div></div>}
 return <div className="app"><div className="shell sx">
  <div className="sx-top"><a className="sx-back" href="/dashboard" aria-label="Kembali ke dashboard">🏠</a><div className="sx-bal"><small>SALDO</small><b>{rr(me.balance)}</b></div></div>
  <div className="sx-hero"><div className="sx-new"><span>NEW!</span></div>
   <span className="sx-kick">ARTAPEDIA ID</span>
   <h1 className="sx-h1">SUNTIK<br/><em>SOSMED!</em></h1>
   <p className="sx-sub">Followers, likes, views, dan lainnya. Tinggal pilih, tempel link, order!</p>
   <button className="sx-btn sx-cta" onClick={open} disabled={plats&&plats.on===false}>🚀 PESAN SEKARANG</button></div>
  {plats&&plats.on===false&&<div className="sx-info"><b>Sedang tidak tersedia</b>Layanan Suntik Sosmed sedang dimatikan sementara.</div>}
  <div className="sx-steps">{STEPS.map(([t],i)=><div key={i} className="sx-st"><b>{i+1}</b>{t}</div>)}</div>
  <div className="sx-tabs" role="tablist"><button role="tab" aria-selected={tab==='aktif'} className={'sx-tab'+(tab==='aktif'?' on':'')} onClick={()=>setTab('aktif')}>PESANAN{active.length>0&&<b>{active.length}</b>}</button><button role="tab" aria-selected={tab==='riwayat'} className={'sx-tab'+(tab==='riwayat'?' on':'')} onClick={()=>setTab('riwayat')}>RIWAYAT</button></div>
  {orders===null?<><div className="sx-sk" style={{height:190}}/></>:show.length===0?<div className="sx-empty"><div className="em">🚀</div><h3>Belum ada pesanan</h3><p>Pesananmu muncul di sini lengkap dengan progres dan struk.</p><button className="sx-btn" onClick={open}>PESAN SEKARANG</button></div>:show.map(o=><Card key={o.orderId} o={o}/>)}
  {tab==='aktif'&&show.length>0&&<button className="sx-btn f" onClick={open}>+ PESAN LAGI</button>}
  <div className="sx-info"><b>Refill &amp; pembatalan</b>Refill tersedia untuk layanan bertanda ♻️ setelah pesanan selesai. Pembatalan tergantung penyedia dan saldo kembali otomatis begitu disetujui. Pesanan yang hanya terkirim sebagian di-refund sesuai sisanya.</div>
  {sheet&&<div className="sx-bk" onClick={e=>e.target===e.currentTarget&&setSheet(false)}><div className="sx-sh" role="dialog" aria-modal="true"><div className="sx-gr"/>
   <div className="sx-sht"><div><h2>SUNTIK SOSMED</h2><small>{step===1?'Langkah 1 · pilih platform':step===2?pf+' · pilih layanan':'Langkah 3 · isi target & jumlah'}</small></div><div className="sx-sd">Saldo<b>{rr(me.balance)}</b></div></div>
   <div className="sx-pg">{[1,2,3].map((i,k)=><span key={i} style={{display:'contents'}}><span className={step>i?'done':step===i?'cur':''}>{step>i?'✓':i}</span>{k<2&&<i className={step>i?'done':''}/>}</span>)}</div>
   {step===1&&<><div className="sx-lbl">Mau suntik ke mana?</div>{!plats&&<><div className="sx-sk"/><div className="sx-sk"/></>}
    <div className="sx-tiles">{(plats&&plats.items||[]).map(p=><button key={p.name} className="sx-tile" style={{'--c':p.c}} onPointerEnter={()=>getSvc(p.name)} onTouchStart={()=>getSvc(p.name)} onClick={()=>{setPf(p.name);setStep(2);setQs('')}}><span className="sx-ico">{p.ic}</span><b>{p.name}</b><small>{p.n} layanan</small></button>)}</div>
    {plats&&plats.items&&plats.items.length===0&&<p className="sx-hint">Belum ada layanan aktif.</p>}</>}
   {step===2&&<><button className="sx-bkl" onClick={()=>setStep(1)}>← Ganti platform</button><input className="sx-in" placeholder="Cari layanan: followers, likes, views…" value={qs} onChange={e=>setQs(e.target.value)}/>
    {!svc&&[0,1,2,3].map(i=><div key={i} className="sx-sk"/>)}
    {groups.map(g=><div key={g}><div className="sx-rib">{g}</div>{shown.filter(s=>s.category===g).map(s=><button key={s.id} className="sx-svc" onClick={()=>pickSvc(s)}><div><b>{s.name}</b><p>Min {nf(s.min)} · Max {nf(s.max)}{s.refill?' · ♻️ refill':''}{s.cancel?' · ✖ bisa batal':''}</p></div><div className="sx-pt"><small>PER 1000</small><b>{rr(s.rate)}</b></div></button>)}</div>)}
    {apps.length>lim&&<button className="sx-btn f w" onClick={()=>setLim(l=>l+60)}>Tampilkan lebih banyak ({apps.length-lim})</button>}
    {svc&&apps.length===0&&<p className="sx-hint">Layanan tidak ditemukan.</p>}</>}
   {step===3&&sel&&<><button className="sx-sel" onClick={()=>setStep(2)}><span className="sx-ico" style={{'--c':color[pf]||'#2f6df0',width:46,height:46,fontSize:20}}>🚀</span><div><b>{sel.name}</b><small>{sel.category} · {rr(sel.rate)} / 1000 · ganti ›</small></div></button>
    <input className="sx-in" placeholder="Link / username target" value={link} onChange={e=>setLink(e.target.value)} autoCapitalize="off" autoCorrect="off"/>
    {sel.type==='comments'?<textarea className="sx-in" placeholder="Satu komentar per baris" value={cm} onChange={e=>setCm(e.target.value)}/>
     :<input className="sx-in" type="number" inputMode="numeric" placeholder={'Jumlah ('+nf(sel.min)+' – '+nf(sel.max)+')'} value={qty} onChange={e=>setQty(e.target.value)}/>}
    <div className="sx-total"><small>TOTAL BAYAR</small><b>{okQ?rr(est):'Rp–'}</b><p>{okQ?nf(n)+' × '+rr(sel.rate)+' per 1000. Pastikan akun target tidak digembok.':'Jumlah harus '+nf(sel.min)+' – '+nf(sel.max)+'.'}</p></div>
    <button className="sx-btn p f" disabled={!okQ||link.trim().length<3||busy==='buy'||me.balance<est} onClick={buy}>{busy==='buy'?'Memproses…':me.balance<est?'Saldo kurang':'ORDER SEKARANG'}</button>
    {me.balance<est&&<p className="sx-hint"><a href="/deposit">Isi saldo dulu →</a></p>}</>}
  </div></div>}
  {struk&&<Struk item={struk.item} kind={struk.kind} onClose={()=>setStruk(null)} onMsg={setMsg}/>}
  <Toast msg={msg} onClose={()=>setMsg('')}/>
 </div></div>}
