import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAutonomy} from './m-world-autonomy.mjs';

const target=id=>({id,stableId:id,actions:['inspect','peek','perch','orbit'],novelty:.88,visibleShare:.96,distance:175});
const facts=(nowMs,extra={})=>({
 nowMs,energy:.78,targets:[target('project-a'),target('project-b'),target('project-c')],
 selfPlayAvailable:false,ballPlayAvailable:false,routinesAvailable:false,
 habits:{opening:'explore'},context:{active:true},...extra
});
function life(seed,duration=440_000){
 const ai=createAutonomy({seed}),scenes=[],all=[];
 let busyUntil=0;
 for(let at=0;at<=duration;at+=1000){
  if(busyUntil&&at>=busyUntil){assert.equal(ai.complete({nowMs:at,success:true}),true);busyUntil=0;}
  const decision=ai.choose(facts(at));if(!decision)continue;
  all.push(decision);
  assert.equal(ai.resolve(decision.id,{accepted:true,nowMs:at}),true);
  if(decision.kind==='scene')scenes.push(decision);
  busyUntil=at+(decision.kind==='scene'?6000:2500);
 }
 return {ai,scenes,all};
}

test('V42 scene gestures keep changing organically after the opening action',()=>{
 const {ai,scenes}=life(42);
 assert.ok(scenes.length>=8,'M has enough naturally occurring scenes to validate a long visit');
 assert.ok(new Set(scenes.map(s=>s.gesture)).size>=3,'scenes contain varied authored V6 gestures');
 for(let i=1;i<scenes.length;i++)
  assert.notEqual(scenes[i].gesture,scenes[i-1].gesture,'consecutive completed scene gestures must not repeat');
 assert.ok(ai.snapshot().recentGestures.length<=8,'recent experience is bounded');
 assert.deepEqual(life(42).scenes,scenes,'the same seed and timeline reproduce behavior');
 assert.notDeepEqual(life(43).scenes,scenes,'different visits do not follow a fixed loop');
});

test('V42 aborted intentions never create fake gesture memory',()=>{
 let found=null;
 for(let seed=1;seed<100&&!found;seed++){
  const ai=createAutonomy({seed}),d=ai.choose(facts(0,{targets:[target('only')]}));
  if(d?.kind==='scene')found={ai,d};
 }
 assert.ok(found,'a safe scene candidate is available');
 const {ai,d}=found;
 assert.deepEqual(ai.snapshot().recentGestures,[]);
 assert.equal(ai.resolve(d.id,{accepted:false,nowMs:0}),true);
 assert.deepEqual(ai.snapshot().recentGestures,[],'rejected intent is not remembered');
 ai.resetMemory(3000);
 assert.deepEqual(ai.snapshot().recentGestures,[]);
});

test('V42 only acknowledged completion creates a recent gesture, never acceptance or failure',()=>{
 let found=null;
 for(let seed=1;seed<100&&!found;seed++){
  const ai=createAutonomy({seed}),d=ai.choose(facts(0,{targets:[target('only')]}));
  if(d?.kind==='scene')found={ai,d};
 }
 const {ai,d}=found;
 ai.resolve(d.id,{accepted:true,nowMs:0});
 assert.deepEqual(ai.snapshot().recentGestures,[]);
 ai.complete({nowMs:6000,success:false,reason:'interrupted'});
 assert.deepEqual(ai.snapshot().recentGestures,[]);
 // A completed scene in a new, independent run is recorded exactly once.
 const second=createAutonomy({seed:7});
 let chosen;
 for(let time=0;time<200_000;time+=1000){
  const d2=second.choose(facts(time));
  if(!d2)continue;
  second.resolve(d2.id,{accepted:true,nowMs:time});
  second.complete({nowMs:time+3000,success:true});
  if(d2.kind==='scene'){chosen=d2;break;}
 }
 assert.ok(chosen);
 assert.deepEqual(second.snapshot().recentGestures,[chosen.gesture]);
 second.resetMemory(210_000);
 assert.deepEqual(second.snapshot().recentGestures,[]);
});

test('V42 no new models, avatar assets, user profiles or API calls',()=>{
 const code=readFileSync(new URL('m-world-autonomy.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|localStorage|sessionStorage|document\.|window\.|OpenAI|analytics/i);
 assert.match(code,/recentGestures/);
 assert.match(code,/variedGestures/);
 assert.match(code,/completedCount===0&&hasOpening/,'opening itself is only boosted for the first real decision');
});
