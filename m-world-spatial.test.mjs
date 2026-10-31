import test from 'node:test';
import assert from 'node:assert/strict';
import {bound,center,intersectsViewport,visibleTargets,chooseTarget,
 placeAround,exclusionPolygon,cubic,interactiveTarget,insideMascot,cardPerformance,activeOccluder} from './m-world-spatial.mjs';

const rect={left:200,top:220,right:470,bottom:480,width:270,height:260};
test('visible card and viewport clipping reject offscreen geometry',()=>{
 assert.equal(intersectsViewport(rect,900,650),true);
 assert.equal(intersectsViewport({...rect,left:1000,right:1200},900,650),false);
 const element={getBoundingClientRect:()=>rect,closest:()=>null};
 const found=visibleTargets([element],900,650);
 assert.equal(found.length,1);
 assert.deepEqual(center(rect),{x:335,y:350});
});
test('M can peek from either side of a card without leaving viewport',()=>{
 const left=placeAround(rect,900,650,'peek',-1),right=placeAround(rect,900,650,'peek',1);
 assert.ok(left.x<rect.left);
 assert.ok(right.x>rect.right-100);
 for(const point of [left,right]){
  assert.ok(point.x>=0&&point.x<=780);
  assert.ok(point.y>=48&&point.y<=522);
 }
});
test('perch, orbit and glide positions are different and safe on mobile',()=>{
 for(const [w,h] of [[390,700],[820,600],[1400,900]]){
  for(const style of ['perch','orbit','glide']){
   const pos=placeAround(rect,w,h,style,1);
   assert.ok(pos.x>=0&&pos.x<=Math.max(3,w-123));
   assert.ok(pos.y>=48&&pos.y<=Math.max(48,h-128));
  }
 }
});
test('masked card occlusion uses a real evenodd cutout covering rect',()=>{
 const mask=exclusionPolygon(rect,900,650,1);
 assert.ok(mask.startsWith('polygon(evenodd,'));
 assert.ok(mask.includes('199px 219px'));
 assert.ok(mask.includes('471px 481px'));
 assert.equal(exclusionPolygon({...rect,width:1,right:201},900,650),'');
});
test('waypoint selection prefers visible candidates and stays deterministic',()=>{
 const a={el:{id:'a'},rect},b={el:{id:'b'},rect:{...rect,left:550,right:780}};
 const chosen=chooseTarget([a,b],{x:340,y:300},900,650,()=>0);
 assert.equal(chosen.el.id,'a');
 assert.equal(chooseTarget([],{x:0,y:0},900,650),null);
});
test('smooth cubic path keeps endpoints and curved midpoint',()=>{
 const a={x:0,y:0},b={x:150,y:0},c={x:150,y:200},d={x:300,y:200};
 assert.deepEqual(cubic(a,b,c,d,0),a);
 assert.deepEqual(cubic(a,b,c,d,1),d);
 const p=cubic(a,b,c,d,.5);
 assert.ok(p.x>0&&p.x<300&&p.y>0&&p.y<200);
});
test('click zones cannot intercept buttons and links',()=>{
 const target={closest:selector=>selector.includes('button')?{tagName:'BUTTON'}:null};
 assert.equal(interactiveTarget(target),true);
 assert.equal(interactiveTarget({closest:()=>null}),false);
 assert.equal(insideMascot(60,60,0,0),true);
 assert.equal(insideMascot(220,220,0,0),false);
});
test('helper safely clamps invalid inputs',()=>{
 assert.equal(bound(NaN,0,1),0);
 assert.equal(bound(2,0,1),1);
});

test('peeking begins mostly hidden then reveals M beyond a real card edge',()=>{
 const first=cardPerformance(rect,900,650,'peek',1,0);
 const middle=cardPerformance(rect,900,650,'peek',1,.55);
 const final=cardPerformance(rect,900,650,'peek',1,1);
 assert.equal(first.behind,true);
 assert.equal(final.behind,false);
 assert.ok(first.x<final.x-55,JSON.stringify({first,middle,final}));
 assert.ok(final.x>rect.right-35);
 assert.equal(activeOccluder(rect,{x:first.x,y:first.y,size:120},true),true);
 assert.equal(activeOccluder(rect,{x:first.x,y:first.y,size:120},false),false);
});
test('perch crosses the upper edge but never lands over card text',()=>{
 const early=cardPerformance(rect,900,650,'perch',-1,0);
 const late=cardPerformance(rect,900,650,'perch',-1,1);
 assert.ok(late.y<rect.top-65,JSON.stringify({early,late}));
 assert.equal(late.behind,false);
 assert.ok(Math.abs(early.x-late.x)>8);
});
test('orbit travels across the card rather than oscillating at one border',()=>{
 const start=cardPerformance(rect,900,650,'orbit',-1,0);
 const top=cardPerformance(rect,900,650,'orbit',-1,.58);
 const end=cardPerformance(rect,900,650,'orbit',-1,1);
 assert.ok(start.x<rect.left);
 assert.ok(top.x>rect.left+70&&top.x<rect.right-100);
 assert.ok(end.x>rect.right-100);
 assert.equal(start.behind,false);
 assert.equal(end.behind,true);
 assert.ok(top.y<rect.top-60);
});
test('all spatial choreography stays within mobile and desktop bounds',()=>{
 for(const [w,h] of [[390,700],[1280,820]]){
  for(const kind of ['peek','perch','orbit']){
   for(const side of [-1,1]){
    for(let i=0;i<=20;i++){
     const p=cardPerformance(rect,w,h,kind,side,i/20);
     assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
     assert.ok(p.x>=3&&p.x<=Math.max(3,w-123));
     assert.ok(p.y>=48&&p.y<=Math.max(48,h-128));
    }
   }
  }
 }
});



import {actorRect,planCardAction,sampleCardAction,resolveDepth,visibleAtPoint} from './m-world-spatial.mjs';

const realMetrics={size:272,footprint:{left:34,top:32,right:238,bottom:240,width:204,height:208},
 contact:{x:137,y:230}};
const realViewport={width:1400,height:1000,headerBottom:72};
const liveCard={id:'project',left:440,top:430,right:820,bottom:760,width:380,height:330,radius:22};
const midpointOf=(plan,predicate)=>{
 const segment=plan.segments.find(predicate);
 assert.ok(segment,'Expected a matching choreography phase');
 return sampleCardAction(plan,(segment.start+segment.end)/2/plan.duration);
};
const overlapsRect=(a,b)=>a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;

test('renderer footprint and feet are translated from the actual canvas, without the old 120px assumption',()=>{
 const a=actorRect({x:100,y:50},realMetrics);
 assert.deepEqual(a,{left:134,top:82,right:338,bottom:290,width:204,height:208,contact:{x:237,y:280}});
 assert.equal(a.width,realMetrics.footprint.width);
 assert.equal(a.height,realMetrics.footprint.height);
});

test('perching places the real support point on the card, clear of its paragraph',()=>{
 const paragraph={left:460,top:466,right:800,bottom:560,width:340,height:94};
 const plan=planCardAction({rect:liveCard,viewport:realViewport,metrics:realMetrics,kind:'perch',
  start:{x:40,y:100},surfaces:[liveCard],protectedRects:[paragraph]});
 assert.equal(plan.available,true);
 assert.equal(plan.kind,'perch');
 const pose=midpointOf(plan,s=>s.phase==='hold'&&!s.portalHold);
 const a=actorRect(pose,realMetrics);
 assert.ok(Math.abs(a.contact.y-(liveCard.top+1))<.001);
 assert.equal(overlapsRect(a,paragraph),false);
 assert.equal(pose.depth,1);
 assert.ok(plan.duration>=3500&&plan.duration<=8000);
});

test('portrait cards without side gutters get a top peek with an actually visible head region',()=>{
 const viewport={width:390,height:780,headerBottom:74};
 const metrics={size:232,footprint:{left:28,top:26,right:204,bottom:208},contact:{x:117,y:200}};
 const card={id:'mobile',left:22,top:340,right:368,bottom:750,width:346,height:410,radius:18};
 const plan=planCardAction({rect:card,viewport,metrics,kind:'peek',side:1,start:{x:60,y:90,depth:-1},surfaces:[card]});
 assert.equal(plan.available,true);
 assert.equal(plan.portal.side,'top');
 const pose=midpointOf(plan,s=>s.phase==='hold'&&!s.portalHold);
 const bounds=actorRect(pose,metrics);
 assert.equal(pose.depth,-1);
 assert.ok(bounds.top<card.top);
 assert.ok(bounds.bottom>card.top);
 assert.ok(plan.portal.visibleShare>=.18);
 assert.ok(bounds.left>=8&&bounds.right<=viewport.width-8);
 assert.ok(bounds.top>=viewport.headerBottom+8);
});

test('a behind peek remains behind while any real part still crosses the card portal',()=>{
 const portal={side:'left',rect:liveCard,surfaceId:'project'};
 const overlapping={left:350,top:470,right:500,bottom:670,width:150,height:200};
 let result=resolveDepth(overlapping,1,[liveCard],-1,portal);
 assert.equal(result.depth,-1);
 assert.equal(result.blocked,true);
 assert.equal(result.occluders[0].id,'project');
 const cleared={...overlapping,left:220,right:425,width:205};
 result=resolveDepth(cleared,1,[liveCard],-1,portal);
 assert.equal(result.depth,1);
 assert.equal(result.portalClear,true);
 assert.equal(result.blocked,false);
});

test('depth may not switch through a different overlapping foreground card',()=>{
 const portal={side:'left',rect:liveCard,surfaceId:'project'};
 const neighbour={id:'neighbour',left:120,top:450,right:360,bottom:740,width:240,height:290};
 const actor={left:180,top:470,right:340,bottom:670,width:160,height:200};
 const result=resolveDepth(actor,1,[liveCard,neighbour],-1,portal);
 assert.equal(result.depth,-1);
 assert.equal(result.blocked,true);
 assert.equal(result.reason,'card-overlap');
 assert.deepEqual(result.occluders.map(r=>r.id),['neighbour']);
});

test('a new behind phase waits for physical clearance, not choreography time',()=>{
 const actor={left:760,top:500,right:900,bottom:670,width:140,height:170};
 const result=resolveDepth(actor,-1,[liveCard],1,{side:'right',rect:liveCard,surfaceId:'project'});
 assert.equal(result.depth,1);
 assert.equal(result.blocked,true);
 const actualClear={...actor,left:835,right:975};
 assert.equal(resolveDepth(actualClear,-1,[liveCard],1,{side:'right',rect:liveCard,surfaceId:'project'}).depth,-1);
});

test('orbit crosses an open foreground corridor, holds outside the far side, then peeks behind',()=>{
 const plan=planCardAction({rect:liveCard,viewport:realViewport,metrics:realMetrics,kind:'orbit',
  side:-1,start:{x:40,y:100},surfaces:[liveCard]});
 assert.equal(plan.available,true);
 assert.equal(plan.kind,'orbit');
 const above=midpointOf(plan,s=>s.phase==='approach'&&Math.abs(s.p3.x-(liveCard.left+liveCard.width/2-136))<2);
 assert.equal(above.depth,1);
 assert.ok(actorRect(above,realMetrics).bottom<liveCard.top);
 const gate=plan.segments.find(s=>s.portalHold&&s.depth===-1);
 assert.ok(gate.end-gate.start>=450);
 const crossing=sampleCardAction(plan,(gate.start+gate.end)/2/plan.duration);
 const clearance=resolveDepth(actorRect(crossing,realMetrics),-1,[liveCard],1,crossing.portal);
 assert.equal(clearance.depth,-1);
 assert.equal(clearance.portalClear,true);
 const hidden=midpointOf(plan,s=>s.phase==='hold'&&!s.portalHold&&s.depth===-1);
 assert.equal(hidden.depth,-1);
 assert.equal(overlapsRect(actorRect(hidden,realMetrics),liveCard),true);
});

test('plans start at the actual position and first leave an unsafe card before changing depth',()=>{
 const actual={x:500,y:460,depth:-1};
 const protectedText={left:480,top:470,right:760,bottom:570,width:280,height:100};
 const plan=planCardAction({rect:liveCard,viewport:realViewport,metrics:realMetrics,kind:'perch',
  start:actual,surfaces:[liveCard],protectedRects:[protectedText]});
 assert.equal(plan.available,true);
 const first=sampleCardAction(plan,0);
 assert.equal(first.x,actual.x);assert.equal(first.y,actual.y);assert.equal(first.depth,-1);
 assert.equal(plan.segments[0].egress,true);
 const exit=plan.segments[0].p3;
 assert.equal(overlapsRect(actorRect(exit,realMetrics),liveCard),false);
 assert.equal(overlapsRect(actorRect(exit,realMetrics),protectedText),false);
 assert.equal(resolveDepth(actorRect(actual,realMetrics),1,[liveCard],-1,plan.portal).depth,-1);
});

test('hidden pixels never react to pointer input; protected text wins even in front/play',()=>{
 const actor={left:400,top:400,right:660,bottom:680,width:260,height:280};
 const card={id:'round',left:420,top:430,right:650,bottom:700,width:230,height:270,radius:36};
 const text={left:450,top:470,right:610,bottom:520,width:160,height:50};
 assert.equal(visibleAtPoint({x:480,y:490},actor,1,[card],[text]),false);
 assert.equal(visibleAtPoint({x:480,y:490},actor,-1,[card],[text]),false);
 assert.equal(visibleAtPoint({x:480,y:550},actor,-1,[card],[]),false);
 assert.equal(visibleAtPoint({x:480,y:550},actor,1,[card],[]),true);
 assert.equal(visibleAtPoint({x:421,y:431},actor,-1,[card],[]),true,'Rounded empty corner stays visible');
 assert.equal(visibleAtPoint({x:100,y:100},actor,1,[],[]),false);
});

test('overlapping foreground surfaces remain a union, with no even-odd reveal hole',()=>{
 const a={id:'a',left:200,top:200,right:420,bottom:480,width:220,height:280,radius:12};
 const b={id:'b',left:360,top:240,right:580,bottom:520,width:220,height:280,radius:12};
 const actor={left:250,top:250,right:520,bottom:500,width:270,height:250};
 const result=resolveDepth(actor,-1,[a,b],-1);
 assert.equal(result.occluders.length,2);
 assert.equal(visibleAtPoint({x:390,y:300},actor,-1,[a,b],[]),false);
});

test('replanning after reflow keeps the actual start and adopts the new card support height',()=>{
 const moved={...liveCard,top:500,bottom:830};
 const current={x:170,y:100,depth:1};
 const plan=planCardAction({rect:moved,viewport:realViewport,metrics:realMetrics,kind:'perch',start:current,surfaces:[moved]});
 assert.equal(plan.available,true);
 assert.deepEqual({x:sampleCardAction(plan,0).x,y:sampleCardAction(plan,0).y},{x:current.x,y:current.y});
 const hold=midpointOf(plan,s=>s.phase==='hold'&&!s.portalHold);
 assert.ok(Math.abs(actorRect(hold,realMetrics).contact.y-(moved.top+1))<.001);
});

test('plans are deterministic and all available sampled poses fit actual mobile/desktop footprints',()=>{
 for(const [viewport,metrics,card]of [
  [realViewport,realMetrics,liveCard],
  [{width:390,height:780,headerBottom:74},{size:232,footprint:{left:28,top:26,right:204,bottom:208},contact:{x:117,y:200}},
   {id:'mobile',left:22,top:340,right:368,bottom:750,width:346,height:410}]
 ]){
  for(const kind of ['peek','perch','orbit']){
   const args={rect:card,viewport,metrics,kind,start:{x:20,y:100,depth:-1},surfaces:[card]};
   const plan=planCardAction(args);
   assert.deepEqual(planCardAction(args),plan);
   if(!plan.available)continue;
   for(let i=0;i<=100;i++){
    const pose=sampleCardAction(plan,i/100),a=actorRect(pose,metrics);
    assert.ok(Number.isFinite(pose.x)&&Number.isFinite(pose.y));
    assert.ok(a.left>=7.999&&a.right<=viewport.width-7.999);
    assert.ok(a.top>=viewport.headerBottom+7.999&&a.bottom<=viewport.height-7.999);
   }
  }
 }
});

test('a completely obstructed portal is rejected instead of choosing an invisible peek',()=>{
 const viewport={width:390,height:780,headerBottom:74};
 const metrics={size:232,footprint:{left:28,top:26,right:204,bottom:208},contact:{x:117,y:200}};
 const card={id:'lower',left:22,top:340,right:368,bottom:750,width:346,height:410};
 const above={id:'upper',left:0,top:75,right:390,bottom:339,width:390,height:264};
 const plan=planCardAction({rect:card,viewport,metrics,kind:'peek',start:{x:60,y:90,depth:-1},surfaces:[card,above]});
 assert.equal(plan.available,false);
 assert.equal(plan.reason,'no-safe-portal');
});

test('editable text and keyboard controls are never mascot gestures',()=>{
 assert.equal(interactiveTarget({isContentEditable:true,closest:()=>null}),true);
 assert.equal(interactiveTarget({closest:selector=>selector.includes('[tabindex]')?{}:null}),true);
});

test('already-behind portrait peek does not wait for impossible full clearance',()=>{
 const viewport={width:390,height:780,headerBottom:74};
 const metrics={size:232,footprint:{left:28,top:26,right:204,bottom:208},contact:{x:117,y:200}};
 const card={id:'dense-mobile',left:22,top:170,right:368,bottom:750,width:346,height:580};
 const plan=planCardAction({rect:card,viewport,metrics,kind:'peek',start:{x:60,y:180,depth:-1},surfaces:[card]});
 assert.equal(plan.available,true);
 assert.equal(plan.portal.side,'top');
 assert.equal(plan.canExitFront,false);
 const entry=plan.segments.find(s=>s.phase==='hold'&&s.depth===-1);
 assert.ok(entry);
 assert.equal(entry.portalHold,false,'Already behind: entry is a dwell, not an impossible depth gate');
 const sample=sampleCardAction(plan,(entry.start+entry.end)/2/plan.duration);
 assert.equal(sample.depth,-1);
 assert.equal(sample.portalHold,false);
 assert.equal(overlapsRect(actorRect(sample,metrics),card),true);
 for(const segment of plan.segments.filter(s=>s.portalHold)){
  assert.equal(resolveDepth(actorRect(segment.p3,metrics),segment.depth,[card],-segment.depth,segment.portal).portalClear,true);
 }
});

const denseViewport={width:390,height:780,headerBottom:74};
const denseMetrics={size:232,footprint:{left:28,top:26,right:204,bottom:208},contact:{x:117,y:200}};
const denseCard={id:'external-mobile',left:22,top:170,right:368,bottom:750,width:346,height:580};

test('offscreen entry is explicit opt-in when a front actor has no in-view depth gate',()=>{
 const args={rect:denseCard,viewport:denseViewport,metrics:denseMetrics,kind:'peek',
  start:{x:60,y:180,depth:1},surfaces:[denseCard]};
 assert.equal(planCardAction(args).available,false);
 const plan=planCardAction({...args,allowExternalPortal:true});
 assert.equal(plan.available,true);
 assert.equal(plan.externalPortal,true);
 assert.equal(plan.kind,'peek');
 const first=sampleCardAction(plan,0);
 assert.equal(first.x,args.start.x);
 assert.equal(first.y,args.start.y);
 assert.equal(first.depth,1);
 assert.equal(first.allowViewportExit,true);
});

test('external depth gate waits outside every surface and cannot switch while the real actor still overlaps',()=>{
 const neighbours=[
  {id:'outside-left',left:-80,top:200,right:-10,bottom:600,width:70,height:400},
  {id:'outside-right',left:400,top:200,right:480,bottom:600,width:80,height:400}
 ];
 const surfaces=[denseCard,...neighbours],start={x:60,y:180,depth:1};
 const plan=planCardAction({rect:denseCard,viewport:denseViewport,metrics:denseMetrics,
  kind:'peek',start,surfaces,allowExternalPortal:true});
 assert.equal(plan.available,true);
 const segment=plan.segments.find(s=>s.portalHold&&s.allowViewportExit&&s.depth===-1);
 assert.ok(segment);
 assert.ok(segment.end-segment.start>=450);
 const gate=sampleCardAction(plan,(segment.start+segment.end)/2/plan.duration);
 const bounds=actorRect(gate,denseMetrics);
 assert.ok(bounds.right<0||bounds.left>denseViewport.width);
 assert.equal(surfaces.some(r=>overlapsRect(bounds,r)),false);
 const early=resolveDepth(actorRect(start,denseMetrics),gate.depth,surfaces,1,gate.portal);
 assert.equal(early.depth,1);
 assert.equal(early.blocked,true);
 const arrived=resolveDepth(bounds,gate.depth,surfaces,1,gate.portal);
 assert.equal(arrived.depth,-1);
 assert.equal(arrived.portalClear,true);
});

test('external reentry has its own arrival gate behind the card, not an impossible clearance gate',()=>{
 const plan=planCardAction({rect:denseCard,viewport:denseViewport,metrics:denseMetrics,
  kind:'peek',start:{x:60,y:180,depth:1},surfaces:[denseCard],allowExternalPortal:true});
 const arrival=plan.segments.find(s=>s.waitForArrival);
 assert.ok(arrival);
 const sample=sampleCardAction(plan,(arrival.start+arrival.end)/2/plan.duration);
 assert.equal(sample.allowViewportExit,true);
 assert.equal(sample.waitForArrival,true);
 assert.equal(sample.portalHold,false);
 assert.equal(sample.depth,-1);
 const bounds=actorRect(sample,denseMetrics);
 assert.ok(bounds.left>=8&&bounds.right<=denseViewport.width-8);
 assert.ok(bounds.top>=denseViewport.headerBottom+8&&bounds.bottom<=denseViewport.height-8);
 assert.equal(overlapsRect(bounds,denseCard),true);
 assert.equal(resolveDepth(bounds,-1,[denseCard],-1,sample.portal).portalClear,false);
 for(let i=0;i<=200;i++){
  const pose=sampleCardAction(plan,i/200);
  if(pose.allowViewportExit)continue;
  const actual=actorRect(pose,denseMetrics);
  assert.ok(actual.left>=7.999&&actual.right<=denseViewport.width-7.999);
  assert.ok(actual.top>=denseViewport.headerBottom+7.999&&actual.bottom<=denseViewport.height-7.999);
 }
});

test('replanning an actor already outside preserves its actual pose until explicit behind reentry',()=>{
 const start={x:-250,y:130,depth:-1};
 const card={...denseCard,top:340,height:410};
 const plan=planCardAction({rect:card,viewport:denseViewport,metrics:denseMetrics,
  kind:'perch',start,surfaces:[card],allowExternalPortal:true});
 assert.equal(plan.available,true);
 assert.equal(plan.externalPortal,true);
 const first=sampleCardAction(plan,0);
 assert.equal(first.x,start.x);
 assert.equal(first.y,start.y);
 assert.equal(first.depth,-1);
 assert.equal(first.allowViewportExit,true);
 assert.ok(plan.segments.some(s=>s.waitForArrival));
});

test('external corridors do not invent a reveal when every actual card edge is blocked',()=>{
 const card={...denseCard,top:340,height:410};
 const above={id:'blocking-card',left:0,top:75,right:390,bottom:339,width:390,height:264};
 const plan=planCardAction({rect:card,viewport:denseViewport,metrics:denseMetrics,
  kind:'peek',start:{x:60,y:180,depth:1},surfaces:[card,above],allowExternalPortal:true});
 assert.equal(plan.available,false);
 assert.equal(plan.reason,'no-safe-portal');
});


test('top peeks expose the neutral facial line instead of only the empty animation envelope',()=>{
 const metrics={size:208,footprint:{left:14,top:24,right:194,bottom:184},
  neutralFootprint:{left:43,top:81,right:133,bottom:155,width:90,height:74},contact:{x:76,y:155}};
 const card={id:'portrait',left:17,top:380,right:373,bottom:790,width:356,height:410,radius:20};
 const plan=planCardAction({rect:card,viewport:{width:390,height:844,headerBottom:54},
  metrics,kind:'peek',start:{x:80,y:90,depth:-1},surfaces:[card]});
 assert.equal(plan.available,true);assert.equal(plan.portal.side,'top');
 assert.ok(plan.segments.some(s=>s.phase==='hold'&&!s.portalHold&&s.waitForArrival));
 const pose=midpointOf(plan,s=>s.phase==='hold'&&!s.portalHold);
 const facialLine=pose.y+metrics.neutralFootprint.top+metrics.neutralFootprint.height*.4;
 assert.ok(facialLine<=card.top-4,'the eye/cheek line must emerge above the actual card');
 assert.ok(actorRect(pose,metrics).top>=62,'the global clearance envelope is still respected');
});
