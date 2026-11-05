import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMotionContinuity} from './m-world-motion-continuity.mjs';

const neutral={x:0,y:0,rx:0,ry:0,rz:0,scale:0};
function frames(engine,n,input={}){
 let result;
 for(let i=0;i<n;i++)result=engine.sample({dt:1/60,...input});
 return result;
}
test('V39 begins without a fake launch or arrival on a page load',()=>{
 const m=createMotionContinuity();
 const initial=m.sample({dt:1/60,vx:0,vy:0,mode:'float'});
 assert.equal(initial.active,false);
 assert.deepEqual(initial.pose,{});
 assert.equal(m.snapshot().launches,0);
 assert.equal(m.snapshot().arrivals,0);
 assert.equal(m.snapshot().reorientations,0);
});

test('V39 original body anticipates real motion without ever commanding a route',()=>{
 const m=createMotionContinuity();
 frames(m,20,{vx:0,vy:0});
 const started=m.sample({dt:1/60,vx:95,vy:-20,turn:.45,mode:'float'});
 assert.equal(m.snapshot().launches,1);
 assert.ok(started.launch>=0&&started.launch<=1);
 const motion=frames(m,25,{vx:95,vy:-20,turn:.45,mode:'float'});
 assert.equal(motion.mode,'starting');
 assert.ok(motion.launch>.3);
 assert.ok(motion.pose.Head[0]<0,'head leans into the real departure');
 assert.ok(motion.pose['Leg.L'][0]>0,'legs participate in movement');
 assert.equal(motion.stage.x,0,'never move the DOM-attached M actor horizontally');
 assert.ok(Object.keys(motion.pose).filter(k=>/^Tail\.\d\d$/.test(k)).length===10);
});

test('V39 easing after a genuine stop returns to neutral without a pose pop',()=>{
 const m=createMotionContinuity();
 frames(m,70,{vx:110,vy:0,mode:'float'});
 const before=m.snapshot();
 assert.equal(before.launches,0,'an already-moving initial frame should not invent a departure');
 const begin=m.sample({dt:1/60,vx:0,vy:0,mode:'float'});
 assert.equal(m.snapshot().arrivals,1);
 assert.ok(begin.settle>=0);
 const mid=frames(m,29,{vx:0,vy:0,mode:'float'});
 assert.ok(mid.settle>.35,'the original bones receive a decaying settling movement');
 assert.ok(mid.pose.Head[0]>0,'head recovers from forward movement');
 assert.ok(mid.stage.y>=-.007&&mid.stage.y<=.007);
 const end=frames(m,270,{vx:0,vy:0,mode:'float'});
 assert.equal(end.mode,'quiet');
 assert.deepEqual(end.stage,neutral);
 assert.deepEqual(end.pose,{});
 assert.equal(m.snapshot().arrivals,1);
});

test('V39 changes in direction lag softly through all original ten tail joints',()=>{
 const m=createMotionContinuity();
 frames(m,30,{vx:100,turn:-.75,mode:'swim'});
 const turned=frames(m,9,{vx:100,turn:.75,mode:'swim'});
 assert.ok(Math.abs(m.snapshot().turnLag)>.1);
 assert.ok(Math.abs(turned.pose.Head[1])>.001);
 const tail=Object.keys(turned.pose).filter(k=>/^Tail\.\d\d$/.test(k));
 assert.equal(tail.length,10);
 assert.notEqual(turned.pose['Tail.01'][2],turned.pose['Tail.10'][2]);
 const later=frames(m,170,{vx:0,turn:0,mode:'float'});
 assert.equal(later.mode,'quiet');
});

test('V39 interest changes matter only for real movement modes, not arbitrary UI fields',()=>{
 const m=createMotionContinuity();
 frames(m,30,{vx:0,mode:'float'});
 const look=m.sample({dt:1/60,vx:0,mode:'peek'});
 assert.equal(m.snapshot().reorientations,1);
 assert.ok(look.reorient>=0);
 const observe=frames(m,25,{vx:0,mode:'peek'});
 assert.ok(observe.reorient>.2);
 frames(m,20,{vx:0,mode:'perch'});
 const play=m.sample({dt:1/60,vx:0,mode:'play'});
 assert.equal(m.snapshot().reorientations,2);
 const current=m.snapshot().reorientations;
 frames(m,100,{vx:0,mode:'play'});
 assert.equal(m.snapshot().reorientations,current,'no repeated fixed-loop intent');
});

test('V39 gentle reading mode reduces original bone amplitudes',()=>{
 const normal=createMotionContinuity(),reading=createMotionContinuity();
 frames(normal,18,{vx:0});
 frames(reading,18,{vx:0,reading:true});
 frames(normal,23,{vx:90,vy:-5,turn:.6,mode:'float'});
 frames(reading,23,{vx:90,vy:-5,turn:.6,mode:'float',reading:true});
 const a=normal.sample({dt:1/60,vx:90,turn:.6}),b=reading.sample({dt:1/60,vx:90,turn:.6,reading:true});
 assert.ok(Math.abs(a.pose.Head[0])>Math.abs(b.pose.Head[0])*2);
 assert.ok(Math.abs(a.pose.Head[1])>Math.abs(b.pose.Head[1])*2);
 assert.ok(Math.abs(a.stage.rz)>Math.abs(b.stage.rz)*2);
});

test('V39 reduced-motion, active authored gestures, real sleep and actual card contact win immediately',()=>{
 const m=createMotionContinuity();
 frames(m,20,{vx:0});
 frames(m,30,{vx:100,mode:'float'});
 for(const cancelled of [
  {vx:100,reducedMotion:true},
  {vx:100,gestureActive:true},
  {vx:100,mode:'sleep'},
  {vx:100,attached:true,mode:'perch',phase:'hold'}
 ]){
  const x=m.sample({dt:1/60,...cancelled});
  assert.equal(x.active,false);
  assert.deepEqual(x.stage,neutral);
  assert.deepEqual(x.pose,{});
  assert.equal(m.snapshot().moving,false);
 }
});

test('V39 hysteresis blocks repeated start/stop events near low-speed thresholds',()=>{
 const m=createMotionContinuity();
 frames(m,20,{vx:0});
 for(let i=0;i<100;i++)m.sample({dt:1/60,vx:i%2?24:29});
 assert.equal(m.snapshot().launches,0);
 frames(m,30,{vx:70});
 const launched=m.snapshot().launches;
 for(let i=0;i<100;i++)m.sample({dt:1/60,vx:i%2?15:23});
 assert.equal(m.snapshot().launches,launched);
 assert.equal(m.snapshot().arrivals,0);
 frames(m,20,{vx:0});
 assert.equal(m.snapshot().arrivals,1);
});

test('V39 safe numeric bounds under changing frame pacing and invalid signals',()=>{
 const m=createMotionContinuity();
 for(let i=0;i<800;i++){
  const x=m.sample({dt:i%17?1/60:.06,vx:i%23?250:NaN,vy:i%5?-200:Infinity,
   turn:i%13?3:-Infinity,mode:i%7?'orbit':'peek',reading:i%2===0});
  for(const v of Object.values(x.stage))assert.ok(Number.isFinite(v));
  assert.equal(x.stage.x,0);
  assert.ok(Math.abs(x.stage.rx)<=.028);
  assert.ok(Math.abs(x.stage.ry)<=.014);
  assert.ok(Math.abs(x.stage.rz)<=.025);
  for(const vals of Object.values(x.pose))for(const v of vals)assert.ok(Number.isFinite(v)&&Math.abs(v)<.1);
 }
});

test('V39 original WebGL rig uses one reversible additive transition layer',()=>{
 const source=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const controller=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(source,/createMotionContinuity/);
 assert.match(source,/continuityLayer=createGestureLayer\(bones,THREE\)/);
 assert.match(source,/continuityLayer\.prepare\(\);contactLayer\.prepare\(\)/);
 assert.match(source,/continuityLayer\.apply\(lastContinuity\.pose\)/);
 assert.match(source,/lastContinuity=motionContinuity\.sample\(\{dt,vx,vy/);
 assert.match(source,/attached:lastContact\.supported/);
 assert.match(source,/preserveFullSkinning/);
 assert.match(controller,/mode:state\.mode,activity:state\.mode==='perch'/);
 assert.match(controller,/locomotion:\{ax:state\.ax,ay:state\.ay,heading:state\.heading,turn:state\.turn/);
 const layer=readFileSync(new URL('m-world-motion-continuity.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(layer,/\bfetch\s*\(|localStorage|sessionStorage|document\.|window\.|OpenAI|analytics/i);
});
