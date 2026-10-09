'use client'
import {useState,useEffect,useCallback} from 'react'
import Mascot from '../../components/Mascot'
const api=async(p,body,m)=>{const r=await fetch('/api/'+p,{method:m||(body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return r.json()}
const rp=n=>'Rp '+(+n||0).toLocaleString('id-ID')
const TG=process.env.NEXT_PUBLIC_TG_URL||'#',WA=process.env.NEXT_PUBLIC_WA_URL||'#'
const I={home:'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',wallet:'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h2',cart:'M3 4h2l2.4 11h10.2L20 7H6M9 20h.01M17 20h.01',ok:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',no:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',menu:'M4 7h12M4 12h16M4 17h9',sim:'M7 3h7l4 4v14H7zM10 12h5v6h-5z',down:'M6 9l6 6 6-6',out:'M7 17L17 7M8 7h9v9',plus:'M12 5v14M5 12h14'}
const Ic=({n,s=22})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={I[n]}/></svg>
const BL=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const K=v=>v>=1000?(v/1000)+'K':String(v)
function Chart({vals,labels,color,fmt}){
 const W=320,H=190,pad=22,max=Math.max(...vals,1),x=i=>pad+i*(W-2*pad)/(vals.length-1),y=v=>H-36-(v/max)*(H-96)
 const pts=vals.map((v,i)=>[x(i),y(v)])
 const d=pts.map((p,i)=>{if(!i)return `M${p[0]},${p[1]}`;const q=pts[i-1],cx=(q[0]+p[0])/2;return `C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`}).join('')
 const id='g'+color.slice(1)
 return <svg viewBox={`0 0 ${W} ${H}`} width="100%"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs>
  <line x1={pad} x2={W-pad} y1={H-36} y2={H-36} stroke="#cfd8e6" strokeDasharray="3 4"/>
  <path d={d+`L${pts[pts.length-1][0]},${H-36}L${pts[0][0]},${H-36}Z`} fill={`url(#${id})`}/><path d={d} fill="none" stroke={color} strokeWidth="3"/>
  {pts.map((p,i)=><g key={i}><text x={p[0]} y={p[1]-12} textAnchor="middle" className="cv">{fmt(vals[i])}</text><circle cx={p[0]} cy={p[1]} r="5" fill={i===pts.length-1?color:'#fff'} stroke={color} strokeWidth="3"/><text x={p[0]} y={H-10} textAnchor="middle" className="cl">{labels[i]}</text></g>)}</svg>}
const Head=({ic,t,s,tag})=><div className="ch"><div className="ic"><Ic n={ic}/></div><div><h3>{t}</h3><small>{s}</small></div>{tag&&<span className="tag mono">{tag}</span>}</div>
export default function D(){
 const [me,setMe]=useState(),[tab,setTab]=useState('home'),[msg,setMsg]=useState(''),[amt,setAmt]=useState(10000),[dep,setDep]=useState(null),[prov,setProv]=useState('')
 const [sv,setSv]=useState([]),[server,setServer]=useState('warungnokos_s1'),[svc,setSvc]=useState([]),[sel,setSel]=useState(''),[cs,setCs]=useState([]),[orders,setOrders]=useState([]),[mut,setMut]=useState([]),[now,setNow]=useState(Date.now()),[txt,setTxt]=useState(''),[qs,setQs]=useState('')
 const load=useCallback(async()=>{const m=await api('v1/me');if(m.error){setMe(null);return}setMe(m);setOrders((await api('v1/orders?limit=100')).items||[]);setMut((await api('v1/mutasi')).items||[])},[])
 useEffect(()=>{load();api('v1/servers').then(d=>setSv(d.items||[]));api('v1/deposit/methods').then(d=>setProv(d.methods?.[0]?.provider||''))},[load])
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[])
 useEffect(()=>{if(!msg)return;const t=setTimeout(()=>setMsg(''),4000);return()=>clearTimeout(t)},[msg])
 useEffect(()=>{if(!me)return;const t=setInterval(async()=>{for(const o of orders.filter(o=>o.status==='pending'))await api('v1/orders/status?order_id='+o.orderId);load()},5000);return()=>clearInterval(t)},[me,orders,load])
 useEffect(()=>{if(me&&tab==='buy')api('v1/services?server='+server).then(d=>{setSvc(d.items||[]);if(d.error)setMsg(d.error)})},[me,tab,server])
 useEffect(()=>{if(!dep)return;const t=setInterval(async()=>{const d=await api('v1/deposit?order_id='+dep.order_id);if(d.status&&d.status!=='pending'){setMsg('Deposit '+d.status);setDep(null);load()}},5000);return()=>clearInterval(t)},[dep,load])
 if(me===undefined)return <p>Memuat...</p>
 if(!me){if(typeof window!=='undefined')location.href='/login';return <p>Mengalihkan ke halaman masuk...</p>}
 const ok=orders.filter(o=>o.status==='success'),aktif=orders.filter(o=>o.status==='pending'),batal=orders.filter(o=>o.status==='cancelled'||o.status==='expired')
 const deps=mut.filter(m=>String(m.note).startsWith('Deposit')),tot=ok.length+aktif.length+batal.length,rate=tot?Math.round(ok.length/tot*100):0
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d}),dk=d=>new Date(d).toDateString(),lb=days.map(d=>d.getDate()+' '+BL[d.getMonth()])
 const cb=days.map(d=>ok.filter(o=>dk(o.createdAt)===dk(d)).length),cd=days.map(d=>deps.filter(m=>dk(m.at)===dk(d)).reduce((a,m)=>a+m.amt,0))
 const buy=async(c,x)=>{const b={server,serviceId:sel,serviceName:svc.find(s=>s.service_code===sel)?.service_name,countryName:c.name,providerId:x.provider_id,countryId:x.country_id};const d=await api('v1/order',b);setMsg(d.error||'Nomor: '+d.phoneNumber);load();if(!d.error)setTab('orders')}
 const pick=async v=>{setSel(v);setCs([]);const d=await api(`v1/countries?server=${server}&service_id=${v}`);d.error?setMsg(d.error):setCs(d.items)}
 const nav=[['home','Beranda','home'],['deposit','Deposit','wallet'],['buy','Beli nomor','sim'],['orders','Pesanan','cart'],['more','Lainnya','menu']]
 const sub=['mutasi','api','cs','tnc'].includes(tab)
 return <div className="app"><div className="shell">
 <div className="top"><button className="av" onClick={()=>setTab('home')}>🌍</button><button className="pill" onClick={()=>setTab('orders')}><Ic n="cart" s={20}/> Pesanan aktif <b className="mono">{aktif.length}</b></button><button className="pf" onClick={()=>setTab('more')}>{(me.name||'?')[0].toUpperCase()}</button></div>
 {msg&&<div className="toast">{msg}</div>}
 {tab==='home'&&<>
  <div className="hello"><div className="bubble"><small>ARTAPEDIA BILANG</small><span>Saldo aman. Tinggal pilih nomornya.</span></div><div className="mini"><Mascot/></div></div>
  {me.broadcast&&<div className="c" style={{padding:'12px 16px'}}>📢 {me.broadcast}</div>}
  <div className="c bal"><div className="ch"><div className="ic"><Ic n="wallet"/></div><b>Saldo tersedia</b></div><div className="big"><small>Rp</small> {(+me.balance).toLocaleString('id-ID')}</div><button className="dk" onClick={()=>setTab('deposit')}>+ Isi saldo</button></div>
  <div className="two"><div className="c"><div className="ch"><div className="ic"><Ic n="wallet" s={18}/></div><b>Total deposit</b></div><div className="mono num">{rp(deps.reduce((a,m)=>a+m.amt,0))}</div><small>{deps.length} deposit sukses</small></div>
  <div className="c"><div className="ch"><div className="ic"><Ic n="cart" s={18}/></div><b>Total belanja</b></div><div className="mono num">{rp(ok.reduce((a,o)=>a+o.price,0))}</div><small>{ok.length} pesanan sukses</small></div></div>
  <details className="c acc"><summary><div className="ic"><Ic n="sim"/></div>Cara membeli OTP<Ic n="down" s={18}/></summary><ol><li>Isi saldo lewat QRIS.</li><li>Buka Beli nomor, pilih server, layanan & negara.</li><li>Pakai nomor untuk daftar di aplikasi.</li><li>OTP muncul otomatis di Pesanan.</li></ol></details>
  <details className="c acc"><summary><div className="ic"><Ic n="wallet"/></div>Cara Deposit<Ic n="down" s={18}/></summary><ol><li>Buka Deposit, isi nominal, tekan Buat QRIS.</li><li>Bayar tepat sesuai total lewat bank / e-wallet.</li><li>Saldo masuk otomatis.</li></ol></details>
  <div className="c"><Head ic="ok" t="Pembelian berhasil" s="Tingkat keberhasilan, realtime" tag={null}/><div className="rate mono">{rate}%</div>
   <div className="pg"><i style={{width:rate+'%'}}/></div><div className="chips"><div className="chip"><span><Ic n="ok" s={18}/> Berhasil</span><b className="mono">{ok.length}</b></div><div className="chip"><span><Ic n="no" s={18}/> Batal</span><b className="mono">{batal.length}</b></div><div className="chip"><span><Ic n="clock" s={18}/> Aktif</span><b className="mono">{aktif.length}</b></div></div></div>
  <div className="c"><Head ic="cart" t="Statistik pembelian" s="7 hari terakhir" tag={cb.reduce((a,b)=>a+b,0)+' pembelian'}/><Chart vals={cb} labels={lb} color="#3b7fe0" fmt={String}/></div>
  <div className="c"><Head ic="wallet" t="Statistik deposit" s="7 hari terakhir" tag={rp(cd.reduce((a,b)=>a+b,0))}/><Chart vals={cd} labels={lb} color="#3d4b6b" fmt={K}/></div>
  <div className="two"><a className="c link" href={TG}><span className="soc" style={{background:'#229ed9'}}>✈</span>Telegram<Ic n="out" s={16}/></a><a className="c link" href={WA}><span className="soc" style={{background:'#25d366'}}>✆</span>WhatsApp<Ic n="out" s={16}/></a></div>
  <div className="foot"><div className="mini sm"><Mascot/></div><b>ARTAPEDIA ID</b><p>Artapedia ID adalah website penyedia layanan OTP berbasis nomor tanpa kartu fisik.</p></div></>}
 {tab==='deposit'&&<div className="c"><Head ic="wallet" t="Isi saldo" s="QRIS otomatis, saldo masuk sendiri"/>
  {dep?<div style={{textAlign:'center'}}><p>Bayar tepat <b>{rp(dep.total_amount)}</b></p><img alt="QRIS" width="240" src={dep.qr_image||'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data='+encodeURIComponent(dep.qr_string)}/></div>
  :<><div className="qa">{[10000,20000,50000,100000].map(v=><button key={v} className={amt==v?'on':''} onClick={()=>setAmt(v)}>{K(v)}</button>)}</div><input type="number" value={amt} onChange={e=>setAmt(e.target.value)}/><button className="dk" onClick={async()=>{const d=await api('v1/deposit',{amount:amt,provider:prov});d.error?setMsg(d.error):setDep(d)}}>Buat QRIS</button></>}</div>}
 {tab==='buy'&&<div className="c"><Head ic="sim" t="Beli nomor" s="Pilih server, layanan, lalu negara"/>
  <div className="qa">{sv.map(s=><button key={s.server} className={server===s.server?'on':''} onClick={()=>{setServer(s.server);setSel('');setCs([])}}>{s.name}</button>)}</div>
  <input placeholder="Cari layanan..." value={qs} onChange={e=>setQs(e.target.value)}/>
  <div className="svs">{svc.filter(s=>s.service_name.toLowerCase().includes(qs.toLowerCase())).slice(0,60).map(s=><button key={s.service_code} className={sel===s.service_code?'on':''} onClick={()=>pick(s.service_code)}>{s.service_name}</button>)}</div>
  {cs.map(c=>c.pricelist.map(x=><div key={x.provider_id+x.country_id} className="row"><span>{c.flag} {c.name} {x.provider_name}<small> · stok {x.stock??'-'}</small></span><button className="bt" onClick={()=>buy(c,x)}>{rp(x.sell_price)}</button></div>))}</div>}
 {tab==='orders'&&<>{orders.length===0&&<div className="c">Belum ada pesanan.</div>}{orders.map(o=>{const w=Math.ceil((new Date(o.createdAt).getTime()+120000-now)/1000);return <div key={o.orderId} className="c"><div className="row"><b>{o.serviceName}</b><span className={'st '+o.status}>{o.status}</span></div><div className="mono">{o.phoneNumber} · {rp(o.price)}</div>{o.otpCode&&<div className="otp mono">{o.otpCode}</div>}
  <div className="row2"><button className="bt" onClick={()=>{navigator.clipboard?.writeText(o.phoneNumber);setMsg('Nomor disalin')}}>Salin nomor</button>{o.status==='pending'&&<button className="bt sec" disabled={w>0} onClick={async()=>{const d=await api('v1/orders/cancel',{order_id:o.orderId});setMsg(d.error||'Dibatalkan, saldo kembali');load()}}>{w>0?`Batalkan (${w}s)`:'Batalkan & refund'}</button>}</div></div>})}</>}
 {tab==='more'&&<div className="c menu">{[['mutasi','Mutasi saldo'],['api','API Key & Docs'],['cs','Customer Service'],['tnc','Syarat & Ketentuan']].map(([k,t])=><button key={k} onClick={()=>setTab(k)}>{t}<Ic n="out" s={16}/></button>)}<button onClick={async()=>{await api('auth/logout',{});location.href='/login'}}>Keluar</button></div>}
 {tab==='mutasi'&&<div className="c"><Head ic="wallet" t="Mutasi saldo" s="Riwayat saldo masuk dan keluar"/>{mut.map((m,i)=><div key={i} className="row"><span>{m.note}<small> · {new Date(m.at).toLocaleString('id-ID')}</small></span><b className="mono" style={{color:m.amt>0?'#1a9b55':'#d04444'}}>{m.amt>0?'+':''}{m.amt}</b></div>)}</div>}
 {tab==='api'&&<div className="c"><Head ic="sim" t="API Key" s="Hubungkan ke web / bot kamu"/><code className="key mono">{me.apikey}</code><p>Header: <code>Authorization: Bearer KEY</code>. Dokumentasi: <a href="/docs"><u>/docs</u></a></p><button className="dk" onClick={async()=>{if(confirm('Key lama langsung mati. Lanjut?')){await api('v1/apikey',{});load()}}}>Buat ulang key</button></div>}
 {tab==='cs'&&<div className="c"><Head ic="menu" t="Customer Service" s="Pesan dikirim langsung ke admin"/><textarea rows="4" value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Tulis pesan..."/><button className="dk" onClick={async()=>{await api('v1/support',{text:txt});setTxt('');setMsg('Pesan terkirim ke admin')}}>Kirim</button></div>}
 {tab==='tnc'&&<div className="c"><Head ic="ok" t="Syarat & Ketentuan" s="Baca sebelum memakai layanan"/><ul><li>Saldo yang sudah masuk tidak dapat ditarik.</li><li>Nomor yang tidak menerima OTP otomatis direfund.</li><li>Dilarang dipakai untuk tindakan melanggar hukum.</li><li>Akun melanggar aturan dapat dibanned.</li></ul></div>}
 <div className="bn">{nav.map(([k,t,ic])=><button key={k} className={(k==='buy'?'mid ':'')+((tab===k||(k==='more'&&sub))?'on':'')} onClick={()=>setTab(k)}>{k==='buy'?<i><Ic n={ic} s={26}/></i>:<Ic n={ic}/>}<span>{t}</span></button>)}</div>
 </div></div>}
