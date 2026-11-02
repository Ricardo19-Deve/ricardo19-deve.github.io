import test from 'node:test';
import assert from 'node:assert/strict';
import {M_GESTURES,GESTURE_DURATIONS,GESTURE_PHASES,sampleGesture,createGestureLayer} from './m-world-acting.mjs';
import {sampleLocomotionPose} from './m-world-locomotion.mjs';
import {createMotionV8,canonicalBoneName} from './m-lab/interactions/motion-v8.mjs';
const magnitude=pose=>Math.hypot(...Object.values(pose).flat());
const difference=(a,b)=>Math.max(0,...new Set([...Object.keys(a),...Object.keys(b)]).values().map(name=>Math.hypot(...[0,1,2].map(i=>(a[name]?.[i]||0)-(b[name]?.[i]||0)))));
const close=(a,b,epsilon=1e-10)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('seven named original-rig gestures have declared bounded durations and phases',()=>{
 assert.deepEqual(M_GESTURES,['wave','curious','surprised','shy','playful','wink','nod']);
 assert.ok(Object.isFrozen(M_GESTURES)&&Object.isFrozen(GESTURE_DURATIONS));
 for(const name of M_GESTURES){assert.ok(GESTURE_DURATIONS[name]>1.5&&GESTURE_DURATIONS[name]<4);assert.ok(Object.isFrozen(GESTURE_PHASES[name]));assert.ok(0<GESTURE_PHASES[name][0]&&GESTURE_PHASES[name][0]<GESTURE_PHASES[name][1]&&GESTURE_PHASES[name][1]<1);}
 for(const name of ['dance','__proto__',undefined])assert.deepEqual(sampleGesture({name,age:1}).pose,{});
});
test('gesture endpoints and invalid/reduced inputs have no additive motion',()=>{
 for(const name of M_GESTURES){
  const duration=GESTURE_DURATIONS[name];
  for(const age of [-10,0,duration,duration+3,NaN,Infinity,-Infinity,'1']){
   const result=sampleGesture({name,age});
   assert.deepEqual(result.pose,{});assert.equal(result.envelope,0);assert.equal(result.expression,'neutral');
  }
  const reduced=sampleGesture({name,age:duration*.4,reducedMotion:true});
  assert.deepEqual(reduced.pose,{});assert.equal(reduced.envelope,0);
  // Quintic attack/release avoids an impulse when a sequence starts or ends.
  assert.ok(magnitude(sampleGesture({name,age:.0001}).pose)/.0001<.001);
  assert.ok(magnitude(sampleGesture({name,age:duration-.0001}).pose)/.0001<.001);
 }
});
test('every gesture has distinct anticipation, action and recovery with continuous bounded canonical rotations',()=>{
 const allowed=new Set(['Body','Chest','Neck','Head','Arm.L','Arm.R','Forearm.L','Forearm.R','Hand.L','Hand.R','Ear.L','Ear.R','EarTip.L','EarTip.R',...Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'))]);
 for(const name of M_GESTURES)for(const side of [-1,1]){
  const duration=GESTURE_DURATIONS[name],phases=new Set();let previous={},peak=0;
  for(let frame=0;frame<=Math.ceil(duration*240);frame++){
   const result=sampleGesture({name,side,age:Math.min(duration,frame/240)});
   if(result.envelope>0)phases.add(result.phase);
   assert.ok(Number.isFinite(result.envelope)&&result.envelope>=0&&result.envelope<=1);
   for(const [bone,angles]of Object.entries(result.pose)){
    assert.ok(allowed.has(bone)&&canonicalBoneName(bone)===bone,bone);
    assert.equal(angles.length,3);assert.ok(angles.every(a=>Number.isFinite(a)&&Math.abs(a)<=.9));
    if(bone.startsWith('Arm.'))assert.ok(Math.hypot(...angles)<.25,`${name} shoulder ${angles}`);
   }
   assert.ok(difference(result.pose,previous)<.065,`${name} discontinuity at ${frame/240}`);
   peak=Math.max(peak,magnitude(result.pose));previous=result.pose;
  }
  assert.deepEqual([...phases],['anticipation','action','recovery']);
  assert.ok(peak>.35,`${name} lacks a readable action`);
  const anticipation=sampleGesture({name,side,age:duration*.09}).pose;
  const action=sampleGesture({name,side,age:duration*.40}).pose;
  const recovery=sampleGesture({name,side,age:duration*.91}).pose;
  assert.ok(difference(anticipation,action)>.08);
  assert.ok(difference(action,recovery)>.08);
 }
});
test('wave changes the leading forearm and wrist with delayed oscillations, rather than swimming both shoulders',()=>{
 const duration=GESTURE_DURATIONS.wave;
 for(const [side,lead,other]of [[1,'L','R'],[-1,'R','L']]){
  const frames=Array.from({length:101},(_,i)=>sampleGesture({name:'wave',side,age:duration*(.30+.35*i/100)}).pose);
  const wrists=frames.map(p=>p['Hand.'+lead][2]);
  assert.ok(Math.min(...wrists)<-.15&&Math.max(...wrists)>.15);
  assert.ok(frames.some(p=>Math.abs(p['Forearm.'+lead][2])>.55));
  assert.ok(frames.every(p=>!p['Forearm.'+other]&&!p['Hand.'+other]));
  const mid=frames[50];assert.ok(Math.hypot(...mid['Arm.'+lead])<Math.hypot(...mid['Forearm.'+lead]));
  const early=sampleGesture({name:'wave',side,age:duration*.17}).pose;
  assert.ok(Math.abs(early['Arm.'+lead][2])>Math.abs(early['Hand.'+lead][2]));
 }
});
test('curiosity changes its gaze during inspection and shyness includes a later peek',()=>{
 const curious=age=>sampleGesture({name:'curious',age:age*GESTURE_DURATIONS.curious}).pose;
 assert.ok(Math.abs(curious(.4).Head[1]-curious(.58).Head[1])>.075);
 const shy=age=>sampleGesture({name:'shy',age:age*GESTURE_DURATIONS.shy}).pose;
 assert.ok(shy(.4).Head[0]>shy(.59).Head[0]+.03);
 assert.ok(Math.abs(shy(.59).Head[1])>.04);
});

class Euler{
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
}
class Quaternion{
 constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}
 clone(){return new Quaternion(this.x,this.y,this.z,this.w);}
 copy(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this;}
 identity(){return this.copy(new Quaternion());}
 invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this;}
 multiply(q){
  const {x,y,z,w}=this;
  this.x=w*q.x+x*q.w+y*q.z-z*q.y;this.y=w*q.y-x*q.z+y*q.w+z*q.x;
  this.z=w*q.z+x*q.y-y*q.x+z*q.w;this.w=w*q.w-x*q.x-y*q.y-z*q.z;return this;
 }
 setFromEuler(e){
  const a=Math.cos(e.x/2),b=Math.cos(e.y/2),c=Math.cos(e.z/2),x=Math.sin(e.x/2),y=Math.sin(e.y/2),z=Math.sin(e.z/2);
  this.x=x*b*c+a*y*z;this.y=a*y*c-x*b*z;this.z=a*b*z+x*y*c;this.w=a*b*c-x*y*z;return this;
 }
}
const THREE={Euler,Quaternion};
const compare=(a,b)=>{for(const key of ['x','y','z','w'])close(a[key],b[key],1e-9);};
const fixture=()=>{
 const names=['Head','Chest','Body','Neck','Arm.L','Arm.R','Forearm.L','Forearm.R','Hand.L','Hand.R','Ear.L','Ear.R','EarTip.L','EarTip.R',...Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'))];
 const bones=names.map(name=>({name,isBone:true,quaternion:new Quaternion().setFromEuler({x:.12,y:-.07,z:.09})}));
 return {bones,map:new Map(bones.map(b=>[b.name,b])),root:{traverse:f=>bones.forEach(f)}};
};
test('every gesture restores the exact moving base and composes safely over motion-v8',()=>{
 const {bones,map,root}=fixture(),motion=createMotionV8(root,THREE),layer=createGestureLayer(map,THREE);
 for(let frame=0;frame<210*M_GESTURES.length;frame++){
  layer.prepare();motion.prepare();
  // Emulate an AnimationMixer replacing the animated subset, including a
  // noncommuting rotation so a wrong inverse/removal order cannot pass.
  const base=new Quaternion().setFromEuler({x:Math.sin(frame*.02)*.2,y:.18,z:-.13});
  for(const bone of bones)if(!bone.name.startsWith('Tail'))bone.quaternion.copy(base);
  motion.update(1/60,{clipActive:true,energy:.45,mode:'float'});
  const before=new Map(bones.map(b=>[b.name,b.quaternion.clone()]));
  const name=M_GESTURES[Math.floor(frame/210)%M_GESTURES.length],age=(frame%210)/210*GESTURE_DURATIONS[name];
  const pose=sampleGesture({name,age}).pose;
  const locomotion=sampleLocomotionPose({turn:Math.sin(frame*.027),travel:.5,leanX:Math.sin(frame*.03)*.4,leanY:Math.cos(frame*.019)*.3});
  for(const [bone,offset]of Object.entries(locomotion))pose[bone]=offset.map((value,axis)=>value+(pose[bone]?.[axis]||0));
  layer.apply(pose);
  for(const bone of bones)close(Math.hypot(bone.quaternion.x,bone.quaternion.y,bone.quaternion.z,bone.quaternion.w),1,1e-9);
  layer.prepare();for(const bone of bones)compare(bone.quaternion,before.get(bone.name));
 }
});
test('empty or malformed poses preserve the base and repeated apply replaces its own offset',()=>{
 const {map,bones}=fixture(),layer=createGestureLayer(map,THREE),base=bones[0].quaternion.clone();
 layer.apply({Head:[.2,-.1,.15]});const first=bones[0].quaternion.clone();
 layer.apply({Head:[.2,-.1,.15]});compare(bones[0].quaternion,first);
 layer.apply({Head:[NaN,0,0],Unknown:[1,0,0]});compare(bones[0].quaternion,base);
 layer.apply();compare(bones[0].quaternion,base);
 layer.apply(sampleGesture({name:'wave',age:1,reducedMotion:true}).pose);compare(bones[0].quaternion,base);
});
test('new acting uses coordinated beats and delayed ears/tail with gradual rather than step deformation',()=>{
 for(const name of ['playful','wink','nod']){
  const duration=GESTURE_DURATIONS[name],sample=p=>sampleGesture({name,age:p*duration});
  const early=sample(.04).pose,mid=sample(.4).pose;
  assert.ok(magnitude(early)>0&&magnitude(early)<magnitude(mid)*.3);
  assert.ok(Math.hypot(...mid.Head)>Math.hypot(...mid.Body));
  assert.ok(Object.keys(mid).some(bone=>bone.startsWith('Forearm.')));
  assert.ok(Object.keys(mid).some(bone=>bone.startsWith('Ear.')));
  assert.equal(Object.keys(mid).filter(bone=>bone.startsWith('Tail.')).length,10);
  const roots=[],tips=[];
  for(let i=0;i<200;i++){
   const pose=sample((i+1)/201).pose;
   roots.push(Math.hypot(...pose['Tail.01']));tips.push(Math.hypot(...pose['Tail.10']));
  }
  const rootPeak=roots.indexOf(Math.max(...roots)),tipPeak=tips.indexOf(Math.max(...tips));
  assert.ok(tipPeak>rootPeak+7,`${name} tail must follow from base to tip`);
 }
 const playful=p=>sampleGesture({name:'playful',age:p*GESTURE_DURATIONS.playful}).pose;
 assert.ok(playful(.35).Head[1]>.1&&playful(.64).Head[1]<-.05,'playful feint must change its intention');
 const nod=p=>sampleGesture({name:'nod',age:p*GESTURE_DURATIONS.nod}).pose;
 assert.ok(nod(.38).Head[0]>nod(.65).Head[0]+.07,'acknowledgment has a smaller second beat');
});

test('new gestures mirror side consistently without changing the forward head action',()=>{
 for(const name of ['playful','wink','nod'])for(const progress of [.1,.25,.4,.6,.8,.95]){
  const left=sampleGesture({name,side:1,age:progress*GESTURE_DURATIONS[name]}),right=sampleGesture({name,side:-1,age:progress*GESTURE_DURATIONS[name]});
  for(const bone of ['Body','Chest','Neck','Head',...Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'))]){
   close(left.pose[bone][0],right.pose[bone][0]);
   close(left.pose[bone][1],-right.pose[bone][1]);close(left.pose[bone][2],-right.pose[bone][2]);
  }
  const l=left.pose['Forearm.L'],r=right.pose['Forearm.R'];
  for(let axis=0;axis<3;axis++)close(l[axis],-r[axis]);
 }
});

test('wink closure uses independent source-compatible blink controls and releases exactly at both endpoints',()=>{
 const duration=GESTURE_DURATIONS.wink;
 for(const side of [-1,1]){
  let previous=0,peak=0,partial=0;
  for(let frame=0;frame<=600;frame++){
   const result=sampleGesture({name:'wink',side,age:duration*frame/600});
   const closure=result.blink?.[side>0?'left':'right']||0;
   const other=result.blink?.[side>0?'right':'left']||0;
   assert.ok(closure>=0&&closure<=1);assert.equal(other,0);
   assert.ok(Math.abs(closure-previous)<.025,'eyelid cannot jump to a knot');
   if(closure>.02&&closure<.98)partial++;
   peak=Math.max(peak,closure);previous=closure;
  }
  assert.equal(peak,1);assert.ok(partial>130);
  for(const age of [0,duration])assert.equal(sampleGesture({name:'wink',side,age}).blink,null);
  assert.equal(sampleGesture({name:'wink',side,age:1,reducedMotion:true}).blink,null);
 }
});
