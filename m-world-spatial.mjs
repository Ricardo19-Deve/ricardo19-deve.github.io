/**
 * M World · production spatial director (no DOM or Three.js dependency).
 * Geometry helpers let M inhabit sections, pass behind glass cards, and
 * move through open corridors without compromising real page interaction.
 */
export const bound=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:0));
export const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
export function intersectsViewport(r,w,h,pad=0){
 return r.width>30&&r.height>30&&r.right>-pad&&r.left<w+pad&&r.bottom>-pad&&r.top<h+pad;
}
const styleOf=el=>typeof getComputedStyle==='function'
 ? getComputedStyle(el):{visibility:'visible',display:'block',opacity:'1'};
export function sectionElements(root=typeof document==='undefined'?null:document){
 if(!root)return [];
 return [...root.querySelectorAll('.hero-visual,.about-tile,.about-statement,.role,.card,.case-teaser,.expertise article,.cert,.contact .container')]
  .filter(el=>!el.closest('[hidden],[aria-hidden="true"]')&&
   styleOf(el).visibility!=='hidden'&&
   styleOf(el).display!=='none');
}
/** Responsive candidates; excludes boxes close to sticky header. */
export function visibleTargets(elements,w,h){
 return elements.map(el=>({el,rect:el.getBoundingClientRect()}))
  .filter(({rect,el})=>intersectsViewport(rect,w,h)&&rect.width>95&&rect.height>65&&rect.bottom>110&&
   !el.closest('[hidden]')&&styleOf(el).opacity!=='0');
}
export function chooseTarget(candidates,position,w,h,random=Math.random){
 if(!candidates.length)return null;
 const weighted=candidates.map(item=>{
  const c=center(item.rect),dist=Math.hypot(c.x-position.x,c.y-position.y);
  const visibility=bound(Math.min(item.rect.bottom,h)-Math.max(item.rect.top,0),0,h)/Math.max(1,item.rect.height);
  return {...item,weight:.25+visibility*1.4+Math.min(1,300/(dist+150))*.7};
 });
 const total=weighted.reduce((sum,item)=>sum+item.weight,0);
 let needle=random()*total;
 return weighted.find(item=>(needle-=item.weight)<=0)||weighted.at(-1);
}
/** M is 120px wide in its own CSS coordinate system. */
export function placeAround(r,w,h,behavior='peek',side=1,character=120){
 const size=character,leftEdge=side<0?r.left:r.right;
 let x,y;
 if(behavior==='peek'){
  // Half of character is behind the chosen panel; the remainder peeks out.
  x=side<0?r.left-size*.59:r.right-size*.41;
  y=bound(r.top+Math.min(r.height*.32,125)-size*.48,55,h-size-8);
 }else if(behavior==='perch'){
  x=r.left+Math.min(Math.max(24,r.width*.28),Math.max(24,r.width-100));
  y=r.top-size*.79;
  if(y<48){y=r.bottom-size*.22;}
 }else if(behavior==='orbit'){
  x=side<0?r.left-size*.96:r.right-size*.04;
  y=r.top+Math.min(r.height*.55,h*.55)-size*.5;
 }else{
  x=leftEdge-size*.55;y=r.top-size*.50;
 }
 return {x:bound(x,3,Math.max(3,w-size-3)),y:bound(y,48,Math.max(48,h-size-8))};
}
/** Rectangular cutout: foreground card masks M if M is behind it.
 * Operates on viewport coordinates rather than CSS stacking contexts.
 */
export function exclusionPolygon(rect,w,h,pad=0){
 const l=bound(rect.left-pad,0,w),r=bound(rect.right+pad,0,w);
 const t=bound(rect.top-pad,0,h),b=bound(rect.bottom+pad,0,h);
 if(r-l<3||b-t<3)return '';
 return `polygon(evenodd, 0px 0px, ${w}px 0px, ${w}px ${h}px, 0px ${h}px, 0px 0px, ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`;
}
/** Return path point on a cubic Bezier, for navigating the air around blocks. */
export function cubic(p0,p1,p2,p3,t){
 const u=1-bound(t,0,1),v=1-u;
 return {x:u*u*u*p0.x+3*u*u*v*p1.x+3*u*v*v*p2.x+v*v*v*p3.x,
  y:u*u*u*p0.y+3*u*u*v*p1.y+3*u*v*v*p2.y+v*v*v*p3.y};
}
export function interactiveTarget(el){
 return Boolean(el?.closest?.('a,button,input,textarea,select,summary,[role="button"],[role="link"],[contenteditable="true"],[data-m-no-touch]'));
}
export function insideMascot(px,py,x,y,size=120){
 const dx=px-(x+size*.53),dy=py-(y+size*.50);
 return (dx*dx)/(size*.33)**2+(dy*dy)/(size*.36)**2<1;
}

/**
 * Choreographed movement around a real card. Positions are viewport-local
 * and stay attached as scrolling moves the card rectangle.
 * A change of depth happens only while M is already crossing a card edge.
 */
export function cardPerformance(rect,w,h,kind,side=1,progress=0,character=120){
 const t=bound(progress,0,1),direction=side<0?-1:1,size=character;
 const clipX=x=>bound(x,3,Math.max(3,w-size-3));
 const clipY=y=>bound(y,48,Math.max(48,h-size-8));
 const outside=(edge,visible)=>
  direction<0?edge-size*visible:edge-size*(1-visible);
 const edge=direction<0?rect.left:rect.right;
 const opposite=direction<0?rect.right:rect.left;
 const topY=clipY(rect.top-size*.90);
 const edgeY=clipY(rect.top+Math.min(rect.height*.31,120)-size*.52);
 const ease=x=>x*x*(3-2*x);
 if(kind==='peek'){
  // Start almost completely occluded. Then let the face, followed by
  // the body and tail, emerge from behind the same panel.
  const reveal=ease(bound(t/.82,0,1));
  const visible=.17+.70*reveal;
  const x=outside(edge,visible);
  const y=edgeY-8*Math.sin(Math.PI*reveal);
  return {x:clipX(x),y:clipY(y),behind:t<.90,phase:reveal,kind};
 }
 if(kind==='perch'){
  const start={x:outside(edge,.6),y:edgeY-10};
  const target={
   x:rect.left+rect.width*(direction<0?.29:.71)-size*.5,
   y:topY
  };
  const u=ease(bound(t/.63,0,1));
  return {x:clipX(start.x+(target.x-start.x)*u),
   y:clipY(start.y+(target.y-start.y)*u-22*Math.sin(Math.PI*u)),
   behind:false,phase:u,kind};
 }
 if(kind==='orbit'){
  const begin={x:outside(edge,.68),y:edgeY};
  const mid={x:rect.left+rect.width*.5-size*.5,y:topY};
  const finish={x:outside(opposite,.67),y:edgeY};
  const u=bound(t/.58,0,1);
  const v=bound((t-.58)/.42,0,1);
  const first=cubic(begin,{x:begin.x,y:topY-18},
   {x:mid.x,y:topY-20},mid,ease(u));
  const second=cubic(mid,{x:mid.x,y:topY-20},
   {x:finish.x,y:topY-12},finish,ease(v));
  const point=t<.58?first:second;
  return {x:clipX(point.x),y:clipY(point.y),
   behind:t>.76,phase:t,kind};
 }
 const p=placeAround(rect,w,h,kind,side,character);
 return {...p,behind:false,phase:t,kind};
}

/** Only the selected card should mask the M, and only on a behind phase.
 * This does not synthesize true 3D: it is purposeful per-card 2D occlusion.
 */
export function activeOccluder(rect,actor,behind,buffer=0){
 if(!behind||!rect)return false;
 return actor.x+actor.size>rect.left-buffer &&
  actor.x<rect.right+buffer &&
  actor.y+actor.size>rect.top-buffer &&
  actor.y<rect.bottom+buffer;
}
