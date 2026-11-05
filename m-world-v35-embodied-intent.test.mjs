import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLivingPerformance} from './m-world-living-performance.mjs';

const MAX_ANGLES={head:.2,tail:.05};
const advance=(life,secs,options={})=>{
 let frame;
 for(let t=0;t<secs;t+=1/60)frame=life.sample({dt:1/60,...options});
 return frame;
};
test('V35 M has organic, seed-dependent spontaneous micro-actions, not a rigid 4-second loop',()=>{
 const a=createLivingPerformance({seed:800}),b=createLivingPerformance({seed:912});
 const modesA=[],modesB=[];
 for(let i=0;i<2400;i++){
  const x=a.sample({dt:1/60,phase:'hold'}),y=b.sample({dt:1/60,phase:'hold'});
  if(x.idle>.2)modesA.push(x.mode);
  if(y.idle>.2)modesB.push(y.mode);
 }
 assert.ok(new Set(modesA).size>=2,'repertoire must contain different kinds of micro-actions');
 assert.notDeepEqual(modesA,modesB,'different visits have different timings and sequences');
 assert.ok(a.snapshot().completedIdles>=2);
 assert.ok(b.snapshot().completedIdles>=2);
});

test('V35 attention leads the head before the body accelerates',()=>{
 const life=createLivingPerformance({seed:100});
 let reaction;
 for(let n=0;n<30;n++)reaction=life.sample({
  dt:1/60,vx:0,vy:0,phase:'approach',attention:{x:.9,y:.3}
 });
 assert.equal(reaction.active,true);
 assert.equal(reaction.mode,'anticipating');
 assert.ok(reaction.pose.Head[0]<-.04,'head leans before departure');
 assert.ok(reaction.pose.Head[1]>.04,'M looks toward intended destination');
 assert.ok(reaction.pose.Neck[1]>0,'neck follows the head');
 assert.ok(reaction.stage.rx>0&&reaction.stage.rx<.025);
});

test('V35 lived moments physically change head, original ears, ten tail bones and stage',()=>{
 const life=createLivingPerformance({seed:200});
 const examples=['notice','explore','reflect','complete'];
 const snapshots=examples.map(name=>life.sample({
  dt:1/60,attention:{x:.12,y:-.2},reaction:{name,age:2.1,duration:4.2}
 }));
 for(const sample of snapshots){
  assert.ok(sample.active);
  assert.ok(sample.reaction>.4);
  assert.equal(Object.keys(sample.pose).filter(k=>/^Tail\.\d\d$/.test(k)).length,10);
  for(const key of ['Head','Neck','Chest','Ear.L','Ear.R','EarTip.L','EarTip.R'])
   assert.ok(Array.isArray(sample.pose[key])&&sample.pose[key].length===3,key);
  for(const values of Object.values(sample.pose))for(const angle of values)assert.ok(Number.isFinite(angle));
  for(const angle of Object.values(sample.stage))assert.ok(Number.isFinite(angle));
  assert.ok(Math.abs(sample.pose.Head[0])<MAX_ANGLES.head);
  for(const [bone,angles] of Object.entries(sample.pose))
   if(bone.startsWith('Tail.'))assert.ok(Math.abs(angles[2])<=MAX_ANGLES.tail);
 }
 assert.notDeepEqual(snapshots[0].pose.Head,snapshots[1].pose.Head);
 assert.notDeepEqual(snapshots[1].pose.Head,snapshots[2].pose.Head);
 assert.notDeepEqual(snapshots[2].pose.Head,snapshots[3].pose.Head);
});

test('V35 no pose after a finished story reaction',()=>{
 const life=createLivingPerformance({seed:319});
 const ongoing=life.sample({dt:.016,reaction:{name:'complete',age:2.2,duration:4.5}});
 assert.ok(ongoing.active);
 const finished=life.sample({dt:.016,reaction:{name:'complete',age:4.5,duration:4.5}});
 assert.equal(finished.reaction,0);
 assert.ok(Math.abs(finished.stage.y)<1e-7);
});

test('V35 authored gestures, physical sleep and reduced-motion preempt micros fully',()=>{
 const life=createLivingPerformance({seed:410});
 advance(life,6);
 const stopped=life.sample({dt:.016,gestureActive:true,
  reaction:{name:'complete',age:2,duration:4}});
 assert.equal(stopped.active,false);
 assert.deepEqual(stopped.pose,{});
 assert.deepEqual(stopped.stage,{x:0,y:0,rx:0,ry:0,rz:0,scale:0});
 assert.equal(life.snapshot().moveIntent,0);
 const sleeping=life.sample({dt:.016,mode:'sleep',phase:'hold'});
 assert.deepEqual(sleeping.pose,{});
 const reduced=life.sample({dt:.016,reducedMotion:true,attention:{x:1,y:1}});
 assert.equal(reduced.active,false);
});

test('V35 spontaneous gestures are quieter when visitors are reading',()=>{
 const reading=createLivingPerformance({seed:29}),normal=createLivingPerformance({seed:29});
 let readingMax=0,normalMax=0;
 for(let i=0;i<650;i++){
  const one=reading.sample({dt:1/60,reading:true});
  const two=normal.sample({dt:1/60,reading:false});
  readingMax=Math.max(readingMax,Math.abs(one.pose?.Head?.[2]||0));
  normalMax=Math.max(normalMax,Math.abs(two.pose?.Head?.[2]||0));
 }
 assert.ok(normalMax>.02);
 assert.ok(readingMax<normalMax*.4);
});

test('V35 input hardening keeps bounded bone and stage values',()=>{
 const life=createLivingPerformance({seed:3});
 for(const input of [
  {dt:NaN,vx:Infinity,vy:-Infinity,attention:{x:Infinity,y:NaN}},
  {dt:99999,vx:1e8,vy:1e8,reaction:{name:'complete',age:-Infinity,duration:-1}},
  {dt:-1,phase:null,attention:null,reaction:{name:'invalid',age:2}},
  {dt:0,attention:{x:-2,y:2},reaction:{name:'explore',age:3,duration:5}}
 ]){
  const p=life.sample(input);
  for(const values of Object.values(p.pose))for(const value of values)assert.ok(Number.isFinite(value));
  for(const value of Object.values(p.stage))assert.ok(Number.isFinite(value));
  assert.ok(Math.abs(p.pose.Head?.[0]||0)<=.16);
  assert.ok(Math.abs(p.pose.Head?.[1]||0)<=.19);
  assert.ok(Math.abs(p.pose.Head?.[2]||0)<=.15);
 }
});

test('V35 renderer applies reversible bone layer after original motion and respects depth',()=>{
 const code=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(code,/createLivingPerformance/);
 assert.match(code,/livingLayer=createGestureLayer\(bones,THREE\)/);
 assert.match(code,/livingLayer\.prepare\(\);gestureLayer\.prepare\(\)/);
 assert.match(code,/gestureLayer\.apply\(lastGesture\.pose\);\s*livingLayer\.apply\(lastLiving\.pose\)/);
 assert.match(code,/depthLayerPlacement\(visualSide,halfDepth\)/);
 assert.match(code,/lastRestPose\.rotationZ\+lastLiving\.stage\.rz/);
 assert.match(code,/preserveFullSkinning/);
});

test('V35 physical discoveries only originate from already acknowledged successful life actions',()=>{
 const code=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(code,/const acknowledged=autonomy\.complete\(\{success,reason,nowMs:now\}\)/);
 assert.match(code,/worldStories\.record\(\{family,success\}\)/);
 assert.match(code,/if\(livedBeat\)\{/);
 assert.match(code,/state\.lifeMoment=\{name:livedBeat\.complete\?'complete':livedBeat\.beat,at:now,duration:4\.5\}/);
 assert.match(code,/lifeMoment:state\.lifeMoment/);
 assert.match(code,/reading:Boolean\(performance\.now\(\)<interest\.readingUntil\)/);
});
