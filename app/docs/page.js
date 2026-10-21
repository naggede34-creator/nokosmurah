'use client'
import {useState,useEffect} from 'react'
import {CopyBtn,Snippets} from '../../components/ApiPanel'
import DocsDownload from '../../components/DocsDownload'
import {SV,MD,ORDER_ST,DEP_ST,G,FLOW_ORDER,FLOW_DEP,ERR} from '../../lib/apidocs'

function Code({text}){return <div className="ap-code"><div className="ap-ct"><span style={{flex:1,color:'#b6c4ee',fontWeight:800,fontSize:12,letterSpacing:'.1em',paddingLeft:6}}>JAVASCRIPT</span><CopyBtn text={text}/></div><pre>{text}</pre></div>}
function Ep({root,m,p,d,pa,ex}){
 const url=root+'/api/v1'+p
 return <details className="dc-ep"><summary><span className={'dc-m '+m.toLowerCase()}>{m}</span><code>{p}</code><i>{d}</i></summary>
  <div className="dc-bd">
   {pa.length>0&&<><div className="ap-lbl">PARAMETER</div><div className="dc-pa">{pa.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></>}
   <div className="ap-lbl" style={{marginTop:12}}>URL</div><div className="ap-url"><code>{m} {url}</code><CopyBtn text={url}/></div>
   <div className="ap-lbl" style={{marginTop:12}}>CONTOH RESPON</div><pre className="dc-ex">{ex}</pre></div></details>}
export default function D(){
 const [base,setBase]=useState('')
 useEffect(()=>{setBase(location.origin);fetch('/api/v1/promo').then(r=>r.json()).then(d=>{if(d.site&&d.site.baseUrl)setBase(d.site.baseUrl)}).catch(()=>{})},[])
 const root=base.replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'')
 const toc=[['server','Server nokos'],['metode','Metode deposit'],['alur','Alur & contoh kode'],['akun','Akun'],['order','Order'],['deposit','Deposit'],['status','Status'],['error','Error']]
 return <div className="dc">
  <div className="dc-hero"><span className="dc-chip">Developer API v1</span><h1>Dokumentasi API</h1><p>Beli nomor OTP di <b>8 server nokos</b>, isi saldo lewat <b>QRIS &amp; 8 Virtual Account</b>, cek kode, dan kelola akun dari aplikasimu sendiri. Semua respon berformat JSON.</p>
   <div className="dc-st"><div><b>REST</b><small>JSON</small></div><div><b>60/mnt</b><small>rate limit</small></div><div><b>Bearer</b><small>autentikasi</small></div><div><b>7</b><small>server nokos</small></div><div><b>9</b><small>metode deposit</small></div></div></div>
  <nav className="dc-toc" aria-label="Daftar isi">{toc.map(([k,t])=><a key={k} href={'#'+k}>{t}</a>)}</nav>
  <DocsDownload root={root}/>
  <div className="ap-card"><div className="ap-lbl">BASE URL</div><div className="ap-url"><code>{root+'/api/v1'}</code><CopyBtn text={root+'/api/v1'}/></div>
   <div className="ap-lbl" style={{marginTop:14}}>AUTENTIKASI</div><p style={{margin:'4px 0 8px',fontSize:14}}>Kirim API key di header, atau lewat <code>?api_key=KEY</code>. Key ada di Dashboard › menu garis tiga › API Key &amp; Docs.</p>
   <div className="ap-url"><code>Authorization: Bearer API_KEY</code><CopyBtn text="Authorization: Bearer API_KEY"/></div></div>
  <div className="ap-card"><div className="ap-lbl">MULAI CEPAT</div><Snippets root={root}/></div>

  <section id="server" className="dc-sec"><h2 style={{'--c':'#7a5cff'}}><span>🖥️</span>Server nokos</h2>
   <p className="dc-p">Kirim id server di parameter <code>server</code> pada <code>/services</code>, <code>/countries</code>, dan <code>/order</code>. Server yang dimatikan admin tidak muncul di <code>/servers</code> dan menolak order (503). Harga &amp; stok berbeda tiap server, bandingkan lewat <code>/countries</code>.</p>
   <div className="dc-tb"><table><thead><tr><th>ID server</th><th>Nama</th><th>Penyedia</th><th>Cara pakai providerId</th></tr></thead><tbody>
    {SV.map(s=><tr key={s[0]}><td><code>{s[0]}</code></td><td><b>{s[1]}</b><em className="dc-bdg">{s[2]}</em></td><td>{s[3]}</td><td>{s[4]}</td></tr>)}</tbody></table></div>
   <div className="dc-note">Order baru bisa dibatalkan setelah 3 menit sejak dibuat, dan hanya selama kode belum masuk; pembelian yang sudah sukses tidak bisa dibatalkan.</div>
   <div className="dc-note">🛠 <b>Maintenance</b>: saat admin mengaktifkan maintenance, <code>/order</code> dan <code>/deposit</code> (buat baru) membalas <code>503</code> dengan <code>{'{"error":"...","maintenance":true}'}</code>. Maintenance per server hanya menolak server itu (<code>/servers</code> menandainya <code>maintenance:true</code>). Status order, pembatalan, dan refund tetap berjalan normal.</div>
   <div className="dc-note">🔐 <b>Keamanan key</b>: aktifkan <b>Whitelist IP</b> di dashboard &gt; API Key; request dari IP lain dibalas <code>403</code>. <b>Webhook OTP</b> (https, ditandatangani HMAC-SHA256 di header <code>X-Artapedia-Signature</code>) juga diatur di sana. Buat ulang key hanya bisa lewat login dashboard.</div></section>

  <section id="metode" className="dc-sec"><h2 style={{'--c':'#16c47f'}}><span>💳</span>Metode &amp; rute deposit</h2>
   <p className="dc-p">Kamu hanya memilih <b>metode</b> (field <code>provider</code>). <b>Rute</b> gateway di belakang QRIS dipilih server secara acak berbobot di antara rute yang aktif; jika satu rute gagal, otomatis pindah ke rute lain. Virtual Account selalu lewat Pakasir. Batas nominal bisa berubah, ambil dari <code>/deposit/methods</code>.</p>
   <div className="dc-tb"><table><thead><tr><th>Kode (provider)</th><th>Metode</th><th>Rute gateway</th><th>Min</th><th>Maks</th></tr></thead><tbody>
    {MD.map(s=><tr key={s[0]}><td><code>{s[0]}</code></td><td><b>{s[1]}</b></td><td>{s[2]}</td><td>{s[3]}</td><td>{s[4]}</td></tr>)}</tbody></table></div>
   <div className="dc-note">🎁 <b>Bonus &amp; ID deposit</b>: cashback % (diatur admin, lihat <code>/promo</code>) masuk otomatis ke saldo saat deposit lunas. Setiap deposit punya <code>order_id</code> unik (ID Deposit) yang juga tampil di dashboard, riwayat, mutasi saldo, dan notifikasi. QRIS: tampilkan <code>qr_image</code> / render <code>qr_string</code>. VA: tampilkan <code>va_number</code> dan bayar <b>tepat</b> sebesar <code>total_amount</code> sebelum <code>expired_at</code>.</div></section>

  <section id="alur" className="dc-sec"><h2 style={{'--c':'#ff7a1a'}}><span>🧭</span>Alur &amp; contoh kode</h2>
   <div className="ap-card"><div className="ap-lbl">ALUR PEMBELIAN OTP</div><div className="dc-flow">{[['1','Pilih server','GET /servers'],['2','Aplikasi & harga','GET /services, /countries'],['3','Buat order','POST /order'],['4','Tunggu OTP','GET /orders/status'],['5','Selesai / batal','refund otomatis']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div></div>
   <div className="ap-card"><div className="ap-lbl">ALUR DEPOSIT</div><div className="dc-flow">{[['1','Cek metode','GET /deposit/methods'],['2','Buat deposit','POST /deposit'],['3','Bayar QR / VA','sebelum expired_at'],['4','Polling status','GET /deposit?order_id='],['5','Saldo masuk','completed + bonus']].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div></div>
   <div className="ap-card"><div className="ap-lbl">CONTOH: BELI OTP (JS)</div><Code text={FLOW_ORDER.replace('BASE_URL',root)}/></div>
   <div className="ap-card"><div className="ap-lbl">CONTOH: DEPOSIT (JS)</div><Code text={FLOW_DEP}/></div></section>

  {G.map(g=><section key={g.t} id={g.id==='server'?undefined:g.id} className="dc-sec"><h2 style={{'--c':g.c}}><span>{g.ic}</span>{g.t}</h2>{g.items.map(i=><Ep key={i[0]+i[1]} root={root} m={i[0]} p={i[1]} d={i[2]} pa={i[3]} ex={i[4]}/>)}</section>)}

  <section id="status" className="dc-sec"><h2 style={{'--c':'#3b7fe0'}}><span>📍</span>Status</h2>
   <div className="dc-two">
    <div className="ap-card"><div className="ap-lbl">STATUS ORDER (status)</div><div className="dc-pa">{ORDER_ST.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></div>
    <div className="ap-card"><div className="ap-lbl">STATUS DEPOSIT (status)</div><div className="dc-pa">{DEP_ST.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></div></div></section>

  <section id="error" className="ap-card"><div className="ap-lbl">KODE ERROR</div><div className="dc-pa">{ERR.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></section>
  <DocsDownload root={root}/></div>}
