import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPresenceDynamics} from './m-world-dynamics.mjs';
import {createFacialContinuity} from './m-world-face-continuity.mjs';
import {createRenderQualityGovernor} from './m-world-quality.mjs';
import {createAutonomy} from './m-world-autonomy.mjs';

const approx=(a,b,tolerance=.02)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);

test('V28 original-rig dynamics smooth abrupt gaze, movement and tail drive',()=>{
 const presence=createPresenceDynamics();
 const first=presence.sample({dt:1/60,attention:{x:1,y:-1},vx:220,vy:90,nearCard:true});
 assert.ok(first.attention.x>0&&first.attention.x<1);
 assert.ok(first.attention.y<0&&first.attention.y>-1);
 assert.ok(first.moving>0&&first.moving<1);
 assert.ok(first.tailEnergy>=.18&&first.tailEnergy<=.94);
 assert.ok(first.tailReactivity<=1.5&&first.tailFlow<=.84);
 for(let i=0;i<200;i++)presence.sample({dt:1/60,attention:{x:1,y:-1},vx:220,vy:90,nearCard:true});
 const settled=presence.snapshot();
 assert.ok(settled.attention.x>.99&&settled.attention.y<-.99);
 const release=presence.sample({dt:1/60,attention:{x:-1,y:1},vx:0,vy:0});
 assert.ok(release.attention.x>-.8,'eyes/head never snap to the opposite corner');
 assert.ok(release.moving>0,'tail inertia survives a sudden stop');
});

test('V28 smoothing is approximately independent of 30/60/120 Hz pacing',()=>{
 function run(rate){const p=createPresenceDynamics();let out;for(let i=0;i<rate*2;i++)out=p.sample({dt:1/rate,attention:{x:.8,y:-.4},vx:100,vy:-70,nearCard:true});return out;}
 const a=run(30),b=run(60),c=run(120);
 for(const key of ['x','y']){approx(a.attention[key],b.attention[key]);approx(c.attention[key],b.attention[key]);}
 approx(a.moving,b.moving);approx(c.moving,b.moving);
 approx(a.tailEnergy,b.tailEnergy);approx(c.tailEnergy,b.tailEnergy);
});

test('V28 respects OS reduced motion and resets prior inertial state',()=>{
 const p=createPresenceDynamics();
 for(let i=0;i<80;i++)p.sample({dt:1/60,vx:180,vy:-20,attention:{x:.9,y:.8}});
 const neutral=p.sample({dt:1/60,reducedMotion:true,vx:500,attention:{x:1,y:1}});
 assert.deepEqual(neutral.attention,{x:0,y:0});
 assert.equal(neutral.tailEnergy,0);assert.equal(neutral.tailReactivity,0);
 assert.equal(neutral.energy,0);assert.equal(neutral.stageYaw,0);
 assert.deepEqual(neutral.bodyMotion,{rotation:{y:0,z:0},velocity:{x:0,y:0}});
 assert.equal(p.snapshot().moving,0);
});

test('V28 dynamics reject non-finite inputs without NaN propagation',()=>{
 const p=createPresenceDynamics();
 for(const input of [
  {dt:Infinity,vx:NaN,vy:-Infinity,attention:{x:NaN,y:Infinity}},
  {dt:-10,vx:1e200,vy:-1e200,attention:{}},
  {dt:1/30,attention:null}
 ]) {
  const out=p.sample(input);
  if(input.attention===null||Object.keys(input.attention||{}).length===0)assert.ok(Math.abs(out.attention.x)<=1,'invalid gaze stays bounded');
  for(const n of [out.attention.x,out.attention.y,out.energy,out.tailEnergy,out.tailReactivity,out.tailFlow,out.stageYaw,out.moving])
   assert.ok(Number.isFinite(n));
 }
});

test('V28 original facial channels crossfade between feelings without snapping',()=>{
 const face=createFacialContinuity();
 for(let i=0;i<45;i++)face.sample({dt:1/60,weights:{happy:.7},eyelids:{left:.1,right:.1}});
 const before=face.snapshot();
 assert.ok(before.weights.happy>.6);
 const after=face.sample({dt:1/60,weights:{curious:.7},eyelids:{left:.3,right:.3}});
 assert.ok(after.weights.happy>0&&after.weights.happy<before.weights.happy);
 assert.ok(after.weights.curious>0&&after.weights.curious<.7);
 for(let i=0;i<100;i++)face.sample({dt:1/60,weights:{curious:.7},eyelids:{left:.3,right:.3}});
 assert.ok(face.snapshot().weights.curious>.69);
 assert.ok(face.snapshot().weights.happy<.001);
});
test('V28 facial continuity preserves gesture priority and reduced-motion reset',()=>{
 const face=createFacialContinuity();
 face.sample({dt:.06,weights:{happy:.8},eyelids:{left:.4,right:.4}});
 assert.equal(face.sample({dt:1/60,gestureActive:true,weights:{curious:1}}),null);
 assert.deepEqual(face.snapshot().weights,{happy:0,curious:0,surprised:0});
 face.sample({dt:.06,weights:{surprised:.7},eyelids:{left:.2,right:.2}});
 assert.equal(face.sample({dt:1/60,reducedMotion:true}),null);
 assert.deepEqual(face.snapshot().eyelids,{left:0,right:0});
});
test('V28 adaptive render quality retains HQ until sustained slow frames',()=>{
 const q=createRenderQualityGovernor({maxRatio:2.5,minRatio:1.75});
 for(let i=0;i<80;i++)assert.equal(q.observe(33),false,'not enough evidence to drop before warm-up and hysteresis');
 let changed=false;for(let i=0;i<100;i++)changed=q.observe(33)||changed;
 assert.ok(changed);
 assert.ok(q.snapshot().ratio<2.5&&q.snapshot().ratio>=1.75);
 assert.ok(q.snapshot().changes>=1);
});

test('V28 quality recovers slowly, never oscillates or exceeds the source cap',()=>{
 const q=createRenderQualityGovernor({maxRatio:2.5,minRatio:1.75});
 for(let i=0;i<450;i++)q.observe(36);
 const degraded=q.snapshot().ratio;
 assert.ok(degraded<2.5);
 for(let i=0;i<80;i++)q.observe(16.7);
 assert.equal(q.snapshot().ratio,degraded,'short 60 FPS burst cannot cause quality flicker');
 for(let i=0;i<1200;i++)q.observe(16.7);
 assert.ok(q.snapshot().ratio>degraded);
 assert.ok(q.snapshot().ratio<=2.5);
});

test('V28 quality changes profile conservatively and ignores invalid frame timing',()=>{
 const q=createRenderQualityGovernor();
 for(const n of [0,NaN,Infinity,-1,500])assert.equal(q.observe(n),false);
 assert.equal(q.configure({maxRatio:2,minRatio:1.5,device:'mobile'}),2);
 assert.deepEqual([q.snapshot().ratio,q.snapshot().device],[2,'mobile']);
 for(let i=0;i<400;i++)q.observe(34);
 assert.ok(q.snapshot().ratio>=1.5&&q.snapshot().ratio<2);
 assert.equal(q.configure({maxRatio:2.5,minRatio:1.75,device:'desktop'}),2.5);
});

const target=(id,attention=0)=>({id,stableId:id,kind:'project',actions:['inspect'],
 novelty:.75,visibleShare:1,distance:150,attention});
const choose=(seed,attention)=>createAutonomy({seed}).choose({nowMs:10_000,energy:.85,
 targets:[target('card-a',attention),target('card-b')],
 context:{active:true},selfPlayAvailable:false,ballPlayAvailable:false,routinesAvailable:false});

test('V28 attention gently increases interest in the matching visible card',()=>{
 let base=0,focused=0;
 for(let seed=1;seed<=1000;seed++){
  base+=Number(choose(seed,0)?.targetId==='card-a');
  focused+=Number(choose(seed,1)?.targetId==='card-a');
 }
 assert.ok(focused>base+20,`focus must affect decisions without forcing them (${base},${focused})`);
 const blocked=createAutonomy({seed:20}).choose({nowMs:10_000,energy:.9,targets:[target('card-a',1)],
  context:{active:true,reducedMotion:true}});
 assert.equal(blocked,null,'visitor attention never overrides reduced motion');
 assert.equal(createAutonomy({seed:20}).choose({nowMs:10_000,energy:.9,targets:[target('card-a',1)],
  context:{active:true,typing:true}}),null,'visitor attention never interrupts typing');
});

test('V28 integration keeps the original V6 skin, safety gates and remote quotas',()=>{
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const controller=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 const autonomy=readFileSync(new URL('m-world-autonomy.mjs',import.meta.url),'utf8');
 assert.match(renderer,/preserveFullSkinning/);
 assert.match(renderer,/31-bone, 14-influence skin/);
 assert.match(renderer,/createPresenceDynamics/);
 assert.match(renderer,/createRenderQualityGovernor/);
 assert.match(renderer,/updateBatch\(protectedBatch/);
 assert.match(controller,/attention:now<interest.userAttentionUntil/);
 assert.match(controller,/reducedMotion/);
 assert.match(autonomy,/attention:clamp\(target.attention,0\)/);
 assert.match(controller,/M_WORLD_CONFIG.directorEndpoint/);
});
