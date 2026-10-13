'use client'
import {useState,useEffect,useCallback,useRef} from 'react'
import PayShell,{api,rp,nf,Toast,Copy} from '../../../components/PayShell'
const PRESET=[2000,5000,10000,20000,25000,50000]
const fmt=s=>String(Math.max(0,Math.floor(+s||0))).replace(/\B(?=(\d{3})+(?!\d))/g,'.')
export default function BuatQris(){
 const [me,setMe]=useState(),[amt,setAmt]=useState(10000),[custom,setCustom]=useState(''),[tx,setTx]=useState(null)
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[now,setNow]=useState(Date.now()),[done,setDone]=useState(null)
 const alive=useRef(true)
 const load=useCallback(async()=>{const r=await api('v1/pay/me');if(!r.error){setMe(r)
  const open=(r.dep||[]).find(x=>x.status==='pending');if(open&&!tx)setTx(open)}},[tx])
 useEffect(()=>{load();return()=>{alive.current=false}},[])
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[])
 // polling status tiap 4 detik selama QRIS masih menunggu
 useEffect(()=>{if(!tx||tx.status!=='pending')return
  const f=async()=>{const r=await api('v1/pay/qris?id='+encodeURIComponent(tx.transaction_id))
   if(!alive.current||r.error)return
   setTx(r)
   if(r.status==='paid'){setDone(r);setMe(m=>m?{...m,balance:r.balance}:m);try{navigator.vibrate&&navigator.vibrate([120,60,120])}catch(e){}}
   else if(r.status!=='pending')setMsg('QRIS '+r.status)}
  const t=setInterval(f,4000);return()=>clearInterval(t)},[tx&&tx.transaction_id,tx&&tx.status])
 const nominal=custom!==''?Math.floor(+custom.replace(/\D/g,'')||0):amt
 const create=async()=>{setBusy(true);setDone(null)
  const r=await api('v1/pay/qris',{amount:nominal});setBusy(false)
  if(r.error)return setMsg(r.error)
  setTx(r);setMsg('QRIS siap dibayar')}
 const cancel=async()=>{if(!confirm('Batalkan QRIS ini?'))return
  const r=await api('v1/pay/qris/cancel',{id:tx.transaction_id})
  if(r.error)return setMsg(r.error);setTx(null);setMsg('QRIS dibatalkan');load()}
 const exp=tx&&tx.expired_at?new Date(tx.expired_at).getTime():0
 const left=Math.max(0,Math.floor((exp-now)/1000))
 const mm=String(Math.floor(left/60)).padStart(2,'0'),ss=String(left%60).padStart(2,'0')
 const total=exp&&tx?Math.max(1,(exp-new Date(tx.created_at).getTime())/1000):1
 const fee=me?Math.round(nominal*(+me.fee||0)/100)+(+me.feeFlat||0):0
 return <PayShell me={me?{balance:me.balance,name:me.name}:null}>
  <Toast msg={msg} onClose={()=>setMsg('')}/>

  {done?<section className="pc"><div className="qr-done">
    <div className="qr-tick">✓</div>
    <h2 style={{margin:0,fontSize:22}}>Pembayaran diterima</h2>
    <div className="qr-amt mono">{rp(done.amount)}<small style={{marginTop:6}}>MASUK SALDO {rp(done.net)}</small></div>
    <p style={{color:'var(--t2)',fontSize:13,margin:0}}>ID {done.transaction_id} · biaya layanan {rp(done.fee)}</p>
    <div className="pay-row" style={{justifyContent:'center',marginTop:6}}>
     <a className="pb" href={'/struk/'+done.transaction_id+'?t='+done.receipt_token}>🧾 Lihat struk</a>
     <button className="pb gh" onClick={()=>{setDone(null);setTx(null);load()}}>Buat QRIS lagi</button></div>
   </div></section>

  :tx&&tx.status==='pending'?<section className="pc"><div className="qr-wrap">
    <div className="qr-amt mono">{rp(tx.total_paid)}<small>BAYAR TEPAT SEJUMLAH INI</small></div>
    <div className="qr-box">{tx.qr_image?<img src={tx.qr_image} alt="Kode QRIS"/>
     :<div style={{padding:30,color:'#334',fontSize:13,textAlign:'center'}}>Gambar QR tidak tersedia. Salin QR string di bawah lalu render di aplikasimu.</div>}</div>
    <div className={'qr-timer'+(left<60?' hot':'')}>⏳ Berlaku {mm}:{ss}</div>
    <div className="qr-bar"><i style={{width:Math.max(0,Math.min(100,left/total*100))+'%'}}/></div>
    <p style={{color:'var(--t2)',fontSize:12.5,margin:'2px 0 0',lineHeight:1.6}}>
     Scan dengan aplikasi apa saja yang mendukung QRIS.<br/>Nominal diminta <b className="mono">{rp(tx.amount)}</b> · masuk saldo <b className="mono">{rp(tx.net)}</b> setelah biaya {rp(tx.fee)}.</p>
    <div className="pay-row" style={{justifyContent:'center'}}>
     <Copy text={tx.qr_string} label="Salin QR string" onMsg={setMsg}/>
     <a className="pb gh sm" href={'/struk/'+tx.transaction_id+'?t='+tx.receipt_token} target="_blank" rel="noreferrer">Bagikan struk</a>
     <button className="pb bad sm" onClick={cancel}>Batalkan</button></div>
    <div className="pay-code" style={{width:'100%'}}><code>{tx.transaction_id}</code><Copy text={tx.transaction_id} label="Salin ID" onMsg={setMsg}/></div>
   </div></section>

  :<>
   <section className="pc">
    <div className="pc-h"><span className="pc-ic">▣</span><div><h2>Buat QRIS</h2><p>Pilih nominal, QR langsung terbit dan dana masuk otomatis saat dibayar</p></div></div>
    <div className="pay-amt">{PRESET.map(v=><button key={v} className={custom===''&&amt===v?'on':''} onClick={()=>{setAmt(v);setCustom('')}}>
     {v>=1000?(v/1000)+'K':v}<span>Rp{fmt(v)}</span></button>)}</div>
    <div className="pay-fld" style={{marginTop:16}}>
     <label className="pf-l" htmlFor="cu">Atau isi nominal sendiri</label>
     <input id="cu" className="pin mono" inputMode="numeric" placeholder={me?`Rp${fmt(me.min)} - Rp${fmt(me.max)}`:'Masukkan nominal'}
      value={custom?'Rp'+fmt(custom):''} onChange={e=>setCustom(e.target.value.replace(/\D/g,''))}/>
    </div>
    {me&&<div className="pay-note">
     Nominal diminta <b className="mono">{rp(nominal)}</b> · biaya layanan {me.fee}%{me.feeFlat>0?' + '+rp(me.feeFlat):''} = <b className="mono">{rp(fee)}</b> · masuk saldo <b className="mono">{rp(Math.max(0,nominal-fee))}</b>.
     <br/>Pembeli membayar sedikit lebih besar karena biaya penyedia QRIS ditambahkan di atasnya — nilai pastinya muncul di layar QR.</div>}
    <button className="pb wide" style={{marginTop:14}} disabled={busy||!me||!(nominal>=(me?me.min:1))} onClick={create}>
     {busy?'Membuat QRIS…':'▣ Terbitkan QRIS '+rp(nominal)}</button>
    {me&&!me.on&&<div className="pay-note bad">Gateway sedang dinonaktifkan admin.</div>}
   </section>

   {me&&me.dep&&me.dep.length>0&&<section className="pc">
    <div className="pc-h"><span className="pc-ic">🕘</span><div><h2>QRIS terakhir</h2><p>5 transaksi terbaru</p></div></div>
    <div className="pay-list">{me.dep.slice(0,5).map(x=><div key={x.transaction_id} className="pay-it">
     <span className="ic">▣</span>
     <span className="mid"><b className="mono">{rp(x.amount)}</b><small>{x.transaction_id}</small></span>
     <span className="amt"><span className={'st '+x.status}>{x.status}</span></span></div>)}</div>
   </section>}
  </>}
 </PayShell>}
