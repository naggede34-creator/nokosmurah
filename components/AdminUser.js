'use client'
import {useState,useEffect,useCallback} from 'react'
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=ms=>{if(!ms)return '-';const d=new Date(+ms);return isNaN(d)?'-':d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}
const ST={success:['ok','Berhasil'],completed:['ok','Berhasil'],pending:['wait','Menunggu'],cancelled:['no','Dibatalkan'],canceled:['no','Dibatalkan'],expired:['bad','Kedaluwarsa'],failed:['bad','Gagal']}
const Pill=({s})=>{const x=ST[s]||['no',s];return <span className={'ud-pill '+x[0]}>{x[1]}</span>}
const Via=({v})=>v==='telegram'?<span className="ud-via">🤖 Bot</span>:<span className="ud-via web">🌐 Web</span>

// Halaman detail user lengkap: profil, saldo, IP, login terakhir, riwayat order, mutasi, deposit, dan aksi cepat dalam satu layar.
export default function AdminUser({call,id,onClose,onChanged}){
 const [d,setD]=useState(null),[err,setErr]=useState(''),[tab,setTab]=useState('orders'),[amt,setAmt]=useState(''),[busy,setBusy]=useState(''),[msg,setMsg]=useState(''),[note,setNote]=useState(''),[tgm,setTgm]=useState('')
 const load=useCallback(async()=>{const r=await call('user/detail',{id});if(r.error){setErr(r.error);return}setErr('');setD(r);setNote(r.user.note||'')},[id])
 useEffect(()=>{load()},[load])
 const run=async(k,fn,ok)=>{setBusy(k);setMsg('');try{const r=await fn();if(r&&r.error)setMsg('❌ '+r.error);else{setMsg('✅ '+ok);await load();onChanged&&onChanged()}}catch(e){setMsg('❌ '+e.message)}setBusy('')}
 // Ban = akun + alamat IP-nya + semua akun yang nyambung (IP/Telegram sama).
 // Dampaknya dilihat DULU lewat pratinjau supaya admin tidak kaget.
 const banNow=async()=>{
  const email2=d&&d.user&&d.user.email;if(!email2)return
  setBusy('prev')
  const p=await call('ban/preview',{email:email2});setBusy('')
  if(p.error)return setMsg('❌ '+p.error)
  const ips=p.ips||[],akun=p.akun||[]
  const ket='Ban '+email2+'?\n\n'
   +'IP yang ikut diblokir ('+ips.length+'):\n'+(ips.length?ips.join(', '):'(tidak ada IP tercatat)')+'\n\n'
   +'Akun lain yang ikut kena ('+akun.length+'):\n'+(akun.length?akun.map(x=>x.email).join('\n'):'(tidak ada)')+'\n\n'
   +'Semua ini bisa dibuka lagi sekaligus lewat tombol Unban.'
  if(!confirm(ket))return
  const alasan=prompt('Alasan blokir (tampil ke pengguna, boleh dikosongkan):','')
  if(alasan===null)return
  run('ban',async()=>{
   const r=await call('ban',{email:email2,reason:alasan,ip:true})
   if(!r.error)setMsg('⛔ Dibanned. '+((r.ips||[]).length?(r.ips.length+' IP diblokir. '):'')+((r.akun||[]).length?(r.akun.length+' akun terkait ikut kena.'):'Tidak ada akun lain yang terhubung.'))
   return r},'User dibanned')}
 // Unban melepas lagi IP yang dibawa akun ini dan memulihkan akun-akun susulannya.
 const unbanNow=()=>{
  const email2=d&&d.user&&d.user.email;if(!email2)return
  if(!confirm('Buka blokir '+email2+'?\n\nIP yang dulu ikut diblokir dan akun-akun yang kena imbas akan dipulihkan sekaligus.'))return
  run('unban',async()=>{
   const r=await call('unban',{email:email2})
   if(!r.error)setMsg('♻️ Blokir dibuka. '+((r.ips||[]).length?(r.ips.length+' IP dilepas. '):'')+((r.akun||[]).length?(r.akun.length+' akun terkait ikut pulih.'):'Tidak ada akun lain yang perlu dipulihkan.'))
   return r},'User di-unban')}
 if(err)return <div className="card"><button className="btn" onClick={onClose}>← Kembali</button><p style={{color:'#dc2626'}}>{err}</p></div>
 if(!d)return <div className="card"><button className="btn" onClick={onClose}>← Kembali</button><p className="muted">Memuat data pengguna...</p></div>
 const u=d.user,s=d.stats,email=u.email,n=Math.floor(+amt)
 const needAmt=()=>{if(!(n>0)){setMsg('❌ Isi nominal lebih dari 0 dulu');return false}return true}
 const tgOnly=/@telegram\.invalid$/.test(email)
 return <div className="ud">
  <div className="ud-top"><button className="btn" onClick={onClose}>← Daftar pengguna</button><button className="btn" onClick={load}>🔄 Muat ulang</button></div>

  <div className="ud-hero card">
   <div className="ud-av">{String(u.name||email)[0].toUpperCase()}</div>
   <div className="ud-who"><h2>{u.name||'-'}</h2><div className="ud-mail">{email}</div>
    <div className="ud-badges">{u.banned?<span className="ud-pill bad">⛔ BANNED</span>:<span className="ud-pill ok">🟢 Aktif</span>}
     {u.tgId&&<span className="ud-pill tg">✈️ Telegram{u.tgUser?' @'+u.tgUser:''}</span>}{u.via==='telegram'&&<span className="ud-pill wait">Daftar via Bot</span>}{u.tgBlocked&&<span className="ud-pill no">Bot diblokir</span>}</div></div>
   <div className="ud-bal"><small>Saldo</small><b>{rp(u.balance)}</b></div>
  </div>

  <div className="ud-stats">
   <div><small>Order sukses</small><b>{s.ordersOk}</b><i>dari {s.orders}</i></div>
   <div><small>Total belanja</small><b>{rp(s.spent)}</b><i>{s.ordersPending} berjalan</i></div>
   <div><small>Total deposit</small><b>{rp(s.depositSum)}</b><i>{s.depositOk} sukses</i></div>
   <div><small>Login</small><b>{u.logins||0}x</b><i>{(u.ips||[]).length} IP</i></div>
  </div>

  <div className="card ud-act">
   <h3>⚡ Aksi cepat</h3>
   <div className="ud-row"><input type="number" inputMode="numeric" placeholder="Nominal saldo" value={amt} onChange={e=>setAmt(e.target.value)}/>
    <button className="btn ud-g" disabled={!!busy} onClick={()=>needAmt()&&run('add',()=>call('addsaldo',{email,amount:n}),'Saldo ditambah '+rp(n))}>➕ Add Saldo</button>
    <button className="btn ud-r" disabled={!!busy} onClick={()=>needAmt()&&run('del',()=>call('delsaldo',{email,amount:n}),'Saldo dikurangi '+rp(n))}>➖ Del Saldo</button></div>
   <div className="ud-row wrap">
    {u.banned?<button className="btn ud-g" disabled={!!busy} onClick={unbanNow}>♻️ Unban (akun + IP)</button>
     :<button className="btn ud-r" disabled={!!busy} onClick={banNow}>⛔ Ban + blokir IP</button>}
    <button className="btn" disabled={!!busy} onClick={async()=>{const r=await call('resetlink',{email});r.error?setMsg('❌ '+r.error):prompt('Link reset password (30 menit, sekali pakai):',r.link)}}>🔑 Link Reset Password</button>
    <button className="btn" disabled={!!busy} onClick={()=>confirm('Keluarkan semua sesi login user ini?')&&run('kick',()=>call('user/kick',{email}),'Semua sesi login dikeluarkan')}>🚪 Paksa Logout</button>
    <button className="btn" onClick={()=>{navigator.clipboard&&navigator.clipboard.writeText(email);setMsg('✅ Email disalin')}}>📋 Salin Email</button></div>
   {u.tgId&&<div className="ud-row"><input placeholder="Kirim pesan ke Telegram user..." value={tgm} onChange={e=>setTgm(e.target.value)}/><button className="btn blue" disabled={!!busy||!tgm.trim()} onClick={()=>run('tg',()=>call('user/tgmsg',{id:u.id,text:tgm}),'Pesan terkirim ke Telegram').then(()=>setTgm(''))}>✉️ Kirim</button></div>}
   {msg&&<div className="ud-msg">{msg}</div>}
  </div>

  <div className="card"><h3>🪪 Informasi akun</h3>
   <div className="ud-grid">
    <div><small>ID user</small><code>{u.id}</code></div>
    <div><small>Bergabung</small><span>{dt(Date.parse(u.joinedAt))}</span></div>
    <div><small>Login terakhir</small><span>{dt(u.lastLogin)}</span></div>
    <div><small>IP terakhir</small><code>{u.lastIp||'-'}</code></div>
    <div><small>IP saat daftar</small><code>{u.regIp||'-'}</code></div>
    <div><small>Perangkat terakhir</small><span className="ud-ua">{u.lastUa||'-'}</span></div>
    <div><small>API key</small><code>{u.apikeyHint||'-'}</code></div>
    <div><small>Whitelist IP API</small><span>{(u.ipw||[]).length?(u.ipw||[]).join(', '):'Tidak diatur'}</span></div>
    <div><small>Webhook OTP</small><span>{u.hook&&u.hook.url?(u.hook.on?'🟢 ':'⚪ ')+u.hook.url:'-'}</span></div>
    <div><small>Kode referral</small><span>{u.refCode||'-'} · {u.refCount||0} teman · {rp(u.refEarn||0)}</span></div>
    <div><small>Diajak oleh</small><span>{u.refBy?u.refBy.slice(0,8)+'…':'-'}</span></div>
    <div><small>Chat CS</small><span>{s.csMsgs} pesan{s.csUnread?` · ${s.csUnread} belum dibaca`:''}</span></div>
    <div><small>Telegram</small><span>{u.tgId?<><code>{u.tgId}</code>{u.tgUser?' @'+u.tgUser:''}</>:(tgOnly?'-':'Belum terhubung')}</span></div>
    {u.banned&&<><div><small>Diblokir sejak</small><span>{dt(u.banAt)}</span></div>
     <div><small>Alasan blokir</small><span>{u.banReason||'-'}</span></div>
     <div><small>IP ikut diblokir</small><span>{u.banIp?'Ya':'Tidak'}</span></div>
     {u.banBy&&<div><small>Kena imbas akun</small><code>{String(u.banBy).slice(0,8)}…</code></div>}</>}
   </div></div>

  <div className="card"><h3>🌐 Riwayat IP login</h3>
   {(u.ips||[]).length?<div style={{overflowX:'auto'}}><table className="ud-t"><thead><tr><th>IP</th><th>Terakhir</th><th>Pertama</th><th>Jumlah</th></tr></thead><tbody>
    {u.ips.map(x=><tr key={x.ip}><td><code>{x.ip}</code></td><td>{dt(x.at)}</td><td>{dt(x.first)}</td><td>{x.n}x</td></tr>)}</tbody></table></div>
    :<p className="muted">Belum ada data IP. Akan tercatat saat user login berikutnya.</p>}</div>

  <div className="card"><h3>📝 Catatan admin</h3>
   <textarea rows="2" placeholder="Catatan internal tentang user ini (tidak terlihat user)" value={note} onChange={e=>setNote(e.target.value)}/>
   <button className="btn" disabled={!!busy} onClick={()=>run('note',()=>call('user/note',{id:u.id,note}),'Catatan disimpan')}>💾 Simpan catatan</button></div>

  <div className="card">
   <div className="ud-tabs">{[['orders','📦 Order ('+s.orders+')'],['mut','🧾 Mutasi saldo ('+s.mutCount+')'],['dep','💳 Deposit ('+s.deposits+')']].map(([k,l])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{l}</button>)}</div>
   <div style={{overflowX:'auto'}}>
   {tab==='orders'&&(d.orders.length?<table className="ud-t"><thead><tr><th>Waktu</th><th>Layanan</th><th>Nomor</th><th>Harga</th><th>OTP</th><th>Status</th><th>Via</th></tr></thead><tbody>
    {d.orders.map(o=><tr key={o.id}><td>{dt(o.at)}</td><td>{o.service}{o.country?' · '+o.country:''}{o.guarantee?' 🛡':''}</td><td><code>{o.phone}</code></td><td>{rp(o.price)}{o.refunded?' ↩️':''}</td><td><code>{o.otp||'-'}</code></td><td><Pill s={o.status}/></td><td><Via v={o.via}/></td></tr>)}</tbody></table>:<p className="muted">Belum ada order.</p>)}
   {tab==='mut'&&(d.mut.length?<table className="ud-t"><thead><tr><th>Waktu</th><th>Keterangan</th><th>Mutasi</th><th>Saldo</th></tr></thead><tbody>
    {d.mut.map((m,i)=><tr key={i}><td>{dt(m.at)}</td><td>{m.note}</td><td style={{color:m.amt>=0?'#059669':'#dc2626',fontWeight:700}}>{m.amt>=0?'+':'-'}{rp(Math.abs(m.amt))}</td><td>{rp(m.bal)}</td></tr>)}</tbody></table>:<p className="muted">Belum ada mutasi.</p>)}
   {tab==='dep'&&(d.deposits.length?<table className="ud-t"><thead><tr><th>Waktu</th><th>ID</th><th>Metode</th><th>Nominal</th><th>Bonus</th><th>Status</th><th>Via</th></tr></thead><tbody>
    {d.deposits.map(x=><tr key={x.id}><td>{dt(x.at)}</td><td><code>{x.id}</code></td><td>{x.method||'qris'}</td><td>{rp(x.amount)}</td><td>{x.bonus?'+'+rp(x.bonus):'-'}</td><td><Pill s={x.status}/></td><td><Via v={x.via}/></td></tr>)}</tbody></table>:<p className="muted">Belum ada deposit.</p>)}
   </div></div>
 </div>}
