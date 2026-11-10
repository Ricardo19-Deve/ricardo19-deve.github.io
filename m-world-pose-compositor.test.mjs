import test from 'node:test';
import assert from 'node:assert/strict';
import {createSecondaryPoseCompositor,secondaryPoseLimit} from './m-world-pose-compositor.mjs';
const names=['Head','Neck','UpperArm.L','UpperArm.R','Tail.01','Tail.10'];
test('secondary poses share total joint budgets even when every source saturates',()=>{
 const mixer=createSecondaryPoseCompositor(names),source=Object.fromEntries(names.map(n=>[n,[.8,-.6,.7]]));
 for(let i=0;i<300;i++){
  const pose=mixer.sample({dt:1/60,layers:Array(7).fill({pose:source})});
  for(const name of names)assert.ok(Math.hypot(...pose[name])<=secondaryPoseLimit(name)+1e-12,name);
 }
 assert.ok(mixer.snapshot().limited>0);
});
test('mixing is independent of secondary layer order and ignores unknown bones',()=>{
 const a={Head:[.14,.02,0],'FabricatedEyeBone':[1,1,1]},b={Head:[0,.11,-.03]};
 const first=createSecondaryPoseCompositor(names),second=createSecondaryPoseCompositor(names);
 for(let i=0;i<100;i++)assert.deepEqual(first.sample({dt:1/60,layers:[{pose:a},{pose:b,weight:.6}]}),second.sample({dt:1/60,layers:[{pose:b,weight:.6},{pose:a}]}));
 assert.equal(Object.hasOwn(first.sample(), 'FabricatedEyeBone'),false);
});
test('a secondary handoff retains position and angular velocity instead of dropping to neutral',()=>{
 const mixer=createSecondaryPoseCompositor(names);
 for(let i=0;i<20;i++)mixer.sample({dt:1/60,layers:[{pose:{Head:[.2,0,0]}}]});
 const before=mixer.sample({dt:0}).Head[0],after=mixer.sample({dt:1/120,layers:[]}).Head[0];
 assert.ok(after>0&&Math.abs(after-before)<.012);
 for(let i=0;i<400;i++)mixer.sample({dt:1/60});
 assert.ok(Math.abs(mixer.sample().Head[0])<1e-6);
});
test('secondary sampling reuses output and reset immediately respects reduced motion',()=>{
 const mixer=createSecondaryPoseCompositor(names),out=mixer.sample(),head=out.Head;
 for(let i=0;i<100;i++)assert.equal(mixer.sample({dt:.02,layers:[{pose:{Head:[.2,0,0]}}]}),out);
 assert.equal(out.Head,head);mixer.sample({reducedMotion:true});
 for(const value of Object.values(out))assert.deepEqual(value,[0,0,0]);
});
test('analytic joint handoff remains consistent at30/60/120Hz and rejects nonfinite inputs',()=>{
 const results=[];
 for(const hz of [30,60,120]){
  const mixer=createSecondaryPoseCompositor(names);let out;
  for(let i=0;i<hz;i++)out=mixer.sample({dt:1/hz,layers:[{pose:{Head:[.2,.04,0]}}]});
  results.push([...out.Head]);
  out=mixer.sample({dt:NaN,layers:[{pose:{Head:[Infinity,NaN,-Infinity]}}]});assert.ok(out.Head.every(Number.isFinite));
 }
 for(let i=1;i<results.length;i++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(results[i][axis]-results[0][axis])<1e-8);
});
