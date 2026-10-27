// ===========================================================================
// Perender struk DI SERVER -> PNG. Dipakai untuk menempelkan foto struk pada
// notifikasi Telegram (channel & DM pengguna) dan notifikasi HP (Web Push).
// Gambarnya dibuat semirip mungkin dengan struk yang diunduh pengguna di browser
// (components/Struk.js), karena bentuk datanya sama-sama dari lib/strukdata.js.
//
// Tidak pernah melempar: kalau apa pun gagal (font hilang, biner canvas tidak ada),
// fungsinya mengembalikan null dan pemanggil cukup mengirim notifikasi teks biasa.
// ===========================================================================
import path from 'path'
import {strukData,rp,dtWib,drawMark} from './strukdata'

let CV=null,fontOk=false,siap=false
async function init(){
 if(siap)return CV
 siap=true
 try{
  const m=await import('@napi-rs/canvas')
  CV=m
  // Font WAJIB didaftarkan sendiri: server tanpa font sistem (mis. serverless)
  // akan menggambar teks kosong tanpa memberi error apa pun.
  const dir=path.join(process.cwd(),'assets','fonts')
  const reg=(f,n)=>{try{return m.GlobalFonts.registerFromPath(path.join(dir,f),n)}catch(e){return false}}
  const a=reg('LiberationSans-Regular.ttf','StrukSans')
  const b=reg('LiberationSans-Bold.ttf','StrukSansBold')
  const c=reg('LiberationMono-Bold.ttf','StrukMono')
  fontOk=!!(a&&b&&c)
 }catch(e){CV=null}
 return CV}

const SANS='StrukSans',BOLD='StrukSansBold',MONO='StrukMono'
const F=(w,size,fam)=>`${w} ${size}px ${fontOk?fam:'sans-serif'}`

// data dari strukData(). host = nama domain yang dicetak di kaki struk.
export async function strukPng(item,kind,host='artapedia.id',L){
 try{
  const m=await init();if(!m)return null
  const d=strukData(item,kind,L)
  const T=(L||{t:null}).t?L.t:(k=>({'r.time':'Waktu','r.idlbl':'ID'})[k]||k)
  const rows=[...d.rows,[T('r.time'),dtWib(d.at)],[T('r.idlbl'),String(d.id||'-')]]
  const W=700,cy=120,ch=346+rows.length*44+36,H=ch+cy+132
  const c=m.createCanvas(W,H),x=c.getContext('2d')

  // latar bergradasi + butiran halus
  const g=x.createLinearGradient(0,0,W,H)
  g.addColorStop(0,'#1b3fae');g.addColorStop(.55,'#2f6bf0');g.addColorStop(1,'#1a2f73')
  x.fillStyle=g;x.fillRect(0,0,W,H)
  x.globalAlpha=.16;x.fillStyle='#fff'
  for(let i=0;i<W;i+=26)for(let j=0;j<H;j+=26){x.beginPath();x.arc(i,j,2,0,7);x.fill()}
  x.globalAlpha=1

  // kartu putih + tepi bergerigi seperti struk sungguhan
  const cx=50,cw=W-100
  x.fillStyle='#fff';x.beginPath();x.roundRect(cx,cy,cw,ch,28);x.fill()
  x.fillStyle='#2f6bf0'
  for(let i=cx+16;i<cx+cw;i+=26){x.beginPath();x.arc(i,cy+ch,11,0,7);x.fill()}

  // kepala
  x.textAlign='center'
  const gw=kind==='qris'||kind==='withdraw'   // struk QRIS Gateway memakai kepala Artapedia Pay
  x.fillStyle='#fff';x.font=F(700,30,BOLD);x.fillText(gw?'ARTAPEDIA PAY':'ARTAPEDIA ID',W/2,62)
  x.globalAlpha=.85;x.font=F(400,15,SANS);x.fillText(gw?'QRIS Gateway':kind==='smm'?'Suntik Sosmed Otomatis':'Nokos & OTP Otomatis',W/2,88);x.globalAlpha=1

  // lencana status
  const ok=['BERHASIL','TERCATAT','SEBAGIAN'].includes(d.status)
  const wait=['MENUNGGU','DIPROSES','DIMINTA'].includes(d.status)
  x.fillStyle=ok?'#16a34a':wait?'#d97706':'#e11d48'
  x.beginPath();x.arc(W/2,cy+72,44,0,7);x.fill()
  drawMark(x,W/2,cy+72,44,ok?(d.neg?'out':'ok'):wait?'wait':'bad')

  x.fillStyle='#0f1b3d';x.font=F(700,27,BOLD);x.fillText(d.title,W/2,cy+160)
  x.fillStyle='#64748b';x.font=F(700,13,BOLD);x.fillText(d.status,W/2,cy+186)
  x.fillStyle='#0f1b3d';x.font=F(700,52,MONO);x.fillText((d.neg?'- ':'')+rp(d.amount),W/2,cy+262)

  x.strokeStyle='#cbd5e1';x.lineWidth=1;x.setLineDash([7,7])
  x.beginPath();x.moveTo(cx+34,cy+300);x.lineTo(cx+cw-34,cy+300);x.stroke();x.setLineDash([])

  let y=cy+344
  for(const [k,v] of rows){
   x.textAlign='left';x.fillStyle='#64748b';x.font=F(400,16,SANS);x.fillText(k,cx+34,y)
   x.textAlign='right';x.fillStyle='#0f1b3d';x.font=F(700,16,MONO)
   let s=String(v);while(x.measureText(s).width>cw-230&&s.length>6)s=s.slice(0,-2)
   x.fillText(s,cx+cw-34,y);y+=44}

  x.textAlign='center';x.fillStyle='#fff';x.font=F(700,17,BOLD);x.fillText(host,W/2,H-62)
  x.globalAlpha=.8;x.font=F(400,13,SANS);x.fillText('Struk otomatis · tanpa tanda tangan',W/2,H-36)
  return c.toBuffer('image/png')
 }catch(e){return null}}

export const strukReady=async()=>!!(await init())
export const fontTerdaftar=()=>fontOk

// ---------- tautan gambar struk untuk notifikasi HP (Web Push) ----------
// Notifikasi HP memuat gambar lewat URL, jadi gambarnya harus bisa diambil tanpa cookie.
// Supaya tidak bisa ditebak orang lain, tautannya ditandatangani dengan kunci rahasia server.
import crypto from 'crypto'
import {kv} from './db'
async function kunci(){
 const c=globalThis.__strukKey;if(c)return c
 let k=await kv.get('strukkey')
 if(!k){k=crypto.randomBytes(32).toString('hex');await kv.set('strukkey',k)}
 return globalThis.__strukKey=k}
export const strukSign=async(kind,uid,id)=>
 crypto.createHmac('sha256',await kunci()).update(`${kind}|${uid}|${id}`).digest('hex').slice(0,24)
export async function strukUrl(base,kind,uid,id){
 base=String(base||'').replace(/\/+$/,'')
 if(!/^https?:\/\//.test(base))return ''          // tanpa SITE_URL, gambar notifikasi dilewati
 const s=await strukSign(kind,uid,id)
 return `${base}/api/struk/img?k=${encodeURIComponent(kind)}&u=${encodeURIComponent(uid)}&i=${encodeURIComponent(id)}&s=${s}`}
