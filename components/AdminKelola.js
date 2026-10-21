'use client'
import {useState,useEffect,useCallback,useMemo,useRef} from 'react'
// Menu KELOLA: (1) daftar & hapus massal bot reseller, (2) unduh backup / impor / pulihkan semua data,
// (3) Clean: hapus transaksi gagal, batal, bermasalah + sampah web, (4) saldo semua server nokos.
// Semua panggilan ke server diulang otomatis dengan beban lebih kecil kalau server kehabisan waktu
// (dulu: "Unexpected token 'A', \"An error o\"... is not valid JSON").
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(+t).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'}):'-'
const stamp=()=>new Date(Date.now()+7*36e5).toISOString().slice(0,16).replace(/[T:]/g,'-')
const save=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),30000)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const enc=new TextEncoder()
const bytes=t=>/[^\x00-\x7f]/.test(t)?enc.encode(t).length:t.length
const csvCell=v=>{v=String(v??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n\r;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}

// Hitung ringkasan yang enak dibaca dari data mentah (kunci "u:", "rs:", "bots").
function bacaRingkas(ent){
 const users=[],rs=new Map()
 for(const [k,v] of ent){
  if(k.startsWith('u:')&&v&&typeof v==='object')users.push(v)
  else if(k.startsWith('rs:')&&v&&v.uid)rs.set(v.uid,v)}
 const bots=Array.isArray(ent.get('bots'))?ent.get('bots'):[]
 const byId=new Map(users.map(u=>[u.id,u]))
 const sum=u=>{const tx=u.tx||[],ord=tx.filter(x=>x.type==='order'),ok=ord.filter(x=>x.status==='success'),dep=tx.filter(x=>x.type==='deposit'&&(x.status==='completed'||x.credited))
  return {total_order:ord.length,order_sukses:ok.length,total_belanja:ok.reduce((a,x)=>a+(+x.price||0),0),deposit_sukses:dep.length,total_deposit:dep.reduce((a,x)=>a+(+x.amount||0),0)}}
 const pengguna=u=>({id:u.id,email:u.email||'',nama:u.name||'',saldo:+u.balance||0,bergabung:u.joinedAt||'',diblokir:!!u.banned,
  telegram_id:u.tgId||'',telegram_user:u.tgUser||'',api_key:u.apikey||'',kode_ajakan:u.refCode||'',...sum(u)})
 const web=users.filter(u=>!u.rs).map(pengguna)
 const cust=new Map()
 for(const u of users)if(u.rs){if(!cust.has(u.rs))cust.set(u.rs,[]);cust.get(u.rs).push(pengguna(u))}
 const uids=new Set([...rs.keys(),...bots.filter(b=>b.rs).map(b=>b.rs),...cust.keys()])
 const reseller=[...uids].map(uid=>{
  const a=rs.get(uid)||{},o=byId.get(uid)||{},b=bots.find(x=>x.rs===uid&&(!a.bot||x.id===a.bot.id))||bots.find(x=>x.rs===uid)||null,pel=cust.get(uid)||[]
  return {
   pembuat_bot:{id_akun_web:uid,email:o.email||'',nama:o.name||'',saldo_akun_web:+o.balance||0,telegram_owner_user:(a.bot&&a.bot.ownerUser)||(b&&b.ownerUser)||'',telegram_owner_id:(a.bot&&a.bot.ownerId)||((b&&b.admins)||[])[0]||''},
   bot:b?{id:b.id,username:b.username||'',nama:b.name||'',aktif:b.on!==false,dibuat:b.at?new Date(b.at).toISOString():''}:null,
   toko:{nama:a.brand||(b&&b.brand)||'',mode:a.mode==='mandiri'?'stok mandiri':'tanpa modal',aktif:a.on!==false,saldo_dompet:+a.balance||0,total_untung:+a.earn||0,saldo_stok:+a.stok||0,nomor_terjual:+a.sold||0},
   jumlah_pelanggan:pel.length,
   pelanggan:pel}})
 return {web,reseller,users:users.length,rsN:rs.size,botN:bots.length}}

 export default function AdminKelola({call}){
 const callRef=useRef(call);callRef.current=call
 const C=useCallback((a,b)=>callRef.current(a,b),[])
 // panggil + ulangi otomatis kalau server kehabisan waktu / koneksi putus; budget (ms kerja server) dikecilkan tiap gagal
 const callB=useCallback(async(a,b,ctl)=>{
  const c=ctl||{bud:25000};let r
  for(let i=0;i<5;i++){
   r=await C(a,{...(b||{}),budget:c.bud})
   if(!r||!(r.timeout||r.net))return r
   c.bud=Math.max(3000,Math.floor(c.bud/2));await sleep(700*(i+1))}
  return r},[C])
 const [bots,setBots]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(''),[load,setLoad]=useState('')
 const [flt,setFlt]=useState('all'),[q,setQ]=useState(''),[topN,setTopN]=useState(10),[minDays,setMinDays]=useState(0),[sel,setSel]=useState(()=>new Set()),[inclMoney,setInclMoney]=useState(false)
 const [bs,setBs]=useState(''),[fmt,setFmt]=useState('json'),[imode,setImode]=useState('merge')
 const [cl,setCl]=useState(null),[clMsg,setClMsg]=useState('')
 const [sal,setSal]=useState(null),[salMsg,setSalMsg]=useState('')

 // daftar bot dimuat bertahap (server memindai pengguna per bagian), jadi tidak kena batas waktu
 const loadBots=useCallback(async()=>{
  setLoad('⏳ Memuat daftar bot…');const ctl={bud:25000};let st=null
  try{for(let n=0;n<600;n++){
    const r=await callB('kelola/bots',{state:st},ctl)
    if(r.error){setMsg('❌ '+r.error);setLoad('');return}
    if(!r.partial){setBots(r);setSel(new Set());setLoad('');return}
    st=r.state;setLoad('⏳ Memindai pengguna… '+(+r.scanned||+st.scanned||0).toLocaleString('id-ID'))}
   setMsg('❌ Terlalu lama memuat daftar bot, coba lagi')
  }catch(e){setMsg('❌ '+e.message)}
  setLoad('')},[callB])
 useEffect(()=>{loadBots()},[loadBots])
 const loadSal=useCallback(async()=>{
  setSalMsg('⏳ Mengecek saldo ke tiap penyedia…')
  const r=await callB('kelola/saldo',{});if(r.error){setSalMsg('❌ '+r.error);return}
  setSal(r);setSalMsg('')},[callB])
 useEffect(()=>{loadSal()},[loadSal])

 // ----------------------------------------------------------------- daftar bot
 const rows=useMemo(()=>{
  if(!bots)return []
  const k=q.toLowerCase().trim()
  let a=bots.items.filter(x=>!k||[x.brand,x.username,x.ownerEmail,x.ownerTg,x.ownerName,x.uid].some(v=>String(v||'').toLowerCase().includes(k)))
  if(flt==='unused')a=a.filter(x=>x.unused)
  if(flt==='zero')a=a.filter(x=>x.zero)
  if(flt==='top'){a=a.filter(x=>x.ok>0).sort((x,y)=>y.ok-x.ok||y.orders-x.orders||y.cust-x.cust);if(+topN>0)a=a.slice(0,+topN)}
  return a},[bots,flt,q,topN])
 const toggle=id=>setSel(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n})
 const allOn=rows.length>0&&rows.every(x=>sel.has(x.id))
 const pickAll=()=>setSel(allOn?new Set():new Set(rows.map(x=>x.id)))
 const aman=useMemo(()=>bots?bots.items.filter(x=>x.unused&&!x.uang&&!x.tunggu&&x.days>=(+minDays||0)):[],[bots,minDays])
 // bot dengan keuntungan Rp0 (tarikan menunggu selalu dilewati; bot yang dompetnya berisi dilewati kecuali dicentang)
 const nol=useMemo(()=>bots?bots.items.filter(x=>x.zero&&!x.tunggu&&(inclMoney||!x.uang)&&x.days>=(+minDays||0)):[],[bots,minDays,inclMoney])

 // hapus bertahap: server bekerja dalam batas waktu per panggilan, browser mengulang sampai selesai
 const hapus=async(body0,label)=>{
  setBusy('del');setMsg('')
  const ctl={bud:25000}
  try{let body=body0,done=0,gagal=[],total=0
   for(let n=0;n<300;n++){
    const r=await callB('kelola/bots/del',body,ctl);if(r.error)throw Error(r.error)
    const left=r.left||[]
    done+=r.done;gagal=gagal.concat(r.failed||[]);total=Math.max(total,done+left.length+gagal.length)
    setMsg(`⏳ ${label}: ${done}/${total}…`)
    if(!left.length)break
    if(!r.done&&!(r.failed||[]).length&&body.ids&&left.length===body.ids.length)throw Error('Penghapusan tidak maju, coba lagi sebentar')
    body={ids:left}}
   setMsg(`✅ ${done} bot dihapus${gagal.length?` · ${gagal.length} gagal (${gagal[0].error})`:''}.`)
  }catch(e){setMsg('❌ '+e.message)}
  setBusy('');loadBots()}
 const hapusPilih=()=>{
  const p=bots.items.filter(x=>sel.has(x.id));if(!p.length)return
  const dipakai=p.filter(x=>x.ok>0||x.cust>0).length,uang=p.filter(x=>x.uang>0).length
  const t=`Hapus ${p.length} bot reseller terpilih?\n\n`+(dipakai?`⚠️ ${dipakai} bot masih punya pelanggan/pesanan.\n`:'')+(uang?`⚠️ ${uang} bot reseller masih punya saldo dompet/stok (saldo tetap tersimpan di akun reseller, tidak hilang).\n`:'')+'\nWebhook dicabut dan bot dilepas dari daftar. Pelanggan & riwayat tetap aman. Reseller bisa membuat bot baru.'
  if(confirm(t))hapus({ids:p.map(x=>x.id)},'Menghapus bot')}
 const hapusKosong=()=>{
  if(!aman.length)return alert('Tidak ada bot yang tanpa penggunaan sama sekali'+(+minDays?` dengan umur ≥ ${minDays} hari`:'')+'.')
  if(confirm(`Hapus ${aman.length} bot reseller yang TIDAK ADA PENGGUNAAN sama sekali (tanpa pelanggan, tanpa pesanan, tanpa saldo, tanpa tarikan tertunda)${+minDays?` dan umurnya ≥ ${minDays} hari`:''}?`))hapus({unused:true,minDays:+minDays||0},'Menghapus bot kosong')}

 const hapusNol=()=>{
  if(!nol.length)return alert('Tidak ada bot dengan keuntungan Rp0'+(+minDays?` dengan umur ≥ ${minDays} hari`:'')+(inclMoney?'':' (bot yang dompetnya masih berisi dilewati)')+'.')
  const dipakai=nol.filter(x=>x.cust>0).length,uang=nol.filter(x=>x.uang>0).length
  const t=`Hapus ${nol.length} bot reseller dengan KEUNTUNGAN Rp0?\n\n`+(dipakai?`⚠️ ${dipakai} bot masih punya pelanggan (pelanggan & riwayat tetap aman).\n`:'')+(uang?`⚠️ ${uang} bot reseller masih punya saldo dompet/stok (saldo tetap tersimpan di akun reseller, tidak hilang).\n`:'')+'\nWebhook dicabut dan bot dilepas dari daftar. Reseller bisa membuat bot baru. Bot dengan tarikan/isi saldo yang masih menunggu otomatis dilewati.'
  if(confirm(t))hapus({zero:true,inclMoney,minDays:+minDays||0},'Menghapus bot untung Rp0')}

 // ----------------------------------------------------------------- backup
 const ambilSemua=async()=>{
  const ent=new Map(),part=new Map(),ctl={bud:25000};let cur=null
  for(;;){const r=await callB('backup/page',{cursor:cur},ctl);if(r.error)throw Error(r.error)
   for(const it of r.items){if(it.part){const a=(part.get(it.k)||'')+it.part.s;part.set(it.k,a);if(it.part.o+it.part.s.length>=it.part.total){ent.set(it.k,JSON.parse(a));part.delete(it.k)}}else ent.set(it.k,it.v)}
   setBs('Mengambil data… '+ent.size);if(!r.next)break;cur=r.next}
  return ent}
 const unduhBackup=async()=>{
  setBusy('bk');setBs('Mulai…')
  try{const ent=await ambilSemua(),rg=bacaRingkas(ent)
   const head={app:'artapedia-id',version:2,type:'kelola-backup',at:Date.now(),waktu:new Date().toISOString(),
    catatan:'File ini berisi data SENSITIF (API key, hash password, token bot). Simpan rahasia. Pulihkan lewat Admin > Kelola > Impor / Pulihkan. Bagian "entries" adalah data lengkap yang dipakai untuk memulihkan; bagian lain ringkasan yang mudah dibaca.',
    ringkasan:{total_data:ent.size,pengguna_total:rg.users,pengguna_web:rg.web.length,reseller:rg.reseller.length,bot_terdaftar:rg.botN,pelanggan_bot_reseller:rg.reseller.reduce((a,x)=>a+x.jumlah_pelanggan,0),total_saldo_pengguna:rg.web.reduce((a,x)=>a+x.saldo,0)},
    pengguna_web:rg.web,bot_reseller:rg.reseller}
   setBs('Menyusun file…')
   // disusun per potongan (bukan satu string raksasa) supaya database besar tidak melewati batas panjang string browser
   const hs=JSON.stringify(head,null,fmt==='json'?1:0),pieces=[hs.slice(0,-1)+(fmt==='json'?',\n"entries": [\n':',"entries":[')]
   let buf=[],len=0,first=true
   const flushP=()=>{if(buf.length){pieces.push((first?'':',\n')+buf.join(',\n'));first=false;buf=[];len=0}}
   for(const [k,v] of ent){const t=JSON.stringify({k,v});buf.push(t);len+=t.length;if(len>4e6)flushP()}
   flushP();pieces.push('\n]}')
   let blob=new Blob(pieces,{type:'application/json'}),ext='json'
   if(fmt==='gz'&&typeof CompressionStream!=='undefined'){blob=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();ext='json.gz'}
   save(blob,'artapedia-backup-lengkap-'+stamp()+'.'+ext)
   setBs(`Selesai: ${ent.size} data · ${rg.web.length} pengguna web · ${rg.reseller.length} reseller diunduh`)
  }catch(e){alert('Gagal: '+e.message);setBs('')}
  setBusy('')}
 const unduhCsv=async()=>{
  setBusy('csv');setBs('Mulai…')
  try{const ent=await ambilSemua(),rg=bacaRingkas(ent)
   const isi=[['jenis','email','nama','saldo','telegram_id','telegram_user','bot_reseller_induk','bergabung','diblokir','total_order','order_sukses','total_belanja','total_deposit']]
   for(const u of rg.web)isi.push(['pengguna_web',u.email,u.nama,u.saldo,u.telegram_id,u.telegram_user,'',u.bergabung,u.diblokir?'ya':'tidak',u.total_order,u.order_sukses,u.total_belanja,u.total_deposit])
   for(const r of rg.reseller)for(const u of r.pelanggan)isi.push(['pelanggan_bot_reseller',u.email,u.nama,u.saldo,u.telegram_id,u.telegram_user,(r.bot&&('@'+r.bot.username))||r.toko.nama,u.bergabung,u.diblokir?'ya':'tidak',u.total_order,u.order_sukses,u.total_belanja,u.total_deposit])
   save(new Blob(['﻿'+isi.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'artapedia-email-saldo-'+stamp()+'.csv')
   setBs(`Selesai: ${isi.length-1} baris`)
  }catch(e){alert('Gagal: '+e.message);setBs('')}
  setBusy('')}
 const impor=async e=>{
  const files=[...e.target.files];e.target.value='';if(!files.length)return
  if(imode==='replace'){if(prompt('MODE GANTI TOTAL: semua data sekarang dihapus lalu diganti isi file. Backup pengaman dikirim ke Telegram dulu (kalau sudah diatur). Ketik HAPUS untuk lanjut:')!=='HAPUS')return}
  else if(!confirm('Gabungkan data dari file ke database? Data dengan kunci yang sama akan ditimpa, data baru yang tidak ada di file tetap aman.'))return
  setBusy('imp')
  try{let all=[]
   for(const f of files){const buf=await f.arrayBuffer(),u8=new Uint8Array(buf);let txt
    if(u8[0]===0x1f&&u8[1]===0x8b){if(typeof DecompressionStream==='undefined')throw Error('Browser ini belum mendukung .gz, ekstrak dulu lalu pilih file .json');txt=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}else txt=new TextDecoder().decode(u8)
    const dd=JSON.parse(txt);if(dd.app!=='artapedia-id'||!Array.isArray(dd.entries))throw Error('Bukan file backup Artapedia ID: '+f.name)
    all=all.concat(dd.entries.filter(x=>x&&typeof x.k==='string'&&'v' in x))}
   if(!all.length)throw Error('File tidak berisi data')
   if(imode==='replace'){
    // backup pengaman diminta TERPISAH (bisa lama), baru data dihapus; kalau pengaman gagal, tanya dulu
    setBs('Membuat backup pengaman ke Telegram…')
    const sf=await C('backup/now',{});let lanjut=true
    if(sf.error||sf.ok===false)lanjut=confirm('Backup pengaman ke Telegram gagal ('+(sf.error||'cek pengaturan Telegram di Admin > Integrasi')+').\n\nLanjut ganti total TANPA backup pengaman? Pastikan kamu sudah menyimpan backup sendiri.')
    if(!lanjut){setBs('Dibatalkan. Tidak ada data yang diubah.');setBusy('');return}
    setBs('Menghapus data lama…');const w=await C('backup/wipe',{confirm:'HAPUS',safety:false});if(w.error)throw Error(w.error)}
   // batas ukuran per kiriman dalam BYTE (batas fungsi server ±4,5MB; JSON menambah escape), data raksasa dipecah per potongan
   const LIM=1000000,PIECE=500000;let batch=[],sz=0,done=0
   const flush=async()=>{if(!batch.length)return;const r=await callB('backup/import',{items:batch});if(r.error)throw Error(r.error);done+=batch.length;batch=[];sz=0;setBs('Mengimpor… '+done+'/'+all.length)}
   for(const en of all){const s=JSON.stringify(en.v),n=bytes(s)
    if(n>LIM){await flush();for(let o=0;o<s.length;o+=PIECE){const r=await callB('backup/import',{items:[{k:en.k,part:{o,total:s.length,s:s.slice(o,o+PIECE)}}]});if(r.error)throw Error(r.error)}done++;setBs('Mengimpor… '+done+'/'+all.length);continue}
    if(sz+n>LIM)await flush();batch.push({k:en.k,v:en.v});sz+=n+en.k.length+12}
   await flush();setBs('Merapikan daftar pengguna…');const ri=await callB('backup/reindex',{})
   setBs('Selesai: '+all.length+' data dipulihkan'+(ri&&!ri.error?' · '+ri.users+' pengguna':''));alert('Impor selesai ('+all.length+' data).');loadBots()
  }catch(er){alert('Gagal: '+er.message);setBs('')}
  setBusy('')}

 // ----------------------------------------------------------------- clean
 const jalan=async dry=>{
  let state=null,gagal=0;const ctl={bud:25000}
  for(let n=0;n<1500;n++){
   const r=await C('kelola/clean',{state,dry,budget:ctl.bud})
   if(r.error){
    // server kehabisan waktu / koneksi putus: ulangi langkah yang sama dengan beban lebih kecil (langkah aman diulang)
    if((r.timeout||r.net)&&gagal<8){gagal++;ctl.bud=Math.max(3000,Math.floor(ctl.bud/2));setClMsg(`⏳ Server lambat, mengulang dengan beban lebih kecil (${gagal}/8)…`);await sleep(800*gagal);continue}
    throw Error(r.error)}
   gagal=0;state=r.state
   setClMsg((dry?'🔍 Memeriksa':'🧹 Membersihkan')+'… '+(+state.scanned||0).toLocaleString('id-ID')+' data dipindai · tahap '+({tx:'riwayat transaksi',junk:'sampah web',orphan:'data yatim',idx:'indeks',done:'selesai'}[state.stage]||state.stage))
   if(r.done)return r.stats}
  throw Error('Terlalu lama, coba lagi')}
 const LBL=[['orderBatal','Order dibatalkan'],['orderKadaluarsa','Order kedaluwarsa'],['orderGagal','Order gagal'],['pendingMacet','Order macet/bermasalah (direfund dulu)'],
  ['depositGagal','Deposit gagal'],['depositBatal','Deposit dibatalkan'],['depositKadaluarsa','Deposit kedaluwarsa (>24 jam)'],
  ['sessions','Sesi login lama'],['tokens','Token kedaluwarsa'],['jobs','Antrean/broadcast lama'],['states','Status bot kosong'],['counters','Penghitung rate-limit/login lama'],['orphans','Data yatim (pemilik sudah dihapus)'],['idx','Indeks pengguna rusak']]
 const ringkas=s=>LBL.filter(([k])=>s[k]>0).map(([k,l])=>`• ${l}: ${(+s[k]).toLocaleString('id-ID')}`).join('\n')
 const clean=async()=>{
  setBusy('cl');setCl(null);setClMsg('🔍 Memeriksa dulu apa saja yang akan dibersihkan…')
  try{const pre=await jalan(true),jml=LBL.reduce((a,[k])=>a+(+pre[k]||0),0)
   if(!jml){setClMsg('✅ Sudah bersih, tidak ada yang perlu dihapus.'+(pre.ditahan?` (${pre.ditahan} order batal belum refund ditahan demi keamanan)`:''));setCl(pre);setBusy('');return}
   const ok=confirm(`Ditemukan ${jml.toLocaleString('id-ID')} item untuk dibersihkan:\n\n${ringkas(pre)}\n\nSaldo, mutasi saldo, order sukses, dan deposit sukses TIDAK disentuh.\nDisarankan unduh backup dulu. Lanjut hapus?`)
   if(!ok){setClMsg('Dibatalkan. Tidak ada yang dihapus.');setCl(pre);setBusy('');return}
   const s=await jalan(false);setCl(s);setClMsg('✅ Clean selesai.')
  }catch(e){setClMsg('❌ '+e.message)}
  setBusy('')}

 const T=bots&&bots.total
 return <>
  <div className="card"><h3>🧰 Kelola</h3>
   <p className="muted" style={{marginBottom:0}}>Pusat perawatan: lihat saldo semua server nokos, kelola bot reseller (hapus massal, termasuk yang untungnya Rp0), unduh backup &amp; pulihkan semua data, dan bersihkan transaksi gagal serta sampah web.</p></div>

  <div className="card"><h3>💰 Saldo server nokos</h3>
   {sal&&<div className="bk-grid">{sal.accounts.map(a=><div key={a.id}><small>{a.name}{a.who?' · '+a.who:''}</small><span>{a.ok?rp(a.balance):'—'}</span>{!a.ok&&<small className="muted">{a.error}</small>}</div>)}
    <div><small>Total semua akun</small><span>{rp(sal.total)}</span></div></div>}
   {sal&&<div className="kl-wrap"><table className="kl-tb"><thead><tr><th>Server</th><th>Penyedia</th><th>Akun</th><th>Saldo</th><th>Status</th></tr></thead><tbody>
    {sal.servers.map(x=><tr key={x.server}><td><b>{x.name}</b><br/><small className="muted">{x.server}</small></td><td>{x.provider}</td><td>{x.account}</td>
     <td className="n">{x.ok?rp(x.balance):'—'}</td>
     <td>{x.ok?(x.balance<50000?<span className="ud-pill wait">Menipis</span>:<span className="ud-pill ok">Aman</span>):<span className="ud-pill no" title={x.error}>Gagal cek</span>}{!x.ok&&x.error&&<><br/><small className="muted">{x.error}</small></>}</td></tr>)}</tbody></table></div>}
   <p className="muted">Server dari penyedia yang sama memakai <b>satu saldo akun</b> (WarungNokos: Plus, Express, Lite · Dibanana: 4 server), jadi angkanya sama dan <b>tidak dijumlahkan dua kali</b> di “Total semua akun”. “Menipis” = di bawah Rp50.000.{sal&&sal.at?' Dicek '+new Date(sal.at).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB.':''}</p>
   <div className="tabs"><button className="btn blue" disabled={!!salMsg} onClick={loadSal}>{salMsg?'Mengecek…':'🔄 Cek saldo sekarang'}</button></div>
   {salMsg&&<div className="ud-msg" style={{marginTop:10}}>{salMsg}</div>}</div>

  <div className="card"><h3>🏪 Bot reseller ({bots?bots.total.bots:'…'})</h3>
   {T&&<div className="bk-grid"><div><small>Total bot</small><span>{T.bots}</span></div><div><small>Pelanggan semua bot</small><span>{T.cust}</span></div><div><small>Pesanan sukses lewat bot</small><span>{T.ok}</span></div><div><small>Tanpa penggunaan sama sekali</small><span>{T.unused}</span></div><div><small>Untung Rp0</small><span>{T.zero}</span></div></div>}
   <div className="kl-bar">
    <label>Filter<select value={flt} onChange={e=>setFlt(e.target.value)}><option value="all">Semua bot</option><option value="top">Penggunaan terbanyak</option><option value="unused">Tidak ada penggunaan sama sekali</option><option value="zero">Keuntungan Rp0</option></select></label>
    {flt==='top'&&<label>Tampilkan teratas<input type="number" min="0" value={topN} onChange={e=>setTopN(e.target.value)} style={{width:90}}/></label>}
    <label>Cari<input placeholder="toko / @bot / email owner" value={q} onChange={e=>setQ(e.target.value)}/></label>
    <label>Umur min. (hari) untuk hapus massal<input type="number" min="0" value={minDays} onChange={e=>setMinDays(e.target.value)} style={{width:90}}/></label></div>
   <p className="muted">“Tanpa penggunaan sama sekali” = tidak punya pelanggan, tidak ada pesanan, dan reseller belum pernah dapat untung. “Untung Rp0” = reseller belum pernah mendapat keuntungan (bisa saja sudah punya pelanggan). Menghapus bot mencabut webhook dan melepasnya dari daftar; saldo dompet reseller &amp; riwayat pelanggan <b>tidak</b> ikut hilang.</p>
   <div className="tabs">
    <button className="btn" disabled={!rows.length||!!busy} onClick={pickAll}>{allOn?'Batal pilih semua':`Pilih semua yang tampil (${rows.length})`}</button>
    <button className="btn red" disabled={!sel.size||!!busy} onClick={hapusPilih}>{busy==='del'?'Menghapus…':`🗑 Hapus terpilih (${sel.size})`}</button>
    <button className="btn red" disabled={!bots||!!busy} onClick={hapusKosong}>🧹 Hapus semua yang tanpa penggunaan ({aman.length})</button>
    <button className="btn red" disabled={!bots||!!busy} onClick={hapusNol}>💸 Hapus semua yang untung Rp0 ({nol.length})</button>
    <button className="btn" disabled={!!busy||!!load} onClick={loadBots}>🔄 Muat ulang</button></div>
   <label className="ad-ck"><input type="checkbox" checked={inclMoney} onChange={e=>setInclMoney(e.target.checked)}/> Untuk “untung Rp0”: sertakan juga bot yang dompet/stoknya masih berisi (saldo tetap aman di akun reseller)</label>
   {msg&&<div className="ud-msg" style={{marginTop:10}}>{msg}</div>}
   {load&&<p className="muted">{load}</p>}
   {!bots&&!load&&<p className="muted">Daftar bot belum termuat. Tekan “Muat ulang”.</p>}
   {bots&&!rows.length&&<p className="muted">Tidak ada bot untuk filter ini.</p>}
   {rows.length>0&&<div className="kl-wrap"><table className="kl-tb"><thead><tr><th/><th>Bot / toko</th><th>Pembuat</th><th>Pelanggan</th><th>Pesanan</th><th>Untung</th><th>Dompet</th><th>Umur</th><th>Status</th></tr></thead><tbody>
    {rows.map(x=><tr key={x.id} className={sel.has(x.id)?'on':''}>
     <td><input type="checkbox" aria-label={'Pilih '+x.username} checked={sel.has(x.id)} onChange={()=>toggle(x.id)}/></td>
     <td><b>{x.brand||'(tanpa nama)'}</b><br/><a href={'https://t.me/'+x.username} target="_blank" rel="noreferrer">@{x.username}</a> <small className="muted">· {x.mode==='mandiri'?'stok mandiri':'tanpa modal'}</small></td>
     <td>{x.ownerEmail||<span className="muted">-</span>}<br/><small className="muted">{x.ownerTg?'@'+x.ownerTg:''} {x.ownerTgId?'· '+x.ownerTgId:''}</small></td>
     <td className="n">{x.cust}</td>
     <td className="n">{x.ok}<small className="muted"> / {x.orders}</small><br/><small className="muted">{rp(x.spent)}</small></td>
     <td className="n">{x.zero?<span className="muted">Rp0</span>:rp(x.earn)}</td>
     <td className="n">{rp(x.balance)}{x.stok>0&&<><br/><small className="muted">stok {rp(x.stok)}</small></>}</td>
     <td className="n">{x.days} hr<br/><small className="muted">{dt(x.at)}</small></td>
     <td>{x.unused&&<span className="ud-pill wait">Tanpa penggunaan</span>} {x.zero&&!x.unused&&<span className="ud-pill wait">Untung Rp0</span>} {x.yatim&&<span className="ud-pill bad">Yatim</span>} {x.uang>0&&<span className="ud-pill tg">Ada saldo</span>} {x.tunggu>0&&<span className="ud-pill wait">Tarikan/isi menunggu</span>} <span className={'ud-pill '+(x.on?'ok':'no')}>{x.on?'Aktif':'Mati'}</span></td></tr>)}</tbody></table></div>}
  </div>

  <div className="card"><h3>💾 Backup, impor &amp; pulihkan</h3>
   <p className="muted">Tombol unduh membuat <b>satu file</b> berisi: email &amp; saldo semua pengguna, seluruh data bot reseller (siapa yang membuat bot, botnya, tokonya, dompet, dan <b>pelanggan masing-masing bot</b>), serta seluruh isi database (transaksi, deposit, pengaturan, dst) untuk memulihkan. File berisi data sensitif (API key, hash password, token bot) — simpan rahasia.</p>
   <div className="kl-bar"><label>Format<select value={fmt} onChange={e=>setFmt(e.target.value)}><option value="json">.json (bisa dibuka &amp; dibaca)</option><option value="gz">.json.gz (lebih kecil)</option></select></label></div>
   <div className="tabs"><button className="btn blue" disabled={!!busy} onClick={unduhBackup}>{busy==='bk'?'Memproses…':'⬇️ Unduh backup'}</button>
    <button className="btn" disabled={!!busy} onClick={unduhCsv}>{busy==='csv'?'Memproses…':'⬇️ Unduh email + saldo (CSV)'}</button></div>
   <div style={{marginTop:16}}><b style={{fontSize:14}}>⬆️ Impor / pulihkan dari file backup</b>
    <label className="ad-ck"><input type="radio" checked={imode==='merge'} onChange={()=>setImode('merge')}/> Gabungkan (data di file menimpa yang sama, data baru tetap aman)</label>
    <label className="ad-ck"><input type="radio" checked={imode==='replace'} onChange={()=>setImode('replace')}/> Ganti total (hapus semua data lalu pulihkan dari file)</label>
    <input type="file" multiple accept=".gz,.json,application/gzip,application/json" disabled={!!busy} onChange={impor}/>
    <p className="muted">Bisa memakai file dari tombol di atas, file dari menu Backup &amp; restore, atau file backup yang dikirim otomatis ke Telegram (.json.gz, boleh beberapa bagian sekaligus).</p></div>
   {bs&&<p><b>{bs}</b></p>}</div>

  <div className="card"><h3>🧹 Clean</h3>
   <p className="muted">Menghapus dari riwayat semua pengguna: transaksi <b>gagal, batal, kedaluwarsa</b>, dan <b>bermasalah</b> (order macet dilewati batas tunggu: direfund dulu lalu dihapus), plus <b>sampah database</b> (sesi login lama, token reset, antrean lama, penghitung rate-limit/login yang menumpuk, data yatim milik akun yang sudah dihapus, indeks rusak) — ini yang bikin MongoDB cepat penuh dan request ke Vercel membengkak. Deposit baru dihapus setelah 24 jam agar pembayaran telat masih bisa masuk. <b>Saldo, mutasi saldo, order sukses, dan deposit sukses tidak disentuh.</b> Sebelum menghapus, kamu akan melihat ringkasan dan diminta konfirmasi.</p>
   <div className="tabs"><button className="btn red" disabled={!!busy} onClick={clean}>{busy==='cl'?'Memproses…':'🧹 Clean'}</button></div>
   {clMsg&&<div className="ud-msg" style={{marginTop:10}}>{clMsg}</div>}
   {cl&&<div className="bk-isi"><b>Hasil terakhir</b><div className="bk-grid">{LBL.filter(([k])=>cl[k]>0).map(([k,l])=><div key={k}><small>{l}</small><span>{(+cl[k]).toLocaleString('id-ID')}</span></div>)}
    {cl.ditahan>0&&<div><small>Ditahan (belum refund)</small><span>{cl.ditahan}</span></div>}
    {!LBL.some(([k])=>cl[k]>0)&&<div><small>Hasil</small><span>Bersih</span></div>}</div></div>}</div>
 </>}
