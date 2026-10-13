'use client'
import {useState,useEffect,useRef} from 'react'
// Struk transaksi yang bisa diunduh sebagai GAMBAR dan dibagikan ke grup/teman.
// Sengaja TIDAK memuat kode OTP dan nomor ditampilkan separuh — struk dibuat untuk dipamerkan,
// jadi isinya tidak boleh membocorkan apa pun yang bisa dipakai orang lain.
const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB':'-'
const maskNo=p=>{p=String(p||'');return p.length<7?p:p.slice(0,5)+'•'.repeat(Math.max(3,p.length-8))+p.slice(-3)}

// Satu bentuk struk untuk SEMUA jenis transaksi.
// kind: 'order' (beli nokos) · 'deposit' (isi saldo) · 'mutasi' (saldo masuk/keluar) · 'withdraw' (tarik dana gateway) · 'qris' (QRIS gateway)
// data: {kind, title, amount, rows:[[label,value]], status, at, id, neg}
const ST={success:'BERHASIL',completed:'BERHASIL',paid:'BERHASIL',pending:'MENUNGGU',processing:'DIPROSES',
 expired:'KEDALUWARSA',cancelled:'DIBATALKAN',canceled:'DIBATALKAN',failed:'GAGAL'}
const st=v=>ST[String(v||'').toLowerCase()]||String(v||'-').toUpperCase()
export function strukData(x,kind){
 if(kind==='deposit'){const bonus=+x.bonus||0
  return {kind,title:x.status==='completed'?'Deposit Berhasil':'Deposit '+st(x.status),amount:x.amount,status:st(x.status),
   at:x.createdAt?new Date(x.createdAt).getTime():x.at,id:x.order_id||x.id,
   rows:[['Nominal',rp(x.amount)],...(bonus>0?[['Bonus','+'+rp(bonus)]]:[]),['Metode',x.method_name||'QRIS'],
    ...(x.total_amount&&x.total_amount!==x.amount?[['Dibayar',rp(x.total_amount)]]:[]),
    ['Total masuk',rp((+x.amount||0)+bonus)]]}}
 if(kind==='mutasi'){const neg=(+x.amt||0)<0
  return {kind,neg,title:neg?'Saldo Keluar':'Saldo Masuk',amount:Math.abs(+x.amt||0),status:'TERCATAT',at:x.at,id:x.id||'-',
   rows:[['Keterangan',x.note||'-'],[neg?'Saldo keluar':'Saldo masuk',(neg?'-':'+')+rp(Math.abs(+x.amt||0))],
    ...(x.bal!=null?[['Saldo setelahnya',rp(x.bal)]]:[])]}}
 if(kind==='withdraw')return {kind,neg:true,title:x.status==='success'?'Penarikan Berhasil':'Penarikan '+st(x.status),
  amount:x.nominal,status:st(x.status),at:new Date(x.created_at||x.at).getTime(),id:x.transaction_id||x.id,
  rows:[['Tujuan',x.wallet||'-'],['Nomor',maskNo(x.destination)],['Nominal dikirim',rp(x.nominal)],
   ['Biaya',rp(x.fee)],['Saldo terpotong',rp(x.total)]]}
 if(kind==='qris')return {kind,title:x.status==='paid'?'Pembayaran Diterima':'QRIS '+st(x.status),
  amount:x.total_paid||x.amount,status:st(x.status),at:new Date(x.created_at||x.at).getTime(),id:x.transaction_id||x.id,
  rows:[['Nominal diminta',rp(x.amount)],['Dibayar pembeli',rp(x.total_paid)],['Biaya layanan',rp(x.fee)],['Masuk saldo',rp(x.net)],['Metode','QRIS']]}
 const okO=x.status==='success'
 return {kind:'order',title:okO?'Nomor Siap Dipakai':'Order '+st(x.status),amount:x.price,status:st(x.status),
  at:new Date(x.createdAt||x.at).getTime(),id:x.orderId||x.id,
  rows:[['Layanan',x.serviceName||'-'],['Negara',x.countryName||'-'],['Nomor',maskNo(x.phoneNumber||x.phone)],['Harga',rp(x.price)],
   ...(x.guarantee?[['Jaminan OTP','Aktif']]:[]),
   ...(!okO&&x.refunded?[['Saldo dikembalikan','+'+rp(x.price)]]:[])]}}

function draw(d,host){
 // tinggi kanvas mengikuti jumlah baris supaya tidak ada ruang kosong menganga di bawah
 const nRows=d.rows.length+2
 const W=700,ch=346+nRows*44+36,H=ch+252
 const c=document.createElement('canvas');c.width=W;c.height=H
 const x=c.getContext('2d')
 const ok=d.status==='BERHASIL'||d.status==='TERCATAT'
 const wait=d.status==='MENUNGGU'||d.status==='DIPROSES'
 const warna=ok?'#16a34a':wait?'#d97706':'#e11d48'
 const tanda=ok?(d.neg?'↗':'✓'):wait?'⏳':'✕'
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
 x.fillStyle='#fff';x.font='800 40px system-ui,sans-serif';x.fillText(tanda,W/2,cy+87)
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
