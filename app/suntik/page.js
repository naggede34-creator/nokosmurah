'use client'
import {useState,useEffect,useCallback} from 'react'
import Toast from '../../components/ui/Toast'
import Struk from '../../components/Struk'
import Skeleton from '../../components/ui/Skeleton'
// Halaman SUNTIK SOSMED. Tampilan dan alurnya meniru Beli Nokos di dashboard:
// kartu panduan, pesanan aktif, lalu sheet bertahap (platform -> layanan -> target & jumlah).
const api=async(p,body,m)=>{const r=await fetch('/api/'+p,{method:m||(body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return r.json().catch(()=>({error:'Server tidak merespons'}))}
const rr=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const nf=n=>(+n||0).toLocaleString('id-ID')
const ST={pending:['Menunggu','🟡'],processing:['Diproses','🔵'],success:['Berhasil','🟢'],partial:['Sebagian','🟠'],cancelled:['Dibatalkan','⚫']}
const fin=o=>['success','partial','cancelled'].includes(o.status)
export default function Suntik(){
 const [me,setMe]=useState(),[plats,setPlats]=useState(null),[orders,setOrders]=useState([]),[msg,setMsg]=useState(''),[struk,setStruk]=useState(null)
 const [sheet,setSheet]=useState(false),[step,setStep]=useState(1),[pf,setPf]=useState(''),[svc,setSvc]=useState(null),[qs,setQs]=useState(''),[sel,setSel]=useState(null)
 const [link,setLink]=useState(''),[qty,setQty]=useState(''),[cm,setCm]=useState(''),[busy,setBusy]=useState(''),[tab,setTab]=useState('aktif')
 const load=useCallback(async()=>{
  const m=await api('v1/me');if(m.error){setMe(null);return}setMe(m)
  setOrders((await api('v1/smm/orders?limit=100')).items||[])},[])
 useEffect(()=>{load();api('v1/smm/platforms').then(d=>setPlats(d))},[load])
 useEffect(()=>{if(!me)return;const t=setInterval(async()=>{const a=orders.filter(o=>!fin(o));if(!a.length)return;for(const o of a.slice(0,8))await api('v1/smm/status?order_id='+o.orderId);load()},8000);return()=>clearInterval(t)},[me,orders,load])
 useEffect(()=>{if(sheet&&step===2&&pf){setSvc(null);api('v1/smm/services?platform='+encodeURIComponent(pf)).then(d=>{setSvc(d.items||[]);if(d.error)setMsg(d.error)})}},[sheet,step,pf])
 const open=()=>{setPf('');setSel(null);setQs('');setLink('');setQty('');setCm('');setStep(1);setSheet(true)}
 const pickSvc=s=>{setSel(s);setQty(String(s.min));setCm('');setStep(3)}
 const n=sel?(sel.type==='comments'?cm.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).length:Math.floor(+qty||0)):0
 const est=sel?Math.ceil(sel.rate*n/1000-1e-9):0
 const okQ=sel&&n>=sel.min&&n<=sel.max
 const buy=async()=>{if(busy)return;setBusy('buy');const d=await api('v1/smm/order',{serviceId:sel.id,link:link.trim(),quantity:n,comments:cm});setBusy('')
  if(d.error){setMsg(d.error);return}setSheet(false);setMsg('Pesanan dibuat! Struk & notifikasi dikirim otomatis.');setTab('aktif');load()}
 const act=async(o,a)=>{if(busy)return;if(a==='cancel'&&!confirm('Batalkan pesanan ini? Kalau berhasil, saldo kembali.'))return
  setBusy(o.orderId+a);const d=await api('v1/smm/'+a,{order_id:o.orderId});setBusy('');setMsg(d.error||(a==='refill'?'Refill diminta ke penyedia':'Permintaan pembatalan dikirim'));load()}
 if(me===undefined)return <div className="app"><div className="shell"><Skeleton className="sk-hero"/><Skeleton className="sk-card"/></div></div>
 if(!me){if(typeof window!=='undefined')location.href='/login';return <p>Mengalihkan ke halaman masuk...</p>}
 const act1=orders.filter(o=>!fin(o)||Date.now()-new Date(o.createdAt).getTime()<30*60000),hist=orders.filter(o=>fin(o))
 const apps=(svc||[]).filter(s=>(s.name+' '+s.category).toLowerCase().includes(qs.toLowerCase()))
 const groups=[...new Set(apps.map(s=>s.category))]
 const List=({items})=>items.length===0?<div className="emp"><b style={{fontSize:18}}>Belum ada pesanan</b><p className="hint">Pesanan suntik sosmed kamu muncul di sini beserta progresnya.</p><button className="pbtn" onClick={open}>PESAN SEKARANG</button></div>
  :items.map(o=>{const [t,ic]=ST[o.status]||[o.status,'⚪'],done=o.quantity?Math.max(0,Math.min(100,((o.quantity-(o.remains==null?o.quantity:o.remains))/o.quantity)*100)):0
   return <div key={o.orderId} className="ao"><div className="hd"><div><b>{o.serviceName}</b><small>Order #{o.orderId} · {nf(o.quantity)} · {rr(o.price)}</small></div><span className={'wp'+(o.status==='success'?' ok':'')}>{ic} {t}</span></div>
   <div className="nb"><div><span>Target</span><button onClick={()=>{navigator.clipboard?.writeText(o.link);setMsg('Link disalin')}}>Salin</button></div><b className="mono" style={{wordBreak:'break-all',fontSize:13}}>{o.link}</b></div>
   <div className="wt"><div className="br"><span>Progres{o.startCount!=null?' · awal '+nf(o.startCount):''}</span><b className="mono">{o.remains==null?'-':nf(o.quantity-o.remains)+'/'+nf(o.quantity)}</b></div><div className="pb"><i style={{width:(o.status==='success'?100:done)+'%'}}/></div>
   {o.refunded>0&&<small className="hint">Saldo dikembalikan {rr(o.refunded)}</small>}
   {o.refill&&<small className="hint">♻️ Refill #{o.refill.id}: {o.refill.status==='completed'?'selesai':o.refill.status==='rejected'?'ditolak':'diproses'}</small>}
   {o.cancelQueued&&<small className="hint">⏳ Pembatalan menunggu penyedia</small>}</div>
   <div className="ob"><button onClick={()=>setStruk({item:o,kind:'smm'})}>🧾 Struk</button>
    {o.canRefill?<button disabled={busy===o.orderId+'refill'} onClick={()=>act(o,'refill')}>♻️ Refill</button>:<button onClick={()=>{setPf(o.platform);setStep(2);setSheet(true)}}>Pesan lagi</button>}
    <button disabled={!o.canCancel||busy===o.orderId+'cancel'} onClick={()=>act(o,'cancel')}>Batal</button></div></div>})
 return <div className="app"><div className="shell">
  <div className="top"><a className="av" href="/dashboard" aria-label="Kembali">🏠</a><button className="pill" onClick={()=>setTab('aktif')}>🚀 Pesanan aktif <b className="mono">{orders.filter(o=>!fin(o)).length}</b></button><span className="pf" style={{display:'grid',placeItems:'center',padding:'0 12px',fontWeight:900}}>{rr(me.balance)}</span></div>
  {plats&&plats.on===false&&<div className="c">Layanan Suntik Sosmed sedang tidak tersedia.</div>}
  <div className="cxb"><h3>SUNTIK SOSMED!</h3><ol><li><b>1</b>Pilih platform</li><li><b>2</b>Pilih layanan</li><li><b>3</b>Isi link & jumlah</li><li><b>4</b>Pantau hasil</li></ol></div>
  <div className="tabs2" style={{display:'flex',gap:8,margin:'10px 0'}}>{[['aktif','Pesanan aktif'],['riwayat','Riwayat']].map(([k,t])=><button key={k} className={'pbtn'} style={{flex:1,opacity:tab===k?1:.55}} onClick={()=>setTab(k)}>{t}</button>)}</div>
  {tab==='aktif'?<><List items={act1}/>{act1.length>0&&<button className="pbtn" style={{width:'100%'}} onClick={open}>+ PESAN LAGI</button>}</>:<List items={hist}/>}
  <div className="inf"><b>Refill & batal</b><p>Refill hanya untuk layanan bertanda ♻️ dan pesanan yang sudah selesai. Pembatalan tergantung penyedia; saldo kembali otomatis begitu pesanan resmi dibatalkan. Pesanan yang hanya terkirim sebagian di-refund sesuai sisanya.</p></div>
  {sheet&&<div className="bk" onClick={e=>e.target===e.currentTarget&&setSheet(false)}><div className="sheet"><div className="gr"/>
   <div className="tt"><div><h2>SUNTIK SOSMED</h2><small>{step===1?'langkah 1 · pilih platform':step===2?pf+' · pilih layanan':'isi target & jumlah'}</small></div><div className="sd">Saldo<b>{rr(me.balance)}</b></div></div>
   <div className="stp">{[['Platform',1],['Layanan',2],['Detail',3]].map(([t,i])=><span key={i} className={step>i?'done':step===i?'cur':''}><i>{step>i?'✓':i}</i>{t}</span>)}</div>
   {step===1&&<><p style={{color:'#55657f',fontSize:17}}>Mau suntik ke mana?</p>{!plats&&<Skeleton className="sk-row"/>}
    <div className="tg">{(plats&&plats.items||[]).map(p=><button key={p.name} className="tgc" onClick={()=>{setPf(p.name);setStep(2);setQs('')}}><span className="tgi" style={{background:p.c}}>{p.ic}</span><b>{p.name}</b><small>{p.n} layanan</small></button>)}</div>
    {plats&&plats.items&&plats.items.length===0&&<p className="hint">Belum ada layanan aktif.</p>}</>}
   {step===2&&<><button className="bkl" onClick={()=>setStep(1)}>← Ganti platform</button><input className="sin" placeholder="Cari layanan (followers, likes, views...)" value={qs} onChange={e=>setQs(e.target.value)}/>
    {!svc&&<div className="sk-list">{[0,1,2,3].map(i=><Skeleton key={i} className="sk-row"/>)}</div>}
    {groups.map(g=><div key={g}><div className="h3s">{g}</div>{apps.filter(s=>s.category===g).slice(0,60).map(s=><button key={s.id} className="sv" onClick={()=>pickSvc(s)}><div><b>{s.name}</b><p>min {nf(s.min)} · max {nf(s.max)}{s.refill?' · ♻️ refill':''}{s.cancel?' · ✖ bisa batal':''}</p></div><div className="rt"><small>per 1000</small><b>{rr(s.rate)}</b></div></button>)}</div>)}
    {svc&&apps.length===0&&<p className="hint">Layanan tidak ditemukan.</p>}</>}
   {step===3&&sel&&<><button className="sel" onClick={()=>setStep(2)}><span className="lt" style={{width:44,height:44}}>🚀</span><div><b>{sel.name}</b><small>{sel.category} · {rr(sel.rate)}/1000</small></div></button>
    <input className="sin" style={{marginTop:14}} placeholder="Link / username target" value={link} onChange={e=>setLink(e.target.value)} autoCapitalize="off" autoCorrect="off"/>
    {sel.type==='comments'?<textarea className="sin" rows={5} style={{marginTop:10}} placeholder="Satu komentar per baris" value={cm} onChange={e=>setCm(e.target.value)}/>
     :<input className="sin" style={{marginTop:10}} type="number" inputMode="numeric" placeholder={'Jumlah ('+nf(sel.min)+' – '+nf(sel.max)+')'} value={qty} onChange={e=>setQty(e.target.value)}/>}
    <div className="inf" style={{marginTop:12}}><b>Total {okQ?rr(est):'-'}</b><p>{okQ?nf(n)+' × '+rr(sel.rate)+' per 1000':'Jumlah harus '+nf(sel.min)+' – '+nf(sel.max)}. Pastikan akun target tidak digembok dan tidak ada pesanan lain di link yang sama.</p></div>
    <button className="pbtn" style={{width:'100%'}} disabled={!okQ||link.trim().length<3||busy==='buy'||me.balance<est} onClick={buy}>{busy==='buy'?'Memproses…':me.balance<est?'Saldo kurang':'ORDER SEKARANG'}</button>
    {me.balance<est&&<a className="hint" href="/deposit">Isi saldo dulu →</a>}</>}
  </div></div>}
  {struk&&<Struk item={struk.item} kind={struk.kind} onClose={()=>setStruk(null)} onMsg={setMsg}/>}
  <Toast msg={msg} onClose={()=>setMsg('')}/>
 </div></div>}
