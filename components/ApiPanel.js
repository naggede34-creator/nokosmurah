'use client'
import {useState} from 'react'
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
// Tampilan menu "API Key" di dashboard pengguna
export default function ApiPanel({me,promo,setMsg,onRegen}){
 const [show,setShow]=useState(false),root=baseOf(promo),docs=(promo&&promo.site&&promo.site.docsUrl)||'/docs',k=me.apikey||''
 const masked=k.slice(0,6)+'•'.repeat(Math.max(8,k.length-10))+k.slice(-4)
 return <div className="ap-wrap">
  <div className="ap-hero"><div className="ap-ico">🔑</div><div><h3>API Key</h3><small>Hubungkan Artapedia ke web, bot, atau aplikasimu</small></div></div>
  <div className="ap-card"><div className="ap-lbl">API KEY KAMU</div>
   <div className="ap-key"><code>{show?k:masked}</code></div>
   <div className="ap-row"><button className="ap-btn sm ghost" onClick={()=>setShow(!show)}>{show?'🙈 Sembunyikan':'👁 Tampilkan'}</button><CopyBtn text={k} label="📋 Salin key" setMsg={setMsg}/></div>
   <p className="ap-warn">⚠️ Jangan bagikan key ini. Siapa pun yang memegangnya bisa memakai saldomu.</p></div>
  <div className="ap-card"><div className="ap-lbl">BASE URL</div>
   <div className="ap-url"><code>{root+'/api/v1'}</code><CopyBtn text={root+'/api/v1'} setMsg={setMsg}/></div>
   <div className="ap-lbl" style={{marginTop:14}}>HEADER AUTENTIKASI</div>
   <div className="ap-url"><code>Authorization: Bearer KEY</code><CopyBtn text="Authorization: Bearer KEY" setMsg={setMsg}/></div></div>
  <div className="ap-card"><div className="ap-lbl">CONTOH CEPAT</div><Snippets root={root} keyText={show?k:'API_KEY'} setMsg={setMsg}/></div>
  <a className="ap-btn big blue" href={docs}>📖 Buka dokumentasi lengkap →</a>
  <button className="ap-btn big danger" onClick={onRegen}>🔄 Buat ulang key</button>
  <p className="hint" style={{textAlign:'center'}}>Batas: 60 request/menit, 20 order/menit, 6 deposit/menit per key.</p></div>}
