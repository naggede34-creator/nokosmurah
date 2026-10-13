'use client'
import {useState,useEffect,useCallback} from 'react'
import {usePathname} from 'next/navigation'
// Rangka halaman QRIS Gateway: kepala + saldo, sidebar di layar lebar, bar bawah di HP.
export const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
export const nf=n=>Math.round(+n||0).toLocaleString('id-ID')
export const api=async(p,b,m)=>{const r=await fetch('/api/'+p,{method:m||(b?'POST':'GET'),headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return r.json()}
export const dt=t=>t?new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).replace('.',':'):'-'
export const ago=t=>{if(!t)return '-';const s=Math.floor((Date.now()-new Date(t).getTime())/1000)
 return s<60?'baru saja':s<3600?Math.floor(s/60)+' mnt lalu':s<86400?Math.floor(s/3600)+' jam lalu':dt(t)}
const NAV=[['/pay','Dashboard','◉'],['/pay/qris','Buat QRIS','▣'],['/pay/withdraw','Tarik Dana','↗'],
 ['/pay/riwayat','Riwayat','≡'],['/pay/profil','API & Webhook','⚿'],['/pay/docs','Dokumentasi','❯']]
const BN=[['/pay','Home','◉'],['/pay/qris','QRIS','▣'],['/pay/withdraw','Tarik','↗'],['/pay/riwayat','Riwayat','≡'],['/pay/profil','API','⚿']]
export function Toast({msg,onClose}){
 useEffect(()=>{if(!msg)return;const t=setTimeout(onClose,3600);return()=>clearTimeout(t)},[msg,onClose])
 return msg?<div className="pay-toast" role="status">{msg}</div>:null}
export function Copy({text,label='Salin',cls='pb gh sm',onMsg}){
 const [ok,setOk]=useState(false)
 return <button type="button" className={cls} onClick={()=>{try{navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),1400);onMsg&&onMsg('Disalin')}catch(e){onMsg&&onMsg(String(text))}}}>{ok?'✓ Tersalin':label}</button>}

export default function PayShell({children,me}){
 const path=usePathname()||'/pay'
 const act=h=>h==='/pay'?path==='/pay':path.startsWith(h)
 return <div className="pay"><div className="pay-in">
  <header className="pay-top">
   <a href="/pay" className="pay-brand">
    <span className="pay-logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h2v2h-2zM18 15h2v4M14 19h2"/></svg></span>
    <span>{(me&&me.name)||'Artapedia Pay'}<small>QRIS Gateway</small></span></a>
   <span className="sp"/>
   <div className="pay-bal"><div><small>SALDO</small><b className="mono">{me?rp(me.balance):'—'}</b></div></div>
  </header>
  <div className="pay-grid">
   <nav className="pay-nav">
    <div className="lbl">MENU UTAMA</div>
    {NAV.map(([h,t,i])=><a key={h} href={h} className={act(h)?'on':''}><i>{i}</i>{t}</a>)}
    <hr/>
    <a href="/dashboard"><i>↩</i>Kembali ke Nokos</a>
   </nav>
   <main>{children}</main>
  </div>
  <nav className="pay-bn">{BN.map(([h,t,i])=><a key={h} href={h} className={act(h)?'on':''}><i>{i}</i>{t}</a>)}</nav>
 </div></div>}
