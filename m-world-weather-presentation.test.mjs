import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacterState} from './m-world-character-state.mjs';
import {weatherBehaviorProfile} from './m-world-weather-behavior.mjs';
import {makeWeatherDemo} from './m-world-weather.mjs';

const sun=weatherBehaviorProfile(makeWeatherDemo('sun'));
const rain=weatherBehaviorProfile(makeWeatherDemo('rain'));
const wind=weatherBehaviorProfile(makeWeatherDemo('wind'));
const observe={id:'autonomy-observe',kind:'expression',action:'rest',gesture:'curious',targetId:null,reason:'observe'};
const inspect={id:'autonomy-inspect',kind:'scene',action:'inspect',gesture:'curious',targetId:'card-a'};
const play={id:'autonomy-play',kind:'self-play',action:'rest',gesture:'paw',targetId:null,play:'ball'};
const recover={id:'autonomy-recover',kind:'rest',action:'rest',gesture:'none',targetId:null};
const sleep={id:'autonomy-sleep',kind:'rest',action:'rest',gesture:'sleep',targetId:null};
const established=['intent','phase','energy','mood','eventId','eventAge','reading','blocked'];
function advance(state,seconds,args={},rate=60,start=0){
 let out;for(let i=1;i<=Math.round(seconds*rate);i++)out=state.sample({dt:1/rate,nowMs:start+i*1000/rate,energy:.72,...args});
 return out;
}
function assertEstablished(a,b){for(const key of established)assert.equal(a[key],b[key],key);}


test('omitted or malformed forecast preserves exact legacy values and snapshot shape across existing intentions',()=>{
 for(const active of [null,observe,inspect,play,recover,sleep])for(const weather of [undefined,null,false,{},
  makeWeatherDemo('rain'),{...rain,focusOffset:NaN},{...rain,effortMultiplier:12}]){
  const baseline=createCharacterState(),subject=createCharacterState();
  for(let i=0;i<120;i++){
   const frame={dt:1/60,nowMs:i*1000/60,energy:.72,active};
   assert.deepEqual(subject.sample({...frame,weather}),baseline.sample(frame));
   assert.deepEqual(subject.snapshot(),baseline.snapshot());
   assert.ok(!Object.hasOwn(subject.snapshot(),'weatherContext'));
  }
 }
});

test('forecast changes presentation through existing filters without changing accepted intent or physical energy',()=>{
 const baseline=createCharacterState(),subject=createCharacterState();
 const a=advance(baseline,3,{active:inspect}),b=advance(subject,3,{active:inspect,weather:rain});
 assertEstablished(a,b);
 assert.ok(b.arousal>a.arousal&&b.focus>a.focus,'shared attention/arousal respond to the same cached rain profile');
 assert.ok(b.valence<a.valence,'rain does not manufacture the same comfortable presentation as clear weather');
 assert.equal(subject.snapshot().weatherContext,rain);
 assert.ok(Object.isFrozen(subject.snapshot().weatherContext));
});

test('a forecast switch during accepted activity has no instantaneous position jump and a bounded first step',()=>{
 const state=createCharacterState();advance(state,3,{active:observe,weather:sun});
 const before={...state.snapshot()};
 const zero={...state.sample({dt:0,nowMs:3000,energy:.72,active:observe,weather:wind})};
 for(const key of ['arousal','focus','valence'])assert.equal(zero[key],before[key],key+' at zero elapsed time');
 const step={...state.sample({dt:1/60,nowMs:3017,energy:.72,active:observe,weather:wind})};
 for(const key of ['arousal','focus','valence'])assert.ok(Math.abs(step[key]-before[key])<.012,key+' first step');
 assert.equal(step.intent,'observe');assert.equal(step.eventId,null);assert.equal(step.energy,.72);
 assert.equal(state.snapshot().weatherContext,wind);
});

test('weather-blended arousal, focus and valence remain stable across 30, 60 and 120 Hz',()=>{
 function run(rate){const state=createCharacterState();advance(state,2,{active:inspect,weather:sun},rate);advance(state,2,{active:inspect,weather:rain},rate,2000);return {...advance(state,2,{active:observe,weather:wind},rate,4000)};}
 const reference=run(60);
 for(const rate of [30,120]){
  const value=run(rate);assertEstablished(value,reference);
  for(const key of ['arousal','focus','valence'])assert.ok(Math.abs(value[key]-reference[key])<.012,rate+':'+key);
 }
});

test('sleep and recovery keep exact existing targets and do not report an applied forecast context',()=>{
 for(const active of [sleep,recover])for(const weather of [sun,rain,wind]){
  const baseline=createCharacterState(),subject=createCharacterState();
  for(let i=0;i<150;i++){
   const args={dt:1/60,nowMs:i*1000/60,energy:.33,active};
   assert.deepEqual(subject.sample({...args,weather}),baseline.sample(args));
   assert.deepEqual(subject.snapshot(),baseline.snapshot());
   assert.ok(!Object.hasOwn(subject.snapshot(),'weatherContext'));
  }
 }
});

test('input, accessibility and invalid clocks suppress both offsets and previously applied weather diagnostics immediately',()=>{
 for(const blocked of [{typing:true},{scrolling:true},{hidden:true},{reducedMotion:true},{dt:NaN},{dt:-1},{nowMs:NaN}]){
  const state=createCharacterState();advance(state,1,{active:inspect,weather:rain});
  assert.equal(state.snapshot().weatherContext,rain);
  const out=state.sample({dt:1/60,nowMs:1017,active:inspect,energy:.72,weather:wind,...blocked});
  assert.equal(out.blocked,true);assert.equal(out.phase,'blocked');
  assert.equal(out.arousal+out.focus+Math.abs(out.valence),0);
  assert.equal(out.eventId,null);assert.ok(!Object.hasOwn(state.snapshot(),'weatherContext'));
 }
});

test('weather remains under existing low-energy arousal and quiet-reading focus caps',()=>{
 for(const energy of [0,.05,.2,.7,1]){
  const state=createCharacterState(),out=advance(state,4,{energy,active:inspect,nearCard:true,reading:true,weather:wind});
  assert.ok(out.arousal<=(.035+.76*energy)*.35+1e-10);
  assert.ok(out.focus<=.65+1e-10);assert.equal(out.phase,'reading');assert.equal(out.reading,true);
  assert.ok(out.valence>=-1&&out.valence<=1);assert.equal(out.energy,energy);
 }
});

test('changing the forecast cannot create an experience, achievement, waking or a completed action',()=>{
 const state=createCharacterState();
 for(let i=1;i<=600;i++){
  const out=state.sample({dt:1/60,nowMs:i*1000/60,energy:.8,weather:[sun,rain,wind][Math.floor(i/50)%3]});
  assert.equal(out.intent,'idle');assert.equal(out.eventId,null);assert.equal(out.eventAge,0);
  assert.notEqual(out.phase,'waking');assert.notEqual(out.phase,'settling');
 }
 assert.equal(state.record({decision:play,status:'proposed',at:11000}),false);
 assert.equal(state.snapshot().eventId,null);
});

test('only actual acknowledged completion carries through a later forecast without rewriting outcome identity',()=>{
 const baseline=createCharacterState(),subject=createCharacterState();
 for(const state of [baseline,subject]){
  advance(state,1,{active:inspect});assert.equal(state.record({decision:inspect,status:'complete',at:1000}),true);
 }
 const a=advance(baseline,2,{},60,1000),b=advance(subject,2,{weather:rain},60,1000);
 assertEstablished(a,b);assert.equal(b.intent,'reflect');assert.equal(b.eventId,inspect.id+':complete');
 assert.equal(subject.record({decision:inspect,status:'complete',at:3100}),false,'forecast cannot grant a duplicate receipt');
 const cancelled=createCharacterState();cancelled.record({decision:sleep,status:'cancelled',at:0});
 const failed=advance(cancelled,1,{weather:sun});
 assert.equal(failed.intent,'idle');assert.equal(failed.eventId,sleep.id+':cancelled');assert.notEqual(failed.intent,'wake');
});

test('output and cached profile are reused, invalidation clears metadata, and reset removes all weather carry',()=>{
 const state=createCharacterState(),first=state.sample({dt:1/60,nowMs:17,energy:.7,weather:rain});
 const original=structuredClone(rain);
 for(let i=2;i<100;i++){
  assert.equal(state.sample({dt:1/60,nowMs:i*17,energy:.7,weather:rain}),first);
  assert.equal(state.snapshot().weatherContext,rain);
 }
 assert.deepEqual(rain,original);
 state.sample({dt:0,nowMs:1700,energy:.7,weather:null});
 assert.ok(!Object.hasOwn(state.snapshot(),'weatherContext'));
 state.sample({dt:1/60,nowMs:1717,energy:.7,weather:wind});assert.equal(state.snapshot().weatherContext,wind);
 state.reset();assert.ok(!Object.hasOwn(state.snapshot(),'weatherContext'));
 const baseline=createCharacterState();assert.deepEqual(state.sample(),baseline.sample());
 assert.deepEqual(state.snapshot(),baseline.snapshot());
});
