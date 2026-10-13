'use client'
import {useState,useEffect,useCallback} from 'react'
import Mascot from '../../components/Mascot'
import PushCard from '../../components/PushCard'
import {TgCard} from '../../components/ApiPanel'
import Toast from '../../components/ui/Toast'
const api=async(p,b,m)=>{const r=await fetch('/api/'+p,{method:m||(b?'POST':'GET'),headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return r.json()}
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+' WIB':'-'
const day=t=>t?new Date(t).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'}):'-'
const Row=({k,v,mono})=><div className="up-r"><small>{k}</small><span className={mono?'mono':''}>{v}</span></div>

export default function Profil(){
 const [d,setD]=useState(),[msg,setMsg]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState('')
 const [pw,setPw]=useState({old:'',neu:'',ulang:''})
 const load=useCallback(async()=>{const r=await api('v1/profile');if(r.error){setD(null);return}setD(r);setName(r.name||'')},[])
 useEffect(()=>{load()},[load])
 if(d===undefined)return <div className="up"><p className="up-load">Memuat profil…</p></div>
 if(!d){if(typeof window!=='undefined')location.href='/login';return <div className="up"><p className="up-load">Mengalihkan ke halaman masuk…</p></div>}
 const saveName=async()=>{setBusy('n');const r=await api('v1/profile',{name});setBusy('');setMsg(r.error||'Nama tersimpan');if(!r.error)load()}
 const savePw=async()=>{
  if(pw.neu!==pw.ulang)return setMsg('Password baru dan ulangannya belum sama')
  setBusy('p');const r=await api('v1/profile',{oldPassword:pw.old,newPassword:pw.neu});setBusy('')
  setMsg(r.error||'Password berhasil diganti');if(!r.error)setPw({old:'',neu:'',ulang:''})}
 const copy=(t,m)=>{try{navigator.clipboard.writeText(t);setMsg(m)}catch(e){setMsg(t)}}
 const s=d.stats||{}
 const ref=typeof window!=='undefined'?location.origin+'/register?ref='+(d.refCode||''):''
 return <div className="up">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="up-hero">
   <div className="up-av">{(d.name||d.email||'?')[0].toUpperCase()}</div>
   <div className="up-id"><h1>{d.name}</h1><span>{d.email}</span>
    <div className="up-tags"><em>Bergabung {day(d.joinedAt)}</em>{d.tgLinked&&<em className="tg">✈️ Telegram terhubung</em>}{d.devices>0&&<em className="on">🔔 {d.devices} HP</em>}</div></div>
   <div className="up-bal"><small>SALDO</small><b>{rp(d.balance)}</b><a href="/deposit">+ Isi saldo</a></div>
   <div className="up-mas"><Mascot size={84}/></div>
  </div>

  <div className="up-stats">
   <div><small>Pesanan sukses</small><b>{s.orders||0}</b><i>{rp(s.spent||0)} terpakai</i></div>
   <div><small>Deposit sukses</small><b>{s.deposits||0}</b><i>{rp(s.deposited||0)} masuk</i></div>
   <div><small>Bonus cashback</small><b>{rp(s.bonus||0)}</b><i>dari deposit</i></div>
   <div><small>Ajakan teman</small><b>{d.refCount||0}</b><i>{rp(d.refEarn||0)} didapat</i></div></div>

  <div className="up-grid">
   <section className="up-c"><h2>👤 Data akun</h2>
    <label className="up-l">Nama tampilan
     <div className="up-inline"><input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="Nama kamu"/>
      <button className="up-b" disabled={busy==='n'||!name.trim()||name===d.name} onClick={saveName}>{busy==='n'?'…':'Simpan'}</button></div></label>
    <Row k="Email" v={d.email}/>
    <Row k="Bergabung" v={day(d.joinedAt)}/>
    <Row k="Login terakhir" v={dt(d.lastLogin)}/>
    <Row k="Jumlah login" v={(d.logins||0)+' kali'}/>
    <Row k="IP terakhir" v={d.lastIp||'-'} mono/>
   </section>

   <section className="up-c"><h2>🔐 Ganti password</h2>
    <p className="up-p">Setelah diganti, semua perangkat lain otomatis keluar dan harus masuk lagi.</p>
    <label className="up-l">Password lama<input type="password" value={pw.old} onChange={e=>setPw({...pw,old:e.target.value})} placeholder="Password sekarang"/></label>
    <label className="up-l">Password baru<input type="password" value={pw.neu} onChange={e=>setPw({...pw,neu:e.target.value})} placeholder="Minimal 6 karakter"/></label>
    <label className="up-l">Ulangi password baru<input type="password" value={pw.ulang} onChange={e=>setPw({...pw,ulang:e.target.value})} placeholder="Ketik ulang"/></label>
    <button className="up-b blk" disabled={busy==='p'||!pw.old||pw.neu.length<6} onClick={savePw}>{busy==='p'?'Menyimpan…':'Ganti password'}</button>
    <p className="up-p">Lupa password lama? <a href="/login">Keluar lalu pakai "Lupa password"</a>.</p>
   </section>

   <section className="up-c"><h2>🤝 Kode ajakan</h2>
    <p className="up-p">Bagikan kode ini. Teman yang daftar &amp; deposit pertama bikin kalian berdua dapat saldo.</p>
    <div className="up-code"><code>{d.refCode||'-'}</code><button className="up-b sm" onClick={()=>copy(d.refCode||'','Kode ajakan disalin')}>Salin kode</button></div>
    <div className="up-link"><code>{ref}</code><button className="up-b sm gh" onClick={()=>copy(ref,'Link ajakan disalin')}>Salin link</button></div>
    <Row k="Teman yang diajak" v={(d.refCount||0)+' orang'}/>
    <Row k="Saldo dari ajakan" v={rp(d.refEarn||0)}/>
   </section>

   <section className="up-c"><h2>🔔 Notifikasi</h2>
    <PushCard api={api} prefix="v1/push/" compact title="Notifikasi HP" desc="Dikabari saat CS membalas dan saat deposit masuk — walaupun tab browser sudah ditutup." onMsg={setMsg}/>
    <TgCard setMsg={setMsg}/>
   </section>

   <section className="up-c"><h2>🛠 Pintasan</h2>
    <div className="up-menu">
     <a href="/dashboard"><span>🏠 Dashboard</span><i>›</i></a>
     <a href="/pay"><span>⚡ QRIS Gateway</span><i>›</i></a>
     <a href="/dashboard?tab=api"><span>🔑 API Key &amp; Docs developer</span><i>›</i></a>
     <a href="/deposit"><span>💳 Isi saldo</span><i>›</i></a>
     <a href="/cs"><span>💬 Customer Service</span><i>›</i></a>
     <a href="/docs"><span>📖 Dokumentasi API</span><i>›</i></a>
    </div>
    <Row k="Whitelist IP aktif" v={d.ipw?d.ipw+' IP':'Tidak dibatasi'}/>
    <Row k="Webhook OTP" v={d.hook?'Aktif':'Mati'}/>
    <button className="up-b red" onClick={async()=>{await api('auth/logout',{});location.href='/login'}}>Keluar dari akun</button>
   </section>
  </div>
 </div>}
