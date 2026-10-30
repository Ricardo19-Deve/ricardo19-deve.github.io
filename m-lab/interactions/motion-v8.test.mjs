import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothSpring,createSpring,transitionFrequency} from './fluid-v8.mjs';
import {motionPose,createMotionV8} from './motion-v8.mjs';

class QuaternionMock{
 constructor(value=0){this.value=value;}
 clone(){return new QuaternionMock(this.value);}
 copy(other){this.value=other.value;return this;}
 invert(){this.value=-this.value;return this;}
 identity(){this.value=0;return this;}
 multiply(other){this.value+=other.value;return this;}
 setFromEuler(e){this.value=e.x+e.y+e.z;return this;}
}
class EulerMock{
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
}
function fixture(){
 const names=['Head','Chest','Arm.L','Arm.R','Tail.01','Tail.10'];
 const bones=names.map(name=>({name,isBone:true,quaternion:new QuaternionMock(.1)}));
 const root={traverse:fn=>bones.forEach(fn)};
 return {bones,root,THREE:{Quaternion:QuaternionMock,Euler:EulerMock}};
}

test('spring converges smoothly with 20–120 FPS and stays bounded',()=>{
 for(const fps of [20,30,60,120]){
  const state=createSpring();
  for(let i=0;i<fps;i++)smoothSpring(state,1,1/fps,6,.9);
  assert.ok(state.value>.8&&state.value<1.25,'FPS '+fps+': '+state.value);
 }
});

test('fluidity control changes spring responsiveness',()=>{
 assert.ok(transitionFrequency(.95)<transitionFrequency(.2));
 assert.ok(transitionFrequency(.5)>0);
});

test('M V8 uses all ten tail segments and different emotions',()=>{
 const happy=motionPose({time:1.4,mode:'float',expression:'happy'});
 const surprised=motionPose({time:1.4,mode:'float',expression:'surprised'});
 assert.equal(Object.keys(happy).filter(name=>name.startsWith('Tail.')).length,10);
 assert.ok(Math.abs(happy.Head[0]-surprised.Head[0])>.05);
});

test('reversible additive transforms do not accumulate across 600 frames',()=>{
 const {bones,root,THREE}=fixture();
 const motion=createMotionV8(root,THREE);
 for(let frame=0;frame<600;frame++){
  motion.prepare();
  // A running mixer has replaced bone quaternions before update().
  for(const bone of bones)bone.quaternion.value=.1;
  motion.update(1/60,{clipActive:true,mode:'float',expression:'curious',energy:.8});
  for(const bone of bones)
   assert.ok(Math.abs(bone.quaternion.value)<1.2,'Drift: '+bone.name+' '+bone.quaternion.value);
 }
 motion.prepare();
 for(const bone of bones)assert.ok(Math.abs(bone.quaternion.value-.1)<1e-6,'No restoration: '+bone.name);
});

test('idle motion keeps original rig pose instead of accumulating',()=>{
 const {bones,root,THREE}=fixture();
 const motion=createMotionV8(root,THREE);
 for(let i=0;i<120;i++){
  motion.prepare();
  motion.update(1/60,{clipActive:false,mode:'curious',energy:.7});
 }
 motion.reset();
 for(const bone of bones)assert.equal(bone.quaternion.value,.1);
});

test('body motion can be turned off completely',()=>{
 const pose=motionPose({time:2,mode:'swim',expression:'happy',energy:0});
 for(const values of Object.values(pose))assert.deepEqual(values,[0,0,0]);
});
