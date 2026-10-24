// ===========================================================================
// H2H SMP (Solusi Media Pulsa) tipe IRS: dipakai untuk PENARIKAN INSTAN ke DANA.
//   GET https://solusimediapulsa.com/api/h2h/trx?id&pin&pass&kodeproduk&tujuan&idtrx&user
// Kredensial diisi admin di Integrasi > SMP Payment (SMP_H2H_ID / _PIN / _PASS / _USER), tidak pernah dikirim ke browser.
// PIN & password ada di query string (sesuai dokumentasi provider), jadi URL TIDAK PERNAH dicatat atau ikut di pesan error.
// ===========================================================================
import {getSec} from './settings'

export const H2H_URL='https://solusimediapulsa.com/api/h2h/trx'
// Nominal DANA yang tersedia di provider -> kode produk. Tambah baris di sini kalau provider membuka nominal baru.
export const INST_PRODUCTS=Object.fromEntries([
 ...[1,2,3,4,5,6,7,8,9].map(n=>[n*1000,'ADN'+n]),
 ...[10,15,20,25,30,35,40,45,50,55,60].map(n=>[n*1000,'DNNP'+n])])
export const INST_NOMINALS=Object.keys(INST_PRODUCTS).map(Number).sort((a,b)=>a-b)

export async function h2hCreds(){
 const s=await getSec()
 return {id:s.SMP_H2H_ID,pin:s.SMP_H2H_PIN,pass:s.SMP_H2H_PASS,user:s.SMP_H2H_USER}}
export async function h2hReady(){const c=await h2hCreds();return !!(c.id&&c.pin&&c.pass&&c.user)}

// Nomor DANA -> bentuk 08xxxxxxxxxx. '' kalau tidak valid.
export const normDana=v=>{let d=String(v||'').replace(/\D/g,'')
 if(d.startsWith('62'))d='0'+d.slice(2);else if(d.startsWith('8'))d='0'+d
 return /^08[0-9]{8,12}$/.test(d)?d:''}

// Buang bagian yang tidak boleh sampai ke pengguna / catatan: sisa saldo provider & client id.
const bersih=t=>String(t||'').replace(/\s+/g,' ').replace(/SISA\s*SALDO\s*:?\s*[\d.,]+/ig,'').replace(/CLIENTID\s*=\s*\S+/ig,'').trim().slice(0,200)
const GAGAL=/\bGAGAL\b|DITOLAK|SALDO\s+(?:ANDA\s+)?(?:TIDAK|KURANG)|TIDAK\s+CUKUP|\b(?:PIN|PASS(?:WORD)?|ID|USER(?:NAME)?)\s+(?:ANDA\s+)?(?:SALAH|TIDAK\s+VALID)|KODE\s*PRODUK\s+(?:SALAH|TIDAK)|PRODUK\s+(?:TIDAK|GANGGUAN|KOSONG|NONAKTIF)|INVALID|DIBLOKIR/i
const BERHASIL=/\b(?:BERHASIL|SUKSES|SUCCESS)\b/i
const BUKAN=/(?:TIDAK|BELUM|BUKAN)\s+(?:BERHASIL|SUKSES|SUCCESS)/i

// Teks balasan/laporan provider -> success | failed | unknown. Hanya yang JELAS yang final:
// kalau ada dua sinyal bertentangan, atau kalimatnya "tidak/belum berhasil", hasilnya unknown (admin yang memastikan).
export function klasifikasi(raw){
 const text=bersih(raw),g=GAGAL.test(text),b=BERHASIL.test(text)
 if(g&&!b)return {state:'failed',text}
 if(b&&!g&&!BUKAN.test(text)){
  const sn=(text.match(/SN\s*:\s*(.+?)(?:\.\s*$|$)/i)||[])[1]||''
  const hrg=+String((text.match(/HRG\s*:\s*([\d.,]+)/i)||[])[1]||'').replace(/\./g,'').replace(',','.')||0
  return {state:'success',text,sn:sn.trim().slice(0,120),cost:hrg}}
 return {state:'unknown',text}}

// ---- Report URL: provider mengirim laporan status akhir (GET/POST, bentuknya tidak dijamin) ----
const ID_KEYS=['idtrx','id_trx','refid','ref_id','reffid','reff','ref','trxid','trx_id','idtransaksi','id_transaksi','reference']
const ST_KEYS=['status','state','statustrx','status_trx','message','msg','pesan','keterangan','ket','result','note','remark','response','resp']
// Ambil kandidat idtrx (milik kita: 13 digit) + teks status dari query string / body (JSON, form, atau teks biasa).
export function parseReport(query,rawBody){
 const f={},put=(k,v)=>{if(v==null||typeof v==='object')return;f[String(k).toLowerCase().trim()]=String(v).slice(0,500)}
 for(const [k,v] of query)put(k,v)
 const raw=String(rawBody||'').slice(0,4000).trim()
 let plain=!!raw
 if(raw){
  try{const j=JSON.parse(raw);if(j&&typeof j==='object'){plain=false;for(const k of Object.keys(j))put(k,j[k])}}
  catch(e){if(/^[^=\s&]+=/.test(raw)){plain=false;try{for(const [k,v] of new URLSearchParams(raw))put(k,v)}catch(e2){}}}}
 const idc=[];for(const k of ID_KEYS)if(f[k]&&!idc.includes(f[k]))idc.push(f[k])
 for(const m of ((Object.values(f).join(' ')+' '+raw).match(/\b\d{13}\b/g)||[]))if(!idc.includes(m))idc.push(m)
 let st=ST_KEYS.map(k=>f[k]).filter(Boolean).join(' ')
 if(!st)st=plain?raw:Object.values(f).join(' ')
 const sn=f.sn||f.serial||f.serialnumber||f.sn_trx||''
 return {idc:idc.slice(0,6),statusText:bersih(st),sn:String(sn).slice(0,120),
  raw:(Object.keys(f).length?JSON.stringify(f):raw).slice(0,400)}}

// Kirim satu transaksi. Hasil:
//   success : provider menyatakan BERHASIL
//   failed  : provider menyatakan GAGAL dengan jelas (dana pasti tidak terkirim)
//   unknown : timeout / error jaringan / balasan belum final (JANGAN dianggap gagal: dana mungkin sudah terkirim)
export async function h2hSend({kode,tujuan,idtrx}){
 const c=await h2hCreds()
 if(!(c.id&&c.pin&&c.pass&&c.user))return {state:'failed',text:'H2H belum dikonfigurasi admin',notSent:true}
 const q=new URLSearchParams({id:c.id,pin:c.pin,pass:c.pass,kodeproduk:kode,tujuan,idtrx:String(idtrx),user:c.user})
 let status=0,raw=''
 try{
  const r=await fetch(H2H_URL+'?'+q.toString(),{redirect:'manual',signal:AbortSignal.timeout(25000),headers:{'User-Agent':'ArtapediaPay-H2H/1.0'}})
  status=r.status;raw=(await r.text()).slice(0,2000)
 }catch(e){return {state:'unknown',text:e&&e.name==='TimeoutError'?'Provider tidak membalas (timeout 25 detik)':'Gagal menghubungi provider'}}
 const text=bersih(raw.replace(/<[^>]*>/g,' '))
 if(status>=500||status===0)return {state:'unknown',text:text||('Provider error HTTP '+status)}
 const k=klasifikasi(text)
 if(k.state!=='unknown')return k
 return {state:'unknown',text:text||'Balasan provider kosong'}}
