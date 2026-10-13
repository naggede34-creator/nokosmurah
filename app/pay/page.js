'use client'
import {useState,useEffect,useCallback} from 'react'
import PayShell,{api,rp,nf,dt,ago,Toast} from '../../components/PayShell'
import Struk from '../../components/Struk'
const BL=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
export default function PayHome(){
 const [d,setD]=useState(),[msg,setMsg]=useState(''),[struk,setStruk]=useState(null)
 const load=useCallback(async()=>{const r=await api('v1/pay/me');if(r.error){setD(null);setMsg(r.error);return}setD(r)},[])
 useEffect(()=>{load();const t=setInterval(load,15000);return()=>clearInterval(t)},[load])
 if(d===undefined)return (<PayShell>
   <div className="pc"><div className="pay-sk" style={{height:150}}/></div>
   <div className="pay-kpi">{[0,1,2,3].map(i=><div key={i} className="pay-sk" style={{height:84}}/>)}</div>
  </PayShell>)
 if(!d)return (<PayShell>
   <div className="pc"><div className="pc-h"><span className="pc-ic">⚠️</span><div><h2>Gagal memuat</h2><p>{msg||'Coba muat ulang halaman.'}</p></div></div>
    <button className="pb" onClick={load}>Coba lagi</button></div>
  </PayShell>)
 const mx=Math.max(1,...d.chart.map(c=>c.sum))
 const recent=[...d.dep.map(x=>({...x,k:'in'})),...d.wd.map(x=>({...x,k:'out'}))]
  .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8)
 return (<PayShell me={{balance:d.balance,name:d.name}}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>
  {struk&&<Struk item={struk.item} kind={struk.kind} onClose={()=>setStruk(null)} onMsg={setMsg}/>}
  {!d.on&&<div className="pay-note bad">QRIS Gateway sedang dinonaktifkan admin. Transaksi baru tidak bisa dibuat.</div>}
  {!d.acc.on&&<div className="pay-note bad">Akun gateway kamu dibekukan admin. Hubungi admin lewat Customer Service.</div>}

  <section className="pay-hero">
   <small>SALDO GATEWAY</small>
   <div className="num mono">{rp(d.balance)}</div>
   <div className="sub">Masuk hari ini <b>{rp(d.today.net)}</b> dari {d.today.count} transaksi · biaya layanan {d.fee}%{d.feeFlat>0?' + '+rp(d.feeFlat):''}</div>
   <div className="row">
    <a className="pb white" href="/pay/qris">▣ Buat QRIS</a>
    <a className="pb gh" href="/pay/withdraw" style={{background:'rgba(255,255,255,.16)',borderColor:'rgba(255,255,255,.3)',color:'#fff'}}>↗ Tarik Dana</a>
   </div>
  </section>

  <div className="pay-kpi">
   <div><small>Masuk 30 hari</small><b className="mono">{rp(d.month.net)}</b><i>{d.month.count} transaksi lunas</i></div>
   <div><small>Total diterima</small><b className="mono">{rp(d.all.net)}</b><i>dari {rp(d.all.gross)} bruto</i></div>
   <div><small>Menunggu bayar</small><b className="mono">{nf(d.pending)}</b><i>QRIS aktif</i></div>
   <div><small>Sudah ditarik</small><b className="mono">{rp(d.out.sum)}</b><i>{d.out.processing>0?d.out.processing+' sedang diproses':d.out.count+' penarikan'}</i></div>
  </div>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">📈</span><div><h2>Pemasukan 7 hari</h2><p>Nominal QRIS yang lunas per hari</p></div><span className="sp"/>
    <b className="mono" style={{fontSize:15}}>{rp(d.chart.reduce((a,c)=>a+c.sum,0))}</b></div>
   <div className="pay-chart">{d.chart.map((c,i)=>{const dd=new Date(c.at)
    return <div key={i} title={rp(c.sum)+' · '+c.count+' trx'}><i style={{height:Math.max(4,c.sum/mx*86)+'px'}}/><span>{dd.getDate()} {BL[dd.getMonth()]}</span></div>})}</div>
  </section>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">🧾</span><div><h2>Transaksi terbaru</h2><p>QRIS masuk & penarikan dana</p></div><span className="sp"/>
    <a className="pb gh sm" href="/pay/riwayat">Lihat semua</a></div>
   {recent.length===0
    ? <div className="pay-empty"><span className="em">▣</span>Belum ada transaksi.<br/><a className="pb sm" style={{marginTop:12}} href="/pay/qris">Buat QRIS pertama</a></div>
    : <div className="pay-list">{recent.map(x=><div key={x.transaction_id} className="pay-it">
      <span className="ic">{x.k==='in'?'↙':'↗'}</span>
      <span className="mid"><b className="mono">{x.k==='in'?rp(x.amount):rp(x.nominal)}</b>
       <small>{x.k==='in'?'QRIS masuk':'Tarik ke '+x.wallet} · {ago(x.created_at)} · {x.transaction_id}</small></span>
      <span className="amt"><span className={'st '+x.status}>{x.status}</span>
       {x.k==='in'&&x.status==='paid'&&<small style={{display:'block',marginTop:4}}>+{rp(x.net)}</small>}
       <button className="pb gh sm" style={{marginTop:5}} onClick={()=>setStruk({item:x,kind:x.k==='in'?'qris':'withdraw'})}>🧾</button></span></div>)}</div>}
  </section>

  <section className="pc">
   <div className="pc-h"><span className="pc-ic">⚡</span><div><h2>Integrasi developer</h2><p>Terima pembayaran langsung dari aplikasimu sendiri</p></div></div>
   <div className="pay-row">
    <a className="pb" href="/pay/docs">📖 Dokumentasi API</a>
    <a className="pb gh" href="/pay/profil">⚿ API Key & Webhook</a>
   </div>
   <div className="pay-note">Base URL <code className="mono">{typeof window!=='undefined'?location.origin:''}/api/pay</code> — semua balasan berbentuk <code className="mono">{'{success:true|false, ...}'}</code>.</div>
  </section>
 </PayShell>)}
