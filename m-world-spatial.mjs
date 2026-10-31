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
 return Boolean(el?.isContentEditable||el?.closest?.('a,button,input,textarea,select,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"]),[contenteditable]:not([contenteditable="false"]),[data-m-no-touch]'));
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



/**
 * Renderer-sized spatial plans. All positions refer to the unscaled canvas host.
 * Metrics, DOM rectangles and depth are supplied by the caller; no layout reads.
 */
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const ease=t=>{t=bound(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const point=(x,y)=>({x,y});
const rectOf=input=>{
 const r=input?.rect||input||{};
 const left=finite(r.left,finite(r.x)),top=finite(r.top,finite(r.y));
 const right=finite(r.right,left+Math.max(0,finite(r.width)));
 const bottom=finite(r.bottom,top+Math.max(0,finite(r.height)));
 return {id:input?.id??r.id,left,top,right:Math.max(left,right),bottom:Math.max(top,bottom),
  width:Math.max(0,right-left),height:Math.max(0,bottom-top),
  radius:bound(finite(input?.radius,finite(r.radius)),0,Math.min(Math.max(0,right-left),Math.max(0,bottom-top))/2)};
};
const overlaps=(a,b,pad=0)=>a.right>b.left-pad&&a.left<b.right+pad&&a.bottom>b.top-pad&&a.top<b.bottom+pad;
const metricsOf=input=>{
 const size=Math.max(24,finite(input?.size,272));
 let footprint=rectOf(input?.footprint||{left:0,top:0,width:size,height:size});
 if(footprint.width<1||footprint.height<1)footprint=rectOf({left:0,top:0,width:size,height:size});
 return {size,footprint,neutralFootprint:input?.neutralFootprint?rectOf(input.neutralFootprint):null,contact:{x:finite(input?.contact?.x,footprint.left+footprint.width/2),
  y:finite(input?.contact?.y,footprint.bottom)}};
};
const viewportOf=v=>({width:Math.max(1,finite(v?.width,1024)),height:Math.max(1,finite(v?.height,768)),
 headerBottom:Math.max(0,finite(v?.headerBottom,64))});
const surfacesOf=(list=[])=>{
 const seen=new Set();
 return list.map(rectOf).filter(r=>{
  if(r.width<1||r.height<1)return false;
  const key=r.id??[r.left,r.top,r.right,r.bottom].join(':');
  if(seen.has(key))return false;seen.add(key);return true;
 });
};
const inRounded=(p,r)=>{
 if(p.x<r.left||p.x>r.right||p.y<r.top||p.y>r.bottom)return false;
 if(!r.radius)return true;
 const x=bound(p.x,r.left+r.radius,r.right-r.radius),y=bound(p.y,r.top+r.radius,r.bottom-r.radius);
 return (p.x-x)**2+(p.y-y)**2<=r.radius**2;
};

/** Real projected footprint and support point, translated from canvas-local px. */
export function actorRect(position,metrics){
 const m=metricsOf(metrics),f=m.footprint,x=finite(position?.x),y=finite(position?.y);
 return {left:x+f.left,top:y+f.top,right:x+f.right,bottom:y+f.bottom,
  width:f.width,height:f.height,contact:{x:x+m.contact.x,y:y+m.contact.y}};
}
const fits=(p,m,v)=>{
 const a=actorRect(p,m);
 return a.left>=8&&a.right<=v.width-8&&a.top>=v.headerBottom+8&&a.bottom<=v.height-8;
};
const overlapArea=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
 Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
const clampPose=(p,m,v)=>{
 const f=m.footprint;
 return {x:bound(p.x,8-f.left,Math.max(8-f.left,v.width-8-f.right)),
  y:bound(p.y,v.headerBottom+8-f.top,Math.max(v.headerBottom+8-f.top,v.height-8-f.bottom))};
};
const clearPose=(p,m,v,surfaces,text)=>fits(p,m,v)&&
 !surfaces.some(r=>overlaps(actorRect(p,m),r,2))&&!text.some(r=>overlaps(actorRect(p,m),r,3));
const portalClear=(actor,portal,surfaces)=>{
 if(!portal)return true;
 const live=surfaces.find(r=>r.id!==undefined&&r.id===portal.surfaceId);
 const r=live||rectOf(portal.rect);
 if(r.width<1||r.height<1)return true;
 if(portal.side==='left')return actor.right<=r.left-1;
 if(portal.side==='right')return actor.left>=r.right+1;
 if(portal.side==='top')return actor.bottom<=r.top-1;
 if(portal.side==='bottom')return actor.top>=r.bottom+1;
 return !overlaps(actor,r,1);
};
const findEgress=(start,m,v,surfaces,text)=>{
 if(clearPose(start,m,v,surfaces,text))return {...start,clear:true};
 const f=m.footprint,candidates=[];
 for(const r of [...surfaces,...text].filter(r=>overlaps(actorRect(start,m),r,8))){
  candidates.push(point(r.left-f.right-14,start.y),point(r.right-f.left+14,start.y),
   point(start.x,r.top-f.bottom-14),point(start.x,r.bottom-f.top+14));
 }
 candidates.push(point(8-f.left,v.headerBottom+8-f.top),
  point(v.width-8-f.right,v.headerBottom+8-f.top),
  point(8-f.left,v.height-8-f.bottom),point(v.width-8-f.right,v.height-8-f.bottom));
 const ranked=candidates.map(p=>clampPose(p,m,v)).map(p=>{
  const a=actorRect(p,m),clear=clearPose(p,m,v,surfaces,text);
  return {...p,clear,score:(clear?0:1e7)+surfaces.reduce((s,r)=>s+overlapArea(a,r),0)*30+
   text.reduce((s,r)=>s+overlapArea(a,r),0)*100+Math.hypot(p.x-start.x,p.y-start.y)};
 }).sort((a,b)=>a.score-b.score);
 return ranked[0]||{...start,clear:false};
};

// Exact axis-aligned rectangle union area: overlapping foreground cards must
// never create an even-odd hole or make a nominally visible portal disappear.
const coveredArea=(actor,surfaces)=>{
 const clipped=surfaces.map(r=>({left:Math.max(actor.left,r.left),right:Math.min(actor.right,r.right),
  top:Math.max(actor.top,r.top),bottom:Math.min(actor.bottom,r.bottom)}))
  .filter(r=>r.right>r.left&&r.bottom>r.top);
 const xs=[...new Set(clipped.flatMap(r=>[r.left,r.right]))].sort((a,b)=>a-b);
 let area=0;
 for(let i=1;i<xs.length;i++){
  const left=xs[i-1],right=xs[i],middle=(left+right)/2;
  const intervals=clipped.filter(r=>r.left<middle&&r.right>middle).map(r=>[r.top,r.bottom]).sort((a,b)=>a[0]-b[0]);
  let length=0,lo=0,hi=0;
  for(const [a,b]of intervals){if(a>hi){length+=hi-lo;lo=a;hi=b;}else hi=Math.max(hi,b);}
  area+=(right-left)*(length+hi-lo);
 }
 return area;
};

const choosePortal=(r,m,v,side,surfaces,text,start)=>{
 const f=m.footprint,gutter={left:r.left-8,right:v.width-r.right-8,top:r.top-v.headerBottom-8};
 const choices=[];
 for(const direction of ['left','right','top']){
  const extent=direction==='top'?f.height:f.width;
  const fraction=Math.min(direction==='top'?.46:.72,gutter[direction]/extent);
  if(fraction<.23)continue;
  let reveal,conceal,clear;
  if(direction==='top'){
   const x=bound(r.left+r.width*.5-(f.left+f.right)/2,8-f.left,v.width-8-f.right);
   if(m.neutralFootprint){
    const focusY=m.neutralFootprint.top+m.neutralFootprint.height*.4;
    reveal=clampPose(point(x,r.top-focusY-12),m,v);
    if(reveal.y+focusY>r.top-4)continue;
   }else reveal=point(x,r.top-f.top-f.height*fraction);
   conceal=point(x,r.top-f.top-f.height*.07);
   clear=point(x,r.top-f.bottom-14);
  }else{
   const y=clampPose(point(0,r.top+Math.min(r.height*.28,110)-f.top-f.height*.46),m,v).y;
   reveal=point(direction==='left'?r.left-f.left-f.width*fraction:r.right-f.right+f.width*fraction,y);
   conceal=point(direction==='left'?r.left-f.left-f.width*.07:r.right-f.right+f.width*.07,y);
   clear=point(direction==='left'?r.left-f.right-14:r.right-f.left+14,y);
  }
  if(!fits(reveal,m,v)||!fits(conceal,m,v))continue;
  const canClear=clearPose(clear,m,v,surfaces,text);
  const bounds=actorRect(reveal,m),visibleShare=1-coveredArea(bounds,surfaces)/Math.max(1,bounds.width*bounds.height);
  if(visibleShare<.18)continue;
  const preferred=direction===(side<0?'left':'right');
  choices.push({side:direction,rect:r,surfaceId:r.id,reveal,conceal,clear,canClear,visibleShare,
   score:visibleShare*4+(canClear?2:0)+(preferred?.45:0)+(direction==='top'&&Math.max(gutter.left,gutter.right)<f.width*.35?.9:0)-
    Math.hypot(reveal.x-start.x,reveal.y-start.y)/3000});
 }
 return choices.sort((a,b)=>b.score-a.score)[0]||null;
};

/**
 * Plan timings are milliseconds. sampleCardAction takes normalized progress.
 * Each depth-changing hold is >=600ms and outside the card. The caller should
 * pause its action clock during portalHold until actual actor clearance and
 * its own rendered depth have settled; resolveDepth never teleports M.
 * allowExternalPortal opts into a horizontal offscreen corridor when an in-view
 * depth gate is impossible. Honour allowViewportExit until waitForArrival has
 * reached its inside-viewport target; arrival is independent of portal clearance.
 */
export function planCardAction({rect,viewport,metrics,kind='peek',side=1,start={x:0,y:80},
 surfaces=[],protectedRects=[],depth=start.depth??1,allowExternalPortal=false}={}){
 const r=rectOf(rect),v=viewportOf(viewport),m=metricsOf(metrics),f=m.footprint;
 const all=surfacesOf([...surfaces,r]).filter(s=>s.right>-m.size&&s.left<v.width+m.size&&s.bottom>-m.size&&s.top<v.height+m.size);
 const text=surfacesOf(protectedRects);
 const origin=point(finite(start.x),finite(start.y)),initialDepth=depth<0?-1:1;
 const externalStart=allowExternalPortal&&!fits(origin,m,v);
 const plan={kind,requestedKind:kind,start:origin,rect:r,metrics:m,viewport:v,available:false,
  reason:'no-safe-portal',duration:0,durationMs:0,segments:[],portal:null,targetId:r.id};
 if(r.width<30||r.height<30)return plan;
 const egress=findEgress(origin,m,v,all,text);
 let current={...origin},lastDepth=initialDepth;
 const add=(phase,to,duration,options={})=>{
  const constrain=options.allowViewportExit?p=>point(p.x,p.y):p=>clampPose(p,m,v);
  const from={...current},end=constrain(to),distance=Math.hypot(end.x-from.x,end.y-from.y);
  const nx=distance?-(end.y-from.y)/distance:0,ny=distance?(end.x-from.x)/distance:0;
  const bend=options.curve===false?0:Math.min(38,distance*.13)*(side<0?-1:1);
  const p1=constrain(point(mix(from.x,end.x,.30)+nx*bend,mix(from.y,end.y,.30)+ny*bend));
  const p2=constrain(point(mix(from.x,end.x,.76)+nx*bend*.35,mix(from.y,end.y,.76)+ny*bend*.35));
  const segment={phase,p0:from,p1,p2,p3:end,start:plan.duration,end:plan.duration+duration,
   depth:options.depth??lastDepth,portal:options.portal??plan.portal,portalHold:Boolean(options.portalHold),
   egress:Boolean(options.egress),allowViewportExit:Boolean(options.allowViewportExit),
   waitForArrival:Boolean(options.waitForArrival),facing:side<0?-1:1};
  plan.segments.push(segment);plan.duration+=duration;current=end;lastDepth=segment.depth;
 };
 if(Math.hypot(egress.x-origin.x,egress.y-origin.y)>2){
  add('approach',egress,bound(Math.hypot(egress.x-origin.x,egress.y-origin.y)*3,350,1000),
   {depth:initialDepth,egress:true,curve:false});
 }
 const topCandidates=[.25,.5,.75].map(q=>({
  perch:point(r.left+r.width*q-m.contact.x,r.top-m.contact.y+1),
  clear:point(r.left+r.width*q-m.contact.x,r.top-f.bottom-14)
 })).filter(p=>fits(p.perch,m,v)&&clearPose(p.clear,m,v,all,text)&&
  !text.some(t=>overlaps(actorRect(p.perch,m),t,3)));
 const top=topCandidates.sort((a,b)=>Math.hypot(a.clear.x-current.x,a.clear.y-current.y)-
  Math.hypot(b.clear.x-current.x,b.clear.y-current.y))[0];
 if(kind==='perch'&&top&&!externalStart){
  plan.portal={side:'top',rect:r,surfaceId:r.id};plan.available=true;plan.reason='';
  add('anticipation',clampPose(point(current.x+(current.x-top.clear.x)*.045,current.y+5),m,v),180,{curve:false});
  add('approach',top.clear,800);
  add('hold',top.clear,600,{depth:1,portalHold:true});
  add('arrival',top.perch,620,{depth:1,curve:false});
  add('hold',top.perch,1850,{depth:1});
  add('recovery',top.clear,650,{depth:1,curve:false});
 }else{
  let portal=choosePortal(r,m,v,side,all,text,current);
  if(!portal)return plan;
  plan.portal=portal;
  const leftClear=point(r.left-f.right-14,portal.clear.y);
  const rightClear=point(r.right-f.left+14,portal.clear.y);
  const arch=top?point(r.left+r.width*.5-(f.left+f.right)/2,top.clear.y):null;
  const orbitPossible=kind==='orbit'&&!externalStart&&arch&&clearPose(arch,m,v,all,text)&&clearPose(leftClear,m,v,all,text)&&clearPose(rightClear,m,v,all,text)&&
   clearPose(point(leftClear.x,arch.y),m,v,all,text)&&clearPose(point(rightClear.x,arch.y),m,v,all,text);
  if(orbitPossible){
   const begin=side<0?leftClear:rightClear,far=side<0?rightClear:leftClear;
   const farSide=side<0?'right':'left';
   const farPortal={side:farSide,rect:r,surfaceId:r.id};
   const farPeek=point(farSide==='left'?r.left-f.left-f.width*.58:r.right-f.right+f.width*.58,far.y);
   plan.available=true;plan.reason='';plan.portal=farPortal;
   add('approach',begin,800,{portal:{side:'any',rect:r,surfaceId:r.id}});
   add('hold',begin,600,{depth:1,portalHold:true,portal:{side:side<0?'left':'right',rect:r,surfaceId:r.id}});
   add('anticipation',point(begin.x,begin.y-8),180,{depth:1,curve:false});
   add('approach',point(begin.x,arch.y),550,{depth:1,curve:false});
   add('approach',arch,800,{depth:1,curve:false});
   add('approach',point(far.x,arch.y),800,{depth:1,curve:false});
   add('approach',far,500,{depth:1,curve:false});
   add('hold',far,650,{depth:-1,portalHold:true,portal:farPortal});
   add('reveal',farPeek,750,{depth:-1});
   add('hold',farPeek,1000,{depth:-1});
  }else{
   plan.kind='peek';plan.canExitFront=portal.canClear;
   const needsExternal=allowExternalPortal&&(externalStart||(!portal.canClear&&!egress.clear&&initialDepth>0));
   if(!portal.canClear&&!egress.clear&&initialDepth>0&&!needsExternal)return plan;
   if(needsExternal){
    // Keep the same card-edge reveal. Only its depth-entry corridor is external.
    plan.segments=[];plan.duration=0;current={...origin};lastDepth=initialDepth;
    const outsideLeft=Math.min(0,...all.map(s=>s.left))-f.right-24;
    const outsideRight=Math.max(v.width,...all.map(s=>s.right))-f.left+24;
    const y=clampPose(portal.conceal,m,v).y;
    const exits=[{side:'left',x:outsideLeft,y},{side:'right',x:outsideRight,y}]
     .sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
    const exit=exits[0],gate={side:exit.side,rect:r,surfaceId:r.id,external:true};
    plan.externalPortal=true;plan.externalSide=exit.side;
    add('approach',exit,bound(Math.hypot(exit.x-origin.x,exit.y-origin.y)*3,700,1800),
     {depth:initialDepth,allowViewportExit:true,curve:false,egress:true,portal:gate});
    add('hold',exit,650,{depth:-1,portalHold:true,allowViewportExit:true,portal:gate});
    add('approach',portal.conceal,900,{depth:-1,allowViewportExit:true,curve:false});
    // Arrival does NOT require card clearance: reentry deliberately ends behind it.
    add('arrival',portal.conceal,320,{depth:-1,allowViewportExit:true,waitForArrival:true,curve:false});
   }else{
    const entry=portal.canClear?portal.clear:current;
    add('anticipation',clampPose(point(current.x+(current.x-entry.x)*.04,current.y+5),m,v),180,{curve:false});
    if(Math.hypot(entry.x-current.x,entry.y-current.y)>2)add('approach',entry,750);
    add('hold',entry,650,{depth:-1,portalHold:clearPose(entry,m,v,all,text),portal:{side:'any',rect:r,surfaceId:r.id}});
    add('approach',portal.conceal,600,{depth:-1});
   }
   add('reveal',portal.reveal,1050,{depth:-1});
   add('hold',portal.reveal,1450,{depth:-1,waitForArrival:true});
   if(portal.canClear){
    add('recovery',portal.clear,950,{depth:-1});
    add('hold',portal.clear,650,{depth:1,portalHold:true});
   }else add('recovery',portal.conceal,850,{depth:-1});
   plan.available=true;plan.reason='';
  }
 }
 plan.end={...current};plan.durationMs=plan.duration;return plan;
}

/** A curved pose target. Steering the actual actor remains the caller's job. */
export function sampleCardAction(plan,progress=0){
 const t=bound(progress,0,1),time=t*Math.max(1,finite(plan?.duration));
 const segments=plan?.segments||[];
 const segment=segments.find(s=>time<=s.end)||segments.at(-1);
 if(!plan?.available||!segment)return {...(plan?.start||{x:0,y:0}),depth:1,phase:'hold',
  phaseProgress:0,portal:plan?.portal||null,portalHold:false,allowViewportExit:false,waitForArrival:false,available:false};
 const u=bound((time-segment.start)/Math.max(1,segment.end-segment.start),0,1);
 const p=cubic(segment.p0,segment.p1,segment.p2,segment.p3,ease(u));
 return {...p,depth:segment.depth,phase:segment.phase,phaseProgress:u,portal:segment.portal,
  portalHold:segment.portalHold,waitForDepth:segment.portalHold,egress:segment.egress,
  allowViewportExit:segment.allowViewportExit,waitForArrival:segment.waitForArrival,
  facing:segment.facing,available:true};
}

/**
 * Accept a DISCRETE depth target only after the ACTUAL footprint clears every
 * card and the selected portal. Caller owns depth damping and animation time.
 */
export function resolveDepth(actor,requested,surfaces=[],previousDepth=1,portal=null){
 const a=rectOf(actor),all=surfacesOf(surfaces),previous=previousDepth<0?-1:1;
 const requestedDepth=finite(requested,previous)<0?-1:1;
 const hits=all.filter(r=>overlaps(a,r,1));
 const clear=portalClear(a,portal,all)&&hits.length===0;
 const blocked=requestedDepth!==previous&&!clear;
 const depth=blocked?previous:requestedDepth;
 return {depth,targetDepth:depth,blocked,portalClear:clear,
  reason:blocked?(hits.length?'card-overlap':'portal-not-clear'):'accepted',
  occluders:depth<0?hits:[]};
}

/** Pointer reactions are allowed only on currently visible, non-reading pixels. */
export function visibleAtPoint(position,actor,depth,surfaces=[],protectedRects=[]){
 const p={x:finite(position?.x),y:finite(position?.y)},a=rectOf(actor);
 if(!inRounded(p,a)||surfacesOf(protectedRects).some(r=>inRounded(p,r)))return false;
 return !(depth<0&&surfacesOf(surfaces).some(r=>inRounded(p,r)));
}
