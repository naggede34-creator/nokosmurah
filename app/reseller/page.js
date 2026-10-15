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
 'Harga jual ke pelangganmu = harga platform + markup yang kamu tentukan (0–100%). Selisihnya menjadi keuntunganmu dan langsung masuk ke dompet reseller setiap ada pesanan berhasil. Deposit pelangganmu diproses otomatis lewat Ditznesia atau AustinPay (dipilih acak), jadi kalau satu gateway sedang gangguan, yang lain tetap jalan.',
 'Kamu tidak perlu modal: uang pelanggan masuk lewat deposit di botmu, dan biaya nokos ditanggung platform.',
 'Mode TANPA MODAL: deposit pelanggan diproses otomatis lewat Ditznesia atau AustinPay (acak), stok nokos ditanggung platform, dan kamu menerima komisi markup yang bisa ditarik otomatis.',
 'Mode STOK MANDIRI: pelanggan membayar ke QRIS milikmu sendiri dan kamu yang menyetujui tiap bukti transfer. Setiap pesanan memotong SALDO STOK-mu sebesar harga platform. Saldo stok diisi lewat QRIS dengan rute acak Artapedia atau Ditznesia, atau dipindahkan dari saldo akun Artapedia-mu.',
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
 const [f,setF]=useState({token:'',ownerId:'',username:'',ownerUser:'',markup:'5',brand:'',chId:'',chUser:'',mode:'komisi',lang:'id'})
  const [bill,setBill]=useState(null)
 const [stok,setStok]=useState(''),[qr,setQr]=useState({img:'',name:'',note:''}),[lang,setLang]=useState('id'),[rate,setRate]=useState('')
 const [mk,setMk]=useState(''),[ch,setCh]=useState({id:'',user:''})
 const [w,setW]=useState({wallet:'',product_code:'',phone:'',nominal:''})
 const [wal,setWal]=useState([]),[prd,setPrd]=useState([])
 const load=useCallback(async()=>{const r=await api('v1/reseller');if(r.error){setD(null);return}setD(r);setMk(String(r.markup));setCh({id:(r.ch&&r.ch.id)||'',user:(r.ch&&r.ch.user)||''})
  setLang(r.lang||'id');setRate(String(r.rate||''));setQr({img:(r.qris&&r.qris.img)||'',name:(r.qris&&r.qris.name)||'',note:(r.qris&&r.qris.note)||''})},[])
 useEffect(()=>{load()},[load])
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
 if(!d.bot)return <div className="rs">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="rs-top"><a href="/dashboard">‹ Dashboard</a></div>
  <section className="rs-hero"><h1>Daftarkan Botmu 🤖</h1>
   <p>Buat bot di <b>@BotFather</b>, salin tokennya, lalu isi formulir ini. Webhook dipasang otomatis — setelah itu botmu langsung bisa jualan.</p></section>
  <div className="rs-sec"><h2>Pilih cara jualan</h2><span/></div>
  <div className="rs-modes">
   <button type="button" className={'rs-mode'+(f.mode==='komisi'?' on':'')} onClick={()=>setF({...f,mode:'komisi'})}>
    <span className="rs-mb">💸 TANPA MODAL</span>
    <b>Jual nokos tanpa modal</b>
    <p>Saldo bisa ditarik otomatis. Semua stok ditanggung admin dan pembayaran pelanggan masuk ke admin — kamu dapat <b>komisi</b> setiap ada yang beli di botmu.</p>
    <small>✔ Tanpa modal · ✔ Tarik untung otomatis · ✔ Deposit pelanggan otomatis</small></button>
   <button type="button" className={'rs-mode'+(f.mode==='mandiri'?' on':'')} onClick={()=>setF({...f,mode:'mandiri'})}>
    <span className="rs-mb">📦 STOK MANDIRI</span>
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
    <label className="rs-f"><span>Markup / keuntungan (%)</span><input type="number" min="0" max="100" step="0.5" value={f.markup} onChange={e=>setF({...f,markup:e.target.value})}/></label>
    <label className="rs-f"><span>Nama toko / brand bot</span><input value={f.brand} onChange={e=>setF({...f,brand:e.target.value})} placeholder="Toko Nokos Andi" maxLength={32}/></label>
    <label className="rs-f"><span>ID channel notifikasi</span><input value={f.chId} onChange={e=>setF({...f,chId:e.target.value})} placeholder="-1001234567890" inputMode="numeric"/></label>
    <label className="rs-f"><span>Username channel (tanpa @)</span><input value={f.chUser} onChange={e=>setF({...f,chUser:e.target.value})} placeholder="tokonokosandi"/></label></div>
   <p className="rs-note">Contoh: harga platform Rp1.800 + markup 10% ⇒ pelangganmu bayar Rp1.980, untungmu Rp180 per nomor.</p>
   <p className="rs-note"><b>Channel notifikasi (boleh dikosongkan):</b> tiap pesanan, OTP masuk, dan deposit pelanggan dikabarkan ke channel Telegram-mu. Buat channel, <b>jadikan botmu ADMIN di sana</b>, lalu ambil ID channelnya lewat @userinfobot.</p>
   <div className="rs-row"><button className="btn blue" disabled={busy==='b'}
     onClick={()=>run('b',()=>api('v1/reseller/bot',f),'Bot aktif! Buka botmu di Telegram lalu kirim /start.')}>
     {busy==='b'?'Memasang…':'🚀 Buat bot reseller'}</button></div></div></div>

 // ---------- dashboard reseller ----------
 const bot=d.bot,hook=d.hook||{}
 return <div className="rs">
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <div className="rs-top"><a href="/dashboard">‹ Dashboard</a><a href={'https://t.me/'+bot.username} target="_blank" rel="noopener noreferrer">Buka bot ↗</a></div>
  <section className="rs-hero"><h1>{d.brand||'Toko Nokos'} 🏪</h1>
   <p>@{bot.username} · markup <b>{d.markup}%</b> · CS @{bot.ownerUser}{ch.user?<> · channel @{ch.user}</>:ch.id?<> · channel aktif</>:<> · <b>channel belum diatur</b></>}</p>
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
     <button className="btn blue" disabled={busy==='sd'} onClick={()=>{const n=Math.floor(+stok||0);if(!(n>=10000))return setMsg('❌ Minimal Rp10.000');setBill({amount:n,proof:''})}}>💳 Bayar QRIS</button>
     <button className="btn sil" disabled={busy==='sk'} onClick={()=>run('sk',()=>api('v1/reseller/stok',{amount:stok}),'Saldo stok ditambah')}>➕ Dari saldo akun</button>
     <button className="btn sil" disabled={busy==='sk2'} onClick={()=>run('sk2',()=>api('v1/reseller/stok',{amount:stok,kind:'tarik'}),'Dipindahkan ke saldo akun')}>➖ Tarik ke saldo akun</button></div>
    <p className="rs-note"><b>Bayar QRIS</b> = transfer ke QRIS admin, unggah bukti transfernya, lalu admin menyetujui dan saldo stokmu bertambah. <b>Dari saldo akun</b> memindahkan saldo Artapedia-mu yang sudah ada.</p>
    {(d.sreq||[]).length>0&&<div className="rs-bills">
     <b>Permintaan isi saldo stok</b>
     {(d.sreq||[]).slice(0,6).map(x=><div key={x.id} className="rs-bill">
      <span>{rp(x.amount)}<small>{x.id} · {dt(x.at)}</small></span>
      <span className={'rs-pill '+(x.status==='diterima'?'ok':x.status==='ditolak'?'no':'wait')}>{x.status}</span>
     </div>)}
     <p className="rs-note" style={{margin:'8px 0 0'}}>Permintaan yang masih <b>menunggu</b> akan diperiksa admin. Saldo stok bertambah begitu admin menyetujui.</p></div>}</div>

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
    <div className="rs-qrimg"><img src={(d.adminQris&&d.adminQris.img)||'/qris-admin.png'} alt="QRIS admin" onError={e=>{if(e.currentTarget.src.indexOf('/qris-admin.png')<0)e.currentTarget.src='/qris-admin.png'}}/></div>
    {(d.adminQris&&(d.adminQris.name||d.adminQris.nmid))&&<div className="rs-qrinfo">
     {d.adminQris.name&&<div><small>Atas nama</small><b>{d.adminQris.name}</b></div>}
     {d.adminQris.nmid&&<div><small>NMID</small><b className="mono">{d.adminQris.nmid}</b></div>}</div>}
    <p className="rs-note" style={{marginTop:10}}>1) Scan QRIS di atas, transfer <b>{rp(bill.amount)}</b>. 2) Unggah foto bukti transfernya. 3) Admin memeriksa, lalu saldo stokmu bertambah.{d.adminQris&&d.adminQris.note?<> <i>{d.adminQris.note}</i></>:null}</p>
    <div className="rs-qr">
     <div className="rs-qr-pv">{bill.proof?<img src={bill.proof} alt="bukti"/>:<span>Belum ada bukti</span>}</div>
     <div className="rs-qr-b">
      <label className="btn sil">📁 Unggah bukti transfer<input type="file" accept="image/*" hidden onChange={async e=>{const fl=e.target.files[0];e.target.value='';if(!fl)return
       try{setBill({...bill,proof:await shrinkQ(fl)})}catch(x){setMsg('❌ Foto tidak bisa dipakai / terlalu besar')}}}/></label>
      {bill.proof&&<button className="btn red" onClick={()=>setBill({...bill,proof:''})}>Hapus foto</button>}</div></div>
    <div className="rs-row">
     <button className="btn blue" disabled={busy==='kirim'||!bill.proof} onClick={()=>run('kirim',async()=>{const r=await api('v1/reseller/stok/req',{amount:bill.amount,proof:bill.proof});if(!r.error)setBill(null);return r},'Bukti terkirim. Tunggu admin menyetujui.')}>📤 Kirim bukti</button>
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
  <div className="rs-card"><h3>💹 Markup</h3>
   <p>Markup ditambahkan di atas harga platform. Ubah kapan saja — harga di bot langsung ikut.</p>
   <div className="rs-grid">
    <label className="rs-f"><span>Markup (%)</span><input type="number" min="0" max="100" step="0.5" value={mk} onChange={e=>setMk(e.target.value)}/></label>
    <label className="rs-f"><span>Nama toko</span><input defaultValue={d.brand} onBlur={e=>e.target.value!==d.brand&&run('br',()=>api('v1/reseller/brand',{brand:e.target.value}),'Nama toko disimpan')} maxLength={32}/></label></div>
   <div className="rs-row"><button className="btn blue" disabled={busy==='m'} onClick={()=>run('m',()=>api('v1/reseller/markup',{markup:mk}),'Markup disimpan')}>Simpan markup</button></div></div>

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

  {(d.mode!=='mandiri'||d.balance>0)&&<>
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
 </div>}
