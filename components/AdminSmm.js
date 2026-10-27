'use client'
import {useState,useEffect,useCallback,useMemo} from 'react'
// Menu admin > Operasional > Suntik Sosmed: saklar fitur, markup (umum & per platform), kurs penyedia,
// pembulatan, daftar layanan (aktif/nonaktif), saldo penyedia, log order terakhir, sinkron manual.
// API key penyedia diisi di Sistem > Integrasi & kunci (grup "Suntik Sosmed").
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(+t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-'
const Sw=({on,set,label})=><button type="button" role="switch" aria-checked={!!on} aria-label={label} className={'sw'+(on?' on':'')} onClick={()=>set(!on)}><i/></button>
const ST={pending:'🟡 Menunggu',processing:'🔵 Diproses',success:'🟢 Berhasil',partial:'🟠 Sebagian',cancelled:'🔴 Batal'}

export default function AdminSmm({call}){
 const [d,setD]=useState(null),[c,setC]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
 const [svc,setSvc]=useState(null),[q,setQ]=useState(''),[pf,setPf]=useState(''),[mk,setMk]=useState({}),[pid,setPid]=useState('')
 const load=useCallback(async()=>{const r=await call('smm/config');if(r.error){setMsg(r.error);return}setD(r);setC(r.cfg);setMk(Object.fromEntries(Object.entries(r.cfg.mkp||{}).map(([k,v])=>[k,String(v)])))},[call])
 useEffect(()=>{load()},[load])
 const loadSvc=async force=>{setBusy(true);const r=await call('smm/services',{force});setBusy(false);if(r.error){setMsg(r.error);return}setSvc(r)}
 const save=async patch=>{setBusy(true);const r=await call('smm/save',patch);setBusy(false);if(r.error){setMsg('⚠️ '+r.error);return false}setC(r.cfg);setD(x=>({...x,cfg:r.cfg}));setMsg('✅ Tersimpan');return true}
 const saveMain=()=>save({markup:c.markup,kurs:c.kurs,round:c.round,minPrice:c.minPrice,refill:c.refill,cancel:c.cancel})
 const saveMkp=()=>save({mkp:mk})
 const toggleSvc=async(s,on)=>{const off=new Set(c.off||[]);on?off.delete(s.id):off.add(s.id);const ok=await save({off:[...off]});if(ok)setSvc(x=>({...x,items:x.items.map(i=>i.id===s.id?{...i,on:on&&!(c.offPlat||[]).includes(i.platform)}:i)}))}
 const togglePlat=async(p,on)=>{const o=new Set(c.offPlat||[]);on?o.delete(p):o.add(p);const ok=await save({offPlat:[...o]});if(ok)loadSvc(false)}
 const act=async(a,b)=>{setBusy(true);const r=await call('smm/'+a,b);setBusy(false);setMsg(r.error?'⚠️ '+r.error:'✅ '+(a==='sync'?`Sinkron: ${r.checked} dicek, ${r.updated} diperbarui, ${r.events} kejadian`:a==='order/refund'?'Refund '+rp(r.refund):'Status: '+(r.status||'-')));load()}
 const list=useMemo(()=>{if(!svc)return[];const t=q.toLowerCase();return svc.items.filter(s=>(!pf||s.platform===pf)&&(!t||(s.name+' '+s.category+' '+s.id).toLowerCase().includes(t))).slice(0,150)},[svc,q,pf])
 if(!d||!c)return <div className="card"><h3>🚀 Suntik Sosmed</h3><p className="muted">{msg||'Memuat…'}</p></div>
 const set=(k,v)=>setC(x=>({...x,[k]:v}))
 return <>
  <div className="card"><h3>🚀 Suntik Sosmed</h3>
   <p className="muted" style={{margin:'4px 0 10px'}}>Penyedia: MP Digital Solution (micypedia.id). Pengguna melihat tombol <b>SUNTIK SOSMED</b> di samping Beli Nokos (web) dan tombol Suntik di bot utama &amp; bot reseller.</p>
   {!d.hasKey&&<div className="chip2 warn" style={{marginBottom:8}}>⚠️ API key penyedia belum diisi. Buka Sistem › Integrasi &amp; kunci › Suntik Sosmed.</div>}
   <div className="ad-kpi" style={{margin:'6px 0 10px'}}>
    <div><small>Saldo penyedia</small><b>{d.balance?(d.balance.currency||'')+' '+d.balance.balance:(d.balanceError?'error':'-')}</b></div>
    <div><small>Order (log)</small><b>{d.stats.total}</b></div>
    <div><small>Berhasil</small><b>{d.stats.sukses}</b></div>
    <div><small>Omzet (log)</small><b>{rp(d.stats.omzet)}</b></div></div>
   {d.balanceError&&<p className="muted" style={{color:'#c0392b'}}>Saldo penyedia gagal dibaca: {d.balanceError}</p>}
   <div className="ad-row" style={{display:'flex',alignItems:'center',gap:10,margin:'8px 0'}}><Sw on={c.on} set={v=>{set('on',v);save({on:v})}} label="Fitur Suntik Sosmed"/><b>{c.on?'Fitur AKTIF (tombol tampil)':'Fitur MATI (tombol disembunyikan, order ditolak)'}</b></div>
  </div>

  <div className="card"><h3>💰 Harga &amp; kurs</h3>
   <p className="muted" style={{margin:'4px 0 8px'}}>Harga jual per 1000 = rate penyedia × kurs × (1 + markup%). Kalau rate penyedia sudah dalam Rupiah, biarkan kurs 1. Kalau dalam USD, isi kurs (mis. 16000).</p>
   <div className="ad-form">
    <label>Markup umum (%)<input type="number" min="0" max="1000" value={c.markup} onChange={e=>set('markup',e.target.value)}/></label>
    <label>Kurs penyedia → Rupiah<input type="number" min="0" step="any" value={c.kurs} onChange={e=>set('kurs',e.target.value)}/></label>
    <label>Pembulatan ke atas (Rp)<input type="number" min="1" value={c.round} onChange={e=>set('round',e.target.value)}/></label>
    <label>Harga minimum per order (Rp)<input type="number" min="0" value={c.minPrice} onChange={e=>set('minPrice',e.target.value)}/></label></div>
   <div style={{display:'flex',gap:18,flexWrap:'wrap',margin:'10px 0'}}>
    <label className="ad-ck"><Sw on={c.refill} set={v=>set('refill',v)} label="Refill"/> Izinkan refill</label>
    <label className="ad-ck"><Sw on={c.cancel} set={v=>set('cancel',v)} label="Batal"/> Izinkan batal</label></div>
   <div className="tabs"><button className="btn blue" disabled={busy} onClick={saveMain}>Simpan harga</button></div>
  </div>

  <div className="card"><h3>🏷️ Markup per platform (opsional)</h3>
   <p className="muted" style={{margin:'4px 0 8px'}}>Kosong = pakai markup umum. Contoh: Instagram 30 → semua layanan Instagram untung 30%.</p>
   <div className="ad-form">{(svc?svc.platforms:['Instagram','TikTok','YouTube','Facebook','Twitter / X','Telegram','Spotify','Shopee','Lainnya']).map(p=><label key={p}>{p} (%)<input type="number" min="0" max="1000" placeholder={String(c.markup)} value={mk[p]??''} onChange={e=>setMk(x=>({...x,[p]:e.target.value}))}/></label>)}</div>
   <div className="tabs" style={{marginTop:8}}><button className="btn blue" disabled={busy} onClick={saveMkp}>Simpan markup platform</button>{!svc&&<button className="btn sil" onClick={()=>loadSvc(false)}>Muat daftar platform</button>}</div>
  </div>

  <div className="card"><h3>📚 Layanan</h3>
   <div className="tabs"><button className="btn blue" disabled={busy} onClick={()=>loadSvc(true)}>{svc?'🔄 Muat ulang dari penyedia':'Muat daftar layanan'}</button></div>
   {svc&&<>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'10px 0'}}>{svc.platforms.map(p=>{const off=(c.offPlat||[]).includes(p);return <button key={p} className={'btn '+(pf===p?'blue':'sil')} style={off?{opacity:.5}:undefined} onClick={()=>setPf(pf===p?'':p)}>{p}{off?' (mati)':''}</button>})}</div>
    {pf&&<div className="tabs" style={{marginBottom:8}}><button className="btn sil" onClick={()=>togglePlat(pf,(c.offPlat||[]).includes(pf))}>{(c.offPlat||[]).includes(pf)?'Nyalakan platform '+pf:'Matikan platform '+pf}</button></div>}
    <label className="ad-ck" style={{display:'block',marginBottom:8}}>Cari<input placeholder="nama / kategori / ID layanan" value={q} onChange={e=>setQ(e.target.value)}/></label>
    <p className="muted">{svc.items.length} layanan dari penyedia · menampilkan {list.length}</p>
    <div style={{display:'grid',gap:6}}>{list.map(s=><div key={s.id} style={{display:'flex',gap:10,alignItems:'center',padding:'8px 10px',border:'1px solid #d8e0f0',borderRadius:12,opacity:s.on?1:.55}}>
     <Sw on={s.on&&!(c.offPlat||[]).includes(s.platform)} set={v=>toggleSvc(s,v)} label={'Layanan '+s.id}/>
     <div style={{flex:1,minWidth:0}}><b style={{fontSize:13}}>#{s.id} · {s.name}</b><br/><small className="muted">{s.platform} · {s.category} · min {s.min} – max {s.max}{s.refill?' · ♻️ refill':''}{s.cancel?' · ✖ batal':''}{s.type==='comments'?' · 💬 komentar':''}</small></div>
     <div style={{textAlign:'right'}}><small className="muted">modal/1000</small><br/><b style={{fontSize:12}}>{s.rate}</b><br/><small className="muted">jual/1000</small><br/><b style={{fontSize:12}}>{rp(s.price1k)}</b></div></div>)}</div></>}
  </div>

  <div className="card"><h3>🧾 Order terakhir</h3>
   <div className="tabs" style={{marginBottom:8}}><button className="btn sil" disabled={busy} onClick={()=>act('sync')}>🔄 Sinkron semua order sekarang</button></div>
   <div className="ad-form"><label>ID order penyedia<input placeholder="mis. 23501" value={pid} onChange={e=>setPid(e.target.value)}/></label></div>
   <div className="tabs" style={{margin:'6px 0 10px'}}><button className="btn sil" disabled={busy||!pid} onClick={()=>act('order/sync',{order:pid})}>Cek status order</button>
    <button className="btn sil" disabled={busy||!pid} onClick={()=>{if(confirm('Refund penuh order ini ke pengguna dan tandai dibatalkan?'))act('order/refund',{order:pid})}}>Refund paksa</button></div>
   {d.log.length===0&&<p className="muted">Belum ada order.</p>}
   <div style={{display:'grid',gap:6}}>{d.log.map(x=><div key={x.id} style={{padding:'8px 10px',border:'1px solid #d8e0f0',borderRadius:12,fontSize:13}}><b>{x.s}</b> · {x.q}<br/><small className="muted">{x.em} · {rp(x.p)} · {ST[x.st]||x.st} · {x.via} · #{x.id} · {dt(x.at)}</small></div>)}</div>
  </div>
  {msg&&<div className="card" onClick={()=>setMsg('')}><p style={{margin:0}}>{msg}</p></div>}
 </>}
