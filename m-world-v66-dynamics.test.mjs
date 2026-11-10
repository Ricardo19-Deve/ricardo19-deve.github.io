import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresenceDynamics} from './m-world-dynamics.mjs';
import {motionPose,createMotionV8} from './m-lab/interactions/motion-v8.mjs';
import {tailPoseV15} from './m-lab/interactions/tail-v15.mjs';
import {tailPoseV14} from './m-lab/interactions/tail-v14.mjs';

const curious={intent:'investigate',phase:'hold',energy:.65,arousal:.35,valence:.12,focus:.85,mood:'curious'};
const playful={intent:'play',phase:'express',energy:.92,arousal:.85,valence:.8,focus:.2,mood:'happy'};
const tired={intent:'rest',phase:'recover',energy:.12,arousal:.06,valence:.1,focus:.1,mood:'sleepy'};
const asleep={...tired,intent:'sleep',phase:'sleeping'};
const approx=(a,b,tolerance=.02)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
function settle(performance,seconds=5){
 const engine=createPresenceDynamics();let out;
 for(let i=0;i<60*seconds;i++)out=engine.sample({dt:1/60,performance});
 return {engine,out};
}
const tailKeys=Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'));

test('V66 optional performance leaves legacy dynamics and tail callers unchanged',()=>{
 const a=createPresenceDynamics(),b=createPresenceDynamics();
 for(let i=0;i<120;i++){
  const args={dt:1/60,vx:90,vy:-20,attention:{x:.7,y:-.2},nearCard:true};
  assert.deepEqual(a.sample(args),b.sample({...args,performance:null}));
 }
 const legacy=a.sample({dt:1/60});
 assert.equal(Object.hasOwn(legacy,'tailPhase'),false);
 a.sample({dt:1/60,performance:playful});
 assert.equal(Object.hasOwn(a.sample({dt:1/60}),'tailPhase'),false);
 assert.equal(Object.hasOwn(a.snapshot(),'performance'),false);
 const opts={time:4.25,expression:'happy',amount:.8,reactivity:1.2,performance:1};
 assert.deepEqual(tailPoseV15(opts),tailPoseV15({...opts,tailPhase:undefined,tailMood:null}));
});

test('V66 integrates a continuous tail phase across emotional tempo changes',()=>{
 const {engine,out}=settle(curious,12),before=out.tailPhase,tempo=out.tailTempo;
 const changed=engine.sample({dt:1/60,performance:playful});
 assert.ok(changed.tailPhase>before);
 assert.ok(changed.tailPhase-before<1.3/60,'a mood change cannot reset or multiply elapsed phase');
 approx(changed.tailPhase-before,tempo/60,.0002);
 const after=changed.tailPhase;
 const stopped=engine.sample({dt:0,performance:asleep});
 assert.equal(stopped.tailPhase,after,'zero elapsed time cannot move the phase');
 assert.ok(engine.sample({dt:1/60,performance:asleep}).tailPhase>after);
});

test('V66 phase and physical drive remain consistent at 30/60/120Hz',()=>{
 function run(rate){
  const engine=createPresenceDynamics();let out;
  for(let frame=0;frame<rate*8;frame++){
   const seconds=frame/rate,performance=seconds<2?curious:seconds<4?playful:seconds<6?tired:asleep;
   out=engine.sample({dt:1/rate,vx:seconds<4?90:0,vy:0,performance});
  }
  return {out,profile:engine.snapshot().performance};
 }
 const middle=run(60);
 for(const rate of [30,120]){
  const candidate=run(rate);
  approx(candidate.out.tailPhase,middle.out.tailPhase,.035);
  approx(candidate.out.tailTempo,middle.out.tailTempo,.002);
  for(const key of ['energy','arousal','focus','drive','sleep'])approx(candidate.profile[key],middle.profile[key],.003);
 }
});

test('V66 play, focused curiosity, tiredness and sleep produce distinct restrained drive',()=>{
 const play=settle(playful).out,focus=settle(curious).out,rest=settle(tired).out,sleep=settle(asleep).out;
 assert.ok(play.tailTempo>focus.tailTempo&&focus.tailTempo>rest.tailTempo);
 assert.ok(play.energy>rest.energy*2);
 assert.ok(play.tailEnergy>rest.tailEnergy);
 assert.ok(focus.tailMood.focus>.8&&focus.tailReactivity>rest.tailReactivity);
 assert.ok(sleep.tailTempo<.14&&sleep.tailMood.sleep>.99);
 for(const key of ['energy','tailEnergy','tailReactivity','performanceImpact'])assert.equal(sleep[key],0,'authored sleep owns '+key);
 const blocked=createPresenceDynamics().sample({dt:1/60,vx:200,performance:{...playful,blocked:true}});
 assert.equal(blocked.energy,0);assert.equal(blocked.tailEnergy,0);assert.equal(blocked.performanceImpact,0);
 const reading=settle({...playful,reading:true}).out;
 approx(reading.tailEnergy,play.tailEnergy*.5,1e-12);
 approx(reading.tailReactivity,play.tailReactivity*.5,1e-12);
});

test('V66 original tail joints have a bounded asymmetric curve and no extra rig parts',()=>{
 const profiles=[settle(playful).out,settle(curious).out,settle(tired).out];
 for(const dynamics of profiles)for(let frame=0;frame<240;frame++){
  const pose=tailPoseV15({time:frame/60,tailPhase:dynamics.tailPhase+frame/60*dynamics.tailTempo,
   tailMood:dynamics.tailMood,mode:'float',expression:'curious',amount:dynamics.tailEnergy,
   reactivity:dynamics.tailReactivity,performance:dynamics.performanceImpact});
  assert.deepEqual(Object.keys(pose),tailKeys);
  for(const angles of Object.values(pose)){
   assert.ok(angles.every(Number.isFinite));
   assert.ok(Math.abs(angles[0])<=.25&&Math.abs(angles[1])<=.018&&Math.abs(angles[2])<=.23);
  }
  assert.notDeepEqual(pose['Tail.01'],pose['Tail.10'],'base and tip cannot act as a rigid rod');
 }
 const p=profiles[1],a=tailPoseV15({tailPhase:4,tailMood:p.tailMood,expression:'neutral'});
 const b=tailPoseV15({tailPhase:4,tailMood:{...p.tailMood,valence:-.7,focus:.1},expression:'neutral'});
 assert.notDeepEqual(a,b,'posture reflects shared emotional channels, not just a global amplitude');
});

test('V66 phase reaches the existing motion pose rather than being multiplied by its global clock',()=>{
 const input={tailPhase:3,tailMood:{energy:.8,arousal:.4,valence:.2,focus:.3,drive:.4,sleep:0,startle:0},
  energy:.7,tailEnergy:.4,tailReactivity:0,performanceImpact:1};
 const a=motionPose({...input,time:1}),b=motionPose({...input,time:1000}),c=motionPose({...input,time:1000,tailPhase:3.5});
 for(const key of tailKeys)assert.deepEqual(a[key],b[key]);
 assert.ok(tailKeys.some(key=>a[key][0]!==c[key][0]));
 assert.notDeepEqual(a.Head,b.Head,'the base body clock remains independent');
});

test('V66 contextual tail keeps body counter-swing and suppresses idle wave during sleep',()=>{
 const opts={time:3,amount:.7,reactivity:.8,performance:0};
 assert.deepEqual(tailPoseV15(opts),tailPoseV14(opts),'legacy performance slider at zero retains the V14 wave');
 const profile=settle(curious).out.tailMood;
 const awake=tailPoseV15({...opts,tailPhase:3,tailMood:profile});
 const moving=tailPoseV15({...opts,tailPhase:3,tailMood:profile,
  bodyMotion:{rotation:{y:.3,z:.2},velocity:{x:.4,y:.1}}});
 assert.notDeepEqual(awake,moving,'shared mood must retain the original physical body counter-swing');
 const sleeping=tailPoseV15({...opts,tailPhase:3,tailMood:{...profile,sleep:1}});
 for(const key of tailKeys)for(let axis=0;axis<3;axis++){
  assert.ok(Math.abs(sleeping[key][axis])<=Math.abs(awake[key][axis])*.011+1e-12,
   'a zero performance slider cannot bypass contextual sleep relaxation');
 }
});

test('V66 reduced motion, invalid context and reset cannot retain expressive movement',()=>{
 const {engine}=settle(playful);
 const zero=engine.sample({dt:1/60,performance:playful,reducedMotion:true});
 for(const key of ['energy','tailEnergy','tailReactivity','performanceImpact','tailPhase','tailTempo'])assert.equal(zero[key],0);
 assert.equal(zero.tailMood.drive,0);assert.deepEqual(zero.attention,{x:0,y:0});
 for(const performance of [{energy:Infinity,arousal:NaN,valence:-Infinity,focus:NaN},{intent:null,phase:4,blocked:true},[]]){
  const out=engine.sample({dt:NaN,vx:Infinity,performance});
  for(const key of ['energy','tailEnergy','tailReactivity','tailFlow','performanceImpact'])assert.ok(Number.isFinite(out[key]));
  if(out.tailPhase!==undefined)assert.ok(Number.isFinite(out.tailPhase));
 }
 engine.reset();assert.equal(Object.hasOwn(engine.snapshot(),'performance'),false);
});

class Quaternion {
 constructor(value=0){this.value=value;}
 clone(){return new Quaternion(this.value);} copy(other){this.value=other.value;return this;}
 invert(){this.value=-this.value;return this;} identity(){this.value=0;return this;}
 multiply(other){this.value+=other.value;return this;}
 setFromEuler(angles){this.value=angles.x+angles.y+angles.z;return this;}
}
class Euler {set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}}
test('V66 integrated profile reuses reversible existing springs and returns to rest',()=>{
 function run(rate){
  const names=['Root','Body','Chest','Neck','Head','Ear.L','Ear.R','EarTip.L','EarTip.R',
   'Arm.L','Arm.R','Forearm.L','Forearm.R','Hand.L','Hand.R','Leg.L','Leg.R','Shin.L','Shin.R','Foot.L','Foot.R',...tailKeys];
  assert.equal(names.length,31);
  const bones=names.map(name=>({name,isBone:true,quaternion:new Quaternion(.1)}));
  const root={traverse:callback=>bones.forEach(callback)},motion=createMotionV8(root,{Quaternion,Euler}),dynamics=createPresenceDynamics();
  for(let frame=0;frame<rate*10;frame++){
   const t=frame/rate,performance=t<3?curious:t<6?playful:asleep;
   const d=dynamics.sample({dt:1/rate,vx:t<6?70:0,performance});
   motion.prepare();motion.update(1/rate,{mode:'float',expression:t<6?'curious':'neutral',...d});
   for(const bone of bones)assert.ok(Number.isFinite(bone.quaternion.value)&&Math.abs(bone.quaternion.value)<1.4);
  }
  assert.equal(motion.tailDiagnostics.connected,10);
  const result=bones.slice(-10).map(b=>b.quaternion.value);
  assert.ok(result.every(x=>Math.abs(x-.1)<.003),'sleep must settle the main tail close to its authored rest transform');
  motion.prepare();for(const bone of bones)approx(bone.quaternion.value,.1,1e-10);
  motion.reset();for(const bone of bones)assert.equal(bone.quaternion.value,.1);
  return result;
 }
 const base=run(60);for(const rate of [30,120])run(rate).forEach((v,i)=>approx(v,base[i],.002));
});
