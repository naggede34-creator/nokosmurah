import './globals.css'
import './tailwind.css'
import './fx.css'
import './ui2.css'
import './comic.css'
import CsFab from '../components/CsFab'
import Shell from '../components/Shell'
import {THEME_INIT} from '../components/ThemeToggle'
export const metadata={title:'Artapedia ID - Nokos & OTP Otomatis',description:'Beli nomor OTP murah, cepat, otomatis'}
export const viewport={width:'device-width',initialScale:1,themeColor:'#f4f7fc'}
export default function L({children}){return <html lang="id" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:THEME_INIT}}/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Nunito:wght@600;800;900&display=swap"/></head><body>
<Shell>{children}</Shell><CsFab/></body></html>}
