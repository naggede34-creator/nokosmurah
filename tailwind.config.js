/** @type {import('tailwindcss').Config} */
module.exports={
 content:['./app/**/*.{js,jsx}','./components/**/*.{js,jsx}'],
 // preflight dimatikan supaya CSS lama (globals.css) di dashboard/admin/docs tidak berubah tampilannya
 corePlugins:{preflight:false},
 theme:{extend:{
  colors:{night:{950:'#060a1f',900:'#0a1030',800:'#111a45'},brand:{400:'#6ea0ff',500:'#3b82f6',600:'#1f5fe0',700:'#1a47b3'},sun:'#ffb703'},
  boxShadow:{glow:'0 0 0 1px rgba(255,255,255,.08),0 20px 60px -20px rgba(31,95,224,.5)',lift:'0 1px 0 rgba(255,255,255,.6) inset,0 18px 40px -18px rgba(37,99,235,.45)'},
  keyframes:{shimmer:{'100%':{transform:'translateX(100%)'}},blob:{'0%,100%':{transform:'translate(0,0) scale(1)'},'33%':{transform:'translate(40px,-30px) scale(1.12)'},'66%':{transform:'translate(-30px,30px) scale(.94)'}},rise:{'0%':{transform:'translateY(0)',opacity:0},'15%':{opacity:.9},'100%':{transform:'translateY(-110vh)',opacity:0}}},
  animation:{shimmer:'shimmer 2.2s infinite',blob:'blob 18s ease-in-out infinite',rise:'rise 14s linear infinite'}}},
 plugins:[]}
