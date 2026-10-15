// Pengaturan yang dulu hanya bisa lewat env, sekarang bisa diisi dari /admin > Integrasi (disimpan di kv "sec").
// Prioritas: isian dashboard > env > kosong. Secret tidak pernah dikirim utuh ke browser (hanya 4 karakter terakhir).
// Yang TETAP harus env (dibutuhkan sebelum database/admin bisa dipakai): MONGODB_URI, MONGODB_DB, ADMIN_PASSWORD, CRON_SECRET.
import {kv} from './db'
export const SEC=[
 {k:'WN_KEY',g:'warungnokos',l:'API key WarungNokos (x-api-key)',secret:1},
 {k:'WN_BASE',g:'warungnokos',l:'Base URL WarungNokos',ph:'https://warungnokos.web.id',url:1},
 {k:'SMSCODE_KEY',g:'smscode',l:'API token SMSCode (Bearer, dari Account Settings)',secret:1},
 {k:'SMSCODE_BASE',g:'smscode',l:'Base URL SMSCode',ph:'https://api.smscode.gg/v1',url:1},
 {k:'SMSCODE_HOOK_SECRET',g:'smscode',l:'Secret webhook SMSCode (diisi otomatis oleh tombol Pasang webhook)',secret:1},
 {k:'DITZ_KEY',g:'ditz',l:'API key JasaOTP / Ditznesia',secret:1},
 {k:'DITZ_BASE',g:'ditz',l:'Base URL JasaOTP / Ditznesia',ph:'https://www.ditznesia.com/api/dev',url:1},
 {k:'PAKASIR_SLUG',g:'pakasir',l:'Slug proyek Pakasir',ph:'mis. depodomain'},
 {k:'PAKASIR_KEY',g:'pakasir',l:'API key proyek Pakasir',secret:1},
 {k:'PAKASIR_BASE',g:'pakasir',l:'Base URL Pakasir',ph:'https://app.pakasir.com',url:1},
 {k:'AUSTIN_KEY',g:'austin',l:'API key AustinPay (apg_live_...)',secret:1},
 {k:'AUSTIN_SECRET',g:'austin',l:'API secret AustinPay (HMAC, opsional tapi disarankan)',secret:1},
 {k:'AUSTIN_BASE',g:'austin',l:'Base URL AustinPay',ph:'https://austinstore.id',url:1},
 {k:'TELEGRAM_BOT_TOKEN',g:'telegram',l:'Token bot Telegram',secret:1},
 {k:'TELEGRAM_CHAT_ID',g:'telegram',l:'Chat ID channel notifikasi'},
 {k:'BACKUP_CHAT_ID',g:'telegram',l:'Chat ID pribadi owner untuk backup (pisahkan koma)'},
 {k:'SITE_URL',g:'situs',l:'URL situs (untuk link reset password)',ph:'https://domainkamu.com',url:1},
 {k:'RESEND_API_KEY',g:'email',l:'API key Resend (email reset password)',secret:1},
 {k:'MAIL_FROM',g:'email',l:'Alamat pengirim email',ph:'Artapedia ID <noreply@domainkamu.com>'},
 {k:'GOOGLE_CLIENT_ID',g:'google',l:'Google OAuth Client ID',ph:'xxxx.apps.googleusercontent.com'},
 {k:'GOOGLE_CLIENT_SECRET',g:'google',l:'Google OAuth Client Secret',secret:1},
 {k:'GITHUB_CLIENT_ID',g:'github',l:'GitHub OAuth Client ID'},
 {k:'GITHUB_CLIENT_SECRET',g:'github',l:'GitHub OAuth Client Secret',secret:1}]
const KEYS=SEC.map(x=>x.k)
export async function getSec(){
 const c=globalThis.__sec;if(c&&Date.now()-c.t<8000)return c.v
 let s={};try{s=(await kv.get('sec'))||{}}catch(e){}
 const v={};for(const k of KEYS)v[k]=String(s[k]!=null&&s[k]!==''?s[k]:(process.env[k]||'')).trim()
 // Sisa pengaturan lama: kunci upstream Artapedia dipakai sebagai cadangan kalau WN_KEY
 // belum diisi, supaya situs yang sudah jalan tidak langsung mati setelah pindah ke WarungNokos.
 if(!v.WN_KEY)v.WN_KEY=String(s.ARTA_KEY||process.env.ARTA_KEY||process.env.WN_KEY||'').trim()
 globalThis.__sec={t:Date.now(),v};return v}
export const resetSec=()=>{globalThis.__sec=null}
// Info aman untuk admin (tanpa nilai secret)
export async function secInfo(){
 const s=(await kv.get('sec'))||{},v=await getSec()
 return SEC.map(x=>{const own=s[x.k]!=null&&s[x.k]!=='',val=v[x.k]
  return {k:x.k,g:x.g,l:x.l,ph:x.ph||'',secret:!!x.secret,set:!!val,src:own?'dashboard':(val?'env':''),
   val:x.secret?'':val,hint:x.secret&&val?'••••'+val.slice(-4):''}})}
// values: {KEY:'nilai'} -> isi; {KEY:''} -> hapus isian dashboard (kembali ke env); key yang tidak dikirim tidak berubah
export async function secSave(values){
 const s=(await kv.get('sec'))||{}
 for(const x of SEC){if(!values||!(x.k in values)||values[x.k]==null)continue
  const t=String(values[x.k]).trim().slice(0,500)
  if(t===''){delete s[x.k];continue}
  if(x.url&&!/^https?:\/\/[^\s]+$/.test(t))throw Error(x.l+': link harus diawali http:// atau https://')
  s[x.k]=x.url?t.replace(/\/+$/,''):t}
 await kv.set('sec',s);resetSec();return secInfo()}
