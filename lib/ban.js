// ===========================================================================
// BAN AKUN + IP. Permintaan pemilik situs: sekali satu akun dibanned, alamat IP
// yang pernah dipakainya ikut diblokir, dan SEMUA akun lain yang nyambung ke
// akun itu (lewat IP yang sama atau Telegram yang sama) ikut kena.
//
// Catatan penting soal risiko: satu IP bisa dipakai banyak orang (WiFi kantor,
// kuota seluler/CGNAT). Karena itu:
//  - banned-nya SELALU bisa dibalik: tiap akun susulan menyimpan `banBy` (siapa
//    sumbernya) dan tiap IP menyimpan `by`, jadi "unban" mengembalikan semuanya;
//  - admin bisa mematikan rambatannya per-ban (kirim ip:false);
//  - akun admin sendiri tidak pernah ikut terbanned.
// ===========================================================================
import {kv} from './db'
import {save} from './auth'
import {normIp,validIp} from './auth'
import {getCfg} from './bonus'

export const BANIP='banip'   // { "1.2.3.4": {by:<uid>, at:<ms>, email:<mask>} }

export const ipList=async()=>{try{return (await kv.get(BANIP))||{}}catch(e){return {}}}
// IP yang sedang diblokir? Mengembalikan keterangannya, atau null.
export async function ipBanned(ip){
 const x=normIp(ip);if(!x)return null
 const m=await ipList();const d=m[x]
 return d?{ip:x,...d}:null}

// semua IP yang pernah tercatat di satu akun (login terakhir + riwayat 15 IP)
const ipsOf=u=>[...new Set([u&&u.lastIp,...((u&&Array.isArray(u.ips)?u.ips:[]).map(x=>x&&x.ip))]
 .map(normIp).filter(x=>x&&validIp(x)))]

// Pindai seluruh pengguna sekali, kembalikan {users:[...], byIp:Map}
async function semua(){
 const out=[];let after=''
 for(;;){const r=await kv.scanPrefix('u:',after,200)
  for(const {v:u} of r.items)if(u&&u.id)out.push(u)
  after=r.last;if(r.done)break}
 return out}

// Email pemilik situs (daftar "pintu rahasia" di admin): tidak pernah ikut kena rambatan,
// supaya admin tidak mengunci dirinya sendiri saat ikut memakai WiFi yang sama.
const pemilik=async()=>{try{const c=await getCfg()
 return new Set(((c.tap||{}).emails||[]).map(x=>String(x||'').toLowerCase().trim()).filter(Boolean))}catch(e){return new Set()}}

// Akun yang "nyambung" ke akun sumber: IP-nya beririsan, atau Telegram-nya sama.
export function terkait(src,semuaUser,ips,aman){
 const set=new Set(ips),skip=aman||new Set()
 const tg=String((src&&src.tgId)||'')
 return semuaUser.filter(u=>{
  if(!u||u.id===src.id)return false
  if(skip.has(String(u.email||'').toLowerCase()))return false
  if(tg&&String(u.tgId||'')===tg)return true
  return ipsOf(u).some(x=>set.has(x))})}

// Pratinjau tanpa mengubah apa pun: dipakai panel admin supaya tahu dampaknya dulu.
export async function banPreview(src){
 const users=await semua(),aman=await pemilik()
 const ipAman=new Set(users.filter(u=>aman.has(String(u.email||'').toLowerCase())).flatMap(ipsOf))
 const ips=ipsOf(src).filter(x=>!ipAman.has(x))
 const kena=terkait(src,users,ips,aman).filter(u=>!u.banned)
 return {ips,akun:kena.map(u=>({id:u.id,email:u.email,name:u.name||'',balance:+u.balance||0}))}}

// Ban akun + (opsional) IP & akun terkait. Mengembalikan ringkasan dampaknya.
export async function banUser(src,{ip=true,reason=''}={}){
 const now=Date.now(),alasan=String(reason||'').trim().slice(0,200)
 src.banned=true;src.banAt=now;src.banReason=alasan;src.banIp=!!ip
 await save(src)
 if(!ip)return {ips:[],akun:[]}
 const users=await semua(),aman=await pemilik()
 // IP yang juga dipakai akun pemilik situs tidak ikut diblokir — kalau tidak, admin bisa
 // terkunci sendiri hanya karena pernah memakai jaringan yang sama dengan pelanggar.
 const ipAman=new Set(users.filter(u=>aman.has(String(u.email||'').toLowerCase())).flatMap(ipsOf))
 const ips=ipsOf(src).filter(x=>!ipAman.has(x))
 const m=await ipList()
 for(const x of ips)if(!m[x])m[x]={by:src.id,at:now,email:src.email||''}
 if(ips.length)await kv.set(BANIP,m)
 const kena=terkait(src,users,ips,aman).filter(u=>!u.banned)
 for(const u of kena){
  u.banned=true;u.banAt=now;u.banBy=src.id
  u.banReason=alasan||('Terhubung dengan akun '+(src.email||src.id))
  try{await save(u)}catch(e){}}
 return {ips,akun:kena.map(u=>({id:u.id,email:u.email}))}}

// Unban: akun sumber, IP yang dia bawa, dan semua akun susulan ikut dipulihkan.
export async function unbanUser(src){
 src.banned=false;src.banBy='';src.banReason='';src.banIp=false
 await save(src)
 const m=await ipList(),lepas=[]
 for(const [x,d] of Object.entries(m))if(d&&d.by===src.id){delete m[x];lepas.push(x)}
 if(lepas.length)await kv.set(BANIP,m)
 const users=await semua()
 const kena=users.filter(u=>u.banned&&u.banBy===src.id)
 for(const u of kena){u.banned=false;u.banBy='';u.banReason=''
  try{await save(u)}catch(e){}}
 return {ips:lepas,akun:kena.map(u=>({id:u.id,email:u.email}))}}

// Buka blokir satu IP saja (tanpa menyentuh akunnya).
export async function ipUnban(ip){
 const x=normIp(ip);if(!x)return false
 const m=await ipList();if(!m[x])return false
 delete m[x];await kv.set(BANIP,m);return true}
