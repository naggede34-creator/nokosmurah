// Pengaturan yang dulu hanya bisa lewat env, sekarang bisa diisi dari /admin > Integrasi (disimpan di kv "sec").
// Prioritas: isian dashboard > env > kosong. Secret tidak pernah dikirim utuh ke browser (hanya 4 karakter terakhir).
// Yang TETAP harus env (dibutuhkan sebelum database/admin bisa dipakai): MONGODB_URI, MONGODB_DB, ADMIN_PASSWORD, CRON_SECRET.
import {kv} from './db'
export const SEC=[
 {k:'DIBANANA_KEY',g:'dibanana',l:'API key Dibanana (bn_live_..., dari Profile > API Key)',secret:1},
 {k:'DIBANANA_BASE',g:'dibanana',l:'Base URL Dibanana',ph:'https://dibanana.id/api/v1',url:1},
 {k:'DIBANANA_HOOK_SECRET',g:'dibanana',l:'Webhook Secret Dibanana (opsional, dari Profile > Webhook; untuk OTP masuk seketika)',secret:1},
 {k:'PAKASIR_SLUG',g:'pakasir',l:'Slug proyek Pakasir',ph:'mis. depodomain'},
 {k:'PAKASIR_KEY',g:'pakasir',l:'API key proyek Pakasir',secret:1},
 {k:'PAKASIR_BASE',g:'pakasir',l:'Base URL Pakasir',ph:'https://app.pakasir.com',url:1},
 {k:'AUSTIN_KEY',g:'austin',l:'API key AustinPay (apg_live_...)',secret:1},
 {k:'AUSTIN_SECRET',g:'austin',l:'API secret AustinPay (HMAC, opsional tapi disarankan)',secret:1},
 {k:'AUSTIN_BASE',g:'austin',l:'Base URL AustinPay',ph:'https://austinstore.id',url:1},
 {k:'SMP_QRIS',g:'smp',l:'QRIS statis SMP Payment: teks QRIS (diawali 000201…) agar nominal terisi otomatis, atau link gambar QRIS',ph:'00020101021126...'},
 {k:'SMP_SECRET',g:'smp',l:'Key rahasia callback (bagian akhir URL callback, hanya huruf/angka)',secret:1},
 {k:'SMP_USERNAME',g:'smp',l:'Username akun SMP Payment (us_username di callback, opsional tapi disarankan)',ph:'mis. jhondoe'},
 {k:'AGEN_KEY',g:'agenh2h',l:'AgenH2H (penarikan instan): API Key (Dashboard Akun > API)',secret:1},
 {k:'AGEN_SECRET',g:'agenh2h',l:'AgenH2H (penarikan instan): Secret Key (juga dipakai memverifikasi webhook)',secret:1},
 {k:'AGEN_BASE',g:'agenh2h',l:'AgenH2H: Base URL API (opsional)',ph:'https://agenh2h.com/api/v1',url:1},
 {k:'AGEN_DANA_SKUS',g:'agenh2h',l:'AgenH2H: SKU DANA per nominal, format nominal=SKU dipisah koma (ambil SKU dari GET /products?q=dana)',ph:'10000=SKU-DANA-10K, 20000=SKU-DANA-20K'},
 {k:'SMP_H2H_SECRET',g:'smp',l:'Report URL SMP lama (hanya untuk penarikan lama yang masih diproses)',secret:1,alnum:1},
 {k:'TELEGRAM_BOT_TOKEN',g:'telegram',l:'Token bot Telegram',secret:1},
 {k:'TELEGRAM_CHAT_ID',g:'telegram',l:'Chat ID channel notifikasi'},
 {k:'BACKUP_CHAT_ID',g:'telegram',l:'Chat ID pribadi owner untuk backup (pisahkan koma)'},
 {k:'CSBOT_TOKEN',g:'csbot',l:'Token bot Customer Service (buat bot BARU di @BotFather, jangan pakai token bot lain)',secret:1},
 {k:'CSBOT_CHAT_ID',g:'csbot',l:'ID Telegram admin CS penerima notif & pembalas chat (boleh lebih dari satu, pisahkan koma)',ph:'mis. 123456789'},
 {k:'CSBOT_HOOK_SECRET',g:'csbot',l:'Secret webhook (diisi otomatis oleh tombol Pasang webhook)',secret:1},
 {k:'NEOXR_KEY',g:'neoxr',l:'API key Neoxr (untuk Mode CS 2: Nona Cantikan AI)',secret:1},
 {k:'NEOXR_BASE',g:'neoxr',l:'Alamat API GPT Neoxr (opsional)',ph:'https://api.neoxr.eu/api/gpt4',url:1},
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
  if(x.alnum&&!/^[A-Za-z0-9]{12,64}$/.test(t))throw Error('Kunci Report URL harus 12-64 karakter huruf/angka saja')
  s[x.k]=x.url?t.replace(/\/+$/,''):t}
 await kv.set('sec',s);resetSec();return secInfo()}
