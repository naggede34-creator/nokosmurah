'use client'
import {useState,useEffect,useCallback} from 'react'
// Pesan otomatis harian ke SEMUA pengguna di SEMUA bot (utama, tambahan, reseller tanpa modal, reseller stok mandiri).
const hm=ms=>ms?new Date(ms).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit'}).replace('.',':'):'-'
const dtm=ms=>new Date(ms).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
const Sw=({on,set,label})=><button type="button" role="switch" aria-checked={!!on} aria-label={label} className={'sw'+(on?' on':'')} onClick={()=>set(!on)}><i/></button>
const strip=t=>String(t||'').replace(/<[^>]+>/g,'')
export default function AdminDailyMsg({call}){
 const [d,setD]=useState(null),[c,setC]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState('')
 const load=useCallback(async()=>{const r=await call('dm/get');if(r.error){setMsg('❌ '+r.error);return}setD(r);setC(r.cfg)},[call])
 useEffect(()=>{load()},[load])
 if(!d||!c)return <div className="card"><h3>⏰ Pesan otomatis harian</h3><p className="muted">{msg||'Memuat…'}</p></div>
 const set=(k,v)=>setC(x=>({...x,[k]:v})),setSlot=(id,k,v)=>setC(x=>({...x,slots:x.slots.map(s=>s.id===id?{...s,[k]:v}:s)}))
 const save=async(patch)=>{setBusy('save');const body={...c,...patch,slots:(patch&&patch.slots)||c.slots.map(({id,on,at,offset,custom})=>({id,on,at,offset,custom}))};const r=await call('dm/save',body);setBusy('');if(r.error){setMsg('⚠️ '+r.error);return}setMsg('✅ Tersimpan');load()}
 const now=async slot=>{if(!confirm('Kirim pesan '+slot+' SEKARANG ke semua pengguna di semua bot yang dipilih?'))return;setBusy('now'+slot);const r=await call('dm/now',{slot});setBusy('');setMsg(r.error?'⚠️ '+r.error:'✅ Broadcast dimulai (pantau di kartu Broadcast di atas)');load()}
 return <div className="card"><h3>⏰ Pesan otomatis harian</h3>
  <p className="muted" style={{margin:'4px 0 10px'}}>Dikirim otomatis ke semua pengguna di semua bot: sapaan + semangat (bergilir tiap hari), jadwal Magrib, dan ajakan Order Nokos{' / '}Suntik Sosmed. Satu kali per slot per hari, dijalankan cron tiap menit. Jam dalam WIB.</p>
  <div style={{display:'flex',alignItems:'center',gap:10,margin:'6px 0 12px'}}><Sw on={c.on} set={v=>{set('on',v);save({on:v})}} label="Pesan otomatis"/><b>{c.on?'AKTIF — pesan terkirim sesuai jadwal':'MATI — belum ada pesan otomatis yang dikirim'}</b></div>
  <div className="ad-form"><label>Kota acuan jadwal Magrib<select value={c.city} onChange={e=>set('city',e.target.value)}>{d.cities.map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Magrib hari ini<input readOnly value={d.magrib?d.magrib.hhmm+' '+d.magrib.zona:'-'}/></label></div>
  <div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'10px 0'}}>{[['main','Bot utama & tambahan'],['komisi','Reseller tanpa modal'],['mandiri','Reseller stok mandiri']].map(([k,l])=><label key={k} className="ad-ck" style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={!!c.targets[k]} onChange={e=>set('targets',{...c.targets,[k]:e.target.checked})}/>{l}</label>)}</div>
  {c.slots.map((s,i)=>{const sv=d.cfg.slots[i]||{};return <div key={s.id} style={{padding:'10px 12px',border:'1px solid #d8e0f0',borderRadius:12,margin:'8px 0',opacity:s.on?1:.6}}>
   <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><Sw on={s.on} set={v=>setSlot(s.id,'on',v)} label={s.label}/><b style={{flex:1}}>{s.label}</b>
    {s.id==='magrib'?<label className="muted">kirim <input type="number" min="0" max="120" value={s.offset} onChange={e=>setSlot(s.id,'offset',e.target.value)} style={{width:60}}/> menit sebelum Magrib</label>:<label className="muted">jam <input type="time" value={s.at} onChange={e=>setSlot(s.id,'at',e.target.value)}/></label>}
    <small className="muted">{sv.when?'berikutnya ±'+hm(sv.when):''}{sv.sentToday?' · ✅ sudah terkirim hari ini':''}</small></div>
   <details style={{marginTop:6}}><summary className="muted" style={{cursor:'pointer'}}>Pratinjau &amp; teks sendiri (opsional)</summary>
    <pre style={{whiteSpace:'pre-wrap',font:'13px/1.5 system-ui',background:'#f6f8fd',padding:10,borderRadius:10,margin:'8px 0'}}>{strip(sv.preview)}</pre>
    <textarea rows={4} style={{width:'100%'}} placeholder="Kosongkan = pakai teks bawaan yang bergilir tiap hari. Boleh HTML Telegram (&lt;b&gt;, &lt;i&gt;) dan {magrib} {zona} {kota} {tanggal}" value={s.custom} onChange={e=>setSlot(s.id,'custom',e.target.value)}/>
    <div className="tabs" style={{marginTop:6}}><button className="btn sil" disabled={!!busy} onClick={()=>now(s.id)}>{busy==='now'+s.id?'Mengirim…':'Kirim sekarang'}</button></div></details></div>})}
  <div className="tabs"><button className="btn blue" disabled={!!busy} onClick={()=>save()}>{busy==='save'?'Menyimpan…':'Simpan pengaturan'}</button></div>
  {d.log.length>0&&<><h4 style={{margin:'14px 0 6px'}}>Riwayat kirim</h4>{d.log.slice(0,8).map((l,i)=><div key={i} className="muted" style={{fontSize:13,padding:'4px 0'}}>{l.ok?'✅':'❌'} {dtm(l.at)} · {l.slot}{l.manual?' (manual)':''} · {l.ok?strip(l.text).slice(0,70):l.err}</div>)}</>}
  {msg&&<p style={{marginTop:8}} onClick={()=>setMsg('')}>{msg}</p>}</div>}
