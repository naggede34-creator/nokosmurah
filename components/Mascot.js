'use client'
import {useState} from 'react'
export default function Mascot(){
 const [t,setT]=useState({x:0,y:0})
 return <div className="stage" onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();setT({x:((e.clientY-r.top)/r.height-.5)*-24,y:((e.clientX-r.left)/r.width-.5)*30})}} onMouseLeave={()=>setT({x:0,y:0})}>
  <div className="orbit"><i>🔑 4821</i><i>OTP 937</i><i>✅ 2610</i></div>
  <div className="globe" style={{transform:`rotateX(${t.x}deg) rotateY(${t.y}deg)`}}>
   <span className="land a"/><span className="land b"/><span className="land c"/>
   <span className="eye l"/><span className="eye r"/><span className="cheek l"/><span className="cheek r"/><span className="mouth"/>
   <span className="sheen"/></div>
  <span className="arm l"/><span className="arm r"/>
  <div className="ring"/></div>}
