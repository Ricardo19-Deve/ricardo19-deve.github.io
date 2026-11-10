import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttentionDirector,createContextBlink,createFacialTargetMixer} from './m-world-attention.mjs';
import {createFacialV6} from './m-lab/interactions/facial-v6.mjs';

const state={intent:'observe',energy:.7,arousal:.3,valence:.2,focus:.6,mood:'curious',reading:false,blocked:false};
const tracking={shiftId:1,phase:'tracking',blinkHold:false};
const approx=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);

test('attention dwells on a semantic target and follows its movement without restarting anticipation',()=>{
 const director=createAttentionDirector({seed:66}),performance={...state,reading:true};
 const first=director.sample({dt:1/60,target:{x:.4,y:-.2},targetId:'card',performance});
 const vector=first.attention,id=first.shiftId,initial=vector.x;
 assert.ok(initial>0&&initial<.4);
 for(let i=0;i<180;i++){
  const out=director.sample({dt:1/60,target:{x:.4+i/1000,y:-.2},targetId:'card',performance});
  assert.equal(out,first);assert.equal(out.attention,vector);
  assert.equal(out.shiftId,id);assert.equal(out.phase,'tracking');assert.equal(out.blinkHold,false);
 }
 assert.ok(vector.x>.5,'attention follows a moving component rather than its stale starting point');
 const before={...vector};
 director.sample({dt:0,target:{x:-1,y:1},targetId:'other',performance});
 approx(vector.x,before.x);approx(vector.y,before.y);
 assert.equal(first.shiftId,id+1);
});

test('attention has seeded bounded glances with dwell time, rather than per-frame random jitter',()=>{
 function run(seed){
  const director=createAttentionDirector({seed}),trace=[],changes=[];let previous=0;
  for(let i=0;i<1800;i++){
   const out=director.sample({dt:1/60,target:{x:.2,y:.1},targetId:'card',performance:state});
   if(out.shiftId!==previous){changes.push(i/60);previous=out.shiftId;}
   trace.push([out.attention.x,out.attention.y,out.phase,out.shiftId]);
   if(i>180){assert.ok(Math.abs(out.attention.x-.2)<.081);assert.ok(Math.abs(out.attention.y-.1)<.041);}
  }
  assert.ok(changes.length>=4&&changes.length<=9);
  for(let i=1;i<changes.length;i++)assert.ok(changes[i]-changes[i-1]>=3);
  return trace;
 }
 assert.deepEqual(run('M-66'),run('M-66'));
 assert.notDeepEqual(run('M-66'),run('M-67'));
});

test('attention keeps velocity through a target change and is stable at 30/60/120Hz',()=>{
 function warm(){
  const director=createAttentionDirector({seed:1});
  for(let i=0;i<12;i++)director.sample({dt:1/120,target:{x:1,y:0},targetId:'a',performance:{...state,reading:true}});
  return director;
 }
 const a=warm(),b=warm(),before=a.sample({dt:0,target:{x:1,y:0},targetId:'a',performance:state}).attention.x;
 const continued=a.sample({dt:.0001,target:{x:1,y:0},targetId:'a',performance:state}).attention.x;
 const retargeted=b.sample({dt:.0001,target:{x:-1,y:0},targetId:'b',performance:state}).attention.x;
 assert.ok(retargeted>before,'a C1 retarget retains the previous positive velocity before turning');
 assert.ok(Math.abs((continued-before)/.0001-(retargeted-before)/.0001)<.03);
 function run(rate){
  const director=createAttentionDirector({seed:1});let out;
  for(let i=0;i<2*rate;i++)out=director.sample({dt:1/rate,target:{x:.7,y:-.4},targetId:'fixed',performance:{...state,reading:true}});
  return {...out.attention};
 }
 const middle=run(60);for(const rate of [30,120]){const other=run(rate);approx(other.x,middle.x);approx(other.y,middle.y);}
});

test('attention priority and invalid timing clear motion and cap long frames',()=>{
 const director=createAttentionDirector({seed:1});
 for(const [args,phase] of [[{reducedMotion:true},'reduced'],[{performance:{...state,blocked:true}},'blocked'],
  [{performance:{...state,intent:'sleep'}},'sleep'],[{gestureActive:true},'gesture'],[{dt:NaN},'blocked'],
  [{dt:-1},'blocked'],[{target:{x:NaN,y:0}},'idle']]){
  director.sample({dt:.06,target:{x:1,y:1},performance:state});
  const out=director.sample({dt:.06,target:{x:1,y:1},performance:state,...args});
  assert.equal(out.phase,phase);assert.deepEqual(out.attention,{x:0,y:0});
 }
 const a=createAttentionDirector({seed:2}),b=createAttentionDirector({seed:2});
 assert.deepEqual(a.sample({dt:120,target:{x:30,y:-40},performance:state}),b.sample({dt:.06,target:{x:30,y:-40},performance:state}));
});

test('context blink closes fully, makes bilateral contact and reopens more slowly with a small eye lag',()=>{
 const blink=createContextBlink({seed:66}),samples=[];let out;
 for(let frame=0;frame<9000;frame++){
  out=blink.sample({dt:.001,performance:state,attention:tracking});
  if(out.blink)samples.push({at:frame*.001,...out.blink,phase:out.phase});
  if(out.cycles===1)break;
 }
 assert.equal(out.cycles,1);assert.equal(out.blink,null);
 const leftStart=samples.find(s=>s.left>0).at,rightStart=samples.find(s=>s.right>0).at;
 approx(rightStart-leftStart,.008,.002);
 const contact=samples.filter(s=>s.left===1&&s.right===1);
 assert.ok(contact.length>=35&&contact.length<=39,'both eyes must genuinely meet for about 37ms');
 const leftPeak=samples.find(s=>s.left===1).at,lastPeak=samples.findLast(s=>s.left===1).at;
 const leftOpen=samples.find(s=>s.at>lastPeak&&s.left===0).at;
 approx(leftPeak-leftStart,.075,.002);approx(leftOpen-lastPeak,.170,.002);
 assert.ok(leftOpen-lastPeak>2*(leftPeak-leftStart));
 for(const s of samples)assert.ok(s.left>=0&&s.left<=1&&s.right>=0&&s.right<=1);
});

test('overdue automatic blink waits for a gaze release instead of completing invisibly in the past',()=>{
 const blink=createContextBlink({seed:1}),held={...tracking,blinkHold:true,phase:'glance'};
 for(let i=0;i<600;i++){
  const out=blink.sample({dt:1/60,performance:state,attention:held});
  assert.equal(out.blink,null);assert.equal(out.cycles,0);
 }
 const release=blink.sample({dt:1/60,performance:state,attention:tracking});
 assert.equal(release.cycles,0,'elapsed hold time is not a completed blink');
 assert.ok(release.blink);assert.equal(release.phase,'closing');
 let peak=0,out=release;
 for(let i=0;i<24;i++){
  out=blink.sample({dt:1/60,performance:state,attention:tracking});
  peak=Math.max(peak,out.blink?.left||0);
 }
 assert.equal(peak,1);assert.equal(out.cycles,1);
});

test('context blink follows genuine settled shifts, honors refractory time and avoids reading-triggered shifts',()=>{
 const blink=createContextBlink({seed:12});
 blink.sample({dt:0,performance:state,attention:tracking});
 const waiting=blink.sample({dt:.06,performance:state,attention:{shiftId:2,phase:'anticipation',blinkHold:true}});
 assert.equal(waiting.blink,null);
 const starting=blink.sample({dt:.06,performance:state,attention:{shiftId:2,phase:'settling',blinkHold:false}});
 assert.ok(starting.blink);assert.equal(starting.cycles,0);
 let previous=false;const starts=[.12];
 for(let i=0;i<250;i++){
  const out=blink.sample({dt:.01,performance:state,attention:{shiftId:3+Math.floor(i/10),phase:'tracking',blinkHold:false}});
  if(out.blink&&!previous&&i>0)starts.push(.13+i*.01);
  previous=Boolean(out.blink);
 }
 assert.ok(starts.length>=2);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=1.79);
 const reading=createContextBlink({seed:12});
 for(let i=0;i<180;i++){
  const out=reading.sample({dt:.01,performance:{...state,reading:true},attention:{...tracking,shiftId:i}});
  assert.equal(out.blink,null);assert.equal(out.cycles,0);
 }
});

test('blink cycle timing is deterministic across frame rates and reuses its result and lid vector',()=>{
 function run(rate){
  const blink=createContextBlink({seed:'M66'});let result,lids,cycles=0,peak=0;
  for(let i=0;i<rate*24;i++){
   const out=blink.sample({dt:1/rate,performance:state,attention:tracking});
   if(result)assert.equal(out,result);result=out;
   if(out.blink){if(lids)assert.equal(out.blink,lids);lids=out.blink;peak=Math.max(peak,lids.left);}
   assert.ok(out.cycles>=cycles);cycles=out.cycles;
  }
  assert.equal(peak,1);assert.ok(cycles>=3&&cycles<=6);return cycles;
 }
 const middle=run(60);assert.equal(run(30),middle);assert.equal(run(120),middle);
});

test('blink priorities cancel a cycle without claiming completion and reject invalid dt',()=>{
 for(const [args,phase] of [[{gestureActive:true},'gesture'],[{reducedMotion:true},'reduced'],
  [{performance:{...state,intent:'sleep'}},'sleep'],[{performance:{...state,blocked:true}},'blocked'],
  [{dt:Infinity},'blocked'],[{dt:-.1},'blocked']]){
  const blink=createContextBlink({seed:1});
  blink.sample({dt:0,performance:state,attention:tracking});
  blink.sample({dt:.06,performance:state,attention:{...tracking,shiftId:2}});
  const closed=blink.sample({dt:.06,performance:state,attention:tracking});
  assert.ok(closed.blink);
  const cancelled=blink.sample({dt:.01,performance:state,attention:tracking,...args});
  assert.equal(cancelled.blink,null);assert.equal(cancelled.phase,phase);assert.equal(cancelled.cycles,0);
  for(let i=0;i<30;i++)assert.equal(blink.sample({dt:.01,performance:state,attention:tracking}).cycles,0);
 }
 const a=createContextBlink({seed:1}),b=createContextBlink({seed:1});
 assert.deepEqual(a.sample({dt:100,performance:state}),b.sample({dt:.06,performance:state}));
});

test('facial mixer preserves authored and legacy targets without inventing morph channels',()=>{
 const mixer=createFacialTargetMixer(),microFace={weights:{happy:.2,curious:.3,surprised:.1},eyelids:{left:.2,right:.15}};
 assert.equal(mixer.sample(),null);assert.deepEqual(mixer.sample({microFace}),microFace);
 const affect={envelope:.6,weights:{happy:.5,curious:.1,surprised:0},eyelids:{left:.47,right:.45}};
 const authored=mixer.sample({performance:{...state,intent:'play'},microFace,affect});
 assert.deepEqual(authored,{weights:affect.weights,eyelids:affect.eyelids});
 assert.notEqual(authored.weights,affect.weights);assert.notEqual(authored.eyelids,affect.eyelids);
 assert.deepEqual(Object.keys(authored.weights),['happy','curious','surprised']);
 for(const args of [{gestureActive:true},{reducedMotion:true},{performance:{...state,intent:'sleep'}},{performance:{...state,blocked:true}}]){
  assert.equal(mixer.sample({performance:state,microFace,affect,...args}),null);
 }
});

test('facial state creates restrained distinctive emotions and quiet bilateral tired lids',()=>{
 const mixer=createFacialTargetMixer();
 const play=structuredClone(mixer.sample({performance:{...state,intent:'play',valence:.8}}));
 const curiosity=structuredClone(mixer.sample({performance:{...state,intent:'investigate',focus:.9}}));
 assert.ok(play.weights.happy>curiosity.weights.happy);assert.ok(curiosity.weights.curious>play.weights.curious);
 const reading=mixer.sample({performance:{...state,intent:'play',valence:.8,reading:true}});
 approx(reading.weights.happy,play.weights.happy*.62);
 const resting=mixer.sample({performance:{...state,intent:'recover',energy:.1},
  microFace:{weights:{happy:.5,curious:.5,surprised:.5},eyelids:{left:1,right:0}}});
 assert.ok(resting.eyelids.left<=.35&&resting.eyelids.right<=.35);
 assert.ok(Math.abs(resting.eyelids.left-resting.eyelids.right)<=.04+1e-12);
});

test('facial result objects are reused and stay inside original morph and HAT rest budgets',()=>{
 const mixer=createFacialTargetMixer(),first=mixer.sample({performance:state}),weights=first.weights,eyelids=first.eyelids;
 const mesh={name:'OriginalFace',morphTargetDictionary:{Expr_Happy:0,Expr_Curious:1,Expr_Surprised:2},morphTargetInfluences:[0,0,0]};
 const original=createFacialV6({traverse:callback=>callback(mesh)});
 for(const microFace of [{weights:{happy:100,curious:100,surprised:100},eyelids:{left:100,right:100}},
  {weights:{happy:NaN,curious:Infinity,surprised:-1},eyelids:{left:NaN,right:Infinity}}]){
  for(const args of [{performance:{...state,intent:'play'},microFace},
   {microFace},{affect:{...microFace,envelope:1},performance:state}]){
   const out=mixer.sample(args);assert.equal(out,first);assert.equal(out.weights,weights);assert.equal(out.eyelids,eyelids);
   assert.ok(Object.values(weights).every(n=>Number.isFinite(n)&&n>=0&&n<=1));
   assert.ok(Object.values(weights).reduce((a,b)=>a+b,0)<=1+1e-10);
   assert.equal(original.setExpressionBlend(weights),true,'the original facial runtime must accept every mixed weight set');
   assert.ok(Object.values(eyelids).every(n=>Number.isFinite(n)&&n>=0&&n<=.55),'setRestBlink rejects lids above .55');
  }
 }
});
