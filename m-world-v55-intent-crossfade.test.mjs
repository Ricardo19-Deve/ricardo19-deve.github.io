import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createIntentCrossfade,scaleExpressivePose,scaleExpressiveStage
} from './m-world-intent-crossfade.mjs';

const play=(active=true)=>({
 active,pose:active?{Head:[-.13,.15,.075],'Tail.10':[.02,0,.09]}:{},
 stage:{rx:.015,ry:.017,rz:-.022,y:.007,scale:0},
 face:active?{weights:{happy:.7,curious:.08,surprised:0},eyelids:{left:.04,right:.04}}:null
});
const observe=(active=true)=>({
 active,pose:active?{Head:[-.018,-.032,.014],'Tail.10':[0,0,-.025]}:{},
 face:active?{weights:{happy:.05,curious:.18,surprised:.018},eyelids:{left:.02,right:.02}}:null
});
const sample=(x,overrides={})=>x.sample({dt:1/60,playState:play(false),
 ambientState:observe(true),...overrides});
const settle=(m,seconds,overrides={})=>{
 let output;
 for(let i=0;i<seconds*60;i++)output=sample(m,overrides);
 return output;
};
test('V55 transitions from observe to play continuously without an empty expression frame',()=>{
 const m=createIntentCrossfade();
 const quiet=settle(m,3);
 assert.equal(quiet.leader,'observe');
 assert.ok(quiet.ambientWeight>.99);
 assert.ok(quiet.face.weights.curious>.17);
 const first=sample(m,{playState:play(true),ambientState:observe(false)});
 assert.equal(first.leader,'play');
 assert.ok(first.playWeight>0&&first.playWeight<.10);
 assert.ok(first.ambientWeight>.9);
 assert.ok(first.face.weights.curious>.14,'last observing face is not thrown away');
 assert.ok(first.face.weights.happy>0);
 assert.ok(first.playPose.Head.some(x=>Math.abs(x)>0));
 assert.ok(first.playStage.y>0);
 const full=settle(m,3,{playState:play(true),ambientState:observe(false)});
 assert.ok(full.playWeight>.98);
 assert.ok(full.ambientWeight<.02);
 assert.ok(full.face.weights.happy>.65);
 assert.ok(full.face.weights.curious<.1);
 assert.ok(m.snapshot().handoffs>=1);
});
test('V55 play to attentive quiet retains the previous happy expression during the handoff',()=>{
 const m=createIntentCrossfade();
 settle(m,3,{playState:play(true),ambientState:observe(false)});
 const first=sample(m);
 assert.equal(first.leader,'observe');
 assert.ok(first.playWeight>.9);
 assert.ok(first.face.weights.happy>.58);
 assert.ok(first.ambientWeight>0);
 const final=settle(m,4);
 assert.equal(final.leader,'observe');
 assert.ok(final.playWeight<.01);
 assert.ok(final.ambientWeight>.99);
 assert.ok(final.face.weights.curious>.17);
});
test('V55 gestures, resting, stronger emotion and reduced motion always take priority',()=>{
 for(const priority of [{gestureActive:true},{resting:true},{priorityAffect:true}]){
  const m=createIntentCrossfade();
  settle(m,2,{playState:play(true),ambientState:observe(false)});
  const output=sample(m,{playState:play(true),ambientState:observe(true),...priority});
  assert.deepEqual(output.playPose,{});
  assert.deepEqual(output.ambientPose,{});
  assert.equal(output.face,null);
  assert.equal(output.leader,'priority');
 }
 const m=createIntentCrossfade();
 settle(m,2);
 const reduced=sample(m,{playState:play(true),reducedMotion:true});
 assert.deepEqual(reduced.playPose,{});
 assert.equal(reduced.face,null);
 assert.equal(m.snapshot().play,0);
 assert.equal(m.snapshot().ambient,0);
});
test('V55 old source pose never contributes after completion, V41 owns the final bone decay',()=>{
 const m=createIntentCrossfade();
 settle(m,3,{playState:play(true),ambientState:observe(false)});
 const stopped=sample(m,{playState:play(false),ambientState:observe(false)});
 assert.equal(stopped.leader,'quiet');
 assert.deepEqual(stopped.playPose,{});
 assert.deepEqual(stopped.ambientPose,{});
 assert.ok(stopped.face.weights.happy>.6,'facial crossfade has an old state while source bones fade through V41');
 const after=settle(m,5,{playState:play(false),ambientState:observe(false)});
 assert.equal(after.face,null);
 assert.ok(after.playWeight<.0001);
 assert.ok(after.ambientWeight<.0001);
});
test('V55 crossfade never exceeds one full authored pose or creates new bones',()=>{
 const m=createIntentCrossfade({halfLife:.5});
 let worst=0;
 for(let i=0;i<60*25;i++){
  const active=(Math.floor(i/21)%2)===0;
  const out=sample(m,{playState:play(active),ambientState:observe(!active)});
  const weight=out.playWeight+out.ambientWeight;
  worst=Math.max(worst,weight);
  assert.ok(weight<=1+1e-9);
  assert.ok(out.playWeight>=0&&out.ambientWeight>=0);
  assert.ok(Object.keys(out.playPose).every(name=>['Head','Tail.10'].includes(name)));
  assert.ok(Object.keys(out.ambientPose).every(name=>['Head','Tail.10'].includes(name)));
  assert.ok(Object.values(out.playStage).every(x=>Number.isFinite(x)&&Math.abs(x)<.15));
  if(out.face){
   assert.ok(Object.values(out.face.weights).every(x=>x>=0&&x<=1));
   assert.ok(Object.values(out.face.eyelids).every(x=>x>=0&&x<=.5));
  }
 }
 assert.ok(worst>.8);
 const angles=scaleExpressivePose({Head:[1,-1,.5],Garbage:[NaN,0,0]},.25);
 assert.deepEqual(angles.Head,[.25,-.25,.125]);
 assert.ok(Object.keys(scaleExpressiveStage({rx:2,y:-2},0)).length===5);
});
test('V55 30/60/120Hz blending is numerically stable and does not snap on a reversal',()=>{
 const output=[];
 for(const fps of [30,60,120]){
  const m=createIntentCrossfade();
  for(let i=0;i<fps;i++)m.sample({dt:1/fps,ambientState:observe(true)});
  let first=m.sample({dt:1/fps,playState:play(true),ambientState:observe(false)});
  assert.ok(first.ambientWeight>.7);
  for(let i=1;i<fps*2;i++)first=m.sample({dt:1/fps,playState:play(true),ambientState:observe(false)});
  output.push(first);
 }
 for(let i=1;i<output.length;i++){
  assert.ok(Math.abs(output[i].playWeight-output[0].playWeight)<.002);
  assert.ok(Math.abs(output[i].face.weights.happy-output[0].face.weights.happy)<.002);
 }
});
test('V55 renderer connects one mood bridge to existing V41 and V28 with original WebGL rig',()=>{
 const render=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('m-world-intent-crossfade.mjs',import.meta.url),'utf8');
 assert.match(render,/createIntentCrossfade/);
 assert.match(render,/intentCrossfade\.sample\(\{dt,playState:lastPlay,ambientState:lastAmbient/);
 assert.match(render,/lastPlay=\{\.\.\.lastPlay,pose:lastTransition\.playPose,stage:lastTransition\.playStage\}/);
 assert.match(render,/lastAmbient=\{\.\.\.lastAmbient,pose:lastTransition\.ambientPose\}/);
 assert.match(render,/secondaryTargets\[5\]\.pose=lastPlay\.pose;secondaryTargets\[6\]\.pose=lastAmbient\.pose/);
 assert.match(render,/secondaryPose\.sample\(\{dt,layers:secondaryTargets,reducedMotion:reduced\}\)/);
 assert.match(render,/secondaryLayer\.apply\(combinedSecondary\)/);
 assert.doesNotMatch(render,/playLayer|ambientLayer|handoffs\.(?:play|ambient)/);
 assert.match(render,/microFace=[^;]+lastTransition\.face:null/);
 assert.match(render,/faceTarget=facialTargetMixer\.sample\(\{performance:physical,microFace,affect:lastAffect/);
 assert.match(render,/facialContinuity\.sample\(\{dt,weights:faceTarget\?\.weights,eyelids:faceTarget\?\.eyelids/);
 assert.match(render,/intentCrossfade:intentCrossfade\.snapshot/);
 assert.doesNotMatch(bridge,/\bfetch\s*\(|window\.|document\.|localStorage|sessionStorage|LINKEDIN|OPENAI_/iu);
});
