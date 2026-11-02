import test from 'node:test';
import assert from 'node:assert/strict';
import {M_AFFECTS,AFFECT_DURATIONS,sampleAffect} from './m-world-affect.mjs';

test('five original-morph performances remain finite, bounded and distinct through a full cycle',()=>{
 const holds=[];
 for(const name of M_AFFECTS.filter(name=>name!=='neutral')){
  const duration=AFFECT_DURATIONS[name];
  assert.ok(duration>=4&&duration<=7);
  for(let i=0;i<=300;i++){
   const pose=sampleAffect({name,age:duration*i/300});
   const weights=Object.values(pose.weights),lids=Object.values(pose.eyelids);
   assert.ok(weights.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
   assert.ok(weights.reduce((a,b)=>a+b,0)<=1+1e-10);
   assert.ok(lids.every(v=>Number.isFinite(v)&&v>=0&&v<=.5));
  }
  const hold=sampleAffect({name,age:duration*.45});
  assert.equal(hold.phase,'hold');assert.equal(hold.envelope,1);
  holds.push(JSON.stringify([hold.weights,hold.eyelids]));
 }
 assert.equal(new Set(holds).size,5);
});

test('performances enter and leave the neutral face without position or velocity discontinuity',()=>{
 for(const name of M_AFFECTS){
  const duration=AFFECT_DURATIONS[name];
  for(const age of [-1,0,duration,duration+1]){
   const pose=sampleAffect({name,age});
   assert.deepEqual(pose.weights,{happy:0,curious:0,surprised:0});
   assert.deepEqual(pose.eyelids,{left:0,right:0});
  }
  if(!duration)continue;
  for(const age of [.0001,duration-.0001]){
   const pose=sampleAffect({name,age});
   assert.ok(Object.values(pose.weights).every(v=>v/.0001<.0001));
   assert.ok(Object.values(pose.eyelids).every(v=>v/.0001<.0001));
  }
 }
});

test('reduced motion, invalid inputs and zero intensity cannot activate the new face layer',()=>{
 for(const options of [{name:'focus',age:2,reducedMotion:true},{name:'sleepy',age:2,weight:0},
  {name:'delight',age:2,weight:NaN},{name:'not-an-affect',age:2},{name:'focus',age:NaN}]){
  const pose=sampleAffect(options);assert.equal(pose.envelope,0);
  assert.ok(Object.values(pose.weights).every(v=>v===0));
  assert.ok(Object.values(pose.eyelids).every(v=>v===0));
 }
 assert.equal(sampleAffect({name:'focus',age:2,weight:5}).envelope,1);
 const full=sampleAffect({name:'content',age:2}),half=sampleAffect({name:'content',age:2,weight:.5});
 for(const key of Object.keys(full.weights))assert.equal(half.weights[key],full.weights[key]*.5);
});

test('doubt uses quiet asymmetry and sleepy remains a curved partial HAT closure',()=>{
 const doubt=sampleAffect({name:'doubt',age:2}),sleepy=sampleAffect({name:'sleepy',age:3});
 assert.ok(doubt.eyelids.right>doubt.eyelids.left+.15);
 assert.ok(sleepy.eyelids.left>.4&&sleepy.eyelids.left<.5);
 assert.ok(sleepy.eyelids.right>.4&&sleepy.eyelids.right<.5);
 assert.ok(sleepy.weights.happy>0&&sleepy.weights.surprised===0);
});