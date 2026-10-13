'use client'
import {useState} from 'react'
import {buildHtml,buildMarkdown,buildOpenApi,fileName,META} from '../lib/apidocs'
// Tombol "Download dokumentasi lengkap".
// Semua berkas dirakit DI BROWSER dari lib/apidocs.js (sumber yang sama dengan halaman /docs),
// jadi tidak perlu endpoint tambahan dan isinya tidak akan pernah beda dengan versi web.
const FMT=[
 {k:'html',ic:'📄',t:'HTML (siap baca & print PDF)',s:'Satu berkas, bisa dibuka tanpa internet. Ctrl/Cmd + P untuk simpan jadi PDF.',mime:'text/html;charset=utf-8',make:buildHtml},
 {k:'md',ic:'📝',t:'Markdown (.md)',s:'Untuk README, Notion, atau dibaca AI/editor kode.',mime:'text/markdown;charset=utf-8',make:buildMarkdown},
 {k:'json',ic:'🧩',t:'OpenAPI 3.1 (.json)',s:'Impor ke Postman / Insomnia, atau buat SDK otomatis.',mime:'application/json',make:buildOpenApi}]

export default function DocsDownload({root,compact,setMsg}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState('')
 const save=async f=>{
  setBusy(f.k)
  try{
   const base=(root||(typeof window!=='undefined'?location.origin:'')).replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'')
   const blob=new Blob([f.make(base)],{type:f.mime}),url=URL.createObjectURL(blob)
   const a=document.createElement('a');a.href=url;a.download=fileName(f.k);a.rel='noopener'
   document.body.appendChild(a);a.click();a.remove()
   setTimeout(()=>URL.revokeObjectURL(url),4000)
   setMsg&&setMsg('Dokumentasi lengkap diunduh: '+fileName(f.k))
   setOpen(false)}
  catch(e){setMsg?setMsg('Gagal membuat berkas: '+e.message):alert('Gagal membuat berkas: '+e.message)}
  setBusy('')}
 return <div className={'dl'+(compact?' compact':'')}>
  <button type="button" className="dl-main" aria-expanded={open} onClick={()=>open?save(FMT[0]):setOpen(true)}>
   <span className="dl-ic">⬇️</span>
   <span className="dl-tx"><b>Download dokumentasi lengkap</b>
    <small>{open?'Pilih format di bawah — isinya semua bagian, tidak perlu buka satu-satu.':'Semua bagian dalam satu berkas: endpoint, parameter, contoh respon, contoh kode, status & error.'}</small></span>
   <span className="dl-cv">{open?'×':'›'}</span></button>
  {open&&<div className="dl-opt">{FMT.map(f=><button key={f.k} type="button" disabled={!!busy} onClick={()=>save(f)}>
   <span className="dl-fi">{f.ic}</span><span><b>{f.t}</b><small>{f.s}</small></span>
   <span className="dl-go">{busy===f.k?'…':'Unduh'}</span></button>)}
   <p className="dl-note">Nama berkas: <code>{fileName('html')}</code> · Versi {META.version}. Contoh kode memakai penanda <code>API_KEY</code> — ganti dengan key milikmu, jangan dibagikan.</p></div>}
 </div>}
