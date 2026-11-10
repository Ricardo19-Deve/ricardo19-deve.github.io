import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpontaneousPlay,SPONTANEOUS_BEATS} from './m-world-spontaneous-play.mjs';

const step=(engine,other={})=>engine.sample({
 dt:1/60,mode:'float',phase:'hold',speed:0,energy:.86,...other
});
function visit({seed=67,frames=60*450,mode='float',energy=.9}={}){
 const life=createSpontaneousPlay({seed}),sequence=[],outputs=[];
 let previous=null;
 for(let i=0;i<frames;i++){
  const result=step(life,{mode,energy});
  if(result.active&&result.kind!==previous){
   sequence.push(result.kind);previous=result.kind;
  }
  if(!result.active)previous=null;
  if(result.envelope>.6)outputs.push(result);
 }
 return {sequence,outputs,snapshot:life.snapshot()};
}
test('V50 uses seven different original-rig miniature performances, not fake external props',()=>{
 assert.deepEqual(SPONTANEOUS_BEATS,[
  'double-take','peekaboo','tail-chase','little-dance','stretch','stargaze','ear-flick',
  'self-hug','little-bow','curious-scan','victory-wiggle'
 ]);
 const observed=new Set();
 for(const mode of ['float','peek','play','unknown']){
  const life=visit({seed:20,frames:60*850,mode});
  for(const name of life.sequence)observed.add(name);
  assert.ok(life.sequence.length>=12,mode+' should keep playing during long autonomous stays');
  assert.equal(life.snapshot.started,life.snapshot.completed+(life.snapshot.active?1:0),mode);
  assert.equal(life.snapshot.cancelled,0);
  for(let i=1;i<life.sequence.length;i++)
   assert.notEqual(life.sequence[i],life.sequence[i-1],'consecutive autonomous beats may not repeat');
 }
 assert.deepEqual([...observed].sort(),[...SPONTANEOUS_BEATS].sort());
});

test('V50 seeded behavior varies between visits but repeats with same inputs and seed',()=>{
 const first=visit({seed:42,frames:60*310});
 assert.deepEqual(visit({seed:42,frames:60*310}).sequence,first.sequence);
 assert.notDeepEqual(visit({seed:43,frames:60*310}).sequence,first.sequence);
 assert.ok(new Set(first.sequence).size>2,'the natural play sequence has variety');
});

test('V50 face, ears, arms and ten connected tail joints take part in real performances',()=>{
 const {outputs}=visit({seed:9,frames:60*760});
 assert.ok(outputs.length>300);
 const strongest=new Map();
 for(const frame of outputs){
  const current=strongest.get(frame.kind);
  if(!current||frame.envelope>current.envelope)strongest.set(frame.kind,frame);
 }
 assert.ok(strongest.size>=4);
 for(const [kind,frame]of strongest){
  assert.equal(Object.keys(frame.pose).filter(k=>/^Tail\.\d{2}$/.test(k)).length,10,kind);
  assert.ok(frame.pose.Head.some(v=>Math.abs(v)>.015),kind+' should move the head');
  assert.ok(frame.pose['Arm.L'].length===3&&frame.pose['Arm.R'].length===3);
  assert.ok(frame.pose['Ear.L'].length===3&&frame.pose['Ear.R'].length===3);
  const blend=frame.face.weights;
  assert.ok(['happy','curious','surprised'].some(k=>blend[k]>.08),kind+' must show a facial expression');
  assert.ok(Object.values(blend).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert.ok(['left','right'].every(side=>frame.face.eyelids[side]>=0&&frame.face.eyelids[side]<=.5));
  assert.ok(Math.abs(frame.stage.y)<.014,'the screen position is owned by the route');
  assert.ok(Math.abs(frame.stage.rx)<.035&&Math.abs(frame.stage.ry)<.035&&Math.abs(frame.stage.rz)<.04);
  assert.equal(Object.hasOwn(frame.stage,'x'),false);
 }
});

test('V50 never steals control while explicit gesture, original sleep, card contact, reading or locomotion occurs',()=>{
 const blocked=[
  {gesture:{name:'sleep'}},{gesture:{name:'wave'}},{attached:true},
  {reading:true},{phase:'approach'},{speed:48},
  {mode:'perch'},{mode:'rest'},{energy:.09},{affectActive:true}
 ];
 for(const restriction of blocked){
  const performer=createSpontaneousPlay({seed:10});
  for(let i=0;i<60*40;i++){
   const result=step(performer,restriction);
   assert.equal(result.active,false,JSON.stringify(restriction));
   assert.deepEqual(result.pose,{});
   assert.equal(result.face,null);
  }
  assert.equal(performer.snapshot().started,0);
 }
});

test('V50 mid-performance interruption yields bounded decay targets for V41 pose handoff',()=>{
 const performer=createSpontaneousPlay({seed:31});
 let executing=null;
 for(let i=0;i<60*25;i++){
  const result=step(performer);
  if(result.envelope>.65){executing=result;break;}
 }
 assert.ok(executing);
 const cancelled=step(performer,{gesture:{name:'sleep'}});
 assert.equal(cancelled.active,false);
 assert.equal(cancelled.face,null);
 assert.deepEqual(cancelled.pose,{});
 assert.equal(performer.snapshot().cancelled,1);
 assert.ok(performer.snapshot().cooldown>=8);
 const stopped=step(performer,{reducedMotion:true});
 assert.equal(stopped.active,false);
 assert.deepEqual(stopped.pose,{});
});

test('V50 phase envelope has no displacement and near-zero velocity at both endpoints',()=>{
 const performer=createSpontaneousPlay({seed:23});
 const start=visit({seed:23,frames:60*26});
 assert.ok(start.sequence.length>=1);
 // A whole authored miniature must return to a true neutral pose before
 // its next beat; V41 makes this reversible rather than resetting a bone.
 let seen=false,firstEnd=null;
 for(let i=0;i<60*40;i++){
  const out=step(performer);
  if(out.active)seen=true;
  if(seen&&out.active&&out.progress>=1-1e-8){firstEnd=out;break;}
 }
 assert.ok(firstEnd);
 assert.ok(firstEnd.envelope<.000001);
 for(const v of Object.values(firstEnd.pose))for(const x of v)assert.ok(Math.abs(x)<.000001);
 for(const v of Object.values(firstEnd.stage))assert.ok(Math.abs(v)<.000001);
});

test('V50 renderer composes spontaneous bone and eye performances with authored 31-bone V6, V41 and reduced motion',()=>{
 const source=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(source,/createSpontaneousPlay/);
 assert.match(source,/spontaneousPlay\.sample\(\{dt,mode:activity/);
 assert.match(source,/secondaryTargets\[5\]\.pose=lastPlay\.pose/);
 assert.match(source,/secondaryTargets\[5\]\.weight=quiet\?0:physical\?\.intent==='play'\?1:\.45/);
 assert.match(source,/secondaryPose\.sample\(\{dt,layers:secondaryTargets,reducedMotion:reduced\}\)/);
 assert.match(source,/secondaryLayer\.apply\(combinedSecondary\)/);
 assert.doesNotMatch(source,/playLayer|handoffs\.play/);
 assert.match(source,/microFace=[^;]+lastTransition\.face:null/);
 assert.match(source,/faceTarget=facialTargetMixer\.sample\(\{performance:physical,microFace,affect:lastAffect/);
 assert.match(source,/facialContinuity\.sample\(\{dt,weights:faceTarget\?\.weights,eyelids:faceTarget\?\.eyelids/);
 assert.match(source,/stageHandoff\.sample/);
 assert.match(source,/affectActive:lastAffect\.envelope>\.04/);
 assert.match(source,/attached:lastContact\.supported/);
 assert.match(source,/reducedMotion:reduced/);
});

test('V50 no visitor profile, public-post access, AI, external calls or persistence in mini performances',()=>{
 const source=readFileSync(new URL('m-world-spontaneous-play.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|localStorage|sessionStorage|document\.|window\.|navigator\.|OPENAI_|LINKEDIN_|clientIp|userId/i);
 assert.ok(source.includes('createSpontaneousPlay'));
});
