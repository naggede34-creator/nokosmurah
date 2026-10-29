'use client'
import {useState,useEffect,useRef,useCallback,useMemo} from 'react'
import Mascot from '../../components/Mascot'
import {ting,unlock} from '../../components/sound'
import './cs.css'
const api=(p,b)=>fetch('/api/'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(r=>r.json())
// kecilkan foto di browser supaya muat (maks ~200KB)
const shrink=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{for(const [m,q] of [[900,.72],[700,.6],[520,.5]]){const k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);const o=c.toDataURL('image/jpeg',q);if(o.length<=280000)return res(o)}rej(new Error('big'))};im.src=r.result};r.readAsDataURL(f)})
const mmss=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')
const MAXVN=60   // detik; dibatasi supaya ukuran file kecil di semua browser
const pickMime=()=>{if(typeof MediaRecorder==='undefined')return '';for(const m of ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'])if(MediaRecorder.isTypeSupported(m))return m;return ''}
const b64of=blob=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=no;r.readAsDataURL(blob)})
const keyOf=m=>m.id||('t'+m.at)
const dayLbl=at=>{const d=new Date(at),t=new Date(),y=new Date(Date.now()-864e5),same=(a,b)=>a.toDateString()===b.toDateString();return same(d,t)?'HARI INI':same(d,y)?'KEMARIN':d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}).toUpperCase()}
// satu pemutar untuk semua VN: memutar yang baru otomatis menghentikan yang lama
const Player={a:null,id:null,listeners:new Set(),emit(){this.listeners.forEach(f=>f())}}
function VN({m,own}){
 const [,tick]=useState(0),[pg,setPg]=useState(0)
 useEffect(()=>{const f=()=>tick(x=>x+1);Player.listeners.add(f);return()=>Player.listeners.delete(f)},[])
 const playing=Player.id===m.aud.id&&Player.a&&!Player.a.paused
 const bars=useMemo(()=>Array.from({length:26},(_,i)=>6+Math.round(Math.abs(Math.sin((i+1)*(m.aud.id.charCodeAt(i%m.aud.id.length)%7+2)))*18)),[m.aud.id])
 const toggle=async()=>{
  if(Player.id===m.aud.id&&Player.a){if(Player.a.paused)Player.a.play().catch(()=>{});else Player.a.pause();Player.emit();return}
  if(Player.a){Player.a.pause()}
  const a=new Audio('/api/v1/cs/audio?id='+m.aud.id);Player.a=a;Player.id=m.aud.id
  a.ontimeupdate=()=>{setPg(a.duration?a.currentTime/a.duration:0)};a.onended=()=>{setPg(0);Player.emit()};a.onpause=()=>Player.emit();a.onplay=()=>Player.emit()
  a.onerror=()=>{Player.emit()}
  a.play().catch(()=>{});Player.emit()}
 const cur=Player.id===m.aud.id?pg:0,on=Math.round(cur*bars.length)
 return <div className="csx-vn"><button className="csx-play" onClick={e=>{e.stopPropagation();toggle()}} aria-label={playing?'Jeda':'Putar'}>{playing?'❚❚':'▶'}</button>
  <div className="csx-wave"><div className="csx-bars">{bars.map((h,i)=><i key={i} className={i<on?'on':''} style={{height:h}}/>)}</div><small>🎤 {mmss(m.aud.dur||0)}</small></div></div>}
export default function CS(){
 const [d,setD]=useState(null),[txt,setTxt]=useState(''),[img,setImg]=useState(''),[box,setBox]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[sel,setSel]=useState(''),[ask,setAsk]=useState('')
 const [rec,setRec]=useState(null)   // {t:detik}
 const ref=useRef(null),adm=useRef(null),file=useRef(null),mr=useRef(null),chunks=useRef([]),tm=useRef(null),t0=useRef(0),cancelled=useRef(false)
 useEffect(()=>{const u=()=>unlock();document.addEventListener('pointerdown',u);return()=>document.removeEventListener('pointerdown',u)},[])
 const poll=useCallback(async()=>{try{const r=await api('v1/cs');if(r.error){if(/login|API key/i.test(r.error))location.href='/login';return}
   const c=r.msgs.filter(m=>m.from==='admin').length;if(adm.current!==null&&c>adm.current)ting();adm.current=c;setD(r)}catch(e){}},[])
 useEffect(()=>{poll();const t=setInterval(()=>{if(!document.hidden)poll()},3000);return()=>clearInterval(t)},[poll])
 useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight},[d&&d.msgs.length,d&&d.typing])
 useEffect(()=>{if(!err)return;const t=setTimeout(()=>setErr(''),4500);return()=>clearTimeout(t)},[err])
 useEffect(()=>()=>{clearInterval(tm.current);try{mr.current&&mr.current.state!=='inactive'&&(cancelled.current=true,mr.current.stop())}catch(e){}if(Player.a){Player.a.pause();Player.a=null;Player.id=null}},[])
 const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{setImg(await shrink(f))}catch(x){setErr('Foto tidak bisa dipakai / terlalu besar')}}
 const apply=r=>{if(r.error){setErr(r.error);return false}adm.current=r.msgs.filter(m=>m.from==='admin').length;setD(r);return true}
 const send=async()=>{if(busy||(!txt.trim()&&!img))return;setBusy(true);const r=await api('v1/cs',{text:txt,img}).catch(()=>({error:'Gagal terhubung'}));setBusy(false);if(apply(r)){setTxt('');setImg('')}}
 const hapus=async m=>{setAsk('');setSel('');const r=await api('v1/cs',{del:keyOf(m)}).catch(()=>({error:'Gagal terhubung'}));apply(r)}
 // ---- rekam VN ----
 const startRec=async()=>{
  if(!navigator.mediaDevices||typeof MediaRecorder==='undefined')return setErr('Browser ini belum mendukung rekam suara. Coba Chrome / Safari terbaru.')
  try{const st=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})
   const mime=pickMime(),r=new MediaRecorder(st,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:24000})
   chunks.current=[];cancelled.current=false;mr.current=r;t0.current=Date.now()
   r.ondataavailable=e=>{if(e.data&&e.data.size)chunks.current.push(e.data)}
   r.onstop=async()=>{st.getTracks().forEach(x=>x.stop());clearInterval(tm.current);const dur=Math.round((Date.now()-t0.current)/1000);setRec(null)
    if(cancelled.current)return
    if(dur<1)return setErr('Pesan suara terlalu pendek')
    const blob=new Blob(chunks.current,{type:r.mimeType||mime||'audio/webm'})
    if(blob.size>580*1024)return setErr('Pesan suara terlalu besar, rekam lebih singkat')
    setBusy(true);try{const res=await api('v1/cs',{aud:{b64:await b64of(blob),mime:blob.type,dur}});apply(res)}catch(e){setErr('Gagal mengirim pesan suara')}setBusy(false)}
   r.start(250);setRec({t:0})
   tm.current=setInterval(()=>{const s=Math.floor((Date.now()-t0.current)/1000);setRec({t:s});if(s>=MAXVN&&r.state!=='inactive')r.stop()},250)
  }catch(e){setErr(/denied|permission|NotAllowed/i.test(e.name+e.message)?'Izin mikrofon ditolak. Aktifkan lewat pengaturan browser.':'Mikrofon tidak bisa dipakai')}}
 const stopRec=(kirim)=>{cancelled.current=!kirim;try{mr.current&&mr.current.state!=='inactive'&&mr.current.stop()}catch(e){}}
 const open=!d||d.open
 const ai=!!(d&&d.ai),nm=String((d&&d.aiName)||'NONA CANTIKAN').toUpperCase()
 const mati=!!(d&&d.off)   // CS dimatikan admin (bukan sekadar di luar jam layanan)
 // CS dimatikan admin -> seluruh ruang chat ditutup, yang tampil hanya alasannya.
 if(mati)return <CsTutup alasan={d.offMsg} jam={d.hours}/>
 let lastDay=''
 return <div className="csx">
  <div className="csx-h"><a href="/dashboard" className="csx-bk" aria-label="Kembali">‹</a><div className="csx-av"><Mascot size={40}/></div>
   <div className="csx-ti"><b>{ai?nm:'CUSTOMER SERVICE'}</b><span className={open?'':'off'}>{open?(ai?'ONLINE 24 JAM':'ONLINE'):'ISTIRAHAT'}</span></div></div>
  <div className="csx-c" ref={ref}>
   <div className={'csx-note'+(open?'':' c')}>{open?(ai?<><b>{nm}</b> siap bantu 24 jam. Urusan saldo/refund diteruskan ke admin.</>:<><b>CS buka!</b> Kirim pesan, foto, atau pesan suara.</>):<><b>CS lagi istirahat.</b> Jam layanan: {d&&d.hours}</>}</div>
   {!d&&<div className="csx-sk"><i/><i/><i/></div>}
   {d&&d.msgs.length===0&&<div className="csx-note">Belum ada obrolan. Ayo sapa {ai?nm:'admin'}! 👋</div>}
   {d&&d.msgs.map(m=>{const k=keyOf(m),dl=dayLbl(m.at),own=m.from==='user',show=dl!==lastDay;lastDay=dl
    return <div key={k} style={{display:'contents'}}>{show&&<div className="csx-day">{dl}</div>}
     <div className={'csx-m '+m.from} onClick={own?()=>setSel(sel===k?'':k):undefined}>
      {m.from==='admin'&&<em>{m.ai?nm:'ADMIN'}</em>}
      {m.img&&<img src={m.img} alt="foto" onClick={e=>{e.stopPropagation();setBox(m.img)}}/>}
      {m.aud&&<VN m={m} own={own}/>}
      {m.text&&<p>{m.text}</p>}
      <time>{new Date(m.at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</time>
      {own&&sel===k&&<div className="csx-del" onClick={e=>e.stopPropagation()}>{ask===k?<>Hapus pesan ini?<button className="d" onClick={()=>hapus(m)}>Ya, hapus</button><button onClick={()=>{setAsk('');setSel('')}}>Batal</button></>:<button className="d" onClick={()=>setAsk(k)}>🗑 Hapus pesan</button>}</div>}
     </div></div>})}
   {d&&d.typing&&<div className="csx-m admin"><em>{nm}</em><div className="csx-typing"><i/><i/><i/></div></div>}
  </div>
  {err&&<div className="csx-er">{err}</div>}
  {img&&<div className="csx-pv"><img src={img} alt=""/><span style={{fontWeight:800,fontSize:13}}>Foto siap dikirim</span><button onClick={()=>setImg('')} aria-label="Batal">✕</button></div>}
  <div className="csx-f"><input type="file" accept="image/*" hidden ref={file} onChange={pick}/>
   {rec?<><button className="csx-b" onClick={()=>stopRec(false)} aria-label="Batalkan rekaman">🗑</button><div className="csx-rec"><i/><span>{mmss(rec.t)}</span><small>maks {MAXVN} dtk</small></div><button className="csx-b go" onClick={()=>stopRec(true)} aria-label="Kirim pesan suara">➤</button></>
   :<><button className="csx-b" disabled={!open||busy} onClick={()=>file.current.click()} aria-label="Kirim foto">📷</button>
    <input className="csx-in" disabled={!open} value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder={open?'Tulis pesan…':'CS sedang tutup'} maxLength={1000}/>
    {(txt.trim()||img)?<button className="csx-b go" disabled={!open||busy} onClick={send} aria-label="Kirim">➤</button>
     :<button className="csx-b mic" disabled={!open||busy} onClick={startRec} aria-label="Rekam pesan suara">🎤</button>}</>}</div>
  {box&&<div className="csx-lb" onClick={()=>setBox('')}><img src={box} alt=""/></div>}
 </div>}

// Layar penuh saat admin mematikan customer service: tidak ada chat sama sekali,
// hanya alasan yang ditulis admin, ditata gaya komik 3D supaya enak dibaca.
function CsTutup({alasan,jam}){
 const baris=String(alasan||'').split('\n').map(x=>x.trim()).filter(Boolean)
 return <div className="cxo">
  <div className="cxo-bg" aria-hidden><i className="cxo-rays"/><i className="cxo-dots"/></div>
  <a href="/dashboard" className="cxo-bk" aria-label="Kembali">‹</a>
  <div className="cxo-in">
   <div className="cxo-art">
    <span className="cxo-burst">TUTUP<br/>DULU</span>
    <div className="cxo-mask"><Mascot size={132}/></div>
    <span className="cxo-zzz">💤</span></div>
   <span className="cxo-tag">CUSTOMER SERVICE</span>
   <h1 className="cxo-h1">LAGI OFF<br/><em>SEMENTARA</em></h1>
   <div className="cxo-card">
    <span className="cxo-lbl">PESAN DARI ADMIN</span>
    {baris.length?baris.map((x,i)=><p key={i}>{x}</p>):<p>Customer service sedang dinonaktifkan sementara.</p>}</div>
   <div className="cxo-chips">
    <span className="cxo-chip"><b>🕘 Jam normal</b>{jam||'09.00 - 17.00 & 18.00 - 22.00 WIB'}</span>
    <span className="cxo-chip"><b>💾 Chat lamamu aman</b>Riwayat tidak terhapus, muncul lagi saat CS dibuka</span>
    <span className="cxo-chip"><b>⚡ Transaksi tetap jalan</b>Beli nokos, deposit, dan refund otomatis tidak terpengaruh</span></div>
   <div className="cxo-btns">
    <a className="cxo-go" href="/dashboard">← Kembali ke Dashboard</a>
    <a className="cxo-sec" href="/pengumuman">📣 Lihat Pengumuman</a></div>
   <p className="cxo-note">Begitu admin membuka CS lagi, halaman ini otomatis berubah jadi ruang chat seperti biasa.</p>
  </div></div>}
