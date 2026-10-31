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
