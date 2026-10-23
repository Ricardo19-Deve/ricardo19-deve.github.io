(()=>{"use strict";
const sections=[["home","Welcome","Start exploring"],["about","About","How I build"],["experience","Experience","My career"],["projects","Projects","See what I've shipped"],["expertise","Expertise","My toolkit"],["contact","Connect","Let's talk"]];
const nodes=sections.map(([id,title,description])=>({id,title,description,el:document.getElementById(id)})).filter(x=>x.el);
if(!nodes.length)return;
const buddy=document.createElement("aside");buddy.className="scroll-buddy";buddy.setAttribute("aria-label","Portfolio scroll companion");
buddy.innerHTML='<div class="buddy-bubble" aria-live="off"><small>YOU ARE HERE</small><strong class="buddy-title">Welcome</strong><span class="buddy-hint">Tap me to explore ↓</span></div><button class="buddy-character" type="button" aria-label="Jump to next section" title="Jump to next section"><span class="buddy-antenna"></span><span class="buddy-body"><span class="buddy-eye left"></span><span class="buddy-eye right"></span><span class="buddy-mouth"></span></span></button><button class="buddy-close" type="button" aria-label="Hide companion">×</button>';
document.body.appendChild(buddy);
const title=buddy.querySelector(".buddy-title"),hint=buddy.querySelector(".buddy-hint"),jump=buddy.querySelector(".buddy-character");
let active=-1,frame=0,movingTimer=0;
let x=0,y=0,vx=0,vy=0,tx=0,ty=0,animation=0;
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
buddy.style.left="0";buddy.style.top="0";buddy.style.right="auto";buddy.style.bottom="auto";
function retarget(){
 const w=innerWidth,h=innerHeight,scrollMax=Math.max(1,document.documentElement.scrollHeight-h);
 const p=Math.max(0,Math.min(1,scrollY/scrollMax));
 const bw=buddy.offsetWidth||190,bh=buddy.offsetHeight||90;
 const margin=w<720?8:20;
 const availableX=Math.max(0,w-bw-2*margin);
 const availableY=Math.max(0,h-bh-105);
 tx=margin+availableX*(.5+.42*Math.cos(p*Math.PI*3));
 ty=48+availableY*(.5+.38*Math.sin(p*Math.PI*4));
 if(reduced){x=tx;y=ty;buddy.style.transform="translate3d("+x+"px,"+y+"px,0)";}
 else if(!animation)animation=requestAnimationFrame(animate);
}
function animate(){
 animation=0;if(buddy.hidden)return;
 vx=(vx+(tx-x)*.035)*.82;vy=(vy+(ty-y)*.035)*.82;
 x+=vx;y+=vy;
 buddy.style.transform="translate3d("+x.toFixed(1)+"px,"+y.toFixed(1)+"px,0)";
 jump.style.rotate=Math.max(-12,Math.min(12,vx*1.5)).toFixed(1)+"deg";
 if(Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(vx)+Math.abs(vy)>.4)animation=requestAnimationFrame(animate);
}

function update(){frame=0;const mark=window.scrollY+window.innerHeight*.43;let i=0;for(let n=0;n<nodes.length;n++){if(nodes[n].el.getBoundingClientRect().top+window.scrollY<=mark)i=n;}if(i!==active){active=i;title.textContent=nodes[i].title;hint.textContent=i===nodes.length-1?"Back to the beginning ↑":nodes[i].description+" · Next ↓";jump.setAttribute("aria-label",i===nodes.length-1?"Back to top":"Go to "+nodes[i+1].title);}}
function onScroll(){if(!frame)frame=requestAnimationFrame(update);retarget();buddy.classList.add("is-moving");clearTimeout(movingTimer);movingTimer=setTimeout(()=>buddy.classList.remove("is-moving"),180);}
window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("resize",onScroll,{passive:true});
jump.addEventListener("click",()=>{const next=nodes[(active+1)%nodes.length];next.el.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});});
buddy.querySelector(".buddy-close").addEventListener("click",()=>{buddy.hidden=true;window.removeEventListener("scroll",onScroll);window.removeEventListener("resize",onScroll);cancelAnimationFrame(animation);});
update();retarget();
})();
