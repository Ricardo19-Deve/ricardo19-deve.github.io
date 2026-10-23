(()=>{"use strict";
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const layer=document.createElement("div");layer.className="mascot-world-v9";
layer.innerHTML=`<button class="mascot-creature" type="button" aria-label="Brincar com M, a mascote" title="Olá! Sou o M"><svg viewBox="0 0 170 160" aria-hidden="true"><defs><radialGradient id="v9skin" cx=".29" cy=".19" r=".86"><stop stop-color="#fff4ff"/><stop offset=".43" stop-color="#edc6ff"/><stop offset="1" stop-color="#a69be9"/></radialGradient><linearGradient id="v9tail" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dfb5f7"/><stop offset="1" stop-color="#9e8de0"/></linearGradient></defs><g class="tail"><path class="tail-stroke" d="M109 105 C123 108 149 118 151 137" fill="none" stroke="url(#v9tail)" stroke-width="11" stroke-linecap="round"/><ellipse class="tail-tip" cx="151" cy="137" rx="7" ry="8" fill="#b5a0e9"/></g><g class="ear-left"><path d="M54 50 Q35 20 46 16 Q67 14 72 42 Z" fill="url(#v9skin)" stroke="#eed4ff" stroke-width="1.5"/></g><g class="ear-right"><path d="M101 44 Q111 13 124 18 Q133 29 114 54 Z" fill="url(#v9skin)" stroke="#eed4ff" stroke-width="1.5"/></g><g class="leg-left"><path d="M67 106 Q56 116 60 122 Q69 129 80 118 L82 110" fill="url(#v9skin)" stroke="#e8c7ff" stroke-width="1.4"/></g><g class="leg-right"><path d="M94 107 Q107 116 105 122 Q98 130 87 118 L83 110" fill="url(#v9skin)" stroke="#e8c7ff" stroke-width="1.4"/></g><g class="arm-left"><path d="M59 86 Q40 90 42 106 Q46 119 58 109 L69 99" fill="url(#v9skin)" stroke="#eed1ff" stroke-width="1.3"/></g><g class="arm-right"><path d="M105 86 Q124 92 123 106 Q119 119 107 109 L98 99" fill="url(#v9skin)" stroke="#eed1ff" stroke-width="1.3"/></g><g class="body"><path d="M65 89 Q50 103 58 120 Q68 139 86 132 Q112 135 117 114 Q119 96 103 86 Z" fill="url(#v9skin)" stroke="#f1d6ff" stroke-width="1.5"/><ellipse cx="86" cy="113" rx="18" ry="14" fill="#fff3ff" opacity=".24"/><ellipse cx="84" cy="70" rx="47" ry="43" fill="url(#v9skin)" stroke="#f4dbff" stroke-width="1.8"/><ellipse cx="68" cy="85" rx="8" ry="5" fill="#ff9ac9" opacity=".55"/><ellipse cx="103" cy="85" rx="8" ry="5" fill="#ff9ac9" opacity=".55"/><g class="eyes"><ellipse cx="69" cy="70" rx="6.5" ry="10" fill="#39467f"/><ellipse cx="100" cy="70" rx="6.5" ry="10" fill="#39467f"/><circle cx="71" cy="66" r="2.3" fill="white"/><circle cx="102" cy="66" r="2.3" fill="white"/></g><path d="M81 83 Q85 90 90 83" stroke="#745b99" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="85" cy="78" r="2" fill="#745b99"/></g></svg><span class="mascot-tap" hidden>knock knock ✦</span></button>`;
document.body.appendChild(layer);
const mascot=layer.querySelector(".mascot-creature"),svg=mascot.querySelector("svg"),tail=mascot.querySelector(".tail-stroke"),tip=mascot.querySelector(".tail-tip"),tap=layer.querySelector(".mascot-tap");
const parts=Object.fromEntries(["arm-left","arm-right","leg-left","leg-right","ear-left","ear-right","eyes"].map(k=>[k,svg.querySelector("."+k)]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),rand=(a,b)=>a+Math.random()*(b-a);
let x=innerWidth*.65,y=innerHeight*.4,vx=0,vy=0,tx=x,ty=y,clock=0,last=0,next=0,mode="swim",modeUntil=0,playUntil=0,idle=performance.now(),knocked=0,tailX=43,tailY=33,tailVX=0,tailVY=0,prevX=x,prevY=y,front=false,active=true,emotion="curious",emotionUntil=0,lastScroll=scrollY;
function cards(){return Array.from(document.querySelectorAll(".card,.role,.cert,.about-tile,.about-statement,.case-teaser,.hero-visual,.game-shot")).filter(e=>{const r=e.getBoundingClientRect();return r.width>100&&r.height>75&&r.bottom>100&&r.top<innerHeight-100;});}
function mood(name,now,duration=1600){emotion=name;emotionUntil=now+duration;mascot.dataset.mood=name;}
function choose(now){
 const w=innerWidth,h=innerHeight,visible=cards();
 mode="swim";modeUntil=now+rand(2500,5000);next=modeUntil;
 if(visible.length&&Math.random()<.55){
  const r=visible[Math.floor(Math.random()*visible.length)].getBoundingClientRect();
  const side=Math.random()<.5?-1:1;
  tx=clamp(side<0?r.left-70:r.right-80,4,Math.max(4,w-120));
  ty=clamp(r.top+Math.min(110,r.height*.4)-55,55,Math.max(55,h-125));
  mode="peek";front=Math.random()<.4;mood("peek",now,2400);
 }else{
  tx=rand(8,Math.max(9,w-130));ty=rand(65,Math.max(66,h-160));front=Math.random()<.65;mood("happy",now,1700);
 }
 layer.classList.toggle("in-front",front);
}
function animateTail(dt,px,py){
 const h=clamp(dt,.008,.033),dx=px-prevX,dy=py-prevY;prevX=px;prevY=py;
 const wantedX=clamp(38-dx*7+Math.sin(clock*1.8)*12,-35,60);
 const wantedY=clamp(32-dy*7+Math.cos(clock*1.5)*8,10,65);
 tailVX+=(wantedX-tailX)*26*h;tailVY+=(wantedY-tailY)*26*h;
 tailVX*=Math.exp(-10*h);tailVY*=Math.exp(-10*h);
 tailX=clamp(tailX+tailVX*h,-38,64);tailY=clamp(tailY+tailVY*h,9,68);
 const ex=109+tailX,ey=105+tailY,bend=Math.sin(clock*1.4-.7)*11;
 tail.setAttribute("d",`M 109 105 C ${(109+Math.max(4,tailX*.34)).toFixed(1)} ${(105+Math.max(0,tailY*.04)).toFixed(1)} ${(ex+bend).toFixed(1)} ${(ey-Math.max(7,Math.abs(tailY)*.5)).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
 tip.setAttribute("cx",ex.toFixed(1));tip.setAttribute("cy",ey.toFixed(1));
}
function animate(now){
 if(!active)return;
 const dt=Math.min(.04,(now-(last||now))/1000);last=now;clock+=dt;
 if(!document.hidden){
  if(!reduce){
   if(now>next&&now>playUntil)choose(now);
   if(now>emotionUntil&&emotion!=="calm")mood("calm",now,3500);
   if(now-idle>7500&&now-knocked>21000&&now>playUntil){knocked=now;idle=now;tap.hidden=false;mascot.classList.add("knocking");setTimeout(()=>{tap.hidden=true;mascot.classList.remove("knocking");},1300);}
   const k=mode==="peek"?2.4:3.3,drag=Math.exp(-2.65*dt);
   vx=(vx+(tx-x)*k*dt)*drag;vy=(vy+(ty-y)*k*dt)*drag;
   const speed=Math.hypot(vx,vy),cap=now<playUntil?330:220;
   if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
   x=clamp(x+vx*dt,0,Math.max(0,innerWidth-120));
   y=clamp(y+vy*dt,42,Math.max(42,innerHeight-125));
  }else{x=clamp(innerWidth-115,0,innerWidth);y=clamp(innerHeight-145,50,innerHeight);}
  const bob=reduce?0:Math.sin(clock*2.7)*5;
  const tilt=reduce?0:clamp(vx*.09,-17,17);
  mascot.style.transform=`translate3d(${x.toFixed(1)}px,${(y+bob).toFixed(1)}px,0) rotate(${tilt.toFixed(1)}deg)`;
  animateTail(dt,x,y+bob);
  const energy=now<playUntil?4.3:mode==="peek"?1.35:2.1;
  parts["arm-left"].style.transform=`rotate(${(-17+Math.sin(clock*energy+1)*15).toFixed(1)}deg)`;
  parts["arm-right"].style.transform=`rotate(${(17-Math.sin(clock*energy+2)*23).toFixed(1)}deg)`;
  parts["leg-left"].style.transform=`rotate(${(Math.sin(clock*energy+2)*10).toFixed(1)}deg)`;
  parts["leg-right"].style.transform=`rotate(${(-Math.sin(clock*energy+3)*17).toFixed(1)}deg)`;
  parts["ear-left"].style.transform=`rotate(${(Math.sin(clock*1.7)*6).toFixed(1)}deg)`;
  parts["ear-right"].style.transform=`rotate(${(-Math.sin(clock*1.7+.9)*6).toFixed(1)}deg)`;
  parts.eyes.style.transform=(!reduce&&Math.sin(clock*.9)>.997)?"scaleY(.13)":"scaleY(1)";
 }
 requestAnimationFrame(animate);
}
function play(px,py){
 if(reduce)return;
 idle=performance.now();playUntil=idle+1800;mode="play";next=playUntil;mood("excited",idle,1900);
 tx=clamp(x+(x-px>0?1:-1)*rand(90,200),5,Math.max(5,innerWidth-125));
 ty=clamp(y+rand(-140,140),50,Math.max(50,innerHeight-125));
 front=true;layer.classList.add("in-front");
}
mascot.addEventListener("click",()=>play(x+100,y+90));
window.addEventListener("pointermove",e=>{if(Math.hypot(e.clientX-(x+55),e.clientY-(y+55))<85&&performance.now()>playUntil)play(e.clientX,e.clientY);},{passive:true});
window.addEventListener("scroll",()=>{const now=performance.now(),d=scrollY-lastScroll;lastScroll=scrollY;idle=now;if(Math.abs(d)>30&&now>playUntil&&Math.random()<.08){mode="surf";next=now+1400;tx=clamp(x+rand(-140,140),8,innerWidth-125);ty=clamp(y+(d>0?-95:95),55,innerHeight-125);mood("excited",now,1300);}},{passive:true});
window.addEventListener("resize",()=>{next=0;});
document.addEventListener("visibilitychange",()=>{last=performance.now();});
choose(performance.now());requestAnimationFrame(animate);
})();