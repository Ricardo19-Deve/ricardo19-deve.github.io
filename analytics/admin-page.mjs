/** Private dashboard HTML and separate same-origin JS; no public credentials. */
export const adminHtml=String.raw`<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer">
<title>Portfolio · Private analytics</title>
<style>
:root{color-scheme:dark;font:400 15px/1.5 system-ui,-apple-system,sans-serif;background:#09111e;color:#eef6ff}
*{box-sizing:border-box}body{margin:0;padding:28px min(4vw,38px)}main{max-width:1120px;margin:auto}
h1{font-size:clamp(24px,3vw,36px);margin:0 0 4px;letter-spacing:-.04em}
h2{font-size:18px;margin:0 0 18px}.sub{color:#a4bed4;margin:0 0 28px}
.card{border:1px solid #33485d;border-radius:19px;background:#111e30;padding:22px}
header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px;margin-bottom:26px}
button,input,select{font:inherit}button{background:#c0eefd;color:#102235;border:0;border-radius:11px;padding:11px 15px;font-weight:650;cursor:pointer}
button.secondary{border:1px solid #58718a;background:#1d3148;color:#e4f4ff}
button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #94e5ff;outline-offset:3px}
label{display:block;font-size:13px;color:#c2d6e8;margin-bottom:8px}
input{width:100%;padding:13px;border-radius:11px;border:1px solid #60778d;background:#0c1726;color:white}
#login{max-width:450px;margin:8vh auto}#login button{margin-top:15px;width:100%}
.metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
.metric strong{display:block;font-size:clamp(25px,3vw,40px);letter-spacing:-.04em}
.metric span{color:#9ebad1;font-size:13px}
.graph{display:flex;align-items:flex-end;gap:4px;height:215px;overflow:hidden;border-bottom:1px solid #435b75;padding-top:15px}
.bar{flex:1;min-width:3px;max-width:30px;background:linear-gradient(0deg,#387baf,#9ee5ed);border-radius:4px 4px 0 0;min-height:1px}
.graph-labels{display:flex;justify-content:space-between;margin-top:9px;color:#9fb4cb;font-size:12px}
.pages{width:100%;border-collapse:collapse}.pages th,.pages td{padding:10px;border-bottom:1px solid #31455b;text-align:left}.pages td:last-child,.pages th:last-child{text-align:right}
.bottom{margin-top:18px;display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:16px}
.notice{font-size:12px;color:#9fb5ca}#error{color:#ffb4ad;min-height:22px}
[hidden]{display:none!important}
@media(max-width:700px){body{padding:18px}.metrics{grid-template-columns:1fr}.bottom{grid-template-columns:1fr}.card{padding:16px}}
</style>
</head><body><main>
<header><div><h1>Portfolio insights</h1><p class="sub">Visitas e sessões por dia · Hora de Lisboa · Só para ti</p></div><div id="controls" hidden><button id="refresh" class="secondary">Atualizar</button> <button id="logout" class="secondary">Terminar sessão</button></div></header>
<section id="login" class="card"><h2>Área privada</h2><form id="login-form"><label for="token">Chave privada do proprietário</label><input id="token" type="password" autocomplete="off" spellcheck="false" required placeholder="Chave privada"><button type="submit">Ver estatísticas</button></form><p class="notice">A chave não é guardada no navegador. Não partilhes este acesso.</p></section>
<section id="report" hidden>
<div class="metrics">
<div class="card metric"><span>Visualizações hoje</span><strong id="today">—</strong></div>
<div class="card metric"><span>Sessões hoje (estimadas)</span><strong id="sessions">—</strong></div>
<div class="card metric"><span>Visualizações nos últimos 30 dias</span><strong id="month">—</strong></div>
</div>
<div class="bottom">
<section class="card"><h2>Visualizações por dia</h2><div class="graph" id="chart" role="img" aria-label="Gráfico diário de visualizações"></div><div class="graph-labels"><span id="first-day"></span><span id="last-day"></span></div></section>
<section class="card"><h2>Páginas mais visitadas</h2><table class="pages"><thead><tr><th>Página</th><th>Views</th></tr></thead><tbody id="pages"></tbody></table></section>
</div>
<p class="notice">Sem IPs, cookies de terceiros ou identificação de pessoas. As sessões são estimativas por separador do navegador, não visitantes únicos.</p>
</section><p id="error" role="status" aria-live="polite"></p>
</main><script src="/admin.js" defer></script></body></html>`;
export const adminScript=String.raw`(()=>{'use strict';
 const $=id=>document.getElementById(id),number=value=>new Intl.NumberFormat('pt-PT').format(value||0);
 let secret='';
 async function load(){
  $('error').textContent='';
  try{
   const response=await fetch('/api/summary?days=30',{headers:{Authorization:'Bearer '+secret},cache:'no-store',credentials:'omit'});
   if(!response.ok)throw new Error(response.status===401?'Chave inválida.':'Não foi possível carregar as estatísticas.');
   const data=await response.json(),rows=data.series||[],today=rows[rows.length-1]||{};
   $('today').textContent=number(today.pageviews);
   $('sessions').textContent=number(today.sessions);
   $('month').textContent=number(data.totals?.pageviews);
   const chart=$('chart');chart.replaceChildren();
   const max=Math.max(1,...rows.map(row=>Number(row.pageviews)||0));
   for(const row of rows){const bar=document.createElement('div');bar.className='bar';bar.style.height=Math.max(.5,Math.round(100*(Number(row.pageviews)||0)/max))+'%';bar.title=row.day+': '+number(row.pageviews)+' visualizações';chart.append(bar);}
   $('first-day').textContent=rows[0]?.day||'';
   $('last-day').textContent=rows[rows.length-1]?.day||'';
   const pages=$('pages');pages.replaceChildren();
   for(const entry of data.pages||[]){const tr=document.createElement('tr'),name=document.createElement('td'),count=document.createElement('td');name.textContent=entry.path;count.textContent=number(entry.pageviews);tr.append(name,count);pages.append(tr);}
   $('login').hidden=true;$('report').hidden=false;$('controls').hidden=false;$('token').value='';
  }catch(e){$('error').textContent=e.message||'Erro de ligação.';$('report').hidden=true;}
 }
 $('login-form').addEventListener('submit',event=>{event.preventDefault();secret=$('token').value;load();});
 $('refresh').addEventListener('click',load);
 $('logout').addEventListener('click',()=>{secret='';$('report').hidden=true;$('controls').hidden=true;$('login').hidden=false;$('token').value='';$('error').textContent='';});
})();`;
