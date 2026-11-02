import test from 'node:test';
import assert from 'node:assert/strict';
import {selectGestureIntent,isExplicitGesture,gestureIntentExpired,gestureReady,planGestureStage,gestureViewportFits} from './m-world-action-policy.mjs';
const intent=(source,name='wave')=>({source,name,queuedAt:0});
test('life cannot replace queued or playing visitor and assistant intent',()=>{
 for(const source of ['visitor','assistant']){
  const explicit=intent(source),life=intent('life','shy');
  assert.equal(selectGestureIntent(explicit,life),explicit);
  assert.equal(selectGestureIntent(null,life,explicit),null);
  assert.equal(selectGestureIntent(life,explicit),explicit);
 }
});
test('the latest explicit choice is retained while an earlier gesture finishes',()=>{
 const first=intent('assistant'),last=intent('visitor','curious');
 assert.equal(selectGestureIntent(first,last,first),last);
 assert.equal(selectGestureIntent(last,intent('life')),last);
});
test('explicit intent survives long safe recovery; stale autonomous intent expires',()=>{
 assert.equal(gestureIntentExpired(intent('visitor'),100),false);
 assert.equal(gestureIntentExpired(intent('assistant'),100),false);
 assert.equal(gestureIntentExpired(intent('life'),31),true);
 assert.equal(isExplicitGesture(null),false);
});
const metrics={footprint:{left:0,right:100,top:0,bottom:100,width:100,height:100}},viewport={width:800,height:600,headerBottom:60};
const surface={left:200,right:700,top:250,bottom:550};
const overlap=(p,r)=>p.x<r.right+1&&p.x+100>r.left-1&&p.y<r.bottom+1&&p.y+100>r.top-1;
test('behind-card staging selects nearby real clearance, without moving or flipping the actor',()=>{
 const position={x:320,y:260,depth:-1,depthTarget:-1},before={...position};
 const plan=planGestureStage({position,metrics,viewport,surfaces:[surface],protectedRects:[surface]});
 assert.deepEqual(position,before);assert.equal(plan.escape,true);
 assert.equal(overlap(plan.egress,surface),false);
 assert.equal(overlap(plan.target,surface),false);
 assert.ok(Math.hypot(plan.egress.x-position.x,plan.egress.y-position.y)<230);
});
test('a crowded viewport uses a safe external gate and keeps the acting target inside',()=>{
 const full={left:0,right:800,top:0,bottom:600};
 const plan=planGestureStage({position:{x:300,y:260,depth:-1,depthTarget:-1},metrics,viewport,surfaces:[full],protectedRects:[]});
 assert.equal(overlap(plan.egress,full),false);assert.equal(plan.escape,true);
 assert.ok(plan.target.x>=8&&plan.target.x+100<=792&&plan.target.y>=68&&plan.target.y+100<=592);
});
test('front staging stays in front and avoids a newly opened chat panel',()=>{
 const panel={left:400,right:800,top:100,bottom:600};
 const plan=planGestureStage({position:{x:600,y:250,depth:1,depthTarget:1},metrics,viewport,protectedRects:[panel]});
 assert.equal(plan.escape,false);assert.equal(overlap(plan.target,panel),false);
});
test('gestures start only after a visible settled front hold',()=>{
 const state={phase:'hold',depth:1,vx:0,vy:0},actor={left:10,right:110,top:100,bottom:200};
 assert.equal(gestureReady({state,actor,viewport}),true);
 for(const patch of [{phase:'recovery'},{depth:-1},{vx:4}])assert.equal(gestureReady({state:{...state,...patch},actor,viewport}),false);
 assert.equal(gestureReady({state,actor:{...actor,left:-1},viewport}),false);
 assert.equal(gestureReady({state,actor,viewport,escaping:true}),false);
});
test('a depth gate clears the controller six-pixel escape margin',()=>{
 const r={left:200,right:700,top:250,bottom:550};
 const plan=planGestureStage({position:{x:320,y:260,depth:-1,depthTarget:-1},metrics,viewport,surfaces:[r]});
 const a={left:plan.egress.x,right:plan.egress.x+100,top:plan.egress.y,bottom:plan.egress.y+100};
 assert.equal(a.left<r.right+6&&a.right>r.left-6&&a.top<r.bottom+6&&a.bottom>r.top-6,false);
});
test('expression-only assistant intent retains explicit priority without inventing a gesture',()=>{
 const face={name:null,source:'assistant',expression:'happy',queuedAt:0};
 assert.equal(selectGestureIntent(face,intent('life')),face);
 assert.equal(gestureIntentExpired(face,120),false);
 assert.equal(face.name,null);
});
test('an offscreen front actor retains a physical reentry corridor without an unnecessary depth escape',()=>{
 const position={x:780,y:200,depth:1,depthTarget:1};
 const plan=planGestureStage({position,metrics,viewport,surfaces:[]});
 assert.equal(plan.escape,false);assert.equal(plan.reentry,true);
 assert.deepEqual(position,{x:780,y:200,depth:1,depthTarget:1});
 assert.ok(plan.target.x+100<=792);
 const inside=planGestureStage({position:{...position,x:300},metrics,viewport,surfaces:[]});
 assert.equal(inside.reentry,false);
});
test('short viewports prefer the header only within the controller reachable bounds',()=>{
 const short={width:390,height:250,headerBottom:104},m={footprint:{left:15,right:194,top:29,bottom:179,width:179,height:150}};
 const plan=planGestureStage({position:{x:188,y:63,depth:1,depthTarget:1},metrics:m,viewport:short,protectedRects:[{left:0,right:390,top:0,bottom:104}]});
 assert.ok(plan);assert.ok(plan.target.y>=8-m.footprint.top&&plan.target.y<=short.height-m.footprint.bottom-8);
 assert.ok(plan.target.y+m.footprint.bottom<=242);
 assert.equal(plan.target.y,63);
});
test('physically impossible viewports are rejected instead of accepting an unreachable gesture',()=>{
 assert.equal(gestureViewportFits(metrics,{width:115,height:600}),false);
 assert.equal(gestureViewportFits(metrics,{width:800,height:115}),false);
 assert.equal(planGestureStage({position:{x:0,y:0,depth:1},metrics,viewport:{width:115,height:115,headerBottom:60}}),null);
 assert.equal(gestureViewportFits(metrics,{width:116,height:116}),true);
});
test('mobile long chat keeps the neutral body clear between the header and panel',()=>{
 const mobile={width:390,height:844,headerBottom:104};
 const m={footprint:{left:14.56,right:193.44,top:29.004,bottom:179.012,width:178.88,height:150.008},neutralFootprint:{left:57.3,right:138.2,top:79,bottom:146,width:80.9,height:67}};
 const header={left:0,top:0,right:390,bottom:104},panel={left:16,top:206.7,right:374,bottom:730};
 const plan=planGestureStage({position:{x:185.4,y:84.5,depth:1,depthTarget:1},metrics:m,viewport:mobile,protectedRects:[header,panel]});
 const body={left:plan.target.x+m.neutralFootprint.left,right:plan.target.x+m.neutralFootprint.right,top:plan.target.y+m.neutralFootprint.top,bottom:plan.target.y+m.neutralFootprint.bottom};
 const coverage=r=>Math.max(0,Math.min(body.right,r.right)-Math.max(body.left,r.left))*Math.max(0,Math.min(body.bottom,r.bottom)-Math.max(body.top,r.top));
 assert.equal(coverage(header),0);assert.equal(coverage(panel),0);
 assert.ok(body.top>=104&&body.bottom<=206.7);
 assert.ok(plan.target.y+m.footprint.top>=8&&plan.target.y+m.footprint.bottom<=836);
 assert.ok(plan.target.x+m.footprint.left>=8&&plan.target.x+m.footprint.right<=382);
 assert.ok(Math.hypot(plan.target.x-185.4,plan.target.y-84.5)<80);
 assert.ok(plan.target.y<104+8-m.footprint.top,'the envelope may overlap the header while the body stays clear');
});

test('automatic director suggestions cannot replace queued or playing human intent',()=>{
 const ai=intent('director','playful'),visitor=intent('visitor','wave'),assistant=intent('assistant','curious');
 for(const human of [visitor,assistant]){
  assert.equal(selectGestureIntent(human,ai),human);
  assert.equal(selectGestureIntent(null,ai,human),null);
  assert.equal(selectGestureIntent(ai,human),human);
 }
 assert.equal(selectGestureIntent(ai,intent('life','shy')),ai);
 assert.equal(selectGestureIntent(null,ai),ai);
});
