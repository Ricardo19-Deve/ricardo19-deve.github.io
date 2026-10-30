import test from 'node:test';
import assert from 'node:assert/strict';
import {tailPoseV14,TAIL_STYLES_V14} from './tail-v14.mjs';
import {motionPose,createMotionV8} from './motion-v8.mjs';

const joints=Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'));
const distance=(a,b)=>joints.reduce((sum,name)=>sum+a[name].reduce(
 (s,v,i)=>s+Math.abs(v-b[name][i]),0),0);

test('V14 retains all ten joints and local X/Z bends, with minimal Y twist',()=>{
 for(const expression of ['neutral','happy','curious','surprised']){
  const p=tailPoseV14({time:1.5,expression,emotionAge:.5});
  assert.deepEqual(Object.keys(p),joints);
  for(const [x,y,z] of Object.values(p)){
   assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z));
   assert.ok(Math.abs(x)<.271&&Math.abs(z)<.251&&Math.abs(y)<.016);
  }
 }
});

test('flow changes the phase of traveling motion, most visibly at the tip',()=>{
 const low=tailPoseV14({time:2.1,flow:0});
 const high=tailPoseV14({time:2.1,flow:1});
 assert.ok(distance(low,high)>.10);
 // Root stays synchronized. Farther down, phase lag appears at a different
 // point in the wave cycle: do not require an arbitrary single-frame peak.
 assert.deepEqual(low['Tail.01'],high['Tail.01']);
 const before=tailPoseV14({time:1.1,flow:0});
 const after=tailPoseV14({time:1.1,flow:1});
 assert.ok(before['Tail.10'].some((v,i)=>Math.abs(v-after['Tail.10'][i])>.03));
 assert.ok(distance(low,tailPoseV14({time:2.1,flow:0}))<1e-10);
});

test('tail is continuously moving through calm idle and energetic expressions',()=>{
 for(const style of TAIL_STYLES_V14){
  const a=tailPoseV14({time:1.5,style,flow:.73});
  const b=tailPoseV14({time:2.3,style,flow:.73});
  assert.ok(distance(a,b)>.04,style);
 }
 for(const expression of ['happy','curious','surprised']){
  const n=tailPoseV14({time:2,expression:'neutral'});
  const p=tailPoseV14({time:2,expression,emotionAge:.4});
  assert.ok(distance(n,p)>.16,expression);
 }
});

test('tail frames remain continuous at 30 and 60 frames per second',()=>{
 for(const fps of [30,60]){
  let largest=0;
  for(let frame=fps;frame<fps*5;frame++){
   const time=frame/fps,opts={expression:'happy',flow:.73,amount:.85,reactivity:1.75};
   const a=tailPoseV14({...opts,time}),b=tailPoseV14({...opts,time:time+1/fps});
   for(const name of joints)for(let i=0;i<3;i++)
    largest=Math.max(largest,Math.abs(a[name][i]-b[name][i]));
  }
  assert.ok(largest<.04,`Frame discontinuity at ${fps} FPS: ${largest}`);
 }
});

test('base and emotion sliders remain independent',()=>{
 const base=tailPoseV14({time:2,amount:.85,reactivity:0});
 const happy=tailPoseV14({time:2,amount:.85,reactivity:0,expression:'happy'});
 assert.equal(distance(base,happy),0);
 const noBase=tailPoseV14({time:2,amount:0,reactivity:1.75,expression:'curious'});
 const neutral=tailPoseV14({time:2,amount:0,reactivity:1.75});
 assert.ok(distance(noBase,neutral)>.15);
 const zero=tailPoseV14({time:2,amount:0,reactivity:0,expression:'happy'});
 for(const value of Object.values(zero))assert.deepEqual(value,[0,0,0]);
});

test('traveling impulses react to body turning and swimming',()=>{
 const opts={time:1.9,mode:'swim',swimWeight:0};
 const neutral=tailPoseV14(opts);
 const swimming=tailPoseV14({...opts,swimWeight:1});
 assert.ok(distance(neutral,swimming)>.05);
 const turning=tailPoseV14({...opts,bodyMotion:{
  rotation:{y:.20,z:.15},angularVelocity:{y:.7,z:-.5},velocity:{x:.5,y:.4}
 }});
 assert.ok(distance(neutral,turning)>.2);
});

test('master body energy still disables all procedural motion',()=>{
 const pose=motionPose({time:2,energy:0,tailEnergy:.85,tailReactivity:1.75,
  tailFlow:.73,expression:'happy',mode:'swim'});
 for(const value of Object.values(pose))for(const angle of value)assert.equal(angle,0);
});

class Q{
 constructor(v=0){this.v=v}
 clone(){return new Q(this.v)}
 copy(o){this.v=o.v;return this}
 invert(){this.v=-this.v;return this}
 multiply(o){this.v+=o.v;return this}
 identity(){this.v=0;return this}
 setFromEuler(e){this.v=e.x+e.y+e.z;return this}
}
class Euler{set(x,y,z){this.x=x;this.y=y;this.z=z}}
test('V14 skeletal spring follows Tail01..Tail10 with no accumulating drift',()=>{
 const bones=joints.map((name,i)=>({isBone:true,name:name.replace('.',''),quaternion:new Q(.2)}));
 const root={traverse:fn=>bones.forEach(fn)};
 const motion=createMotionV8(root,{Quaternion:Q,Euler});
 assert.equal(motion.tailDiagnostics.connected,10);
 for(let frame=0;frame<360;frame++){
  motion.prepare();
  for(const bone of bones)bone.quaternion.v=.2;
  motion.update(1/60,{mode:'swim',expression:'happy',energy:.85,
   tailEnergy:.85,tailReactivity:1.75,tailFlow:.73,clipActive:true,swimWeight:1});
  for(const bone of bones)assert.ok(Math.abs(bone.quaternion.v)<1);
 }
 motion.prepare();
 for(const bone of bones)assert.ok(Math.abs(bone.quaternion.v-.2)<1e-7);
});
