// BROADCAST KHUSUS ADMIN KE SEMUA BOT
// Satu pesan dikirim ke semua pengguna dari:
//   main    = bot utama + bot lain yang ditambahkan admin (Admin > Bot Telegram)
//   komisi  = bot reseller "jual nokos tanpa modal"
//   mandiri = bot reseller "stok mandiri"
// Setiap pengguna dikirimi lewat bot tempat dia terdaftar (token bot beda tidak bisa saling kirim), pemilik/admin tiap bot ikut dapat.
// Pekerjaan berjalan bertahap (bisa lanjut oleh cron tiap menit), jadi tidak kena batas waktu walau penggunanya ribuan.
import crypto from 'crypto'
import {kv} from './db'
import {save} from './auth'
import {getBots,tg} from './tgpush'
import {notify} from './telegram'
import * as RS from './reseller'

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const CUR='tmp:bcacur',KEY=id=>'tmp:bca:'+id,LASTK='bca:last'
export const CATS={main:'Bot utama & bot tambahan',komisi:'Reseller tanpa modal',mandiri:'Reseller stok mandiri'}
const API=()=>process.env.TG_API||'https://api.telegram.org'
const strip=t=>String(t||'').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')
const plainLen=h=>String(h).replace(/<[^>]*>/g,'').replace(/&[a-z]+;/g,'x').length
const BLOCK=/blocked|deactivated|chat not found|kicked|user is deleted/i

export const normTargets=t=>{t=t||{};const o={main:t.main!==false,komisi:t.komisi!==false,mandiri:t.mandiri!==false};return o}
const parsePhoto=d=>{const m=String(d||'').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);return m?{mime:m[1],buf:Buffer.from(m[2],'base64')}:null}

// kategori tiap bot: bot biasa = main, bot reseller = mode toko (komisi / mandiri)
async function botCats(bots){
 const out={}
 await Promise.all(bots.map(async b=>{
  if(!b.rs){out[b.id]='main';return}
  try{const a=await RS.getRs(b.rs);out[b.id]=RS.isMandiri(a)?'mandiri':'komisi'}catch(e){out[b.id]='komisi'}}))
 return out}

// Info untuk panel: daftar bot + perkiraan jumlah penerima + status broadcast terakhir/berjalan
export async function bcaInfo(){
 const bots=await getBots(),cats=await botCats(bots)
 const main=((await kv.get('tgidx'))||[]).length
 const rs=bots.filter(b=>b.rs)
 const lists=await kv.mget(rs.map(b=>'rsc:'+b.rs))
 const cust=Object.fromEntries(rs.map((b,i)=>[b.id,Array.isArray(lists[i])?lists[i].length:0]))
 const items=bots.map(b=>({id:b.id,username:b.username||'',name:b.name||b.username||'',on:b.on!==false,cat:cats[b.id],users:b.rs?cust[b.id]:null,owners:(b.admins||[]).length}))
 const tot={main,komisi:0,mandiri:0}
 for(const b of items)if(b.cat!=='main')tot[b.cat]+=b.users||0
 const id=await kv.get(CUR),job=id&&await kv.get(KEY(id))
 return {bots:items,totals:tot,job:job?brief(job):null,last:(await kv.get(LASTK))||null}}
const brief=j=>({id:j.id,done:!!j.done,phase:j.phase,ok:j.ok,fail:j.fail,skip:j.skip,seen:j.seen,pin:!!j.pin,t:j.t,at:j.at,per:j.per,err:j.err||''})

export async function startAll({text,photo,pin,by,botId,targets}){
 text=String(text||'').trim().slice(0,3800);photo=photo?String(photo):''
 if(!text&&!photo)throw Error('Isi pesan atau foto dulu')
 if(photo&&!parsePhoto(photo))throw Error('Foto harus JPG / PNG / WebP')
 if(photo.length>1600000)throw Error('Foto terlalu besar (maks sekitar 1 MB)')
 const t=normTargets(targets);if(!t.main&&!t.komisi&&!t.mandiri)throw Error('Pilih minimal satu kelompok penerima')
 const cur=await kv.get(CUR);if(cur){const j=await kv.get(KEY(cur));if(j&&!j.done&&Date.now()-j.at<6*3600000)throw Error('Masih ada broadcast ke semua bot yang berjalan. Tunggu selesai.')}
 const bots=(await getBots()).filter(b=>b.on!==false);if(!bots.length)throw Error('Belum ada bot aktif')
 const job={id:crypto.randomBytes(5).toString('hex'),text,photo,pin:!!pin,by:by||0,bot:botId||'',t,after:'',phase:'users',
  ok:0,fail:0,skip:0,seen:0,per:{main:{ok:0,fail:0},komisi:{ok:0,fail:0},mandiri:{ok:0,fail:0}},perBot:{},adm:{},at:Date.now(),done:false}
 await kv.set(KEY(job.id),job);await kv.set(CUR,job.id)
 return job}

async function sendOne(bot,chat,job,ph){
 const mk=t=>job.plain?{text:t,disable_web_page_preview:true}:{text:t,parse_mode:'HTML',disable_web_page_preview:true}
 const once=async()=>{
  if(ph){
   const fit=plainLen(job.text)<=1000,f=new FormData()
   f.append('chat_id',String(chat));f.append('photo',new Blob([ph.buf],{type:ph.mime}),'broadcast.jpg')
   if(fit&&job.text){f.append('caption',job.text);if(!job.plain)f.append('parse_mode','HTML')}
   const r=await fetch(`${API()}/bot${bot.token}/sendPhoto`,{method:'POST',body:f,signal:AbortSignal.timeout(25000)}).then(x=>x.json()).catch(e=>({ok:false,description:e.message}))
   if(r&&r.ok&&job.text&&!fit)await tg(bot.token,'sendMessage',{chat_id:chat,...mk(job.text)})
   return r||{ok:false,description:'kosong'}}
  return tg(bot.token,'sendMessage',{chat_id:chat,...mk(job.text)})}
 let r=await once()
 if(!r.ok&&r.error_code===429){await sleep(Math.min(5,+((r.parameters||{}).retry_after)||2)*1000);r=await once()}
 // HTML admin salah tulis -> kirim sebagai teks biasa untuk SEMUA penerima, bukan gagal semua
 // (tiap panggilan mencoba ulang sekali, karena beberapa pengiriman paralel bisa sama-sama gagal sebelum job.plain menyala)
 if(!r.ok&&/parse entities|can't parse/i.test(r.description||'')){if(!job.plain){job.plain=true;job.text=strip(job.text)};r=await once()}
 if(r.ok&&job.pin&&r.result&&r.result.message_id)await tg(bot.token,'pinChatMessage',{chat_id:chat,message_id:r.result.message_id,disable_notification:true})
 return r}

async function markBlocked(uid){
 try{const f=await kv.get('u:'+uid);if(f&&!f.tgBlocked){f.tgBlocked=true;await save(f)}}catch(e){}}

const pick=(u,bots)=>{
 let b=bots.find(x=>x.id===u.tgBot)
 if(!b&&u.rs)b=bots.find(x=>x.rs===u.rs)
 if(!b)b=bots.find(x=>!x.rs&&x.on!==false)      // akun lama tanpa catatan bot
 return b&&b.on!==false?b:null}
const tally=(job,bot,cat,ok)=>{
 const p=job.per[cat]||(job.per[cat]={ok:0,fail:0}),pb=job.perBot[bot.id]||(job.perBot[bot.id]={u:bot.username||bot.id,cat,ok:0,fail:0})
 if(ok){job.ok++;p.ok++;pb.ok++}else{job.fail++;p.fail++;pb.fail++}}

export async function bcaStep(job,ms=30000){
 if(job.done)return job
 const bots=await getBots(),cats=await botCats(bots),ph=parsePhoto(job.photo),end=Date.now()+ms
 if(!bots.some(b=>b.on!==false)){job.done=true;job.err='Tidak ada bot aktif';await kv.set(KEY(job.id),job);return job}
 if(job.phase==='users'){
  while(Date.now()<end){
   const r=await kv.scanPrefix('u:',job.after,100),tasks=[]
   for(const {v:u} of r.items){
    job.seen++
    if(!u||!u.tgId||u.banned||u.tgBlocked){job.skip++;continue}
    const bot=pick(u,bots);if(!bot){job.skip++;continue}
    const cat=cats[bot.id]||'main';if(!job.t[cat]){job.skip++;continue}
    if((bot.admins||[]).map(String).includes(String(u.tgId)))(job.adm[bot.id]=job.adm[bot.id]||[]).push(String(u.tgId))
    tasks.push({bot,cat,u})}
   for(let i=0;i<tasks.length;i+=25){          // 25 pesan per detik: di bawah batas Telegram
    const t0=Date.now(),part=tasks.slice(i,i+25)
    const rs=await Promise.all(part.map(x=>sendOne(x.bot,x.u.tgId,job,ph)))
    rs.forEach((r,j)=>{tally(job,part[j].bot,part[j].cat,!!r.ok);if(!r.ok&&BLOCK.test(r.description||''))markBlocked(part[j].u.id)})
    const dt=Date.now()-t0;if(dt<1000)await sleep(1000-dt)}
   job.after=r.last||job.after
   await kv.set(KEY(job.id),job)
   if(r.done){job.phase='admins';break}}}
 // pemilik / admin tiap bot yang belum ikut terkirim (mis. belum pernah /start)
 if(job.phase==='admins'&&Date.now()<end+8000){
  for(const b of bots){
   const cat=cats[b.id]||'main';if(b.on===false||!job.t[cat])continue
   for(const ad of b.admins||[]){
    if((job.adm[b.id]||[]).includes(String(ad)))continue
    const r=await sendOne(b,ad,job,ph);if(r.ok)tally(job,b,cat,true);else job.skip++}}
  return finalize(job,bots)}
 await kv.set(KEY(job.id),job)
 return job}

async function finalize(job,bots){
 job.done=true;job.phase='done';job.endAt=Date.now()
 await kv.set(KEY(job.id),job)
 const total=job.ok+job.fail,sum={at:job.endAt,ok:job.ok,fail:job.fail,skip:job.skip,per:job.per,pin:job.pin,t:job.t,note:strip(job.text).slice(0,120)}
 await kv.set(LASTK,sum)
 if((await kv.get(CUR))===job.id)await kv.del(CUR)
 const rows=[['Sasaran',total],['Terkirim',job.ok],['Gagal',job.fail],['Dilewati',job.skip]]
 for(const k of Object.keys(CATS))if(job.t[k])rows.push([CATS[k],`${job.per[k].ok} terkirim · ${job.per[k].fail} gagal`])
 rows.push(['Jumlah bot',Object.keys(job.perBot).length])
 await notify({src:'bot',i:'📡',t:job.pin?'Broadcast semua bot + pin selesai':'Broadcast semua bot selesai',st:'admin',rows,note:strip(job.text).slice(0,200)}).catch(()=>{})
 if(job.by){const bot=bots.find(b=>b.id===job.bot&&b.on!==false)||bots.find(b=>b.on!==false)
  if(bot)await tg(bot.token,'sendMessage',{chat_id:job.by,parse_mode:'HTML',text:`<b>📡 BROADCAST SEMUA BOT SELESAI</b>\n\n<blockquote>🎯 Sasaran  <b>${total}</b>\n📬 Terkirim  <b>${job.ok}</b>\n🚫 Gagal  <b>${job.fail}</b>\n⏭ Dilewati  <b>${job.skip}</b></blockquote>`})}
 return job}

export async function bcaGet(id){return id?await kv.get(KEY(id)):null}
export async function bcaCancel(){
 const id=await kv.get(CUR);if(!id)return false
 const j=await kv.get(KEY(id));if(j&&!j.done){j.done=true;j.phase='batal';j.err='Dibatalkan admin';await kv.set(KEY(id),j)}
 await kv.del(CUR);return true}
// Dipanggil cron tiap menit: lanjutkan broadcast semua-bot yang belum selesai
export async function bcaTick(ms=30000){
 const id=await kv.get(CUR);if(!id)return null
 const job=await kv.get(KEY(id));if(!job||job.done){await kv.del(CUR);return null}
 const r=await bcaStep(job,ms);return {id:r.id,done:!!r.done,ok:r.ok,fail:r.fail,seen:r.seen}}
export {brief}
