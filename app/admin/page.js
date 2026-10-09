'use client'
import {useState} from 'react'
export default function A(){
 const [pw,setPw]=useState(''),[d,setD]=useState(null),[em,setEm]=useState(''),[n,setN]=useState(0),[t,setT]=useState('')
 const call=(a,b)=>fetch('/api/admin/'+a,{method:'POST',headers:{'Content-Type':'application/json','x-admin':pw},body:JSON.stringify(b||{})}).then(r=>r.json())
 const load=async()=>setD(await call('data'))
 const act=async(a,b)=>{const r=await call(a,b);if(r.error)alert(r.error);load()}
 const tes=async()=>{const r=await call('testnotif');alert(r.ok?'Notifikasi terkirim ke Telegram':'Gagal: '+r.error)}
 if(!d||d.error)return <div className="card"><h2>Admin Login</h2><input type="password" placeholder="Password" onChange={e=>setPw(e.target.value)}/><button className="btn blue" onClick={load}>Masuk</button></div>
 return <><div className="card"><h2>Admin Panel</h2><p>Markup: {d.cfg.markup}%</p>
 <input value={em} onChange={e=>setEm(e.target.value)} placeholder="Email user"/><input type="number" value={n} onChange={e=>setN(e.target.value)} placeholder="Nominal / persen"/>
 <div className="tabs"><button className="btn" onClick={()=>act('addsaldo',{email:em,amount:n})}>Add Saldo</button><button className="btn" onClick={()=>act('delsaldo',{email:em,amount:n})}>Del Saldo</button><button className="btn sil" onClick={()=>act('ban',{email:em})}>Ban</button><button className="btn sil" onClick={()=>act('unban',{email:em})}>Unban</button><button className="btn blue" onClick={()=>act('markup',{percent:n})}>Set Markup %</button></div></div>
 <div className="card"><h3>Server (klik untuk on/off)</h3><div className="tabs">{['warungnokos_s1','warungnokos_s2'].map(s=>{const off=d.cfg.off.includes(s);return <button key={s} className={'btn '+(off?'sil':'blue')} onClick={()=>act('server',{server:s,on:off})}>{s}: {off?'OFF':'ON'}</button>})}</div></div>
 <div className="card"><button className="btn" onClick={tes}>Tes Notifikasi Telegram</button></div>
 <div className="card"><textarea value={t} onChange={e=>setT(e.target.value)} placeholder="Broadcast"/><button className="btn blue" onClick={()=>act('broadcast',{text:t})}>Kirim Broadcast</button></div>
 <div className="card"><h3>Pengguna ({d.users.length})</h3><table><tbody>{d.users.map(u=><tr key={u.id}><td>{u.email}</td><td>Rp{u.balance}</td><td>{u.banned?'BANNED':'aktif'}</td></tr>)}</tbody></table></div></>}
