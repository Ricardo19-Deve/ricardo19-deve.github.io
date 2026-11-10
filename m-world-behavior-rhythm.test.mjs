import test from 'node:test';
import assert from 'node:assert/strict';
import {behaviorContinuityWeight,behaviorPhase} from './m-world-behavior-rhythm.mjs';
import {createAutonomy} from './m-world-autonomy.mjs';

const frame=(nowMs,other={})=>({nowMs,energy:.9,context:{active:true},routinesAvailable:true,
 selfPlayAvailable:true,ballPlayAvailable:true,habits:{opening:'play',weights:{}},
 targets:[
  {id:'card-a',stableId:'project-a',actions:['inspect','peek','perch','orbit'],novelty:.8,visibleShare:1,distance:90},
  {id:'card-b',stableId:'project-b',actions:['inspect','peek','perch','orbit'],novelty:.6,visibleShare:.8,distance:200}
 ],...other});

test('V65 a completed play beat naturally favors reflection and recovery over immediate repeated play',()=>{
 const prev={family:'light',at:20_000};
 assert.equal(behaviorPhase('light'),'play');
 assert.equal(behaviorPhase('perch'),'recover');
 assert.equal(behaviorPhase('inspect'),'explore');
 assert.ok(behaviorContinuityWeight(prev,'rest',{at:22_000,energy:.9})>1.2);
 assert.ok(behaviorContinuityWeight(prev,'observe',{at:22_000,energy:.9})>1.1);
 assert.ok(behaviorContinuityWeight(prev,'ball',{at:22_000,energy:.9})<.75);
 assert.equal(behaviorContinuityWeight(prev,'ball',{at:110_000,energy:.9}),1,'completed beat fades after 90 seconds');
});

test('V65 a real rest encourages fresh inspection but exhaustion still favors resting',()=>{
 const prev={family:'rest',at:10_000};
 assert.ok(behaviorContinuityWeight(prev,'inspect',{at:11_000,energy:.9})>1.2);
 assert.ok(behaviorContinuityWeight(prev,'rest',{at:11_000,energy:.9})<.8);
 assert.ok(behaviorContinuityWeight(prev,'sleep',{at:11_000,energy:.1})>=1.17);
 assert.ok(behaviorContinuityWeight(prev,'hop',{at:11_000,energy:.1})<.75);
 assert.ok(behaviorContinuityWeight({family:'inspect',at:0},'think',{at:2_000})>1.2);
});

test('V65 continuity cannot bypass quiet-reading, invalid time or unrecognized actions',()=>{
 for(const state of [{family:'light',at:0},{family:'rest',at:1000}]){
  assert.equal(behaviorContinuityWeight(state,'light',{at:2000,reading:true}),1);
  assert.equal(behaviorContinuityWeight(state,'light',{at:-1}),1);
  assert.equal(behaviorContinuityWeight(state,'light',{at:NaN}),1);
  assert.equal(behaviorContinuityWeight(state,'unknown',{at:2000}),1);
 }
 assert.equal(behaviorContinuityWeight(null,'rest',{at:1000}),1);
 assert.equal(behaviorContinuityWeight({},'rest',{at:1000}),1);
});

test('V65 only a physically successful action advances M behavioral continuity',()=>{
 const a=createAutonomy({seed:18425});
 assert.equal(a.snapshot().behavior,null);
 const first=a.choose(frame(0,{goal:{id:'follow-light'}}));
 assert.ok(first);
 assert.equal(a.snapshot().behavior,null,'a pending intention is not a memory');
 assert.equal(a.resolve(first.id,{accepted:true,nowMs:100}),true);
 assert.equal(a.snapshot().behavior,null,'accepted intention still does not count as experience');
 assert.equal(a.complete({success:false,reason:'interrupted',nowMs:200}),true);
 assert.equal(a.snapshot().behavior,null);
 const due=a.snapshot().nextDecisionAt;
 const second=a.choose(frame(due,{goal:{id:'follow-light'}}));
 assert.ok(second);
 assert.equal(a.resolve(second.id,{accepted:true,nowMs:due+100}),true);
 assert.equal(a.complete({success:true,reason:'finished',nowMs:due+1000}),true);
 assert.deepEqual(a.snapshot().behavior,{phase:behaviorPhase(second.reason),family:second.reason,at:due+1000});
 assert.equal(a.resetMemory(due+1500),true);
 assert.equal(a.snapshot().behavior,null);
});

test('V65 repeated real decisions are deterministic, bounded and remain respectful of visitors',()=>{
 const simulate=seed=>{
  const life=createAutonomy({seed}),result=[];
  for(let t=0;t<210_000;t+=500){
   const choice=life.choose(frame(t));
   if(!choice)continue;
   result.push(choice.reason);
   life.resolve(choice.id,{accepted:true,nowMs:t});
   life.complete({success:true,nowMs:t+1000});
  }
  return {result,status:life.snapshot()};
 };
 const a=simulate(3921),b=simulate(3921);
 assert.deepEqual(a,b);
 assert.ok(a.result.length>=8);
 assert.ok(new Set(a.result).size>=4);
 assert.ok(a.status.behavior&&['play','explore','recover','reflect'].includes(a.status.behavior.phase));
 const quiet=createAutonomy({seed:3921});
 const proposal=quiet.choose(frame(0,{context:{active:true,reading:true}}));
 assert.equal(proposal.quiet,true);
 assert.equal(proposal.targetId,null);
 assert.equal(proposal.play,null);
 assert.equal(quiet.choose(frame(100,{context:{reducedMotion:true}})),null);
 assert.equal(quiet.snapshot().behavior,null);
});
