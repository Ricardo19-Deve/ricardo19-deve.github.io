import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IDLE_MOMENTS,IDLE_DURATIONS,IDLE_FIRST_DELAY,IDLE_COOLDOWN,IDLE_REPEAT_GAP,RELEASE_SECONDS,
 sampleIdleMoment,createIdleMoments} from './m-world-idle-moments.mjs';
import {travelEase} from './m-world-spatial.mjs';
import {SLEEP_TAIL_WRAP,sampleSleep} from './m-world-sleep.mjs';

const channels=frame=>{
 const out=[];
 for(const [bone,v] of Object.entries(frame.pose))v.forEach((n,i)=>out.push([bone+i,n]));
 if(frame.blink)out.push(['blink.l',frame.blink.left],['blink.r',frame.blink.right]);
 out.push(['lift',frame.lift]);
 return new Map(out);
};
const value=(map,key)=>map.get(key)??0;

test('V72 there are at least four full-body idle moments, each a few seconds long',()=>{
 assert.ok(IDLE_MOMENTS.length>=4);
 for(const name of IDLE_MOMENTS){
  assert.ok(IDLE_DURATIONS[name]>=2&&IDLE_DURATIONS[name]<=6,name);
  const mid=sampleIdleMoment({name,age:IDLE_DURATIONS[name]/2});
  const bones=Object.keys(mid.pose);
  assert.ok(bones.length>=8,name+' moves the whole body, not one bone');
  assert.ok(bones.some(b=>b.startsWith('Tail'))||bones.includes('Ear.L'),name+' extremities follow');
 }
});

test('V72 idle moments start and end at rest with zero slope and never jump between frames',()=>{
 const dt=1/30;
 for(const name of IDLE_MOMENTS)for(const side of [-1,1]){
  const d=IDLE_DURATIONS[name];
  for(const edge of [1e-4,d-1e-4]){
   const frame=channels(sampleIdleMoment({name,age:edge,side}));
   for(const [key,n] of frame)assert.ok(Math.abs(n)<1e-6,`${name} ${key} at ${edge}`);
  }
  // Zero slope at the ends: the first and last 30 fps frame barely move.
  for(const [a,b] of [[1e-4,dt],[d-dt,d-1e-4]]){
   const fa=channels(sampleIdleMoment({name,age:a,side})),fb=channels(sampleIdleMoment({name,age:b,side}));
   for(const key of new Set([...fa.keys(),...fb.keys()]))assert.ok(Math.abs(value(fa,key)-value(fb,key))<.004,`${name} ${key} slope`);
  }
  let previous=channels(sampleIdleMoment({name,age:0,side}));
  for(let age=dt;age<d;age+=dt){
   const frame=channels(sampleIdleMoment({name,age,side}));
   for(const key of new Set([...frame.keys(),...previous.keys()]))
    // Blinks are quick by nature (about five frames to close); bones never jump.
    assert.ok(Math.abs(value(frame,key)-value(previous,key))<(key.startsWith('blink')?.45:.12),`${name} ${key} pops at ${age.toFixed(2)}`);
   previous=frame;
  }
 }
});

test('V72 idle poses keep the rig contract: ±0.9 rad and shoulders below 0.25 rad',()=>{
 for(const name of IDLE_MOMENTS)for(let age=0;age<IDLE_DURATIONS[name];age+=.05){
  const {pose}=sampleIdleMoment({name,age,side:age%2<1?1:-1});
  for(const [bone,v] of Object.entries(pose)){
   for(const n of v)assert.ok(Math.abs(n)<=.9,`${name} ${bone}`);
   if(bone.startsWith('Arm.'))for(const n of v)assert.ok(Math.abs(n)<.25,`${name} ${bone} shoulder`);
  }
 }
});

test('V72 reduced motion and invalid input give a neutral frame',()=>{
 for(const name of IDLE_MOMENTS){
  const frame=sampleIdleMoment({name,age:1,reducedMotion:true});
  assert.deepEqual(frame.pose,{});assert.equal(frame.lift,0);assert.equal(frame.blink,null);
 }
 assert.deepEqual(sampleIdleMoment({name:'nope',age:1}).pose,{});
 assert.deepEqual(sampleIdleMoment({name:'look-around',age:NaN}).pose,{});
 const idle=createIdleMoments({seed:3});
 for(let i=0;i<2000;i++)assert.equal(idle.sample({dt:1/30,reducedMotion:true}).active,false);
 assert.equal(idle.snapshot().started,0);
});

const run=(idle,seconds,facts={},dt=1/30)=>{let last;for(let t=0;t<seconds;t+=dt)last=idle.sample({dt,...facts});return last;};

const until=(idle,check,limit=120,dt=1/30)=>{let t=0;while(!check(idle.snapshot())&&t<limit){idle.sample({dt});t+=dt;}return t;};

test('V72 the scheduler waits for a quiet first delay, then keeps a cooldown between moments',()=>{
 for(const seed of [1,7,19,42]){
  const idle=createIdleMoments({seed});
  const first=until(idle,s=>s.started===1);
  assert.ok(first>=IDLE_FIRST_DELAY[0]-.05&&first<=IDLE_FIRST_DELAY[1]+.05,'first delay '+first);
  const name=idle.snapshot().history[0];
  const played=until(idle,s=>s.completed===1);
  assert.ok(Math.abs(played-IDLE_DURATIONS[name])<.1,'plays the whole moment');
  const gap=until(idle,s=>s.started===2);
  assert.ok(gap>=IDLE_COOLDOWN[0]-.05&&gap<=IDLE_COOLDOWN[1]+.05,'cooldown '+gap);
  assert.notEqual(idle.snapshot().history[1],name,'never the same moment twice in a row');
 }
});

test('V72 a moment never returns within the repeat gap and the mix has variety',()=>{
 const idle=createIdleMoments({seed:11}),seen=new Map();
 for(let t=0;t<1800;t+=1/30){
  const before=idle.snapshot().started;
  idle.sample({dt:1/30,energy:.8});
  const s=idle.snapshot();
  if(s.started>before){
   const last=seen.get(s.active);
   if(last!==undefined)assert.ok(t-last>=IDLE_REPEAT_GAP-.05,`${s.active} repeated after ${(t-last).toFixed(1)}s`);
   seen.set(s.active,t);
  }
 }
 assert.ok(seen.size>=4,'at least four different moments over half an hour');
});

test('V72 travel, gestures, reading, rest and physical limits block idle moments',()=>{
 for(const facts of [{moving:true},{gesture:{name:'wave'}},{reading:true},{resting:true},{busy:true}]){
  const idle=createIdleMoments({seed:5});
  run(idle,120,facts);
  assert.equal(idle.snapshot().started,0,JSON.stringify(facts));
 }
});

test('V72 perched or tired M only gets the calm moments',()=>{
 const perched=createIdleMoments({seed:2}),tired=createIdleMoments({seed:2});
 const names=new Set(),tiredNames=new Set();
 for(let t=0;t<900;t+=1/30){
  const a=perched.sample({dt:1/30,perched:true});if(a.active)names.add(a.name);
  const b=tired.sample({dt:1/30,energy:.2});if(b.active)tiredNames.add(b.name);
 }
 assert.ok(names.size>0&&tiredNames.size>0);
 for(const name of [...names,...tiredNames])assert.ok(['face-wash','look-around'].includes(name),name);
});

test('V72 an interrupted moment keeps moving while it fades out, without a pop',()=>{
 const idle=createIdleMoments({seed:4});
 assert.ok(idle.force('look-around'));
 let frame=run(idle,1.4);
 assert.equal(frame.weight,1);
 const before=sampleIdleMoment({name:'look-around',age:1.4,side:1}).pose.Head;
 let previous=frame,weights=[];
 for(let t=0;t<RELEASE_SECONDS+.1;t+=1/30){
  frame=idle.sample({dt:1/30,moving:true});weights.push(frame.weight);
  const a=previous.pose.Head||[0,0,0],b=frame.pose.Head||[0,0,0];
  assert.ok(a.every((n,i)=>Math.abs(n-b[i])<.08),'head does not snap during release');
  previous=frame;
 }
 assert.ok(before.some(n=>Math.abs(n)>.01));
 for(let i=1;i<weights.length;i++)assert.ok(weights[i]<=weights[i-1]+1e-9);
 assert.equal(weights.at(-1),0);
 assert.equal(idle.snapshot().released,1);
 assert.ok(idle.snapshot().cooldown>=IDLE_COOLDOWN[0]-1,'a release still earns a cooldown');
});

test('V72 travel easing is continuous in velocity where route segments join',()=>{
 const slope=(f,u,h=1e-5)=>(f(Math.min(1,u+h))-f(Math.max(0,u-h)))/(Math.min(1,u+h)-Math.max(0,u-h));
 for(const [a,b] of [[false,false],[true,false],[false,true],[true,true]]){
  const f=u=>travelEase(u,a,b);
  assert.ok(Math.abs(f(0))<1e-12&&Math.abs(f(1)-1)<1e-12);
  for(let u=0;u<=1;u+=.01)assert.ok(f(u)>=-1e-12&&f(u)<=1+1e-12);
  // Stops only where the route really stops; joins carry the speed through.
  assert.ok(a?slope(f,0)>.5:slope(f,0)<.05,`start ${a}`);
  assert.ok(b?slope(f,1)>.5:slope(f,1)<.05,`end ${b}`);
 }
 // A join between two flowing segments: end speed of one equals start speed of the next.
 assert.ok(Math.abs(slope(u=>travelEase(u,false,true),1)-slope(u=>travelEase(u,true,false),0))<1e-3);
 assert.ok(Math.abs(slope(u=>travelEase(u,true,true),1)-slope(u=>travelEase(u,true,true),0))<1e-3);
});

test('V72 the sleep tail tucks under the body and mirrors only its sideways curl',()=>{
 assert.equal(SLEEP_TAIL_WRAP.length,10);
 for(const side of [-1,1]){
  const pose=sampleSleep({age:11,side}).pose;
  for(let i=3;i<=10;i++){
   const v=pose['Tail.'+String(i).padStart(2,'0')];
   assert.ok(v[0]<-.15,'tucked under');
   assert.ok(Math.sign(v[1])===-side||Math.abs(v[1])<1e-9,'curls toward the lean side');
  }
 }
});

test('V72 the renderer plays idles through the gesture layer and the route waits for them',()=>{
 const renderer=readFileSync(new URL('./m-world-3d.mjs',import.meta.url),'utf8');
 const buddy=readFileSync(new URL('./scroll-buddy.js',import.meta.url),'utf8');
 assert.match(renderer,/createIdleMoments/);
 assert.match(renderer,/gestureLayer\.apply\(lastIdle\.active\?mergePoses\(lastVisualGesture\.pose,lastIdle\.pose\)/);
 assert.doesNotMatch(renderer,/__mPoseOverride|TEMP-PHASE3/);
 assert.match(buddy,/routeActive:Boolean\(route\)/);
 assert.match(buddy,/if\(!route&&avatar\?\.idleActive\?\.\(\)\)/);
});
