'use client'
import {useState,useEffect,useCallback,useRef} from 'react'
import Mascot from '../../components/Mascot'
import {Announcements,Leaderboard} from '../../components/Boards'
import {RefPage,CashbackPage,usePromo} from '../../components/Promo'
import Drawer from '../../components/Drawer'
import SocialButtons from '../../components/SocialButtons'
import ApiPanel,{TgCard} from '../../components/ApiPanel'
import Toast from '../../components/ui/Toast'
import PushCard from '../../components/PushCard'
import Struk from '../../components/Struk'
import Skeleton from '../../components/ui/Skeleton'
const api=async(p,body,m)=>{const r=await fetch('/api/'+p,{method:m||(body?'POST':'GET'),headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return r.json()}
const rp=n=>'Rp '+(+n||0).toLocaleString('id-ID')
const rr=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const nf=n=>(+n||0).toLocaleString('id-ID')
const I={bell:'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',home:'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',wallet:'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h2',cart:'M3 4h2l2.4 11h10.2L20 7H6M9 20h.01M17 20h.01',ok:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',no:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',menu:'M4 7h12M4 12h16M4 17h9',sim:'M7 3h7l4 4v14H7zM10 12h5v6h-5z',down:'M6 9l6 6 6-6',out:'M7 17L17 7M8 7h9v9',plus:'M12 5v14M5 12h14',send:'M22 2L11 13M22 2l-7 20-4-9-9-4z',chev:'M9 6l6 6-6 6',bolt:'M13 2L4 14h7l-1 8 9-12h-7z',key:'M15 7a4 4 0 1 1-3.9 5H8v3H5v3H2v-3l6.1-6.1A4 4 0 0 1 15 7zM16 8h.01',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',book:'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM6 17h13'}
const Ic=({n,s=22})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={I[n]}/></svg>
const ago=t=>{const s=Math.max(1,Math.floor((Date.now()-t)/1000));if(s<60)return 'baru saja';if(s<3600)return Math.floor(s/60)+' menit lalu';if(s<86400)return Math.floor(s/3600)+' jam lalu';return new Date(t).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short'})}
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
 const promo=usePromo()
 const [me,setMe]=useState(),[tab,setTabRaw]=useState('home'),[drawer,setDrawer]=useState(false),[msg,setMsg]=useState('')
 const [sv,setSv]=useState([]),[server,setServer]=useState('warungnokos_s1'),[svc,setSvc]=useState([]),[sel,setSel]=useState(null),[ct,setCt]=useState([]),[ldc,setLdc]=useState(false),[orders,setOrders]=useState([]),[mut,setMut]=useState([]),[now,setNow]=useState(Date.now()),[txt,setTxt]=useState('')
 const [sheet,setSheet]=useState(false),[step,setStep]=useState(1),[qs,setQs]=useState(''),[qc,setQc]=useState(''),[sort,setSort]=useState('success'),[guar,setGuar]=useState(true),[openC,setOpenC]=useState(''),[buying,setBuying]=useState(''),[cxl,setCxl]=useState('')
 const [struk,setStruk]=useState(null)
 const [ann,setAnn]=useState([]),[bell,setBell]=useState(false),[seen,setSeen]=useState(0),[csd,setCsd]=useState({msgs:[],open:true,hours:''}),chatRef=useRef(null)
 // Deposit sekarang halaman sendiri (/deposit). Semua tombol 'Isi saldo' lewat setTab('deposit') diarahkan ke sana.
 const setTab=t=>{if(t==='deposit'){location.href='/deposit';return}setDrawer(false);setTabRaw(t)}
 useEffect(()=>{try{setSeen(+localStorage.getItem('arta-ann-seen')||0)}catch(e){}},[])
 // ?tab=api / ?tab=mutasi dst: dipakai pintasan dari halaman Profil & tautan luar
 useEffect(()=>{const t=new URLSearchParams(location.search).get('tab')
  if(t&&['home','buy','orders','more','mutasi','api','tnc','ann','lb','ref','cashback','notif'].includes(t))setTabRaw(t)},[])
 const unread=ann.filter(x=>x.at>seen).length
 const toggleBell=()=>{const o=!bell;setBell(o);setDrawer(false);if(o&&ann[0]){try{localStorage.setItem('arta-ann-seen',String(ann[0].at))}catch(e){}}else if(!o&&ann[0])setSeen(ann[0].at)}
 const load=useCallback(async()=>{const m=await api('v1/me');if(m.error){setMe(null);return}setMe(m);setOrders((await api('v1/orders?limit=100')).items||[]);setMut((await api('v1/mutasi')).items||[])},[])
 useEffect(()=>{load();api('v1/servers').then(d=>setSv(d.items||[]));api('v1/announcements').then(d=>setAnn(d.items||[]))},[load])
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[])
 useEffect(()=>{if(!me)return;const t=setInterval(async()=>{for(const o of orders.filter(o=>o.status==='pending'))await api('v1/orders/status?order_id='+o.orderId);load()},5000);return()=>clearInterval(t)},[me,orders,load])
 useEffect(()=>{if(me&&sheet&&step===2){setSvc([]);api('v1/services?server='+server).then(d=>{setSvc(d.items||[]);if(d.error)setMsg(d.error)})}},[me,sheet,step,server])

 useEffect(()=>{if(!me||tab!=='cs')return;const f=()=>api('v1/cs').then(d=>{if(!d.error)setCsd(d)});f();const t=setInterval(f,4000);return()=>clearInterval(t)},[me,tab])
 useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight},[csd.msgs.length,tab])
 // B7: rangka abu-abu sementara data dimuat, bukan teks polos
 if(me===undefined)return (<div className="app"><div className="shell">
   <div className="sk-top"><Skeleton className="sk-av"/><Skeleton className="sk-pill"/><Skeleton className="sk-av sm"/><Skeleton className="sk-av sm"/></div>
   <Skeleton className="sk-hero"/>
   <div className="sk-3">{[0,1,2].map(i=><Skeleton key={i} className="sk-qk"/>)}</div>
   <Skeleton className="sk-card"/><Skeleton className="sk-card"/>
  </div></div>)
 if(!me){if(typeof window!=='undefined')location.href='/login';return <p>Mengalihkan ke halaman masuk...</p>}
 const ok=orders.filter(o=>o.status==='success'),aktif=orders.filter(o=>o.status==='pending'),batal=orders.filter(o=>o.status==='cancelled'||o.status==='expired')
 const actv=orders.filter(o=>o.status==='pending'||(o.status==='success'&&now-new Date(o.createdAt).getTime()<30*60000))
 const past=[...new Map(orders.map(o=>[o.serviceId+'|'+o.countryName,o])).values()].filter(o=>o.serviceId).slice(0,6)
 const deps=mut.filter(m=>String(m.note).startsWith('Deposit')),tot=ok.length+aktif.length+batal.length,rate=tot?Math.round(ok.length/tot*100):0
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d}),dk=d=>new Date(d).toDateString(),lb=days.map(d=>d.getDate()+' '+BL[d.getMonth()])
 const cb=days.map(d=>ok.filter(o=>dk(o.createdAt)===dk(d)).length),cd=days.map(d=>deps.filter(m=>dk(m.at)===dk(d)).reduce((a,m)=>a+m.amt,0))
 // ---- beli nokos ----
 const openSheet=()=>{setQs('');setQc('');setCt([]);setSel(null);setStep(1);setSheet(true)}
 const again=o=>{setServer(o.server||server);setQs('');setQc('');setOpenC('');setSheet(true);pick(o.serviceId,o.serviceName,o.server)}
 const pick=async(code,name,srv)=>{setSel({code,name});setCt([]);setQc('');setOpenC('');setStep(3);setLdc(true);const d=await api(`v1/countries?server=${srv||server}&service_id=${encodeURIComponent(code)}`);setLdc(false);d.error?setMsg(d.error):setCt(d.items||[])}
 const buy=async(c,x)=>{const k=x.provider_id+'-'+x.country_id;setBuying(k);const d=await api('v1/order',{server,serviceId:sel.code,serviceName:sel.name,countryName:c.name,providerId:x.provider_id,countryId:x.country_id,guarantee:guar});setBuying('');if(d.error){setMsg(d.error);return}setMsg('Nomor: '+d.phoneNumber);setSheet(false);setTab('buy');load()}
 const fee=v=>guar?v+Math.ceil(v*0.1):v
 const apps=svc.filter(s=>s.service_name.toLowerCase().includes(qs.toLowerCase()))
 const pop=qs?[]:[...new Set(['whatsapp','telegram','google','facebook','instagram','tiktok'].map(n=>svc.find(s=>s.service_name.toLowerCase().includes(n))).filter(Boolean))].slice(0,6)
 const cl=ct.map(c=>{const pl=[...c.pricelist].sort((a,b)=>a.sell_price-b.sell_price);return {...c,pl,min:pl[0]?.sell_price||0,stock:pl.reduce((a,x)=>a+(+x.stock||0),0),rt:+(c.success_rate??c.rate??0)}}).filter(c=>c.pl.length&&c.name.toLowerCase().includes(qc.toLowerCase())).sort((a,b)=>sort==='cheap'?a.min-b.min:(b.rt-a.rt)||(b.stock-a.stock))
 const sendCs=async()=>{if(!txt.trim())return;const d=await api('v1/cs',{text:txt});if(d.error){setMsg(d.error);return}setTxt('');setCsd(d)}
 const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')
 const nav=[['home','Beranda','home'],['buy','Nokos','sim'],['deposit','Deposit','wallet'],['orders','Riwayat','cart'],['more','Lainnya','menu']]
 const sub=['mutasi','api','tnc','ann','lb','ref','cashback','notif'].includes(tab)
 return <div className="app"><div className="shell">
 <div className="top"><button className="av" onClick={()=>setTab('home')}>🌍</button><button className="pill" onClick={()=>setTab('buy')}><Ic n="cart" s={20}/> Pesanan aktif <b className="mono">{aktif.length}</b></button><button className="bell" aria-label={'Notifikasi pengumuman'+(unread?' ('+unread+' baru)':'')} aria-expanded={bell} onClick={toggleBell}><Ic n="bell" s={22}/>{unread>0&&<span className="dot">{unread>9?'9+':unread}</span>}</button><button className="pf" aria-label="Buka menu" onClick={()=>setDrawer(true)}><Ic n="menu" s={22}/>{me.csUnread>0&&<span className="dot" style={{position:'absolute',marginLeft:-6,marginTop:-34}}>{me.csUnread}</span>}</button></div>
 {bell&&<><div className="bpop-bg" onClick={toggleBell}/><div className="bpop" role="dialog" aria-label="Pengumuman terbaru"><b>📣 Pengumuman terbaru{unread>0&&<span className="dot">{unread}</span>}</b>
  {!ann.length&&<p className="bpe">Belum ada pengumuman.</p>}
  {ann.slice(0,3).map(x=>{const nw=x.at>seen;return <a key={x.id} href="#" className={nw?'nw':''} onClick={e=>{e.preventDefault();setBell(false);setSeen(ann[0].at);setTab('ann')}}><span className="bi">{nw?'🔔':'📣'}</span><span className="bt2"><strong>{x.title}{nw&&<em>BARU</em>}</strong><span>{(x.body||'').slice(0,90)}{(x.body||'').length>90?'…':''}</span><small>{ago(x.at)}</small></span></a>})}
  <button onClick={()=>{setBell(false);setSeen(ann[0]?ann[0].at:0);setTab('ann')}}>Lihat semua pengumuman</button></div></>}
 <Toast msg={msg} onClose={()=>setMsg('')}/>
 {struk&&<Struk item={struk.item} kind={struk.kind} onClose={()=>setStruk(null)} onMsg={setMsg}/>}
 <Drawer open={drawer} onClose={()=>setDrawer(false)} me={me} promo={promo} go={setTab} logout={async()=>{await api('auth/logout',{});location.href='/login'}}/>
 {tab==='home'&&<>
  <div className="hello"><div className="bubble"><small>ARTAPEDIA BILANG:</small><span>Saldo aman. Tinggal pilih nomornya.</span></div><Mascot size={110}/></div>

  {me.broadcast&&<div className="c" style={{padding:'12px 16px'}}>📢 {me.broadcast}</div>}
  <div className="c bal"><div className="ch"><div className="ic"><Ic n="wallet"/></div><b>Saldo tersedia</b></div><div className="big"><small>Rp</small> {nf(me.balance)}</div><button className="dk" onClick={()=>setTab('deposit')}>+ Isi saldo</button></div>
  <TgCard setMsg={setMsg}/>
  <div className="qk"><button onClick={()=>setTab('deposit')}><i><Ic n="wallet" s={24}/></i>ISI SALDO</button><button onClick={()=>{setTab('buy');openSheet()}}><i><Ic n="sim" s={24}/></i>BELI NOKOS</button><button onClick={()=>setTab('orders')}><i><Ic n="cart" s={24}/></i>RIWAYAT</button></div>
  {/* Pintasan utama: Profil pengguna & API Key + dokumentasi developer, langsung di halaman dashboard */}
  <div className="dev2"><button className="dev" onClick={()=>location.href='/pay'}><span className="di" style={{background:'linear-gradient(145deg,#8b6bff,#4b2fd0)'}}><Ic n="bolt" s={22}/></span><b>QRIS Gateway</b><small>Terima pembayaran QRIS, tarik dana otomatis, API developer</small><Ic n="chev" s={18}/></button>
   <button className="dev" onClick={()=>location.href='/profil'}><span className="di" style={{background:'linear-gradient(145deg,#8b9dff,#4b5ddb)'}}><Ic n="user" s={22}/></span><b>Profil saya</b><small>Data akun, password, kode ajakan, notifikasi HP</small><Ic n="chev" s={18}/></button>
   <button className="dev" onClick={()=>setTab('api')}><span className="di" style={{background:'linear-gradient(145deg,#ffd166,#ff9f1c)'}}><Ic n="key" s={22}/></span><b>API Key &amp; Docs developer</b><small>Key, base URL, contoh kode, webhook &amp; whitelist IP</small><Ic n="chev" s={18}/></button></div>
  <div className="two"><div className="c"><div className="ch"><div className="ic"><Ic n="wallet" s={18}/></div><b>Total deposit</b></div><div className="mono num">{rp(deps.reduce((a,m)=>a+m.amt,0))}</div><small>{deps.length} deposit sukses</small></div>
  <div className="c"><div className="ch"><div className="ic"><Ic n="cart" s={18}/></div><b>Total belanja</b></div><div className="mono num">{rp(ok.reduce((a,o)=>a+o.price,0))}</div><small>{ok.length} pesanan sukses</small></div></div>
  <div className="two" style={{marginTop:14}}><a className="c link" href="#" onClick={e=>{e.preventDefault();setTab('lb')}} style={{margin:0}}><span className="soc" style={{background:'#f59e0b'}}>🏆</span>Leaderboard<Ic n="out" s={16}/></a><a className="c link" href="#" onClick={e=>{e.preventDefault();location.href='/cs'}} style={{margin:0}}><span className="soc" style={{background:'#3b7fe0'}}>💬</span>Chat CS<Ic n="out" s={16}/></a></div>
  <details className="c acc"><summary><div className="ic"><Ic n="sim"/></div>Cara membeli OTP<Ic n="down" s={18}/></summary><ol><li>Isi saldo lewat QRIS (min Rp2.000).</li><li>Buka Nokos, pilih server, aplikasi & negara.</li><li>Pakai nomor untuk daftar di aplikasi.</li><li>OTP muncul otomatis di halaman Nokos.</li></ol></details>
  <div className="c"><Head ic="ok" t="Pembelian berhasil" s="Tingkat keberhasilan, realtime" tag={null}/><div className="rate mono">{rate}%</div>
   <div className="pg"><i style={{width:rate+'%'}}/></div><div className="chips"><div className="chip"><span><Ic n="ok" s={18}/> Berhasil</span><b className="mono">{ok.length}</b></div><div className="chip"><span><Ic n="no" s={18}/> Batal</span><b className="mono">{batal.length}</b></div><div className="chip"><span><Ic n="clock" s={18}/> Aktif</span><b className="mono">{aktif.length}</b></div></div></div>
  <div className="c"><Head ic="cart" t="Statistik pembelian" s="7 hari terakhir" tag={cb.reduce((a,b)=>a+b,0)+' pembelian'}/><Chart vals={cb} labels={lb} color="#3b7fe0" fmt={String}/></div>
  <div className="c"><Head ic="wallet" t="Statistik deposit" s="7 hari terakhir" tag={rp(cd.reduce((a,b)=>a+b,0))}/><Chart vals={cd} labels={lb} color="#3d4b6b" fmt={K}/></div>
  <SocialButtons className="mt-3"/>
  <div className="foot"><div style={{display:'flex',justifyContent:'center'}}><Mascot size={72}/></div><b>ARTAPEDIA ID</b><p>Artapedia ID adalah website penyedia layanan OTP berbasis nomor tanpa kartu fisik.</p></div></>}
 {tab==='buy'&&<>
  <div className="cxb"><h3>PESAN NOMOR VIRTUAL!</h3><ol><li><b>1</b>Pilih server</li><li><b>2</b>Pilih aplikasi</li><li><b>3</b>Pilih negara</li><li><b>4</b>Ambil OTP</li></ol></div>
  <div className="sh">Pesanan aktif</div>
  {actv.length===0?<div className="emp"><div className="ic" style={{margin:'0 auto 10px',width:64,height:64}}><Ic n="sim" s={30}/></div><b style={{fontSize:18}}>Belum ada pesanan aktif</b><p className="hint">Nomor yang kamu beli akan muncul di sini beserta kode OTP-nya.</p><button className="pbtn" onClick={openSheet}>PESAN NOMOR SEKARANG</button></div>
  :<>{actv.map(o=>{const ex=+new Date(o.expiredAt),cr=new Date(o.createdAt).getTime(),rem=Math.max(0,Math.floor((ex-now)/1000)),pct=Math.max(0,Math.min(100,(ex-now)/Math.max(1,ex-cr)*100)),w=Math.ceil((cr+180000-now)/1000)
   return <div key={o.orderId} className="ao"><div className="hd"><div><b>{o.serviceName}</b><small>{o.countryName} · Order #{String(o.orderId).slice(-12)} · {rr(o.price)}</small></div><span className={'wp'+(o.status==='success'?' ok':'')}>{o.status==='success'?'Kode masuk':'Menunggu kode'}</span></div>
   <div className="nb"><div><span>Nomor</span><button onClick={()=>{navigator.clipboard?.writeText(o.phoneNumber);setMsg('Nomor disalin')}}>Salin</button></div><b className="mono">{o.phoneNumber}</b></div>
   {o.status==='success'?<div className="wt"><small style={{color:'#6b7a95'}}>Kode OTP</small><div className="otp mono">{o.otpCode}</div><div className="row2" style={{marginTop:8}}><button className="bt sec" onClick={()=>{navigator.clipboard?.writeText(o.otpCode);setMsg('Kode disalin')}}>Salin kode</button>
   <button className="bt sec" onClick={()=>setStruk({item:o,kind:'order'})}>🧾 Struk</button></div></div>
   :<div className="wt"><div className="spin">✉️</div><b>Lagi ngecek inbox nomor…</b>{o.guarantee&&<div className="hint" style={{marginTop:6}}>🛡️ Jaminan OTP aktif{o.replaced?' · nomor sudah diganti otomatis':' · nomor diganti otomatis jika 4 menit belum ada kode'}</div>}<div className="br"><span>Menunggu</span><b className="mono">{fmt(rem)}</b></div><div className="pb"><i style={{width:pct+'%'}}/></div></div>}
   <div className="ob"><button onClick={()=>again(o)}>Beli lagi</button><button disabled={o.status!=='pending'||cxl===o.orderId} onClick={async()=>{if(cxl)return;if(!confirm('Batalkan pesanan ini? Saldo akan kembali.'))return;setCxl(o.orderId);const d=await api('v1/orders/cancel',{order_id:o.orderId}).catch(()=>({error:'Gagal terhubung ke server'}));setCxl('');setMsg(d.error||'Dibatalkan, saldo kembali');load()}}>{cxl===o.orderId?'Membatalkan...':'Batal'}</button></div>
   </div>})}
   <button className="pbtn" style={{width:'100%'}} onClick={openSheet}>+ PESAN NOMOR LAGI</button></>}
  {past.length>0&&<><div className="sh">🕘 Pernah dipesan</div><div className="pd">{past.map(o=><button key={o.orderId} onClick={()=>again(o)}>{o.serviceName} <span style={{color:'#6b7a95',fontWeight:400}}>· {o.countryName||'-'}</span> ☆</button>)}</div></>}
  <div className="inf"><b>Bisa dibatalkan kapan saja</b><p>Kalau kode belum masuk, tekan Batal dan saldo langsung kembali.</p><b>Refund otomatis</b><p>Nomor yang kedaluwarsa tanpa kode dikembalikan penuh ke saldo.</p></div></>}
 {tab==='orders'&&<>{orders.length===0&&<div className="c">Belum ada pesanan.</div>}{orders.map(o=><div key={o.orderId} className="c"><div className="row"><b>{o.serviceName}</b><span className={'st '+o.status}>{o.status}</span></div><div className="mono">{o.phoneNumber} · {rp(o.price)}</div><small>{o.countryName} · {new Date(o.createdAt).toLocaleString('id-ID')}</small>{o.otpCode&&<div className="otp mono">{o.otpCode}</div>}
  <div className="row2"><button className="bt" onClick={()=>{navigator.clipboard?.writeText(o.phoneNumber);setMsg('Nomor disalin')}}>Salin nomor</button>
   {o.status==='success'&&<button className="bt sec" onClick={()=>setStruk({item:o,kind:'order'})}>🧾 Struk</button>}</div></div>)}</>}
 {tab==='more'&&<div className="c menu">{[['profil','👤 Profil saya'],['pay','⚡ QRIS Gateway'],['api','🔑 API Key & Docs developer'],['notif','🔔 Notifikasi HP'],['mutasi','💼 Mutasi saldo'],['cashback','🎁 Cashback deposit'],['ref','🤝 Ajak teman (dapat saldo)'],['ann','📣 Pengumuman'],['lb','🏆 Leaderboard'],['cs','💬 Customer Service'],['tnc','📄 Syarat & Ketentuan']].map(([k,t])=><button key={k} onClick={()=>['cs','profil','pay'].includes(k)?(location.href='/'+k):setTab(k)}><span>{t}{k==='cs'&&me.csUnread>0&&<span className="dot">{me.csUnread}</span>}</span><Ic n="out" s={16}/></button>)}<button onClick={async()=>{await api('auth/logout',{});location.href='/login'}}>Keluar</button></div>}
 {tab==='ref'&&<RefPage me={me} promo={promo} setMsg={setMsg}/>}
 {tab==='cashback'&&<CashbackPage promo={promo} go={setTab}/>}
 {tab==='mutasi'&&<div className="c"><Head ic="wallet" t="Mutasi saldo" s="Riwayat saldo masuk dan keluar"/>{mut.map((m,i)=><div key={i} className="row"><span>{m.note}<small> · {new Date(m.at).toLocaleString('id-ID')}</small></span><b className="mono" style={{color:m.amt>0?'#1a9b55':'#d04444'}}>{m.amt>0?'+':''}{m.amt}</b></div>)}</div>}
 {tab==='ann'&&<><div className="c"><Head ic="menu" t="Pengumuman" s="Info resmi dari admin"/></div><Announcements/></>}
 {tab==='lb'&&<><div className="c"><Head ic="ok" t="Leaderboard" s="Saldo & transaksi terbanyak · email disensor"/></div><Leaderboard me={me.email}/></>}
 {tab==='api'&&<ApiPanel me={me} promo={promo} setMsg={setMsg} onRegen={async()=>{if(confirm('Key lama langsung mati. Lanjut?')){await api('v1/apikey',{});load()}}}/>}
 {tab==='notif'&&<><div className="c"><Head ic="bell" t="Notifikasi HP" s="Supaya tetap dikabari walau tab browser ditutup"/></div>
  <PushCard api={api} prefix="v1/push/" title="Notifikasi HP" desc="Dikabari saat deposit masuk & CS membalas — walau tab browser sudah ditutup." onMsg={setMsg}/></>}
 {tab==='tnc'&&<div className="c"><Head ic="ok" t="Syarat & Ketentuan" s="Baca sebelum memakai layanan"/><ul><li>Saldo yang sudah masuk tidak dapat ditarik.</li><li>Nomor yang tidak menerima OTP otomatis direfund.</li><li>Dilarang dipakai untuk tindakan melanggar hukum.</li><li>Akun melanggar aturan dapat dibanned.</li></ul></div>}
 <div className="bn">{nav.map(([k,t,ic])=><button key={k} className={(k==='deposit'?'mid ':'')+((tab===k||(k==='more'&&sub))?'on':'')} onClick={()=>setTab(k)}>{k==='deposit'?<i><Ic n={ic} s={26}/></i>:<Ic n={ic}/>}<span>{t}</span></button>)}</div>
 {sheet&&<div className="bk" onClick={e=>e.target===e.currentTarget&&setSheet(false)}><div className="sheet"><div className="gr"/>
  <div className="tt"><div><h2>BELI NOMOR VIRTUAL</h2><small>{sv.find(s=>s.server===server)?.name||'Server'} · {step===1?'langkah 1 · pilih server':step===2?'pilih aplikasi':'pilih negara'}</small></div><div className="sd">Saldo<b>{rr(me.balance)}</b></div></div>
  {step===1&&<><p style={{color:'#55657f',fontSize:17}}>Mau pakai server yang mana?</p>{sv.map(s=><button key={s.server} className="sv" disabled={!!s.maintenance} style={s.maintenance?{opacity:.55,cursor:'not-allowed'}:undefined} onClick={()=>{if(s.maintenance){setMsg(s.maintMsg||'Server sedang maintenance');return}setServer(s.server);setStep(2)}}><div className="ibx">{s.maintenance?'🛠':'⚡'}</div><div><b>{s.name.toUpperCase()}</b><em>{s.maintenance?'MAINTENANCE':s.badge}</em><p>{s.maintenance?(s.maintMsg||'Server sedang maintenance'):s.description}</p><code>VIA {s.provider.toUpperCase()}</code></div><Ic n="chev" s={20}/></button>)}{sv.length===0&&<p className="hint">Semua server sedang dimatikan admin.</p>}</>}
  {step===2&&<><button className="bkl" onClick={()=>setStep(1)}>← Ganti server</button><input className="sin" placeholder="Cari nama aplikasi..." value={qs} onChange={e=>setQs(e.target.value)}/>
   {svc.length===0&&<div className="sk-list">{[0,1,2,3,4].map(i=><Skeleton key={i} className="sk-row"/>)}</div>}
   {pop.length>0&&<><div className="h3s">Aplikasi Populer</div><div className="pp">{pop.map(s=><button key={s.service_code} onClick={()=>pick(s.service_code,s.service_name)}><span className="lt">{s.service_name[0].toUpperCase()}</span>{s.service_name}</button>)}</div></>}
   <div className="h3s">Semua Aplikasi</div>{apps.slice(0,200).map(s=><button key={s.service_code} className="al" onClick={()=>pick(s.service_code,s.service_name)}><span className="nm">{s.service_name[0].toUpperCase()}</span>{s.service_name}<Ic n="chev" s={18}/></button>)}</>}
  {step===3&&sel&&<><button className="sel" onClick={()=>{setStep(2);setQs('')}}><span className="lt" style={{width:44,height:44}}>{sel.name[0].toUpperCase()}</span><div><b>{sel.name}</b><small>Aplikasi yang dipilih</small></div><Ic n="chev" s={18}/></button>
   <input className="sin" style={{marginTop:14}} placeholder="Cari nama negara..." value={qc} onChange={e=>setQc(e.target.value)}/>
   <div className="sort"><button className={sort==='success'?'on':''} onClick={()=>setSort('success')}>Paling sukses</button><button className={sort==='cheap'?'on':''} onClick={()=>setSort('cheap')}>Termurah</button></div>
   <label className="gj"><input type="checkbox" checked={guar} onChange={e=>setGuar(e.target.checked)}/><span><b>🛡️ Jaminan OTP (+10% dari harga)</b>Kode belum masuk dalam 4 menit? Nomor diganti otomatis. Kalau tetap gagal, semuanya dikembalikan — biaya jaminan hanya terpakai kalau kodenya masuk.</span></label>
   {ldc&&<div className="sk-list">{[0,1,2].map(i=><Skeleton key={i} className="sk-cc"/>)}</div>}{!ldc&&cl.length===0&&<p className="hint">Tidak ada negara tersedia.</p>}
   {cl.map(c=>{const o=openC===c.country_id||openC===c.name,mx=Math.max(...c.pl.map(x=>+x.stock||0),1);return <div key={c.name} className={'cc'+(o?' open':'')}><button onClick={()=>setOpenC(o?'':c.name)}><span className="fg">{c.flag}</span><div className="nm"><b>{c.name}</b><small>{c.pl.length} paket<i/>{nf(c.stock)} stok</small></div><div className="pr"><small>MULAI</small><b>{rr(fee(c.min))}</b></div><Ic n="down" s={20}/></button>
    {o&&c.pl.map((x,i)=>{const k=x.provider_id+'-'+x.country_id;return <div key={k} className={'pk'+(i===0?' f':'')}><span className="no">{i+1}</span><div className="in"><b>{sel.name} - {c.flag} {c.name}{x.provider_name?` (${x.provider_name})`:''}{i===0&&<em>TERMURAH</em>}</b><div className="st2"><i><u style={{width:Math.max(6,(+x.stock||0)/mx*100)+'%'}}/></i>{nf(x.stock)} nomor</div></div><div className="rt"><b>{rr(fee(x.sell_price))}</b><button className="od" disabled={buying===k} onClick={()=>buy(c,x)}>{buying===k?'…':'ORDER'}</button></div></div>})}</div>})}</>}
 </div></div>}
 </div></div>}
