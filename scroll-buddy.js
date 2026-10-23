(()=>{"use strict";
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const layer=document.createElement("div");layer.className="mascot-world";
layer.innerHTML='<button class="mascot-traveler" type="button" aria-label="Play with the floating companion" title="Play with me"><span class="mascot-tail"></span><span class="mascot-ear ear-left"></span><span class="mascot-ear ear-right"></span><span class="mascot-shell"><span class="mascot-eye eye-left"></span><span class="mascot-eye eye-right"></span><span class="mascot-cheek cheek-left"></span><span class="mascot-cheek cheek-right"></span><span class="mascot-smile"></span></span><span class="mascot-feet"></span><span class="mascot-sparkle">✦</span><span class="mascot-knock" hidden>knock knock!</span></button>';
document.body.appendChild(layer);
const buddy=layer.querySelector(".mascot-traveler"),knock=layer.querySelector(".mascot-knock");
const targets=()=>Array.from(document.querySelectorAll(".card,.role,.about-tile,.hero-visual,.about-statement,.case-teaser,.cert,.project-filters,.section-head")).filter(el=>{const r=el.getBoundingClientRect();return r.width>95&&r.height>50&&r.bottom>100&&r.top<innerHeight-70;});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let x=innerWidth*.75,y=innerHeight*.5,vx=0,vy=0,tx=x,ty=y,last=0,next=0,mode="explore",modeEnd=0;
let idle=performance.now(),lastKnock=0,playUntil=0,blinkUntil=0,visible=true,peekSide=1,scrollLast=scrollY;
function setDestination(now){
 const w=innerWidth,h=innerHeight,cards=targets(),roll=Math.random();
 mode="explore";modeEnd=now+1400+Math.random()*1700;
 if(cards.length&&roll<.72){
  const el=cards[Math.floor(Math.random()*cards.length)],r=el.getBoundingClientRect();
  peekSide=Math.random()<.5?-1:1;
  // Approach a card edge and partially hide behind it, then peek out.
  tx=clamp(peekSide<0?r.left-26:r.right-39,8,w-75);
  ty=clamp(r.top+Math.min(r.height*.42,105),85,h-110);
  mode="peek";modeEnd=now+1900+Math.random()*1700;
 }else{
  tx=clamp(20+Math.random()*(w-100),8,w-75);
  ty=clamp(90+Math.random()*(h-210),85,h-110);
 }
 next=modeEnd;
}
function surprise(now){
 if(reduced||now-idle<6500||now-lastKnock<20000)return false;
 lastKnock=now;mode="knock";modeEnd=now+1700;next=modeEnd;
 tx=clamp(x,15,innerWidth-85);ty=clamp(y,85,innerHeight-110);
 buddy.classList.add("is-knocking");knock.hidden=false;
 return true;
}
function finishKnock(){knock.hidden=true;buddy.classList.remove("is-knocking");mode="explore";next=0;}
function animate(now){
 if(!visible)return;
 if(!last){last=now;setDestination(now);}
 const dt=Math.min(2,(now-last)/16.67);last=now;
 if(!reduced){
  if(mode==="knock"&&now>=modeEnd)finishKnock();
  if(now>next){if(!surprise(now))setDestination(now);}
  // Pause to peek from behind the selected card before swimming away.
  const easing=mode==="peek"?.0065:.011;
  vx=(vx+(tx-x)*easing*dt)*Math.pow(mode==="peek"?.87:.91,dt);
  vy=(vy+(ty-y)*easing*dt)*Math.pow(mode==="peek"?.87:.91,dt);
  const speed=Math.hypot(vx,vy),max=now<playUntil?8:mode==="peek"?3.8:5.5;
  if(speed>max){vx*=max/speed;vy*=max/speed;}
  x=clamp(x+vx*dt,5,Math.max(5,innerWidth-75));
  y=clamp(y+vy*dt,75,Math.max(75,innerHeight-95));
  const bob=Math.sin(now*.0032)*5;
  buddy.style.transform="translate3d("+x.toFixed(1)+"px,"+(y+bob).toFixed(1)+"px,0) rotate("+clamp(vx*3,-19,19).toFixed(1)+"deg)";
  buddy.classList.toggle("travel-left",vx<-.15);
  buddy.classList.toggle("mascot-joy",now<playUntil);
  buddy.classList.toggle("mascot-peek",mode==="peek"&&Math.hypot(tx-x,ty-y)<65);
  buddy.classList.toggle("mascot-blink",now<blinkUntil);
  if(Math.random()<.002)blinkUntil=now+140;
 }else{
  buddy.style.transform="translate3d("+clamp(innerWidth-85,5,innerWidth)+"px,"+clamp(innerHeight-130,80,innerHeight)+"px,0)";
 }
 requestAnimationFrame(animate);
}
function play(flee){
 const now=performance.now();idle=now;finishKnock();playUntil=now+1400;mode="play";
 tx=clamp(x+(Math.random()-.5)*(flee?420:250),10,innerWidth-85);
 ty=clamp(y+(Math.random()-.5)*260,85,innerHeight-105);
 next=now+1450;
}
window.addEventListener("scroll",()=>{
 const diff=scrollY-scrollLast;scrollLast=scrollY;idle=performance.now();
 if(Math.abs(diff)>15&&!reduced&&mode!=="knock"&&Math.random()<.12){mode="play";playUntil=performance.now()+700;tx=clamp(x+(Math.random()-.5)*180,10,innerWidth-85);ty=clamp(y+(diff>0?-90:90),85,innerHeight-105);next=performance.now()+900;}
},{passive:true});
window.addEventListener("pointermove",e=>{
 if(reduced)return;
 const d=Math.hypot(e.clientX-x-34,e.clientY-y-40);
 if(d<95&&mode!=="knock"&&performance.now()>playUntil){play(true);}
},{passive:true});
buddy.addEventListener("click",()=>play(true));
window.addEventListener("resize",()=>{next=0;});
document.addEventListener("visibilitychange",()=>{if(!document.hidden){last=performance.now();next=0;}});
requestAnimationFrame(animate);
})();
