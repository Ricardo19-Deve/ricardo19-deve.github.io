import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SLEEP_DURATION,SLEEP_TIMELINE,SLEEP_BREATHS_PER_MINUTE,SLEEP_STAGE_ROLL,sampleSleep,sleepPhase} from './m-world-sleep.mjs';
import {GESTURE_DURATIONS,GESTURE_PHASES,sampleGesture} from './m-world-acting.mjs';
import {sampleEmbodiedRest} from './m-world-rest-pose.mjs';

const magnitude=pose=>Math.hypot(...Object.values(pose).flat());
const tail=pose=>Array.from({length:10},(_,i)=>pose['Tail.'+String(i+1).padStart(2,'0')]);

test('V71 the nap is one timeline shared by the gesture, the acting phases and the stage',()=>{
 assert.equal(GESTURE_DURATIONS.sleep,SLEEP_DURATION);
 assert.deepEqual([...GESTURE_PHASES.sleep],[SLEEP_TIMELINE.settle,SLEEP_TIMELINE.sleep]);
 const phases=[];
 for(let i=1;i<1000;i++){const phase=sleepPhase(i/1000);if(phases.at(-1)!==phase)phases.push(phase);}
 assert.deepEqual(phases,['winding-down','settling','sleeping','waking']);
 assert.equal(sampleSleep({age:0}),null);assert.equal(sampleSleep({age:SLEEP_DURATION}),null);
 assert.equal(sampleSleep({age:NaN}),null);
});

test('V71 M curls up while asleep: spine, head, knees and a tail wrapped around the body',()=>{
 const asleep=sampleSleep({age:SLEEP_DURATION*.55,side:1});
 assert.equal(asleep.phase,'sleeping');
 for(const bone of ['Body','Chest','Neck','Head'])assert.ok(asleep.pose[bone][0]>.1,bone+' bends forward');
 assert.ok(asleep.pose['Leg.L'][0]>.3&&asleep.pose['Leg.R'][0]>.3,'knees drawn up');
 const curl=tail(asleep.pose).map(a=>a[2]);
 assert.ok(curl[0]<-.2&&curl[9]>.3,'the tail drops beside the body, then its outer half curls back underneath');
 assert.ok(Math.abs(asleep.stage.rotationZ)<=SLEEP_STAGE_ROLL+1e-9&&SLEEP_STAGE_ROLL<.35,'no rigid 76-degree tilt of the whole body');
});

test('V71 the tail curl is the same on both sides; the body roll mirrors',()=>{
 const left=sampleSleep({age:11,side:1}),right=sampleSleep({age:11,side:-1});
 assert.deepEqual(tail(left.pose),tail(right.pose),'the tail always leaves the body on the same side');
 assert.equal(left.stage.rotationZ,-right.stage.rotationZ);
 assert.equal(left.pose.Head[2],-right.pose.Head[2]);
});

test('V71 eyes: two heavy blinks while winding down, closed through sleep, reopening on waking',()=>{
 const at=p=>sampleSleep({age:p*SLEEP_DURATION});
 for(let p=SLEEP_TIMELINE.settle;p<SLEEP_TIMELINE.sleep;p+=.01){
  assert.equal(at(p).blink.left,1,'left closed at '+p);assert.equal(at(p).blink.right,1,'right closed at '+p);
 }
 const winding=Array.from({length:200},(_,i)=>at(.02+i*.0009).blink.left);
 let peaks=0;for(let i=1;i<winding.length-1;i++)if(winding[i]>.5&&winding[i]>=winding[i-1]&&winding[i]>winding[i+1])peaks++;
 assert.equal(peaks,2,'two heavy blinks before the eyes close');
 assert.ok(at(.97).blink.left<.05&&at(.97).blink.right<.05,'eyes open again before the end');
});

test(`V71 breathing is slow and natural (about ${SLEEP_BREATHS_PER_MINUTE} breaths a minute) and lives in the chest`,()=>{
 const start=SLEEP_TIMELINE.settle*SLEEP_DURATION+1,end=SLEEP_TIMELINE.sleep*SLEEP_DURATION-1,step=1/60;
 const chest=[];for(let t=start;t<=end;t+=step)chest.push(sampleSleep({age:t}).pose.Chest[0]);
 const mean=chest.reduce((a,b)=>a+b,0)/chest.length;
 let crossings=0;for(let i=1;i<chest.length;i++)if((chest[i-1]-mean)*(chest[i]-mean)<0)crossings++;
 const perMinute=crossings/2/((end-start)/60);
 assert.ok(perMinute>10&&perMinute<18,'breaths per minute '+perMinute.toFixed(1));
 const swing=Math.max(...chest)-Math.min(...chest);
 assert.ok(swing>.03&&swing<.12,'visible but gentle chest movement '+swing.toFixed(3));
 const scales=Array.from({length:101},(_,i)=>sampleSleep({age:start+(end-start)*i/100}).stage.scale);
 assert.ok(Math.max(...scales)-Math.min(...scales)<1e-9,'no whole-body scale breathing');
});

test('V71 starts and ends at rest with zero slope and never pops between frames',()=>{
 for(const side of [-1,1]){
  for(const age of [1e-4,SLEEP_DURATION-1e-4]){
   const nap=sampleSleep({age,side});
   assert.ok(magnitude(nap.pose)<1e-6,'no pose at the boundary');
   assert.ok(nap.blink.left<1e-6&&nap.blink.right<1e-6);
   for(const value of Object.values(nap.stage))assert.ok(Math.abs(value-(value>.5?1:0))<1e-6);
  }
  let previous=sampleSleep({age:1/240,side});
  for(let frame=2;frame<SLEEP_DURATION*240;frame++){
   const nap=sampleSleep({age:frame/240,side});
   for(const [bone,angles]of Object.entries(nap.pose)){
    assert.ok(angles.every(a=>Math.abs(a)<=.9));
    if(bone.startsWith('Arm.'))assert.ok(Math.hypot(...angles)<.25,'shoulders stay inside the skin limit');
    const before=previous.pose[bone]||[0,0,0];
    assert.ok(Math.hypot(...angles.map((a,i)=>a-before[i]))<.02,`${bone} jumps at ${frame/240}s`);
   }
   assert.ok(Math.abs(nap.stage.rotationZ-previous.stage.rotationZ)<.002);
   previous=nap;
  }
 }
});

test('V71 reduced motion keeps M still: no nap sequence and no stage motion',()=>{
 const reduced=sampleGesture({name:'sleep',age:11,reducedMotion:true});
 assert.deepEqual(reduced.pose,{});assert.equal(reduced.blink,null);
 const stage=sampleEmbodiedRest({name:'sleep',age:11,reducedMotion:true});
 assert.equal(stage.weight,0);assert.equal(stage.rotationZ,0);assert.equal(stage.scale,1);
});

test('V71 the phone model keeps working morph targets (lids can close, expressions move)',()=>{
 const glb=readFileSync(new URL('assets/m-v7-web/m-mobile-v71.bin',import.meta.url));
 const jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8'));
 const FLOAT=5126;let checked=0;
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
  if(!primitive.targets?.length)continue;
  const quantizedBase=gltf.accessors[primitive.attributes.POSITION].componentType!==FLOAT;
  for(const target of primitive.targets){
   if(target.POSITION===undefined)continue;
   const quantizedTarget=gltf.accessors[target.POSITION].componentType!==FLOAT;
   // A quantized POSITION gets a dequantization scale on its node: the targets must share it.
   assert.equal(quantizedTarget,quantizedBase,mesh.name+' morph targets must match the POSITION encoding');
   checked++;
  }
 }
 assert.ok(checked>=40,'all lid, lash and expression targets were checked ('+checked+')');
});
