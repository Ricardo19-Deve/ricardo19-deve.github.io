import test from 'node:test';
import assert from 'node:assert/strict';
import {tailPoseV11,TAIL_STYLES_V11} from './tail-v11.mjs';
import {motionPose} from './motion-v8.mjs';

const names=Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'));
const gap=(a,b)=>names.reduce((total,n)=>total+a[n].reduce((v,x,i)=>v+Math.abs(x-b[n][i]),0),0);
const bend=p=>Math.max(...Object.values(p).map(([x,y,z])=>Math.hypot(x,z)));
const twist=p=>Math.max(...Object.values(p).map(([x,y,z])=>Math.abs(y)));

test('V11 detects all ten real Tail.01 through Tail.10 names',()=>{
 const p=tailPoseV11({time:1.2});
 assert.deepEqual(Object.keys(p),names);
 for(const angles of Object.values(p)){
  assert.equal(angles.length,3);
  for(const value of angles)assert.ok(Number.isFinite(value));
 }
});

test('critical rig correction: X/Z bend dominates longitudinal Y twist',()=>{
 for(const expression of ['neutral','happy','curious','surprised'])
 for(const style of TAIL_STYLES_V11){
  const p=tailPoseV11({time:2.4,expression,emotionAge:.35,
   amount:.85,reactivity:1.75,style});
  assert.ok(twist(p)<Math.max(.012,bend(p)*.13),
   expression+' '+style+' bend='+bend(p)+' twist='+twist(p));
 }
});

test('happy curious and surprised have visibly distinct bend poses',()=>{
 const neutral=tailPoseV11({time:1.6,amount:.85,reactivity:1.75});
 for(const expression of ['happy','curious','surprised']){
  const emotion=tailPoseV11({time:1.6,amount:.85,reactivity:1.75,
   expression,emotionAge:.35});
  assert.ok(gap(emotion,neutral)>.35,expression+' is indistinguishable');
 }
 const curious=tailPoseV11({time:1.6,expression:'curious',reactivity:1.75});
 const surprised=tailPoseV11({time:1.6,expression:'surprised',reactivity:1.75,emotionAge:.35});
 assert.ok(gap(curious,surprised)>.6);
});

test('tail moves from body turn and knock impulse without needing facial emotion',()=>{
 const config={time:1.3,reactivity:1.75,amount:0};
 const neutral=tailPoseV11(config);
 const turning=tailPoseV11({...config,bodyMotion:{rotation:{y:.3},angularVelocity:{y:.8},velocity:{x:.7}},headTurn:.1});
 const knock=tailPoseV11({...config,mode:'knock',modeAge:.8});
 assert.ok(gap(turning,neutral)>.25);
 assert.ok(gap(knock,neutral)>.05);
});

test('base and emotional controls remain independent',()=>{
 const neutral=tailPoseV11({time:1.3,amount:0,reactivity:1.75});
 const curious=tailPoseV11({time:1.3,amount:0,reactivity:1.75,expression:'curious'});
 assert.ok(gap(neutral,curious)>.3);
 const base=tailPoseV11({time:1.3,amount:.9,reactivity:0});
 const baseCurious=tailPoseV11({time:1.3,amount:.9,reactivity:0,expression:'curious'});
 assert.equal(gap(base,baseCurious),0);
 const off=tailPoseV11({time:1.3,amount:0,reactivity:0,expression:'surprised'});
 for(const pose of Object.values(off))assert.deepEqual(pose,[0,0,0]);
});

test('bound maximum X/Z bends even at 200% reaction',()=>{
 for(const style of TAIL_STYLES_V11)
 for(const mode of ['float','swim','peek','knock','shy','follow'])
 for(const expression of ['neutral','happy','curious','surprised'])
 for(const t of [.1,.25,.5,1,2,4]){
  const p=tailPoseV11({time:t,mode,modeAge:t,expression,emotionAge:t,
   style,amount:1.5,reactivity:2,headTurn:1,
   bodyMotion:{rotation:{y:1,z:1},angularVelocity:{y:3,z:3},velocity:{x:2,y:2}},swimWeight:1});
  for(const [x,y,z] of Object.values(p)){
   assert.ok(Math.abs(x)<.251);
   assert.ok(Math.abs(z)<.241);
   assert.ok(Math.abs(y)<.026);
  }
 }
});

test('continuous at 30 and 60 FPS during ongoing happy wag',()=>{
 for(const fps of [30,60]){
  for(let i=0;i<fps*5;i++){
   const t=1+i/fps;
   const props={expression:'happy',reactivity:1.75,amount:.85};
   const a=tailPoseV11({...props,time:t}),b=tailPoseV11({...props,time:t+1/fps});
   for(const bone of names)for(let axis=0;axis<3;axis++)
    assert.ok(Math.abs(a[bone][axis]-b[bone][axis])<.06);
  }
 }
});

test('global procedural energy zero still leaves original baked GLB unaffected',()=>{
 const p=motionPose({time:1.7,energy:0,tailEnergy:1.5,tailReactivity:2,
  expression:'happy',mode:'swim'});
 for(const a of Object.values(p))for(const x of a)assert.equal(x,0);
});
