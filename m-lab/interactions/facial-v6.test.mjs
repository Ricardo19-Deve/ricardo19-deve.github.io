// Run with: node --test m-lab/interactions/facial-v6.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFacialV6} from './facial-v6.mjs';

function fixture() {
 const body={name:'M_BODY',morphTargetDictionary:{
  Shoulder_Propulsion_Corrective:0,Shoulder_Glide_Corrective:1,
  Expr_Happy:2,Expr_Curious:3,Expr_Surprised:4
 },morphTargetInfluences:[.75,.25,0,0,0]};
 const mkEye=name=>({name,morphTargetDictionary:{Half_Closed:0,Closed:1,Pre_Close:2,
  Close_10:3,Close_20:4,Close_30:5,Close_40:6},morphTargetInfluences:Array(7).fill(0)});
 const l=mkEye('L'),r=mkEye('R');
 const root={traverse:fn=>[body,l,r].forEach(fn)};
 const makeClip=(name,meshName)=>({
  name,duration:2,tracks:[{
   name:meshName+'.morphTargetInfluences',
   times:[0,.5,1.05],values:new Float32Array(21),
   createInterpolant(){return {evaluate(t){
    const amount=t<=.5?t/.5:Math.max(0,1-(t-.5)/.55);
    return new Float32Array([amount,amount,0,0,0,0,0]);
   }};}
  }]
 });
 return {body,l,r,root,clips:[makeClip('M_LeftBlink_V4','L'),makeClip('M_RightBlink_V1','R')]};
}

test('V6 facial expressions preserve both animated shoulder correctives',()=>{
 const f=fixture(),rig=createFacialV6(f.root,f.clips);
 assert.deepEqual(rig.diagnostics().expressions,['neutral','happy','curious','surprised']);
 assert.equal(rig.setExpression('happy'),true);
 rig.update(1,1000);
 assert.ok(f.body.morphTargetInfluences[2]>.99);
 assert.equal(f.body.morphTargetInfluences[0],.75);
 assert.equal(f.body.morphTargetInfluences[1],.25);
 rig.setExpression('surprised');rig.update(1,2000);
 assert.ok(f.body.morphTargetInfluences[4]>.99);
 assert.ok(f.body.morphTargetInfluences[2]<.01);
 assert.equal(f.body.morphTargetInfluences[0],.75);
});

test('independent left/right blink samples never overwrite the other eye',()=>{
 const f=fixture(),rig=createFacialV6(f.root,f.clips);
 assert.equal(rig.hasBlink('left'),true);
 assert.equal(rig.hasBlink('right'),true);
 rig.setBlink('left',1);rig.update(.1,0);
 assert.ok(f.l.morphTargetInfluences[1]>.9);
 assert.equal(f.r.morphTargetInfluences[1],0);
 rig.setBlink('right',1);rig.update(.1,1);
 assert.ok(f.r.morphTargetInfluences[1]>.9);
 rig.setBlink('left',0);rig.update(.1,2);
 assert.equal(f.l.morphTargetInfluences[1],0);
 assert.ok(f.r.morphTargetInfluences[1]>.9);
});

test('blink playback and expression run on independent tracks',()=>{
 const f=fixture(),rig=createFacialV6(f.root,f.clips);
 rig.setExpression('curious');
 rig.blink('left',100);
 rig.update(.5,500);
 assert.ok(f.body.morphTargetInfluences[3]>.9);
 assert.ok(f.l.morphTargetInfluences[1]>0);
 assert.equal(f.r.morphTargetInfluences[1],0);
 assert.equal(f.body.morphTargetInfluences[0],.75);
});

test('missing eye clips disable only their own controls',()=>{
 const f=fixture(),rig=createFacialV6(f.root,[f.clips[0]]);
 assert.equal(rig.hasBlink('left'),true);
 assert.equal(rig.hasBlink('right'),false);
 assert.equal(rig.blink('right',100),false);
 assert.equal(rig.setExpression('neutral'),true);
});

function hatFixture(){
 const f=fixture(),dict=f.l.morphTargetDictionary,knots=[['Pre_Close',.02],['Close_10',.1],['Close_20',.2],['Close_30',.3],['Close_40',.4],['Half_Closed',.5],['Closed',1]];
 const samples=[[0,0],[.4,0],[.42,.02],[.44,.1],[.46,.2],[.48,.3],[.5,.4],[.52,.5],[.56,1],[.62,1],[.86,0],[2,0]];
 const weights=control=>{
  const result=new Float32Array(7);let prior=0,priorName=null;
  for(const [name,knot]of knots){
   if(control<=knot){const alpha=(control-prior)/(knot-prior);if(priorName)result[dict[priorName]]=1-alpha;result[dict[name]]=alpha;return result;}
   prior=knot;priorName=name;
  }
  result[dict.Closed]=1;return result;
 };
 for(const clip of f.clips){
  const track=clip.tracks[0];track.times=samples.map(p=>p[0]);track.values=new Float32Array(track.times.length*7);
  track.createInterpolant=()=>({evaluate(t){
   if(t<=0)return weights(0);
   for(let i=1;i<samples.length;i++){const [tb,b]=samples[i],[ta,a]=samples[i-1];if(t<=tb)return weights(a+(b-a)*(t-ta)/(tb-ta));}
   return weights(0);
  }});
 }
 return {...f,knots};
}
test('seven-key manual half closure maps to Half_Closed instead of the source open hold',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);rig.setIntensity(1);
 assert.equal(rig.diagnostics().leftBlinkControl,'seven-key-hat');
 rig.setBlink('left',.5);rig.update(.1,100);
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Half_Closed]>.99999);
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]<.00001);
 assert.ok(f.r.morphTargetInfluences.every(v=>v===0));
 assert.equal(f.body.morphTargetInfluences[0],.75);
});
test('manual closure reconstructs every actual HAT knot and reaches full closure',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 for(const amount of [0,.02,.1,.2,.3,.4,.5,.75,1]){
  rig.setBlink('left',amount);rig.update(.01,100);
  const actual=f.knots.reduce((sum,[name,knot])=>sum+f.l.morphTargetInfluences[f.l.morphTargetDictionary[name]]*knot,0);
  assert.ok(Math.abs(actual-amount)<.00001,'control '+amount+' recovered '+actual);
 }
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]>.99999);
});
test('automatic blink preserves source close, contact and reopen timing without compression',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 assert.equal(rig.diagnostics().leftBlinkDurationMs,2000);
 rig.blink('left',1000);
 rig.update(.1,1300);assert.ok(f.l.morphTargetInfluences.every(v=>v===0),'source open hold must remain open');
 rig.update(.1,1560);assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]>.99999);
 rig.update(.1,1600);assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]>.99999,'source contact interval must be retained');
 rig.update(.1,1740);assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Half_Closed]>.99999,'source reopen half state');
 rig.update(.1,1860);assert.ok(f.l.morphTargetInfluences.every(v=>Math.abs(v)<.00001));
 rig.update(.1,3100);assert.ok(f.l.morphTargetInfluences.every(v=>v===0));
});
test('non-HAT synthetic clips retain generic control behavior',()=>{
 const f=fixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 assert.equal(rig.diagnostics().leftBlinkControl,'generic');
 rig.setBlink('left',.5);rig.update(.1,0);
 assert.ok(f.l.morphTargetInfluences[1]>.45&&f.l.morphTargetInfluences[1]<.55);
});

test('gesture wink overrides an already running auto blink with gradual independent HAT closure',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);
 rig.update(.01,0);rig.update(.01,2400);rig.update(.01,2960);
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]>.99,'automatic blink is already closed');
 for(const amount of [0,.1,.3,.5,.75,1,.75,.5,.3,.1,0]){
  assert.equal(rig.setGestureBlink({left:amount,right:0}),true);rig.update(.016,3000);
  const closure=f.knots.reduce((sum,[name,knot])=>sum+f.l.morphTargetInfluences[f.l.morphTargetDictionary[name]]*knot,0);
  assert.ok(Math.abs(closure-amount)<1e-5,`${closure} != ${amount}`);
  assert.ok(f.r.morphTargetInfluences.every(value=>value===0));
  assert.equal(f.body.morphTargetInfluences[0],.75);assert.equal(f.body.morphTargetInfluences[1],.25);
 }
 assert.equal(rig.diagnostics().gestureBlinkActive,true);
 rig.setGestureBlink(null);rig.update(.016,3100);
 assert.equal(rig.diagnostics().gestureBlinkActive,false);
 assert.ok(f.l.morphTargetInfluences.every(value=>value===0),'release must not resume a cancelled clip in the middle');
 rig.update(.016,5500);rig.update(.016,6060);
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]>.99,'automatic blink must resume after release');
});

test('gesture release preserves existing manual controls and disabled auto-blink preference',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 rig.setBlink('left',.5);rig.setGestureBlink({left:0,right:1});rig.update(.1,100);
 assert.ok(f.l.morphTargetInfluences.every(value=>value===0));
 assert.ok(f.r.morphTargetInfluences[f.r.morphTargetDictionary.Closed]>.99);
 rig.setGestureBlink(null);rig.update(.1,200);
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Half_Closed]>.99);
 assert.ok(f.r.morphTargetInfluences.every(value=>value===0));
 rig.update(.1,5000);rig.update(.1,7400);rig.update(.1,7960);
 assert.ok(f.l.morphTargetInfluences[f.l.morphTargetDictionary.Half_Closed]>.99);
 assert.ok(f.r.morphTargetInfluences.every(value=>value===0));
 for(const invalid of [{left:NaN,right:0},{left:0},{left:'1',right:0},false])assert.equal(rig.setGestureBlink(invalid),false);
});

test('closure diagnostics observe actual current mesh weights rather than the requested control',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 rig.setGestureBlink({left:.5,right:0});rig.update(.1,100);
 assert.ok(Math.abs(rig.diagnostics().leftClosure-.5)<1e-5);
 assert.equal(rig.diagnostics().rightClosure,0);
 f.l.morphTargetInfluences.fill(0);f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]=.75;
 assert.equal(rig.diagnostics().leftClosure,.75,'must read a changed actual influence independently of desired .5');
 f.l.morphTargetInfluences[f.l.morphTargetDictionary.Closed]=NaN;
 assert.equal(rig.diagnostics().leftClosure,null);
 const absent=createFacialV6(f.root,[]);
 assert.equal(absent.diagnostics().leftClosure,null);assert.equal(absent.diagnostics().rightClosure,null);
});

test('bounded expression blends preserve shoulder slots and legacy expression controls',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);rig.setIntensity(2.5);
 rig.setExpression('surprised');rig.update(2,0);
 assert.ok(f.body.morphTargetInfluences[4]>2.4,'legacy intensity is deliberately preserved');
 assert.equal(rig.setExpressionBlend({happy:.5,curious:.3,surprised:.1}),true);rig.update(2,100);
 const actual=f.body.morphTargetInfluences.slice(2);
 assert.ok(actual.reduce((a,b)=>a+b,0)<=1);
 assert.ok(Math.abs(actual[0]-.5)<.00001);assert.ok(Math.abs(actual[1]-.3)<.00001);
 assert.equal(rig.diagnostics().extrapolatingExpressions,false);
 assert.deepEqual(f.body.morphTargetInfluences.slice(0,2),[.75,.25]);
 for(const invalid of [{happy:NaN},{happy:2},{happy:.8,curious:.5},{Closed:1},[],false])
  assert.equal(rig.setExpressionBlend(invalid),false);
 rig.setExpressionBlend(null);rig.setExpression('happy');rig.update(2,200);
 assert.ok(f.body.morphTargetInfluences[2]>2.4);
 assert.equal(rig.diagnostics().expressionBlendActive,false);
 assert.deepEqual(f.body.morphTargetInfluences.slice(0,2),[.75,.25]);
});

test('resting eyelids blend smoothly through original HATs and preserve source blink contact',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 assert.equal(rig.setRestBlink({left:.3,right:.2}),true);
 rig.update(.016,0);
 assert.ok(rig.diagnostics().leftClosure>0&&rig.diagnostics().leftClosure<.1,'rest must not snap on');
 rig.update(2,100);
 assert.ok(Math.abs(rig.diagnostics().leftClosure-.3)<1e-5);
 assert.ok(Math.abs(rig.diagnostics().rightClosure-.2)<1e-5);
 rig.blink('left',1000);rig.update(.016,1560);
 assert.ok(rig.diagnostics().leftClosure>.99999,'original full contact overrides a quiet rest');
 rig.update(.016,1600);assert.ok(rig.diagnostics().leftClosure>.99999);
 rig.update(.016,1860);assert.ok(Math.abs(rig.diagnostics().leftClosure-.3)<1e-5,'reopening settles onto the original curved HAT rest');
 rig.setRestBlink(null);rig.update(.016,1900);
 assert.ok(rig.diagnostics().leftClosure>0&&rig.diagnostics().leftClosure<.3,'release must fade');
 rig.update(3,5000);assert.ok(rig.diagnostics().leftClosure<1e-8);assert.ok(rig.diagnostics().rightClosure<1e-8);
 for(const invalid of [{left:.8,right:0},{left:NaN,right:0},{left:.2},false,[]])
  assert.equal(rig.setRestBlink(invalid),false);
});

test('explicit wink owns both eyes over rest and restores independent manual/rest controls',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 rig.setRestBlink({left:.2,right:.3});rig.setBlink('left',.5);rig.update(2,100);
 assert.ok(Math.abs(rig.diagnostics().leftClosure-.5)<1e-5);
 rig.setGestureBlink({left:0,right:1});rig.update(.016,120);
 assert.equal(rig.diagnostics().leftClosure,0);assert.ok(rig.diagnostics().rightClosure>.99999);
 rig.setGestureBlink(null);rig.update(.016,140);
 assert.ok(Math.abs(rig.diagnostics().leftClosure-.5)<1e-5);
 assert.ok(Math.abs(rig.diagnostics().rightClosure-.3)<1e-5);
 rig.setRestBlink(null);rig.update(3,5000);
 assert.ok(Math.abs(rig.diagnostics().leftClosure-.5)<1e-5);assert.equal(rig.diagnostics().rightClosure,0);
 assert.deepEqual(f.body.morphTargetInfluences.slice(0,2),[.75,.25]);
});

test('new resting control fails locally on unavailable HATs without breaking generic blink playback',()=>{
 const f=fixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);
 assert.equal(rig.setRestBlink({left:.2,right:0}),false);
 rig.setBlink('left',.5);rig.update(.1,0);assert.ok(f.l.morphTargetInfluences[1]>.45);
 const partial=hatFixture(),leftOnly=createFacialV6(partial.root,[partial.clips[0]]);
 assert.equal(leftOnly.setRestBlink({left:.2,right:0}),true);
 assert.equal(leftOnly.setRestBlink({left:0,right:.2}),false);
});

test('expression diagnostics read changed mesh influences instead of the requested target',()=>{
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setAutoBlink(false);rig.setIntensity(1);
 rig.setExpressionBlend({happy:.6,curious:.2});rig.update(1,0);
 f.body.morphTargetInfluences[2]=.123;
 assert.equal(rig.diagnostics().expressionWeights.happy,.123);
 assert.equal(rig.diagnostics().expressionTarget.happy,.6);
 f.body.morphTargetInfluences[3]=NaN;
 assert.equal(rig.diagnostics().expressionWeights.curious,null);
});
test('repeated affect, original blink and shoulder animation cycles return to the original neutral face',async()=>{
 const {M_AFFECTS,AFFECT_DURATIONS,sampleAffect}=await import('../../m-world-affect.mjs');
 const f=hatFixture(),rig=createFacialV6(f.root,f.clips);rig.setIntensity(1);
 let now=100;
 for(let cycle=0;cycle<3;cycle++)for(const name of M_AFFECTS.filter(name=>name!=='neutral')){
  const duration=AFFECT_DURATIONS[name];
  for(let frame=0;frame<=180;frame++){
   const pose=sampleAffect({name,age:duration*frame/180});
   rig.setExpressionBlend(pose.envelope>0?pose.weights:null);rig.setRestBlink(pose.envelope>0?pose.eyelids:null);
   const wink=frame>=70&&frame<=100?{left:(frame-70)/30,right:0}:null;rig.setGestureBlink(wink);
   const correctives=[.5+.3*Math.sin(frame*.04),.4+.2*Math.cos(frame*.05)];
   f.body.morphTargetInfluences[0]=correctives[0];f.body.morphTargetInfluences[1]=correctives[1];
   rig.update(duration/180,now);now+=duration/180*1000;
   assert.deepEqual(f.body.morphTargetInfluences.slice(0,2),correctives);
   assert.ok(f.body.morphTargetInfluences.slice(2).reduce((a,b)=>a+b,0)<=1+1e-6);
   for(const eye of [f.l,f.r]){
    assert.ok(eye.morphTargetInfluences.every(value=>value>=-1e-6&&value<=1+1e-6));
    assert.ok(eye.morphTargetInfluences.reduce((a,b)=>a+b,0)<=1+1e-6);
   }
   if(wink)assert.ok(rig.diagnostics().rightClosure<1e-8,'wink ownership opens the opposite eye despite affect rest');
  }
 }
 rig.setGestureBlink(null);rig.setRestBlink(null);rig.setExpressionBlend(null);rig.setExpression('neutral');rig.setAutoBlink(false);
 // Finish any original clip still playing, then observe the actual restored meshes.
 rig.update(5,now+6000);rig.update(1,now+7000);
 assert.ok(f.body.morphTargetInfluences.slice(2).every(value=>value<1e-8));
 assert.ok(f.l.morphTargetInfluences.every(value=>Math.abs(value)<1e-8));
 assert.ok(f.r.morphTargetInfluences.every(value=>Math.abs(value)<1e-8));
});