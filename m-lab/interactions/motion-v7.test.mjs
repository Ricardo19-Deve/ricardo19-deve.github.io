import test from 'node:test';
import assert from 'node:assert/strict';
import {motionPose,createMotionV7} from './motion-v7.mjs';

test('idle motion involves head, arms, ears, legs and all ten tail bones',()=>{
 const pose=motionPose({time:2.1,mode:'float',energy:.9});
 for(const bone of ['Head','Chest','Ear.L','Ear.R','Arm.L','Arm.R','Leg.L','Leg.R'])
  assert.ok(pose[bone]?.some(v=>Math.abs(v)>1e-5),bone);
 for(let i=1;i<=10;i++)
  assert.ok(pose['Tail.'+String(i).padStart(2,'0')], 'tail '+i);
});

test('emotions produce different head, arm and ear poses',()=>{
 const happy=motionPose({time:2,expression:'happy',energy:1});
 const curious=motionPose({time:2,expression:'curious',energy:1});
 const surprised=motionPose({time:2,expression:'surprised',energy:1});
 assert.ok(Math.abs(happy.Head[0]-surprised.Head[0])>.05);
 assert.notDeepEqual(curious['Ear.L'],happy['Ear.L']);
 assert.notDeepEqual(surprised['Arm.R'],happy['Arm.R']);
});

test('energy control zero disables all secondary motion',()=>{
 const pose=motionPose({time:5,mode:'shy',energy:0,expression:'surprised'});
 for(const values of Object.values(pose))assert.deepEqual(values,[0,0,0]);
});

test('knock gesture is timed from mode activation',()=>{
 const before=motionPose({time:30,modeAge:.2,mode:'knock',energy:1});
 const strike=motionPose({time:30,modeAge:.75,mode:'knock',energy:1});
 assert.ok(Math.abs(strike['Arm.R'][0]-before['Arm.R'][0])>.08);
});

test('rest pose is restored before every idle procedural update',()=>{
 class Q {
  constructor(v=0){this.v=v}
  clone(){return new Q(this.v)}
  copy(q){this.v=q.v;return this}
  multiply(q){this.v+=q.v;return this}
  setFromEuler(e){this.v=e.a+e.b+e.c;return this}
 }
 class Euler{set(a,b,c){this.a=a;this.b=b;this.c=c}}
 const bone={isBone:true,name:'Head',quaternion:new Q(4)};
 const root={traverse:cb=>cb(bone)};
 const runtime=createMotionV7(root,{Quaternion:Q,Euler});
 runtime.update(.1,{energy:1,clipActive:false});
 const a=bone.quaternion.v;
 runtime.update(.1,{energy:1,clipActive:false});
 assert.ok(Math.abs(bone.quaternion.v-4)<.2);
 assert.ok(Math.abs(bone.quaternion.v-a)<.2);
});
