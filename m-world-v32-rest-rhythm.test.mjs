import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleEmbodiedRest,REST_TILT_RADIANS,REST_MIN_SCALE} from './m-world-rest-pose.mjs';
import {senseWorldRhythm,worldCandidateWeight} from './m-world-world-rhythm.mjs';
import {createAutonomy} from './m-world-autonomy.mjs';
import {GESTURE_DURATIONS} from './m-world-acting.mjs';

// V71 replaced the V32 rigid 76-degree side tilt with a curled nap in the rig itself
// (see m-world-v71-sleep.test.mjs); the stage keeps only a gentle roll and settle.
const neutral={resting:false,phase:'awake',weight:0,rotationZ:0,rotationX:0,
 positionX:0,positionY:0,scale:1,breath:0};
test('V71 nap stage: lowers, rolls gently towards one side and gets back up, no rigid side tilt',()=>{
 const duration=GESTURE_DURATIONS.sleep;
 assert.deepEqual(sampleEmbodiedRest({name:'curious',age:5}),neutral);
 assert.deepEqual(sampleEmbodiedRest({name:'sleep',age:0}),neutral);
 const before=sampleEmbodiedRest({name:'sleep',age:duration*.22});
 const down=sampleEmbodiedRest({name:'sleep',age:duration*.55,side:1});
 const reverse=sampleEmbodiedRest({name:'sleep',age:duration*.55,side:-1});
 const rising=sampleEmbodiedRest({name:'sleep',age:duration*.9,side:-1});
 assert.equal(down.phase,'sleeping');
 assert.ok(before.weight>0&&before.weight<down.weight,'M visibly lowers before settling');
 assert.ok(down.weight>.99);
 assert.ok(down.rotationZ>.2&&down.rotationZ<.35,'a gentle roll, not the old 76-degree tilt');
 assert.equal(REST_TILT_RADIANS,down.rotationZ);
 assert.equal(reverse.rotationZ,-down.rotationZ,'M chooses left or right side');
 assert.ok(down.positionY<-.04,'resting body settles lower');
 assert.ok(down.scale>=REST_MIN_SCALE-.01&&down.scale<.95,'rest fits the existing actor window');
 assert.ok(rising.weight<down.weight,'M visibly gets back up');
 assert.ok(Math.abs(sampleEmbodiedRest({name:'sleep',age:duration,side:1}).rotationZ)<1e-8);
});
test('V71 nap stage follows smooth curves with bounded breathing, no abrupt transition',()=>{
 const duration=GESTURE_DURATIONS.sleep, samples=Array.from({length:720},
  (_,i)=>sampleEmbodiedRest({name:'sleep',age:duration*i/719,side:1}));
 for(const state of samples){
  for(const val of [state.weight,state.rotationX,state.rotationZ,state.positionX,state.positionY,state.scale,state.breath])
   assert.ok(Number.isFinite(val));
  assert.ok(state.weight>=0&&state.weight<=1);
  assert.ok(state.scale>=REST_MIN_SCALE-.001&&state.scale<=1.0001);
  assert.ok(Math.abs(state.rotationZ)<=REST_TILT_RADIANS+1e-9);
 }
 const changes=samples.slice(1).map((v,i)=>Math.abs(v.rotationZ-samples[i].rotationZ));
 assert.ok(Math.max(...changes)<.02,'no rotational pop in the slow settle');
 assert.ok(Math.max(...samples.map(s=>Math.abs(s.positionY+.05*s.weight)))<.006,'breathing moves the stage only faintly');
 assert.deepEqual(sampleEmbodiedRest({name:'sleep',age:5,reducedMotion:true}),neutral);
});
test('V32 world uses local device time without network or geolocation',()=>{
 const morning=senseWorldRhythm({date:new Date('2026-11-05T08:30:00')});
 const night=senseWorldRhythm({date:new Date('2026-11-05T01:30:00'),online:false});
 const eve=senseWorldRhythm({date:new Date('2026-11-05T20:00:00')});
 const day=senseWorldRhythm({date:new Date('2026-11-05T14:30:00')});
 assert.equal(morning.phase,'morning');assert.equal(night.phase,'night');
 assert.equal(eve.phase,'evening');assert.equal(day.phase,'day');
 assert.equal(night.online,false);
 assert.ok(night.restBias>day.restBias);
 assert.ok(morning.curiosityBias>eve.curiosityBias);
 assert.equal(worldCandidateWeight('sleep',night),1.5);
 assert.equal(worldCandidateWeight('ball',night),.76);
 assert.equal(worldCandidateWeight('ball',day),1.05);
 assert.equal(worldCandidateWeight('inspect',morning),1.16);
 assert.equal(worldCandidateWeight('sleep',{phase:'invalid',restBias:900}),1);
});
test('V32 night gently nudges actual life decisions, not forces a fixed sequence',()=>{
 const common={nowMs:110000,energy:.48,routinesAvailable:true,ballPlayAvailable:true,
 selfPlayAvailable:true,targets:[],context:{active:true}};
 const picks=world=>Array.from({length:240},(_,i)=>createAutonomy({seed:i*7919+19})
  .choose({...common,world}));
 const night=picks({phase:'night'}),morning=picks({phase:'morning'});
 const counts=rows=>rows.filter(d=>d.gesture==='sleep').length;
 assert.ok(counts(night)>counts(morning),'night increases but does not guarantee nap');
 assert.ok(counts(night)>0&&counts(night)<night.length);
 assert.ok(night.some(x=>x.gesture!=='sleep'),'other needs remain available');
});
test('V32 M cannot nap over text and reduced motion remains authoritative',()=>{
 const source=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(source,/const napping=decision.gesture==='sleep'/);
 assert.match(source,/safeSpot=!napping\|\|stationary\|\|Boolean\(planGestureStage/);
 assert.match(source,/quietReady&&safeSpot/);
 assert.match(source,/world:typeof senseWorldRhythm==='function'/);
 assert.match(renderer,/sampleEmbodiedRest\(\{\.\.\.state.gesture,reducedMotion:reduced\}\)/);
 assert.match(renderer,/stage.rotation.z=num\(extra.rz\+micro.roll,-.12,.12\)\+lastRestPose.rotationZ/);
 assert.match(renderer,/stage.scale.setScalar\(\(1\+num\(extra.scale\+micro.scale,-.03,.03\)\+lastLiving.stage.scale\+lastContact.stage.scale\+lastContinuity.stage.scale\+lastEmotional.stage.scale\+lastBridge.stage.scale\)\*lastRestPose.scale\)/);
 assert.match(renderer,/sleeping:state\.gesture\?\.name==='sleep',supported:lastContact\.supported/);
 assert.match(renderer,/attached:lastContact\.supported,reducedMotion:reduced/);
 assert.match(renderer,/gestureActive:Boolean\(lastGesture.name\)\|\|Boolean\(state.gesture\)/);
 assert.match(renderer,/lastLiving=livingPerformance.sample\(\{dt,vx,vy/);
 assert.match(renderer,/preserveFullSkinning/);
});
