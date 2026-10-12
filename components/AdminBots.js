'use client'
import {useState,useEffect,useCallback} from 'react'
const dt=ms=>{if(!ms)return '-';const d=new Date(+ms);return isNaN(d)?'-':d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}

// Admin membuat / mengelola bot Telegram: tambah token dari @BotFather, atur admin bot, tes, segarkan webhook, hapus, dan broadcast.
export default function AdminBots({call}){
 const [d,setD]=useState(null),[tok,setTok]=useState(''),[adm,setAdm]=useState(''),[busy,setBusy]=useState(''),[msg,setMsg]=useState(''),[ed,setEd]=useState({}),[bt,setBt]=useState(''),[pin,setPin]=useState(true)
 const load=useCallback(async()=>{const r=await call('bots/list');if(r.error){setMsg('❌ '+r.error);return}setD(r)},[])
 useEffect(()=>{load()},[load])
 useEffect(()=>{if(!d||!d.job)return;const i=setInterval(load,5000);return()=>clearInterval(i)},[d&&d.job&&d.job.i])
 const run=async(k,fn,ok)=>{setBusy(k);setMsg('');try{const r=await fn();if(r.error)setMsg('❌ '+r.error);else{setMsg('✅ '+(typeof ok==='function'?ok(r):ok));await load()}return r}catch(e){setMsg('❌ '+e.message)}finally{setBusy('')}}
 if(!d)return <div className="card"><p className="muted">{msg||'Memuat bot...'}</p></div>
 return <>
  <div className="card"><h3>🤖 Tambah bot Telegram</h3>
   <ol className="muted" style={{paddingLeft:18,margin:'4px 0 12px'}}>
    <li>Buka <b>@BotFather</b> di Telegram, kirim <code>/newbot</code>, ikuti langkahnya, lalu salin <b>token</b>.</li>
    <li>Kirim <code>/id</code> ke bot kamu nanti untuk melihat ID Telegram-mu, atau pakai @userinfobot.</li>
    <li>Tempel token &amp; ID admin di bawah, tekan <b>Buat bot</b>. Webhook dipasang otomatis.</li></ol>
   <input placeholder="Token bot (123456789:AAH...)" value={tok} onChange={e=>setTok(e.target.value)} autoComplete="off"/>
   <input placeholder="ID Telegram admin (pisahkan koma bila lebih dari satu)" value={adm} onChange={e=>setAdm(e.target.value)} inputMode="numeric"/>
   <button className="btn blue" disabled={busy==='add'||!tok.trim()} onClick={async()=>{const r=await run('add',()=>call('bots/add',{token:tok,admins:adm}),r=>'Bot @'+r.username+' aktif. Buka bot lalu kirim /start.');if(r&&!r.error){setTok('');setAdm('')}}}>{busy==='add'?'Memasang...':'➕ Buat bot'}</button>
   <p className="muted" style={{marginBottom:0}}>Webhook memakai alamat <code>{d.site}</code> (wajib HTTPS). Bot bisa dipasang maksimal 5.</p>
   {msg&&<div className="ud-msg">{msg}</div>}</div>

  <div className="card"><h3>Bot terpasang ({d.items.length})</h3>
   <p className="muted">Pengguna bot terdaftar: <b>{d.users}</b></p>
   {!d.items.length&&<p className="muted">Belum ada bot. Tambahkan bot pertamamu di atas.</p>}
   {d.items.map(b=>{const e=ed[b.id]!==undefined?ed[b.id]:b.admins.join(', ')
    return <div key={b.id} className="bt-item">
     <div className="bt-h"><div className="bt-av">🤖</div><div style={{flex:1,minWidth:0}}><b>{b.name}</b><div className="muted" style={{margin:0}}>@{b.username} · token {b.hint} · {dt(b.at)}</div></div>
      <span className={'ud-pill '+(b.on?'ok':'no')}>{b.on?'Aktif':'Mati'}</span></div>
     <div className="bt-w">{b.webhook.url?<>🔗 Webhook aktif · antrean {b.webhook.pending}</>:<>⚠️ Webhook belum terpasang — tekan Segarkan</>}{b.webhook.error&&<div style={{color:'#dc2626'}}>Error terakhir: {b.webhook.error} ({dt(b.webhook.errorAt)})</div>}</div>
     <input placeholder="ID admin (pisahkan koma)" value={e} onChange={x=>setEd({...ed,[b.id]:x.target.value})} inputMode="numeric"/>
     <div className="ud-row wrap">
      <button className="btn" disabled={!!busy} onClick={()=>run('s'+b.id,()=>call('bots/save',{id:b.id,admins:e}),'Admin bot disimpan')}>💾 Simpan admin</button>
      <button className="btn" disabled={!!busy} onClick={()=>run('t'+b.id,()=>call('bots/test',{id:b.id}),r=>r.info)}>📨 Tes</button>
      <button className="btn" disabled={!!busy} onClick={()=>run('r'+b.id,()=>call('bots/refresh',{id:b.id}),'Webhook disegarkan')}>🔄 Segarkan</button>
      <button className="btn" disabled={!!busy} onClick={()=>run('o'+b.id,()=>call('bots/save',{id:b.id,on:!b.on}),b.on?'Bot dimatikan':'Bot diaktifkan')}>{b.on?'⏸ Matikan':'▶️ Aktifkan'}</button>
      <a className="btn blue" href={'https://t.me/'+b.username} target="_blank" rel="noreferrer">Buka bot ↗</a>
      <button className="btn ud-r" disabled={!!busy} onClick={()=>confirm('Hapus bot @'+b.username+'? Webhook dicabut, data pengguna tetap aman.')&&run('d'+b.id,()=>call('bots/del',{id:b.id}),'Bot dihapus')}>🗑 Hapus</button></div>
    </div>})}</div>

  {d.items.some(b=>b.on)&&<div className="card"><h3>📢 Broadcast ke pengguna bot</h3>
   <p className="muted">Pesan dikirim ke semua pengguna bot ({d.users}). Format HTML boleh: <code>&lt;b&gt;tebal&lt;/b&gt;</code>, <code>&lt;i&gt;miring&lt;/i&gt;</code>. Untuk broadcast foto, gunakan panel admin di bot (/admin).</p>
   <textarea rows="4" placeholder="Isi broadcast..." value={bt} onChange={e=>setBt(e.target.value)}/>
   <label className="ud-chk"><input type="checkbox" checked={pin} onChange={e=>setPin(e.target.checked)}/> 📌 Semat (pin) otomatis di chat pengguna</label>
   {d.job&&<div className="ud-msg">📡 Sedang berjalan: {d.job.i}/{d.job.total} · terkirim {d.job.ok} · gagal {d.job.fail}</div>}
   <button className="btn blue" disabled={busy==='bc'||!bt.trim()||!!d.job} onClick={()=>confirm('Kirim ke '+d.users+' pengguna'+(pin?' dan semat pesan':'')+'?')&&run('bc',()=>call('bots/broadcast',{text:bt,pin}),r=>`Selesai ${r.sent}/${r.total}${r.fail?', gagal '+r.fail:''}${r.done?'':' · sisanya dilanjutkan otomatis oleh cron'}`).then(r=>r&&!r.error&&setBt(''))}>{busy==='bc'?'Mengirim...':(pin?'📌 Kirim + Pin':'📢 Kirim')}</button></div>}

  <div className="card"><h3>✨ Fitur bot</h3>
   <div className="bt-feat">
    <div><b>Untuk pengguna</b><ul><li>🛒 Beli nokos: server → aplikasi → negara → konfirmasi</li><li>💰 Isi saldo QRIS &amp; Virtual Account + QR langsung</li><li>🔑 OTP &amp; saldo masuk dikirim otomatis</li><li>📜 Riwayat, 🧾 mutasi, 🎁 referral</li><li>🌐 Tombol menuju web, buat password web, hubungkan akun web</li></ul></div>
    <div><b>Untuk admin (/admin)</b><ul><li>➕ Add / ➖ Del saldo, ⛔ Ban / ♻️ Unban</li><li>📢 Broadcast biasa &amp; 📌 broadcast + pin</li><li>💳 Pilih metode pembayaran &amp; gateway</li><li>🛠 Maintenance on/off (global &amp; per server)</li><li>🖥 Server, 💰 markup, 📊 statistik, 👤 cek user, 💾 backup</li></ul></div></div>
   <p className="muted" style={{marginBottom:0}}>Setiap transaksi dari bot juga masuk ke channel notifikasi dengan tampilan kartu khusus “BOT”.</p></div>
 </>}
