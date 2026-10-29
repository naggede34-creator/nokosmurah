'use client'
import {useState,useEffect,useCallback,useRef} from 'react'
// Admin › Produk lainnya: tambah / ubah / hapus produk digital. Data yang dikirim ke pembeli: link, teks, foto, atau file.
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const Sw=({on,set,label})=><button type="button" role="switch" aria-checked={!!on} aria-label={label} className={'sw'+(on?' on':'')} onClick={()=>set(!on)}><i/></button>
const TYPE=[['text','📝 Teks','Kode, akun, petunjuk'],['link','🔗 Link','Tautan grup / unduhan'],['photo','🖼 Foto','Gambar tampil langsung'],['file','📎 File','Unduhan maks 3 MB']]
const EMPTY={name:'',price:'',emoji:'📦',desc:'',type:'text',text:'',link:'',items:'',unique:false,stock:'',unlimited:false,on:true}
const b64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=()=>no(new Error('Gagal membaca file'));r.readAsDataURL(f)})
export default function AdminProduk({call}){
 const [d,setD]=useState(null),[f,setF]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[up,setUp]=useState({})
 const fileRef=useRef(),iconRef=useRef()
 const load=useCallback(async()=>{const r=await call('prod/list');if(r.error){setMsg('❌ '+r.error);return}setD(r)},[call])
 useEffect(()=>{load()},[load])
 const edit=p=>{setUp({});setF(p?{...EMPTY,...p,price:String(p.price),stock:p.stock==null?'':String(p.stock),unlimited:!!p.unlimited}:{...EMPTY});window.scrollTo&&window.scrollTo({top:0,behavior:'smooth'})}
 const pick=async(k,file)=>{if(!file)return;const lim=k==='icon'?d.limits.icon:k==='photo'?d.limits.photo:d.limits.file
  if(file.size>lim){setMsg(`⚠️ Maksimal ${Math.round(lim/1024)} KB untuk ${k}`);return}
  setUp(x=>({...x,[k]:{name:file.name,mime:file.type||'application/octet-stream',b64:null,size:file.size}}));const data=await b64(file);setUp(x=>({...x,[k]:{...x[k],b64:data}}))}
 const save=async()=>{setBusy(true);setMsg('')
  const body={id:f.id,name:f.name,price:f.price,emoji:f.emoji,desc:f.desc,type:f.type,text:f.text,link:f.link,items:f.items,unique:f.unique,stock:f.stock,unlimited:f.unlimited,on:f.on}
  if(up.icon&&up.icon.b64)body.icon={mime:up.icon.mime,b64:up.icon.b64}
  if(f.type==='photo'&&up.photo&&up.photo.b64)body.photo={name:up.photo.name,mime:up.photo.mime,b64:up.photo.b64}
  if(f.type==='file'&&up.file&&up.file.b64)body.file={name:up.file.name,mime:up.file.mime,b64:up.file.b64}
  const r=await call('prod/save',body);setBusy(false);if(r.error){setMsg('⚠️ '+r.error);return}setMsg('✅ Produk tersimpan');setF(null);setUp({});load()}
 const act=async(a,b,ok)=>{const r=await call('prod/'+a,b);if(r.error){setMsg('⚠️ '+r.error);return}setMsg(ok||'✅ Selesai');load()}
 if(!d)return <div className="card"><h3>🛒 Produk lainnya</h3><p className="muted">{msg||'Memuat…'}</p></div>
 const set=(k,v)=>setF(x=>({...x,[k]:v})),isUniq=f&&(f.type==='link'||f.type==='text')&&f.unique
 return <>
  <div className="card"><h3>🛒 Produk lainnya</h3>
   <p className="muted" style={{margin:'4px 0 10px'}}>Produk digital yang dijual di web (tombol <b>PRODUK LAINNYA</b>) dan bot. Isi data yang dikirim ke pembeli: <b>teks, link, foto, atau file</b>. Stok berkurang otomatis dan saldo pembeli terpotong saat beli.</p>
   {!f&&<div className="tabs"><button className="btn blue" onClick={()=>edit(null)}>+ Tambah produk</button></div>}
   {msg&&<p onClick={()=>setMsg('')} style={{marginTop:8}}>{msg}</p>}</div>
  {f&&<div className="card"><h3>{f.id?'Ubah produk':'Produk baru'}</h3>
   <div className="ad-form">
    <label>Nama produk<input value={f.name} maxLength={80} onChange={e=>set('name',e.target.value)} placeholder="Akun Premium 30 Hari"/></label>
    <label>Harga (Rp)<input type="number" min="0" value={f.price} onChange={e=>set('price',e.target.value)} placeholder="15000"/></label>
    <label>Ikon emoji<input value={f.emoji} maxLength={4} onChange={e=>set('emoji',e.target.value)} placeholder="📦"/></label>
    <label>Atau ikon gambar (maks 200 KB)<input ref={iconRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>pick('icon',e.target.files[0])}/></label></div>
   {f.iconUrl&&!up.icon&&<p className="muted">Ikon gambar saat ini ada. <button className="btn sil" onClick={()=>act('save',{...f,price:f.price,removeIcon:true,stock:f.stock},'Ikon gambar dihapus')}>Hapus ikon gambar</button></p>}
   <label className="ad-ck" style={{display:'block',margin:'8px 0'}}>Deskripsi<textarea rows={3} style={{width:'100%'}} maxLength={1500} value={f.desc} onChange={e=>set('desc',e.target.value)} placeholder="Apa yang didapat pembeli, syarat, garansi, cara pakai…"/></label>
   <b>Jenis data yang dikirim ke pembeli</b>
   <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,margin:'8px 0'}}>{TYPE.map(([k,t,s])=><button key={k} type="button" className={'btn '+(f.type===k?'blue':'sil')} style={{textAlign:'left',padding:'10px 12px'}} onClick={()=>set('type',k)}><b>{t}</b><br/><small>{s}</small></button>)}</div>
   {f.type==='text'&&!isUniq&&<label className="ad-ck" style={{display:'block'}}>Teks untuk pembeli<textarea rows={4} style={{width:'100%'}} value={f.text} onChange={e=>set('text',e.target.value)} placeholder="Kode / akun / petunjuk"/></label>}
   {f.type==='link'&&!isUniq&&<label className="ad-ck" style={{display:'block'}}>Link untuk pembeli<input style={{width:'100%'}} value={f.link} onChange={e=>set('link',e.target.value)} placeholder="https://…"/></label>}
   {(f.type==='text'||f.type==='link')&&<label className="ad-ck" style={{display:'flex',alignItems:'center',gap:8,margin:'8px 0'}}><Sw on={f.unique} set={v=>set('unique',v)} label="Unik"/> Satu baris = satu stok (tiap pembeli dapat {f.type==='link'?'link':'teks'} berbeda)</label>}
   {isUniq&&<label className="ad-ck" style={{display:'block'}}>Daftar {f.type==='link'?'link':'baris teks'} (satu per baris){f.id&&<small className="muted"> · isi di bawah menggantikan seluruh stok yang ada</small>}<textarea rows={6} style={{width:'100%',fontFamily:'monospace'}} value={f.items} onChange={e=>set('items',e.target.value)} placeholder={f.type==='link'?'https://…\nhttps://…':'KODE-1\nKODE-2'}/></label>}
   {f.type==='photo'&&<label className="ad-ck" style={{display:'block'}}>Foto untuk pembeli (PNG/JPG/WEBP, maks 2 MB){f.hasFile&&!up.photo&&<small className="muted"> · sudah ada: {f.fileName}</small>}<input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>pick('photo',e.target.files[0])}/></label>}
   {f.type==='file'&&<label className="ad-ck" style={{display:'block'}}>File untuk pembeli (maks 3 MB; .zip disarankan){f.hasFile&&!up.file&&<small className="muted"> · sudah ada: {f.fileName}</small>}<input ref={fileRef} type="file" onChange={e=>pick('file',e.target.files[0])}/></label>}
   {up[f.type]&&<p className="muted">📎 {up[f.type].name} · {Math.round(up[f.type].size/1024)} KB {up[f.type].b64?'✓ siap':'… membaca'}</p>}
   {!isUniq&&<div className="ad-form" style={{marginTop:8}}><label>Stok<input type="number" min="0" disabled={f.unlimited} value={f.unlimited?'':f.stock} onChange={e=>set('stock',e.target.value)} placeholder={f.unlimited?'tak terbatas':'10'}/></label>
    <label className="ad-ck" style={{display:'flex',alignItems:'center',gap:8}}><Sw on={f.unlimited} set={v=>set('unlimited',v)} label="Tak terbatas"/> Stok tak terbatas</label></div>}
   <label className="ad-ck" style={{display:'flex',alignItems:'center',gap:8,margin:'10px 0'}}><Sw on={f.on} set={v=>set('on',v)} label="Dijual"/> <b>{f.on?'Dijual (tampil di toko)':'Disembunyikan'}</b></label>
   <div className="tabs"><button className="btn blue" disabled={busy||(f.type==='file'&&up.file&&!up.file.b64)||(f.type==='photo'&&up.photo&&!up.photo.b64)} onClick={save}>{busy?'Menyimpan…':'Simpan produk'}</button><button className="btn sil" onClick={()=>{setF(null);setUp({})}}>Batal</button></div></div>}
  <div className="card"><h3>Daftar produk ({d.items.length})</h3>
   {d.items.length===0&&<p className="muted">Belum ada produk. Tekan “+ Tambah produk”.</p>}
   <div style={{display:'grid',gap:8}}>{d.items.map(p=><div key={p.id} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',border:'1px solid #d8e0f0',borderRadius:12,opacity:p.on?1:.55}}>
    <div style={{width:44,height:44,borderRadius:12,background:'#eef3ff',display:'grid',placeItems:'center',fontSize:24,overflow:'hidden',flex:'none'}}>{p.iconUrl?<img src={p.iconUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:p.emoji}</div>
    <div style={{flex:1,minWidth:0}}><b>{p.name}</b><br/><small className="muted">{rp(p.price)} · {p.type} · stok {p.stock===null?'∞':p.stock} · terjual {p.sold||0}</small></div>
    <Sw on={p.on} set={v=>act('toggle',{id:p.id,on:v})} label="Dijual"/>
    <button className="btn sil" onClick={()=>edit(p)}>Ubah</button>
    <button className="btn sil" onClick={()=>{const t=p.unique?prompt('Tambah baris (pisahkan dengan baris baru; di prompt gunakan koma lalu otomatis dipisah):'):prompt('Stok baru (angka):',p.stock==null?'':p.stock);if(t==null)return;act('restock',p.unique?{id:p.id,add:t.split(',').join('\n')}:{id:p.id,stock:t},'✅ Stok diperbarui')}}>Stok</button>
    <button className="btn sil" onClick={()=>{if(confirm('Hapus produk "'+p.name+'" permanen?'))act('del',{id:p.id},'🗑 Produk dihapus')}}>🗑</button></div>)}</div></div>
 </>}
