import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceBodyPoseV15,performanceStagePoseV15} from './performance-v15.mjs';
import {tailPoseV15} from './tail-v15.mjs';
import {tailPoseV14} from './tail-v14.mjs';
import {motionPose} from './motion-v8.mjs';
const dist=(a,b)=>Object.keys(a).reduce((sum,name)=>
 sum+(a[name]||[]).reduce((s,v,i)=>s+Math.abs(v-(b[name]?.[i]||0)),0),0);
const stageDiff=(a,b)=>Object.keys(a).reduce((s,k)=>s+Math.abs(a[k]-b[k]),0);

test('character acting changes head, arms and ears with each emotion',()=>{
 const cfg={time:2,impact:1.2,emotionAge:.28};
 const neutral=performanceBodyPoseV15({...cfg,expression:'neutral'});
 const happy=performanceBodyPoseV15({...cfg,expression:'happy'});
 const curious=performanceBodyPoseV15({...cfg,expression:'curious'});
 const surprised=performanceBodyPoseV15({...cfg,expression:'surprised'});
 for(const [name,pose] of Object.entries({happy,curious,surprised})){
  assert.ok(dist(neutral,pose)>.4,name+' pose too subtle');
  assert.ok(pose.Head?.some(x=>Math.abs(x)>.07));
  assert.ok(pose['Arm.L']?.some(x=>Math.abs(x)>.07));
  assert.ok(pose['Ear.R']?.some(x=>Math.abs(x)>.06));
 }
 assert.ok(dist(happy,curious)>.6);
 assert.ok(dist(curious,surprised)>.6);
});

test('full-body stage modes are distinct and survive during animation',()=>{
 const cfg={time:2.1,impact:1.2,emotionAge:.5};
 const n=performanceStagePoseV15({...cfg,expression:'neutral'});
 for(const mood of ['happy','curious','surprised']){
  const pose=performanceStagePoseV15({...cfg,expression:mood});
  assert.ok(stageDiff(n,pose)>.08,mood);
 }
 const swim=performanceStagePoseV15({...cfg,mode:'swim',expression:'happy'});
 const happy=performanceStagePoseV15({...cfg,expression:'happy'});
 assert.ok(stageDiff(swim,happy)>.04);
});

test('0 percent performance disables new acting, reduced-motion preserves accessibility',()=>{
 const cfg={time:2,mode:'swim',expression:'surprised',emotionAge:.3};
 const off=performanceStagePoseV15({...cfg,impact:0});
 Object.values(off).forEach(v=>assert.equal(v,0));
 const body=performanceBodyPoseV15({...cfg,impact:0});
 for(const xyz of Object.values(body))xyz.forEach(v=>assert.equal(v,0));
 const full=performanceStagePoseV15({...cfg,impact:1.2});
 const reduced=performanceStagePoseV15({...cfg,impact:1.2,reducedMotion:true});
 assert.ok(stageDiff(full,off)>stageDiff(reduced,off)*3);
});

test('V15 dramatic tail is visibly different from unchanged V14 baseline',()=>{
 const cfg={time:2.3,emotionAge:.34,amount:.85,reactivity:1.75,flow:.73};
 for(const expression of ['happy','curious','surprised']){
  const v14=tailPoseV14({...cfg,expression});
  const v15=tailPoseV15({...cfg,expression,performance:1.2});
  assert.ok(dist(v14,v15)>.18,expression+' tail not distinct');
  const disabled=tailPoseV15({...cfg,expression,performance:0});
  assert.deepEqual(disabled,v14);
 }
});

test('V15 traveling-wave tail stays bounded and smooth at 30/60 FPS',()=>{
 const names=Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'));
 for(const fps of [30,60]){
  let maxStep=0;
  for(let frame=30;frame<fps*5;frame++){
   const cfg={expression:'happy',amount:.85,reactivity:1.75,
     performance:1.2,flow:.73};
   const a=tailPoseV15({...cfg,time:frame/fps,emotionAge:10});
   const b=tailPoseV15({...cfg,time:(frame+1)/fps,emotionAge:10});
   assert.deepEqual(Object.keys(a),names);
   for(const name of names)for(let i=0;i<3;i++){
    assert.ok(Number.isFinite(a[name][i]));
    assert.ok(Math.abs(a[name][i])<.331);
    maxStep=Math.max(maxStep,Math.abs(a[name][i]-b[name][i]));
   }
  }
  assert.ok(maxStep<.04,'unacceptable frame jump: '+fps+'fps '+maxStep);
 }
});

test('expressivity slider changes final motion targets, not only UI labels',()=>{
 const base=motionPose({time:2,mode:'float',expression:'happy',emotionAge:.35,
  performanceImpact:0,energy:.85,tailReactivity:1.75});
 const acting=motionPose({time:2,mode:'float',expression:'happy',emotionAge:.35,
  performanceImpact:1.2,energy:.85,tailReactivity:1.75});
 assert.ok(Math.abs(base.Head[0]-acting.Head[0])>.06);
 assert.ok(Math.abs(base['Tail.01'][0]-acting['Tail.01'][0])>.03);
});

test('no performance-induced motion when master energy or both tail controls are zero',()=>{
 const body=motionPose({time:2,energy:0,performanceImpact:1.5,
  expression:'happy',tailEnergy:1.5,tailReactivity:2});
 for(const xyz of Object.values(body))xyz.forEach(v=>assert.equal(v,0));
 const tail=tailPoseV15({time:2,amount:0,reactivity:0,
  expression:'surprised',performance:1.5});
 for(const xyz of Object.values(tail))assert.deepEqual(xyz,[0,0,0]);
});
