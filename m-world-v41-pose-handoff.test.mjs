import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPoseHandoff,dampChannel} from './m-world-pose-handoff.mjs';

const step=1/60;
const run=(engine,n,pose)=>{let result;for(let i=0;i<n;i++)result=engine.sample(pose,step);return result;};
const value=(pose,bone='Head',axis=0)=>pose[bone]?.[axis]||0;

test('V41 critically damped handoff keeps both pose and velocity continuous at an abrupt mood switch',()=>{
 const engine=createPoseHandoff({halfLife:.17});
 const before=run(engine,50,{Head:[.28,-.11,.04]});
 const justBefore=value(before);
 const next=engine.sample({Head:[-.31,.18,-.09]},step);
 assert.ok(Math.abs(value(next)-justBefore)<.01,'the visible head cannot snap to the new mood');
 const later=run(engine,100,{Head:[-.31,.18,-.09]});
 assert.ok(Math.abs(value(later)+.31)<.006,'the new posture is eventually reached');
 assert.equal(engine.snapshot().channels,1,'one original head remains continuously animated');
});

test('V41 an autonomous layer suppressed by an authored gesture gently fades its LAST pose instead of resetting it',()=>{
 const engine=createPoseHandoff({halfLife:.16});
 const settled=run(engine,90,{Head:[.25,.13,-.08],'Tail.10':[0,0,.07]});
 const atCut=engine.sample({},step);
 assert.ok(value(atCut)>.20,'secondary layer is still visible at the first authored gesture frame');
 assert.ok(Math.abs(value(atCut)-value(settled))<.005);
 assert.ok((atCut['Tail.10']||[]).length===3,'the connected original tail does not jump to zero');
 const faded=run(engine,160,{});
 assert.deepEqual(faded,{},'after the gesture handoff the previous pose has fully faded');
 assert.equal(engine.snapshot().channels,0);
});

test('V41 3D stage can turn from happy to curious and then lie down without a reset',()=>{
 const engine=createPoseHandoff({halfLife:.25,limit:1.7});
 const happy=run(engine,75,{rotation:[0,.08,.10],placement:[0,.06,.02]});
 const curious=engine.sample({rotation:[-.04,.18,.12],placement:[.01,.02,0]},step);
 assert.ok(Math.abs(curious.rotation[1]-happy.rotation[1])<.005,'mode changes preserve stage rotation');
 assert.ok(Math.abs(curious.placement[1]-happy.placement[1])<.005,'mode changes preserve global Y');
 const rest=engine.sample({rotation:[.02,0,1.33],placement:[.018,-.11,-.22]},step);
 assert.ok(Math.abs(rest.rotation[2]-curious.rotation[2])<.01,'sleep begins at the current actual body angle');
 assert.ok(Math.abs(rest.placement[1]-curious.placement[1])<.01,'sleep never teleports down');
 const asleep=run(engine,125,{rotation:[.02,0,1.33],placement:[.018,-.11,-.22]});
 assert.ok(Math.abs(asleep.rotation[2]-1.33)<.005);
 assert.ok(Math.abs(asleep.placement[2]+.22)<.005);
 const wake=engine.sample({rotation:[0,0,0],placement:[0,0,0]},step);
 assert.ok(Math.abs(wake.rotation[2]-asleep.rotation[2])<.01,'waking begins exactly where resting ended');
});

test('V41 retains frame-rate stability without crossing unsafe pose limits',()=>{
 const samples=[];
 for(const hz of [30,60,120]){
  const engine=createPoseHandoff({halfLife:.12,limit:.9});
  let sample={};
  for(let i=0;i<hz;i++)sample=engine.sample({Head:[.35,-.15,.2]},1/hz);
  samples.push(sample.Head);
 }
 for(let i=1;i<samples.length;i++)
  for(let axis=0;axis<3;axis++)
   assert.ok(Math.abs(samples[0][axis]-samples[i][axis])<.002,'same real duration, same physical pose');
 const bounded=dampChannel(Infinity,NaN,900,1,.1);
 assert.ok(Number.isFinite(bounded.position)&&Number.isFinite(bounded.velocity));
 assert.ok(Math.abs(bounded.position)<=2);
});

test('V41 reduced-motion bypasses all residual momentum and remains immediate',()=>{
 const engine=createPoseHandoff();
 run(engine,60,{Head:[.3,0,0]});
 assert.deepEqual(engine.sample({},step,{immediate:true}),{});
 assert.equal(engine.snapshot().channels,0);
 const fresh=engine.sample({Head:[.4,0,0]},step);
 assert.ok(value(fresh)<.03,'no stale spring survives accessibility switch');
 assert.deepEqual(engine.sample({Head:[.1,0,0]},step,{immediate:true}),{Head:[.1,0,0]});
});

test('V41 does not mutate source poses or retain unknown user context',()=>{
 const engine=createPoseHandoff();
 const original={Head:[.2,0,.1]};
 engine.sample(original,step);assert.deepEqual(original,{Head:[.2,0,.1]});
 const code=readFileSync(new URL('m-world-pose-handoff.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|localStorage|sessionStorage|document\.|window\.|OpenAI|analytics/i);
});

test('V41 renderer filters all abrupt secondary-layer exits AND the final stage, preserving original V6 rig and exact stage limits',()=>{
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const world=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(renderer,/createPoseHandoff/);
 for(const name of ['living','contact','continuity','emotional'])
  assert.match(renderer,new RegExp('handoffs\\.'+name+'\\.sample\\(last'));
 assert.match(renderer,/stageHandoff\.sample\(\{/);
 assert.match(renderer,/stage\.rotation\.set\(\.\.\.rotation\)/);
 assert.match(renderer,/stage\.scale\.setScalar\(1\+placement\[2\]\)/);
 assert.match(renderer,/mixer\.update\(dt\)/);
 assert.match(renderer,/preserveFullSkinning/);
 assert.match(world,/m-world-3d\.mjs\?v=54/);
});
