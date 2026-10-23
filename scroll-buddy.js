(()=>{"use strict";
const sections=[["home","Welcome","Start exploring"],["about","About","How I build"],["experience","Experience","My career"],["projects","Projects","See what I've shipped"],["expertise","Expertise","My toolkit"],["contact","Connect","Let's talk"]];
const nodes=sections.map(([id,title,description])=>({id,title,description,el:document.getElementById(id)})).filter(x=>x.el);
if(!nodes.length)return;
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
const layer=document.createElement("div");layer.className="mascot-world";
layer.innerHTML='<div class="mascot-traveler"><span class="mascot-antenna"></span><span class="mascot-shell"><span class="mascot-eye eye-left"></span><span class="mascot-eye eye-right"></span><span class="mascot-smile"></span></span><span class="mascot-feet"></span></div><div class="mascot-info" hidden><button class="mascot-dismiss" type="button" aria-label="Hide mascot">×</button><small>EXPLORING</small><strong class="mascot-section">Welcome</strong><span class="mascot-caption">Follow me around!</span><button class="mascot-next" type="button">Next section ↗</button></div>';
document.body.appendChild(layer);
const traveler=layer.querySelector(".mascot-traveler"),info=layer.querySelector(".mascot-info"),label=layer.querySelector(".mascot-section"),caption=layer.querySelector(".mascot-caption");
let current=0,px=0,py=0,vx=0,vy=0,last=0,active=true,scrollImpulse=0,previousScroll=scrollY;
function sectionAtViewport(){
 const marker=scrollY+innerHeight*.44;let index=0;
 nodes.forEach((n,i)=>{if(n.el.getBoundingClientRect().top+scrollY<=marker)index=i;});
 if(index!==current){current=index;label.textContent=nodes[index].title;caption.textContent=nodes[index].description;}
}
function scrollHandler(){scrollImpulse=Math.max(-1,Math.min(1,(scrollY-previousScroll)/110));previousScroll=scrollY;sectionAtViewport();}
window.addEventListener("scroll",scrollHandler,{passive:true});
window.addEventListener("resize",sectionAtViewport,{passive:true});
function travel(time){
 if(!active)return;
 const t=time/1000,w=innerWidth,h=innerHeight;
 const safeTop=w<720?90:100,safeBottom=w<720?110:85;
 const rangeX=Math.max(20,w-105),rangeY=Math.max(25,h-safeTop-safeBottom-65);
 // Continuous playful figure-eight journey, with section-specific phase and scroll momentum.
 const phase=t*.48+current*.73;
 const tx=22+rangeX*(.5+.43*Math.sin(phase));
 const ty=safeTop+rangeY*(.5+.41*Math.sin(phase*.79+Math.cos(phase*.53)));
 if(!last){px=tx;py=ty;}last=time;
 const factor=reduced?1:.035;
 vx=(vx+(tx-px)*factor)*.85;vy=(vy+(ty-py)*factor)*.85;
 px+=reduced?tx-px:vx;py+=reduced?ty-py:vy;
 traveler.style.transform="translate3d("+px.toFixed(1)+"px,"+py.toFixed(1)+"px,0) rotate("+Math.max(-18,Math.min(18,vx*2+scrollImpulse*9)).toFixed(1)+"deg)";
 traveler.classList.toggle("travel-left",vx<-.15);
 scrollImpulse*=.94;
 // Bubble is deliberately not permanently visible; the character remains behind cards.
 if(!info.hidden){const iw=info.offsetWidth||180;info.style.left=Math.max(8,Math.min(w-iw-8,px-45))+"px";info.style.top=Math.max(70,Math.min(h-155,py-135))+"px";}
 if(!reduced)requestAnimationFrame(travel);
}
const trigger=document.createElement("button");trigger.className="mascot-interact";trigger.type="button";trigger.setAttribute("aria-label","Meet the portfolio mascot");trigger.title="Meet the mascot";layer.appendChild(trigger);
function hitbox(){trigger.style.transform="translate3d("+px+"px,"+py+"px,0)";if(active)requestAnimationFrame(hitbox);}
trigger.addEventListener("click",()=>{info.hidden=!info.hidden;sectionAtViewport();});
layer.querySelector(".mascot-next").addEventListener("click",()=>{info.hidden=true;nodes[(current+1)%nodes.length].el.scrollIntoView({behavior:reduced?"auto":"smooth"});});
layer.querySelector(".mascot-dismiss").addEventListener("click",()=>{active=false;layer.remove();window.removeEventListener("scroll",scrollHandler);window.removeEventListener("resize",sectionAtViewport);});
sectionAtViewport();requestAnimationFrame(travel);requestAnimationFrame(hitbox);
})();
