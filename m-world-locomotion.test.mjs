import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceLocomotion,sampleLocomotionPose} from './m-world-locomotion.mjs';
import {canonicalBoneName} from './m-lab/interactions/motion-v8.mjs';
const run=(fps,seconds,target={x:600,y:280})=>{
 let state={x:0,y:0,vx:0,vy:0};
 for(let frame=0;frame<Math.round(fps*seconds);frame++)state=advanceLocomotion(state,target,1/fps);
 return state;
};
const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

test('steering is pure and limits speed and acceleration during starts and abrupt reversals',()=>{
 const source=Object.freeze({x:0,y:0,vx:0,vy:0}),target=Object.freeze({x:700,y:180});
 let state=advanceLocomotion(source,target,1/60),peak=0;
 assert.notEqual(state,source);assert.deepEqual(source,{x:0,y:0,vx:0,vy:0});
 assert.ok(Math.hypot(state.vx,state.vy)<=340/60+1e-8);
 for(let frame=0;frame<1200;frame++){
  const next=advanceLocomotion(state,frame<240?target:{x:-250,y:400},1/60);
  const acceleration=Math.hypot(next.vx-state.vx,next.vy-state.vy)*60;
  assert.ok(acceleration<=340+1e-7,`unbounded acceleration ${acceleration}`);
  assert.ok(Math.hypot(next.vx,next.vy)<=150+1e-8);
  assert.ok(Math.hypot(next.x-state.x,next.y-state.y)<=150/60+1e-8);
  assert.ok(Math.abs(next.turn)<=1&&next.travel>=0&&next.travel<=1);
  peak=Math.max(peak,Math.hypot(next.vx,next.vy));state=next;
 }
 assert.ok(peak>149,'normal travel must still reach its chosen speed');
 assert.ok(Math.hypot(state.x+250,state.y-400)<.02);
 assert.ok(Math.hypot(state.vx,state.vy)<.02);
});

test('arrival decelerates continuously and settles without crossing a stationary goal',()=>{
 let state={x:0,y:0,vx:0,vy:0},lastDistance=120,previousSpeed=0,hasDecelerated=false;
 for(let frame=0;frame<600;frame++){
  const next=advanceLocomotion(state,{x:120,y:0},1/60),distance=120-next.x,speed=Math.hypot(next.vx,next.vy);
  assert.ok(distance>=-1e-7&&distance<=lastDistance+1e-7);
  if(next.x>65&&speed<previousSpeed)hasDecelerated=true;
  state=next;lastDistance=distance;previousSpeed=speed;
 }
 assert.ok(hasDecelerated);assert.ok(lastDistance<.0001);assert.ok(previousSpeed<.0001);
});

test('30, 60, 120 and 144 Hz follow nearly identical acceleration and arrival curves',()=>{
 for(const seconds of [.5,1,2,5,9]){
  const reference=run(120,seconds);
  for(const fps of [30,60,144]){
   const actual=run(fps,seconds);
   assert.ok(Math.hypot(actual.x-reference.x,actual.y-reference.y)<.16,`${fps} Hz position at ${seconds}s`);
   assert.ok(Math.hypot(actual.vx-reference.vx,actual.vy-reference.vy)<.35,`${fps} Hz velocity at ${seconds}s`);
  }
 }
});

test('turn anticipation leads a corner, mirrors with direction, and fades on arrival',()=>{
 const moving={x:0,y:0,vx:140,vy:0,heading:0,turn:0,travel:.9};
 const up=advanceLocomotion(moving,{x:80,y:-240},1/60),down=advanceLocomotion(moving,{x:80,y:240},1/60);
 assert.ok(up.turn<-.04&&down.turn>.04);
 assert.ok(Math.abs(up.heading)<.05,'head anticipation should start while most travel is still horizontal');
 close(up.turn,-down.turn);close(up.vx,down.vx);close(up.vy,-down.vy);
 const pose=sampleLocomotionPose(up);
 assert.ok(pose.Head[1]<0&&pose.Chest[1]>0&&pose['Tail.10'][2]>0);
 let settled=down;
 for(let frame=0;frame<900;frame++)settled=advanceLocomotion(settled,{x:80,y:240},1/60);
 assert.ok(Math.abs(settled.turn)<.0001&&settled.travel<.0001);
});

test('motion presentation is bounded, canonical, and has no shoulder or rig edits',()=>{
 for(const turn of [-100,-1,0,1,100])for(const ax of [-1e6,0,1e6]){
  const pose=sampleLocomotionPose({turn,travel:100,ax,ay:-ax});
  assert.ok(Object.keys(pose).every(name=>canonicalBoneName(name)===name));
  assert.ok(!Object.keys(pose).some(name=>name.startsWith('Arm.')||name.startsWith('Shoulder.')));
  for(const angles of Object.values(pose))assert.ok(angles.every(value=>Number.isFinite(value)&&Math.abs(value)<=.1));
 }
 assert.deepEqual(sampleLocomotionPose(),{});
 assert.deepEqual(sampleLocomotionPose({turn:1,travel:1,ax:340},{reducedMotion:true}),{});
});

test('invalid time and targets do not advance; long background gaps cannot teleport',()=>{
 const source={x:25,y:30,vx:40,vy:0};
 for(const dt of [0,-1,NaN,Infinity,'1']){
  const result=advanceLocomotion(source,{x:500,y:500},dt);
  assert.equal(result.x,25);assert.equal(result.y,30);
 }
 const invalid=advanceLocomotion(source,{x:NaN,y:200},.05);
 assert.equal(invalid.x,25);assert.equal(invalid.y,30);
 const largeGap=advanceLocomotion(source,{x:500,y:500},20);
 assert.ok(Math.hypot(largeGap.x-25,largeGap.y-30)<=15);
 for(const value of Object.values(advanceLocomotion({x:NaN,y:Infinity,vx:NaN},{x:10,y:10},.05)))assert.ok(Number.isFinite(value));
});
test('acceleration presentation eases in and out rather than popping when travel begins',()=>{
 let state={x:0,y:0,vx:0,vy:0};
 state=advanceLocomotion(state,{x:500,y:0},1/60);
 assert.ok(state.leanX>0&&state.leanX<.15);
 assert.ok(Math.abs(sampleLocomotionPose(state).Head[2])<.007);
 for(let frame=0;frame<900;frame++)state=advanceLocomotion(state,{x:500,y:0},1/60);
 assert.ok(Math.abs(state.leanX)<.0001&&Math.abs(state.leanY)<.0001);
});
