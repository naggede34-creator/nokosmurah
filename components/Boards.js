'use client'
import {useState,useEffect} from 'react'
const get=p=>fetch('/api/'+p).then(r=>r.json()).catch(()=>({}))
export const rp=n=>'Rp'+(+n||0).toLocaleString('id-ID')
export const mask=e=>{e=String(e||'');const [a,d]=e.split('@');if(!d)return a?a.slice(0,2)+'***':'***';return a.slice(0,Math.min(2,a.length))+'***'+(a.length>3?a.slice(-1):'')+'@'+d}
export const tgl=t=>new Date(t).toLocaleString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace('.',':')+' WIB'
export function useBoard(){const [d,setD]=useState(null);useEffect(()=>{get('v1/leaderboard').then(setD)},[]);return d}
export function Announcements({limit,dense}){
 const [a,setA]=useState(null)
 useEffect(()=>{get('v1/announcements').then(d=>setA(d.items||[]))},[])
 if(!a)return <div className="bd-ann">{[0,1].map(i=><div key={i} className="bd-skel"/>)}</div>
 if(!a.length)return <div className="bd-empty">📭 Belum ada pengumuman.</div>
 return <div className="bd-ann">{a.slice(0,limit||50).map(x=><article key={x.id} className="bd-card">
  {x.img&&<img src={x.img} alt="" className="bd-img"/>}
  <div className="bd-body"><span className="bd-chip">📣 Pengumuman</span><h3>{x.title}</h3><time>{tgl(x.at)}</time>
  {!dense&&x.body&&<p>{x.body}</p>}{dense&&x.body&&<p>{x.body.slice(0,120)}{x.body.length>120?'…':''}</p>}</div></article>)}</div>}
const MD=['🥇','🥈','🥉']
const ML={trx:'transaksi sukses terbanyak',spent:'belanja terbanyak'}
export function Leaderboard({me,limit=10,data}){
 const own=useBoard(),d=data||own,[t,setT]=useState('bal'),mine=me?mask(me):null
 if(!d)return <div className="bd-skel"/>
 const on=k=>{const x=k==='wk'?d.week:d.month;return !!(x&&x.on&&(x.prizes||[]).length>0)}
 const per=t==='wk'||t==='mo',pd=t==='wk'?d.week:d.month,pOn=per&&on(t),pz=pOn?pd.prizes:[]
 const list=t==='bal'?d.bal:t==='trx'?d.trx:t==='wk'?(d.wk||[]):(d.mo||[]),rows=list.slice(0,limit)
 const left=pOn?Math.max(0,pd.end-Date.now()):0,dl=Math.floor(left/864e5),hl=Math.floor(left%864e5/36e5)
 const last=t==='wk'?d.last:t==='mo'?d.lastMonth:null
 return <div className="bd-lb"><div className="bd-tabs"><button className={t==='bal'?'on':''} onClick={()=>setT('bal')}>💰 Saldo terbanyak</button><button className={t==='trx'?'on':''} onClick={()=>setT('trx')}>🏆 Transaksi terbanyak</button>{on('wk')&&<button className={t==='wk'?'on':''} onClick={()=>setT('wk')}>🎁 Mingguan</button>}{on('mo')&&<button className={t==='mo'?'on':''} onClick={()=>setT('mo')}>📆 Bulanan</button>}</div>
  {pOn&&<div className="bd-prize"><small>🎁 HADIAH {t==='wk'?'MINGGUAN':'BULANAN'}</small><h3>Pembeli terbanyak dapat hadiah!</h3><p>Juara {ML[pd.metric]||ML.trx} {t==='wk'?'minggu':'bulan'} ini dapat saldo gratis. {t==='wk'?'Periode Senin 00.00 WIB':'Periode tanggal 1 00.00 WIB'}, reset {dl>0?dl+' hari '+hl+' jam':hl+' jam'} lagi.</p><div className="bd-pz">{pz.map((v,i)=><span key={i}>{MD[i]||'#'+(i+1)} {rp(v)}</span>)}</div></div>}
  {!rows.length&&<div className="bd-empty">{per?'Belum ada transaksi periode ini. Jadilah yang pertama!':'Belum ada data.'}</div>}
  {rows.map((r,i)=><div key={i} className={'bd-row r'+i+(r.u===mine?' me':'')}><span className="bd-rk">{MD[i]||i+1}</span><div className="bd-who"><b>{r.u}</b>{r.u===mine&&<em>Kamu</em>}<small>{t==='bal'?r.trx+' transaksi sukses':per?(pd.metric==='spent'?r.trx+' transaksi':'Belanja '+rp(r.spent)):'Belanja '+rp(r.spent)}</small></div><strong className="mono">{t==='bal'?rp(r.balance):per?(pd.metric==='spent'?rp(r.spent):r.trx+' trx'):r.trx+' trx'}</strong>{per&&pz[i]>0&&<span className="bd-gift">+{rp(pz[i])}</span>}</div>)}
  {last&&last.winners&&last.winners.length>0&&<div className="bd-last"><b>🏅 Juara {t==='wk'?'minggu':'bulan'} lalu</b>{last.winners.map(w=><div key={w.rank}><span>{MD[w.rank-1]||'#'+w.rank} {w.u}</span><em>+{rp(w.prize)}</em></div>)}</div>}</div>}
