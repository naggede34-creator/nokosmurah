'use client'
import {useState} from 'react'
// Pengelola popup promosi: tambah, ubah, hapus, atur tombol (tambah/hapus), dan unggah gambar.
// Daftar disimpan sekaligus lewat /api/admin/pop/save.
const TEMA=[['pink','Pink'],['blue','Biru'],['yellow','Kuning'],['green','Hijau'],['purple','Ungu']]
const baru=()=>({id:'',on:true,badge:'BARU!',title:'',body:'',img:'',theme:'blue',mode:'jeda',days:3,delay:2,skip:'/login,/register,/admin',only:'',btns:[{t:'Lihat sekarang →',href:'/dashboard',kind:'go'},{t:'Nanti saja',href:'',kind:'no'}]})
export default function AdminPopups({pops,setPops,save,busy,shrink,sel,setSel}){
 const [err,setErr]=useState('')
 const list=pops||[]
 const i=Math.min(sel,Math.max(0,list.length-1))
 const p=list[i]
 const upd=(f,v)=>setPops(list.map((x,n)=>n===i?{...x,[f]:v}:x))
 const updB=(bi,f,v)=>upd('btns',(p.btns||[]).map((b,n)=>n===bi?{...b,[f]:v}:b))
 const tambah=()=>{setPops([...list,baru()]);setSel(list.length)}
 const hapus=()=>{if(!confirm('Hapus popup "'+(p.title||'tanpa judul')+'"? Perubahan berlaku setelah Simpan.'))return
  const sisa=list.filter((x,n)=>n!==i);setPops(sisa);setSel(Math.max(0,i-1))}
 const foto=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return
  setErr('');try{upd('img',await shrink(f))}catch(x){setErr('Gambar tidak bisa dipakai / terlalu besar. Pakai foto biasa (JPG/PNG) di bawah 3MB.')}}
 return <>
  <div className="card"><h3>🪧 Popup promosi</h3>
   <p className="muted">Popup yang muncul di situs. Kamu bisa menambah, mengubah, dan menghapus popup; tiap popup bisa diisi gambar (unggah), tombol sebanyak-banyaknya (maks 4), tema warna, jeda muncul lagi, dan halaman yang dilewati. Yang saklarnya mati tidak pernah tampil.</p>
   <div className="pop-tabs">
    {list.map((x,n)=><button key={n} className={n===i?'on':''} onClick={()=>setSel(n)}>
     <i className={x.on===false?'off':'on'}/>{x.title?x.title.slice(0,22):'(tanpa judul)'}</button>)}
    <button className="add" onClick={tambah}>+ Popup baru</button></div>
   {!list.length&&<p className="muted">Belum ada popup. Tekan <b>+ Popup baru</b> untuk membuat.</p>}</div>

  {p&&<div className="card">
   <div className="sv-top"><b>Popup aktif</b><span style={{flex:1}}/>
    <button type="button" role="switch" aria-checked={p.on!==false} className={'sw'+(p.on!==false?' on':'')} onClick={()=>upd('on',p.on===false)}><i/></button></div>
   <div className="ad-g">
    <label>Judul besar<input maxLength={70} placeholder="Jualan Nokos Tanpa Modal!" value={p.title||''} onChange={e=>upd('title',e.target.value)}/></label>
    <label>Stiker sudut (kosongkan = tanpa stiker)<input maxLength={16} placeholder="BARU!" value={p.badge||''} onChange={e=>upd('badge',e.target.value)}/></label></div>
   <label className="blk">Isi teks — satu baris = satu paragraf. Awali dengan <code>•</code> supaya jadi daftar berkotak.
    <textarea rows={5} maxLength={900} placeholder={'Punya bot Telegram sendiri? Jadikan toko nokos kamu.\n• Set untung sendiri\n• Tanpa modal\n• Untung bisa ditarik otomatis'} value={p.body||''} onChange={e=>upd('body',e.target.value)}/></label>
   <div className="ad-g">
    <label>Tema warna<select value={p.theme||'blue'} onChange={e=>upd('theme',e.target.value)}>{TEMA.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <label>Kapan muncul<select value={p.mode||'jeda'} onChange={e=>upd('mode',e.target.value)}>
     <option value="jeda">Beri jeda beberapa hari</option>
     <option value="buka">Setiap kali web dibuka</option>
     <option value="selalu">Setiap pindah halaman</option></select></label>
    {(p.mode||'jeda')==='jeda'&&<label>Muncul lagi setiap (hari)<input type="number" min="0" max="90" value={p.days??3} onChange={e=>upd('days',e.target.value)}/></label>}
    <label>Jeda sebelum muncul (detik)<input type="number" min="0" max="30" step="0.5" value={p.delay??2} onChange={e=>upd('delay',e.target.value)}/></label></div>
   <div className="ad-g">
    <label>Jangan tampil di halaman (pisah koma)<input placeholder="/login,/register,/admin" value={p.skip||''} onChange={e=>upd('skip',e.target.value)}/></label>
    <label>Hanya tampil di halaman (kosong = semua)<input placeholder="/dashboard" value={p.only||''} onChange={e=>upd('only',e.target.value)}/></label></div>

   <div className="pop-img">
    <div className="pop-pv">{p.img?<img src={p.img} alt=""/>:<span>Belum ada gambar</span>}</div>
    <div className="pop-ib">
     <label className="btn sil">📁 Unggah gambar<input type="file" accept="image/*" hidden onChange={foto}/></label>
     {p.img&&<button className="btn red" onClick={()=>upd('img','')}>Hapus gambar</button>}
     <small className="muted">Otomatis dikecilkan di browser (maks ~280KB) supaya popup tetap cepat.</small></div></div>
   {err&&<p className="err">{err}</p>}

   <div className="pop-btns">
    <div className="sv-top"><b>Tombol di popup</b><span style={{flex:1}}/>
     <button className="btn sil" disabled={(p.btns||[]).length>=4} onClick={()=>upd('btns',[...(p.btns||[]),{t:'Tombol baru',href:'/dashboard',kind:'go'}])}>+ Tambah tombol</button></div>
    {(p.btns||[]).length===0&&<p className="muted">Belum ada tombol. Popup masih bisa ditutup lewat tanda ✕.</p>}
    {(p.btns||[]).map((b,bi)=><div key={bi} className="pop-b">
     <input placeholder="Tulisan tombol" maxLength={30} value={b.t||''} onChange={e=>updB(bi,'t',e.target.value)}/>
     <select value={b.kind||'go'} onChange={e=>updB(bi,'kind',e.target.value)}>
      <option value="go">Buka tautan</option><option value="no">Tutup popup</option></select>
     <input placeholder="/reseller atau https://..." disabled={b.kind==='no'} value={b.href||''} onChange={e=>updB(bi,'href',e.target.value)}/>
     <button className="btn red" onClick={()=>upd('btns',(p.btns||[]).filter((x,n)=>n!==bi))}>Hapus</button></div>)}</div>

   <div className="savebar"><button className="btn red" onClick={hapus}>🗑 Hapus popup ini</button>
    <span style={{flex:1}}/><button className="btn blue" disabled={busy} onClick={()=>save()}>{busy?'Menyimpan…':'Simpan semua popup'}</button></div>
  </div>}</>}
