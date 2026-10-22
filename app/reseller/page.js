'use client'
import {useState,useEffect,useCallback} from 'react'
import './reseller.css'
import Toast from '../../components/ui/Toast'
import Skeleton from '../../components/ui/Skeleton'
const api=async(p,b,m)=>{const r=await fetch('/api/'+p,{method:m||(b?'POST':'GET'),headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return r.json()}
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' WIB':'-'
const shrinkQ=f=>new Promise((res,rej)=>{const r=new FileReader();r.onerror=rej;r.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{for(const [m,q] of [[900,.82],[700,.7],[520,.6]]){const k=Math.min(1,m/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=im.width*k;cv.height=im.height*k;cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);const o=cv.toDataURL('image/jpeg',q);if(o.length<=300000)return res(o)}rej(new Error('big'))};im.src=r.result};r.readAsDataURL(f)})
const WST={success:['ok','🟢 Berhasil'],processing:['wait','🟡 Diproses'],failed:['no','🔴 Gagal']}

const TNC=[
 'Bot reseller adalah bot Telegram milikmu sendiri. Kamu yang memegang token dan bertanggung jawab penuh atas isinya.',
 'Harga jual ke pelangganmu = harga web utama + markup yang kamu tentukan. Mode TANPA MODAL: markup dalam Rupiah, bisa beda tiap server (mis. web Rp5.000 + markup Rp1.000 = Rp6.000), dan komisi cair HANYA saat OTP diterima — order gagal atau dibatalkan tidak mendapat komisi. Mode stok mandiri: markup dalam persen (0–100%). Deposit pelangganmu diproses otomatis lewat SMP Payment (QRIS dengan kode unik, saldo masuk otomatis begitu pembayaran terbaca).',
 'Kamu tidak perlu modal: uang pelanggan masuk lewat deposit di botmu, dan biaya nokos ditanggung platform.',
 'Mode TANPA MODAL: deposit pelanggan diproses otomatis lewat SMP Payment, stok nokos ditanggung platform, dan kamu menerima komisi markup yang bisa ditarik otomatis.',
 'Khusus mode TANPA MODAL: setiap deposit pelanggan botmu yang sukses memberimu komisi 5% dari nominal deposit (besarnya bisa diubah admin), langsung masuk saldo reseller dan bisa ditarik.',
 'Mode STOK MANDIRI: pelanggan membayar ke QRIS milikmu sendiri dan kamu yang menyetujui tiap bukti transfer. Setiap pesanan memotong SALDO STOK-mu sebesar harga platform. Saldo stok diisi lewat QRIS SMP Payment (masuk otomatis, tanpa upload bukti), atau dipindahkan dari saldo akun Artapedia-mu.',
 'Saldo stok tidak bisa ditarik sebagai uang tunai; gunanya hanya untuk membeli nokos dari platform. Pesanan yang direfund mengembalikan saldo stok.',
 'Saldo pelanggan botmu terpisah dari saldo akun web dan dari reseller lain.',
 'Penarikan keuntungan dilakukan otomatis lewat AustinPay ke e-wallet/bank tujuan. Penarikan gagal otomatis mengembalikan saldo.',
 'Kalau pesanan dibatalkan atau kedaluwarsa (refund ke pelanggan), bagian keuntunganmu untuk pesanan itu ikut ditarik kembali.',
 'Satu akun hanya boleh punya satu bot reseller.',
 'Dilarang memakai bot untuk penipuan, spam massal, atau hal yang melanggar hukum Indonesia maupun aturan Telegram. Pelanggaran membuat bot dinonaktifkan tanpa pemberitahuan.',
 'Program bonus deposit dan ajak teman milik platform tidak berlaku di dalam bot reseller.',
 'Kami boleh mengubah biaya, harga dasar, atau menghentikan layanan ini sewaktu-waktu dengan pemberitahuan di situs.']

export default function Reseller(){
 const [d,setD]=useState(),[msg,setMsg]=useState(''),[busy,setBusy]=useState('')
 const [setuju,setSetuju]=useState(false)
 const [f,setF]=useState({token:'',ownerId:'',username:'',ownerUser:'',markup:'5',mkFlat:'1000',brand:'',chId:'',chUser:'',mode:'komisi',lang:'id'})
  const [bill,setBill]=useState(null)
 const [stok,setStok]=useState(''),[qr,setQr]=useState({img:'',name:'',note:''}),[lang,setLang]=useState('id'),[rate,setRate]=useState('')
 const [mkd,setMkd]=useState(''),[mkv,setMkv]=useState({}),[mk,setMk]=useState(''),[ch,setCh]=useState({id:'',user:''})
 const [w,setW]=useState({wallet:'',product_code:'',phone:'',nominal:''})
 const [wal,setWal]=useState([]),[prd,setPrd]=useState([])
 const load=useCallback(async()=>{const r=await api('v1/reseller');if(r.error){setD(null);return}setD(r);setMk(String(r.markup));setCh({id:(r.ch&&r.ch.id)||'',user:(r.ch&&r.ch.user)||''})
  setLang(r.lang||'id');setRate(String(r.rate||''));setQr({img:(r.qris&&r.qris.img)||'',name:(r.qris&&r.qris.name)||'',note:(r.qris&&r.qris.note)||''})},[])
 useEffect(()=>{load()},[load])
 // Tagihan stok SMP yang sedang dibuka dicek tiap 4 detik (hanya membaca penanda lunas dari callback, ringan).
 useEffect(()=>{
  if(!bill||bill.status!=='menunggu')return
  let stop=false
  const t=setInterval(async()=>{
   if(stop||document.hidden)return
   const r=await api('v1/reseller/stok/check',{id:bill.id}).catch(()=>null)
   if(stop||!r||r.error||!r.hasil)return
   if(r.hasil.status!==bill.status){
    if(r.lunas&&r.markup!==undefined)setD(r)
    setBill(r.hasil)
    setMsg(r.lunas?'✅ Saldo stok masuk '+rp(r.hasil.amount):'Tagihan '+r.hasil.status)}},4000)
  return ()=>{stop=true;clearInterval(t)}},[bill&&bill.id,bill&&bill.status])
 // kalau mode yang terpilih sedang ditutup, pindah otomatis ke mode yang masih dibuka
 useEffect(()=>{const g=d&&d.reg;if(!g||d.bot)return;const ok=m=>g[m]&&g[m].accepting;if(!ok(f.mode)){const o=['komisi','mandiri'].find(ok);if(o)setF(x=>({...x,mode:o}))}},[d&&d.reg&&d.reg.komisi.accepting,d&&d.reg&&d.reg.mandiri.accepting])
 useEffect(()=>{if(!d||!d.bot)return;api('v1/reseller/wallets').then(r=>setWal((r&&(r.wallets||r.data))||[])).catch(()=>{})},[d&&!!d.bot])

 if(d===undefined)return <div className="rs"><Skeleton style={{height:200,borderRadius:26}}/>
  <div style={{marginTop:22}}><Skeleton style={{height:300,borderRadius:22}}/></div></div>
 if(!d){if(typeof window!=='undefined')location.href='/login';return <div className="rs"><p>Mengalihkan ke halaman masuk…</p></div>}

 const run=async(k,fn,ok)=>{setBusy(k);const r=await fn();setBusy('')
  if(r&&r.error){setMsg(r.error);return null}
  if(r&&r.markup!==undefined){setD(r);setMk(String(r.markup));setCh({id:(r.ch&&r.ch.id)||'',user:(r.ch&&r.ch.user)||''})}
  setMsg(ok);return r}
 const pickWallet=async v=>{setW({...w,wallet:v,product_code:'',nominal:''});setPrd([])
  if(!v)return;const r=await api('v1/reseller/products?wallet='+encodeURIComponent(v));setPrd((r&&r.products)||[])}
 const prod=prd.find(x=>String(x.code)===w.product_code)

 // ---------- belum setuju S&K ----------
 if(!d.tnc)return <div className="rs">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="rs-top"><a href="/dashboard">‹ Dashboard</a></div>
  <section className="rs-hero"><h1>Bot Reseller 🏪</h1>
   <p>Jualan nokos <b>tanpa modal</b>. Pakai bot Telegram milikmu sendiri, tentukan untungmu sendiri, dan tarik hasilnya otomatis ke e-wallet.</p></section>
  <div className="rs-sec"><h2>Syarat &amp; Ketentuan</h2><span/></div>
  <div className="rs-card">
   <p>Baca dulu sampai bawah, lalu centang persetujuan untuk membuka pendaftaran bot.</p>
   <ol className="rs-tnc">{TNC.map((t,i)=><li key={i}>{t}</li>)}</ol>
   <label className="rs-check"><input type="checkbox" checked={setuju} onChange={e=>setSetuju(e.target.checked)}/>
    <span>Saya sudah membaca dan menyetujui seluruh syarat &amp; ketentuan di atas.</span></label>
   <div className="rs-row"><button className="btn blue" disabled={!setuju||busy==='t'}
     onClick={()=>run('t',()=>api('v1/reseller/tnc',{}),'Syarat disetujui. Silakan daftarkan botmu.')}>
     {busy==='t'?'Menyimpan…':'Setuju & lanjut'}</button></div></div></div>

 // ---------- belum punya bot ----------
 // status pendaftaran per mode (diatur admin): '' = bisa daftar, selain itu alasan tertutup
 const rgx=m=>{const x=(d.reg||{})[m];return !x||x.accepting?'':(x.why==='penuh'?'SLOT PENUH':'DITUTUP')}
 // sisa slot bot per mode (dari pengaturan admin): "Sisa 37 dari 200 slot"
 const slotTxt=m=>{const x=(d.reg||{})[m];if(!x)return null;const fr=Math.max(0,+x.free||0);return {fr,tot:+x.slots||0,low:fr>0&&fr<=Math.max(5,Math.ceil((+x.slots||0)*.1)),none:fr<=0}}
 const Slot=({m})=>{const t=slotTxt(m);return t?<span className={'rs-slot'+(t.none?' none':t.low?' low':'')}>🎟️ Sisa slot: <b>{t.fr.toLocaleString('id-ID')}</b> dari {t.tot.toLocaleString('id-ID')}</span>:null}
 const semuaTutup=!!rgx('komisi')&&!!rgx('mandiri')
 if(!d.bot)return <div className="rs">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="rs-top"><a href="/dashboard">‹ Dashboard</a></div>
  <section className="rs-hero"><h1>Daftarkan Botmu 🤖</h1>
   <p>Buat bot di <b>@BotFather</b>, salin tokennya, lalu isi formulir ini. Webhook dipasang otomatis — setelah itu botmu langsung bisa jualan.</p></section>
  {semuaTutup&&<div className="rs-card"><b>🚪 Pendaftaran reseller sedang ditutup</b><p>Admin sedang menutup pendaftaran bot reseller baru (atau slotnya penuh). Silakan coba lagi nanti.</p></div>}
  <div className="rs-sec"><h2>Pilih cara jualan</h2><span/></div>
  <div className="rs-modes">
   <button type="button" disabled={rgx('komisi')} style={rgx('komisi')?{opacity:.5,cursor:'not-allowed'}:undefined} className={'rs-mode'+(f.mode==='komisi'?' on':'')} onClick={()=>setF({...f,mode:'komisi'})}>
    <span className="rs-mb">💸 TANPA MODAL{rgx('komisi')?' · '+rgx('komisi'):''}</span>
    <Slot m="komisi"/>
    <b>Jual nokos tanpa modal</b>
    <p>Saldo bisa ditarik otomatis. Semua stok ditanggung admin dan pembayaran pelanggan masuk ke admin — kamu dapat <b>komisi</b> setiap ada yang beli di botmu.</p>
    <small>✔ Tanpa modal · ✔ Tarik untung otomatis · ✔ Deposit pelanggan otomatis</small></button>
   <button type="button" disabled={rgx('mandiri')} style={rgx('mandiri')?{opacity:.5,cursor:'not-allowed'}:undefined} className={'rs-mode'+(f.mode==='mandiri'?' on':'')} onClick={()=>setF({...f,mode:'mandiri'})}>
    <span className="rs-mb">📦 STOK MANDIRI{rgx('mandiri')?' · '+rgx('mandiri'):''}</span>
    <Slot m="mandiri"/>
    <b>Jual nokos stok mandiri</b>
    <p>Pakai <b>QRIS kamu sendiri</b> — setiap deposit pelanggan masuk ke kantongmu. Kamu isi <b>saldo stok</b> untuk membeli nokos dari platform, untungnya lebih besar.</p>
    <small>✔ Untung lebih besar · ✔ Uang masuk ke QRIS-mu · ✔ Kamu yang ACC deposit</small></button></div>
  <div className="rs-sec"><h2>Bahasa bot</h2><span/></div>
  <div className="rs-card"><p>Bahasa yang dilihat pelanggan di botmu. Mata uang ikut bahasa yang dipilih.</p>
   <div className="rs-langs">{[['id','🇮🇩','Indonesia','Rp'],['ms','🇲🇾','Malaysia','RM'],['en','🇬🇧','English','$'],['ph','🇵🇭','Filipino','₱'],['th','🇹🇭','ไทย','฿'],['vi','🇻🇳','Tiếng Việt','₫']].map(([k,fl,nm,sym])=>
    <button type="button" key={k} className={'rs-lang'+(f.lang===k?' on':'')} onClick={()=>setF({...f,lang:k})}><i>{fl}</i><b>{nm}</b><small>{sym}</small></button>)}</div></div>
  <div className="rs-sec"><h2>Data bot</h2><span/></div>
  <div className="rs-card">
   <p>Butuh ID Telegram-mu? Kirim <b>/id</b> ke bot Artapedia, atau pakai @userinfobot.</p>
   <div className="rs-grid">
    <label className="rs-f"><span>Token bot (dari @BotFather)</span><input value={f.token} onChange={e=>setF({...f,token:e.target.value})} placeholder="123456789:AAH..." autoComplete="off"/></label>
    <label className="rs-f"><span>ID owner (angka)</span><input value={f.ownerId} onChange={e=>setF({...f,ownerId:e.target.value})} placeholder="123456789" inputMode="numeric"/></label>
    <label className="rs-f"><span>Username bot</span><input value={f.username} onChange={e=>setF({...f,username:e.target.value})} placeholder="tokonokos_bot"/></label>
    <label className="rs-f"><span>Username Telegram owner (buat CS)</span><input value={f.ownerUser} onChange={e=>setF({...f,ownerUser:e.target.value})} placeholder="namakamu"/></label>
    {f.mode==='mandiri'
     ?<label className="rs-f"><span>Markup / keuntungan (%)</span><input type="number" min="0" max="100" step="0.5" value={f.markup} onChange={e=>setF({...f,markup:e.target.value})}/></label>
     :<label className="rs-f"><span>Markup bawaan semua server (Rp)</span><input type="number" min="0" max="50000" step="100" value={f.mkFlat} onChange={e=>setF({...f,mkFlat:e.target.value})} placeholder="1000"/></label>}
    <label className="rs-f"><span>Nama toko / brand bot</span><input value={f.brand} onChange={e=>setF({...f,brand:e.target.value})} placeholder="Toko Nokos Andi" maxLength={32}/></label>
    <label className="rs-f"><span>ID channel notifikasi</span><input value={f.chId} onChange={e=>setF({...f,chId:e.target.value})} placeholder="-1001234567890" inputMode="numeric"/></label>
    <label className="rs-f"><span>Username channel (tanpa @)</span><input value={f.chUser} onChange={e=>setF({...f,chUser:e.target.value})} placeholder="tokonokosandi"/></label></div>
   <p className="rs-note">{f.mode==='mandiri'?'Contoh: harga platform Rp1.800 + markup 10% ⇒ pelangganmu bayar Rp1.980, untungmu Rp180 per nomor.':'Contoh: harga di web Rp5.000 + markup Rp1.000 ⇒ pelangganmu bayar Rp6.000, untungmu Rp1.000 per nomor — cair saat OTP diterima. Setelah daftar, markup bisa dibedakan per server.'}</p>
   <p className="rs-note"><b>Channel notifikasi (boleh dikosongkan):</b> tiap pesanan, OTP masuk, dan deposit pelanggan dikabarkan ke channel Telegram-mu. Buat channel, <b>jadikan botmu ADMIN di sana</b>, lalu ambil ID channelnya lewat @userinfobot.</p>
   <div className="rs-row"><button className="btn blue" disabled={busy==='b'||!!rgx(f.mode)}
     onClick={()=>run('b',()=>api('v1/reseller/bot',f),'Bot aktif! Buka botmu di Telegram lalu kirim /start.')}>
     {busy==='b'?'Memasang…':(rgx(f.mode)?'Pendaftaran mode ini '+rgx(f.mode).toLowerCase():'🚀 Buat bot reseller')}</button></div></div></div>

 // ---------- dashboard reseller ----------
 const bot=d.bot,hook=d.hook||{}
 return <div className="rs">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="rs-top"><a href="/dashboard">‹ Dashboard</a><a href={'https://t.me/'+bot.username} target="_blank" rel="noopener noreferrer">Buka bot ↗</a></div>
  <section className="rs-hero"><h1>{d.brand||'Toko Nokos'} 🏪</h1>
   <p>@{bot.username} · markup <b>{d.mode==='mandiri'?d.markup+'%':'Rp'+(+d.mkFlat||0).toLocaleString('id-ID')+(Object.keys(d.mkS||{}).length?' · per server':'')}</b> · CS @{bot.ownerUser}{ch.user?<> · channel @{ch.user}</>:ch.id?<> · channel aktif</>:<> · <b>channel belum diatur</b></>}</p>
   <div className="rs-kpi">
    {d.mode==='mandiri'
     ?<><div><small>Saldo stok</small><b>{rp(d.stok)}</b></div>
       <div><small>Deposit menunggu</small><b>{d.depWait||0}</b></div></>
     :<><div><small>Saldo bisa ditarik</small><b>{rp(d.balance)}</b></div>
       <div><small>Total untung</small><b>{rp(d.earn)}</b></div></>}
    <div><small>Nokos terjual</small><b>{d.sold||0}x</b></div>
    <div><small>Pelanggan</small><b>{d.cust||0}</b></div></div>
   <p className="rs-mbadge">{d.mode==='mandiri'?'📦 Mode stok mandiri':'💸 Mode tanpa modal'} · {(d.langs||[]).find(L=>L.k===d.lang)?.flag||'🇮🇩'} {(d.langs||[]).find(L=>L.k===d.lang)?.name||'Indonesia'}</p></section>

  <div className="rs-sec"><h2>Bot kamu</h2><span/></div>
  <div className="rs-card"><div className="rs-bot">
    <span className="rs-ava">🤖</span>
    <div style={{flex:1,minWidth:0}}><b style={{fontSize:17}}>{bot.name}</b>
     <small style={{display:'block',color:'#5a6a86'}}>@{bot.username} · dibuat {dt(bot.at)}</small></div>
    <span className={'rs-pill '+(hook.ok?'ok':'no')}>{hook.ok?'Webhook aktif':'Webhook mati'}</span></div>
   {hook.error&&<p className="rs-note" style={{color:'#d23'}}>Error terakhir dari Telegram: {hook.error}</p>}
   {/* Banner diatur dari dalam bot karena fotonya langsung diunggah ke Telegram (instan, tanpa upload ulang tiap kirim). */}
   <div className="rs-tip"><b>🖼 Ganti banner /start</b>
    <p>Buka botmu di Telegram → <b>/start</b> → <b>🏪 Panel Toko</b> → <b>🖼 Banner Bot</b>, lalu kirim foto/video/GIF-nya. Itu yang dilihat pelangganmu paling atas saat membuka bot. Kirim tanda <code>-</code> untuk kembali ke banner bawaan.</p>
    <a className="btn sil" href={'https://t.me/'+bot.username} target="_blank" rel="noopener noreferrer">Buka bot &amp; atur banner ↗</a></div>
   <div className="rs-row">
    <button className="btn sil" disabled={busy==='r'} onClick={()=>run('r',()=>api('v1/reseller/refresh',{}),'Webhook disegarkan')}>🔄 Segarkan webhook</button>
    <button className="btn red" disabled={busy==='x'} onClick={()=>confirm('Hapus bot reseller? Webhook dicabut dan pelangganmu tidak bisa memesan lagi. Saldo keuntunganmu tetap aman.')&&run('x',()=>api('v1/reseller/bot/del',{}),'Bot dihapus')}>🗑 Hapus bot</button></div></div>

  {/* ---------- mode mandiri: saldo stok, QRIS sendiri, ACC deposit ---------- */}
  {d.mode==='mandiri'&&<>
   <div className="rs-sec"><h2>Stok mandiri</h2><span/></div>
   <div className="rs-card"><h3>📦 Saldo stok</h3>
    <p>Setiap pelanggan membeli nokos di botmu, <b>harga platform</b> dipotong dari saldo stok ini. Uang pelanggan sudah masuk ke QRIS-mu, jadi selisihnya langsung jadi untungmu.</p>
    <div className="rs-kpi" style={{margin:'10px 0'}}>
     <div><small>Saldo stok</small><b>{rp(d.stok)}</b></div>
     <div><small>Saldo akun web</small><b>{rp(d.webBal||0)}</b></div>
     <div><small>Deposit menunggu ACC</small><b>{d.depWait||0}</b></div></div>
    <div className="rs-grid">
     <label className="rs-f"><span>Nominal (Rp)</span><input type="number" min="1000" step="1000" value={stok} onChange={e=>setStok(e.target.value)} placeholder="50000"/></label></div>
    <div className="rs-row">
     <button className="btn blue" disabled={busy==='sd'} onClick={async()=>{const n=Math.floor(+stok||0);if(!(n>=10000))return setMsg('❌ Minimal Rp10.000')
      const r=await run('sd',()=>api('v1/reseller/stok/req',{amount:n}),'Tagihan dibuat. Scan QRIS lalu bayar sesuai total.');if(r&&r.hasil){setBill(r.hasil);load()}}}>💳 Bayar QRIS</button>
     <button className="btn sil" disabled={busy==='sk'} onClick={()=>run('sk',()=>api('v1/reseller/stok',{amount:stok}),'Saldo stok ditambah')}>➕ Dari saldo akun</button>
     <button className="btn sil" disabled={busy==='sk2'} onClick={()=>run('sk2',()=>api('v1/reseller/stok',{amount:stok,kind:'tarik'}),'Dipindahkan ke saldo akun')}>➖ Tarik ke saldo akun</button></div>
    <p className="rs-note"><b>Bayar QRIS</b> = scan QRIS SMP Payment dan bayar tepat sesuai total (nominal + kode unik). Saldo stok masuk <b>otomatis</b>, tanpa upload bukti dan tanpa menunggu admin. <b>Dari saldo akun</b> memindahkan saldo Artapedia-mu yang sudah ada.</p>
    {(d.sreq||[]).length>0&&<div className="rs-bills">
     <b>Tagihan isi saldo stok</b>
     {(d.sreq||[]).slice(0,6).map(x=><div key={x.id} className="rs-bill">
      <span>{rp(x.amount)}<small>{x.id} · {dt(x.at)}</small></span>
      <span style={{display:'flex',gap:8,alignItems:'center'}}>
       {x.via==='smp'&&x.status==='menunggu'&&<button className="btn blue" onClick={()=>setBill(x)}>Bayar</button>}
       <span className={'rs-pill '+(x.status==='diterima'?'ok':(x.status==='menunggu'?'wait':'no'))}>{x.status}</span></span>
     </div>)}
     <p className="rs-note" style={{margin:'8px 0 0'}}>Tagihan <b>menunggu</b> masuk otomatis begitu pembayaranmu terbaca (biasanya 1-3 menit).</p></div>}</div>

   <div className="rs-card"><h3>🧾 QRIS pembayaran kamu</h3>
    <p>Pelanggan botmu membayar ke QRIS ini. Setelah mereka mengirim bukti transfer, kamu yang menekan <b>Terima</b> di bot (menu <b>Panel Toko › Deposit Masuk</b>) lalu saldo mereka bertambah.</p>
    <div className="rs-qr">
     <div className="rs-qr-pv">{qr.img?<img src={qr.img} alt="QRIS"/>:<span>Belum ada QRIS</span>}</div>
     <div className="rs-qr-b">
      <label className="btn sil">📁 Unggah gambar QRIS<input type="file" accept="image/*" hidden onChange={async e=>{const fl=e.target.files[0];e.target.value='';if(!fl)return
       try{setQr({...qr,img:await shrinkQ(fl)})}catch(x){setMsg('❌ Gambar tidak bisa dipakai / terlalu besar')}}}/></label>
      {qr.img&&<button className="btn red" onClick={()=>setQr({...qr,img:''})}>Hapus gambar</button>}</div></div>
    <div className="rs-grid">
     <label className="rs-f"><span>Nama penerima</span><input value={qr.name} onChange={e=>setQr({...qr,name:e.target.value})} placeholder="BUDI OTP STORE" maxLength={40}/></label>
     <label className="rs-f"><span>Catatan untuk pelanggan</span><input value={qr.note} onChange={e=>setQr({...qr,note:e.target.value})} placeholder="Transfer sesuai nominal, lalu kirim bukti" maxLength={160}/></label></div>
    <div className="rs-row"><button className="btn blue" disabled={busy==='qr'} onClick={()=>run('qr',()=>api('v1/reseller/qris',qr),'QRIS disimpan')}>Simpan QRIS</button></div></div>

   {(d.dep||[]).length>0&&<div className="rs-card"><h3>📥 Bukti transfer pelanggan</h3>
    <table className="rs-tb"><thead><tr><th>Pelanggan</th><th>Nominal</th><th>Status</th><th/></tr></thead><tbody>
     {(d.dep||[]).slice(0,12).map(x=><tr key={x.id}>
      <td>{x.nama||x.tgId}<small>{dt(x.at)}</small></td><td>{rp(x.amount)}</td>
      <td><span className={'rs-pill '+(x.status==='diterima'?'ok':x.status==='ditolak'?'no':'wait')}>{x.status}</span></td>
      <td>{x.status==='menunggu'&&<span className="rs-row" style={{margin:0}}>
       <button className="btn blue" disabled={!!busy} onClick={()=>run('d'+x.id,()=>api('v1/reseller/dep',{id:x.id,ok:true}),'Deposit diterima')}>Terima</button>
       <button className="btn red" disabled={!!busy} onClick={()=>run('n'+x.id,()=>api('v1/reseller/dep',{id:x.id,ok:false}),'Deposit ditolak')}>Tolak</button></span>}</td></tr>)}
    </tbody></table></div>}</>}

  {bill&&<div className="rs-qrwrap" onClick={e=>e.target===e.currentTarget&&setBill(null)}>
   <div className="rs-qrbox">
    <button className="rs-qrx" onClick={()=>setBill(null)} aria-label="Tutup">✕</button>
    <h3>💳 Isi saldo stok {rp(bill.amount)}</h3>
    {bill.status==='diterima'
     ?<p className="rs-note" style={{marginTop:10}}>✅ <b>Saldo stok masuk.</b> Saldo stokmu sekarang <b>{rp(d.stok)}</b>.</p>
     :bill.status!=='menunggu'
      ?<p className="rs-note" style={{marginTop:10}}>Tagihan ini <b>{bill.status}</b>. Buat tagihan baru kalau masih mau mengisi saldo stok.</p>
      :<>
       <div className="rs-qrimg"><img alt="QRIS" src={bill.qrImg||('https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data='+encodeURIComponent(bill.qr||''))}/></div>
       <div className="rs-qrinfo">
        <div><small>Nominal</small><b>{rp(bill.amount)}</b></div>
        {bill.fee>0&&<div><small>Kode unik</small><b>{rp(bill.fee)}</b></div>}
        <div><small>Total bayar</small><b>{rp(bill.total)}</b></div></div>
       <p className="rs-note" style={{marginTop:10}}>Scan dengan e-wallet / m-banking apa saja dan bayar <b>tepat {rp(bill.total)}</b>. Saldo stok masuk otomatis begitu pembayaran terbaca. Halaman ini mengecek sendiri tiap beberapa detik. Batas bayar {dt(bill.expMs)}.</p></>}
    <div className="rs-row">
     {bill.status==='menunggu'&&<button className="btn blue" disabled={busy==='cek'} onClick={()=>run('cek',async()=>{const r=await api('v1/reseller/stok/check',{id:bill.id});if(r&&r.hasil){if(r.lunas&&r.markup!==undefined)setD(r);setBill(r.hasil)};return r},'Dicek. Kalau sudah bayar, tunggu 1-3 menit.')}>✅ Saya sudah bayar</button>}
     {bill.status==='menunggu'&&<button className="btn red" disabled={busy==='bt'} onClick={()=>run('bt',async()=>{const r=await api('v1/reseller/stok/cancel',{id:bill.id});if(r&&r.hasil)setBill(r.hasil);return r},'Tagihan dibatalkan')}>Batalkan</button>}
     <button className="btn sil" onClick={()=>setBill(null)}>Tutup</button></div>
   </div></div>}

  <div className="rs-sec"><h2>Bahasa &amp; mata uang</h2><span/></div>
  <div className="rs-card"><h3>🌐 Bahasa bot</h3>
   <p>Bahasa yang dilihat pelanggan. Harga otomatis ditulis dalam mata uang bahasa itu (kursnya bisa kamu atur sendiri).</p>
   <div className="rs-langs">{(d.langs||[]).map(L=>
    <button type="button" key={L.k} className={'rs-lang'+(lang===L.k?' on':'')} onClick={()=>setLang(L.k)}><i>{L.flag}</i><b>{L.name}</b><small>{L.sym}</small></button>)}</div>
   <div className="rs-grid" style={{marginTop:10}}>
    <label className="rs-f"><span>1 {(d.langs||[]).find(L=>L.k===lang)?.cur||'IDR'} = berapa Rupiah</span>
     <input type="number" min="0" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} placeholder={String((d.langs||[]).find(L=>L.k===lang)?.rate||1)}/></label></div>
   <div className="rs-row"><button className="btn blue" disabled={busy==='lg'} onClick={()=>run('lg',()=>api('v1/reseller/lang',{lang,rate}),'Bahasa disimpan')}>Simpan bahasa</button></div>
   <p className="rs-note">Kosongkan kurs untuk memakai kurs bawaan. Harga di dalam sistem tetap Rupiah — bahasa hanya mengubah tampilan.</p></div>

  <div className="rs-sec"><h2>Keuntungan &amp; toko</h2><span/></div>
  {d.mode!=='mandiri'&&<div className="rs-card"><h3>💹 Markup per server (Rp)</h3>
   <p>Harga pelanggan = <b>harga web utama + markup Rp</b> kamu. Contoh: web Rp5.000 + Rp1.000 = Rp6.000. Atur beda tiap server. <b>Komisi cair hanya saat OTP diterima</b> — order gagal, dibatalkan, atau kedaluwarsa tidak mendapat komisi.</p>
   <div className="rs-grid">
    <label className="rs-f"><span>Bawaan semua server (Rp) — menimpa pengaturan per server</span><input type="number" min="0" max={d.mkMax||50000} step="100" value={mkd!==''?mkd:d.mkFlat} onChange={e=>setMkd(e.target.value)}/></label>
    {(d.servers||[]).map(s=><label key={s.server} className="rs-f"><span>{s.name}</span><input type="number" min="0" max={d.mkMax||50000} step="100" value={mkv[s.server]!==undefined?mkv[s.server]:((d.mkS||{})[s.server]!==undefined?d.mkS[s.server]:(mkd!==''?mkd:d.mkFlat))} onChange={e=>setMkv({...mkv,[s.server]:e.target.value})}/></label>)}</div>
   <div className="rs-row"><button className="btn blue" disabled={busy==='m'} onClick={()=>run('m',async()=>{let r=null
     if(mkd!==''&&String(mkd)!==String(d.mkFlat)){r=await api('v1/reseller/markup',{server:'all',rp:mkd});if(r&&r.error)return r}
     for(const [sv,val] of Object.entries(mkv)){if(val===''||String(val)===String((d.mkS||{})[sv]))continue;r=await api('v1/reseller/markup',{server:sv,rp:val});if(r&&r.error)return r}
     setMkd('');setMkv({});return r||await api('v1/reseller')},'Markup disimpan')}>Simpan markup</button></div></div>}
  <div className="rs-card"><h3>🏪 {d.mode==='mandiri'?'Markup & nama toko':'Nama toko'}</h3>
   <div className="rs-grid">
    {d.mode==='mandiri'&&<label className="rs-f"><span>Markup (%)</span><input type="number" min="0" max="100" step="0.5" value={mk} onChange={e=>setMk(e.target.value)}/></label>}
    <label className="rs-f"><span>Nama toko</span><input defaultValue={d.brand} onBlur={e=>e.target.value!==d.brand&&run('br',()=>api('v1/reseller/brand',{brand:e.target.value}),'Nama toko disimpan')} maxLength={32}/></label></div>
   {d.mode==='mandiri'&&<div className="rs-row"><button className="btn blue" disabled={busy==='m'} onClick={()=>run('m',()=>api('v1/reseller/markup',{markup:mk}),'Markup disimpan')}>Simpan markup</button></div>}</div>

  <div className="rs-sec"><h2>Channel notifikasi</h2><span/></div>
  <div className="rs-card"><h3>📣 Channel transaksi</h3>
   <p>Tiap <b>pesanan baru</b>, <b>OTP masuk</b>, dan <b>deposit pelanggan</b> dikabarkan ke channel Telegram-mu. Nomor dan nama pembeli disamarkan supaya aman dipajang di channel publik.</p>
   <p className="rs-note" style={{marginTop:0}}>Syaratnya: botmu <b>@{bot.username}</b> harus dijadikan <b>admin</b> di channel itu. Ambil ID channel lewat @userinfobot (biasanya diawali <code>-100</code>).</p>
   <div className="rs-grid">
    <label className="rs-f"><span>ID channel</span><input value={ch.id} onChange={e=>setCh({...ch,id:e.target.value})} placeholder="-1001234567890" inputMode="numeric"/></label>
    <label className="rs-f"><span>Username channel (tanpa @)</span><input value={ch.user} onChange={e=>setCh({...ch,user:e.target.value})} placeholder="tokonokosandi"/></label></div>
   <div className="rs-row">
    <button className="btn blue" disabled={busy==='ch'} onClick={()=>run('ch',()=>api('v1/reseller/channel',{chId:ch.id,chUser:ch.user}),'Channel disimpan')}>Simpan channel</button>
    <button className="btn sil" disabled={busy==='ct'||!ch.id} onClick={()=>run('ct',()=>api('v1/reseller/channel/test',{}),'Pesan tes terkirim ke channel')}>🔔 Tes kirim</button>
    {ch.user&&<a className="btn sil" href={'https://t.me/'+ch.user} target="_blank" rel="noopener noreferrer">Buka channel ↗</a>}</div></div>

  {/* Mode stok mandiri tidak punya dompet komisi, jadi tidak ada menu tarik saldo sama sekali. */}
  {d.mode!=='mandiri'&&<>
  <div className="rs-sec"><h2>Tarik saldo (otomatis)</h2><span/></div>
  <div className="rs-card"><h3>🏧 Penarikan lewat AustinPay</h3>
   <p>Dana dikirim otomatis ke e-wallet / bank tujuan. Minimal {rp(d.wdMin||10000)}. Kalau gagal, saldomu kembali utuh.</p>
   <div className="rs-grid">
    <label className="rs-f"><span>Dompet tujuan</span>
     <select value={w.wallet} onChange={e=>pickWallet(e.target.value)}>
      <option value="">— pilih —</option>
      {wal.map(x=><option key={x.code||x} value={x.code||x}>{x.name||x.code||x}</option>)}</select></label>
    <label className="rs-f"><span>Produk</span>
     <select value={w.product_code} onChange={e=>setW({...w,product_code:e.target.value,nominal:''})} disabled={!prd.length}>
      <option value="">— pilih —</option>
      {prd.map(x=><option key={x.code} value={x.code}>{x.name}{x.open_denom?' (bebas nominal)':' · '+rp(x.nominal)}</option>)}</select></label>
    <label className="rs-f"><span>Nomor / rekening tujuan</span><input value={w.phone} onChange={e=>setW({...w,phone:e.target.value})} placeholder="08123456789" inputMode="numeric"/></label>
    {prod&&prod.open_denom&&<label className="rs-f"><span>Nominal (Rp)</span><input type="number" value={w.nominal} onChange={e=>setW({...w,nominal:e.target.value})} placeholder="50000"/></label>}</div>
   {prod&&<p className="rs-note">Dipotong dari saldo: <b>{rp(prod.open_denom?(+w.nominal||0)+(+prod.fee||0):+prod.sell_price||0)}</b>{prod.open_denom&&+prod.fee>0?` (nominal + biaya ${rp(prod.fee)})`:''}</p>}
   <div className="rs-row"><button className="btn blue" disabled={busy==='w'||!w.product_code||!w.phone}
     onClick={()=>run('w',()=>api('v1/reseller/withdraw',w),'Penarikan diproses')}>{busy==='w'?'Memproses…':'Tarik sekarang'}</button></div></div>

  </>}
  {/* Mode stok mandiri: tidak ada riwayat penarikan maupun mutasi keuntungan. */}
  {d.mode!=='mandiri'&&<>
  <div className="rs-sec"><h2>Riwayat</h2><span/></div>
  <div className="rs-card"><h3>🏧 Penarikan</h3>
   {!(d.wd||[]).length?<div className="rs-empty">Belum ada penarikan.</div>
   :<div className="rs-list">{d.wd.map(x=>{const [c,l]=WST[x.status]||['wait',x.status]
     return <div key={x.id} className="rs-li"><span style={{flex:1,minWidth:0}}><b>{rp(x.nominal)} · {x.wallet}</b><small>{x.phone} · {dt(x.at)}{x.msg?' · '+x.msg:''}</small></span>
      <span className={'rs-pill '+c}>{l}</span></div>})}</div>}</div>
  <div className="rs-card"><h3>📈 Mutasi keuntungan</h3>
   {!(d.log||[]).length?<div className="rs-empty">Belum ada pemasukan. Ajak pelanggan pertamamu!</div>
   :<div className="rs-list">{d.log.map((x,i)=><div key={i} className="rs-li">
     <span style={{flex:1,minWidth:0}}><b style={{color:x.amt>=0?'#15803d':'#be123c'}}>{x.amt>=0?'+':'−'}{rp(Math.abs(x.amt))}</b><small>{x.note} · {dt(x.at)}</small></span>
     <span className="rs-pill">{rp(x.bal)}</span></div>)}</div>}</div>
  </>}
 </div>}
