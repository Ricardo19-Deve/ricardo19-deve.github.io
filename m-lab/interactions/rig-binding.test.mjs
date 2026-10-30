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
 // Exact THREE r184 PropertyBinding.sanitizeNodeName on real V6 GLB names.
 const names=['CTRL_Global','Body','Chest','Neck','Head',
  'EarL','EarTipL','EarR','EarTipR','ArmL','ArmR',
  'ForearmL','ForearmR','LegL','LegR',
  ...Array.from({length:10},(_,i)=>'Tail'+String(i+1).padStart(2,'0'))];
 const objects=names.map(name=>({name,isBone:true,quaternion:new QuaternionMock(.1)}));
 const root={traverse:callback=>objects.forEach(callback)};
 return {root,objects,THREE:{Quaternion:QuaternionMock,Euler:EulerMock}};
}
test('normalize sanitized GLTFLoader names without renaming original bones',()=>{
 for(let i=1;i<=10;i++){
  const digits=String(i).padStart(2,'0');
  assert.equal(canonicalBoneName('Tail'+digits),'Tail.'+digits);
  assert.equal(canonicalBoneName('Tail_'+digits),'Tail.'+digits);
  assert.equal(canonicalBoneName('Tail.'+digits),'Tail.'+digits);
 }
 for(const [key,value] of [['EarL','Ear.L'],['Ear_L','Ear.L'],['EarTipR','EarTip.R'],['EarTip_R','EarTip.R'],
  ['ArmR','Arm.R'],['Arm_R','Arm.R'],['ForearmL','Forearm.L'],['Forearm_L','Forearm.L'],['HandR','Hand.R'],
  ['LegL','Leg.L'],['Leg_L','Leg.L'],['FootR','Foot.R'],['Head','Head']])
  assert.equal(canonicalBoneName(key),value);
});

test('all ten sanitized tail bones genuinely receive changing rotations',()=>{
 const m=model(),motion=createMotionV8(m.root,m.THREE);
 assert.equal(motion.tailDiagnostics.connected,10);
 assert.equal(motion.tailDiagnostics.mapped[0].loaded,'Tail01');
 assert.equal(motion.tailDiagnostics.mapped[9].loaded,'Tail10');
 for(let n=0;n<120;n++){
  motion.prepare();
  motion.update(1/60,{mode:'float',expression:'happy',
   energy:.85,tailEnergy:.85,tailReactivity:1.75,clipActive:false});
 }
 const base=m.objects.find(o=>o.name==='Tail01');
 const tip=m.objects.find(o=>o.name==='Tail10');
 assert.ok(motion.tailDiagnostics.maxBend>.003,'No real flex applied');
 assert.ok(Math.abs(base.quaternion.value-.1)>.001,'Tail root not animated');
 assert.ok(Math.abs(tip.quaternion.value-.1)>.001,'Tail tip not animated');
});

test('ArmL and EarR are also driven by emotional body poses',()=>{
 const m=model(),motion=createMotionV8(m.root,m.THREE);
 for(let n=0;n<100;n++){
  motion.prepare();motion.update(1/60,{mode:'float',expression:'surprised',
   energy:1,tailEnergy:0,tailReactivity:0,clipActive:false});
 }
 const arm=m.objects.find(o=>o.name==='ArmL'),ear=m.objects.find(o=>o.name==='EarR');
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
