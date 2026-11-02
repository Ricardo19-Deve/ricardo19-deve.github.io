import {sectionElements,interactiveTarget,bound,actorRect,planCardAction,sampleCardAction,resolveDepth,visibleAtPoint,chooseCorridorTarget} from './m-world-spatial.mjs?v=26';
import {createWorldObserver} from './m-world-observer.mjs?v=26';
import {createWorldDirector} from './m-world-director.mjs?v=26';
import {advanceLocomotion} from './m-world-locomotion.mjs?v=26';
import {MLifeV16} from './m-lab/interactions/life-v16.mjs';
import {MWorldBrain} from './m-world-brain.mjs?v=26';
import {M_GESTURES,GESTURE_DURATIONS} from './m-world-acting.mjs?v=26';
import {createMCompanion} from './m-world-companion.mjs?v=26';
import {M_WORLD_CONFIG} from './m-world-config.mjs?v=26';
import {isExplicitGesture,selectGestureIntent,gestureIntentExpired,gestureReady,planGestureStage,gestureViewportFits} from './m-world-action-policy.mjs?v=26';

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
 const life=new MLifeV16({seed:18421,personality:'playful'});
 const brain=new MWorldBrain({seed:18421}),failedPlans=new Map(),recentCorridors=[];
 const interest={scrollUntil:0,readingUntil:0,attentionId:null};
 let brainState=brain.snapshot(),companion=null,pendingGesture=null,director=null,observer=null;
 let directorComponents=[],directorSnapshot=null,directorActivity=null,directorLastExecution=null;
 let directorKey='',directorRevision=0,directorNextRead=0,directorEvent='idle',directorRouteId=0,directorCompletedRouteId=null;const directorRecent=[];
 const state={x:0,y:100,vx:0,vy:0,ax:0,ay:0,heading:0,turn:0,travel:0,leanX:0,leanY:0,depth:1,depthTarget:1,mode:'float',phase:'hold',emotion:'neutral',emotionUntil:0,clock:0,targetId:null,gesture:null,expressionHold:null};
 let avatar=null,loading=null,active=true,frameId=null,lastFrame=0,route=null,nextChoice=0,frozen=false,disposed=false;
 let motionOptIn=false;try{motionOptIn=sessionStorage.getItem('m-world-motion-allowed')==='yes';}catch{}
 let reducedMotion=motionPreference.matches&&!motionOptIn,lastLife=null,renderFrame=null;
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
  for(const element of [document.querySelector('header.top'),toggle,companion?.elements.toggle,companion?.isOpen()?companion.elements.panel:null].filter(Boolean)){
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
  const recovering=state.depthTarget<0||state.depth<-.05;
  const visible=world.surfaces.filter(s=>onScreen(s,world.viewport)&&s.height>65&&s.width>95);
  const actor={x:state.x+metrics.size/2,y:state.y+metrics.size/2};
  const options={nowMs:now,actor,viewport:world.viewport};
  let pool=requestedElement?visible.filter(r=>r.element===requestedElement):visible.filter(r=>(failedPlans.get(r.id)||0)<=now);
  route=null;
  while(pool.length){
   const id=requestedElement?pool[0].id:brain.chooseTarget(pool.map(r=>{
    const area=Math.max(1,r.width*r.height);
    const covered=world.protectedRects.reduce((sum,t)=>sum+Math.max(0,Math.min(r.right,t.right)-Math.max(r.left,t.left))*Math.max(0,Math.min(r.bottom,t.bottom)-Math.max(r.top,t.top)),0);
    return {...r,protectedCoverage:Math.min(1,covered/area)};
   }),options);
   const selected=pool.find(r=>r.id===id);
   if(!selected)break;
   const kinds=preferred?[preferred]:[life.random()<.45?'peek':'perch','orbit','perch','peek'];
   for(const kind of [...new Set(kinds)]){
    const side=life.random()<.5?-1:1;
    const plan=planCardAction({allowExternalPortal:true,rect:selected,viewport:world.viewport,metrics,kind,side,start:{x:state.x,y:state.y,depth:state.depthTarget},depth:state.depthTarget,surfaces:world.surfaces,protectedRects:world.protectedRects});
    if(plan.available){route={plan,side,elapsed:0,element:selected.element,version:world.version,documentRect:{left:selected.left+scrollX,top:selected.top+scrollY,width:selected.width,height:selected.height}};state.mode=plan.kind;state.targetId=selected.id;break;}
   }
   if(route)break;
   failedPlans.set(selected.id,now+6000);if(failedPlans.size>32)failedPlans.delete(failedPlans.keys().next().value);
   pool=pool.filter(r=>r.id!==selected.id);
  }
  // A quiet/cooldown decision never falls back to a random route.
  if(!route&&!requestedElement&&!recovering&&!brain.snapshot().spontaneousAllowed){nextChoice=now+1200;return false;}
  if(!route&&!requestedElement&&!recovering&&brain.snapshot().reason==='visit-cooldown'){nextChoice=now+1200;return false;}
  if(!route){
   const f=metrics.footprint;
   const selected=chooseCorridorTarget({viewport:world.viewport,metrics,position:state,protectedRects:world.protectedRects,surfaces:world.surfaces,depth:1,recent:recentCorridors});
   const target=clampActor(selected||state,world.viewport),escape=recovering;
   for(let i=recentCorridors.length-1;i>=0;i--)if(Math.hypot(target.x-recentCorridors[i].x,target.y-recentCorridors[i].y)<8)recentCorridors.splice(i,1);
   recentCorridors.push({x:target.x,y:target.y});if(recentCorridors.length>6)recentCorridors.shift();
   const left=Math.min(0,...world.surfaces.map(r=>r.left))-f.right-16,right=Math.max(world.viewport.width,...world.surfaces.map(r=>r.right))-f.left+16;
   const egress={x:Math.abs(state.x-left)<Math.abs(state.x-right)?left:right,y:state.y};
   route={free:true,escape,reentry:escape,egress,start:{x:state.x,y:state.y},target,elapsed:0,duration:3200};
   state.mode='float';state.targetId=null;nextChoice=now+4200;
  }
 }
 function advanceRoute(dt,now,world){
  if(state.gesture||state.expressionHold)return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};
  if(!route&&now<nextChoice)return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};
  if((!route||(route.free&&!route.gestureStage&&!route.escape&&now>=nextChoice))&&!state.gesture)startRoute(now,world);
  if(!route)return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};
  if(route?.free){
   if(route.gestureStage&&(route.version!==world.version||route.scrollX!==scrollX||route.scrollY!==scrollY)&&!stageGesture(world))return {x:state.x,y:state.y,depth:state.depthTarget,phase:'hold'};
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
  if(!waiting&&!state.gesture)route.elapsed+=dt*1000;
  if(!route.visited&&sample.phase==='hold'&&!sample.portalHold&&distance<4&&arrivedInside){brain.noteVisit(state.targetId,now);route.visited=true;}
  if(!state.gesture&&route.elapsed>=route.plan.duration&&Math.hypot(sample.x-state.x,sample.y-state.y)<6&&Math.abs(state.depth-sample.depth)<.08){directorCompletedRouteId=route.directorRouteId??null;route=null;nextChoice=now+600;}
  return sample;
 }

 function componentKind(element){
  if(element.matches('.hero-visual'))return 'portrait';
  if(element.matches('.card,.case-teaser'))return 'project';
  if(element.matches('.role'))return 'experience';
  if(element.matches('.expertise article'))return 'expertise';
  if(element.matches('.cert'))return 'certificate';
  if(element.closest('.contact'))return 'contact';
  return 'about';
 }
 function publicComponents(world){
  const v=world.viewport;
  return world.surfaces.filter(r=>{
   const area=Math.max(1,r.width*r.height),visible=Math.max(0,Math.min(r.right,v.width)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,v.height)-Math.max(r.top,v.headerBottom));
   return visible/area>=.3&&r.element.isConnected;
  }).slice(0,8).map(r=>{
   const kind=componentKind(r.element),heading=r.element.querySelector('h3,h2,h4,strong'),title=(heading?.textContent||(kind==='portrait'?'Ricardo Pinheiro portrait':kind+' component')).replace(/\s+/g,' ').trim().slice(0,80);
   const cx=Math.max(0,Math.min(v.width,(r.left+r.right)/2))/Math.max(1,v.width),cy=Math.max(0,Math.min(v.height,(r.top+r.bottom)/2))/Math.max(1,v.height);
   return {id:r.id,kind,title,zone:(cy<1/3?'top':cy>2/3?'bottom':'middle')+'-'+(cx<1/3?'left':cx>2/3?'right':'center'),shape:[Math.round(r.left/24),Math.round(r.top/24),Math.round(r.width/24),Math.round(r.height/24)]};
  });
 }
 function directorPlan(world,surface,kind){
  for(const side of [1,-1]){
   const plan=planCardAction({allowExternalPortal:true,rect:surface,viewport:world.viewport,metrics,kind,side,start:{x:state.x,y:state.y,depth:state.depthTarget},depth:state.depthTarget,surfaces:world.surfaces,protectedRects:world.protectedRects});
   if(plan.available&&plan.kind===kind)return {plan,side};
  }
  return null;
 }
 function directorBlocked(now){
  const typing=Boolean(document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]'));
  return {hidden:document.hidden||!active||frozen,reducedMotion,typing,reading:now<interest.readingUntil||document.getSelection()?.isCollapsed===false,scrolling:now<interest.scrollUntil,busy:Boolean(companion?.isOpen()||state.gesture||state.expressionHold||isExplicitGesture(pendingGesture))};
 }
 function rememberDirector(decision){
  directorRecent.push({targetId:decision.targetId,action:decision.action});if(directorRecent.length>6)directorRecent.shift();
  directorLastExecution={...decision,at:state.clock,status:'complete'};directorEvent='arrival';
 }
 function applyDirectorIntent(decision,snapshot){
  const now=performance.now(),world=worldSnapshot(now);
  if(Object.values(directorBlocked(now)).some(Boolean)||snapshot.revision!==directorSnapshot?.revision)return false;
  const surface=decision.targetId===null?null:world.surfaces.find(r=>r.id===decision.targetId&&onScreen(r,world.viewport));
  if(decision.targetId!==null&&(!surface||!publicComponents(world).some(r=>r.id===decision.targetId&&r.title===snapshot.targets.find(t=>t.id===decision.targetId)?.title)))return false;
  const intent={name:decision.gesture==='none'?null:decision.gesture,source:'director',expression:decision.expression,queuedAt:state.clock};
  interest.attentionId=surface?.id||null;
  if(['inspect','rest'].includes(decision.action)){
   intent.directorDecision={...decision};
   if(!queueIntent(intent))return false;
   directorLastExecution={...decision,at:state.clock,status:'queued'};return true;
  }
  const selected=surface&&directorPlan(world,surface,decision.action);if(!selected)return false;
  const {plan,side}=selected,routeId=++directorRouteId;directorCompletedRouteId=null;
  if(pendingGesture?.source==='life')pendingGesture=null;
  route={plan,side,directorRouteId:routeId,elapsed:0,element:surface.element,version:world.version,documentRect:{left:surface.left+scrollX,top:surface.top+scrollY,width:surface.width,height:surface.height}};
  state.mode=plan.kind;state.targetId=surface.id;state.emotion=decision.expression;state.emotionUntil=now+Math.min(60000,plan.duration*2+5000);
  directorActivity={...decision,routeId,started:now};directorLastExecution={...decision,at:state.clock,status:'travelling'};return true;
 }
 function updateDirectorActivity(now){
  if(!directorActivity)return;
  const decision=directorActivity;
  if(now-decision.started>35000||(route&&route.directorRouteId!==decision.routeId)){
   directorActivity=null;directorLastExecution={...decision,at:state.clock,status:'cancelled'};state.emotionUntil=now+600;return;
  }
  if(!route){
   directorActivity=null;state.emotionUntil=now+600;
   if(directorCompletedRouteId!==decision.routeId){directorLastExecution={...decision,at:state.clock,status:'cancelled'};return;}
   rememberDirector(decision);
   if(!Object.values(directorBlocked(now)).some(Boolean))queueIntent({name:decision.gesture==='none'?null:decision.gesture,source:'director',expression:decision.expression,queuedAt:state.clock});
  }
 }
 function updateDirector(now,world,force=false){
  if(!director||!observer||!avatar)return;
  const context=directorBlocked(now);
  if(!force&&now<directorNextRead){if(Object.values(context).some(Boolean))director.update({snapshot:directorSnapshot,...context});return;}
  directorNextRead=now+1000;
  const records=publicComponents(world),section=currentSection(world);
  const key=JSON.stringify([section,Math.round(world.viewport.width/16),Math.round(world.viewport.height/16),records,interest.attentionId,directorEvent,directorRecent]);
  if(key!==directorKey){
   directorKey=key;directorRevision++;
   directorComponents=records.map(({shape,...r})=>{
    const surface=world.surfaces.find(s=>s.id===r.id),actions=['inspect'];
    for(const action of ['peek','perch','orbit'])if(directorPlan(world,surface,action))actions.push(action);
    return {...r,actions};
   });
  }
  directorSnapshot=observer.capture({revision:'scene-'+directorRevision,section,language:navigator.language?.startsWith('pt')?'pt':'en',event:directorEvent,attentionId:interest.attentionId,recent:directorRecent});
  director.update({snapshot:directorSnapshot?.targets.length?directorSnapshot:null,...context});
  if(director.getStatus().pending&&pendingGesture?.source==='life')pendingGesture=null;
  companion?.refresh();
 }

 function currentSection(world){
  const ranked=world.surfaces.map(r=>({r,area:Math.max(0,Math.min(r.right,world.viewport.width)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,world.viewport.height)-Math.max(r.top,world.viewport.headerBottom))})).sort((a,b)=>b.area-a.area);
  return ranked[0]?.r.element.closest('section[id]')?.id||'home';
 }
 function queueIntent(incoming){
  if(!active||reducedMotion||(avatar&&!gestureViewportFits(metrics,viewport())))return false;
  if(incoming.source==='visitor'||incoming.source==='assistant'){if(directorActivity)directorLastExecution={...directorActivity,at:state.clock,status:'cancelled'};directorActivity=null;director?.update({snapshot:directorSnapshot,busy:true});}
  pendingGesture=selectGestureIntent(pendingGesture,incoming,state.gesture||state.expressionHold);
  if(pendingGesture!==incoming)return false;
  if(isExplicitGesture(incoming)){life.manual();if(avatar&&!state.gesture&&!state.expressionHold)stageGesture(worldSnapshot());}
  schedule();return true;
 }
 function queueGesture(name,{source='visitor',expression}={}){
  if(!M_GESTURES.includes(name))return false;
  return queueIntent({name,source,expression,queuedAt:state.clock});
 }
 function queueExpression(expression){
  if(!['neutral','happy','curious','surprised'].includes(expression))return false;
  return queueIntent({name:null,source:'assistant',expression,queuedAt:state.clock});
 }
 function stageGesture(world){
  const plan=planGestureStage({position:state,metrics,viewport:world.viewport,surfaces:world.surfaces,protectedRects:world.protectedRects});
  if(!plan){pendingGesture=null;route=null;nextChoice=performance.now()+1200;return false;}
  route={free:true,gestureStage:true,...plan,reentry:plan.reentry,start:{x:state.x,y:state.y},elapsed:0,duration:1200,version:world.version,scrollX,scrollY};
  state.mode='float';state.phase='approach';state.targetId=null;return true;
 }
 function updateGesture(dt,world,now){
  let completed=false;
  if(state.gesture){state.gesture.age+=dt;if(state.gesture.age>=GESTURE_DURATIONS[state.gesture.name]){state.gesture=null;completed=true;}}
  if(state.expressionHold){state.expressionHold.age+=dt;if(state.expressionHold.age>=2.2){state.expressionHold=null;completed=true;}}
  if(completed){state.emotionUntil=now+600;if(!pendingGesture){route=null;nextChoice=now+1200;}}
  if(gestureIntentExpired(pendingGesture,state.clock))pendingGesture=null;
  const playing=Boolean(state.gesture||state.expressionHold);
  if(isExplicitGesture(pendingGesture)&&!playing&&!route?.gestureStage)stageGesture(world);
  if(pendingGesture&&!playing&&gestureReady({state,actor:actorRect(state,metrics),viewport:world.viewport,escaping:route?.escape})){
   const intent=pendingGesture;pendingGesture=null;
   if(intent.directorDecision)rememberDirector(intent.directorDecision);
   if(intent.name)state.gesture={name:intent.name,source:intent.source,expression:intent.expression,age:0,side:life.random()<.5?-1:1};
   else state.expressionHold={source:intent.source,age:0};
   state.vx=state.vy=0;
   state.emotion=intent.expression||({wave:'happy',curious:'curious',surprised:'surprised',shy:'neutral'}[intent.name]);
   state.emotionUntil=Infinity;
  }
 }
 function updateLife(dt,world,now){
  const input=document.activeElement,typing=Boolean(input?.matches?.('input,textarea,select,[contenteditable="true"]'));
  brainState=brain.observe({nowMs:now,section:currentSection(world),scrolling:now<interest.scrollUntil,reading:now<interest.readingUntil||document.getSelection()?.isCollapsed===false,engaged:Boolean(companion?.isOpen()||typing),reducedMotion,hidden:document.hidden,active});
  lastLife=life.step(dt,{mode:state.mode==='float'?'float':'swim',reducedMotion,manualFace:now<state.emotionUntil||(!brainState.spontaneousAllowed&&!life.pending)});
  if(lastLife.action&&!isExplicitGesture(pendingGesture)&&!state.gesture&&!state.expressionHold&&!director?.getStatus().pending&&!directorActivity){
   state.emotion=lastLife.action.expression||'neutral';state.emotionUntil=now+1900;
   const gesture=lastLife.action.mood==='welcoming'?(life.random()<.35?'playful':'wave'):lastLife.action.mode==='curious'?(life.random()<.35?'nod':'curious'):lastLife.action.mode==='shy'?(life.random()<.4?'wink':'shy'):lastLife.action.mood==='playful'?'playful':({knock:'surprised'}[lastLife.action.mode]);
   if(gesture)queueGesture(gesture,{source:'life',expression:lastLife.action.expression});
   if((lastLife.action.mode==='peek'||lastLife.action.mode==='swim')&&(!route||(route.free&&!route.escape&&state.phase==='hold')))startRoute(now,world,lastLife.action.mode==='peek'?'peek':'orbit');
  }
  if(now>state.emotionUntil)state.emotion=state.mode==='peek'?'curious':'neutral';
  updateGesture(dt,world,now);
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
  const target=world.surfaces.find(s=>s.id===interest.attentionId)||world.surfaces.find(s=>s.id===state.targetId);
  const gaze=lastLife?.attention==='pointer'?lastLife.gaze:target?{x:bound((target.left+target.width*.5-(state.x+(f.left+f.right)/2))/260,-1,1),y:bound(((state.y+(f.top+f.bottom)*.4)-(target.top+Math.min(100,target.height*.3)))/220,-1,1)}:lastLife?.gaze||{x:0,y:0};
  if(frozen)avatar.render();
  else avatar.update(dt,{mode:state.mode,activity:state.mode==='perch'&&state.phase==='hold'?'perch':state.mode,emotion:reducedMotion?'neutral':state.emotion,vx:state.vx,vy:state.vy,clock:state.clock,gesture:state.gesture,reducedMotion,locomotion:{ax:state.ax,ay:state.ay,heading:state.heading,turn:state.turn,travel:state.travel,leanX:state.leanX,leanY:state.leanY},attention:gaze,nearCard:Boolean(target),depth:state.depth});
  layer.dataset.depth=state.depth<0?'behind':'front';layer.dataset.worldAction=state.mode;layer.dataset.phase=state.phase;
  layer.dataset.worldTarget=state.targetId||'corridor';layer.dataset.occluders=String(world.surfaces.filter(r=>overlap(bounds,r)).length);
  layer.dataset.lifeMood=lastLife?.mood||'resting';layer.dataset.gesture=state.gesture?.name||'none';
 }
 function tick(now){
  frameId=null;if(disposed||!active||!avatar||document.hidden||frozen)return;
  const started=performance.now(),dt=bound((now-(lastFrame||now))/1000,0,.05);lastFrame=now;
  metrics=avatar.getMetrics();state.clock+=dt;
  const world=worldSnapshot(now);updateLife(dt,world,now);updateDirector(now,world);
  if(reducedMotion){Object.assign(state,clampActor({x:world.viewport.width-metrics.footprint.right-12,y:world.viewport.height-metrics.footprint.bottom-66},world.viewport),{vx:0,vy:0,mode:'rest',phase:'hold'});}
  else{
   const point=advanceRoute(dt,now,world),dx=point.x-state.x,dy=point.y-state.y;
   const perchHold=state.mode==='perch'&&point.phase==='hold'&&!point.portalHold;
   const attached=perchHold&&(route?.attached||Math.hypot(point.x-state.x,point.y-state.y)<3);
   if(route)route.attached=Boolean(attached);
   const maxSpeed=state.mode==='peek'?110:state.mode==='perch'?120:150;
   if(attached){const previous={x:state.x,y:state.y};Object.assign(state,advanceLocomotion({...state,vx:0,vy:0},{x:state.x,y:state.y},dt));state.vx=(point.x-previous.x)/Math.max(.008,dt);state.vy=(point.y-previous.y)/Math.max(.008,dt);state.x=point.x;state.y=point.y;}
   else{
    Object.assign(state,advanceLocomotion(state,point,dt,{maxSpeed,maxAcceleration:340,arrivalRadius:72}));
    Object.assign(state,clampActor(state,world.viewport,point.allowViewportExit));
   }
   state.phase=point.phase;
   const previous=state.depthTarget,resolved=resolveDepth(actorRect(state,metrics),point.depth,world.surfaces,previous,point.portal);
   state.depthTarget=resolved.depth;if(previous!==resolved.depth)stats.depthTransitions++;
  }
  updateDirectorActivity(now);
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
  companion?.refreshMotionControl?.();
  if(!active)director?.update({snapshot:directorSnapshot,hidden:true});
  if(!active){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;life.setEnabled(false);}
  else{life.setEnabled(!reducedMotion);lastFrame=0;if(!avatar)load();else if(frozen)renderCurrent(worldSnapshot());else schedule();}
 }
 async function load(){
  if(loading||avatar)return loading;
  loading=(async()=>{
   try{
    const {mountMWorld3D}=await import('./m-world-3d.mjs?v=26');
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
 window.addEventListener('scroll',()=>{interest.scrollUntil=performance.now()+650;life.signal('scroll',{delta:bound((scrollY-(cache.lastScroll??scrollY))/160,-1,1)});cache.lastScroll=scrollY;if(reducedMotion)schedule();},{passive:true});
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
 document.addEventListener('pointerover',event=>{if(!ownNode(event.target)&&event.target.closest?.('p,h1,h2,h3,li,.card-body'))interest.readingUntil=performance.now()+1800;},{passive:true});
 document.addEventListener('focusin',event=>{if(!ownNode(event.target))interest.readingUntil=performance.now()+1400;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)director?.update({snapshot:directorSnapshot,hidden:true});if(document.hidden){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;}else{lastFrame=0;schedule();}});
 function refreshMotionPreference(){
  reducedMotion=motionPreference.matches&&!motionOptIn;
  if(reducedMotion){pendingGesture=null;state.gesture=null;state.expressionHold=null;state.emotionUntil=0;}
  life.setEnabled(active&&!reducedMotion);route=null;directorActivity=null;nextChoice=0;companion?.refreshMotionControl?.();director?.update({snapshot:directorSnapshot,reducedMotion,hidden:!active});invalidate();schedule();
 }
 function enableMotion(){
  motionOptIn=true;try{sessionStorage.setItem('m-world-motion-allowed','yes');}catch{}
  refreshMotionPreference();return true;
 }
 motionPreference.addEventListener('change',()=>{motionOptIn=false;try{sessionStorage.removeItem('m-world-motion-allowed');}catch{}refreshMotionPreference();});
 document.addEventListener('pointerover',event=>{
  if(ownNode(event.target)||!active||reducedMotion)return;
  const surface=cache.documents.find(r=>r.element.contains(event.target));
  if(surface&&interest.attentionId!==surface.id){interest.attentionId=surface.id;directorEvent='pointer-interest';directorNextRead=0;}
 },{passive:true});
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
  life.signal('tap');if(!isExplicitGesture(pendingGesture)&&!isExplicitGesture(state.gesture)&&!state.expressionHold)state.emotionUntil=0;schedule();
 },{passive:true});
 function snapshot(){
  if(avatar)metrics=avatar.getMetrics();
  const world=worldSnapshot();
  return {ready:Boolean(avatar),active,error:layer.dataset.error||null,state:{...state,gesture:state.gesture?{...state.gesture}:null,expressionHold:state.expressionHold?{...state.expressionHold}:null},acting:{attached:Boolean(route?.attached),externalPortal:Boolean(route?.plan?.externalPortal)},brain:brain.snapshot(),companion:companion?.snapshot(),pendingGesture:pendingGesture?.name||null,pendingIntent:pendingGesture?{...pendingGesture}:null,preferences:{reducedMotion,systemReducedMotion:motionPreference.matches,motionOptIn},staging:route?.gestureStage?{escape:route.escape,target:{...route.target},egress:{...route.egress}}:null,metrics,actor:actorRect(renderFrame?{x:renderFrame.actor.left,y:renderFrame.actor.top}:state,metrics),
   surfaces:world.surfaces.map(({element,...r})=>r),protectedRects:world.protectedRects,director:{...director?.getStatus(),perception:directorSnapshot,activity:directorActivity,lastExecution:directorLastExecution},renderer:avatar?.getDiagnostics(),life:lastLife,stats:{...stats},frozen};
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
  playGesture:queueGesture,
  setActive,
  dispose(){disposed=true;if(frameId!==null)cancelAnimationFrame(frameId);resizeObserver.disconnect();mutationObserver.disconnect();for(const type of ['transitionrun','transitionend','transitioncancel'])document.removeEventListener(type,geometryTransition,true);director?.dispose();observer?.dispose();companion?.destroy();avatar?.dispose();layer.remove();toggle.remove();}
 };
 observer=createWorldObserver({getComponents:()=>directorComponents});
 director=createWorldDirector({endpoint:M_WORLD_CONFIG.directorEndpoint||'',onIntent:applyDirectorIntent,onStatus:()=>companion?.refresh()});
 companion=createMCompanion({getDirectorStatus:()=>director.getStatus(),onDirectorEnabled:enabled=>{director.setEnabled(enabled);if(!enabled)directorActivity=null;updateDirector(performance.now(),worldSnapshot(),true);},endpoint:M_WORLD_CONFIG.assistantEndpoint,onGesture:queueGesture,onExpression:queueExpression,getMotionStatus:()=>({active,reducedMotion}),onEnableMotion:enableMotion,getContext:()=>({section:brain.snapshot().section||'home',language:navigator.language?.startsWith('pt')?'pt':'en'}),onSection:name=>{document.getElementById(name)?.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});},onEngagement:()=>{invalidate();}});
 try{if(localStorage.getItem('m-world-enabled')==='no')active=false;}catch{}
 life.setEnabled(active&&!reducedMotion);setActive(active,false);
})();
