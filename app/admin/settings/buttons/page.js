'use client'
import {useState,useEffect,useRef,useCallback} from 'react'
import {Reorder,useDragControls,AnimatePresence,motion} from 'framer-motion'
import {GripVertical,Trash2,Upload,Plus,Save,ArrowLeft} from 'lucide-react'
import SocialButtons,{BtnIcon} from '../../../../components/SocialButtons'
import GlassButton from '../../../../components/ui/GlassButton'

// /admin/settings/buttons : kelola tombol sosial footer (tambah, ubah nama/link/logo, hapus, aktif/nonaktif, geser urutan).
// Data lewat /api/site-buttons (header x-admin = ADMIN_PASSWORD, sama seperti /admin).
// Logo diperkecil di browser (maks 128px, PNG) lalu disimpan sebagai data URL, jadi tidak butuh storage file.
const shrinkIcon=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{
 const k=Math.min(1,128/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k))
 c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/png'))};im.src=r.result};r.readAsDataURL(f)})
const inp='m-0 w-full rounded-xl border border-[#dbe5f7] bg-white px-3.5 py-2.5 text-[15px] text-[#14203d] outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'

function Switch({on,onChange,label}){return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={()=>onChange(!on)} className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full border-0 transition-colors ${on?'bg-emerald-500':'bg-slate-300'}`}>
 <motion.span layout transition={{type:'spring',stiffness:500,damping:32}} className="absolute top-1 h-5 w-5 rounded-full bg-white shadow" style={{left:on?'26px':'4px'}}/></button>}

function IconPick({b,onPick}){const f=useRef(null)
 return <><button type="button" onClick={()=>f.current&&f.current.click()} aria-label="Ganti logo" className="group relative shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0"><BtnIcon b={b} box={48} size={24}/>
  <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/50 text-white opacity-0 transition group-hover:opacity-100"><Upload size={18}/></span></button>
  <input ref={f} type="file" accept="image/*" hidden onChange={async e=>{const x=e.target.files[0];e.target.value='';if(x)onPick(x)}}/></>}

function Row({r,onEdit,onSave,onDel,onToggle,onIcon,onDrop}){
 const dc=useDragControls()
 return <Reorder.Item value={r.id} dragListener={false} dragControls={dc} onDragEnd={onDrop} whileDrag={{scale:1.02,boxShadow:'0 20px 40px -12px rgba(37,99,235,.35)',zIndex:5}} className="relative list-none rounded-2xl border border-[#e2e8f4] bg-white p-3 sm:p-4">
  <div className="flex items-start gap-3">
   <button type="button" aria-label="Geser untuk mengubah urutan" onPointerDown={e=>dc.start(e)} className="mt-2 shrink-0 cursor-grab touch-none rounded-lg border-0 bg-transparent p-1 text-slate-400 active:cursor-grabbing"><GripVertical size={22}/></button>
   <IconPick b={r} onPick={onIcon}/>
   <div className="grid min-w-0 flex-1 gap-2">
    <input className={inp} aria-label="Nama tombol" placeholder="Nama (mis. Telegram)" maxLength={40} value={r.label} onChange={e=>onEdit({label:e.target.value})}/>
    <input className={inp+' mono'} aria-label="Link tombol" placeholder="https://t.me/usernamekamu" value={r.url} onChange={e=>onEdit({url:e.target.value})}/>
    <div className="flex flex-wrap items-center gap-3">
     <label className="flex items-center gap-2 text-sm font-semibold text-slate-600"><Switch on={r.is_active} onChange={onToggle} label="Tampilkan di footer"/>{r.is_active?'Tampil':'Disembunyikan'}</label>
     {r.icon_url&&<button type="button" onClick={()=>onEdit({icon_url:''})} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-slate-500 underline">Hapus logo</button>}
     <span className="ml-auto flex gap-2">
      <AnimatePresence>{r.dirty&&<motion.span initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.8}}><GlassButton size="sm" icon={Save} loading={r.saving} onClick={onSave}>Simpan</GlassButton></motion.span>}</AnimatePresence>
      <button type="button" aria-label="Hapus tombol" onClick={onDel} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-0 bg-red-50 text-red-600"><Trash2 size={18}/></button></span>
    </div></div></div></Reorder.Item>}

export default function ButtonsAdmin(){
 const isTok=k=>/^[a-f0-9]{32}$/.test(String(k||''))
 const [pw,setPw]=useState(''),[auth,setAuth]=useState(false),[rows,setRows]=useState({}),[order,setOrder]=useState([]),[stored,setStored]=useState(true),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
 const [nw,setNw]=useState({label:'',url:'',icon_url:''}),[toast,setToast]=useState('')
 const orderRef=useRef([]),pwRef=useRef('')
 const call=useCallback(async(method,q,body,key)=>{const r=await fetch('/api/site-buttons'+(q||''),{method,headers:{'Content-Type':'application/json','x-admin':key||pwRef.current},body:body?JSON.stringify(body):undefined});return r.json()},[])
 const apply=(items,keepDirty)=>{setRows(old=>Object.fromEntries(items.map(x=>[x.id,keepDirty&&old[x.id]&&old[x.id].dirty?old[x.id]:{...x,dirty:false}])));const ids=items.map(x=>x.id);orderRef.current=ids;setOrder(ids)}
 const login=async key=>{setBusy(true);setErr('');let d;try{d=await call('GET','?all=1',null,key)}catch(e){d={error:'Gagal terhubung ke server'}};setBusy(false)
  if(d.error){const mati=d.error==='unauthorized';setErr(mati?(isTok(key)?'Sesi admin habis. Ketuk lagi ARTAPEDIA ID di dashboard, atau masuk dengan password.':'Password admin salah'):d.error);try{sessionStorage.removeItem('adm_pw');if(mati&&isTok(key))localStorage.removeItem('adm_tok')}catch(e){};setPw('');return}
  pwRef.current=key;if(!isTok(key)){try{sessionStorage.setItem('adm_pw',key)}catch(e){}};setStored(d.stored!==false);apply(d.items);setAuth(true)}
 // Langsung masuk tanpa password: pakai token pintu rahasia (dari ketuk ARTAPEDIA ID) kalau ada, kalau tidak pakai password sesi.
 useEffect(()=>{try{let k='';try{const x=JSON.parse(localStorage.getItem('adm_tok')||'null');if(x&&isTok(x.t))k=x.t}catch(e){}
  if(!k)k=sessionStorage.getItem('adm_pw')||'';if(k){if(!isTok(k))setPw(k);login(k)}}catch(e){}},[])// eslint-disable-line
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t)},[toast])
 const ok=d=>{if(d.error){setToast('⚠ '+d.error);return false}setStored(true);return true}
 const edit=(id,p)=>setRows(r=>({...r,[id]:{...r[id],...p,dirty:true}}))
 const save=async id=>{const r=rows[id];setRows(x=>({...x,[id]:{...x[id],saving:true}}))
  const d=await call('PUT','',{id,label:r.label,url:r.url,icon_url:r.icon_url,is_active:r.is_active})
  if(ok(d)){apply(d.items,true);setRows(x=>({...x,[id]:{...x[id],dirty:false,saving:false}}));setToast('Tersimpan')}else setRows(x=>({...x,[id]:{...x[id],saving:false}}))}
 const toggle=async(id,v)=>{setRows(r=>({...r,[id]:{...r[id],is_active:v}}));const d=await call('PUT','',{id,is_active:v});if(ok(d))setToast(v?'Ditampilkan':'Disembunyikan');else setRows(r=>({...r,[id]:{...r[id],is_active:!v}}))}
 const del=async id=>{if(!confirm('Hapus tombol "'+rows[id].label+'"?'))return;const d=await call('DELETE','?id='+encodeURIComponent(id));if(ok(d)){apply(d.items,true);setToast('Dihapus')}}
 const icon=async(id,f)=>{try{const u=await shrinkIcon(f);if(id==='new')setNw(n=>({...n,icon_url:u}));else edit(id,{icon_url:u})}catch(e){setToast('⚠ Gambar tidak bisa dibaca')}}
 const drop=async()=>{const d=await call('PUT','',{order:orderRef.current});if(ok(d))setToast('Urutan disimpan')}
 const add=async()=>{setBusy(true);const d=await call('POST','',{...nw,is_active:true});setBusy(false);if(ok(d)){apply(d.items,true);setNw({label:'',url:'',icon_url:''});setToast('Tombol ditambahkan')}}
 const reorder=ids=>{orderRef.current=ids;setOrder(ids)}

 if(!auth)return <main className="fx-light grid min-h-screen place-items-center p-5">
  <form onSubmit={e=>{e.preventDefault();login(pw)}} className="fx-glass-l w-full max-w-sm rounded-3xl p-6">
   <h1 className="m-0 text-xl font-extrabold">Admin · Tombol sosial</h1><p className="mb-4 mt-1 text-sm text-slate-500">Masukkan password admin.</p>
   <input type="password" autoComplete="current-password" className={inp} placeholder="Password admin" value={pw} onChange={e=>setPw(e.target.value)}/>
   {err&&<p role="alert" className="mb-0 mt-2 text-sm font-bold text-red-500">{err}</p>}
   <GlassButton type="submit" block loading={busy} className="mt-4">Masuk</GlassButton></form></main>

 const list=order.map(id=>rows[id]).filter(Boolean),preview=list.filter(r=>r.is_active)
 return <main className="fx-light min-h-screen px-4 pb-24 pt-5">
  <div className="mx-auto max-w-2xl">
   <header className="flex items-center gap-3"><a href="/admin" aria-label="Kembali ke admin" className="fx-glass-l grid h-11 w-11 place-items-center rounded-2xl text-[#14203d] no-underline"><ArrowLeft size={20}/></a>
    <div><h1 className="m-0 text-xl font-extrabold">Tombol sosial footer</h1><p className="m-0 text-[13px] text-slate-500">Tampil di footer beranda &amp; dashboard. Geser ikon titik-titik untuk mengurutkan.</p></div></header>

   {!stored&&<p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-800">Belum disimpan di database. Daftar di bawah masih berasal dari env <code>NEXT_PUBLIC_TG_URL</code> / <code>NEXT_PUBLIC_WA_URL</code>. Ubah atau tambah apa saja untuk menyimpannya.</p>}

   <section className="fx-glass-l mt-5 rounded-3xl p-4"><h2 className="m-0 mb-3 text-[15px] font-extrabold">Tambah tombol</h2>
    <div className="flex items-start gap-3"><IconPick b={{...nw,url:nw.url,label:nw.label}} onPick={f=>icon('new',f)}/>
     <div className="grid min-w-0 flex-1 gap-2"><input className={inp} aria-label="Nama tombol baru" placeholder="Nama (mis. Instagram)" maxLength={40} value={nw.label} onChange={e=>setNw({...nw,label:e.target.value})}/>
      <input className={inp+' mono'} aria-label="Link tombol baru" placeholder="https://..." value={nw.url} onChange={e=>setNw({...nw,url:e.target.value})}/></div></div>
    <GlassButton icon={Plus} loading={busy} disabled={!nw.label.trim()||!nw.url.trim()} onClick={add} className="mt-3" block>Tambah tombol</GlassButton></section>

   <h2 className="mb-2.5 mt-7 text-[15px] font-extrabold text-slate-600">Daftar tombol ({list.length})</h2>
   {list.length===0&&<p className="rounded-2xl bg-white/70 p-4 text-sm text-slate-500">Belum ada tombol. Footer tidak menampilkan apa pun.</p>}
   <Reorder.Group axis="y" values={order} onReorder={reorder} className="m-0 grid list-none gap-2.5 p-0">
    {list.map(r=><Row key={r.id} r={r} onEdit={p=>edit(r.id,p)} onSave={()=>save(r.id)} onDel={()=>del(r.id)} onToggle={v=>toggle(r.id,v)} onIcon={f=>icon(r.id,f)} onDrop={drop}/>)}</Reorder.Group>

   <h2 className="mb-2.5 mt-8 text-[15px] font-extrabold text-slate-600">Pratinjau footer</h2>
   <div className="rounded-3xl bg-[#f2f7ff] p-4">{preview.length?<SocialButtons items={preview}/>:<p className="m-0 text-sm text-slate-500">Tidak ada tombol aktif.</p>}</div>
  </div>
  <AnimatePresence>{toast&&<motion.div key="t" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#14203d] px-5 py-3 text-sm font-bold text-white shadow-lg">{toast}</motion.div>}</AnimatePresence></main>}
