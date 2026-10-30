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
