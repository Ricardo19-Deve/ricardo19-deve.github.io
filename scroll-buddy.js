import {sectionElements,visibleTargets,chooseTarget,placeAround,exclusionPolygon,interactiveTarget,insideMascot,bound} from './m-world-spatial.mjs';
(()=>{"use strict";
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const layer=document.createElement("div");layer.className="mascot-world-v9";layer.setAttribute("aria-hidden","true");
layer.innerHTML=`<div class="mascot-creature" title="M está a explorar o portefólio"><svg viewBox="0 0 170 160" aria-hidden="true"><defs><radialGradient id="v9skin" cx=".29" cy=".19" r=".86"><stop stop-color="#fff4ff"/><stop offset=".43" stop-color="#edc6ff"/><stop offset="1" stop-color="#a69be9"/></radialGradient><linearGradient id="v9tail" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#dfb5f7"/><stop offset="1" stop-color="#9e8de0"/></linearGradient></defs><g class="tail"><path class="tail-stroke" d="M109 105 C123 108 149 118 151 137" fill="none" stroke="url(#v9tail)" stroke-width="11" stroke-linecap="round"/><ellipse class="tail-tip" cx="151" cy="137" rx="7" ry="8" fill="#b5a0e9"/></g><g class="ear-left"><path d="M54 50 Q35 20 46 16 Q67 14 72 42 Z" fill="url(#v9skin)" stroke="#eed4ff" stroke-width="1.5"/></g><g class="ear-right"><path d="M101 44 Q111 13 124 18 Q133 29 114 54 Z" fill="url(#v9skin)" stroke="#eed4ff" stroke-width="1.5"/></g><g class="leg-left"><path d="M67 106 Q56 116 60 122 Q69 129 80 118 L82 110" fill="url(#v9skin)" stroke="#e8c7ff" stroke-width="1.4"/></g><g class="leg-right"><path d="M94 107 Q107 116 105 122 Q98 130 87 118 L83 110" fill="url(#v9skin)" stroke="#e8c7ff" stroke-width="1.4"/></g><g class="arm-left"><path d="M59 86 Q40 90 42 106 Q46 119 58 109 L69 99" fill="url(#v9skin)" stroke="#eed1ff" stroke-width="1.3"/></g><g class="arm-right"><path d="M105 86 Q124 92 123 106 Q119 119 107 109 L98 99" fill="url(#v9skin)" stroke="#eed1ff" stroke-width="1.3"/></g><g class="body"><path d="M65 89 Q50 103 58 120 Q68 139 86 132 Q112 135 117 114 Q119 96 103 86 Z" fill="url(#v9skin)" stroke="#f1d6ff" stroke-width="1.5"/><ellipse cx="86" cy="113" rx="18" ry="14" fill="#fff3ff" opacity=".24"/><ellipse cx="84" cy="70" rx="47" ry="43" fill="url(#v9skin)" stroke="#f4dbff" stroke-width="1.8"/><ellipse cx="68" cy="85" rx="8" ry="5" fill="#ff9ac9" opacity=".55"/><ellipse cx="103" cy="85" rx="8" ry="5" fill="#ff9ac9" opacity=".55"/><g class="eyes"><ellipse cx="69" cy="70" rx="6.5" ry="10" fill="#39467f"/><ellipse cx="100" cy="70" rx="6.5" ry="10" fill="#39467f"/><circle cx="71" cy="66" r="2.3" fill="white"/><circle cx="102" cy="66" r="2.3" fill="white"/></g><path d="M81 83 Q85 90 90 83" stroke="#745b99" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="85" cy="78" r="2" fill="#745b99"/></g></svg><span class="mascot-tap" hidden>knock knock ✦</span></div>`;
document.body.appendChild(layer);
const toggle=document.createElement('button');
toggle.type='button';toggle.className='m-world-toggle';
toggle.setAttribute('aria-label','Pausar a mascote M');
toggle.textContent='M · Pausar';
toggle.title='Pausar ou reativar a M';
document.body.appendChild(toggle);
const mascot=layer.querySelector(".mascot-creature"),svg=mascot.querySelector("svg"),tail=mascot.querySelector(".tail-stroke"),tip=mascot.querySelector(".tail-tip"),tap=layer.querySelector(".mascot-tap");
const parts=Object.fromEntries(["arm-left","arm-right","leg-left","leg-right","ear-left","ear-right","eyes"].map(k=>[k,svg.querySelector("."+k)]));
const clamp=bound,rand=(a,b)=>a+Math.random()*(b-a);
let x=innerWidth*.65,y=innerHeight*.4,vx=0,vy=0,tx=x,ty=y,clock=0,last=0,next=0,mode="swim",modeUntil=0,playUntil=0,idle=performance.now(),knocked=0,tailX=43,tailY=33,tailVX=0,tailVY=0,prevX=x,prevY=y,front=false,active=true,emotion="curious",emotionUntil=0,lastScroll=scrollY,peekAt=0,lastInteraction=performance.now(),curiosityCooldown=0,scrollUntil=0,scrollImpulse=0,scrollVelocity=0,scrollTarget=0,scrollLast=scrollY,scrollDirection=0,pose="float",poseUntil=0,spinStart=0,spinUntil=0,spinDirection=1,travelTarget=null,travelSide=1,peekRevealed=false,bodyTilt=0,bodyTiltVelocity=0,bodyBob=0,bodyBobVelocity=0,blinkNext=performance.now()+rand(2400,5700),blinkUntil=0;
let lastTarget=null,perchSide=1,nextWorldScan=0;
const worldElements=sectionElements(document);
function candidates(){return visibleTargets(worldElements,innerWidth,innerHeight).filter(x=>!x.el.closest('[aria-hidden="true"]'))}
function cards(){return candidates().map(item=>item.el);}
function setActive(enabled,persist=true){
 active=Boolean(enabled);
 layer.hidden=!active;
 toggle.textContent=active?'M · Pausar':'M · Ativar';
 toggle.setAttribute('aria-label',active?'Pausar a mascote M':'Reativar a mascote M');
 toggle.setAttribute('aria-pressed',String(active));
 if(persist){try{localStorage.setItem('m-world-enabled',active?'yes':'no')}catch{}}
 if(active){last=performance.now();prevX=x;prevY=y;requestAnimationFrame(animate)}
}
toggle.addEventListener('click',()=>setActive(!active));
try{if(localStorage.getItem('m-world-enabled')==='no')setActive(false,false)}catch{}

function mood(name,now,duration=1600){emotion=name;emotionUntil=now+duration;mascot.dataset.mood=name;}
function choose(now){
 const options=candidates();
 const selected=chooseTarget(options,{x:x+55,y:y+55},innerWidth,innerHeight,Math.random);
 travelTarget=selected?.el||null;
 lastTarget=travelTarget;
 peekAt=0;peekRevealed=false;spinUntil=0;
 perchSide=Math.random()<.5?-1:1;travelSide=perchSide;
 const roll=Math.random();
 const behavior=!travelTarget?'glide':roll<.37?'peek':roll<.63?'perch':roll<.83?'orbit':'glide';
 mode=behavior;
 pose=behavior==='perch'?'curl':behavior==='peek'?'wave':behavior==='orbit'?'glide':'float';
 front=behavior!=='peek' && !(behavior==='orbit'&&Math.random()<.55);
 layer.classList.toggle('in-front',front);
 layer.style.clipPath='';
 const duration=behavior==='peek'?rand(3300,4600):behavior==='perch'?rand(3800,6000):
  behavior==='orbit'?rand(3300,4800):rand(2500,4000);
 poseUntil=now+duration;next=poseUntil;
 if(travelTarget&&behavior!=='glide'){
  const r=travelTarget.getBoundingClientRect();
  const point=placeAround(r,innerWidth,innerHeight,behavior,perchSide);
  tx=point.x;ty=point.y;
  if(behavior==='peek')peekAt=now+Math.min(1500,duration*.45);
 }else{
  tx=clamp(x+rand(-270,270),5,Math.max(5,innerWidth-125));
  ty=clamp(y+rand(-170,170),55,Math.max(55,innerHeight-125));
 }
 mood(behavior==='peek'?'curious':behavior==='perch'?'sleepy':behavior==='orbit'?'happy':'curious',now,duration);
}

// Cut a real rectangular opening in the mascot layer while M is behind a card.
// This avoids relying on the page's many independent stacking contexts.
function updateOcclusion(){
 // True DOM stacking contexts do not represent 3D depth. When M enters
 // behind a real panel, clip her foreground rendering by that panel's
 // current viewport rectangle. The page remains fully interactive.
 if(!travelTarget||!travelTarget.isConnected||front){
  layer.style.clipPath='';return;
 }
 const r=travelTarget.getBoundingClientRect();
 layer.style.clipPath=exclusionPolygon(r,innerWidth,innerHeight,1);
}

function animateTail(dt,px,py){
 const h=clamp(dt,.008,.033),dx=px-prevX,dy=py-prevY;prevX=px;prevY=py;
 // Tail follows actual body velocity with bounded lag; never stretches.
 const wantedX=clamp(38-dx*4.3+Math.sin(clock*1.2)*8,-22,60);
 const wantedY=clamp(32-dy*4.3+Math.cos(clock*1.1)*6,12,62);
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
 // Continuous scroll-follow: measure the actual page offset on every frame.
 const currentScroll=window.scrollY,scrollDelta=currentScroll-scrollLast;
 scrollLast=currentScroll;
 if(!reduce&&Math.abs(scrollDelta)>.1){
   scrollVelocity+=(clamp(scrollDelta/Math.max(dt,.008),-1800,1800)-scrollVelocity)*.35;
   scrollDirection=Math.sign(scrollVelocity)||scrollDirection;
   scrollUntil=now+900;
   travelTarget=null;peekAt=0;peekRevealed=false;
   mode="surf";front=true;spinUntil=0;next=now+2300;
   layer.classList.add("in-front");layer.style.clipPath="";
 }
 if(!reduce&&now<scrollUntil+1250){
   const moving=now<scrollUntil;
   const speed=clamp(Math.abs(scrollVelocity)/650,0,1);
   mode="surf";front=true;spinUntil=0;layer.classList.add("in-front");layer.style.clipPath="";
   // The creature visibly swims across the viewport, not just a few pixels.
   const glide=clamp((scrollUntil+1250-now)/1250,0,1);
   tx=clamp(innerWidth*(.64+.10*Math.sin(clock*.9))+Math.sin(clock*2.3)*30,8,Math.max(8,innerWidth-125));
   ty=clamp(innerHeight*(.43-scrollDirection*.23*glide)+Math.sin(clock*2.6)*17,55,Math.max(55,innerHeight-125));
   scrollVelocity*=Math.exp(-2.3*dt);
   next=Math.max(next,scrollUntil+1300);
 }

 if(!document.hidden){
  if(!reduce){
   if(mode==="peek"&&travelTarget&&!peekRevealed){
    const r=travelTarget.getBoundingClientRect();
    if(r.bottom<40||r.top>innerHeight-40){travelTarget=null;next=0;}
    else {
      const edge=travelSide<0?r.left-30:r.right-110;
      tx=clamp(edge,4,Math.max(4,innerWidth-120));
      ty=clamp(r.top+Math.min(110,r.height*.4)-55,55,Math.max(55,innerHeight-125));
    }
   }
   if(mode==="peek"&&peekAt&&now>peekAt&&Math.hypot(tx-x,ty-y)<70){
    peekAt=0;peekRevealed=true;
    // Slide out of the card silhouette before moving to the foreground.
    tx=clamp(tx+(travelSide<0?-100:100),5,Math.max(5,innerWidth-125));
    ty=clamp(ty-18,55,Math.max(55,innerHeight-125));
    next=Math.max(next,now+2600);mood("curious",now,1600);
   }
   if(mode==="peek"&&peekRevealed&&!front&&travelTarget){
    const r=travelTarget.getBoundingClientRect();
    const center=x+55;
    if(center<r.left-15||center>r.right+15){
      front=true;layer.classList.add("in-front");
    }
   }
   if(now>next&&now>playUntil&&now>scrollUntil+1250)choose(now);
   if(mode==="peek"&&travelTarget&&!travelTarget.isConnected){travelTarget=null;peekAt=0;next=0;}
   if(now>emotionUntil&&emotion!=="calm")mood("calm",now,3500);
   if(now-idle>11000&&now-knocked>35000&&now>playUntil&&mode!=="peek"){knocked=now;idle=now;tap.hidden=false;mascot.classList.add("knocking");setTimeout(()=>{tap.hidden=true;mascot.classList.remove("knocking");},1300);}
   // Critically damped steering: speed tapers as M approaches a destination.
   const dx=tx-x,dy=ty-y,distance=Math.hypot(dx,dy);
   const maxSpeed=mode==="rest"?45:mode==="dash"?340:mode==="spin"?80:mode==="play"?270:mode==="surf"?380:mode==="peek"?95:145;
   const desiredSpeed=Math.min(maxSpeed,distance*(mode==="play"?2.7:mode==="dash"?3.1:1.55));
   // A gentle curved approach makes exploration look like swimming, not a straight line.
   const curve=mode==="swim"&&distance>85?Math.sin(clock*.65)*Math.min(22,distance*.07):0;
   const desiredVX=distance>1?dx/distance*desiredSpeed+(-dy/distance)*curve:0;
   const desiredVY=distance>1?dy/distance*desiredSpeed+(dx/distance)*curve:0;
   const responsiveness=1-Math.exp(-(mode==="play"?4.8:mode==="surf"?6:mode==="rest"?1.5:2.8)*dt);
   vx+=(desiredVX-vx)*responsiveness;vy+=(desiredVY-vy)*responsiveness;
   x=clamp(x+vx*dt,0,Math.max(0,innerWidth-120));
   y=clamp(y+vy*dt,42,Math.max(42,innerHeight-125));
   if((x===0&&vx<0)||(x===Math.max(0,innerWidth-120)&&vx>0))vx=0;
   if((y===42&&vy<0)||(y===Math.max(42,innerHeight-125)&&vy>0))vy=0;
  }else{x=clamp(innerWidth-115,0,innerWidth);y=clamp(innerHeight-145,50,innerHeight);}
  // Body inertia is a damped spring, so the head and torso follow turns smoothly.
  const targetTilt=reduce?0:clamp(vx*.065+vy*.035+Math.sin(clock*.7)*1.4,-18,18);
  const targetBob=reduce?0:Math.sin(clock*(mode==="surf"?3.1:mode==="dash"?3.6:1.6))*(mode==="surf"?9:mode==="dash"?6:pose==="curl"?2:4);
  const step=Math.max(.001,Math.min(.035,dt));
  bodyTiltVelocity+=(targetTilt-bodyTilt)*42*step;
  bodyTiltVelocity*=Math.exp(-12*step);
  bodyTilt+=bodyTiltVelocity*step;
  bodyBobVelocity+=(targetBob-bodyBob)*35*step;
  bodyBobVelocity*=Math.exp(-11*step);
  bodyBob+=bodyBobVelocity*step;
  scrollImpulse*=Math.exp(-3.8*step);
  const bob=bodyBob,tilt=bodyTilt;
  const spinning=!reduce&&now<spinUntil&&now>=spinStart;
  const spinProgress=spinning?clamp((now-spinStart)/1500,0,1):0;
  const spinEase=spinProgress*spinProgress*(3-2*spinProgress);
  const rotation=tilt+(spinning?spinDirection*360*spinEase:0);
  const stretch=reduce?1:mode==="dash"?1.07:mode==="surf"?1.035:pose==="curl"?.94:1;
  mascot.style.transform=`translate3d(${x.toFixed(1)}px,${(y+bob).toFixed(1)}px,0) rotate(${rotation.toFixed(1)}deg) scale(${stretch.toFixed(3)})`;
  updateOcclusion();
  animateTail(dt,x,y+bob);
  const energy=mode==="surf"?5:mode==="dash"?5.8:mode==="play"?4:pose==="curl"?.8:2;
  const t=clock*energy,swim=Math.sin(t),kick=Math.sin(t+Math.PI*.8);
  const wave=pose==="wave"&&mode!=="surf";
  const curl=pose==="curl"&&mode!=="surf";
  const dash=mode==="dash"||mode==="surf";
  const armL=curl?32:wave?-42+Math.sin(clock*5)*19:dash?-36+swim*12:-15+swim*13;
  const armR=curl?-32:wave?13+Math.sin(clock*5+1.8)*12:dash?36-kick*12:15-kick*13;
  const legL=curl?-35:dash?18+kick*18:7+kick*10;
  const legR=curl?35:dash?-18-swim*18:-7-swim*10;
  parts["arm-left"].style.transform=`rotate(${armL.toFixed(1)}deg)`;
  parts["arm-right"].style.transform=`rotate(${armR.toFixed(1)}deg)`;
  parts["leg-left"].style.transform=`rotate(${legL.toFixed(1)}deg)`;
  parts["leg-right"].style.transform=`rotate(${legR.toFixed(1)}deg)`;
  parts["ear-left"].style.transform=`rotate(${(Math.sin(clock*2.1)*5).toFixed(1)}deg)`;
  parts["ear-right"].style.transform=`rotate(${(-Math.sin(clock*2.1+.8)*5).toFixed(1)}deg)`;
  if(!reduce&&now>blinkNext){blinkUntil=now+130;blinkNext=now+rand(2300,6000);}
  parts.eyes.style.transform=now<blinkUntil?"scaleY(.13)":"scaleY(1)";
 }
 requestAnimationFrame(animate);
}
function play(px,py){
 if(reduce)return;
 idle=performance.now();lastInteraction=idle;travelTarget=null;peekAt=0;playUntil=idle+1800;mode="play";spinUntil=0;next=playUntil;mood("excited",idle,1900);
 tx=clamp(x+(x-px>0?1:-1)*rand(90,200),5,Math.max(5,innerWidth-125));
 ty=clamp(y+rand(-140,140),50,Math.max(50,innerHeight-125));
 front=true;layer.classList.add("in-front");
}
mascot.addEventListener("click",()=>play(x+100,y+90));
window.addEventListener("pointermove",e=>{const now=performance.now(),d=Math.hypot(e.clientX-(x+55),e.clientY-(y+55));if(d<85&&now>playUntil)play(e.clientX,e.clientY);else if(d<205&&now>playUntil&&mode!=="peek"&&now>next-900&&now>curiosityCooldown){curiosityCooldown=now+2100;lastInteraction=now;mode="curious";travelTarget=null;peekAt=0;tx=clamp(e.clientX-80,8,innerWidth-125);ty=clamp(e.clientY-105,55,innerHeight-125);next=now+1750;mood("curious",now,1500);}},{passive:true});
window.addEventListener("scroll",()=>{lastInteraction=performance.now();idle=lastInteraction;},{passive:true});
window.addEventListener("resize",()=>{next=0;travelTarget=null;peekAt=0;});
document.addEventListener("visibilitychange",()=>{last=performance.now();prevX=x;prevY=y;});
choose(performance.now());requestAnimationFrame(animate);
})();