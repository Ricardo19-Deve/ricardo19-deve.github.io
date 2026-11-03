import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionMemory,CHARACTER_MEMORY_KEY,CHARACTER_MEMORY_LIMIT} from './m-world-memory.mjs';
function store(initial=[]){const data=new Map(initial);return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
test('public component familiarity survives reload in the same tab without saving chat',()=>{
 const storage=store(),memory=createSessionMemory({storage,now:()=>1000});
 assert.equal(memory.score('project-epoxy'),1);
 memory.noteExposure('project-epoxy',{dwellMs:1400});
 memory.noteVisit('project-epoxy',{action:'peek'});
 const reloaded=createSessionMemory({storage,now:()=>2000});
 const item=reloaded.snapshot().components[0];
 assert.equal(item.id,'project-epoxy');assert.equal(item.visits,1);assert.equal(item.dwellMs,1400);
 assert.equal(reloaded.snapshot().recent[0].action,'peek');
 assert.ok(reloaded.score('project-epoxy')<reloaded.score('project-new'));
 assert.ok(!storage.data.get(CHARACTER_MEMORY_KEY).includes('message'));
});
test('completed visits reduce repetition while recent penalties relax over time',()=>{
 let at=1000;const memory=createSessionMemory({storage:store(),now:()=>at});
 memory.noteVisit('project-a',{action:'peek'});const first=memory.score('project-a');
 memory.noteVisit('project-a',{action:'peek'});const repeat=memory.score('project-a');
 assert.ok(repeat<first);at+=120_000;
 assert.ok(memory.score('project-a')>repeat);
 assert.ok(memory.score('project-a')<memory.score('project-b'));
 for(let i=0;i<1000;i++)memory.noteVisit('project-a');
 assert.equal(memory.snapshot().components[0].visits,99);assert.ok(memory.score('project-a')>=.05);
 assert.equal(memory.snapshot().recent.length,6);
});
test('exposure is bounded per observation and in total, and never invents a visit',()=>{
 const memory=createSessionMemory({storage:store(),now:()=>0});
 memory.noteExposure('project-a',{dwellMs:Infinity});assert.equal(memory.snapshot().components.length,0);
 memory.noteExposure('project-a',{dwellMs:1_000_000});
 assert.equal(memory.snapshot().components[0].dwellMs,2000);
 for(let i=0;i<500;i++)memory.noteExposure('project-a',{dwellMs:2000});
 assert.equal(memory.snapshot().components[0].dwellMs,300_000);
 assert.equal(memory.snapshot().components[0].visits,0);assert.deepEqual(memory.snapshot().recent,[]);
});
test('memory remains capped and removes recent records for evicted components',()=>{
 const memory=createSessionMemory({storage:store(),now:()=>1});
 for(let i=0;i<CHARACTER_MEMORY_LIMIT+10;i++)memory.noteVisit('project-'+i,{action:'inspect'});
 const state=memory.snapshot();
 assert.equal(state.components.length,CHARACTER_MEMORY_LIMIT);
 assert.equal(state.components[0].id,'project-10');
 assert.ok(state.recent.every(item=>state.components.some(component=>component.id===item.id)));
 assert.ok(JSON.stringify(state).length<16_384);
});
test('corrupt, oversized and expanded private storage is discarded locally',()=>{
 for(const raw of ['{',JSON.stringify({version:1,energy:.3,components:[],recent:[],chat:'PRIVATE'}),'x'.repeat(20_000)]){
  const storage=store([[CHARACTER_MEMORY_KEY,raw]]),memory=createSessionMemory({storage,now:()=>0});
  assert.deepEqual(memory.snapshot().components,[]);assert.equal(memory.snapshot().energy,.35);
  assert.ok(!storage.data.get(CHARACTER_MEMORY_KEY).includes('PRIVATE'));
  assert.equal(memory.noteVisit('project-ok'),true);
 }
});
test('unavailable storage preserves local behavior and never throws',()=>{
 const storage={getItem(){throw new Error('denied')},setItem(){throw new Error('denied')},removeItem(){throw new Error('denied')}};
 const memory=createSessionMemory({storage,now:()=>100});
 assert.equal(memory.noteVisit('project-a'),true);
 assert.equal(memory.snapshot().components[0].visits,1);
 assert.equal(memory.snapshot().storageAvailable,false);
 assert.doesNotThrow(()=>memory.clear());
});
test('clearing character memory cannot reset AI accounting or preference keys',()=>{
 const quota='m-world-director-session-v1',preference='m-world-director-enabled-v1';
 const storage=store([[quota,'quota-is-preserved'],[preference,'false']]);
 const memory=createSessionMemory({storage,now:()=>100});
 memory.noteVisit('project-a');memory.clear();
 assert.equal(storage.data.get(quota),'quota-is-preserved');
 assert.equal(storage.data.get(preference),'false');
 assert.equal(storage.data.has(CHARACTER_MEMORY_KEY),false);
 assert.deepEqual(memory.snapshot().components,[]);
});
test('pace energy is frame-rate-independent for equal input speed and settles during quiet',()=>{
 const run=dt=>{const memory=createSessionMemory({storage:store(),now:()=>0});for(let at=0;at<10_000;at+=dt)memory.recordPace(800*dt/1000,dt);return memory;};
 const a=run(100),b=run(1000);
 assert.ok(Math.abs(a.snapshot().energy-b.snapshot().energy)<1e-10);
 const energetic=a.snapshot().energy;
 for(let i=0;i<30;i++)a.recordPace(0,1000);
 assert.ok(energetic>.5);assert.ok(a.snapshot().energy<.201);
});
test('invalid inputs cannot add arbitrary values and timestamps stay monotonic',()=>{
 let at=5000;const memory=createSessionMemory({storage:store(),now:()=>at});
 for(const id of ['https://private.invalid','<script>','user message',null,123,'A'.repeat(70)]){
  assert.equal(memory.noteVisit(id),false);assert.equal(memory.noteExposure(id,{dwellMs:100}),false);
 }
 assert.equal(memory.noteVisit('project-a',{action:'navigate'}),false);
 memory.noteVisit('project-a');at=1000;memory.noteVisit('project-b');
 assert.equal(memory.snapshot().components[1].lastVisitAt,5000);
 const energy=memory.snapshot().energy;
 memory.recordPace(NaN,100);memory.recordPace(100,-1);memory.recordPace(100,Infinity);
 assert.equal(memory.snapshot().energy,energy);
});
test('snapshots are detached from mutable session state',()=>{
 const memory=createSessionMemory({storage:store(),now:()=>100});memory.noteVisit('project-a');
 const snapshot=memory.snapshot();snapshot.components[0].visits=99;snapshot.recent[0].action='perch';
 assert.equal(memory.snapshot().components[0].visits,1);
 assert.equal(memory.snapshot().recent[0].action,'inspect');
});