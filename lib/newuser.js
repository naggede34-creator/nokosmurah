// ===========================================================================
// Notifikasi PENGGUNA BARU: satu pintu untuk web, bot utama, dan bot reseller.
//  - Nomor urut pengguna ("pengguna ke-N"): penghitung permanen di kv 'usrseq'. Naik terus, tidak ikut
//    turun saat Clean menghapus akun kosong, dan tidak terpengaruh saklar notifikasi (dihitung walau notif mati).
//    Pertama kali dipakai, penghitung dimulai dari jumlah pengguna yang sudah ada.
//  - Foto: assets/pengguna-baru.png + lencana "PENGGUNA KE-#N" digambar di server (@napi-rs/canvas).
//    Kalau canvas gagal, foto polos tetap dikirim; kalau fotonya hilang, kirim teks saja. Tidak pernah melempar.
//  - Saklar admin: cfg.nf = {web, bot, rs} (admin > Notifikasi channel). false = notif jenis itu tidak dikirim.
// ===========================================================================
import path from 'path'
import fs from 'fs'
import {kv} from './db'
import {notify} from './telegram'
import {getCfg} from './bonus'

export const NF_DEF={web:true,bot:true,rs:true}
export const nfClean=b=>Object.fromEntries(Object.keys(NF_DEF).map(k=>[k,!(b&&b[k]===false)]))
export const fmtNo=n=>(+n||0).toLocaleString('id-ID')

// ---- nomor urut ----
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
// Panggil SEBELUM pengguna baru dimasukkan ke 'idx'. Mengembalikan nomor urut pengguna ini (1, 2, 3, ...).
export async function nextUserNo(){
 for(let i=0;i<6;i++){
  try{
   const v=await kv.get('usrseq')
   const base=v&&Number.isFinite(+v.n)?Math.max(0,Math.floor(+v.n)):((await kv.get('idx'))||[]).length
   const n=base+1
   if(await kv.casSet('usrseq',{n},v?v.__rev:0))return n
  }catch(e){}
  await sleep(40+i*60)}
 // penghitung terus tabrakan / rusak (mis. dokumen berisi null): pakai jumlah pengguna sekarang + 1 (tidak menghalangi
 // pendaftaran) dan tulis ulang penghitungnya supaya pulih sendiri
 try{const n=(((await kv.get('idx'))||[]).length)+1;await kv.set('usrseq',{n});return n}catch(e){return 0}}

// ---- foto ----
const IMG=path.join(process.cwd(),'assets','pengguna-baru.png')
let base=null,CV=null,fontOk=false,siap=false
async function init(){
 if(siap)return
 siap=true
 try{base=fs.readFileSync(IMG)}catch(e){base=null}
 try{
  const m=await import('@napi-rs/canvas');CV=m
  try{fontOk=!!m.GlobalFonts.registerFromPath(path.join(process.cwd(),'assets','fonts','LiberationSans-Bold.ttf'),'NewUserBold')}catch(e){fontOk=false}
 }catch(e){CV=null}}
const FONT=(px)=>`bold ${px}px ${fontOk?'NewUserBold':'sans-serif'}`

// PNG 1280x720 dengan lencana nomor urut di kiri bawah. null = fotonya tidak tersedia.
export async function newUserPng(no){
 try{
  await init()
  if(!base)return null
  if(!CV||!fontOk||!(+no>0))return base
  const img=await CV.loadImage(base),W=img.width,H=img.height,k=W/1280
  const c=CV.createCanvas(W,H),x=c.getContext('2d')
  x.drawImage(img,0,0,W,H)
  const t1='PENGGUNA KE-',t2='#'+fmtNo(no)
  x.textAlign='center';x.textBaseline='middle'
  x.font=FONT(22*k);const w1=x.measureText(t1).width
  x.font=FONT(50*k);const w2=x.measureText(t2).width
  const bw=Math.max(w1,w2)+56*k,bh=104*k,bx=64*k,by=478*k
  x.fillStyle='rgba(14,37,110,.28)';x.beginPath();x.roundRect(bx+4*k,by+8*k,bw,bh,30*k);x.fill()
  x.fillStyle='#fff';x.strokeStyle='#1550e6';x.lineWidth=5*k
  x.beginPath();x.roundRect(bx,by,bw,bh,30*k);x.fill();x.stroke()
  x.fillStyle='#2563eb';x.font=FONT(22*k);x.fillText(t1,bx+bw/2,by+30*k)
  x.fillStyle='#f43f78';x.font=FONT(50*k);x.fillText(t2,bx+bw/2,by+72*k)
  return c.toBuffer('image/png')
 }catch(e){return base||null}}

// ---- kirim ----
// kind: 'web' | 'bot' | 'rs'.  n: {no, rows, note, i, t, src, foot, force (abaikan saklar, untuk tes admin)}.  Mengembalikan {ok} / {skipped:true}; tidak pernah melempar.
export async function newUserNotify(kind,n){
 try{
  const cfg=await getCfg()
  if(!n.force&&cfg.nf&&cfg.nf[kind]===false)return {skipped:true}
  const no=+n.no||0
  const photo=await newUserPng(no)
  return await notify({
   i:n.i||'👤',t:n.t||'Pengguna baru',st:'ok',src:n.src,foot:n.foot,note:n.note,
   rows:[...(no?[['Nomor urut','Pengguna ke-'+fmtNo(no)]]:[]),...(n.rows||[])],
   ...(photo?{photo,photoName:'pengguna-baru'+(no?'-'+no:'')+'.png'}:{})})
 }catch(e){return {ok:false,error:String((e&&e.message)||e)}}}
