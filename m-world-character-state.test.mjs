import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_INTENTS,creatureEnergy,createCharacterState} from './m-world-character-state.mjs';
const play={id:'autonomy-1',kind:'self-play',action:'rest',play:'ball',gesture:'paw',targetId:null};
const inspect={id:'autonomy-2',kind:'scene',action:'inspect',gesture:'curious',targetId:'project-a'};
const sleep={id:'autonomy-3',kind:'rest',action:'rest',gesture:'sleep',targetId:null};
function advance(state,seconds,options={},rate=60,start=0){
 let value;for(let i=1;i<=Math.round(seconds*rate);i++)value=state.sample({...options,dt:1/rate,nowMs:start+i*1000/rate});return value;
}
test('physical energy depends on fatigue, not visitor pace',()=>{
 assert.equal(creatureEnergy(),.82);
 assert.ok(Math.abs(creatureEnergy({fatigue:.4})-.42)<1e-12);
 assert.equal(creatureEnergy({fatigue:10}),.2);
 assert.equal(creatureEnergy({fatigue:-1}),.94);
 for(const bad of [NaN,Infinity,undefined,'fast'])assert.equal(creatureEnergy({fatigue:bad}),.82);
 assert.equal(creatureEnergy({fatigue:.2,visitorPace:0}),creatureEnergy({fatigue:.2,visitorPace:1}));
});
test('accepted intent is expressive but never creates an experience',()=>{
 const state=createCharacterState(),first=state.sample({dt:1/60,active:play});
 assert.equal(first.intent,'play');assert.equal(first.phase,'anticipation');assert.equal(first.eventId,null);
 const active=advance(state,2,{active:play,energy:.85});
 assert.equal(active.mood,'happy');assert.equal(active.phase,'engaged');assert.equal(active.eventId,null);
 assert.ok(active.valence>.6&&active.arousal>.4);
 for(const status of ['accepted','rejected','reserved','pending'])assert.equal(state.record({decision:play,status,at:2100}),false);
 assert.equal(state.snapshot().eventId,null);
});
test('only acknowledged outcomes create bounded carry and duplicate terminal events are ignored',()=>{
 const state=createCharacterState();
 for(const event of [null,false,0,'complete',[]])assert.equal(state.record(event),false);
 assert.equal(state.record({decision:play,status:'complete',at:1000}),true);
 assert.equal(state.record({decision:play,status:'complete',at:1200}),false);
 assert.equal(state.record({decision:play,status:'failed',at:1300}),false);
 const carried=advance(state,2,{energy:.8},60,1000);
 assert.equal(carried.intent,'reflect');assert.equal(carried.phase,'settling');assert.equal(carried.mood,'happy');
 assert.equal(carried.eventId,'autonomy-1:complete');assert.ok(carried.valence>.25);
 const ended=advance(state,13,{energy:.8},60,3000);
 assert.equal(ended.intent,'idle');assert.equal(ended.eventId,null);assert.ok(ended.valence<.12);
});
test('completed inspection carries curiosity; actual rest wakes gently; failures never manufacture rest or achievement',()=>{
 const curious=createCharacterState();curious.record({decision:inspect,status:'complete',at:0});
 assert.equal(advance(curious,1).mood,'curious');
 const rested=createCharacterState();rested.record({decision:sleep,status:'complete',at:0});
 assert.equal(advance(rested,1).intent,'wake');assert.equal(rested.snapshot().phase,'waking');
 const napping=createCharacterState();assert.equal(advance(napping,1,{active:sleep}).intent,'sleep');
 for(const status of ['failed','cancelled']){
  const state=createCharacterState();state.record({decision:sleep,status,at:0});
  const failed=advance(state,1);assert.equal(failed.intent,'idle');assert.equal(failed.phase,'interrupted');
  assert.equal(failed.mood,'neutral');assert.ok(failed.valence<=0);assert.notEqual(failed.intent,'wake');
 }
});
test('completion carry is continuous through a compatible new intention',()=>{
 const state=createCharacterState();advance(state,1,{active:play,energy:.8});
 state.record({decision:play,status:'complete',at:1000});const before={...state.sample({dt:0,nowMs:1000})};
 const after=state.sample({dt:1/60,nowMs:1017,active:inspect,energy:.8});
 for(const key of ['arousal','focus','valence'])assert.ok(Math.abs(after[key]-before[key])<.06,key);
 assert.equal(after.intent,'investigate');assert.equal(after.eventId,'autonomy-1:complete');
});
test('30/60/120 Hz simulations preserve bounded, deterministic emotional continuity',()=>{
 const run=rate=>{const state=createCharacterState();advance(state,1,{active:play,energy:.8},rate);state.record({decision:play,status:'complete',at:1000});advance(state,2,{active:inspect,energy:.7},rate,1000);return {...advance(state,3,{energy:.6},rate,3000)};};
 const reference=run(60);assert.deepEqual(reference,run(60));
 for(const rate of [30,120]){const sample=run(rate);for(const key of ['arousal','focus','valence'])assert.ok(Math.abs(sample[key]-reference[key])<.012,rate+':'+key);}
});
test('safety gates immediately neutralize presentation without awarding an experience',()=>{
 for(const flag of ['typing','scrolling','reducedMotion','hidden']){
  const state=createCharacterState();advance(state,1,{active:play});
  const blocked=state.sample({dt:1/60,nowMs:1017,active:play,[flag]:true});
  assert.equal(blocked.blocked,true);assert.equal(blocked.phase,'blocked');assert.equal(blocked.intent,'idle');
  assert.equal(blocked.arousal+blocked.focus+Math.abs(blocked.valence),0);assert.equal(blocked.mood,'neutral');assert.equal(blocked.eventId,null);
 }
 const state=createCharacterState(),reading=advance(state,2,{active:inspect,reading:true,nearCard:true});
 assert.equal(reading.blocked,false);assert.equal(reading.phase,'reading');assert.equal(reading.reading,true);assert.ok(reading.arousal<.2&&reading.focus<=.65);
});
test('invalid events, stale timestamps, invalid active data and invalid clocks fail safely',()=>{
 const state=createCharacterState();
 for(const decision of [null,{},[],{...play,id:'bad id'},{...inspect,targetId:null},{...play,play:'eval'}])assert.equal(state.record({decision,status:'complete',at:10}),false);
 for(const at of [-1,NaN,Infinity])assert.equal(state.record({decision:play,status:'complete',at}),false);
 assert.equal(state.record({decision:play,status:'complete',at:20}),true);
 assert.equal(state.record({decision:inspect,status:'complete',at:19}),false);
 for(const options of [{nowMs:NaN},{dt:-1},{dt:Infinity}]){const sample=state.sample({dt:1/60,nowMs:100,...options});assert.equal(sample.blocked,true);assert.ok(Number.isFinite(sample.energy));}
 const sample=state.sample({dt:1/60,nowMs:200,active:{id:'not-accepted'},energy:NaN});
 assert.equal(sample.blocked,false);assert.notEqual(sample.intent,'play');assert.ok(Number.isFinite(sample.energy));
});
test('sample reuses its object, snapshot is a copy, and event history stays bounded',()=>{
 const state=createCharacterState(),first=state.sample();assert.equal(state.sample({dt:.01,nowMs:10}),first);
 const before=first.valence;assert.notEqual(state.snapshot(),first);state.snapshot().valence=100;assert.equal(first.valence,before);
 for(let i=0;i<100;i++)assert.equal(state.record({decision:{...play,id:'event-'+i},status:'complete',at:20+i}),true);
 const sample=state.sample({dt:.05,nowMs:200,energy:100});assert.ok(CHARACTER_INTENTS.includes(sample.intent));
 for(const key of ['energy','arousal','focus'])assert.ok(sample[key]>=0&&sample[key]<=1,key);
 assert.ok(sample.valence>=-1&&sample.valence<=1);
});


test('forgetting character memory clears acknowledged expressive carry and duplicate receipts',()=>{
 const state=createCharacterState();state.record({decision:play,status:'complete',at:100});
 state.sample({dt:.05,nowMs:200});state.reset();
 const sample=state.sample({dt:0,nowMs:300});
 assert.equal(sample.intent,'idle');assert.equal(sample.eventId,null);assert.equal(sample.valence,0);
 assert.equal(state.record({decision:play,status:'complete',at:400}),true);
});
