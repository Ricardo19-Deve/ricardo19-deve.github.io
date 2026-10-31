import {sectionElements,chooseTarget,interactiveTarget,bound,actorRect,planCardAction,sampleCardAction,resolveDepth,visibleAtPoint} from './m-world-spatial.mjs?v=21';
import {MLifeV16} from './m-lab/interactions/life-v16.mjs';

(() => {
 'use strict';
 const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
 const debugEnabled=new URLSearchParams(location.search).get('m-debug')==='1';
 const layer=document.createElement('div');
 layer.className='mascot-world-v9 m-world-loading';
 layer.dataset.mOverlay='true';layer.setAttribute('aria-hidden','true');
 const host=document.createElement('div');host.className='mascot-creature';layer.append(host);
 const toggle=document.createElement('button');
 toggle.type='button';toggle.className='m-world-toggle';toggle.dataset.mOverlay='true';
 toggle.textContent='M · Loading';toggle.setAttribute('aria-label','Pause M');toggle.setAttribute('aria-pressed','true');
 document.body.append(layer,toggle);
 const life=new MLifeV16({seed:18421,personality:'balanced'});
 const state={x:0,y:100,vx:0,vy:0,depth:1,depthTarget:1,mode:'float',phase:'hold',emotion:'neutral',emotionUntil:0,clock:0,targetId:null};
 let avatar=null,loading=null,active=true,frameId=null,lastFrame=0,route=null,nextChoice=0,frozen=false,disposed=false;
 let reducedMotion=motionPreference.matches,lastLife=null,renderFrame=null;
 let metrics={size:innerWidth<720?208:272,footprint:{left:24,top:16,right:248,bottom:256,width:224,height:240},contact:{x:136,y:244}};
 const stats={frames:0,layoutReads:0,layoutRefreshes:0,lastFrameMs:0,maxFrameMs:0,depthTransitions:0};
 const cache={dirty:true,documents:[],texts:[],lastRead:0,version:0};
 const geometryTransitions=new Map();
 const ids=new WeakMap(),observedSurfaces=new Set();let nextId=0;
 const idOf=element=>{if(!ids.has(element))ids.set(element,'surface-'+(++nextId));return ids.get(element);};
 const overlap=(a,b,p=0)=>a.left<b.right+p&&a.right>b.left-p&&a.top<b.bottom+p&&a.bottom>b.top-p;
 const rect=(r,p=0)=>({left:r.left-p,top:r.top-p,right:r.right+p,bottom:r.bottom+p,width:r.width+2*p,height:r.height+2*p,radius:Math.max(0,r.radius||0)});
 const viewport=()=>({width:innerWidth,height:innerHeight,headerBottom:Math.max(0,document.querySelector('header.top')?.getBoundingClientRect().bottom||0)});
 const ownNode=node=>Boolean(node?.closest?.('[data-m-overlay]'));
 function mergeTextRects(rects){
  const merged=[];
  for(const item of rects.sort((a,b)=>a.top-b.top||a.left-b.left)){
   const match=merged.find(r=>overlap(r,item,1)&&Math.min(r.right,item.right)-Math.max(r.left,item.left)>Math.min(r.width,item.width)*.45);
   if(match){const l=Math.min(match.left,item.left),t=Math.min(match.top,item.top),r=Math.max(match.right,item.right),b=Math.max(match.bottom,item.bottom);Object.assign(match,{left:l,top:t,right:r,bottom:b,width:r-l,height:b-t});}
   else merged.push({...item,radius:2});
  }
  return merged;
 }
 function refreshLayout(now=performance.now()){
  if(!cache.dirty||now-cache.lastRead<70)return;
  cache.dirty=false;cache.lastRead=now;cache.version++;stats.layoutRefreshes++;
  const sx=scrollX,sy=scrollY;
  cache.documents=sectionElements(document).map(element=>{
   const b=element.getBoundingClientRect();stats.layoutReads++;
   const style=getComputedStyle(element);
   return {id:idOf(element),element,left:b.left+sx,top:b.top+sy,right:b.right+sx,bottom:b.bottom+sy,width:b.width,height:b.height,radius:parseFloat(style.borderTopLeftRadius)||0,visible:style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0};
  }).filter(r=>r.width>40&&r.height>35&&r.visible);
  for(const element of observedSurfaces)if(!cache.documents.some(r=>r.element===element)){resizeObserver.unobserve(element);observedSurfaces.delete(element);}
  for(const {element}of cache.documents)if(!observedSurfaces.has(element)){resizeObserver.observe(element);observedSurfaces.add(element);}
  const texts=[];
  for(const root of [document.querySelector('main'),document.querySelector('footer')].filter(Boolean)){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walker.nextNode())){
    const parent=node.parentElement;
    if(!node.textContent.trim()||!parent||parent.closest('script,style,[hidden],[aria-hidden="true"]'))continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const b of range.getClientRects()){
     stats.layoutReads++;
     if(b.width<1||b.height<2)continue;
     texts.push({left:b.left+sx-3,top:b.top+sy-3,right:b.right+sx+3,bottom:b.bottom+sy+3,width:b.width+6,height:b.height+6});
    }
   }
  }
  const controls=[];
  for(const element of document.querySelectorAll('main input,main textarea,main select,main button,main a.btn,main [role="button"]')){
   const b=element.getBoundingClientRect();stats.layoutReads++;
   if(b.width>0)controls.push({...rect(b,4),left:b.left+sx-4,top:b.top+sy-4,right:b.right+sx+4,bottom:b.bottom+sy+4,radius:Math.min(b.height/2+4,(parseFloat(getComputedStyle(element).borderRadius)||0)+4)});
  }
  cache.texts=[...mergeTextRects(texts),...controls];
 }
 const onScreen=(r,v,p=0)=>r.right>-p&&r.left<v.width+p&&r.bottom>v.headerBottom-p&&r.top<v.height+p;
 function worldSnapshot(now=performance.now()){
  for(const element of geometryTransitions.keys())if(!element.isConnected)geometryTransitions.delete(element);
  if(geometryTransitions.size){cache.dirty=true;cache.lastRead=0;}
  refreshLayout(now);
  const v=viewport(),sx=scrollX,sy=scrollY;
  const project=r=>({...r,left:r.left-sx,right:r.right-sx,top:r.top-sy,bottom:r.bottom-sy});
  const surfaces=cache.documents.map(project).filter(r=>onScreen(r,v,metrics.size));
  const protectedRects=cache.texts.map(project).filter(r=>onScreen(r,v,metrics.size));
  for(const element of [document.querySelector('header.top'),toggle].filter(Boolean)){
   const b=element.getBoundingClientRect();stats.layoutReads++;
   if(b.width)protectedRects.push({...rect(b,4),radius:Math.min(16,b.height/2)});
  }
  return {viewport:v,surfaces,protectedRects,version:cache.version};
 }
 function clampActor(position,v,allowExit=false){
  const f=metrics.footprint;
  if(allowExit)return position;
  return {x:bound(position.x,8-f.left,Math.max(8-f.left,v.width-f.right-8)),y:bound(position.y,8-f.top,Math.max(8-f.top,v.height-f.bottom-8))};
 }
 function initialPosition(world,preferred){
  const f=metrics.neutralFootprint||metrics.footprint,g=metrics.footprint,v=world.viewport;
  const limits={left:Math.max(8-f.left,8-g.left),right:Math.min(v.width-f.right-8,v.width-g.right-8),top:Math.max(v.headerBottom+5-f.top,8-g.top),bottom:Math.min(v.height-f.bottom-8,v.height-g.bottom-8)};
  limits.right=Math.max(limits.left,limits.right);limits.bottom=Math.max(limits.top,limits.bottom);
  const clamp=p=>({x:bound(p.x,limits.left,limits.right),y:bound(p.y,limits.top,limits.bottom)});
  const origin=clamp(preferred);let best=origin,bestScore=Infinity;
  const consider=p=>{
   const a={left:p.x+f.left,right:p.x+f.right,top:p.y+f.top,bottom:p.y+f.bottom};
   let area=0;
   for(const r of world.protectedRects)area+=Math.max(0,Math.min(a.right,r.right)-Math.max(a.left,r.left))*Math.max(0,Math.min(a.bottom,r.bottom)-Math.max(a.top,r.top));
   const score=area+Math.hypot(p.x-origin.x,p.y-origin.y)*.002;
   if(score<bestScore){best=p;bestScore=score;}
  };
  consider(origin);
  for(let y=limits.top;y<=limits.bottom;y+=8)
   for(let x=limits.left;x<=limits.right;x+=12)consider({x,y});
  return best;
 }
 function startRoute(now,world,preferred=null,requestedElement=null){
  const visible=world.surfaces.filter(s=>onScreen(s,world.viewport)&&s.height>65&&s.width>95);
  const remaining=visible.filter(s=>s.id!==state.targetId);
  let selected=requestedElement?visible.find(s=>s.element===requestedElement):null;
  const candidates=(remaining.length?remaining:visible).map(s=>({el:s.element,rect:s}));
  const choice=selected?{el:selected.element,rect:selected}:chooseTarget(candidates,{x:state.x+metrics.size/2,y:state.y+metrics.size/2},world.viewport.width,world.viewport.height,()=>life.random());
  selected=choice?.rect;
  const kinds=preferred?[preferred]:[life.random()<.45?'peek':'perch','orbit','perch','peek'];
  route=null;
  for(const candidate of selected?[selected,...visible.filter(s=>s.id!==selected.id)]:[]){
   selected=candidate;
   for(const kind of [...new Set(kinds)]){
    const side=life.random()<.5?-1:1;
    const plan=planCardAction({allowExternalPortal:true,rect:selected,viewport:world.viewport,metrics,kind,side,start:{x:state.x,y:state.y,depth:state.depthTarget},depth:state.depthTarget,surfaces:world.surfaces,protectedRects:world.protectedRects});
    if(plan.available){route={plan,side,elapsed:0,element:selected.element,version:world.version,documentRect:{left:selected.left+scrollX,top:selected.top+scrollY,width:selected.width,height:selected.height}};state.mode=plan.kind;state.targetId=selected.id;break;}
   }
   if(route)break;
  }
  if(!route){
   const f=metrics.footprint;
   const points=[{x:8-f.left,y:world.viewport.headerBottom+20-f.top},{x:world.viewport.width-f.right-10,y:world.viewport.height-f.bottom-68},{x:world.viewport.width*.55-metrics.size/2,y:world.viewport.height*.45-metrics.size/2}];
   const score=p=>{
    const a=actorRect(p,metrics);let hidden=0;
    for(let y=0;y<5;y++)for(let x=0;x<5;x++)if(!visibleAtPoint({x:a.left+(x+.5)*a.width/5,y:a.top+(y+.5)*a.height/5},a,state.depthTarget,world.surfaces,world.protectedRects))hidden++;
    return hidden;
   };
   points.sort((a,b)=>score(a)-score(b));
   const target=clampActor(points[0],world.viewport),escape=state.depthTarget<0;
   const left=Math.min(0,...world.surfaces.map(r=>r.left))-f.right-16,right=Math.max(world.viewport.width,...world.surfaces.map(r=>r.right))-f.left+16;
   const egress={x:Math.abs(state.x-left)<Math.abs(state.x-right)?left:right,y:state.y};
   route={free:true,escape,reentry:escape,egress,start:{x:state.x,y:state.y},target,elapsed:0,duration:3200};
   state.mode='float';state.targetId=null;nextChoice=now+4200;
  }
 }
 function advanceRoute(dt,now,world){
  if(!route&&now<nextChoice)return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};
  if(!route||(route.free&&!route.escape&&now>=nextChoice))startRoute(now,world);
  if(route?.free){
   if(route.escape){
    const clear=!world.surfaces.some(r=>overlap(actorRect(state,metrics),r,6));
    if(clear&&Math.abs(state.depth-1)<.08&&Math.hypot(state.x-route.egress.x,state.y-route.egress.y)<6){
     route.escape=false;route.start={x:state.x,y:state.y};route.elapsed=0;nextChoice=now+4200;
    }else return {...route.egress,depth:1,phase:'recovery',portal:null,allowViewportExit:true};
   }
   route.elapsed+=dt*1000;const u=bound(route.elapsed/route.duration,0,1),e=u*u*(3-2*u);
   return {x:route.start.x+(route.target.x-route.start.x)*e,y:route.start.y+(route.target.y-route.start.y)*e,depth:1,phase:u<1?'approach':'hold',portal:null,allowViewportExit:route.reentry};
  }
  const live=world.surfaces.find(s=>s.element===route?.element);
  if(!live||!onScreen(live,world.viewport)||!route.element.isConnected){route=null;nextChoice=now+150;return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};}
  if(world.version!==route.version){
   const current={left:live.left+scrollX,top:live.top+scrollY,width:live.width,height:live.height};
   const reflow=Object.keys(current).some(key=>Math.abs(current[key]-route.documentRect[key])>.5);
   if(reflow){
    const plan=planCardAction({allowExternalPortal:true,rect:live,viewport:world.viewport,metrics,kind:route.plan.requestedKind||route.plan.kind,side:route.side||1,start:{x:state.x,y:state.y,depth:state.depthTarget},depth:state.depthTarget,surfaces:world.surfaces,protectedRects:world.protectedRects});
    if(!plan.available){route=null;nextChoice=now+150;return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};}
    route.plan=plan;route.elapsed=0;route.documentRect=current;state.mode=plan.kind;
   }
   route.version=world.version;
  }
  // Scroll translates the cached document rectangle continuously; refresh plan
  // geometry without restarting the acting clock or sampling layout each frame.
  const delta={x:live.left-route.plan.rect.left,y:live.top-route.plan.rect.top};
  const sample=sampleCardAction(route.plan,bound(route.elapsed/Math.max(1,route.plan.duration),0,1));
  sample.x+=delta.x;sample.y+=delta.y;
  const reachable=clampActor(sample,world.viewport);
  if(!sample.allowViewportExit&&Math.hypot(reachable.x-sample.x,reachable.y-sample.y)>2){route=null;nextChoice=now;return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};}
  if(state.mode==='perch'&&sample.phase==='hold'&&!sample.portalHold){sample.x+=route.plan.metrics.contact.x-metrics.contact.x;sample.y+=route.plan.metrics.contact.y-metrics.contact.y;}
  if(sample.portal?.rect)sample.portal={...sample.portal,rect:{...sample.portal.rect,left:sample.portal.rect.left+delta.x,right:sample.portal.rect.right+delta.x,top:sample.portal.rect.top+delta.y,bottom:sample.portal.rect.bottom+delta.y}};
  const actual=actorRect(state,metrics),resolved=resolveDepth(actual,sample.depth,world.surfaces,state.depthTarget,sample.portal);
  const distance=Math.hypot(sample.x-state.x,sample.y-state.y);
  const arrivedInside=actual.left>=0&&actual.right<=world.viewport.width&&actual.top>=0&&actual.bottom<=world.viewport.height;
  const waiting=(sample.portalHold&&(!resolved.portalClear||Math.abs(state.depth-resolved.depth)>.03||distance>7))||(sample.waitForArrival&&(distance>4||!arrivedInside));
  if(!waiting)route.elapsed+=dt*1000;
  if(route.elapsed>=route.plan.duration&&Math.hypot(sample.x-state.x,sample.y-state.y)<6&&Math.abs(state.depth-sample.depth)<.08){route=null;nextChoice=now+600;}
  return sample;
 }
 function updateLife(dt,world){
  lastLife=life.step(dt,{mode:state.mode==='float'?'float':'swim',reducedMotion,manualFace:performance.now()<state.emotionUntil});
  if(lastLife.action){
   state.emotion=lastLife.action.expression||'neutral';state.emotionUntil=performance.now()+1900;
   if(!route||(route.free&&!route.escape&&state.phase==='hold'))startRoute(performance.now(),world,lastLife.action.mode==='peek'?'peek':lastLife.action.mode==='swim'?'orbit':null);
  }
  if(performance.now()>state.emotionUntil)state.emotion=state.mode==='peek'?'curious':state.mode==='perch'?'neutral':'neutral';
 }
 function renderCurrent(world,dt=0){
  const f=metrics.footprint,ratio=devicePixelRatio||1;
  host.style.width=metrics.size+'px';host.style.height=metrics.size+'px';
  const drawX=Math.round(state.x*ratio)/ratio,drawY=Math.round(state.y*ratio)/ratio;
  host.style.transform='translate3d('+drawX+'px,'+drawY+'px,0)';
  const actor={left:drawX,top:drawY,width:metrics.size,height:metrics.size};
  const bounds=actorRect({x:drawX,y:drawY},metrics);
  const spatial={actor,surfaces:world.surfaces.map(({element,...r})=>r),protectedRects:world.protectedRects,depth:state.depth};
  renderFrame={...spatial,bounds};
  avatar.setSpatialFrame(spatial);
  const target=world.surfaces.find(s=>s.id===state.targetId);
  const gaze=lastLife?.attention==='pointer'?lastLife.gaze:target?{x:bound((target.left+target.width*.5-(state.x+(f.left+f.right)/2))/260,-1,1),y:bound(((state.y+(f.top+f.bottom)*.4)-(target.top+Math.min(100,target.height*.3)))/220,-1,1)}:lastLife?.gaze||{x:0,y:0};
  if(frozen)avatar.render();
  else avatar.update(dt,{mode:state.mode,activity:state.mode==='perch'&&state.phase==='hold'?'perch':state.mode,emotion:reducedMotion?'neutral':state.emotion,vx:state.vx,vy:state.vy,clock:state.clock,reducedMotion,attention:gaze,nearCard:Boolean(target),depth:state.depth});
  layer.dataset.depth=state.depth<0?'behind':'front';layer.dataset.worldAction=state.mode;layer.dataset.phase=state.phase;
  layer.dataset.worldTarget=state.targetId||'corridor';layer.dataset.occluders=String(world.surfaces.filter(r=>overlap(bounds,r)).length);
  layer.dataset.lifeMood=lastLife?.mood||'resting';
 }
 function tick(now){
  frameId=null;if(disposed||!active||!avatar||document.hidden||frozen)return;
  const started=performance.now(),dt=bound((now-(lastFrame||now))/1000,0,.05);lastFrame=now;
  metrics=avatar.getMetrics();state.clock+=dt;
  const world=worldSnapshot(now);updateLife(dt,world);
  if(reducedMotion){Object.assign(state,clampActor({x:world.viewport.width-metrics.footprint.right-12,y:world.viewport.height-metrics.footprint.bottom-66},world.viewport),{vx:0,vy:0,mode:'rest',phase:'hold'});}
  else{
   const point=advanceRoute(dt,now,world),dx=point.x-state.x,dy=point.y-state.y;
   const perchHold=state.mode==='perch'&&point.phase==='hold'&&!point.portalHold;
   const attached=perchHold&&(route?.attached||Math.hypot(point.x-state.x,point.y-state.y)<3);
   if(route)route.attached=Boolean(attached);
   const maxSpeed=state.mode==='peek'?110:state.mode==='perch'?120:150;
   if(attached){state.vx=(point.x-state.x)/Math.max(.008,dt);state.vy=(point.y-state.y)/Math.max(.008,dt);state.x=point.x;state.y=point.y;}
   else{
    const distance=Math.hypot(dx,dy),speed=Math.min(maxSpeed,distance*2.5),response=1-Math.exp(-4.8*dt);
    state.vx+=((distance>1?dx/distance*speed:0)-state.vx)*response;state.vy+=((distance>1?dy/distance*speed:0)-state.vy)*response;
    Object.assign(state,clampActor({x:state.x+state.vx*dt,y:state.y+state.vy*dt},world.viewport,point.allowViewportExit));
   }
   state.phase=point.phase;
   const previous=state.depthTarget,resolved=resolveDepth(actorRect(state,metrics),point.depth,world.surfaces,previous,point.portal);
   state.depthTarget=resolved.depth;if(previous!==resolved.depth)stats.depthTransitions++;
  }
  state.depth+=(state.depthTarget-state.depth)*(1-Math.exp(-9*dt));
  renderCurrent(world,dt);stats.frames++;stats.lastFrameMs=performance.now()-started;stats.maxFrameMs=Math.max(stats.maxFrameMs,stats.lastFrameMs);
  if(!reducedMotion)schedule();
 }
 function schedule(){if(frameId===null&&active&&avatar&&!document.hidden&&!frozen)frameId=requestAnimationFrame(tick);}
 function invalidate(){cache.dirty=true;if(reducedMotion)schedule();}
 function setActive(enabled,persist=true){
  active=Boolean(enabled);layer.hidden=!active;
  toggle.textContent=active?(avatar?'M · Pause':'M · Loading'):'M · Resume';
  toggle.setAttribute('aria-label',active?'Pause M':'Resume M');toggle.setAttribute('aria-pressed',String(active));
  if(persist)try{localStorage.setItem('m-world-enabled',active?'yes':'no');}catch{}
  if(!active){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;life.setEnabled(false);}
  else{life.setEnabled(!reducedMotion);lastFrame=0;if(!avatar)load();else if(frozen)renderCurrent(worldSnapshot());else schedule();}
 }
 async function load(){
  if(loading||avatar)return loading;
  loading=(async()=>{
   try{
    const {mountMWorld3D}=await import('./m-world-3d.mjs?v=21');
    avatar=await mountMWorld3D(host,{onProgress(percent){layer.dataset.loadProgress=String(percent);if(active)toggle.textContent='M · '+percent+'%';}});
    metrics=avatar.getMetrics();cache.dirty=true;cache.lastRead=0;
    const world=worldSnapshot();
    const hero=world.surfaces.find(s=>s.element.matches('.hero-visual'));
    const initial=hero?{x:hero.left-metrics.contact.x*.85,y:hero.top+hero.height*.45-metrics.size*.5}:{x:world.viewport.width-metrics.size,y:world.viewport.height-metrics.size-80};
    Object.assign(state,initialPosition(world,initial));state.depth=state.depthTarget=1;
    layer.classList.remove('m-world-loading');layer.classList.add('m-world-3d');layer.dataset.model='V6 GLB HQ';
    const diag=avatar.getDiagnostics();layer.dataset.detailMaps=String(diag.detailMaps);layer.dataset.renderPixels=(diag.renderPixels||[]).join('x');
    layer.dataset.rigBones=String(diag.rigBones||diag.bones||diag.boneCount||0);layer.dataset.skinSets=String(diag.skinSets||0);
    setActive(active,false);renderCurrent(world,0);nextChoice=performance.now()+2600;
   }catch(error){
    layer.dataset.model='Unavailable';layer.dataset.error=String(error.message||error);layer.classList.remove('m-world-loading');layer.hidden=true;
    toggle.textContent='M · Retry';toggle.setAttribute('aria-label','Retry loading M');
    console.error('[M World] Original 3D mascot could not be initialized',error);
   }finally{loading=null;}
  })();
  return loading;
 }
 toggle.addEventListener('click',()=>{if(layer.dataset.error&&!avatar){delete layer.dataset.error;active=true;layer.hidden=false;load();}else setActive(!active);});
 window.addEventListener('scroll',()=>{life.signal('scroll',{delta:bound((scrollY-(cache.lastScroll??scrollY))/160,-1,1)});cache.lastScroll=scrollY;if(reducedMotion)schedule();},{passive:true});
 window.addEventListener('resize',()=>{invalidate();route=null;nextChoice=0;},{passive:true});
 window.visualViewport?.addEventListener('resize',invalidate,{passive:true});
 document.addEventListener('load',event=>{if(event.target?.tagName==='IMG')invalidate();},true);
 document.fonts?.ready.then(invalidate);
 function geometryTransition(event){
  const element=event.target;
  if(ownNode(element)||!element.closest?.('main,footer,header')||!['transform','translate','rotate','scale'].includes(event.propertyName))return;
  const properties=geometryTransitions.get(element)||new Set();
  if(event.type==='transitionrun')properties.add(event.propertyName);else properties.delete(event.propertyName);
  if(properties.size)geometryTransitions.set(element,properties);else geometryTransitions.delete(element);
  cache.lastRead=0;invalidate();
 }
 for(const type of ['transitionrun','transitionend','transitioncancel'])document.addEventListener(type,geometryTransition,true);
 const resizeObserver=new ResizeObserver(invalidate);if(document.querySelector('main'))resizeObserver.observe(document.querySelector('main'));
 const mutationObserver=new MutationObserver(records=>{if(records.some(r=>!ownNode(r.target instanceof Element?r.target:r.target.parentElement)))invalidate();});
 mutationObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','style']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;}else{lastFrame=0;schedule();}});
 motionPreference.addEventListener('change',event=>{reducedMotion=event.matches;life.setEnabled(active&&!reducedMotion);route=null;nextChoice=0;invalidate();schedule();});
 window.addEventListener('pointermove',event=>{
  if(!active||!avatar||reducedMotion||event.pointerType==='touch')return;
  const a=actorRect(state,metrics),dx=event.clientX-(a.left+a.width*.5),dy=event.clientY-(a.top+a.height*.4);
  if(Math.hypot(dx,dy)<360)life.signal('pointer',{x:dx/220,y:-dy/220});else life.signal('leave');
 },{passive:true});
 window.addEventListener('pointerleave',()=>life.signal('leave'),{passive:true});
 window.addEventListener('pointerup',event=>{
  if(!active||!avatar||reducedMotion||interactiveTarget(event.target))return;
  const world=worldSnapshot(),a=actorRect(state,metrics);
  if(!visibleAtPoint({x:event.clientX,y:event.clientY},a,state.depth,world.surfaces,world.protectedRects))return;
  life.signal('tap');state.emotionUntil=0;schedule();
 },{passive:true});
 function snapshot(){
  if(avatar)metrics=avatar.getMetrics();
  const world=worldSnapshot();
  return {ready:Boolean(avatar),active,error:layer.dataset.error||null,state:{...state},acting:{attached:Boolean(route?.attached),externalPortal:Boolean(route?.plan?.externalPortal)},metrics,actor:actorRect(renderFrame?{x:renderFrame.actor.left,y:renderFrame.actor.top}:state,metrics),
   surfaces:world.surfaces.map(({element,...r})=>r),protectedRects:world.protectedRects,renderer:avatar?.getDiagnostics(),life:lastLife,stats:{...stats},frozen};
 }
 if(debugEnabled)window.MWorld={
  snapshot,
  async stepTo({selector='.card',index=0,kind='peek',side=1,progress=.5,depth,instant=true}={}){
   if(!avatar)await load();if(!avatar)throw new Error('Original M is not ready');
   metrics=avatar.getMetrics();frozen=true;if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;
   cache.dirty=true;cache.lastRead=0;const world=worldSnapshot();
   const element=document.querySelectorAll(selector)[index],surface=world.surfaces.find(s=>s.element===element);
   if(!surface)throw new Error('The selected component is not visible');
   const plan=planCardAction({allowExternalPortal:true,rect:surface,viewport:world.viewport,metrics,kind,side,start:{x:state.x,y:state.y,depth:state.depthTarget},depth:state.depthTarget,surfaces:world.surfaces,protectedRects:world.protectedRects});
   if(!plan.available)return {...snapshot(),plan:{available:false,reason:plan.reason}};
   const point=sampleCardAction(plan,progress);
   if(instant){state.x=point.x;state.y=point.y;state.vx=state.vy=0;}
   state.mode=plan.kind;state.phase=point.phase;state.targetId=surface.id;state.depth=state.depthTarget=depth===undefined?point.depth:depth;
   setActive(true,false);renderCurrent(world,0);
   return {...snapshot(),plan:{available:plan.available,kind:plan.kind,requestedKind:kind,duration:plan.duration,portal:plan.portal,phase:point.phase}};
  },
  async playAction({selector='.card',index=0,kind='peek'}={}){
   if(!avatar)await load();if(!avatar)throw new Error('Original M is not ready');
   metrics=avatar.getMetrics();frozen=false;cache.dirty=true;cache.lastRead=0;const world=worldSnapshot(),element=document.querySelectorAll(selector)[index];
   if(!element)throw new Error('Unknown diagnostic component');
   startRoute(performance.now(),world,kind,element);lastFrame=0;setActive(true,false);schedule();
   return {...snapshot(),plan:{available:Boolean(route&&!route.free),kind:route?.plan?.kind||'float',requestedKind:kind,targetId:state.targetId}};
  },
  setDepth(value){
   if(!avatar||!frozen)throw new Error('Freeze a real pose with stepTo before setting diagnostic depth');
   metrics=avatar.getMetrics();state.depth=state.depthTarget=Number(value)<0?-1:1;renderCurrent(worldSnapshot(),0);return snapshot();
  },
  resume(){frozen=false;nextChoice=0;schedule();},
  setActive,
  dispose(){disposed=true;if(frameId!==null)cancelAnimationFrame(frameId);resizeObserver.disconnect();mutationObserver.disconnect();for(const type of ['transitionrun','transitionend','transitioncancel'])document.removeEventListener(type,geometryTransition,true);avatar?.dispose();layer.remove();toggle.remove();}
 };
 try{if(localStorage.getItem('m-world-enabled')==='no')active=false;}catch{}
 life.setEnabled(active&&!reducedMotion);setActive(active,false);
})();