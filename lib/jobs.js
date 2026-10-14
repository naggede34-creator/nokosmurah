// ===========================================================================
// JOB / SALDO GRATIS
// Admin memasang job (mis. "follow Instagram kami"), pengguna mengerjakannya lalu
// mengunggah FOTO BUKTI. Admin menyetujui (ACC) atau menolak. Begitu di-ACC,
// hadiahnya langsung masuk sebagai SALDO NOKOS pengguna.
//
// Aturan yang dijaga di sini (bukan di tampilan, supaya tidak bisa diakali):
//  - tiap job punya batas pengerjaan per akun (bawaan 3x). Yang dihitung hanya
//    kiriman yang MENUNGGU atau sudah DI-ACC; kiriman yang ditolak tidak menghabiskan
//    jatah, jadi pengguna boleh memperbaiki buktinya.
//  - satu akun hanya boleh punya 1 kiriman yang menunggu di satu job.
//  - hadiah hanya dibayar sekali per kiriman (dijaga oleh field `paid`).
// ===========================================================================
import crypto from 'crypto'
import {kv} from './db'
import {save} from './auth'
import {mut} from './bonus'
import {notify,mask,rp} from './telegram'
import {pushUser} from './tgpush'
import {push as webPush,keyUser} from './push'

export const MAXDEF=3
export const QUEUE='jq'                       // daftar id kiriman yang menunggu ditinjau
const sid=()=>'J'+crypto.randomBytes(8).toString('hex')
const now=()=>Date.now()
const str=(v,n)=>String(v==null?'':v).trim().slice(0,n)
const num=(v,lo,hi,df)=>{const x=Math.floor(+v);return isNaN(x)?df:Math.min(hi,Math.max(lo,x))}
// Gambar hanya boleh data URL JPEG/PNG/WebP hasil kecilan di browser.
const img=(v,limit)=>{const s=String(v||'')
 if(!s)return ''
 if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s))throw Error('Format gambar tidak didukung')
 if(s.length>limit)throw Error('Gambar terlalu besar, pilih foto lain')
 return s}

// ---------- daftar job ----------
export const allJobs=async()=>{const j=await kv.get('jobs');return Array.isArray(j)?j:[]}
export const putJobs=j=>kv.set('jobs',j.slice(0,60))

export async function saveJob(b){
 const list=await allJobs(),id=str(b.id,32)
 const row={
  id:id||sid(),
  title:str(b.title,70),
  desc:str(b.desc,400),
  logo:img(b.logo,160000),
  link:str(b.link,300),
  reward:num(b.reward,0,10000000,0),
  max:num(b.max,1,20,MAXDEF),
  on:b.on!==false,
  at:now()}
 if(!row.title)throw Error('Judul job wajib diisi')
 if(!row.reward)throw Error('Hadiah saldo wajib diisi')
 if(row.link&&!/^https?:\/\//i.test(row.link))throw Error('Link harus diawali http:// atau https://')
 const i=list.findIndex(x=>x.id===row.id)
 if(i<0)list.unshift(row);else list[i]={...list[i],...row,at:list[i].at||row.at}
 await putJobs(list);return row}

export async function delJob(id){
 const list=await allJobs(),out=list.filter(x=>x.id!==id)
 if(out.length===list.length)throw Error('Job tidak ditemukan')
 await putJobs(out);return out.length}

export async function toggleJob(id,on){
 const list=await allJobs(),j=list.find(x=>x.id===id);if(!j)throw Error('Job tidak ditemukan')
 j.on=!!on;await putJobs(list);return j}

// ---------- kiriman pengguna ----------
const mySubs=u=>Array.isArray(u.jobSubs)?u.jobSubs:[]
// Jatah terpakai = kiriman menunggu + yang sudah di-ACC. Yang ditolak tidak dihitung.
export const usedOf=(u,jobId)=>mySubs(u).filter(s=>s.jobId===jobId&&s.status!=='tolak').length
export const waitingOf=(u,jobId)=>mySubs(u).some(s=>s.jobId===jobId&&s.status==='menunggu')

export async function listForUser(u){
 const list=await allJobs()
 return {jobs:list.filter(j=>j.on).map(j=>({id:j.id,title:j.title,desc:j.desc,logo:j.logo,link:j.link,
   reward:j.reward,max:j.max||MAXDEF,used:usedOf(u,j.id),waiting:waitingOf(u,j.id)})),
  subs:mySubs(u).slice(0,40).map(s=>({id:s.id,jobId:s.jobId,title:s.title,reward:s.reward,status:s.status,at:s.at,reason:s.reason||''})),
  earned:mySubs(u).filter(s=>s.status==='acc').reduce((a,s)=>a+(+s.reward||0),0)}}

export async function submitJob(u,jobId,photo,note){
 // Berkunci per pengguna+job: klik ganda / dua tab tidak bisa menembus batas jatah.
 if(!await kv.lock('jsub:'+u.id+':'+jobId,20000))throw Error('Bukti kamu sedang diproses, tunggu sebentar')
 try{return await submit1(u,jobId,photo,note)}finally{await kv.unlock('jsub:'+u.id+':'+jobId)}}
async function submit1(u0,jobId,photo,note){
 const j=(await allJobs()).find(x=>x.id===jobId&&x.on)
 if(!j)throw Error('Job tidak ditemukan atau sudah ditutup')
 const max=j.max||MAXDEF
 // pakai data terbaru dari database supaya jatah dihitung dari kenyataan, bukan salinan lama
 const u=(await kv.get('u:'+u0.id))||u0
 if(waitingOf(u,j.id))throw Error('Bukti kamu untuk job ini masih ditinjau admin. Tunggu hasilnya dulu.')
 if(usedOf(u,j.id)>=max)throw Error(`Job ini hanya bisa dikerjakan ${max}x per akun dan jatahmu sudah habis`)
 const foto=img(photo,400000)
 if(!foto)throw Error('Foto bukti wajib diunggah')
 const rec={id:sid(),jobId:j.id,uid:u.id,title:j.title,reward:j.reward,status:'menunggu',
  note:str(note,200),at:now(),img:foto}
 await kv.set('js:'+rec.id,rec)
 await kv.sadd(QUEUE,rec.id)
 u.jobSubs=[{id:rec.id,jobId:j.id,title:j.title,reward:j.reward,status:'menunggu',at:rec.at,note:rec.note},...mySubs(u)].slice(0,80)
 await save(u)
 notify({i:'🧾',t:'Bukti job masuk',st:'pending',id:['ID Kiriman',rec.id],
  rows:[['Pengguna',mask(u.email)],['Job',j.title],['Hadiah',rp(j.reward)],['Pengerjaan ke',`${usedOf(u,j.id)} dari ${max}`]],
  note:'Tinjau di /admin › Job & saldo gratis'}).catch(()=>{})
 if(u0!==u)u0.jobSubs=u.jobSubs
 return {id:rec.id,status:rec.status,used:usedOf(u,j.id),max}}

// Daftar kiriman yang menunggu (untuk admin). Gambar TIDAK ikut supaya ringan.
export async function pending(limit=60){
 const ids=((await kv.get(QUEUE))||[]).slice(-limit).reverse(),out=[]
 for(const id of ids){const s=await kv.get('js:'+id);if(!s)  {await kv.srem(QUEUE,id);continue}
  if(s.status!=='menunggu'){await kv.srem(QUEUE,id);continue}
  const u=await kv.get('u:'+s.uid)
  out.push({id:s.id,jobId:s.jobId,title:s.title,reward:s.reward,note:s.note||'',at:s.at,
   user:u?{id:u.id,email:u.email,name:u.name,balance:u.balance}:null})}
 return out}

export const subImage=async id=>{const s=await kv.get('js:'+id);return s?{id:s.id,img:s.img||'',title:s.title,note:s.note||'',at:s.at}:null}

// ACC / tolak. Idempoten: hadiah hanya dibayar sekali (field `paid`).
export async function review(id,ok,reason){
 // Berkunci: dua admin (atau klik ganda) tidak bisa meng-ACC kiriman yang sama dua kali -> hadiah tidak dobel.
 if(!await kv.lock('jsr:'+id,20000))throw Error('Kiriman ini sedang ditinjau, coba lagi sebentar')
 try{return await review1(id,ok,reason)}finally{await kv.unlock('jsr:'+id)}}
async function review1(id,ok,reason){
 const s=await kv.get('js:'+id);if(!s)throw Error('Kiriman tidak ditemukan')
 if(s.status!=='menunggu')throw Error('Kiriman ini sudah ditinjau ('+s.status+')')
 const u=await kv.get('u:'+s.uid);if(!u)throw Error('Pengguna kiriman ini sudah tidak ada')
 s.status=ok?'acc':'tolak';s.reason=str(reason,200);s.doneAt=now()
 if(ok&&!s.paid){s.paid=true;mut(u,+s.reward||0,'Hadiah job: '+s.title)}
 const row=mySubs(u).find(x=>x.id===s.id)
 if(row){row.status=s.status;row.reason=s.reason;row.doneAt=s.doneAt}
 await save(u)
 await kv.set('js:'+s.id,s)
 await kv.srem(QUEUE,s.id)
 const ttl=ok?'✅ Bukti job diterima':'❌ Bukti job ditolak'
 const body=ok?`Hadiah ${rp(s.reward)} sudah masuk ke saldomu. Saldo sekarang ${rp(u.balance)}.`
             :`Job "${s.title}" ditolak.${s.reason?' Alasan: '+s.reason:''} Kamu boleh mengirim bukti baru.`
 pushUser(u,`<b>${ttl}</b>\n━━━━━━━━━━━━━━━━━━\n${body}`).catch(()=>{})
 webPush(keyUser(u.id),{t:ttl,b:body,u:'/job',tag:'job-'+s.id,ring:1}).catch(()=>{})
 notify({i:ok?'🎁':'🚫',t:ok?'Job di-ACC, hadiah dibayar':'Bukti job ditolak',st:ok?'ok':'warn',id:['ID Kiriman',s.id],
  rows:[['Pengguna',mask(u.email)],['Job',s.title],['Hadiah',ok?rp(s.reward):''],['Alasan',s.reason],['Saldo sekarang',rp(u.balance)]]}).catch(()=>{})
 return {id:s.id,status:s.status,balance:u.balance}}

// Ringkasan untuk kartu admin
export async function stats(){
 const jobs=await allJobs(),q=((await kv.get(QUEUE))||[]).length
 return {jobs:jobs.length,aktif:jobs.filter(j=>j.on).length,menunggu:q}}
