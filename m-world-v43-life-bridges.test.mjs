import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeBridges,lifeMode} from './m-world-life-bridges.mjs';

const advance=(engine,count,input={})=>{
 let out;for(let i=0;i<count;i++)out=engine.sample({dt:1/60,...input});return out;
};
const maxStep=(a,b,name='Head')=>Math.max(...(a.pose[name]||[0,0,0]).map((v,i)=>Math.abs(v-(b.pose[name]||[0,0,0])[i])));
test('V43 action groups match genuine original autonomy and authored gestures',()=>{
 for(const [mode,gesture,result]of [
  ['float',null,'explore'],['orbit',null,'explore'],['peek',null,'observe'],
  ['perch',null,'rest'],['float','sleep','rest'],['float','think','rest'],
  ['float','paw','play'],['float','hop','play'],['float','curious','observe']
 ])assert.equal(lifeMode(mode,gesture),result);
});
test('V43 head, torso and tail remain physically continuous through explore → observe → play → rest',()=>{
 const engine=createLifeBridges();
 let before=advance(engine,90,{mode:'float',vx:115,vy:25,turn:.65,attention:{x:.7,y:.2},emotion:'curious'});
 assert.equal(before.mode,'explore');
 for(const mode of ['peek','play','perch','float']){
  const step=engine.sample({dt:1/60,mode,vx:mode==='float'?80:0,vy:0,turn:-.75,attention:{x:-.8},emotion:mode==='play'?'delight':'neutral',characterEnergy:.82});
  assert.ok(maxStep(step,before)<.016,'head must not snap at '+mode);
  assert.ok(Math.abs(step.stage.rz-before.stage.rz)<.009,'body must not snap at '+mode);
  assert.ok(Math.abs(step.pose['Tail.10'][2]-before.pose['Tail.10'][2])<.013,'tail tip must carry inertia');
  before=advance(engine,30,{mode,turn:-.75,attention:{x:-.8}});
 }
 assert.ok(engine.snapshot().transitions>=4);
});
test('V43 the ten connected tail joints follow turning with delay, but never invent a new clip',()=>{
 const engine=createLifeBridges();
 advance(engine,60,{mode:'float',vx:140,turn:0});
 const first=advance(engine,4,{mode:'float',vx:140,turn:1,characterEnergy:1});
 const tail=Object.keys(first.pose).filter(k=>/^Tail\.\d\d$/.test(k));
 assert.equal(tail.length,10);
 assert.ok(tail.every(k=>first.pose[k].every(v=>Number.isFinite(v)&&Math.abs(v)<.04)));
 const tip=first.pose['Tail.10'][2],root=first.pose['Tail.01'][2];
 assert.ok(Math.abs(tip)>Math.abs(root),'the tip has a larger delayed follow-through than the root');
 const settled=advance(engine,160,{mode:'float',vx:0,turn:0});
 assert.ok(Math.abs(settled.pose['Tail.10'][2])<.02);
});
test('V43 sleep and card attachment respect the original physical safety owners',()=>{
 const engine=createLifeBridges();
 advance(engine,60,{mode:'play',vx:100,emotion:'joyful'});
 const sleeping=engine.sample({dt:1/60,mode:'rest',gesture:{name:'sleep'},reducedMotion:false});
 assert.deepEqual(sleeping.pose,{},'V32 authored sleeping owns the silhouette');
 const attached=advance(engine,100,{mode:'perch',attached:true,characterEnergy:.5});
 assert.equal(attached.stage.x,0,'no fabricated X movement on card attachment');
 assert.ok(Math.abs(attached.stage.y)<.008);
 for(const r of Object.values(attached.pose))for(const x of r)assert.ok(Number.isFinite(x));
 const reduced=engine.sample({dt:1/60,reducedMotion:true});
 assert.deepEqual(reduced.pose,{});assert.equal(reduced.mode,'quiet');
});
test('V43 deterministic local life is repeatable without network or personal data',()=>{
 const run=()=>{const e=createLifeBridges();return [advance(e,70,{mode:'orbit',vx:80,turn:.4}),advance(e,20,{mode:'peek',turn:-.3,emotion:'curious'}),e.snapshot()];};
 assert.deepEqual(run(),run());
});
test('V43 renderer composes original V6 action and emotion before final handoff',async()=>{
 const {readFileSync}=await import('node:fs');
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(renderer,/createLifeBridges/);
 assert.match(renderer,/secondaryTargets\[4\]\.pose=lastBridge\.pose/);
 assert.match(renderer,/secondaryTargets\[4\]\.weight=\.6/);
 assert.match(renderer,/secondaryPose\.sample\(\{dt,layers:secondaryTargets,reducedMotion:reduced\}\)/);
 assert.match(renderer,/secondaryLayer\.apply\(combinedSecondary\)/);
 assert.doesNotMatch(renderer,/lifeLayer|handoffs\.life/);
 assert.match(renderer,/lastBridge=lifeBridges\.sample\(\{dt,mode:activity/);
 assert.match(renderer,/stageHandoff\.sample/);
 assert.ok(renderer.indexOf('secondaryTargets[4].pose=lastBridge.pose')<renderer.indexOf('const combinedSecondary='));
 assert.ok(renderer.indexOf('secondaryLayer.apply(combinedSecondary)')<renderer.indexOf('const stagePose=stageHandoff.sample'));
});
