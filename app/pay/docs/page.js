'use client'
import {useState,useEffect} from 'react'
import PayShell,{api,Toast,Copy} from '../../../components/PayShell'
import {EP,EVENTS,ERRS,LIMITS,snippets,HMAC_JS,HOOK_JS} from '../../../lib/paydocs'
const TOC=[['mulai','Pengenalan'],['auth','Autentikasi'],['hmac','Tanda tangan HMAC'],['limit','Rate limit'],
 ['akun','Akun'],['qris','QRIS masuk'],['tarik','Tarik dana'],['hook','Webhook'],['err','Kode error']]
function Code({text,lang='javascript',onMsg}){
 return <div className="pd-code"><div className="pd-ct"><span>{lang}</span><Copy text={text} cls="pb gh sm" onMsg={onMsg}/></div><pre>{text}</pre></div>}
function Ep({root,m,p,d,pa,ex,onMsg}){
 const [o,setO]=useState(false),url=root+'/api/pay'+p
 return <div className={'pd-ep'+(o?' open':'')}>
  <button onClick={()=>setO(!o)}><span className={'pd-m '+m.toLowerCase()}>{m}</span><code>{p}</code><i>{d.split('.')[0]}.</i><em>{o?'−':'+'}</em></button>
  {o&&<div className="pd-bd">
   <p>{d}</p>
   <div className="pf-l">URL</div><div className="pay-code"><code>{m} {url}</code><Copy text={url} onMsg={onMsg}/></div>
   {pa.length>0&&<><div className="pf-l" style={{marginTop:14}}>PARAMETER</div>
    <div className="pd-pa">{pa.map(x=><div key={x[0]}><code>{x[0]}</code><span>{x[1]}</span></div>)}</div></>}
   <div className="pf-l" style={{marginTop:14}}>CONTOH BALASAN</div><pre className="pd-ex">{ex}</pre></div>}
 </div>}
export default function PayDocs(){
 const [me,setMe]=useState(),[root,setRoot]=useState(''),[msg,setMsg]=useState(''),[tab,setTab]=useState('curl'),[real,setReal]=useState(false)
 useEffect(()=>{setRoot(location.origin);api('v1/pay/me').then(r=>{if(!r.error)setMe(r)})},[])
 const S=snippets(root,real&&me&&me.acc?me.acc.key:'')
 const N={curl:'cURL',js:'JavaScript',php:'PHP'}
 const unduh=()=>{
  const L=[]
  L.push('# Dokumentasi API — '+((me&&me.name)||'Artapedia Pay'),'','Base URL: `'+root+'/api/pay`','',
   'Semua balasan berbentuk `{"success": true|false, ...}`. Kirim API key lewat header `X-API-Key`.','')
  L.push('## Rate limit','',...LIMITS.map(x=>`- **${x[0]}** — ${x[1]} (${x[2]})`),'')
  for(const g of EP){L.push('## '+g.ic+' '+g.g,'')
   for(const [m,p,d,pa,ex] of g.items){L.push(`### \`${m} /api/pay${p}\``,'',d,'')
    if(pa.length){L.push('| Parameter | Keterangan |','|---|---|',...pa.map(x=>`| \`${x[0]}\` | ${x[1]} |`),'')}
    L.push('Contoh balasan:','','```json',ex,'```','')}}
  L.push('## Webhook','',...EVENTS.map(e=>`- \`${e[0]}\` — ${e[1]}`),'','Verifikasi tanda tangan:','','```js',HOOK_JS,'```','')
  L.push('## Tanda tangan HMAC','','```js',HMAC_JS,'```','')
  L.push('## Kode error','','| HTTP | Arti | Keterangan |','|---|---|---|',...ERRS.map(e=>`| \`${e[0]}\` | ${e[1]} | ${e[2]} |`))
  const a=document.createElement('a')
  a.href=URL.createObjectURL(new Blob([L.join('\n')],{type:'text/markdown;charset=utf-8'}))
  a.download='artapedia-pay-api-'+new Date().toISOString().slice(0,10)+'.md';a.click();setMsg('Dokumentasi diunduh')}
 return (<PayShell me={me?{balance:me.balance,name:me.name}:null}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  <section className="pc pd-hero">
   <span className="pd-chip">API REFERENCE</span>
   <h1>Dokumentasi {(me&&me.name)||'Artapedia Pay'}</h1>
   <p>REST API untuk menerima pembayaran QRIS dan menarik dana ke e-wallet &amp; bank, langsung dari aplikasimu. Semua balasan JSON dengan field <code className="mono">success</code>.</p>
   <div className="pd-meta">
    <div><small>BASE URL</small><code className="mono">{root}/api/pay</code></div>
    <div><small>AUTENTIKASI</small><code className="mono">X-API-Key</code></div>
    <div><small>FORMAT</small><code className="mono">application/json</code></div>
    <div><small>RATE LIMIT</small><code className="mono">300 / menit</code></div>
   </div>
   <div className="pay-row" style={{marginTop:16}}>
    <button className="pb white" onClick={unduh}>⬇ Unduh dokumentasi (.md)</button>
    <a className="pb gh" href="/pay/profil">⚿ Ambil API Key</a></div>
  </section>

  <nav className="pd-toc">{TOC.map(([k,t])=><a key={k} href={'#'+k}>{t}</a>)}</nav>

  <section className="pc" id="mulai">
   <div className="pc-h"><span className="pc-ic">🚀</span><div><h2>Pengenalan</h2><p>Tiga langkah dari nol sampai menerima uang</p></div></div>
   <div className="pd-steps">
    {[['1','Ambil API Key','Buka halaman API &amp; Webhook, salin key yang diawali apay_live_.'],
      ['2','Kunci dengan IP whitelist','Daftarkan IP servermu. API ini bisa memindahkan uang, jadi jangan dilewati.'],
      ['3','Terbitkan QRIS','POST /deposit/create, tampilkan qr_image ke pembeli, lalu tunggu webhook qris.paid.']]
     .map(([n,t,d])=><div key={n}><span>{n}</span><b>{t}</b><small dangerouslySetInnerHTML={{__html:d}}/></div>)}
   </div>
   <div className="pf-l" style={{marginTop:16}}>CONTOH TERCEPAT — TERBITKAN QRIS</div>
   <div className="pay-row" style={{alignItems:'center'}}>
    <div className="pd-tabs">{Object.keys(N).map(k=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{N[k]}</button>)}</div>
    <button className="pb gh sm" onClick={()=>setReal(!real)}>{real?'🙈 Sembunyikan key saya':'🔑 Pakai API key saya'}</button></div>
   <Code text={S[tab]} lang={N[tab]} onMsg={setMsg}/>
   <div className="pay-note">Alur uangnya: pembeli bayar <b>total_paid</b> → saldo gateway kamu bertambah <b>net</b> (nominal dikurangi biaya layanan) → kapan saja bisa ditarik ke e-wallet/bank lewat <code className="mono">/withdraw/create</code>.</div>
  </section>

  <section className="pc" id="auth">
   <div className="pc-h"><span className="pc-ic">🔑</span><div><h2>Autentikasi</h2><p>API key + whitelist IP, ditambah HMAC kalau mau lebih aman</p></div></div>
   <div className="pf-l">CARA MENGIRIM API KEY</div>
   <div className="pd-pa">
    <div><code>X-API-Key</code><span>Disarankan. <code className="mono">X-API-Key: apay_live_xxx</code></span></div>
    <div><code>Authorization</code><span><code className="mono">Authorization: Bearer apay_live_xxx</code></span></div>
    <div><code>?apikey=</code><span>Query parameter. Jangan dipakai kalau HMAC aktif.</span></div>
   </div>
   <div className="pay-note warn">Permintaan ditolak <b>401</b> kalau key salah, dan <b>403</b> kalau IP pemanggil tidak ada di whitelist. Whitelist kosong = bisa dipanggil dari mana saja (tidak disarankan).</div>
  </section>

  <section className="pc" id="hmac">
   <div className="pc-h"><span className="pc-ic">✍️</span><div><h2>Tanda tangan HMAC</h2><p>Opsional tapi sangat disarankan — aman walau API key bocor</p></div></div>
   <p style={{color:'var(--t2)',fontSize:13.5,lineHeight:1.65,margin:'0 0 10px'}}>
    Setelah API Secret dibuat, <b>setiap</b> permintaan wajib ditandatangani. Gabungkan empat bagian dengan baris baru (<code className="mono">\n</code>), lalu HMAC-SHA256 memakai secret sebagai kunci, hasilnya hex:</p>
   <pre className="pd-ex">{`METHOD      huruf besar, mis. POST
PATH        pathname murni TANPA query, mis. /api/pay/deposit/create
BODY        raw JSON persis seperti yang dikirim ("" kalau tidak ada body)
TIMESTAMP   Date.now() dalam milidetik, sebagai string`}</pre>
   <Code text={HMAC_JS} onMsg={setMsg}/>
   <div className="pay-note">Server menolak kalau selisih <code className="mono">X-Timestamp</code> dengan waktu server lebih dari 5 menit (mencegah replay). Karena path yang ditandatangani tanpa query string, kirim key lewat header — bukan <code className="mono">?apikey=</code>.</div>
  </section>

  <section className="pc" id="limit">
   <div className="pc-h"><span className="pc-ic">⏱</span><div><h2>Rate limit</h2><p>Batas permintaan per API key</p></div></div>
   <div className="pd-tb"><table><thead><tr><th>Endpoint</th><th>Batas</th><th>Keterangan</th></tr></thead>
    <tbody>{LIMITS.map(x=><tr key={x[0]}><td><code>{x[0]}</code></td><td><b>{x[1]}</b></td><td>{x[2]}</td></tr>)}</tbody></table></div>
  </section>

  {EP.map(g=><section className="pc" id={g.id} key={g.id}>
   <div className="pc-h"><span className="pc-ic">{g.ic}</span><div><h2>{g.g}</h2><p>{g.items.length} endpoint</p></div></div>
   <div className="pd-eps">{g.items.map(i=><Ep key={i[0]+i[1]} root={root} m={i[0]} p={i[1]} d={i[2]} pa={i[3]} ex={i[4]} onMsg={setMsg}/>)}</div>
  </section>)}

  <section className="pc" id="hook">
   <div className="pc-h"><span className="pc-ic">🔔</span><div><h2>Webhook</h2><p>Lebih hemat daripada polling — kami yang mengabari servermu</p></div></div>
   <div className="pd-tb"><table><thead><tr><th>Event</th><th>Terpicu saat</th></tr></thead>
    <tbody>{EVENTS.map(e=><tr key={e[0]}><td><code>{e[0]}</code></td><td>{e[1]}</td></tr>)}</tbody></table></div>
   <div className="pf-l" style={{marginTop:14}}>BENTUK PAYLOAD</div>
   <pre className="pd-ex">{`POST https://servermu.com/webhook/apay
X-ArtapediaPay-Event: qris.paid
X-Artapedia-Timestamp: 1760000000
X-ArtapediaPay-Signature: <hex>

{
  "event": "qris.paid",
  "data": { "transaction_id": "APY-M2K9X1AB", "reference": "APG-A1B2C3D4",
            "amount": 50000, "fee": 350, "net": 49650, "total_paid": 50200,
            "status": "paid", "paid_at": "2026-10-13T10:12:31.000Z" },
  "sentAt": "2026-10-13T10:12:31.512Z"
}`}</pre>
   <div className="pf-l" style={{marginTop:14}}>VERIFIKASI TANDA TANGAN</div>
   <Code text={HOOK_JS} onMsg={setMsg}/>
   <div className="pay-note warn">Selalu verifikasi tanda tangan sebelum memproses — tanpa itu, siapa pun bisa mengirim <code className="mono">qris.paid</code> palsu ke servermu. Balas <b>HTTP 2xx dalam 10 detik</b>; gagal diulang sampai 3 kali.</div>
  </section>

  <section className="pc" id="err">
   <div className="pc-h"><span className="pc-ic">⚠️</span><div><h2>Kode error</h2><p>Semua error: <code className="mono">{'{"success": false, "message": "..."}'}</code></p></div></div>
   <div className="pd-tb"><table><thead><tr><th>HTTP</th><th>Arti</th><th>Penanganan</th></tr></thead>
    <tbody>{ERRS.map(e=><tr key={e[0]}><td><code>{e[0]}</code></td><td><b>{e[1]}</b></td><td>{e[2]}</td></tr>)}</tbody></table></div>
  </section>
 </PayShell>)}
