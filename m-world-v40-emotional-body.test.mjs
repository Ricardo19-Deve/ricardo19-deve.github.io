import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EMOTIONAL_STATES,createEmotionalBody} from './m-world-emotional-body.mjs';

const zeroStage={x:0,y:0,rx:0,ry:0,rz:0,scale:0};
const run=(actor,frames,props={})=>{
 let frame;
 for(let i=0;i<frames;i++)frame=actor.sample({dt:1/60,...props});
 return frame;
};
const face=(name,envelope=.75)=>({name,envelope,phase:'hold'});
test('V40 neutral M never becomes an endlessly animated emotional loop',()=>{
 const e=createEmotionalBody({seed:33});
 for(let i=0;i<500;i++){
  const f=e.sample({dt:1/60,emotion:'neutral',affect:{name:null,envelope:0}});
  assert.equal(f.active,false);
  assert.deepEqual(f.pose,{});
  assert.deepEqual(f.stage,zeroStage);
 }
 assert.equal(e.snapshot().transitions,0);
});

test('V40 the original 31-bone character expresses diverse moods with head, ears and ten-tail chain',()=>{
 const channels=[];
 for(const name of ['curious','doubt','delight','sleepy','proud','anticipation','pondering']){
  const e=createEmotionalBody({seed:9});
  const f=run(e,70,{affect:face(name)});
  assert.equal(f.active,true,name);
  assert.equal(f.mood,name);
  assert.ok(f.intensity>.05);
  for(const bone of ['Head','Neck','Chest','Body','Arm.L','Arm.R','Forearm.L','Forearm.R','Ear.L','Ear.R','EarTip.L','EarTip.R'])
   assert.ok(Array.isArray(f.pose[bone])&&f.pose[bone].length===3,bone);
  assert.equal(Object.keys(f.pose).filter(k=>/^Tail\.\d\d$/.test(k)).length,10);
  for(const vals of Object.values(f.pose))for(const v of vals)
   assert.ok(Number.isFinite(v)&&Math.abs(v)<.1,'all V6 bone offsets conservatively bounded');
  for(const v of Object.values(f.stage))assert.ok(Number.isFinite(v)&&Math.abs(v)<=.016);
  assert.equal(f.stage.x,0);
  channels.push(f.pose.Head);
 }
 assert.notDeepEqual(channels[0],channels[1]);
 assert.notDeepEqual(channels[1],channels[2]);
 assert.notDeepEqual(channels[2],channels[3]);
 assert.ok(EMOTIONAL_STATES.includes('dozing'));
});

test('V40 emotional body eases into feelings instead of snapping to fixed expressive poses',()=>{
 const e=createEmotionalBody({seed:19});
 const states=[];
 for(let i=0;i<80;i++){
  const f=e.sample({dt:1/60,affect:face('delight',.9)});
  states.push(f);
 }
 assert.ok(states[0].intensity<states[15].intensity);
 assert.ok(states[15].intensity<states[70].intensity);
 const maxJump=Math.max(...states.slice(1).map((f,i)=>Math.abs(f.pose.Head[0]-states[i].pose.Head[0])));
 assert.ok(maxJump<.012,'no head rotation pop');
 const before=states.at(-1).pose.Head[0];
 const redirected=e.sample({dt:1/60,affect:face('doubt',.8)});
 assert.ok(Math.abs(redirected.pose.Head[0]-before)<.012,'emotion changes smoothly');
 const final=run(e,220,{emotion:'neutral',affect:face('neutral',0)});
 assert.equal(final.mood,'neutral');
 assert.equal(final.active,false);
 assert.deepEqual(final.pose,{});
});

test('V40 low energy restrains excitement and expresses tiredness naturally',()=>{
 const high=createEmotionalBody({seed:42}),low=createEmotionalBody({seed:42});
 const cheerful=run(high,75,{affect:face('joyful',.8),energy:.95});
 const tired=run(low,75,{affect:face('joyful',.8),energy:.1});
 assert.ok(Math.abs(cheerful.pose.Head[0])>Math.abs(tired.pose.Head[0])*1.5);
 const rest=createEmotionalBody({seed:42});
 const sleepiness=run(rest,75,{affect:face('sleepy',.8),energy:.1});
 assert.ok(sleepiness.pose.Head[0]>0,'tired M lowers her head');
 assert.ok(sleepiness.pose['Arm.L'][0]>0,'body folds arms slightly');
});

test('V40 a visitor reading has reduced emotional motion',()=>{
 const loud=createEmotionalBody({seed:13}),quiet=createEmotionalBody({seed:13});
 const a=run(loud,90,{affect:face('delight',.8),reading:false});
 const b=run(quiet,90,{affect:face('delight',.8),reading:true});
 assert.ok(a.intensity>b.intensity*2);
 assert.ok(Math.abs(a.pose.Head[0])>Math.abs(b.pose.Head[0])*2);
});

test('V40 optional affects do not override the explicit authored gestures, V32 sleep, V38 card-contact or motion accessibility',()=>{
 for(const suppression of [
  {gestureActive:true},
  {sleeping:true},
  {supported:true},
  {reducedMotion:true}
 ]){
  const e=createEmotionalBody();
  run(e,70,{affect:face('delight'),energy:1});
  const f=e.sample({dt:1/60,affect:face('delight'),...suppression});
  assert.equal(f.active,false);
  assert.deepEqual(f.pose,{});
  assert.deepEqual(f.stage,zeroStage);
  assert.equal(e.snapshot().mood,'neutral');
  assert.equal(e.snapshot().active,false);
 }
});

test('V40 emotional body never needs visitor identity, the network or additional AI inference',()=>{
 const code=readFileSync(new URL('m-world-emotional-body.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|localStorage|sessionStorage|document\.|window\.|Authorization|OPENAI_API_KEY|analytics/i);
 assert.ok(code.length<13000);
});

test('V40 different original-rig expressions are asymmetric but remain repeatable in tests',()=>{
 const left=createEmotionalBody({seed:2}),right=createEmotionalBody({seed:3});
 const a=run(left,90,{affect:face('curious',.7)});
 const b=run(right,90,{affect:face('curious',.7)});
 assert.ok(a.pose.Head[1]*b.pose.Head[1]<0,'curious M can look in either natural direction');
 assert.ok(a.pose['Tail.10'][2]*b.pose['Tail.10'][2]<0,'original tail follows the selected inclination');
 assert.deepEqual(run(createEmotionalBody({seed:2}),90,{affect:face('curious',.7)}).pose,a.pose);
});

test('V40 renderer composes the emotional bone layer reversibly without changing original real position or facial morph owner',()=>{
 const code=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(code,/createEmotionalBody/);
 assert.match(code,/emotionalLayer=createGestureLayer\(bones,THREE\)/);
 assert.match(code,/emotionalLayer\.prepare\(\);continuityLayer\.prepare\(\)/);
 assert.match(code,/continuityLayer\.apply\(lastContinuity\.pose\);\s*emotionalLayer\.apply\(lastEmotional\.pose\)/);
 assert.match(code,/lastEmotional=emotionalBody\.sample\(\{dt,affect:lastAffect,emotion:state\.emotion/);
 assert.match(code,/supported:lastContact\.supported/);
 assert.match(code,/stage\.position\.x=num\([^;]+lastEmotional\.stage\.x/);
 assert.match(code,/preserveFullSkinning/);
 assert.match(code,/motion\.update\(dt,\{mode,expression/);
 assert.match(code,/facial\.setExpressionBlend\(fade\?\.weights\|\|null\)/);
 assert.match(code,/emotionalBody:\{\.\.\.emotionalBody\.snapshot\(\)/);
});

test('V40 invalid data never creates unsafe rotation values',()=>{
 const e=createEmotionalBody({seed:NaN});
 for(const v of [NaN,Infinity,-Infinity,0,1e9]){
  const f=e.sample({dt:v,affect:{name:'doubt',envelope:v},emotion:'bad',energy:v});
  for(const values of Object.values(f.pose))for(const x of values)assert.ok(Number.isFinite(x));
  for(const x of Object.values(f.stage))assert.ok(Number.isFinite(x));
 }
});
