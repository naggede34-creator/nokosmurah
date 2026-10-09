export async function notify(text){
  const t=process.env.TELEGRAM_BOT_TOKEN,c=process.env.TELEGRAM_CHAT_ID
  if(!t||!c)return {ok:false,error:'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi'}
  try{const r=await fetch(`https://api.telegram.org/bot${t}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:c,text:'🌍 Artapedia ID\n'+text})});const d=await r.json();return {ok:!!d.ok,error:d.description}}
  catch(e){return {ok:false,error:e.message}}}
