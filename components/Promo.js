'use client'
import {useState,useEffect} from 'react'
const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
const HR=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
export const usePromo=()=>{const [p,setP]=useState(null);useEffect(()=>{fetch('/api/v1/promo').then(r=>r.json()).then(d=>{if(!d.error)setP(d)}).catch(()=>{})},[]);return p}
// Banner promo di beranda dashboard
export function PromoBanners({promo,go}){
 if(!promo)return null
 const b=promo.bonus,w=promo.weekly,r=promo.ref,out=[]
 if(b.on&&b.pct>0)out.push(<div key="b" className="pm pm-b"><span className="pm-i">🎁</span><div><b>{b.boost?'Bonus spesial hari ini! ':''}Cashback {b.pct}% tiap deposit</b><small>Deposit minimal {rp(b.minAmt)} langsung dapat bonus saldo{b.max>0?' (maks '+rp(b.max)+')':''}{b.days&&b.days.length&&b.dayPct>0?' · Bonus '+b.dayPct+'% tiap '+b.days.map(d=>HR[d]).join(', '):''}.</small></div><button onClick={()=>go('deposit')}>Isi saldo</button></div>)
 if(w.on&&(w.prizes||[]).length)out.push(<div key="w" className="pm pm-w"><span className="pm-i">🏆</span><div><b>Pembeli terbanyak dapat hadiah!</b><small>Juara 1 minggu ini dapat {rp(w.prizes[0])}{w.prizes.length>1?' (top '+w.prizes.length+' dapat hadiah)':''}. Reset tiap Senin.{promo.monthly&&promo.monthly.on&&(promo.monthly.prizes||[]).length?' Bulanan: juara 1 dapat '+rp(promo.monthly.prizes[0])+'.':''}</small></div><button onClick={()=>go('lb')}>Lihat</button></div>)
 if(r.on&&(r.referrer>0||r.referee>0))out.push(<div key="r" className="pm pm-r"><span className="pm-i">🤝</span><div><b>Ajak teman, dapat saldo</b><small>Kamu dapat {rp(r.referrer)}, temanmu dapat {rp(r.referee)} setelah deposit pertamanya.</small></div><button onClick={()=>go('ref')}>Ajak</button></div>)
 return out.length?<div className="pm-wrap">{out}</div>:null}
// Halaman "Ajak Teman"
export function RefPage({me,promo,setMsg}){
 const r=promo&&promo.ref,code=me.refCode||'',link=typeof window!=='undefined'?location.origin+'/login?ref='+code:''
 const cp=t=>{try{navigator.clipboard.writeText(t);setMsg('Disalin')}catch(e){setMsg(t)}}
 const share=()=>{const text='Yuk pakai Artapedia ID, beli nomor OTP murah & otomatis. Daftar lewat link ini ya: '+link;if(navigator.share)navigator.share({text}).catch(()=>{});else cp(text)}
 return <><div className="c"><div className="ch"><div className="ic">🤝</div><div><h3>Ajak teman</h3><small>Bonus saldo untuk kamu dan temanmu</small></div></div>
  {r&&r.on?<p style={{margin:'6px 0 12px'}}>Setiap teman yang daftar pakai kodemu lalu deposit pertama minimal <b>{rp(r.minDep)}</b>: kamu dapat <b>{rp(r.referrer)}</b> dan temanmu dapat <b>{rp(r.referee)}</b>, otomatis masuk saldo.</p>:<p>Program ajak teman sedang tidak aktif.</p>}
  <small style={{color:'#6b7a95'}}>KODE AJAKAN KAMU</small><div className="ref-code mono">{code||'...'}</div>
  <div className="ref-link mono">{link}</div>
  <button className="dk" onClick={()=>cp(link)}>Salin link ajakan</button><button className="dk" style={{background:'#3b7fe0'}} onClick={share}>Bagikan</button>
  {me.refPending&&r&&<p className="hint">🎁 Kamu diajak teman. Bonus untukmu masuk setelah deposit pertama minimal {rp(r.minDep)}.</p>}</div>
  <div className="two"><div className="c"><b>Teman bergabung</b><div className="mono num">{me.refCount||0}</div><small>yang sudah deposit</small></div><div className="c"><b>Bonus didapat</b><div className="mono num">{rp(me.refEarn||0)}</div><small>dari ajakan</small></div></div></>}

// Halaman "Cashback" (dibuka dari Drawer). Isi = kartu cashback lama di beranda; tombol "Isi saldo" tetap ke deposit.
export function CashbackPage({promo,go}){
 const b=promo&&promo.bonus
 return <div className="c"><div className="ch"><div className="ic">🎁</div><div><h3>Cashback deposit</h3><small>Bonus saldo otomatis tiap isi saldo</small></div></div>
  {b&&b.on&&b.pct>0?<>
   <div className="rate mono" style={{margin:'6px 0'}}>{b.pct}%</div>
   <p style={{margin:'0 0 8px'}}>{b.boost?<b>Bonus spesial hari ini! </b>:null}Deposit minimal <b>{rp(b.minAmt)}</b> langsung dapat bonus saldo{b.max>0?' (maks '+rp(b.max)+')':''}.</p>
   {b.days&&b.days.length>0&&b.dayPct>0&&<p className="hint">Bonus {b.dayPct}% tiap {b.days.map(d=>HR[d]).join(', ')}.</p>}
   <button className="dk" onClick={()=>go('deposit')}>+ Isi saldo</button></>
  :<p>Program cashback sedang tidak aktif.</p>}</div>}
