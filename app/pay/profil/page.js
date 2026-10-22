'use client'
import {useState,useEffect,useCallback} from 'react'
import PayShell,{api,rp,dt,Toast,Copy} from '../../../components/PayShell'
export default function PayProfil(){
 const [d,setD]=useState(),[msg,setMsg]=useState(''),[busy,setBusy]=useState(''),[show,setShow]=useState(false)
 const [ips,setIps]=useState(''),[hook,setHook]=useState(''),[hookOn,setHookOn]=useState(true),[fresh,setFresh]=useState('')
 const load=useCallback(async()=>{const r=await api('v1/pay/me');if(r.error)return setMsg(r.error)
  setD(r);setIps((r.acc.ipw||[]).join('\n'));setHook(r.acc.hook.url||'');setHookOn(r.acc.hook.on||!r.acc.hook.url)},[])
 useEffect(()=>{load()},[load])
 const run=async(k,fn)=>{setBusy(k);const r=await fn();setBusy('');if(r&&r.error)setMsg(r.error);return r}
 const regen=()=>{if(!confirm('Buat API key baru? Key lama langsung mati dan semua aplikasi yang memakainya harus diperbarui.'))return
  run('k',async()=>{const r=await api('v1/pay/key',{});if(!r.error){setFresh(r.key);setShow(true);setMsg('API key baru dibuat');load()}return r})}
 const toggleSec=on=>{if(on&&!confirm('Aktifkan HMAC? Setelah aktif, semua request API wajib ditandatangani — aplikasi lama yang belum menandatangani akan ditolak.'))return
  run('s',async()=>{const r=await api('v1/pay/secret',{on});if(!r.error){setMsg(on?'API secret dibuat — SIMPAN SEKARANG, tidak ditampilkan lagi':'HMAC dimatikan');if(r.secret)setFresh('SECRET:'+r.secret);load()}return r})}
 const saveIp=()=>run('ip',async()=>{const r=await api('v1/pay/ipw',{ipw:ips});if(!r.error){setMsg(r.ipw.length?'Whitelist disimpan ('+r.ipw.length+' IP)':'Whitelist dikosongkan: API bisa dipanggil dari IP mana saja');load()}return r})
 const saveHook=()=>run('h',async()=>{const r=await api('v1/pay/hook',{url:hook,on:hookOn});if(!r.error){setMsg(hook?'Webhook disimpan':'Webhook dimatikan');load()}return r})
 const testHook=()=>run('t',async()=>{const r=await api('v1/pay/hook/test',{});if(!r.error)setMsg(r.ok?'Tes terkirim, balasan HTTP '+r.code:'Tes gagal: '+(r.error||'HTTP '+r.code));load();return r})
 const newSecret=()=>run('hs',async()=>{const r=await api('v1/pay/hook/secret',{});if(!r.error){setMsg('Secret webhook baru dibuat');load()}return r})
 if(!d)return <PayShell><div className="pc"><div className="pay-sk" style={{height:200}}/></div></PayShell>
 const k=d.acc.key||'',masked=k.slice(0,16)+'•'.repeat(18)+k.slice(-6)
 const last=d.acc.hook.last
 return (<PayShell me={{balance:d.balance,name:d.name}}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">⚿</span><div><h2>API Key</h2><p>Kunci untuk memanggil API gateway dari server/aplikasimu</p></div></div>
   <div className="pay-code"><code>{show?k:masked}</code></div>
   <div className="pay-row" style={{marginTop:10}}>
    <button className="pb gh sm" onClick={()=>setShow(!show)}>{show?'🙈 Sembunyikan':'👁 Tampilkan'}</button>
    <Copy text={k} label="📋 Salin key" onMsg={setMsg}/>
    <button className="pb bad sm" disabled={busy==='k'} onClick={regen}>{busy==='k'?'…':'🔄 Buat ulang'}</button></div>
   {fresh&&!fresh.startsWith('SECRET:')&&<div className="pay-note warn">Key baru aktif. Perbarui semua aplikasi yang memakai key lama.</div>}
   <div className="pay-note bad">Jangan bagikan key ini. Siapa pun yang memegangnya bisa membuat QRIS dan <b>mengajukan penarikan saldomu</b>.</div>
  </section>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">🛡</span><div><h2>Whitelist IP <small style={{fontSize:11,opacity:.7,letterSpacing:'.08em'}}>(OPSIONAL)</small></h2><p>Boleh dikosongkan. Kalau diisi, API key hanya berlaku dari IP ini — satu per baris, maksimal 20</p></div></div>
   <textarea className="pin mono" style={{minHeight:90,resize:'vertical'}} placeholder={'203.0.113.10\n2001:db8::1'} value={ips} onChange={e=>setIps(e.target.value)}/>
   <div className="pay-row" style={{marginTop:10}}>
    <button className="pb sm" disabled={busy==='ip'} onClick={saveIp}>{busy==='ip'?'Menyimpan…':'💾 Simpan whitelist'}</button>
    {d.yourIp&&<button className="pb gh sm" onClick={()=>setIps(x=>x.split(/\s+/).includes(d.yourIp)?x:(x.trim()?x.trim()+'\n':'')+d.yourIp)}>+ IP saya ({d.yourIp})</button>}</div>
   <div className="pay-note">Opsional, tapi disarankan karena API ini bisa membuat tagihan dan mengajukan penarikan saldo. Kosong = bisa dipanggil dari mana saja.</div>
  </section>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">✍️</span><div><h2>API Secret <small style={{fontSize:11,opacity:.7,letterSpacing:'.08em'}}>(HMAC)</small></h2><p>Lapis kedua: tiap request wajib ditandatangani, aman walau key bocor</p></div><span className="sp"/>
    <span className={'st '+(d.acc.hasSecret?'paid':'pending')}>{d.acc.hasSecret?'aktif':'mati'}</span></div>
   {fresh.startsWith('SECRET:')&&<><div className="pay-code"><code>{fresh.slice(7)}</code><Copy text={fresh.slice(7)} onMsg={setMsg}/></div>
    <div className="pay-note warn">Simpan sekarang — secret ini <b>tidak ditampilkan lagi</b> setelah kamu meninggalkan halaman.</div></>}
   <div className="pay-row" style={{marginTop:10}}>
    {!d.acc.hasSecret?<button className="pb sm" disabled={busy==='s'} onClick={()=>toggleSec(true)}>{busy==='s'?'…':'🔐 Aktifkan HMAC'}</button>
     :<><button className="pb gh sm" disabled={busy==='s'} onClick={()=>toggleSec(true)}>🔄 Ganti secret</button>
       <button className="pb bad sm" disabled={busy==='s'} onClick={()=>toggleSec(false)}>Matikan</button></>}</div>
   <div className="pay-note">Tanda tangan: <code className="mono">HMAC_SHA256(secret, METHOD\n PATH\n BODY\n TIMESTAMP)</code> dikirim di header <code className="mono">X-Signature</code> &amp; <code className="mono">X-Timestamp</code>. Contoh kode lengkap ada di <a href="/pay/docs" style={{color:'var(--a2)'}}>Dokumentasi</a>.</div>
  </section>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">🔔</span><div><h2>Webhook</h2><p>Kami kirim POST ke URL-mu saat QRIS lunas atau penarikan selesai</p></div></div>
   <input className="pin" placeholder="https://servermu.com/webhook/artapedia-pay" value={hook} onChange={e=>setHook(e.target.value)}/>
   <label style={{display:'flex',gap:9,alignItems:'center',margin:'12px 0',fontSize:14,color:'var(--t2)'}}>
    <input type="checkbox" checked={hookOn} onChange={e=>setHookOn(e.target.checked)} style={{width:18,height:18,accentColor:'#2563eb'}}/> Aktif</label>
   <div className="pay-row">
    <button className="pb sm" disabled={busy==='h'} onClick={saveHook}>{busy==='h'?'Menyimpan…':'💾 Simpan'}</button>
    <button className="pb gh sm" disabled={busy==='t'||!d.acc.hook.url} onClick={testHook}>{busy==='t'?'Mengirim…':'🧪 Kirim tes'}</button>
    {d.acc.hook.secret&&<button className="pb gh sm" disabled={busy==='hs'} onClick={newSecret}>🔄 Secret baru</button>}</div>
   {d.acc.hook.secret&&<><div className="pf-l" style={{marginTop:14}}>SECRET WEBHOOK (untuk verifikasi tanda tangan)</div>
    <div className="pay-code"><code>{d.acc.hook.secret}</code><Copy text={d.acc.hook.secret} onMsg={setMsg}/></div></>}
   {last&&<div className={'pay-note '+(last.ok?'':'bad')}>Pengiriman terakhir {dt(last.at)} · {last.event} · {last.ok?'berhasil (HTTP '+last.code+')':'gagal: '+last.error}</div>}
   <div className="pay-note">Event: <code className="mono">qris.paid</code>, <code className="mono">qris.expired</code>, <code className="mono">qris.canceled</code>, <code className="mono">withdraw.pending</code>, <code className="mono">withdraw.success</code>, <code className="mono">withdraw.rejected</code>. Balas HTTP 2xx dalam 10 detik; gagal diulang sampai 3 kali.</div>
  </section>
 </PayShell>)}
