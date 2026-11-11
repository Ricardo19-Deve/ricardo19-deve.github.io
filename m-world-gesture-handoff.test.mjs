import test from 'node:test';
import assert from 'node:assert/strict';
import {M_GESTURES,GESTURE_DURATIONS,sampleGesture} from './m-world-acting.mjs';
import {createGestureHandoff} from './m-world-gesture-handoff.mjs';

const close=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const named=['Head','Forearm.L','Forearm.R','Leg.L','Leg.R'];
function warm(model,name='sleep',progress=.5,rate=60,side=1){
 const end=GESTURE_DURATIONS[name]*progress;let frame;
 for(let i=0;i<=Math.floor(end*rate);i++){
  frame=sampleGesture({name,age:i/rate,side});model.sample({frame,dt:i?1/rate:0,side});
 }
 const extra=end-frame.progress*frame.duration;
 if(extra>1e-10){frame=sampleGesture({name,age:end,side});model.sample({frame,dt:extra,side});}
 return frame;
}
function assertBounded(visual){
 for(const value of Object.values(visual.pose))assert.ok(value.every(angle=>Number.isFinite(angle)&&Math.abs(angle)<=.9));
 if(visual.blink)for(const side of ['left','right'])assert.ok(Number.isFinite(visual.blink[side])&&visual.blink[side]>=0&&visual.blink[side]<=1);
 assert.ok(Number.isFinite(visual.lift)&&visual.lift>=0&&visual.lift<=.16);
}

test('every uninterrupted authored gesture retains its exact pose, lids, lift and contact timing',()=>{
 for(const name of M_GESTURES)for(const side of [-1,1]){
  const model=createGestureHandoff(),duration=GESTURE_DURATIONS[name];
  for(let i=0;i<=Math.ceil(duration*60);i++){
   const frame=sampleGesture({name,side,age:Math.min(duration,i/60)}),contact=frame.contact;
   const visual=model.sample({frame,side,dt:i?1/60:0});
   assert.equal(visual.pose,frame.pose);assert.equal(visual.blink,frame.blink);assert.equal(visual.lift,frame.lift);
   assert.equal(visual.transitioning,false);assert.equal(frame.contact,contact);
   assert.equal(Object.hasOwn(visual,'contact'),false);assert.equal(Object.hasOwn(visual,'phase'),false);
  }
  assert.equal(model.snapshot().transitions,0);
 }
});

test('owner-cleared natural completion remains neutral rather than inventing an interruption',()=>{
 for(const rate of [30,60,120]){
  const model=createGestureHandoff(),duration=GESTURE_DURATIONS.sleep,step=1/rate;
  model.sample({frame:sampleGesture({name:'sleep',age:duration-step*.5}),dt:0});
  const frame=sampleGesture(),visual=model.sample({frame,dt:step});
  assert.equal(visual.pose,frame.pose);assert.equal(visual.blink,null);assert.equal(visual.lift,0);
  assert.equal(visual.transitioning,false);assert.equal(model.snapshot().transitions,0);
 }
});

test('cancelling mid-sleep has no Head, forearm or leg step and settles at30,60 and120Hz',()=>{
 for(const rate of [30,60,120]){
  const model=createGestureHandoff();warm(model,'sleep',.5,rate);
  const before=model.snapshot(),visual=model.sample({frame:sampleGesture(),dt:1/rate});
  assert.equal(visual.transitioning,true);assert.equal(visual.blink.left> .9,true);
  for(const name of named)for(let axis=0;axis<3;axis++){
   assert.ok(Math.abs(visual.pose[name][axis]-before.pose[name][axis])<.035,`${name} cannot drop its old pose in one frame`);
  }
  assert.ok(visual.pose.Head[0]>.25,'the old .29rad primary head pose is physically retained');
  for(let i=0;i<rate*2;i++)assertBounded(model.sample({frame:sampleGesture(),dt:1/rate}));
  const ended=model.snapshot();assert.equal(ended.transitioning,false);
  for(const name of named)assert.deepEqual(ended.pose[name],[0,0,0]);
  assert.equal(ended.blink.left,0);assert.equal(ended.blink.right,0);assert.equal(ended.lift,0);
 }
});

test('a moving sleep interruption preserves the actual authored tangent, not just its last pose',()=>{
 for(const rate of [30,60,120]){
  const model=createGestureHandoff(),frame=warm(model,'sleep',.24,rate),before=model.snapshot();
  const age=frame.progress*frame.duration,h=.0001;
  const a=sampleGesture({name:'sleep',age:age-h}),b=sampleGesture({name:'sleep',age:age+h});
  model.sample({frame:sampleGesture(),dt:0});const at=model.snapshot();
  for(const name of named)for(let axis=0;axis<3;axis++){
   close(at.pose[name][axis],before.pose[name][axis]);
   close(at.velocity[name][axis],(b.pose[name][axis]-a.pose[name][axis])/(2*h));
  }
  close(at.blinkVelocity.left,(b.blink.left-a.blink.left)/(2*h));
  assert.ok(Math.abs(at.velocity.Head[0])>.01,'regression samples genuinely moving joints');
 }
});

test('interrupted sleep converges at the same physical time at30,60 and120Hz',()=>{
 const states=[];
 for(const rate of [30,60,120]){
  const model=createGestureHandoff();warm(model,'sleep',.24,rate);
  model.sample({frame:sampleGesture(),dt:0});
  for(let i=0;i<rate*.4;i++)model.sample({frame:sampleGesture(),dt:1/rate});
  states.push(model.snapshot());
 }
 for(const state of states)for(const name of named)for(let axis=0;axis<3;axis++){
  close(state.pose[name][axis],states[1].pose[name][axis]);close(state.velocity[name][axis],states[1].velocity[name][axis]);
 }
});

test('replacement follows the new gesture immediately while outgoing sleep and lids decay',()=>{
 const model=createGestureHandoff();warm(model);const before=model.snapshot();
 const newFrame=sampleGesture({name:'wave',age:0});
 model.sample({frame:newFrame,dt:0});const replaced=model.snapshot();
 assert.equal(replaced.transitioning,true);
 for(const name of named)assert.deepEqual(replaced.pose[name],before.pose[name]);
 assert.equal(replaced.blink.left,1);
 let changed=false,visual;
 for(let i=1;i<=120;i++){
  const frame=sampleGesture({name:'wave',age:i/60});visual=model.sample({frame,dt:1/60});
  assertBounded(visual);if(i===18)changed=Math.abs(visual.pose.Head[0]-before.pose.Head[0])>.05;
  assert.equal(frame.name,'wave');assert.equal(frame.contact,0);
 }
 assert.equal(changed,true,'handoff must not freeze or postpone the incoming gesture');
 assert.equal(visual.transitioning,false);assert.equal(visual.blink,null);assert.equal(model.snapshot().transitions,1);
});

test('same-name restarts and side replacements cannot evade the handoff',()=>{
 for(const replacement of [{age:0,side:1},{age:GESTURE_DURATIONS.sleep*.5,side:-1}]){
  const model=createGestureHandoff();warm(model);const before=model.snapshot();
  model.sample({frame:sampleGesture({name:'sleep',...replacement}),side:replacement.side,dt:0});
  const after=model.snapshot();assert.equal(after.transitioning,true);
  for(const name of named)assert.deepEqual(after.pose[name],before.pose[name]);
 }
});

test('another replacement during a handoff keeps both the rendered pose and residual velocity',()=>{
 const model=createGestureHandoff();warm(model);
 model.sample({frame:sampleGesture(),dt:0});
 for(let i=0;i<7;i++)model.sample({frame:sampleGesture(),dt:1/60});
 const before=model.snapshot();model.sample({frame:sampleGesture({name:'think',age:0}),dt:0});
 const after=model.snapshot();
 for(const name of named)for(let axis=0;axis<3;axis++){
  close(after.pose[name][axis],before.pose[name][axis]);close(after.velocity[name][axis],before.velocity[name][axis]);
 }
 assert.equal(after.transitions,2);
});

test('hop cancellation retains lift continuity within the existing fit envelope',()=>{
 for(const rate of [30,60,120]){
  const model=createGestureHandoff();warm(model,'hop',.47,rate);const before=model.snapshot();
  const visual=model.sample({frame:sampleGesture(),dt:1/rate});
  assert.ok(before.lift>.159);assert.ok(visual.lift>.145);assertBounded(visual);
  for(let i=0;i<rate*2;i++)assertBounded(model.sample({frame:sampleGesture(),dt:1/rate}));
  assert.equal(model.snapshot().lift,0);
 }
});

test('invalid frames, invalid time and reduced motion clear all visual residue immediately',()=>{
 const frame=sampleGesture({name:'sleep',age:6.2});
 for(const input of [{reducedMotion:true},{dt:NaN},{dt:-.1},{frame:null},
  {frame:{...frame,pose:{Head:[NaN,0,0]}}},{frame:{...frame,pose:{Unknown:[0,0,0]}}},
  {frame:{...frame,blink:{left:Infinity,right:0}}},{frame:{...frame,name:'dance'}},{frame:{...frame,lift:1}}]){
  const model=createGestureHandoff();warm(model);
  const visual=model.sample({frame:sampleGesture(),dt:1/60,...input});
  assert.deepEqual(visual.pose,{});assert.equal(visual.blink,null);assert.equal(visual.lift,0);assert.equal(visual.transitioning,false);
  for(const values of Object.values(model.snapshot().velocity))assert.deepEqual(values,[0,0,0]);
 }
});

test('visual outputs and residual arrays are reused, snapshots are isolated and no semantic gesture is invented',()=>{
 const model=createGestureHandoff();warm(model);
 const first=model.sample({frame:sampleGesture(),dt:0}),head=first.pose.Head,lids=first.blink;
 const next=model.sample({frame:sampleGesture(),dt:1/60});
 assert.equal(first,next);assert.equal(next.pose.Head,head);assert.equal(next.blink,lids);
 assert.deepEqual(Object.keys(next).sort(),['blink','lift','pose','transitioning']);
 const snapshot=model.snapshot();snapshot.pose.Head[0]=999;snapshot.blink.left=999;
 assert.notEqual(model.snapshot().pose.Head[0],999);assert.notEqual(model.snapshot().blink.left,999);
 model.reset();assert.deepEqual(model.sample().pose,{});assert.equal(model.snapshot().transitions,0);
});
