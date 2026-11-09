import './m-analytics-bootstrap.mjs?v=34';
import {createCharacter,characterReceiptId} from './m-world-character.mjs?v=55';
import {createAutonomy} from './m-world-autonomy.mjs?v=55';
import {planBallFlight,sampleBallFlight} from './m-world-ball.mjs?v=55';
import {createScenePlan,createScenePlayer} from './m-world-scenes.mjs?v=55';
import {createSessionMemory} from './m-world-memory.mjs?v=55';
import {createGrowthMemory,makeLivingSeed,growthFamilyForDecision} from './m-world-growth.mjs?v=55';
import {createWorldKnowledge} from './m-world-world-knowledge.mjs?v=55';
import {createLivedWorldStories} from './m-world-lived-stories.mjs?v=55';
import {senseWorldRhythm} from './m-world-world-rhythm.mjs?v=55';
import {getContextComponent,matchContextComponent} from './m-world-context.mjs?v=55';
import {M_AFFECTS,AFFECT_DURATIONS} from './m-world-affect.mjs?v=55';
import {sectionElements,interactiveTarget,bound,actorRect,planCardAction,sampleCardAction,resolveDepth,visibleAtPoint,chooseCorridorTarget} from './m-world-spatial.mjs?v=55';
import {createWorldObserver} from './m-world-observer.mjs?v=55';
import {createWorldDirector} from './m-world-director.mjs?v=55';
import {advanceLocomotion} from './m-world-locomotion.mjs?v=55';
import {MLifeV16} from './m-lab/interactions/life-v16.mjs';
import {MWorldBrain} from './m-world-brain.mjs?v=55';
import {M_GESTURES,GESTURE_DURATIONS,PAW_CONTACT_PROGRESS} from './m-world-acting.mjs?v=55';
import {createMCompanion} from './m-world-companion.mjs?v=55&ui=61';
import {M_WORLD_CONFIG} from './m-world-config.mjs?v=55';
import {isExplicitGesture,selectGestureIntent,gestureIntentExpired,gestureReady,planGestureStage,gestureViewportFits} from './m-world-action-policy.mjs?v=55';

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
  // V58: the only public entry point is Ask M; motion lives in its options menu.
  toggle.hidden=true;toggle.tabIndex=-1;toggle.setAttribute('aria-hidden','true');
 document.body.append(layer,toggle);
 // Every visit gets a distinct opening; growth remembers only opted-in outcomes.
 const livingSeed=makeLivingSeed();
 const life=new MLifeV16({seed:livingSeed,personality:'playful'});
 const brain=new MWorldBrain({seed:(livingSeed^0x9e3779b9)>>>0}),failedPlans=new Map(),recentCorridors=[];
 const memory=createSessionMemory(),character=createCharacter(),scenes=createScenePlayer();
 const growth=createGrowthMemory({remember:character.snapshot().remember});
 const worldKnowledge=createWorldKnowledge({remember:character.snapshot().remember});
 const worldStories=createLivedWorldStories({remember:character.snapshot().remember});
 const opening=['explore','play','observe'][livingSeed%3];
 const autonomy=createAutonomy({seed:(livingSeed^0x85ebca6b)>>>0});
 let autoExecution=null,autonomyNextRead=0,autonomyFatigue=0,autonomyLastRead=0,lastAutonomousGame=null;
 const autoStats={accepted:0,completed:0,failed:0,cancelled:0,events:[]};
 let characterEnergy=memory.snapshot().energy,sceneMeta=null,sceneCommand=null,completedSceneRoute=null,completedSceneGesture=null,nextSceneAt=0,lastMemoryAt=0,lastPaceScroll=scrollY,game=null,gameSerial=0;
 const playDock=document.createElement('section'),playNote=document.createElement('p'),playNext=document.createElement('button'),playStop=document.createElement('button'),playLight=document.createElement('span'),playBall=document.createElement('span');
 playDock.className='m-play-dock';playDock.dataset.mOverlay='true';playDock.hidden=true;playDock.setAttribute('aria-label','Play with M');playNote.setAttribute('role','status');playNext.type=playStop.type='button';playNext.textContent='I found M';playStop.textContent='Stop play';playDock.append(playNote,playNext,playStop);playLight.className='m-play-light';playLight.setAttribute('aria-hidden','true');playLight.hidden=true;document.body.append(playDock,playLight);
 playBall.className='m-play-ball';playBall.dataset.mOverlay='true';playBall.setAttribute('aria-hidden','true');playBall.hidden=true;document.body.append(playBall);
 const interest={scrollUntil:0,readingUntil:0,attentionId:null,hoverGuardUntil:0,userAttentionUntil:0};
 let brainState=brain.snapshot(),companion=null,pendingGesture=null,director=null,observer=null;
 let directorComponents=[],directorSnapshot=null,directorActivity=null,directorLastExecution=null;
 let directorKey='',directorRevision=0,directorNextRead=0,directorEvent='idle',directorRouteId=0,directorCompletedRouteId=null;const directorRecent=[];
 const state={x:0,y:100,vx:0,vy:0,ax:0,ay:0,heading:0,turn:0,travel:0,leanX:0,leanY:0,depth:1,depthTarget:1,mode:'float',phase:'hold',emotion:'neutral',emotionUntil:0,clock:0,targetId:null,gesture:null,expressionHold:null,affect:null,lifeMoment:null};
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
  for(const element of [document.querySelector('header.top'),toggle,companion?.elements.toggle,companion?.isOpen()?companion.elements.panel:null,!playDock.hidden?playDock:null].filter(Boolean)){
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
    return {...r,protectedCoverage:Math.min(1,covered/area),novelty:memory.score(publicComponent(r)?.id||r.id)};
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
  if((!route||(route.free&&!route.gestureStage&&!route.escape&&now>=nextChoice))&&!state.gesture&&scenes.snapshot().status!=='playing'&&!game)startRoute(now,world);
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
  const waiting=(state.mode==='perch'&&sample.phase==='hold'&&!sample.portalHold&&distance>3)||(sample.portalHold&&(!resolved.portalClear||Math.abs(state.depth-resolved.depth)>.03||distance>7))||(sample.waitForArrival&&(distance>4||!arrivedInside));
  const searching=game?.name==='hide'&&route.sceneCommandId&&sample.phase==='hold'&&sample.waitForArrival&&!sample.portalHold&&sample.depth<0&&distance<5;
  if(searching&&!game.searchUntil){game.searchUntil=now+(game.autonomous?2200:8000);playNext.disabled=game.autonomous;playNote.textContent=game.autonomous?'M is playing near a card.':'M is peeking near a card. Can you find her?';}
  if((sceneMeta?.autonomyId||sceneMeta?.decision)&&!route.reacted&&['reveal','hold'].includes(sample.phase)&&!sample.portalHold&&distance<7){route.reacted=true;setCharacterAffect(state.mode==='peek'?'mischief':sceneMeta.affect||'content',{owner:sceneMeta.autonomyId||scenes.snapshot().id});}
  if(!waiting&&!state.gesture&&!(searching&&!game.found&&now<game.searchUntil))route.elapsed+=dt*1000;
  if(!route.visited&&sample.phase==='hold'&&!sample.portalHold&&distance<4&&arrivedInside){brain.noteVisit(state.targetId,now);route.visited=true;}
  if(!state.gesture&&route.elapsed>=route.plan.duration&&Math.hypot(sample.x-state.x,sample.y-state.y)<6&&Math.abs(state.depth-sample.depth)<.08){directorCompletedRouteId=route.directorRouteId??null;completedSceneRoute=route.sceneCommandId??null;route=null;nextChoice=now+600;}
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
  return {hidden:document.hidden||!active||frozen,reducedMotion,typing,reading:now<interest.readingUntil||document.getSelection()?.isCollapsed===false,scrolling:now<interest.scrollUntil,busy:Boolean(companion?.isOpen()||state.gesture||state.expressionHold||isExplicitGesture(pendingGesture)||pendingGesture?.autonomyId||route?.gestureStage||scenes.snapshot().status==='playing'||game||route?.explicit)};
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
  cancelAutonomy('ai-director',now);
  if(beginCharacterScene({source:'director',decision,targetId:decision.targetId,action:decision.action,gesture:decision.gesture,expression:decision.expression}))return true;
  return false;
 }

 function updateDirectorActivity(now){
  if(!directorActivity)return;
  const decision=directorActivity,current=scenes.snapshot();
  if(current.id!==decision.sceneId||current.status==='cancelled'||current.status==='idle'||now-decision.started>90000){
   directorActivity=null;directorLastExecution={...decision,at:state.clock,status:'cancelled'};return;
  }
  if(current.status==='complete'){directorActivity=null;rememberDirector(decision);}
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
  if(director.getStatus().pending&&pendingGesture?.source==='life'&&!pendingGesture.autonomyId)pendingGesture=null;
  companion?.refresh();
 }

 function publicComponent(surface){
  if(!surface)return null;
  const kind=componentKind(surface.element),heading=surface.element.querySelector('h3,h2,h4,strong');
  return matchContextComponent({kind,title:heading?.textContent||(kind==='portrait'?'Ricardo Pinheiro portrait':'')});
 }
 function activeChatContext(){
  const world=worldSnapshot(),records=publicComponents(world);
  const chosen=records.find(r=>r.id===interest.attentionId)||records.find(r=>r.id===state.targetId)||records[0];
  const component=chosen&&publicComponent(world.surfaces.find(r=>r.id===chosen.id));
  return {section:currentSection(world),language:navigator.language?.startsWith('pt')?'pt':'en',...(component?{component:component.id}:{}),character:character.getContext()};
 }
 function currentCharacterGoal(targets,world){
  const context=character.getContext();
  if(context.goal==='follow-light')return {id:context.goal,targetId:null};
  if(!['find-lookout','revisit-lookout'].includes(context.goal))return null;
  const favorite=character.snapshot().favorite?.stableId;
  const available=targets.filter(target=>getContextComponent(target.stableId)&&target.actions.includes('perch'));
  const target=context.goal==='revisit-lookout'?available.find(value=>value.stableId===favorite):available.sort((a,b)=>a.distance-b.distance)[0];
  if(target)return {id:context.goal,targetId:target.id};
  // Some responsive layouts have no visible card. A genuine clear hover can be a lookout.
  const restingPlace='lookout-'+currentSection(world);
  if(context.goal==='revisit-lookout'&&favorite!==restingPlace)return null;
  const stage=planGestureStage({position:state,metrics,viewport:world.viewport,surfaces:world.surfaces,protectedRects:world.protectedRects});
  if(!stage)return null;
  const body=actorRect({...state,...stage.target},{...metrics,footprint:metrics.neutralFootprint||metrics.footprint});
  if(body.left<0||body.right>world.viewport.width||body.top<world.viewport.headerBottom+4||body.bottom>world.viewport.height||world.protectedRects.some(r=>overlap(body,r)))return null;
  return {id:context.goal,targetId:null,restingPlace};
 }
 function recordCharacterExperience(owner,success){
  const goal=owner.decision.characterGoal;
  if(!goal)return false;
  return character.record({id:characterReceiptId(owner.characterVisit,owner.decision.id),goal,success,componentId:owner.characterComponent||null,publicComponent:owner.characterPublicComponent||null});
 }
 function resetCharacterMemory(){
  cancelAutonomy('memory-reset');state.lifeMoment=null;memory.clear();character.reset();if(typeof growth!=='undefined')growth.reset();if(typeof worldKnowledge!=='undefined')worldKnowledge.reset();if(typeof worldStories!=='undefined')worldStories.reset();autonomy.resetMemory(performance.now());companion?.refresh();
 }
 function setCharacterAffect(name,{weight=.9,owner=null}={}){
  if(M_AFFECTS.includes(name))state.affect={name,age:0,weight,owner};
 }
 function releaseCharacterAffect(){
  if(state.affect)state.affect.age=Math.max(state.affect.age,(AFFECT_DURATIONS[state.affect.name]||0)*.76);
 }
 function noteAutonomy(status,decision,now,reason){
  const key=status==='accepted'?'accepted':status==='complete'?'completed':status==='cancelled'?'cancelled':'failed';
  autoStats[key]=Math.min(1000000,autoStats[key]+1);
  autoStats.events.push({id:decision.id,kind:decision.kind,action:decision.action,play:decision.play,affect:decision.affect,targetId:decision.targetId,characterGoal:decision.characterGoal||null,status,at:now,reason});
  if(autoStats.events.length>16)autoStats.events.shift();
 }
 function finishAutonomy(success,reason,now){
  if(!autoExecution)return;
  const owner=autoExecution,decision=owner.decision;autoExecution=null;
  if(route?.autonomyId===decision.id)route=null;
  if(pendingGesture?.autonomyId===decision.id)pendingGesture=null;
  const acknowledged=autonomy.complete({success,reason,nowMs:now});
  const remembered=acknowledged&&recordCharacterExperience(owner,success);
  let livedBeat=null;
  if(acknowledged&&typeof growthFamilyForDecision==='function'){
   const family=growthFamilyForDecision(decision);
   if(family){
    if(typeof growth!=='undefined')growth.record({family,success});
    if(typeof worldStories!=='undefined')livedBeat=worldStories.record({family,success});
   }
  }
  if(success&&acknowledged&&decision.kind==='scene'&&decision.targetId){directorRecent.push({targetId:decision.targetId,action:decision.action});if(directorRecent.length>6)directorRecent.shift();directorEvent='arrival';}
  noteAutonomy(success&&acknowledged?'complete':'failed',decision,now,acknowledged?reason:'ownership-lost');
  releaseCharacterAffect();
  if(remembered&&success&&decision.characterGoal==='follow-light')setCharacterAffect('proud',{weight:1});
  if(livedBeat){
   // A lived story makes a visible but fleeting ORIGINAL-RIG reaction. This
   // event exists only after acknowledged real action; it is never simulated.
   state.lifeMoment={name:livedBeat.complete?'complete':livedBeat.beat,at:now,duration:4.5};
   if(livedBeat.complete)setCharacterAffect('delight',{weight:.66});
   else if(livedBeat.beat==='notice')setCharacterAffect('focus',{weight:.55});
   else if(livedBeat.beat==='explore')setCharacterAffect('content',{weight:.5});
   companion?.refresh();
  }
  nextChoice=now+1000;
 }
 function cancelAutonomy(reason='interrupted',now=performance.now()){
  const owned=autoExecution;autoExecution=null;
  if(owned){
   const id=owned.decision.id;
   if(game?.autonomyId===id)stopPlay(reason);
   if(owned.sceneId&&scenes.snapshot().id===owned.sceneId)clearScene(reason);
   const staging=pendingGesture?.autonomyId===id;
   if(staging)pendingGesture=null;
   if(state.gesture?.autonomyId===id)state.gesture=null;
   if(state.expressionHold?.autonomyId===id)state.expressionHold=null;
   if(route?.autonomyId===id)route=null;
   state.emotionUntil=now+600;noteAutonomy('cancelled',owned.decision,now,reason);releaseCharacterAffect();
  }
  autonomy.cancel(reason,now);nextChoice=now+1000;
 }
 function autonomyStatus(){
  return {...autonomy.snapshot(),...autoStats,events:autoStats.events.map(value=>({...value})),energy:bound(.82-autonomyFatigue+(characterEnergy-.5)*.12,.2,1),execution:autoExecution?{id:autoExecution.decision.id,kind:autoExecution.kind,sceneId:autoExecution.sceneId||null,gameId:autoExecution.gameId||null,started:autoExecution.started,characterGoal:autoExecution.decision.characterGoal||null}:null};
 }
 function updateAutonomy(now,world){
  const field=document.activeElement,typing=Boolean(field?.matches?.('input,textarea,select,[contenteditable="true"]'));
  const selection=document.getSelection?.()?.isCollapsed===false;
  const metabolicDt=autonomyLastRead?Math.min(.1,Math.max(0,(now-autonomyLastRead)/1000)):0;autonomyLastRead=now;
  const energetic=autoExecution&&(game?.autonomous||route?.sceneCommandId||state.gesture?.name==='hop');
  autonomyFatigue=bound(autonomyFatigue+(energetic?.008:state.gesture?.name==='sleep'?-.012:-.003)*metabolicDt,0,.6);
  const hard=!active||document.hidden||frozen||reducedMotion||typing||selection||now<interest.scrollUntil;
  if(hard){if(autoExecution)cancelAutonomy(typing?'typing':selection?'selection':reducedMotion?'reduced-motion':'visitor-interaction',now);return;}
  if(autoExecution){
   const owner=autoExecution;
   if(owner.kind==='game'){
    if(game?.id!==owner.gameId)finishAutonomy(lastAutonomousGame?.id===owner.gameId&&lastAutonomousGame.reason==='complete',lastAutonomousGame?.reason||'game-interrupted',now);
   }else if(owner.kind==='scene'){
    const current=scenes.snapshot();
    if(current.id!==owner.sceneId||current.status==='cancelled')finishAutonomy(false,current.reason||'scene-interrupted',now);
    else if(current.status==='complete')finishAutonomy(true,'scene-complete',now);
   }else{
    const id=owner.decision.id,playing=state.gesture?.autonomyId===id||state.expressionHold?.autonomyId===id,queued=pendingGesture?.autonomyId===id;
    if(playing)owner.visible=true;
    if(!playing&&!queued&&(owner.visible||now-owner.started>1500))finishAutonomy(Boolean(owner.visible),owner.visible?'performance-complete':'performance-unavailable',now);
   }
   if(autoExecution)return;
  }
  if(now<autonomyNextRead)return;autonomyNextRead=now+1000;
  const externalBusy=Boolean(companion?.isOpen()||state.gesture||state.expressionHold||pendingGesture||scenes.snapshot().status==='playing'||game||route?.explicit);
  const records=publicComponents(world),targets=records.map(record=>{
   const surface=world.surfaces.find(r=>r.id===record.id),known=directorComponents.find(r=>r.id===record.id),component=publicComponent(surface);
   const visible=Math.max(0,Math.min(surface.right,world.viewport.width)-Math.max(0,surface.left))*Math.max(0,Math.min(surface.bottom,world.viewport.height)-Math.max(world.viewport.headerBottom,surface.top));
   return {id:record.id,stableId:component?.id||record.id,kind:record.kind,actions:known?.actions||['inspect'],novelty:memory.score(component?.id||record.id),attention:now<interest.userAttentionUntil&&interest.attentionId===record.id?1:0,visibleShare:visible/Math.max(1,surface.width*surface.height),distance:Math.hypot((surface.left+surface.right)/2-state.x,(surface.top+surface.bottom)/2-state.y)};
  });
  const corridor=!externalBusy&&chooseCorridorTarget({viewport:world.viewport,metrics,position:state,protectedRects:world.protectedRects,surfaces:world.surfaces,depth:1,recent:recentCorridors});
  const characterGoal=externalBusy||now<interest.readingUntil?null:currentCharacterGoal(targets,world);
  const routinesAvailable=gestureViewportFits(metrics,world.viewport);
  const decision=autonomy.choose({nowMs:now,goal:characterGoal,context:{active,hidden:document.hidden,reducedMotion,typing,selection,scrolling:false,reading:now<interest.readingUntil,busy:externalBusy,section:currentSection(world)},energy:bound(.82-autonomyFatigue+(characterEnergy-.5)*.12,.2,1),remotePending:director?.getStatus().pending,selfPlayAvailable:Boolean(corridor&&Math.hypot(corridor.x-state.x,corridor.y-state.y)>44),routinesAvailable,ballPlayAvailable:routinesAvailable,targets,
   habits:typeof growth==='undefined'?undefined:{...growth.preferences(),opening},
   world:typeof senseWorldRhythm==='function'?{...senseWorldRhythm({date:new Date(),
    online:typeof navigator==='undefined'||navigator.onLine!==false}),
    discovery:typeof worldKnowledge==='undefined'?null:worldKnowledge.hint(),
    story:typeof worldStories==='undefined'?null:worldStories.hint()}:undefined});
  if(!decision)return;
  let accepted=false,kind=decision.kind;
  if(decision.kind==='self-play'||decision.play==='hide'){
   accepted=startPlay(decision.play,{autonomous:true,decision});kind='game';
  }else if(decision.kind==='scene')accepted=beginCharacterScene({source:'life',targetId:decision.targetId,action:decision.action,gesture:decision.gesture,expression:decision.expression,autonomyId:decision.id,affect:decision.affect});
  else{
   const neutral=actorRect(state,{...metrics,footprint:metrics.neutralFootprint||metrics.footprint});
   const stationary=Boolean(decision.quiet&&now<interest.readingUntil);
   const quietReady=!stationary||(gestureReady({state,actor:actorRect(state,metrics),viewport:world.viewport,escaping:route?.escape})&&!world.protectedRects.some(r=>overlap(neutral,r)));
   // A real nap needs a safe lying surface, not a pose over protected text.
   // When not reading, a sleep intention walks to an existing safe staging spot
   // before the 3D body lies down. During active reading it stays in place only
   // if the full neutral actor is clear of protected content.
   const napping=decision.gesture==='sleep';
   const safeSpot=!napping||stationary||Boolean(planGestureStage({position:state,metrics,
    viewport:world.viewport,surfaces:world.surfaces,protectedRects:world.protectedRects}));
   if(quietReady&&safeSpot)accepted=queueIntent({name:decision.gesture==='none'?null:decision.gesture,
    affect:decision.affect,quiet:stationary,source:'life',expression:decision.expression,
    autonomyId:decision.id,queuedAt:state.clock});
  }
  autonomy.resolve(decision.id,{accepted,nowMs:now});
  if(accepted){const target=targets.find(value=>value.id===decision.targetId);autoExecution={decision,kind,started:now,sceneId:kind==='scene'?scenes.snapshot().id:null,gameId:kind==='game'?game.id:null,visible:false,characterVisit:character.snapshot().visitId,characterComponent:target?.stableId||(decision.characterGoal?characterGoal?.restingPlace:null)||null,characterPublicComponent:getContextComponent(target?.stableId)?.id||null};nextChoice=Infinity;noteAutonomy('accepted',decision,now,decision.reason);}
  else noteAutonomy('failed',decision,now,'unavailable-action');
 }
 function clearScene(reason='interrupted'){
  const before=scenes.snapshot(),ownsGesture=state.gesture?.sceneId===before.id||state.expressionHold?.sceneId===before.id,ownsStage=route?.gestureStage&&(pendingGesture?.sceneId===before.id||ownsGesture);scenes.cancel(reason);
  if(route?.sceneCommandId||ownsStage)route=null;
  if(before.status==='playing'){nextChoice=performance.now()+800;nextSceneAt=performance.now()+17000;}
  if(ownsGesture){state.emotionUntil=performance.now()+600;state.emotion='neutral';}
  if(pendingGesture?.sceneId===before.id)pendingGesture=null;
  if(state.gesture?.sceneId===before.id)state.gesture=null;
  if(state.expressionHold?.sceneId===before.id)state.expressionHold=null;
  if(sceneMeta?.decision)directorLastExecution={...sceneMeta.decision,at:state.clock,status:'cancelled'};
  sceneMeta=null;sceneCommand=null;directorActivity=null;state.affect=null;
 }
 function stopPlay(reason='stopped'){
  if(!game)return;const ended=game;if(game.autonomous)lastAutonomousGame={id:game.id,reason};game=null;playDock.hidden=playLight.hidden=playBall.hidden=true;
  if(pendingGesture?.gameId===ended.id)pendingGesture=null;
  if(state.gesture?.gameId===ended.id){state.gesture=null;state.emotion='neutral';state.emotionUntil=performance.now()+600;}
  clearScene(reason);if(route?.gameId===ended.id){route=null;nextChoice=performance.now()+800;}
 }
 function beginCharacterScene({source='visitor',decision=null,targetId=null,action=null,gesture='curious',expression='curious',autonomyId=null,affect=null}={}){
  if(source==='visitor')cancelAutonomy('visitor-scene');
  if(!avatar||!active||reducedMotion||frozen||state.gesture||state.expressionHold)return false;
  const now=performance.now(),world=worldSnapshot(),records=publicComponents(world);
  if(source==='visitor'||source==='game'){interest.readingUntil=now;interest.scrollUntil=now;}
  if(source==='life'&&(companion?.isOpen()||Object.values(directorBlocked(now)).some(Boolean)))return false;
  let selected=targetId?records.find(r=>r.id===targetId):(['life','game'].includes(source)&&now>interest.userAttentionUntil?null:records.find(r=>r.id===interest.attentionId));
  if(targetId&&!selected)return false;
  if(action==='rest'&&targetId===null)selected=null;
  if(!selected&&action!=='rest')selected=[...records].sort((a,b)=>memory.score(publicComponent(world.surfaces.find(r=>r.id===b.id))?.id||b.id)-memory.score(publicComponent(world.surfaces.find(r=>r.id===a.id))?.id||a.id))[0];
  if(!selected&&action!=='rest')return false;
  const surface=selected&&world.surfaces.find(r=>r.id===selected.id),actions=surface?['inspect',...['peek','perch','orbit'].filter(kind=>directorPlan(world,surface,kind))]:['rest'];
  action=action||(['peek','perch','orbit'].find(kind=>actions.includes(kind))||'inspect');
  const plan=createScenePlan({targetId:action==='rest'&&!surface?null:surface?.id||null,action,gesture,expression,source,actions:(autonomyId||decision)?actions.filter(kind=>kind===action||kind==='inspect'):actions});
  if(!plan)return false;
  if(scenes.snapshot().status==='playing')clearScene('replaced');
  if(!scenes.start(plan,{nowMs:now}))return false;
  route=null;pendingGesture=null;nextChoice=Infinity;sceneCommand=null;completedSceneRoute=completedSceneGesture=null;
  sceneMeta={decision,action,autonomyId,affect,stableId:publicComponent(surface)?.id||null};interest.attentionId=surface?.id||null;
  if(decision){directorActivity={...decision,sceneId:scenes.snapshot().id,started:now};directorLastExecution={...decision,at:state.clock,status:'sequencing'};}
  return true;
 }
 function beginLightGoal(now,world){
  const target=chooseCorridorTarget({viewport:world.viewport,metrics,position:state,protectedRects:world.protectedRects,surfaces:world.surfaces,depth:1,recent:recentCorridors});
  if(!target){stopPlay('no-safe-space');return false;}
  const bounded=clampActor(target,world.viewport);recentCorridors.push(bounded);if(recentCorridors.length>6)recentCorridors.shift();
  const f=metrics.footprint;game.goal=bounded;playLight.style.transform='translate3d('+(bounded.x+(f.left+f.right)/2)+'px,'+(bounded.y+(f.top+f.bottom)/2)+'px,0)';
  const gate=(state.depthTarget<0||state.depth<.95)?planGestureStage({position:state,metrics,viewport:world.viewport,surfaces:world.surfaces,protectedRects:world.protectedRects}):{escape:false,reentry:false,egress:null};
  if(!gate){stopPlay('no-safe-space');return false;}
  playLight.hidden=false;route={free:true,gameId:game.id,escape:gate.escape,egress:gate.egress,reentry:gate.reentry,start:{x:state.x,y:state.y},target:bounded,elapsed:0,duration:2200};state.mode='float';nextChoice=Infinity;
  playNote.textContent='Follow the light: '+game.score+' / 3. M follows a safe path.';return true;
 }
 function startPlay(name,{autonomous=false,decision=null}={}){
  if(!autonomous)cancelAutonomy('visitor-play');
  if(!['hide','light','ball'].includes(name)||!avatar||!active||reducedMotion||frozen||state.gesture||state.expressionHold)return false;
  stopPlay('replaced');clearScene('play-started');
  if(name==='hide'&&!beginCharacterScene({source:autonomous?'life':'game',targetId:decision?.targetId||null,action:'peek',gesture:autonomous?'playful':'wink',expression:'happy',autonomyId:decision?.id||null,affect:autonomous?'mischief':null}))return false;
  game={id:++gameSerial,name,autonomous,autonomyId:decision?.id||null,score:0,started:performance.now(),found:false,searchUntil:0};
  playNext.disabled=name!=='light';playNext.textContent=name==='hide'?'I found M':name==='ball'?'Watch M play':'Move light';playNote.textContent=name==='hide'?'M is finding a card edge. Watch where she goes.':name==='ball'?'M is batting her floating ball.':'Follow the light.';playDock.hidden=autonomous;
  if(name==='light'&&!beginLightGoal(performance.now(),worldSnapshot()))return false;
  if(name==='ball'){
   if(!autonomous){interest.readingUntil=performance.now();interest.scrollUntil=performance.now();}
   game.side=life.random()<.5?-1:1;game.rallyStarted=false;game.contacted=false;
   if(!queueBallPaw()){stopPlay('ball-unavailable');return false;}
  }
  return true;
 }
 function queueBallPaw(){
  if(game?.name!=='ball')return false;
  const continuing=game.rallyStarted&&game.contacted;
  if(continuing){
   const world=worldSnapshot(),neutral=actorRect(state,{...metrics,footprint:metrics.neutralFootprint||metrics.footprint});
   if(!gestureReady({state,actor:actorRect(state,metrics),viewport:world.viewport,escaping:route?.escape})||world.protectedRects.some(r=>overlap(neutral,r)))return false;
  }
  game.rallyStarted=false;game.contacted=false;game.flight=null;game.heldPoint=game.ballPoint||null;
  return queueIntent({name:'paw',source:game.autonomous?'life':'game',reuseStage:continuing,side:game.side,gameId:game.id,expression:'happy',autonomyId:game.autonomyId,queuedAt:state.clock});
 }
 function renderBall(world,actor){
  playBall.hidden=true;
  if(game?.name!=='ball'||state.depth<.95||reducedMotion)return;
  const playing=state.gesture?.gameId===game.id;
  if(!playing&&pendingGesture?.gameId!==game.id)return;
  let ball=game.ballPoint?{...game.ballPoint,rotation:0}:null;
  if(playing){
   const paw=avatar.getInteractionPoint(game.side>0?'Hand.L':'Hand.R');if(!paw){stopPlay('paw-unavailable');return;}
   const origin={x:actor.left+paw.x,y:actor.top+paw.y},progress=state.gesture.age/GESTURE_DURATIONS.paw;
   const t=bound(progress/PAW_CONTACT_PROGRESS,0,1),blend=t*t*(3-2*t),held=game.heldPoint||origin;
   ball={x:held.x+(origin.x-held.x)*blend,y:held.y+(origin.y-held.y)*blend,rotation:0};game.rallyStarted=true;
   if(progress>=PAW_CONTACT_PROGRESS){
    if(!game.contacted){
     const plan=planBallFlight({origin,viewport:world.viewport,protectedRects:world.protectedRects,side:-game.side});
     if(!plan){stopPlay('ball-court-unavailable');return;}
     game.flight=plan;game.contacted=true;game.score++;
     playNote.textContent='Floating ball: '+game.score+' / 3 gentle taps.';
    }
    ball=sampleBallFlight(game.flight,(progress-PAW_CONTACT_PROGRESS)/(1-PAW_CONTACT_PROGRESS));
   }
  }
  if(!ball)return;
  const radius=game.flight?.radius||8,bounds={left:ball.x-radius,top:ball.y-radius,right:ball.x+radius,bottom:ball.y+radius};
  if(bounds.left<0||bounds.right>world.viewport.width||bounds.top<world.viewport.headerBottom||bounds.bottom>world.viewport.height||world.protectedRects.some(r=>overlap(bounds,r,2))){stopPlay('ball-space-changed');return;}
  game.ballPoint={x:ball.x,y:ball.y};playBall.hidden=false;
  playBall.style.width=playBall.style.height=radius*2+'px';playBall.style.transform='translate3d('+(ball.x-radius)+'px,'+(ball.y-radius)+'px,0) rotate('+ball.rotation+'rad)';
 }
 playStop.addEventListener('click',()=>stopPlay());
 playNext.addEventListener('click',()=>{if(!game)return;if(game.name==='hide'){game.found=true;playNote.textContent='Found! M is coming back.';}else beginLightGoal(performance.now(),worldSnapshot());});
 function updateCharacter(dt,now,world){
  if(state.affect){state.affect.age+=dt;if(state.affect.age>=(AFFECT_DURATIONS[state.affect.name]||0))state.affect=null;}
  if(now-lastMemoryAt>=1000){
   const elapsed=lastMemoryAt?Math.min(2000,now-lastMemoryAt):1000;lastMemoryAt=now;
   for(const r of publicComponents(world)){const component=publicComponent(world.surfaces.find(s=>s.id===r.id));if(component)memory.noteExposure(component.id,{dwellMs:elapsed});}
   characterEnergy=memory.recordPace(scrollY-lastPaceScroll,elapsed);lastPaceScroll=scrollY;
  }
  const field=document.activeElement,assistantIdleFocus=scenes.snapshot().source==='assistant'&&field?.id==='m-companion-message'&&field.value==='';
  const typing=Boolean(field?.matches?.('input,textarea,select,[contenteditable="true"]'))&&!assistantIdleFocus;
  const interrupted=!active||reducedMotion||document.hidden||typing||now<interest.scrollUntil||((now<interest.readingUntil)&&!sceneMeta?.autonomyId&&!sceneMeta?.decision&&!game?.autonomous)||document.getSelection?.()?.isCollapsed===false;
  if(game&&(interrupted||now-game.started>90000)){stopPlay(interrupted?'visitor-interaction':'play-timeout');return;}
  if(game?.name==='ball'){
   if(state.gesture?.gameId===game.id)return;
   if(pendingGesture?.gameId===game.id)return;
   if(game.rallyStarted&&game.contacted){
    if(game.score>=3){stopPlay('complete');setCharacterAffect('proud',{weight:1});}
    else if(!queueBallPaw())stopPlay('ball-interrupted');
   }else if(now-game.started>15000)stopPlay('ball-unavailable');
   return;
  }
  if(game?.name==='light'){
   if(game.autonomous&&!game.anticipated&&state.depth>.95){game.anticipated=true;setCharacterAffect('anticipation',{owner:game.autonomyId});}
   if(route?.gameId!==game.id){stopPlay('route-cancelled');return;}
   if(route.elapsed>=route.duration&&Math.hypot(state.x-game.goal.x,state.y-game.goal.y)<7){
    game.score++;if(game.autonomous)setCharacterAffect('delight',{owner:game.autonomyId});if(game.score>=3){const autonomous=game.autonomous;stopPlay('complete');if(!autonomous)queueGesture('wink',{source:'visitor',expression:'happy'});}else beginLightGoal(now,world);
   }
   return;
  }
  let current=scenes.snapshot();
  if(current.status==='playing'){
   const available=current.targetId===null||world.surfaces.some(r=>r.id===current.targetId&&onScreen(r,world.viewport));
   if(interrupted||(companion?.isOpen()&&['life','director'].includes(current.source))){clearScene('visitor-interaction');if(game)stopPlay('visitor-interaction');return;}
   current=scenes.step({nowMs:now,targetAvailable:available});
   const command=current.command;
   if(command&&command.id!==sceneCommand){
    sceneCommand=command.id;interest.attentionId=command.targetId;
    if(sceneMeta?.autonomyId||sceneMeta?.decision){if(command.type==='look')setCharacterAffect('anticipation',{weight:.8,owner:current.id});else if(command.type==='rest')setCharacterAffect('content',{weight:.85,owner:current.id});}
    else state.affect={name:command.type==='look'?'focus':command.type==='rest'?'content':'delight',age:0,weight:.75};
    if(command.type==='travel'){
     const surface=world.surfaces.find(r=>r.id===command.targetId),selected=surface&&directorPlan(world,surface,command.action);
     if(!selected)scenes.complete(command.id,{success:false,reason:'no-safe-route'},now);
     else{const {plan,side}=selected;route={plan,side,sceneCommandId:command.id,elapsed:0,element:surface.element,version:world.version,documentRect:{left:surface.left+scrollX,top:surface.top+scrollY,width:surface.width,height:surface.height}};state.mode=plan.kind;state.targetId=surface.id;nextChoice=Infinity;}
    }else if(command.type==='gesture'){
     if(!queueIntent({name:command.gesture,expression:command.expression,source:current.source,sceneId:current.id,sceneCommandId:command.id,autonomyId:sceneMeta?.autonomyId,affect:(sceneMeta?.autonomyId||sceneMeta?.decision)?sceneMeta.affect||(command.expression==='happy'?'delight':'focus'):null,queuedAt:state.clock}))scenes.complete(command.id,{success:false,reason:'gesture-unavailable'},now);
    }
   }
   if(command?.type==='travel'){
    if(completedSceneRoute===command.id){completedSceneRoute=null;scenes.complete(command.id,{},now);}
    else if(sceneCommand===command.id&&!route)scenes.complete(command.id,{success:false,reason:'route-cancelled'},now);
   }
   if(command?.type==='gesture'&&completedSceneGesture===command.id){completedSceneGesture=null;scenes.complete(command.id,{},now);}
   current=scenes.snapshot();
   if(current.status!=='playing'){
    if(current.status==='complete'){
     if(sceneMeta?.stableId)memory.noteVisit(sceneMeta.stableId,{action:sceneMeta.action||'inspect'});
    }else{if(sceneMeta?.decision)directorLastExecution={...sceneMeta.decision,at:state.clock,status:'cancelled'};clearScene(current.reason||'execution-failed');}
    if(route?.sceneCommandId)route=null;sceneMeta=null;sceneCommand=null;nextChoice=now+1400;nextSceneAt=now+17000;releaseCharacterAffect();
    if(game)stopPlay(current.status);
   }
  }
 }
 function currentSection(world){
  const ranked=world.surfaces.map(r=>({r,area:Math.max(0,Math.min(r.right,world.viewport.width)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,world.viewport.height)-Math.max(r.top,world.viewport.headerBottom))})).sort((a,b)=>b.area-a.area);
  return ranked[0]?.r.element.closest('section[id]')?.id||'home';
 }
 function queueIntent(incoming){
  if(!incoming.sceneId&&(incoming.source==='visitor'||incoming.source==='assistant')){cancelAutonomy('visitor-action');stopPlay('visitor-action');clearScene('visitor-action');}
  if(!active||reducedMotion||(avatar&&!gestureViewportFits(metrics,viewport())))return false;
  if(incoming.source==='visitor'||incoming.source==='assistant'){if(directorActivity)directorLastExecution={...directorActivity,at:state.clock,status:'cancelled'};directorActivity=null;director?.update({snapshot:directorSnapshot,busy:true});}
  pendingGesture=selectGestureIntent(pendingGesture,incoming,state.gesture||state.expressionHold);
  if(pendingGesture!==incoming)return false;
  if(isExplicitGesture(incoming)||(incoming.autonomyId&&!incoming.quiet)){if(isExplicitGesture(incoming))life.manual();if(avatar&&!state.gesture&&!state.expressionHold&&!incoming.reuseStage)stageGesture(worldSnapshot());}
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
 function reactToTap(){
  if(!active||!avatar||reducedMotion)return false;
  life.signal('tap');
  const reaction=life.step(0,{mode:state.mode==='float'?'float':'swim',reducedMotion,manualFace:false}).action;
  if(!reaction)return false;
  const name=reaction.mood==='welcoming'?(life.random()<.35?'playful':'wave'):reaction.mode==='shy'?(life.random()<.4?'wink':'shy'):'surprised';
  return queueGesture(name,{source:'visitor',expression:reaction.expression});
 }
 function stageGesture(world){
  const plan=planGestureStage({position:state,metrics,viewport:world.viewport,surfaces:world.surfaces,protectedRects:world.protectedRects});
  if(!plan){pendingGesture=null;route=null;nextChoice=performance.now()+1200;return false;}
  route={free:true,gestureStage:true,autonomyId:pendingGesture?.autonomyId||null,gameId:pendingGesture?.gameId||null,...plan,reentry:plan.reentry,start:{x:state.x,y:state.y},elapsed:0,duration:1200,version:world.version,scrollX,scrollY};
  state.mode='float';state.phase='approach';state.targetId=null;return true;
 }
 function updateGesture(dt,world,now){
  let completed=false;
  if(state.gesture){state.gesture.age+=dt;if(state.gesture.age>=GESTURE_DURATIONS[state.gesture.name]){completedSceneGesture=state.gesture.sceneCommandId||null;state.gesture=null;completed=true;}}
  if(state.expressionHold){state.expressionHold.age+=dt;if(state.expressionHold.age>=(state.expressionHold.duration||2.2)){state.expressionHold=null;completed=true;}}
  if(completed){state.emotionUntil=now+600;if(!pendingGesture){route=null;nextChoice=now+1200;}}
  if(gestureIntentExpired(pendingGesture,state.clock))pendingGesture=null;
  const playing=Boolean(state.gesture||state.expressionHold);
  if((isExplicitGesture(pendingGesture)||(pendingGesture?.autonomyId&&!pendingGesture.quiet))&&!playing&&!pendingGesture?.reuseStage&&!route?.gestureStage)stageGesture(world);
  if(pendingGesture&&!playing&&gestureReady({state,actor:actorRect(state,metrics),viewport:world.viewport,escaping:route?.escape})){
   const intent=pendingGesture;pendingGesture=null;
   if(intent.directorDecision)rememberDirector(intent.directorDecision);
   if(intent.name)state.gesture={name:intent.name,source:intent.source,expression:intent.expression,age:0,autonomyId:intent.autonomyId,gameId:intent.gameId,sceneId:intent.sceneId,sceneCommandId:intent.sceneCommandId,side:intent.side===1||intent.side===-1?intent.side:life.random()<.5?-1:1};
   else{state.expressionHold={source:intent.source,autonomyId:intent.autonomyId,age:0,sceneId:intent.sceneId,duration:intent.affect?AFFECT_DURATIONS[intent.affect]:2.2};}
   if(intent.affect)setCharacterAffect(intent.affect,{weight:1,owner:intent.autonomyId||intent.sceneId||null});
   state.vx=state.vy=0;
   state.emotion=intent.expression||({wave:'happy',curious:'curious',surprised:'surprised',shy:'neutral',sleep:'neutral',think:'curious',hop:'happy',paw:'happy'}[intent.name]);
   state.emotionUntil=Infinity;
  }
 }
 function updateLife(dt,world,now){
  const input=document.activeElement,typing=Boolean(input?.matches?.('input,textarea,select,[contenteditable="true"]'));
  brainState=brain.observe({nowMs:now,section:currentSection(world),scrolling:now<interest.scrollUntil,reading:now<interest.readingUntil||document.getSelection()?.isCollapsed===false,engaged:Boolean(companion?.isOpen()||typing),reducedMotion,hidden:document.hidden,active});
  lastLife=life.step(dt,{mode:state.mode==='float'?'float':'swim',reducedMotion,manualFace:now<state.emotionUntil||(!brainState.spontaneousAllowed&&!life.pending)});
  // V16 retains gaze/blink; the autonomous utility owner now selects actions.
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
  const gaze=game?.name==='ball'&&game.ballPoint?{x:bound((game.ballPoint.x-state.x-metrics.size*.5)/90,-1,1),y:bound((state.y+metrics.size*.45-game.ballPoint.y)/90,-1,1)}:game?.name==='light'&&game.goal?{x:bound((game.goal.x-state.x)/260,-1,1),y:bound((state.y-game.goal.y)/220,-1,1)}:lastLife?.attention==='pointer'&&scenes.snapshot().status!=='playing'?lastLife.gaze:target?{x:bound((target.left+target.width*.5-(state.x+(f.left+f.right)/2))/260,-1,1),y:bound(((state.y+(f.top+f.bottom)*.4)-(target.top+Math.min(100,target.height*.3)))/220,-1,1)}:lastLife?.gaze||{x:0,y:0};
  if(frozen)avatar.render();
  else avatar.update(dt,{mode:state.mode,activity:state.mode==='perch'&&state.phase==='hold'?'perch':state.mode,emotion:reducedMotion?'neutral':state.emotion,vx:state.vx,vy:state.vy,clock:state.clock,gesture:state.gesture,affect:state.affect,characterEnergy:characterEnergy,reducedMotion,locomotion:{ax:state.ax,ay:state.ay,heading:state.heading,turn:state.turn,travel:state.travel,leanX:state.leanX,leanY:state.leanY},attention:gaze,nearCard:Boolean(target),depth:state.depth,
   // Use the existing planner's TRUE contact only. Card animations and
   // scroll anchoring remain owned by the spatial route, not by Three.js.
   surfaceContact:Boolean(route?.attached&&route?.plan?.kind==='perch'&&
    state.mode==='perch'&&state.phase==='hold'&&state.depthTarget>.95&&
    route.element?.isConnected),
   phase:state.phase,reading:Boolean(performance.now()<interest.readingUntil),
   lifeMoment:state.lifeMoment&&performance.now()-state.lifeMoment.at<state.lifeMoment.duration*1000?
    {name:state.lifeMoment.name,age:Math.max(0,(performance.now()-state.lifeMoment.at)/1000),duration:state.lifeMoment.duration}:null});
  renderBall(world,actor);
  layer.dataset.depth=state.depth<0?'behind':'front';layer.dataset.worldAction=state.mode;layer.dataset.phase=state.phase;
  layer.dataset.worldTarget=state.targetId||'corridor';layer.dataset.occluders=String(world.surfaces.filter(r=>overlap(bounds,r)).length);
  layer.dataset.lifeMood=lastLife?.mood||'resting';layer.dataset.gesture=state.gesture?.name||'none';
 }
 function tick(now){
  frameId=null;if(disposed||!active||!avatar||document.hidden||frozen)return;
  const started=performance.now(),dt=bound((now-(lastFrame||now))/1000,0,.05);lastFrame=now;
  metrics=avatar.getMetrics();state.clock+=dt;
  const world=worldSnapshot(now);updateLife(dt,world,now);updateCharacter(dt,now,world);updateDirector(now,world);updateAutonomy(now,world);
  if(reducedMotion){
   const preferred={x:world.viewport.width-metrics.footprint.right-12,y:world.viewport.height-metrics.footprint.bottom-66};
   Object.assign(state,initialPosition(world,preferred),{vx:0,vy:0,ax:0,ay:0,turn:0,travel:0,leanX:0,leanY:0,depth:1,depthTarget:1,mode:'rest',phase:'hold',emotion:'neutral',affect:null,targetId:null});
   interest.attentionId=null;
  }
  else{
   const point=advanceRoute(dt,now,world),dx=point.x-state.x,dy=point.y-state.y;
   const perchHold=state.mode==='perch'&&point.phase==='hold'&&!point.portalHold;
   const attached=perchHold&&(route?.attached||Math.hypot(point.x-state.x,point.y-state.y)<3);
   if(route)route.attached=Boolean(attached);
   const maxSpeed=(state.mode==='peek'?110:state.mode==='perch'?120:150)*(.84+.16*characterEnergy);
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
  active=Boolean(enabled);if(!active)cancelAutonomy('paused');layer.hidden=!active;
  toggle.textContent=active?(avatar?'M · Pause':'M · Loading'):'M · Resume';
  toggle.setAttribute('aria-label',active?'Pause M':'Resume M');toggle.setAttribute('aria-pressed',String(active));
  if(persist)try{localStorage.setItem('m-world-enabled',active?'yes':'no');}catch{}
  companion?.refreshMotionControl?.();
  if(!active){stopPlay('paused');clearScene('paused');}
  if(!active)director?.update({snapshot:directorSnapshot,hidden:true});
  if(!active){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;life.setEnabled(false);}
  else{life.setEnabled(!reducedMotion);lastFrame=0;if(!avatar)load();else if(frozen)renderCurrent(worldSnapshot());else schedule();}
 }
 async function load(){
  if(loading||avatar)return loading;
  loading=(async()=>{
   try{
    const {mountMWorld3D}=await import('./m-world-3d.mjs?v=55');
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
 window.addEventListener('resize',()=>{stopPlay('layout-change');clearScene('layout-change');invalidate();route=null;nextChoice=0;},{passive:true});
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
 document.addEventListener('pointerover',event=>{if(performance.now()<interest.hoverGuardUntil)return;if(!ownNode(event.target)&&event.target.closest?.('p,h1,h2,h3,li,.card-body'))interest.readingUntil=performance.now()+1800;},{passive:true});
 document.addEventListener('focusin',event=>{
  if(ownNode(event.target))return;
  const now=performance.now();interest.readingUntil=now+1400;
  const surface=cache.documents.find(r=>r.element.contains(event.target));
  if(surface){interest.attentionId=surface.id;interest.userAttentionUntil=now+5000;directorEvent='pointer-interest';directorNextRead=0;}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAutonomy('hidden');stopPlay('hidden');clearScene('hidden');}if(document.hidden)director?.update({snapshot:directorSnapshot,hidden:true});if(document.hidden){if(frameId!==null)cancelAnimationFrame(frameId);frameId=null;}else{lastFrame=0;schedule();}});
 function refreshMotionPreference(){
  reducedMotion=motionPreference.matches&&!motionOptIn;
  if(reducedMotion){stopPlay('reduced-motion');clearScene('reduced-motion');pendingGesture=null;state.gesture=null;state.expressionHold=null;state.emotionUntil=0;}
  life.setEnabled(active&&!reducedMotion);route=null;directorActivity=null;nextChoice=0;companion?.refreshMotionControl?.();director?.update({snapshot:directorSnapshot,reducedMotion,hidden:!active});invalidate();schedule();
 }
 function enableMotion(){
  motionOptIn=true;try{sessionStorage.setItem('m-world-motion-allowed','yes');}catch{}
  refreshMotionPreference();return true;
 }
 motionPreference.addEventListener('change',()=>{motionOptIn=false;try{sessionStorage.removeItem('m-world-motion-allowed');}catch{}refreshMotionPreference();});
 document.addEventListener('pointerover',event=>{
  if(ownNode(event.target)||!active||reducedMotion||performance.now()<interest.hoverGuardUntil)return;
  const surface=cache.documents.find(r=>r.element.contains(event.target));
  if(surface)interest.userAttentionUntil=performance.now()+6000;
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
  reactToTap();schedule();
 },{passive:true});
 function snapshot(){
  if(avatar)metrics=avatar.getMetrics();
  const world=worldSnapshot();
  return {ready:Boolean(avatar),active,error:layer.dataset.error||null,state:{...state,gesture:state.gesture?{...state.gesture}:null,expressionHold:state.expressionHold?{...state.expressionHold}:null},acting:{attached:Boolean(route?.attached),cardContact:Boolean(route?.attached&&route?.plan?.kind==='perch'&&state.depthTarget>.95),externalPortal:Boolean(route?.plan?.externalPortal)},brain:brain.snapshot(),companion:companion?.snapshot(),pendingGesture:pendingGesture?.name||null,pendingIntent:pendingGesture?{...pendingGesture}:null,preferences:{reducedMotion,systemReducedMotion:motionPreference.matches,motionOptIn},character:{scene:scenes.snapshot(),game:game?{...game}:null,memory:memory.snapshot(),autonomy:autonomyStatus(),story:character.snapshot(),growth:growth.snapshot(),world:worldKnowledge.snapshot(),worldStory:worldStories.snapshot()},staging:route?.gestureStage?{escape:route.escape,target:{...route.target},egress:{...route.egress}}:null,metrics,actor:actorRect(renderFrame?{x:renderFrame.actor.left,y:renderFrame.actor.top}:state,metrics),
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
   // Release queued autonomous gestures before an explicit diagnostic owns the route.
   cancelAutonomy('diagnostic-action');stopPlay('diagnostic-action');clearScene('diagnostic-action');
   if(!avatar)await load();if(!avatar)throw new Error('Original M is not ready');
   metrics=avatar.getMetrics();frozen=false;cache.dirty=true;cache.lastRead=0;const world=worldSnapshot(),element=document.querySelectorAll(selector)[index];
   if(!element)throw new Error('Unknown diagnostic component');
   startRoute(performance.now(),world,kind,element);if(route)route.explicit=true;lastFrame=0;setActive(true,false);schedule();
   return {...snapshot(),plan:{available:Boolean(route&&!route.free),kind:route?.plan?.kind||'float',requestedKind:kind,targetId:state.targetId}};
  },
  setDepth(value){
   if(!avatar||!frozen)throw new Error('Freeze a real pose with stepTo before setting diagnostic depth');
   metrics=avatar.getMetrics();state.depth=state.depthTarget=Number(value)<0?-1:1;renderCurrent(worldSnapshot(),0);return snapshot();
  },
  resume(){frozen=false;nextChoice=0;schedule();},
  playGesture:queueGesture,
  setActive,
  dispose(){disposed=true;if(frameId!==null)cancelAnimationFrame(frameId);resizeObserver.disconnect();mutationObserver.disconnect();for(const type of ['transitionrun','transitionend','transitioncancel'])document.removeEventListener(type,geometryTransition,true);stopPlay('disposed');clearScene('disposed');playDock.remove();playLight.remove();playBall.remove();director?.dispose();observer?.dispose();companion?.destroy();avatar?.dispose();layer.remove();toggle.remove();}
 };
 observer=createWorldObserver({getComponents:()=>directorComponents});
 director=createWorldDirector({getCharacterContext:()=>character.getContext(),endpoint:M_WORLD_CONFIG.directorEndpoint||'',onIntent:applyDirectorIntent,onStatus:()=>companion?.refresh()});
 companion=createMCompanion({getCharacterStatus:()=>character.snapshot(),onRememberCharacter:value=>{const accepted=character.setRemember(value);if(accepted){growth.setRemember(value);worldKnowledge.setRemember(value);worldStories.setRemember(value);}return accepted;},getWorldDiscovery:()=>worldKnowledge.snapshot().discovery,getWorldStory:()=>worldStories.snapshot(),getAutonomyStatus:autonomyStatus,onAffect:name=>M_AFFECTS.includes(name)&&queueIntent({name:null,affect:name,source:'visitor',expression:'neutral',queuedAt:state.clock}),onScene:()=>beginCharacterScene(),onGame:startPlay,onResetMemory:resetCharacterMemory,onContextResponse:(id,reply)=>{cancelAutonomy('assistant-response');const world=worldSnapshot(),target=world.surfaces.find(r=>publicComponent(r)?.id===id);if(target){stopPlay('context-response');return beginCharacterScene({source:'assistant',targetId:target.id,action:'inspect',gesture:reply.gesture==='none'?'nod':reply.gesture,expression:reply.expression});}return false;},getDirectorStatus:()=>director.getStatus(),onDirectorEnabled:enabled=>{director.setEnabled(enabled);if(!enabled)directorActivity=null;updateDirector(performance.now(),worldSnapshot(),true);},endpoint:M_WORLD_CONFIG.assistantEndpoint,onGesture:queueGesture,onExpression:queueExpression,getMotionStatus:()=>({active,reducedMotion}),onToggleMotion:()=>{if(layer.dataset.error&&!avatar){delete layer.dataset.error;active=true;layer.hidden=false;load();}else setActive(!active);return active;},onEnableMotion:enableMotion,getContext:activeChatContext,onSection:name=>{document.getElementById(name)?.scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});},onEngagement:open=>{if(!open)interest.hoverGuardUntil=performance.now()+250;invalidate();}});
 try{if(localStorage.getItem('m-world-enabled')==='no')active=false;}catch{}
 life.setEnabled(active&&!reducedMotion);setActive(active,false);
 // One bounded, public same-origin knowledge read per page load, never a
 // Wikipedia request per visitor. Ignore source outages and stay fully local.
 if(active)void worldKnowledge.load().then(()=>{worldStories.begin(worldKnowledge.snapshot());companion?.refresh();}).catch(()=>{});
})();
