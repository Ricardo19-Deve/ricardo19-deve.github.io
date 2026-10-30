import test from 'node:test';
import assert from 'node:assert/strict';
import {tailPoseV10,TAIL_STYLES_V10} from './tail-v10.mjs';
import {motionPose} from './motion-v8.mjs';

const names=Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'));
const diff=(a,b)=>names.reduce((n,key)=>n+a[key].reduce((v,x,i)=>v+Math.abs(x-b[key][i]),0),0);
const power=p=>names.reduce((n,k)=>n+p[k].reduce((v,x)=>v+x*x,0),0);

test('all ten GLB tail joints move in three axes',()=>{
 const p=tailPoseV10({time:2.5});
 assert.deepEqual(Object.keys(p),names);
 for(const a of Object.values(p)){assert.equal(a.length,3);a.forEach(x=>assert.ok(Number.isFinite(x)&&Math.abs(x)<.291));}
 assert.notDeepEqual(p['Tail.01'],p['Tail.10']);
});

test('happy curious and surprised affect tail even when idle wave is zero',()=>{
 const options={time:2.4,amount:0,reactivity:1.5,emotionAge:.28};
 const neutral=tailPoseV10({...options,expression:'neutral'});
 assert.equal(power(neutral),0);
 for(const mood of ['happy','curious','surprised'])
  assert.ok(diff(neutral,tailPoseV10({...options,expression:mood}))>.10,mood);
});

test('body turning and acceleration drive visible counter-movement',()=>{
 const options={time:2.1,amount:0,reactivity:1.5,expression:'neutral'};
 const neutral=tailPoseV10(options);
 const moving=tailPoseV10({...options,bodyMotion:{
  rotation:{y:.2,z:.18},angularVelocity:{y:.9,z:-.7},velocity:{x:.8,y:.5}
 },headTurn:.12});
 assert.ok(diff(neutral,moving)>.3);
});

test('base movement and reactive movement are independently adjustable',()=>{
 const base=tailPoseV10({time:1.7,amount:1,reactivity:0});
 const baseHappy=tailPoseV10({time:1.7,amount:1,reactivity:0,expression:'happy'});
 assert.equal(diff(base,baseHappy),0);
 const emotion=tailPoseV10({time:1.7,amount:0,reactivity:1.5,expression:'happy'});
 assert.ok(power(emotion)>0);
 const zero=tailPoseV10({time:1.7,amount:0,reactivity:0,expression:'happy'});
 for(const a of Object.values(zero))assert.deepEqual(a,[0,0,0]);
});

test('tail stroke responds continuously to mixer weight',()=>{
 const opts={time:2.1,mode:'swim',reactivity:0};
 const a=tailPoseV10({...opts,swimWeight:0});
 const middle=tailPoseV10({...opts,swimWeight:.5});
 const b=tailPoseV10({...opts,swimWeight:1});
 assert.ok(diff(a,b)>.01);
 assert.ok(diff(a,middle)<diff(a,b));
});

test('tail remains frame-continuous at 30 and 60 FPS',()=>{
 for(const fps of [30,60])for(let frame=3;frame<fps*4;frame++){
  const t=frame/fps,opts={mode:'follow',expression:'happy',pointer:{x:.7},
   bodyMotion:{rotation:{y:.19},angularVelocity:{y:.8},velocity:{x:.5}}};
  const a=tailPoseV10({...opts,time:t});
  const b=tailPoseV10({...opts,time:t+1/fps});
  for(const key of names)for(let axis=0;axis<3;axis++)
   assert.ok(Math.abs(a[key][axis]-b[key][axis])<.04,key+' '+fps);
 }
});

test('strongest reactions stay within joint-angle limits',()=>{
 assert.deepEqual(TAIL_STYLES_V10,['organic','calm','playful']);
 for(const mode of ['float','swim','peek','knock','shy','follow'])
 for(const expression of ['neutral','happy','curious','surprised'])
 for(const style of TAIL_STYLES_V10)
 for(const time of [.1,.2,.35,.6,1,1.5,3]){
  const p=tailPoseV10({time,mode,modeAge:time,emotionAge:time,
   expression,style,amount:1.5,reactivity:2,headTurn:1,swimWeight:1,
   pointer:{x:1},bodyMotion:{rotation:{y:.8,z:.7},angularVelocity:{y:3,z:-2},velocity:{x:3,y:2}}});
  for(const a of Object.values(p))a.forEach(x=>assert.ok(Number.isFinite(x)&&Math.abs(x)<.291));
 }
});

test('global body energy zero disables every procedural bone movement',()=>{
 const pose=motionPose({time:2,mode:'shy',energy:0,tailEnergy:1.5,tailReactivity:2,
  expression:'surprised',bodyMotion:{rotation:{y:.2}}});
 for(const a of Object.values(pose))for(const x of a)assert.equal(x,0);
});
