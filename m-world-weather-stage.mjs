/**
 * Lightweight ambient particles. The overlay never catches pointer input
 * and stops drawing when hidden or reduced-motion is requested.
 */
import {weatherVisual} from './m-world-weather.mjs?v=66&sky=67';

export function mountWeatherStage({doc=document,view=window}={}){
 const style=doc.createElement('style');style.dataset.mWeatherStyle='true';
 style.textContent=[
  '.m-weather-sky{position:fixed;inset:0;z-index:3;pointer-events:none;overflow:hidden;contain:strict}',
  '.m-weather-sky canvas{display:block;width:100%;height:100%;pointer-events:none}',
  '.m-weather-status{position:fixed;bottom:12px;left:12px;z-index:4;pointer-events:auto;',
  'font:500 11px/1.45 system-ui,-apple-system,sans-serif;letter-spacing:.01em;color:#d1dfeb;',
  'background:rgba(13,27,45,.68);border:1px solid rgba(183,216,242,.15);border-radius:999px;',
  'box-shadow:0 4px 20px rgba(0,0,0,.10);padding:5px 10px;max-width:min(80vw,440px);',
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;backdrop-filter:blur(7px)}',
  '.m-weather-status a{color:#c4eaff;text-decoration:underline;text-underline-offset:2px}',
  '.m-weather-status[hidden],.m-weather-sky[hidden]{display:none!important}',
  '@media(max-width:720px){.m-weather-status{bottom:calc(8px + env(safe-area-inset-bottom));left:8px;',
  'max-width:55vw;font-size:10px;padding:4px 7px}}',
  '@media(prefers-reduced-motion:reduce){.m-weather-sky{display:none!important}}'
 ].join('');
 const shell=doc.createElement('div');shell.className='m-weather-sky';shell.dataset.mOverlay='true';
 shell.setAttribute('aria-hidden','true');shell.hidden=true;
 const canvas=doc.createElement('canvas');shell.append(canvas);
 const label=doc.createElement('div');label.className='m-weather-status';label.dataset.mOverlay='true';label.hidden=true;
 label.setAttribute('role','status');label.setAttribute('aria-live','polite');
 doc.head.append(style);doc.body.append(shell,label);
 const ctx=canvas.getContext('2d',{alpha:true});
 const motion=view.matchMedia('(prefers-reduced-motion: reduce)');
 let sample=null,visual=weatherVisual(null),raf=null,frameTime=0,width=0,height=0,disposed=false;
 const drops=Array.from({length:110},(_,i)=>({
  x:(i*47.7)%1024,y:(i*187.1)%850,speed:.55+(i%9)*.09,length:7+(i%7)*2.3
 }));
 function size(){
  width=Math.max(0,view.innerWidth||0);height=Math.max(0,view.innerHeight||0);
  const ratio=Math.min(1.25,Math.max(1,view.devicePixelRatio||1));
  if(!width||!height||!ctx)return;
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
 }
 function labelText(value){
  const condition=({rain:'chuva',snow:'neve',cloudy:'nublado','partly-cloudy':'algumas nuvens',
   clear:'céu limpo',unknown:'vento'})[value.condition]||'tempo variável';
  const temp=Number.isFinite(value.temperatureC)?' · '+Math.round(value.temperatureC)+' °C':'';
  return 'Leiria'+temp+' · '+condition+' · '+value.source;
 }
 function draw(now){
  raf=null;if(disposed||doc.hidden||motion.matches||shell.hidden||!ctx)return;
  if(now-frameTime<48){raf=view.requestAnimationFrame(draw);return;}
  const elapsed=Math.min(80,Math.max(12,now-frameTime||50)),dt=elapsed/50;
  frameTime=now;ctx.clearRect(0,0,width,height);
  const {rain,snow,wind,cloud,drift,night}=visual;
  const cloudAlpha=Math.min(.14,cloud*.14);
  if(cloudAlpha>.008){
   for(let i=0;i<(width<720?2:3);i++){
    const x=((width*(.18+i*.37)+(now*.0025*(.2+wind)*Math.sign(drift||1)))%(width+500)+width+500)%(width+500)-250;
    const y=48+(i%2)*85,rx=Math.min(width*.42,300)*(1+(i%2)*.27),ry=36+(i%3)*9;
    const grad=ctx.createRadialGradient(x,y,7,x,y,rx);
    grad.addColorStop(0,'rgba(192,210,231,'+cloudAlpha+')');
    grad.addColorStop(1,'rgba(192,210,231,0)');
    ctx.fillStyle=grad;ctx.save();ctx.translate(x,y);ctx.scale(1,ry/rx);
    ctx.beginPath();ctx.arc(0,0,rx,0,Math.PI*2);ctx.fill();ctx.restore();
   }
  }
  const count=Math.floor((width<720?40:78)*Math.max(rain,snow));
  if(count>0){
   ctx.lineWidth=rain>0?1:2;ctx.strokeStyle=night?'rgba(196,217,242,.22)':'rgba(208,227,252,.28)';
   ctx.fillStyle='rgba(223,233,249,.42)';ctx.beginPath();
   for(let i=0;i<count;i++){
    const d=drops[i],speed=(rain?15:5)*d.speed*dt*(.55+rain+snow);
    d.y+=speed;d.x+=drift*speed*(rain?.7:1.1);
    if(d.y>height+20){d.y=-30;d.x=(i*73.7+now*.013)%(width+40)-20;}
    if(d.x< -30)d.x=width+20;if(d.x>width+30)d.x=-20;
    if(rain){ctx.moveTo(d.x,d.y);ctx.lineTo(d.x+drift*d.length*.8,d.y+d.length*(.55+rain));}
    else{ctx.moveTo(d.x+2,d.y);ctx.arc(d.x,d.y,1.4,0,Math.PI*2);}
   }
   if(rain)ctx.stroke();else ctx.fill();
  }
  if(wind>.35&&rain<.3){
   ctx.strokeStyle='rgba(202,226,247,'+(wind*.10)+')';ctx.lineWidth=.9;ctx.beginPath();
   for(let i=0;i<Math.min(6,Math.floor(wind*8));i++){
    const x=(now*.014*(.5+wind)+i*187)%(width+150)-75,y=90+i*97;
    ctx.moveTo(x,y);ctx.quadraticCurveTo(x+35,y-6,x+80,y);
   }ctx.stroke();
  }
  raf=view.requestAnimationFrame(draw);
 }
 function stop(){if(raf!==null)view.cancelAnimationFrame(raf);raf=null;ctx?.clearRect(0,0,width,height);}
 function restart(){
  stop();if(disposed)return;
  const moving=visual.rain>.02||visual.snow>.02||visual.cloud>.24||visual.wind>.4;
  shell.hidden=!moving||motion.matches||doc.hidden||!ctx;
  if(!shell.hidden){size();frameTime=0;raf=view.requestAnimationFrame(draw);}
 }
 function setWeather(value){
  if(disposed)return;
  sample=value?.status==='ready'?value:null;visual=weatherVisual(sample);label.hidden=!sample;
  if(sample){
   label.textContent=labelText(sample);
   label.title='Previsão aproximada para Leiria (não observação local) · '+sample.source;
   if(sample.source==='MET Norway'){
    label.textContent=labelText(sample).replace(' · MET Norway',' · previsão: ');
    const credit=doc.createElement('a'),license=doc.createElement('a');
    credit.href='https://api.met.no/';credit.target='_blank';credit.rel='noopener noreferrer';
    credit.textContent='MET Norway';
    license.href='https://creativecommons.org/licenses/by/4.0/';
    license.target='_blank';license.rel='noopener noreferrer';license.textContent='CC BY 4.0';
    label.append(credit,doc.createTextNode(' · '),license);
   }
  }
  else{label.textContent='';label.title='';}
  restart();
 }
 const visibility=()=>restart(),resize=()=>{size();restart();};
 doc.addEventListener('visibilitychange',visibility);view.addEventListener('resize',resize,{passive:true});
 motion.addEventListener('change',visibility);size();
 return {setWeather,snapshot:()=>({ready:!!sample,condition:sample?.condition||'unavailable',
  source:sample?.source||null,rain:visual.rain,cloud:visual.cloud,wind:visual.wind,active:!shell.hidden}),
  destroy(){disposed=true;stop();doc.removeEventListener('visibilitychange',visibility);
   view.removeEventListener('resize',resize);motion.removeEventListener('change',visibility);
   shell.remove();label.remove();style.remove();}
 };
}
