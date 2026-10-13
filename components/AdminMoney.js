'use client'
import {useState,useEffect,useCallback} from 'react'
// Ringkasan uang di halaman depan admin: omzet, laba kotor (jual − modal), deposit masuk, order gagal.
// Grafik: SATU seri — laba kotor per hari. Sempat dicoba batang bertumpuk omzet (modal+laba), tapi laba
// hanya ~9% dari omzet sehingga batangnya jadi sesobek garis dan tren labanya tidak terbaca.
// Satu seri = tidak perlu legenda (judulnya sudah menyebut isinya); omzet & modal tetap ada di tooltip
// dan di tabel di bawah, jadi tidak ada informasi yang hilang.
const rp=n=>'Rp'+Math.round(+n||0).toLocaleString('id-ID')
const rk=n=>{n=Math.round(+n||0);return n>=1e9?(n/1e9).toFixed(1).replace('.0','')+'M':n>=1e6?(n/1e6).toFixed(1).replace('.0','')+'jt':n>=1e3?Math.round(n/1e3)+'rb':String(n)}
const BL=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const PERIODE=[['hari','Hari ini'],['minggu','7 hari'],['bulan','30 hari'],['semua','Semua']]
export default function AdminMoney({call}){
 const [d,setD]=useState(null),[p,setP]=useState('hari'),[err,setErr]=useState(''),[hv,setHv]=useState(-1),[busy,setBusy]=useState(false)
 const load=useCallback(async(fresh)=>{setBusy(true);const r=await call('uang',fresh?{fresh:1}:{});setBusy(false)
  r&&r.error?setErr(r.error):setD(r)},[call])
 useEffect(()=>{load()},[load])
 if(err)return <div className="card"><h3>💵 Ringkasan uang</h3><p className="muted">{err}</p></div>
 if(!d)return <div className="card"><h3>💵 Ringkasan uang</h3>
   <div className="ad-kpi" style={{maxWidth:'none'}}>{[0,1,2,3].map(i=><div key={i} className="fx-sk" style={{height:62}}/>)}</div>
   <div className="fx-sk" style={{height:170,marginTop:14}}/></div>
 const v=d.per[p]||d.per.hari
 const margin=v.omzet>0?Math.round(v.laba/v.omzet*100):0
 const mx=Math.max(1,...d.days.map(x=>x.laba))
 const top=d.days.reduce((a,x,i)=>x.laba>d.days[a].laba?i:a,0)
 return <div className="card am">
  <div className="am-h"><h3>💵 Ringkasan uang</h3>
   <div className="am-seg">{PERIODE.map(([k,t])=><button key={k} className={p===k?'on':''} onClick={()=>setP(k)}>{t}</button>)}</div>
   <button className="am-rf" onClick={()=>load(true)} disabled={busy} title="Segarkan (data di-cache 60 detik)">{busy?'…':'↻'}</button></div>

  <div className="am-kpi">
   <div><small>Omzet {PERIODE.find(x=>x[0]===p)[1].toLowerCase()}</small><b>{rp(v.omzet)}</b><i>{v.trx} order sukses</i></div>
   <div className="hi"><small>Laba kotor</small><b>{rp(v.laba)}</b><i>jual − modal {rp(v.modal)} · margin {margin}%</i></div>
   <div><small>Deposit masuk</small><b>{rp(v.dep)}</b><i>{v.depN} deposit · bonus {rp(v.bonus)}</i></div>
   <div className={v.gagal?'bad':''}><small>Order gagal</small><b>{v.gagal}</b><i>refund {rp(v.refund)}</i></div>
  </div>

  <div className="am-sub">
   <span>Saldo pengguna mengendap <b>{rp(d.saldo)}</b></span>
   <span>Order menunggu OTP <b>{d.pending}</b></span>
   <span>Pengguna <b>{d.users}</b>{d.userBaru>0?<> (+{d.userBaru} hari ini)</>:null}</span>
   {d.gatewayLaba>0&&<span>Laba QRIS Gateway <b>{rp(d.gatewayLaba)}</b></span>}
  </div>

  <div className="am-ch">
   <div className="am-ct"><b>Laba kotor 7 hari terakhir</b>
    <span className="am-hint">omzet &amp; modal ada di tabel dan saat batang disorot</span></div>
   <div className="am-bars" onMouseLeave={()=>setHv(-1)}>
    {d.days.map((x,i)=>{const dd=new Date(x.at+7*36e5)
     const hl=x.laba>0?Math.max(3,x.laba/mx*132):0
     return <div key={i} className={'am-b'+(hv===i?' on':'')} onMouseEnter={()=>setHv(i)} onFocus={()=>setHv(i)} tabIndex={0}
       aria-label={`${dd.getUTCDate()} ${BL[dd.getUTCMonth()]}: laba ${rp(x.laba)}, omzet ${rp(x.omzet)}, ${x.trx} order`}>
      {hv<0&&i===top&&x.laba>0&&<em>{rk(x.laba)}</em>}
      <span className="am-st"><i className="laba" style={{height:hl+'px'}}/></span>
      <small>{dd.getUTCDate()} {BL[dd.getUTCMonth()]}</small>
      {hv===i&&<div className="am-tip" role="tooltip">
       <b>{dd.getUTCDate()} {BL[dd.getUTCMonth()]}</b>
       <span>Omzet <b>{rp(x.omzet)}</b></span><span>Laba <b>{rp(x.laba)}</b></span>
       <span>Modal <b>{rp(x.modal)}</b></span><span>{x.trx} order sukses</span></div>}
     </div>})}
   </div>
  </div>
  <details className="am-tb"><summary>Lihat sebagai tabel</summary>
   <table className="ud-t"><thead><tr><th>Tanggal</th><th>Omzet</th><th>Modal</th><th>Laba</th><th>Order</th></tr></thead>
    <tbody>{d.days.map((x,i)=>{const dd=new Date(x.at+7*36e5)
     return <tr key={i}><td>{dd.getUTCDate()} {BL[dd.getUTCMonth()]}</td><td>{rp(x.omzet)}</td><td>{rp(x.modal)}</td><td><b>{rp(x.laba)}</b></td><td>{x.trx}</td></tr>})}</tbody></table>
  </details>
  <p className="muted" style={{margin:'10px 0 0'}}>Laba kotor = harga jual dikurangi modal penyedia, belum dipotong biaya gateway deposit. Angka disegarkan tiap 60 detik.</p>
 </div>}
