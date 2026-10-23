(()=>{"use strict";
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const layer=document.createElement("div");layer.className="mascot-world";
layer.innerHTML='<button class="mascot-traveler" type="button" aria-label="Play with the floating mascot" title="Play with me"><span class="mascot-antenna"></span><span class="mascot-shell"><span class="mascot-eye eye-left"></span><span class="mascot-eye eye-right"></span><span class="mascot-smile"></span></span><span class="mascot-feet"></span><span class="mascot-knock" aria-hidden="true">knock knock!</span></button>';
document.body.appendChild(layer);
const buddy=layer.querySelector(".mascot-traveler"),knock=layer.querySelector(".mascot-knock");
let x=innerWidth*.7,y=innerHeight*.55,vx=0,vy=0,tx=x,ty=y;
let last=0,nextMove=0,lastInteraction=performance.now(),lastKnock=0,knockUntil=0,knockAt=0,hideTimer=0;
let state="wander",hidden=false;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function destination(now){
 const w=innerWidth,h=innerHeight,margin=w<720?28:45;
 tx=margin+Math.random()*Math.max(1,w-margin*2-65);
 ty=100+Math.random()*Math.max(1,h-230);
 nextMove=now+1800+Math.random()*2900;
 state="wander";
}
function showKnock(now){
 if(reduced||hidden||now-lastKnock<14000)return;
 lastKnock=now;knockUntil=now+1650;state="knock";
 tx=clamp(x,25,innerWidth-85);ty=clamp(y,105,innerHeight-120);
 buddy.classList.add("is-knocking");
 knock.textContent="knock knock!";
 knock.hidden=false;
 clearTimeout(hideTimer);
 hideTimer=setTimeout(()=>{knock.hidden=true;buddy.classList.remove("is-knocking");state="wander";nextMove=0;},1650);
}
function frame(now){
 if(hidden)return;
 if(!last){last=now;destination(now);}
 const dt=Math.min(2.2,(now-last)/16.67);last=now;
 if(!reduced){
   if(now>nextMove&&state==="wander")destination(now);
   if(now-lastInteraction>5200&&now-lastKnock>16000&&state==="wander")showKnock(now);
   const accel=state==="knock"?.009:.006;
   vx=(vx+(tx-x)*accel*dt)*Math.pow(.92,dt);
   vy=(vy+(ty-y)*accel*dt)*Math.pow(.92,dt);
   const speed=Math.hypot(vx,vy),cap=state==="knock"?3.5:4.5;
   if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
   x+=vx*dt;y+=vy*dt;
   x=clamp(x,4,Math.max(4,innerWidth-74));y=clamp(y,75,Math.max(75,innerHeight-95));
   buddy.style.transform="translate3d("+x.toFixed(1)+"px,"+y.toFixed(1)+"px,0) rotate("+clamp(vx*3,-15,15).toFixed(1)+"deg)";
   buddy.classList.toggle("travel-left",vx<-.15);
 }else{
   buddy.style.transform="translate3d("+clamp(innerWidth-90,5,innerWidth)+"px,"+clamp(innerHeight-140,80,innerHeight)+"px,0)";
 }
 requestAnimationFrame(frame);
}
function activity(){lastInteraction=performance.now();if(state==="knock"){clearTimeout(hideTimer);knock.hidden=true;buddy.classList.remove("is-knocking");state="wander";nextMove=0;}}
window.addEventListener("scroll",activity,{passive:true});
window.addEventListener("pointerdown",e=>{if(!buddy.contains(e.target))activity();},{passive:true});
buddy.addEventListener("click",()=>{activity();buddy.classList.add("mascot-excited");setTimeout(()=>buddy.classList.remove("mascot-excited"),700);tx=clamp(x+(Math.random()-.5)*220,15,innerWidth-85);ty=clamp(y-90,85,innerHeight-100);nextMove=performance.now()+1500;});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){last=performance.now();nextMove=0;}});
knock.hidden=true;requestAnimationFrame(frame);
})();
