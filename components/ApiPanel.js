'use client'
import {useState,useEffect} from 'react'
export const baseOf=(promo)=>{const b=((promo&&promo.site&&promo.site.baseUrl)||(typeof window!=='undefined'?location.origin:'')).replace(/\/+$/,'').replace(/\/api(\/v1)?$/,'');return b}
export const snip=(root,key)=>({
 curl:`curl ${root}/api/v1/me \\\n  -H "Authorization: Bearer ${key}"`,
 js:`const r = await fetch("${root}/api/v1/me", {\n  headers: { Authorization: "Bearer ${key}" }\n});\nconsole.log(await r.json());`,
 py:`import requests\n\nr = requests.get(\n    "${root}/api/v1/me",\n    headers={"Authorization": "Bearer ${key}"},\n)\nprint(r.json())`})
export function CopyBtn({text,label='Salin',setMsg,cls=''}){
 const [ok,setOk]=useState(false)
 return <button className={'ap-btn sm '+cls} onClick={()=>{try{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),1500);setMsg&&setMsg('Disalin')}catch(e){setMsg&&setMsg(text)}}}>{ok?'✓ Tersalin':label}</button>}
export function Snippets({root,keyText,setMsg}){
 const [t,setT]=useState('curl'),S=snip(root,keyText||'API_KEY'),N={curl:'cURL',js:'JavaScript',py:'Python'}
 return <div className="ap-code"><div className="ap-ct">{Object.keys(N).map(k=><button key={k} className={t===k?'on':''} onClick={()=>setT(k)}>{N[k]}</button>)}<span style={{flex:1}}/><CopyBtn text={S[t]} setMsg={setMsg} cls="ghost"/></div><pre>{S[t]}</pre></div>}
const call=async(p,body)=>{try{const r=await fetch('/api/'+p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return await r.json()}catch(e){return {error:'Gagal terhubung ke server'}}}
const IN={width:'100%',boxSizing:'border-box',border:'2px solid #1f2b4d',borderRadius:12,padding:'10px 12px',fontSize:14,background:'#fff',color:'#1f2b4d',fontFamily:'inherit'}
// Kartu keamanan: whitelist IP untuk API key + webhook OTP
function SecurityCards({setMsg}){
 const [d,setD]=useState(null),[ips,setIps]=useState(''),[url,setUrl]=useState(''),[on,setOn]=useState(true),[busy,setBusy]=useState(''),[sh,setSh]=useState(false)
 const apply=r=>{if(r.ipw)setIps(r.ipw.join('\n'));if(r.hook){setUrl(r.hook.url||'');setOn(r.hook.on||!r.hook.url)}}
 const load=async()=>{const r=await call('v1/security');if(!r.error){setD(r);apply(r)}}
 useEffect(()=>{load()},[])
 const run=async(k,f)=>{setBusy(k);const r=await f();setBusy('');if(r.error)setMsg(r.error);return r}
 const saveIp=()=>run('ip',async()=>{const r=await call('v1/security',{ipw:ips});if(!r.error){setMsg(r.ipw.length?'Whitelist IP disimpan ('+r.ipw.length+' IP)':'Whitelist dikosongkan: key bisa dipakai dari IP mana saja');load()}return r})
 const saveHook=()=>run('hk',async()=>{const r=await call('v1/webhook',{url,on});if(!r.error){setMsg(url?'Webhook disimpan':'Webhook dimatikan');load()}return r})
 const test=()=>run('ts',async()=>{const r=await call('v1/webhook/test',{});if(!r.error)setMsg(r.ok?'Tes terkirim, balasan HTTP '+r.code:'Tes gagal: '+(r.error||'HTTP '+r.code));load();return r})
 const regen=()=>{if(!confirm('Buat secret baru? Penerima webhook harus memakai secret baru untuk memverifikasi tanda tangan.'))return;run('sc',async()=>{const r=await call('v1/webhook/secret',{});if(!r.error){setMsg('Secret baru dibuat');load()}return r})}
 if(!d)return null
 const h=d.hook||{},last=h.last,sec=h.secret||''
 return <>
  <div className="ap-card"><div className="ap-lbl">WHITELIST IP API KEY</div>
   <p style={{fontSize:13.5,margin:'6px 0 10px'}}>Kalau diisi, API key hanya bisa dipakai dari IP di daftar ini (satu IP per baris, maks 20). Login lewat browser tidak terpengaruh. Kosong = bebas dari IP mana saja.</p>
   <textarea style={{...IN,minHeight:84,fontFamily:'monospace'}} placeholder={'203.0.113.10\n2001:db8::1'} value={ips} onChange={e=>setIps(e.target.value)}/>
   <div className="ap-row" style={{marginTop:10,alignItems:'center'}}><button className="ap-btn sm" disabled={busy==='ip'} onClick={saveIp}>{busy==='ip'?'Menyimpan…':'💾 Simpan whitelist'}</button>{d.yourIp&&<button className="ap-btn sm ghost" onClick={()=>setIps(x=>x.split(/\s+/).includes(d.yourIp)?x:(x.trim()?x.trim()+'\n':'')+d.yourIp)}>+ IP-ku ({d.yourIp})</button>}</div>
   <p className="ap-warn">Pastikan IP server/bot-mu sudah benar, kalau salah request API akan ditolak (403). IP statis dibutuhkan; IP yang berganti-ganti sebaiknya jangan di-whitelist.</p></div>
  <div className="ap-card"><div className="ap-lbl">WEBHOOK OTP</div>
   <p style={{fontSize:13.5,margin:'6px 0 10px'}}>Saat kode OTP masuk, kami kirim <code>POST</code> JSON ke URL-mu, cocok untuk reseller dan bot. Wajib <code>https://</code>. Dikirim sekali per order (ulang 1x kalau gagal), jadi cegah dobel dengan <code>order_id</code>.</p>
   <input style={IN} placeholder="https://domainmu.com/webhook/otp" value={url} onChange={e=>setUrl(e.target.value)}/>
   <label style={{display:'flex',gap:8,alignItems:'center',margin:'10px 0',fontSize:14}}><input type="checkbox" checked={on} onChange={e=>setOn(e.target.checked)}/> Aktif</label>
   <div className="ap-row"><button className="ap-btn sm" disabled={busy==='hk'} onClick={saveHook}>{busy==='hk'?'Menyimpan…':'💾 Simpan'}</button><button className="ap-btn sm ghost" disabled={busy==='ts'||!h.url} onClick={test}>{busy==='ts'?'Mengirim…':'🧪 Kirim tes'}</button></div>
   {sec&&<><div className="ap-lbl" style={{marginTop:14}}>SECRET (untuk verifikasi tanda tangan)</div>
    <div className="ap-url"><code>{sh?sec:sec.slice(0,10)+'•'.repeat(24)}</code></div>
    <div className="ap-row" style={{marginTop:8}}><button className="ap-btn sm ghost" onClick={()=>setSh(!sh)}>{sh?'🙈 Sembunyikan':'👁 Tampilkan'}</button><CopyBtn text={sec} label="📋 Salin" setMsg={setMsg}/><button className="ap-btn sm ghost" disabled={busy==='sc'} onClick={regen}>🔄 Secret baru</button></div></>}
   {last&&<p className="hint" style={{marginTop:12}}>Pengiriman terakhir: {new Date(last.at).toLocaleString('id-ID')} · {last.event} · {last.ok?<b style={{color:'#1a9b55'}}>berhasil (HTTP {last.code})</b>:<b style={{color:'#c0392b'}}>gagal: {last.error}</b>}</p>}
   <details style={{marginTop:12,fontSize:13}}><summary style={{cursor:'pointer',fontWeight:800}}>Format &amp; cara verifikasi</summary>
    <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:12,margin:'8px 0 0'}}>{`POST https://domainmu.com/webhook/otp
Content-Type: application/json
X-Artapedia-Event: otp.received
X-Artapedia-Timestamp: 1760000000
X-Artapedia-Signature: sha256=<hex>

{"event":"otp.received","order_id":"...","status":"success",
 "phone":"628...","service":"WhatsApp","country":"Indonesia",
 "otp":"123456","message":"...","price":3500,"server":"...",
 "created_at":"...","received_at":"..."}

signature = HMAC_SHA256(secret, timestamp + "." + rawBody)
Balas HTTP 2xx supaya dianggap berhasil.`}</pre></details></div></>}
// Tampilan menu "API Key" di dashboard pengguna
function TgCard({setMsg}){
 const [c,setC]=useState(null),[busy,setBusy]=useState(false)
 const gen=async()=>{setBusy(true);const r=await call('v1/tglink',{});setBusy(false);if(r.error)return setMsg(r.error);setC(r)}
 return <div className="ap-card"><div className="ap-lbl">HUBUNGKAN TELEGRAM</div>
  <p style={{fontSize:13.5,margin:'6px 0 10px'}}>Beli nokos &amp; isi saldo langsung dari bot Telegram dengan saldo akun ini. Buat kode, lalu kirim ke bot (atau ketik <code>/link KODE</code>). Kode berlaku 10 menit.</p>
  {c?<><div className="ap-key"><code style={{fontSize:20,letterSpacing:3}}>{c.code}</code></div>
   <div className="ap-row" style={{marginTop:10}}><CopyBtn text={'/link '+c.code} label="📋 Salin perintah" setMsg={setMsg}/><a className="ap-btn sm blue" href={'https://t.me/'+c.bot} target="_blank" rel="noreferrer">✈️ Buka @{c.bot}</a></div></>
   :<button className="ap-btn sm" disabled={busy} onClick={gen}>{busy?'Membuat…':'🔗 Buat kode hubungkan'}</button>}</div>}
export default function ApiPanel({me,promo,setMsg,onRegen}){
 const [show,setShow]=useState(false),root=baseOf(promo),docs=(promo&&promo.site&&promo.site.docsUrl)||'/docs',k=me.apikey||''
 const masked=k.slice(0,6)+'•'.repeat(Math.max(8,k.length-10))+k.slice(-4)
 return <div className="ap-wrap">
  <div className="ap-hero"><div className="ap-ico">🔑</div><div><h3>API Key</h3><small>Hubungkan Artapedia ke web, bot, atau aplikasimu</small></div></div>
  <div className="ap-card"><div className="ap-lbl">API KEY KAMU</div>
   <div className="ap-key"><code>{show?k:masked}</code></div>
   <div className="ap-row"><button className="ap-btn sm ghost" onClick={()=>setShow(!show)}>{show?'🙈 Sembunyikan':'👁 Tampilkan'}</button><CopyBtn text={k} label="📋 Salin key" setMsg={setMsg}/></div>
   <p className="ap-warn">⚠️ Jangan bagikan key ini. Siapa pun yang memegangnya bisa memakai saldomu. Curiga bocor? Tekan "Buat ulang key" di bawah, key lama langsung mati.</p></div>
  <div className="ap-card"><div className="ap-lbl">BASE URL</div>
   <div className="ap-url"><code>{root+'/api/v1'}</code><CopyBtn text={root+'/api/v1'} setMsg={setMsg}/></div>
   <div className="ap-lbl" style={{marginTop:14}}>HEADER AUTENTIKASI</div>
   <div className="ap-url"><code>Authorization: Bearer KEY</code><CopyBtn text="Authorization: Bearer KEY" setMsg={setMsg}/></div></div>
  <div className="ap-card"><div className="ap-lbl">CONTOH CEPAT</div><Snippets root={root} keyText={show?k:'API_KEY'} setMsg={setMsg}/></div>
  <TgCard setMsg={setMsg}/>
  <SecurityCards setMsg={setMsg}/>
  <a className="ap-btn big blue" href={docs}>📖 Buka dokumentasi lengkap →</a>
  <button className="ap-btn big danger" onClick={onRegen}>🔄 Buat ulang key</button>
  <p className="hint" style={{textAlign:'center'}}>Batas: 60 request/menit, 20 order/menit, 6 deposit/menit per key.</p></div>}
