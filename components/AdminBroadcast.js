'use client'
import {useState,useEffect,useCallback,useRef} from 'react'
import {shrinkImg} from './imgtool'
const dt=ms=>{if(!ms)return '-';const d=new Date(+ms);return isNaN(d)?'-':d.toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'}
const CAT={main:['Bot utama & bot tambahan','🤖'],komisi:['Reseller tanpa modal','🏪'],mandiri:['Reseller stok mandiri','📦']}

// Broadcast KHUSUS ADMIN ke SEMUA bot: bot utama + bot tambahan, reseller tanpa modal, reseller stok mandiri.
export default function AdminBroadcast({call}){
 const [d,setD]=useState(null),[t,setT]=useState({main:true,komisi:true,mandiri:true}),[text,setText]=useState(''),[pin,setPin]=useState(false),[img,setImg]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
 const fi=useRef(null)
 const load=useCallback(async()=>{const r=await call('bcall/info');if(r.error){setMsg('❌ '+r.error);return}setD(r)},[])
 useEffect(()=>{load()},[load])
 useEffect(()=>{if(!d||!d.job||d.job.done)return;const i=setInterval(load,4000);return()=>clearInterval(i)},[d&&d.job&&d.job.done])
 if(!d)return <div className="card"><p className="muted">{msg||'Memuat...'}</p></div>
 const aktif=d.bots.filter(b=>b.on),n=Object.keys(CAT).filter(k=>t[k]).reduce((a,k)=>a+(d.totals[k]||0),0)
 const jalan=d.job&&!d.job.done
 const pick=async e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return
  try{setImg(await shrinkImg(f,900000))}catch(x){setMsg('❌ Foto tidak bisa dipakai, coba foto lain')}}
 const kirim=async()=>{
  if(!confirm('Kirim ke kira-kira '+n+' penerima di '+aktif.length+' bot'+(pin?' dan semat pesan':'')+'?'))return
  setBusy(true);setMsg('')
  try{const r=await call('bcall/start',{text,photo:img,pin,targets:t});if(r.error)setMsg('❌ '+r.error);else{setMsg('✅ Broadcast dimulai'+(r.job&&r.job.done?' dan selesai':', sisanya dilanjutkan otomatis oleh cron tiap menit'));setText('');setImg('');await load()}}
  catch(e){setMsg('❌ '+e.message)}finally{setBusy(false)}}
 return <>
  <div className="card"><h3>📡 Broadcast ke semua bot</h3>
   <p className="muted">Khusus admin. Satu pesan dikirim ke semua pengguna di bot utama, bot tambahan, bot reseller <b>tanpa modal</b>, dan bot reseller <b>stok mandiri</b>. Tiap pengguna dikirimi lewat bot tempat dia terdaftar, pemilik tiap bot ikut dapat. Akun yang diblokir, atau pengguna yang memblokir bot, dilewati.</p>
   <h4 style={{margin:'8px 0 2px'}}>Kirim ke</h4>
   {Object.keys(CAT).map(k=><label key={k} className="ud-chk"><input type="checkbox" checked={t[k]} onChange={e=>setT({...t,[k]:e.target.checked})}/> {CAT[k][1]} {CAT[k][0]} <span className="muted" style={{fontWeight:400}}>· ±{d.totals[k]||0} pengguna</span></label>)}
   <textarea rows="5" placeholder="Isi broadcast... Format HTML boleh: <b>tebal</b>, <i>miring</i>, <a href=&quot;https://...&quot;>link</a>" value={text} onChange={e=>setText(e.target.value)} maxLength={3800}/>
   <div className="ud-row wrap">
    <input ref={fi} type="file" accept="image/*" onChange={pick} style={{display:'none'}}/>
    <button className="btn" type="button" onClick={()=>fi.current&&fi.current.click()}>🖼 {img?'Ganti foto':'Tambah foto (opsional)'}</button>
    {img&&<><img src={img} alt="" style={{maxHeight:64,borderRadius:8}}/><button className="btn" type="button" onClick={()=>setImg('')}>✕</button></>}</div>
   <label className="ud-chk"><input type="checkbox" checked={pin} onChange={e=>setPin(e.target.checked)}/> 📌 Semat (pin) otomatis di chat penerima</label>
   {jalan&&<div className="ud-msg">📡 Sedang berjalan · dipindai {d.job.seen} · terkirim {d.job.ok} · gagal {d.job.fail} · dilewati {d.job.skip}
    <button className="btn ud-r" style={{marginLeft:8}} onClick={async()=>{await call('bcall/cancel');load()}}>Hentikan</button></div>}
   <button className="btn blue" disabled={busy||jalan||(!text.trim()&&!img)||(!t.main&&!t.komisi&&!t.mandiri)} onClick={kirim}>{busy?'Mengirim...':'📡 Kirim ke semua bot ('+n+')'}</button>
   {msg&&<div className="ud-msg">{msg}</div>}</div>
  <div className="card"><h3>Bot yang akan dikirimi ({aktif.length})</h3>
   {!aktif.length&&<p className="muted">Belum ada bot aktif.</p>}
   {d.bots.map(b=><div key={b.id} className="bt-item" style={{opacity:b.on?1:.5}}>
    <b>{CAT[b.cat][1]} @{b.username||b.id}</b> <span className="ud-pill ok" style={{marginLeft:6}}>{CAT[b.cat][0]}</span>{!b.on&&<span className="ud-pill no" style={{marginLeft:6}}>Mati</span>}
    <div className="muted" style={{margin:0}}>{b.users!=null?b.users+' pelanggan · ':''}{b.owners} admin/pemilik</div></div>)}</div>
  {d.last&&<div className="card"><h3>Broadcast terakhir</h3><p className="muted">{dt(d.last.at)} · terkirim <b>{d.last.ok}</b> · gagal <b>{d.last.fail}</b> · dilewati {d.last.skip}{d.last.pin?' · 📌 pin':''}</p>
   <ul style={{margin:'4px 0',paddingLeft:18}}>{Object.keys(CAT).filter(k=>d.last.t&&d.last.t[k]).map(k=><li key={k}>{CAT[k][0]}: {(d.last.per[k]||{}).ok||0} terkirim, {(d.last.per[k]||{}).fail||0} gagal</li>)}</ul>
   {d.last.note&&<p className="muted" style={{marginBottom:0}}>“{d.last.note}”</p>}</div>}
 </>}
