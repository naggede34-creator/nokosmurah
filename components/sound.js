// Bunyi "ting-tung" lewat WebAudio (tanpa file). Browser baru mau bunyi setelah pengguna menyentuh layar sekali -> unlock().
let ctx
export const unlock=()=>{try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume()}catch(e){}}
export function ting(){
 try{unlock();if(!ctx)return
  const t=ctx.currentTime
  // TING (tinggi) lalu TUNG (rendah), keras, dengan overtone supaya nyaring
  ;[[1318.5,0,.55],[987.8,.34,.9]].forEach(([f,d,len])=>{
   for(const [m,type,vol] of [[1,'sine',1],[2,'triangle',.45],[3,'sine',.2]]){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f*m
    g.gain.setValueAtTime(0.0001,t+d);g.gain.exponentialRampToValueAtTime(vol,t+d+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d+len)
    o.connect(g);g.connect(ctx.destination);o.start(t+d);o.stop(t+d+len+.05)}})
  if(navigator.vibrate)navigator.vibrate([120,60,120])
 }catch(e){}}
