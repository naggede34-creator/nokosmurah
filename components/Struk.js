'use client'
import {useState,useEffect,useRef} from 'react'
import {strukData,rp,dtWib as dt,drawMark} from '../lib/strukdata'
export {strukData}
// Struk transaksi yang bisa diunduh sebagai GAMBAR dan dibagikan ke grup/teman.
// Bentuk datanya diambil dari lib/strukdata.js — sama persis dengan struk yang
// ikut terkirim di notifikasi Telegram & notifikasi HP (dirender server di lib/strukimg.js).

function draw(d,host){
 // tinggi kanvas mengikuti jumlah baris supaya tidak ada ruang kosong menganga di bawah
 const nRows=d.rows.length+2
 const W=700,ch=346+nRows*44+36,H=ch+252
 const c=document.createElement('canvas');c.width=W;c.height=H
 const x=c.getContext('2d')
 const ok=d.status==='BERHASIL'||d.status==='TERCATAT'
 const wait=d.status==='MENUNGGU'||d.status==='DIPROSES'
 const warna=ok?'#16a34a':wait?'#d97706':'#e11d48'
 // latar
 const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#1b3fae');g.addColorStop(.55,'#2f6bf0');g.addColorStop(1,'#1a2f73')
 x.fillStyle=g;x.fillRect(0,0,W,H)
 x.globalAlpha=.16;x.fillStyle='#fff'
 for(let i=0;i<W;i+=26)for(let j=0;j<H;j+=26){x.beginPath();x.arc(i,j,2,0,7);x.fill()}
 x.globalAlpha=1
 // kartu putih dengan tepi bergerigi seperti struk
 const cx=50,cy=120,cw=W-100
 x.fillStyle='#fff';x.beginPath();x.roundRect(cx,cy,cw,ch,28);x.fill()
 x.fillStyle=g;x.save();x.beginPath()
 for(let i=cx+16;i<cx+cw;i+=26){x.moveTo(i,cy+ch);x.arc(i,cy+ch,11,0,7)}
 x.fillStyle='#2f6bf0';x.fill();x.restore()
 // judul
 x.textAlign='center';x.fillStyle='#fff';x.font='800 30px system-ui,sans-serif';x.fillText('ARTAPEDIA ID',W/2,62)
 x.font='600 15px system-ui,sans-serif';x.globalAlpha=.85;x.fillText('Nokos & OTP Otomatis',W/2,88);x.globalAlpha=1
 // lencana status
 x.fillStyle=warna
 x.beginPath();x.arc(W/2,cy+72,44,0,7);x.fill()
 drawMark(x,W/2,cy+72,44,ok?(d.neg?'out':'ok'):wait?'wait':'bad')
 x.fillStyle='#0f1b3d';x.font='800 27px system-ui,sans-serif';x.fillText(d.title,W/2,cy+160)
 x.fillStyle='#64748b';x.font='700 13px system-ui,sans-serif';x.fillText(d.status,W/2,cy+186)
 // nominal besar
 x.fillStyle='#0f1b3d';x.font='800 56px ui-monospace,monospace';x.fillText((d.neg?'- ':'')+rp(d.amount),W/2,cy+262)
 // garis putus-putus
 x.strokeStyle='#cbd5e1';x.setLineDash([7,7]);x.beginPath();x.moveTo(cx+34,cy+300);x.lineTo(cx+cw-34,cy+300);x.stroke();x.setLineDash([])
 // baris rincian
 let y=cy+344
 for(const [k,v] of [...d.rows,['Waktu',dt(d.at)],['ID',String(d.id||'-')]]){
  x.textAlign='left';x.fillStyle='#64748b';x.font='600 16px system-ui,sans-serif';x.fillText(k,cx+34,y)
  x.textAlign='right';x.fillStyle='#0f1b3d';x.font='700 16px ui-monospace,monospace'
  let s=String(v);while(x.measureText(s).width>cw-230&&s.length>6)s=s.slice(0,-2)
  x.fillText(s,cx+cw-34,y);y+=44}
 // kaki
 x.textAlign='center';x.fillStyle='#fff';x.font='700 17px system-ui,sans-serif';x.fillText(host||'artapedia.id',W/2,H-62)
 x.globalAlpha=.8;x.font='600 13px system-ui,sans-serif';x.fillText('Struk otomatis · tanpa tanda tangan',W/2,H-36);x.globalAlpha=1
 return c}

export default function Struk({item,kind,onClose,onMsg}){
 const [url,setUrl]=useState('');const d=useRef(null)
 useEffect(()=>{if(!item)return
  d.current=strukData(item,kind)
  try{setUrl(draw(d.current,typeof location!=='undefined'?location.host:'').toDataURL('image/png'))}catch(e){onMsg&&onMsg('Gagal membuat gambar struk')}
 },[item,kind])
 useEffect(()=>{const k=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[onClose])
 if(!item)return null
 const nama='struk-'+(d.current?d.current.id:'artapedia')+'.png'
 const unduh=()=>{const a=document.createElement('a');a.href=url;a.download=nama;a.click();onMsg&&onMsg('Struk tersimpan di galeri/unduhan')}
 const bagikan=async()=>{
  try{
   const blob=await (await fetch(url)).blob()
   const f=new File([blob],nama,{type:'image/png'})
   if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:'Struk Artapedia ID'});return}
   if(navigator.share){await navigator.share({title:'Struk Artapedia ID',text:'Transaksi di '+location.host});return}
  }catch(e){if(e&&e.name==='AbortError')return}
  unduh();onMsg&&onMsg('Browser ini belum bisa membagikan langsung — gambarnya diunduh dulu')}
 return <div className="sk-bg" onClick={e=>e.target===e.currentTarget&&onClose()} role="dialog" aria-modal="true" aria-label="Struk transaksi">
  <div className="sk-box">
   <button className="sk-x" onClick={onClose} aria-label="Tutup">✕</button>
   {url?<img src={url} alt="Struk transaksi" className="sk-img"/>:<div className="fx-sk sk-img" style={{aspectRatio:'7/10'}}/>}
   <div className="sk-row">
    <button className="sk-b go" onClick={bagikan}>📤 Bagikan</button>
    <button className="sk-b" onClick={unduh}>⬇ Simpan gambar</button></div>
   <p className="sk-note">Kode OTP tidak dicantumkan dan nomor ditampilkan separuh, jadi struk ini aman dibagikan.</p>
  </div></div>}
