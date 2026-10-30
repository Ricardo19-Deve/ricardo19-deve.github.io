import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionV8,canonicalBoneName} from './motion-v8.mjs';

class QuaternionMock {
 constructor(value=0){this.value=value;}
 clone(){return new QuaternionMock(this.value);}
 copy(q){this.value=q.value;return this;}
 identity(){this.value=0;return this;}
 invert(){this.value=-this.value;return this;}
 multiply(q){this.value+=q.value;return this;}
 setFromEuler(e){this.value=e.x+e.y+e.z;return this;}
}
class EulerMock {
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
function model(){
 // This is how Three.js GLTFLoader sanitizes names from the V6 GLB.
 const names=['CTRL_Global','Body','Chest','Neck','Head',
  'Ear_L','EarTip_L','Ear_R','EarTip_R','Arm_L','Arm_R',
  'Forearm_L','Forearm_R','Leg_L','Leg_R',
  ...Array.from({length:10},(_,i)=>'Tail_'+String(i+1).padStart(2,'0'))];
 const objects=names.map(name=>({name,isBone:true,quaternion:new QuaternionMock(.1)}));
 const root={traverse:callback=>objects.forEach(callback)};
 return {root,objects,THREE:{Quaternion:QuaternionMock,Euler:EulerMock}};
}
test('normalize sanitized GLTFLoader names without renaming original bones',()=>{
 for(let i=1;i<=10;i++){
  const digits=String(i).padStart(2,'0');
  assert.equal(canonicalBoneName('Tail_'+digits),'Tail.'+digits);
  assert.equal(canonicalBoneName('Tail.'+digits),'Tail.'+digits);
 }
 for(const [key,value] of [['Ear_L','Ear.L'],['EarTip_R','EarTip.R'],
  ['Arm_R','Arm.R'],['Forearm_L','Forearm.L'],['Hand_R','Hand.R'],
  ['Leg_L','Leg.L'],['Foot_R','Foot.R'],['Head','Head']])
  assert.equal(canonicalBoneName(key),value);
});

test('all ten sanitized tail bones genuinely receive changing rotations',()=>{
 const m=model(),motion=createMotionV8(m.root,m.THREE);
 assert.equal(motion.tailDiagnostics.connected,10);
 assert.equal(motion.tailDiagnostics.mapped[0].loaded,'Tail_01');
 assert.equal(motion.tailDiagnostics.mapped[9].loaded,'Tail_10');
 for(let n=0;n<120;n++){
  motion.prepare();
  motion.update(1/60,{mode:'float',expression:'happy',
   energy:.85,tailEnergy:.85,tailReactivity:1.75,clipActive:false});
 }
 const base=m.objects.find(o=>o.name==='Tail_01');
 const tip=m.objects.find(o=>o.name==='Tail_10');
 assert.ok(motion.tailDiagnostics.maxBend>.003,'No real flex applied');
 assert.ok(Math.abs(base.quaternion.value-.1)>.001,'Tail root not animated');
 assert.ok(Math.abs(tip.quaternion.value-.1)>.001,'Tail tip not animated');
});

test('Arm_L and Ear_R are also driven by emotional body poses',()=>{
 const m=model(),motion=createMotionV8(m.root,m.THREE);
 for(let n=0;n<100;n++){
  motion.prepare();motion.update(1/60,{mode:'float',expression:'surprised',
   energy:1,tailEnergy:0,tailReactivity:0,clipActive:false});
 }
 const arm=m.objects.find(o=>o.name==='Arm_L'),ear=m.objects.find(o=>o.name==='Ear_R');
 assert.ok(Math.abs(arm.quaternion.value-.1)>.01,'Arm alias still broken');
 assert.ok(Math.abs(ear.quaternion.value-.1)>.01,'Ear alias still broken');
});

test('original Three.js bone names are preserved for animation mixer and rig',()=>{
 const m=model(),names=m.objects.map(o=>o.name);
 const motion=createMotionV8(m.root,m.THREE);
 motion.update(1/60,{expression:'curious'});
 assert.deepEqual(m.objects.map(o=>o.name),names);
});

test('procedural alias motions remain reversible and do not accumulate',()=>{
 const m=model(),motion=createMotionV8(m.root,m.THREE);
 for(let n=0;n<240;n++){
  motion.prepare();
  for(const bone of m.objects)bone.quaternion.value=.1;
  motion.update(1/60,{mode:'swim',expression:'happy',energy:.85,clipActive:true});
 }
 motion.prepare();
 for(const bone of m.objects)assert.ok(Math.abs(bone.quaternion.value-.1)<1e-7,bone.name);
});

test('diagnostic is zero when there are no matching tail bones',()=>{
 const m=model();
 const onlyHead={traverse:callback=>callback(m.objects.find(o=>o.name==='Head'))};
 const motion=createMotionV8(onlyHead,m.THREE);
 assert.equal(motion.tailDiagnostics.connected,0);
});
