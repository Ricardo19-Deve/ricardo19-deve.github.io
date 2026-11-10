import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBetweenBeats} from './m-world-between-beats.mjs';

const invoke=(engine,extra={})=>engine.sample({
 dt:1/60,mode:'float',phase:'hold',energy:.8,speed:0,
 attention:{x:.5,y:-.2},turn:.4,...extra
});
test('V54 M remains subtly alive between performances without starting a repetitive gesture',()=>{
 const engine=createBetweenBeats({seed:27});
 const frames=[];
 for(let i=0;i<60*40;i++)frames.push(invoke(engine));
 const visible=frames.filter(frame=>frame.active);
 assert.equal(visible.length,frames.length);
 assert.ok(visible.every(frame=>Object.keys(frame.pose).length===14));
 assert.ok(visible.every(frame=>frame.face?.weights.curious>=0));
 assert.ok(visible.some(frame=>frame.face.weights.curious>.025));
 assert.ok(engine.snapshot().looks>=2,'quiet attention pulses should be irregular but visible');
 assert.ok(engine.snapshot().quietSeconds>39);
 assert.equal(engine.snapshot().mode,'float');
});

test('V54 attentive eyes, ears and all ten tail joints follow only existing page attention',()=>{
 const engine=createBetweenBeats({seed:9});
 for(let i=0;i<60*2;i++)invoke(engine,{attention:{x:-.8,y:.4},turn:-.6});
 const before=engine.snapshot();
 const reversal=invoke(engine,{attention:{x:1,y:-1},turn:1});
 const after=engine.snapshot();
 assert.ok(reversal.active);
 assert.ok(after.head.yaw<0,'head cannot snap to new direction in a frame');
 assert.ok(Math.abs(after.head.yaw-before.head.yaw)<.006,'rotation changes continuously');
 assert.ok(Math.max(...after.tail.map((x,i)=>Math.abs(x-before.tail[i])))<.004,'tail does not reset');
 for(const bone of Object.keys(reversal.pose))assert.ok(reversal.pose[bone].every(Number.isFinite));
 assert.ok(after.reacted>=1);
 assert.ok(reversal.face.weights.surprised>=0);
});

test('V54 natural mini-performances retain priority; quiet attention has a smooth V41 exit target',()=>{
 const engine=createBetweenBeats({seed:11});
 for(let i=0;i<60*2;i++)invoke(engine);
 const active=invoke(engine);
 assert.equal(active.active,true);
 const play=invoke(engine,{miniActive:true});
 assert.equal(play.active,false);
 assert.deepEqual(play.pose,{});
 assert.equal(play.face,null);
 const interrupted=invoke(engine,{miniActive:true});
 assert.equal(interrupted.active,false);
 assert.ok(engine.snapshot().head.yaw!==0,'latent state decays instead of resetting');
});

test('V54 original gestures, sleeping, page contact, reading and reduced motion always override quiet attention',()=>{
 const blocks=[
  {gesture:{name:'wave'}},{gesture:{name:'sleep'}},{attached:true},
  {reading:true},{affectActive:true},{mode:'rest'},{mode:'perch'},
  {mode:'settle'},{energy:.1},{speed:100},{phase:'approach'}
 ];
 for(const blocked of blocks){
  const engine=createBetweenBeats({seed:14});
  for(let i=0;i<60*10;i++){
   const r=invoke(engine,blocked);
   assert.equal(r.active,false,JSON.stringify(blocked));
   assert.deepEqual(r.pose,{});
   assert.equal(r.face,null);
  }
 }
 const engine=createBetweenBeats({seed:14});
 for(let i=0;i<90;i++)invoke(engine);
 invoke(engine,{reducedMotion:true});
 assert.equal(engine.snapshot().active,false);
 assert.ok(engine.snapshot().tail.every(v=>v===0));
});

test('V54 no exaggerated head/ears/tail/face motion or imaginary object interaction',()=>{
 const engine=createBetweenBeats({seed:105});
 let samples=0;
 for(let i=0;i<60*85;i++){
  const frame=invoke(engine,{attention:{x:Math.sin(i/500),y:Math.cos(i/300)},turn:Math.sin(i/80)});
  samples++;
  assert.ok(frame.engagement>=0&&frame.engagement<=1);
  assert.ok(frame.pulse>=0&&frame.pulse<=1);
  assert.ok(frame.pose.Head.every(x=>Number.isFinite(x)&&Math.abs(x)<.085));
  for(const bone of ['Ear.L','Ear.R']){
   assert.ok(frame.pose[bone].every(x=>Number.isFinite(x)&&Math.abs(x)<.065));
  }
  assert.equal(Object.keys(frame.pose).filter(x=>/^Tail\.\d{2}$/.test(x)).length,10);
  assert.ok(Object.values(frame.face.weights).every(v=>v>=0&&v<=.23));
  assert.ok(Object.values(frame.face.eyelids).every(v=>v>=0&&v<=.045));
  assert.ok(Object.keys(frame).every(key=>key!=='position'&&key!=='depth'));
 }
 assert.ok(samples>5000);
});

test('V54 30, 60 and 120 Hz head-and-tail response remain close in steady state',()=>{
 const positions=[];
 for(const fps of [30,60,120]){
  const engine=createBetweenBeats({seed:11});
  for(let i=0;i<fps*3;i++)
   engine.sample({dt:1/fps,attention:{x:.73,y:-.3},turn:.52,energy:.8});
  positions.push(engine.snapshot());
 }
 for(let i=1;i<positions.length;i++){
  assert.ok(Math.abs(positions[i].head.yaw-positions[0].head.yaw)<.001);
  assert.ok(Math.max(...positions[i].tail.map((v,k)=>Math.abs(v-positions[0].tail[k])))<.001);
 }
});

test('V54 rendered with V41 spring and V28 facial crossfade but without extra route or data access',()=>{
 const render=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const source=readFileSync(new URL('m-world-between-beats.mjs',import.meta.url),'utf8');
 assert.match(render,/createBetweenBeats/);
 assert.match(render,/betweenBeats\.sample\(\{dt,mode:activity/);
 assert.match(render,/secondaryTargets\[6\]\.pose=lastAmbient\.pose/);
 assert.match(render,/secondaryTargets\[6\]\.weight=quiet\?\.2:\.55/);
 assert.match(render,/secondaryPose\.sample\(\{dt,layers:secondaryTargets,reducedMotion:reduced\}\)/);
 assert.match(render,/secondaryLayer\.apply\(combinedSecondary\)/);
 assert.doesNotMatch(render,/ambientLayer|handoffs\.ambient/);
 assert.match(render,/lastTransition\.face/);
 assert.match(render,/facialTargetMixer\.sample\(\{performance:physical,microFace,affect:lastAffect/);
 assert.match(render,/facialContinuity\.sample\(\{dt,weights:faceTarget\?\.weights,eyelids:faceTarget\?\.eyelids/);
 assert.match(render,/betweenBeats:betweenBeats\.snapshot/);
 assert.doesNotMatch(source,/\bfetch\s*\(|localStorage|sessionStorage|document\.|window\.|navigator\.|LINKEDIN|OPENAI_/i);
});
