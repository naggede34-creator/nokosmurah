'use client'
import {useEffect,useState} from 'react'
import {motion} from 'framer-motion'
import {Sun,Moon} from 'lucide-react'

// Pilihan tema pengguna: terang (bawaan) atau gelap. Disimpan di localStorage "arta-theme",
// dipasang ke <html data-theme> oleh skrip kecil di layout supaya tidak berkedip saat halaman dibuka.
export const THEME_KEY='arta-theme'
export const THEME_INIT=`try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`
const META={light:'#f4f7fc',dark:'#0a1120'}

export function useTheme(){
 const [t,setT]=useState('light')
 useEffect(()=>{setT(document.documentElement.dataset.theme==='dark'?'dark':'light')},[])
 const set=n=>{
  document.documentElement.dataset.theme=n
  try{localStorage.setItem(THEME_KEY,n)}catch(e){}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',META[n])
  setT(n)}
 return [t,set]}

export default function ThemeToggle({className=''}){
 const [t,set]=useTheme()
 return <div role="group" aria-label="Pilih tema tampilan" className={'fx-tgl '+className}>
  {[['light','Mode terang',Sun],['dark','Mode gelap',Moon]].map(([k,l,I])=>
   <button key={k} type="button" aria-label={l} title={l} aria-pressed={t===k} onClick={()=>set(k)}>
    {t===k&&<motion.span layoutId="fx-thumb" className="thumb" transition={{type:'spring',stiffness:420,damping:30}}/>}
    <I size={16}/></button>)}
 </div>}
