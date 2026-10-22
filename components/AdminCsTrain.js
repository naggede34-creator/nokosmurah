'use client'
import {useState,useEffect} from 'react'
// Panel admin: LATIH AI customer service (seperti melatih agen AI WhatsApp).
//  - ganti nama customer service
//  - atur gaya bicara & catatan pengetahuan tambahan
//  - daftar latihan "kalau pengguna bertanya X, jawab Y"
//  - uji langsung (pakai draf yang belum disimpan) lalu jadikan contoh latihan dengan satu klik
const LIM={name:40,style:600,notes:1500,q:150,a:500,train:60}
const rid=()=>Math.random().toString(36).slice(2,10)
const STYLE_DEF='cewek cantik, centil, manja, ceria, hangat, pintar. Sapa pengguna "kak". Pakai "aku", bahasa Indonesia santai ala chat WhatsApp, kalimat pendek (maks 4 kalimat), emoji secukupnya (💖✨😘🥰😆). Centil tapi tetap sopan, tidak vulgar, tidak genit berlebihan, tidak merayu.'
const from=cs=>({name:(cs&&cs.name)||'',style:(cs&&cs.style)||'',notes:(cs&&cs.notes)||'',train:((cs&&cs.train)||[]).map(x=>({...x}))})
export default function AdminCsTrain({cs,call,onSaved}){
 const [f,setF]=useState(()=>from(cs)),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false)
 const [tq,setTq]=useState(''),[tr,setTr]=useState(null),[flt,setFlt]=useState('')
 // ikuti data dari server selama admin belum mengubah apa pun
 useEffect(()=>{if(!dirty)setF(from(cs))},[cs,dirty])
 const ch=p=>{setF(x=>({...x,...p}));setDirty(true)}
 const setRow=(id,p)=>ch({train:f.train.map(x=>x.id===id?{...x,...p}:x)})
 const add=(q='',a='',fw=false)=>{if(f.train.length>=LIM.train)return alert('Maksimal '+LIM.train+' latihan')
  ch({train:[{id:rid(),q,a,fw:fw?1:0},...f.train]})}
 const del=id=>ch({train:f.train.filter(x=>x.id!==id)})
 const save=async()=>{setBusy(true);const r=await call('cs/ai/save',f);setBusy(false)
  if(r.error)return alert(r.error)
  setDirty(false);setF(from(r.cs));onSaved&&onSaved(r.cs);alert('Pelatihan disimpan. Mulai chat berikutnya, AI memakai nama & latihan ini.')}
 const test=async()=>{const t=tq.trim();if(!t)return;setTr({busy:1})
  const r=await call('cs/ai/test',{text:t,draft:f});setTr({...r,q:t})}
 const jadikan=()=>{if(!tr||tr.error)return;add(tr.q,tr.text,tr.esc);setTr(null);setTq('')}
 const nm=(f.name||'').trim()||'NONA CANTIKAN'
 const rows=f.train.filter(x=>!flt.trim()||(x.q+' '+x.a).toLowerCase().includes(flt.trim().toLowerCase()))
 return <div className="card"><h3>🧠 Latih AI Customer Service</h3>
  <p className="muted">Atur nama dan cara AI menjawab, persis seperti melatih agen AI di WhatsApp. Tulis contoh <b>“kalau pengguna tanya ini → jawab begini”</b>; AI akan memakai jawabanmu (dengan gaya bicaranya) saat ada pertanyaan yang mirip. Untuk pertanyaan yang belum kamu latih, AI tetap menjawab dari pengetahuan situs.</p>

  <div className="rs-grid" style={{display:'grid',gap:10}}>
   <label className="blk">Nama customer service<input value={f.name} maxLength={LIM.name} placeholder="NONA CANTIKAN" onChange={e=>ch({name:e.target.value})}/></label>
   <label className="blk">Gaya bicara / kepribadian <small className="muted">(kosong = bawaan)</small>
    <textarea rows={3} maxLength={LIM.style} value={f.style} placeholder={STYLE_DEF} onChange={e=>ch({style:e.target.value})}/></label>
   <label className="blk">Catatan pengetahuan tambahan <small className="muted">(info yang selalu diingat AI: promo, aturan, jam kerja, nomor rekening resmi, dll)</small>
    <textarea rows={4} maxLength={LIM.notes} value={f.notes} placeholder={'Contoh:\n- Promo akhir bulan: bonus deposit tambahan 2%.\n- Admin tidak pernah meminta password atau kode OTP pengguna.'} onChange={e=>ch({notes:e.target.value})}/>
    <small className="muted">{f.notes.length}/{LIM.notes}</small></label></div>

  <div className="sv-top" style={{marginTop:14}}><b>📚 Latihan tanya-jawab ({f.train.length}/{LIM.train})</b><span style={{flex:1}}/>
   <button className="btn sil" onClick={()=>add()}>➕ Tambah latihan</button></div>
  {f.train.length>5&&<input style={{margin:'8px 0'}} placeholder="🔍 Cari latihan…" value={flt} onChange={e=>setFlt(e.target.value)}/>}
  {!f.train.length&&<p className="muted">Belum ada latihan. Klik “Tambah latihan”, atau coba uji AI di bawah lalu klik “Jadikan latihan”.</p>}
  {rows.map(x=><div key={x.id} style={{border:'1px solid #e2e8f4',borderRadius:12,padding:10,margin:'8px 0',display:'grid',gap:6}}>
   <label className="blk">Jika pengguna bertanya<input value={x.q} maxLength={LIM.q} placeholder="Contoh: berapa harga nomor WhatsApp?" onChange={e=>setRow(x.id,{q:e.target.value})}/></label>
   <label className="blk">AI harus menjawab<textarea rows={3} maxLength={LIM.a} value={x.a} placeholder="Isi jawaban yang benar. Tidak perlu persis; AI menyesuaikan gaya bicaranya." onChange={e=>setRow(x.id,{a:e.target.value})}/></label>
   <div className="ad-row" style={{alignItems:'center',gap:10}}>
    <label style={{display:'flex',gap:6,alignItems:'center',fontSize:13}}><input type="checkbox" checked={!!x.fw} onChange={e=>setRow(x.id,{fw:e.target.checked?1:0})}/>Teruskan ke admin setelah menjawab</label>
    <span style={{flex:1}}/><button className="btn sil" onClick={()=>del(x.id)}>🗑 Hapus</button></div></div>)}
  {!!flt.trim()&&!rows.length&&<p className="muted">Tidak ada latihan yang cocok.</p>}

  <div className="sv-top" style={{marginTop:14}}><b>🧪 Uji {nm}</b></div>
  <p className="muted">Ketik pertanyaan seperti pengguna. Pengujian memakai isian di atas walau belum disimpan (butuh API key Neoxr).</p>
  <div className="ad-row" style={{gap:8}}><input style={{flex:1}} value={tq} onChange={e=>setTq(e.target.value)} onKeyDown={e=>e.key==='Enter'&&test()} placeholder="Contoh: kak harga nomor WA berapa?" maxLength={300}/>
   <button className="btn sil" disabled={!!(tr&&tr.busy)||!tq.trim()} onClick={test}>{tr&&tr.busy?'Menguji…':'Kirim'}</button></div>
  {tr&&!tr.busy&&<div className={'tres '+(tr.error?'bad':'ok')} style={{whiteSpace:'pre-wrap'}}>
   {tr.error?'✕ '+tr.error:<>💖 <b>{tr.name}:</b> {tr.text}{tr.esc?'\n(→ diteruskan ke admin)':''}{'\n'}<small>{tr.used?`Memakai ${tr.used} latihan yang mirip.`:'Tidak ada latihan yang cocok, dijawab dari pengetahuan situs.'}</small></>}
   {!tr.error&&<div style={{marginTop:6}}><button className="btn sil" onClick={jadikan}>➕ Jadikan latihan (bisa diedit dulu)</button></div>}</div>}

  <div className="savebar"><button className="btn blue" disabled={busy||!dirty} onClick={save}>{busy?'Menyimpan…':dirty?'Simpan pelatihan':'Tersimpan ✓'}</button></div></div>}
