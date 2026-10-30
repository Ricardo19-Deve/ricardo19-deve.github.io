import test from 'node:test';
import assert from 'node:assert/strict';
import {tailPose,TAIL_STYLES} from './tail-v9.mjs';
import {motionPose} from './motion-v8.mjs';

const magnitude=pose=>Object.values(pose).reduce(
 (total,angles)=>total+angles.reduce((sum,x)=>sum+x*x,0),0
);
const sampleStyle=style=>[.5,1,1.5,2,2.5,3,3.5].reduce(
 (total,time)=>total+magnitude(tailPose({time,style})),0
);

test('all ten tail bones receive three-axis flowing motion',()=>{
 const pose=tailPose({time:2.1});
 assert.equal(Object.keys(pose).length,10);
 for(let i=1;i<=10;i++){
  const key='Tail.'+String(i).padStart(2,'0');
  assert.equal(pose[key].length,3);
  assert.ok(pose[key].every(Number.isFinite),key);
 }
 assert.notDeepEqual(pose['Tail.01'],pose['Tail.10']);
});

test('calm, organic and playful styles have distinct energy',()=>{
 assert.deepEqual(TAIL_STYLES,['organic','calm','playful']);
 const calm=sampleStyle('calm'),organic=sampleStyle('organic'),playful=sampleStyle('playful');
 assert.ok(calm<organic,`calm ${calm} >= organic ${organic}`);
 assert.ok(organic<playful,`organic ${organic} >= playful ${playful}`);
});

test('animation remains continuous at 60 frames per second',()=>{
 for(let k=1;k<=300;k++){
  const a=tailPose({time:k/60}),b=tailPose({time:(k+1)/60});
  for(const bone of Object.keys(a))for(let axis=0;axis<3;axis++)
   assert.ok(Math.abs(a[bone][axis]-b[bone][axis])<.025,bone+' sudden move');
 }
});

test('tail motion can be paused without stopping the other body joints',()=>{
 const zero=tailPose({time:5,amount:0,expression:'happy'});
 for(const axes of Object.values(zero))for(const v of axes)assert.equal(v,0);
 // V10 separates the base wave from emotional/body reactivity.
 // Disabling both tail channels leaves head and body motion unaffected.
 const body=motionPose({time:5,energy:1,tailEnergy:0,tailReactivity:0});
 assert.ok(body.Head.some(v=>Math.abs(v)>.001));
 for(let i=1;i<=10;i++){
  const key='Tail.'+String(i).padStart(2,'0');
  assert.ok(body[key].every(v=>Math.abs(v)<.000001));
 }
});

test('swimming, surprise and shy reactions stay within joint safety envelope',()=>{
 for(const mode of ['float','swim','knock','shy','follow'])
  for(const expression of ['neutral','happy','curious','surprised'])
   for(const style of TAIL_STYLES)
    for(let time=0;time<=10;time+=.25){
     const pose=tailPose({time,mode,modeAge:time,expression,emotionAge:time,
      style,amount:1.5});
     for(const angles of Object.values(pose))for(const angle of angles)
      assert.ok(Number.isFinite(angle)&&Math.abs(angle)<=.21+1e-10);
    }
});

test('surprised/happy visibly modify the tail wave relative to neutral',()=>{
 const neutral=tailPose({time:1.7,expression:'neutral'});
 const happy=tailPose({time:1.7,expression:'happy'});
 const surprised=tailPose({time:1.7,expression:'surprised',emotionAge:.2});
 const difference=pose=>Object.keys(neutral).reduce((total,bone)=>
  total+pose[bone].reduce((sum,v,i)=>sum+Math.abs(v-neutral[bone][i]),0),0);
 assert.ok(difference(happy)>.02);
 assert.ok(difference(surprised)>.02);
});

test('tail does not jump when time advances from one frame to the next in swim',()=>{
 const a=tailPose({time:4,mode:'swim',amount:1.15});
 const b=tailPose({time:4+1/30,mode:'swim',amount:1.15});
 const max=Math.max(...Object.keys(a).flatMap(bone=>
  a[bone].map((v,i)=>Math.abs(v-b[bone][i]))));
 assert.ok(max<.04,'Largest joint rotation step: '+max);
});
