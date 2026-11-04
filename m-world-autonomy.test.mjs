import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTONOMY_RESERVATION_MS,createAutonomy} from './m-world-autonomy.mjs';

const target=(id,extra={})=>({id,stableId:id,kind:'project',actions:['inspect','peek','perch','orbit'],
 novelty:.8,visibleShare:.95,distance:220,...extra});
const facts=(nowMs=0,extra={})=>({nowMs,energy:.7,selfPlayAvailable:true,remotePending:false,
 targets:[target('card-a'),target('card-b'),target('card-c')],...extra,
 context:{active:true,...extra.context}});
const accept=(ai,decision,nowMs)=>assert.equal(ai.resolve(decision.id,{accepted:true,nowMs}),true);

/** The executor reports elapsed physical work; no pointer, scroll, or API events drive this life. */
function timeline(seed,durationMs=360_000){
 const ai=createAutonomy({seed}),decisions=[];
 let execution=null;
 for(let nowMs=0;nowMs<=durationMs;nowMs+=1000){
  if(execution&&nowMs>=execution.until){
   assert.equal(ai.complete({success:true,nowMs}),true);execution=null;
  }
  const decision=ai.choose(facts(nowMs));
  if(!decision)continue;
  decisions.push({nowMs,...decision});accept(ai,decision,nowMs);
  const duration=decision.kind==='scene'?4500:decision.kind==='self-play'?6500:5500;
  execution={until:nowMs+duration};
 }
 return {ai,decisions};
}

test('a complete idle timeline initiates varied local life without user or remote inputs',()=>{
 const {ai,decisions}=timeline(47);
 assert.ok(decisions.length>=24);
 const kinds=new Set(decisions.map(value=>value.kind));
 for(const kind of ['scene','self-play','expression','rest'])assert.ok(kinds.has(kind),kind);
 const actions=new Set(decisions.filter(value=>value.kind==='scene').map(value=>value.action));
 for(const action of ['inspect','peek','perch','orbit'])assert.ok(actions.has(action),action);
 assert.ok(decisions.some(value=>value.play==='light'&&value.targetId===null));
 assert.ok(decisions.some(value=>value.play==='hide'&&value.targetId!==null));
 assert.ok(decisions.some(value=>['delight','proud'].includes(value.affect)));
 assert.ok(new Set(decisions.map(value=>value.targetId).filter(Boolean)).size>=2);
 assert.ok(ai.snapshot().completedCount>=24);
 assert.deepEqual(timeline(47).decisions,decisions,'seed and fake clock reproduce the whole life');
 assert.notDeepEqual(timeline(48).decisions,decisions);
});

test('a reservation is stable across candidate order/need changes and expires after two seconds',()=>{
 const a=createAutonomy({seed:27}),b=createAutonomy({seed:27});
 const first=a.choose(facts());
 assert.deepEqual(b.choose(facts(0,{targets:facts().targets.reverse()})),first);
 first.affect='external-mutation';
 const reserved=a.choose(facts(1000,{energy:0,targets:[]}));
 assert.notEqual(reserved.affect,'external-mutation');
 assert.equal(reserved.id,first.id);
 assert.equal(a.snapshot().reservationUntil,AUTONOMY_RESERVATION_MS);
 assert.equal(a.resolve(first.id,{accepted:true,nowMs:2000}),false);
 assert.equal(a.snapshot().current,null);
 assert.equal(a.snapshot().lastOutcome.status,'expired');
 assert.equal(a.choose(facts(2999)),null);
 const next=a.choose(facts(3000));
 assert.ok(next);assert.notEqual(next.id,first.id);
});

test('accepted ownership persists until explicit completion, despite new choices and time',()=>{
 const ai=createAutonomy({seed:4}),choice=ai.choose(facts());
 accept(ai,choice,0);
 for(const [nowMs,extra] of [[1000,{}],[5000,{remotePending:true}],
  [30_000,{context:{busy:true}}],[90_000,{context:{reading:true},energy:0,targets:[]}]]){
  assert.equal(ai.choose(facts(nowMs,extra)),null);
  assert.deepEqual(ai.snapshot().active,choice);
 }
 assert.equal(ai.resolve(choice.id,{accepted:true,nowMs:90_000}),false);
 assert.equal(ai.snapshot().completedCount,0);
 assert.equal(ai.complete({success:true,nowMs:90_001}),true);
 assert.equal(ai.snapshot().active,null);
 assert.equal(ai.complete({success:true,nowMs:90_002}),false);
});

test('hard visitor contexts cancel ownership, settle, and cannot fabricate success',()=>{
 for(const context of [{active:false},{hidden:true},{reducedMotion:true},{typing:true},{selection:true},{scrolling:true}]){
  const ai=createAutonomy(),choice=ai.choose(facts());accept(ai,choice,0);
  assert.equal(ai.choose(facts(1000,{context})),null);
  assert.equal(ai.snapshot().active,null);
  assert.equal(ai.snapshot().lastOutcome.status,'cancelled');
  assert.equal(ai.snapshot().achievementPending,false);
  assert.equal(ai.snapshot().completedCount,0);
  assert.equal(ai.complete({success:true,nowMs:1001}),false);
  assert.equal(ai.choose(facts(2599)),null);
  assert.ok(ai.choose(facts(2600)));
 }
});

test('reading permits only a quiet face/rest and does not initiate play or travel',()=>{
 const ai=createAutonomy({seed:7});
 const choices=[];
 for(let nowMs=0;nowMs<=90_000;nowMs+=1000){
  const choice=ai.choose(facts(nowMs,{context:{reading:true}}));
  if(!choice)continue;
  choices.push(choice);
  assert.ok(['expression','rest'].includes(choice.kind));
  assert.equal(choice.quiet,true);assert.equal(choice.targetId,null);assert.equal(choice.play,null);
  assert.equal(choice.gesture,'none');assert.equal(choice.action,'rest');
  accept(ai,choice,nowMs);assert.equal(ai.complete({success:true,nowMs}),true);
 }
 assert.ok(choices.length>=8);
 assert.ok(choices.some(value=>value.reason==='quiet-observe'));
 assert.ok(choices.some(value=>value.reason==='quiet-rest'));
 assert.ok(!choices.some(value=>['delight','proud'].includes(value.affect)));
});

test('reading invalidates unaccepted travel, while the executor owns accepted travel',()=>{
 const ai=createAutonomy({seed:4}),choice=ai.choose(facts());
 assert.equal(choice.quiet,false);
 assert.equal(ai.choose(facts(1000,{context:{reading:true}})),null);
 assert.equal(ai.snapshot().pending,null);
 assert.equal(ai.resolve(choice.id,{accepted:true,nowMs:1000}),false);
 const quiet=ai.choose(facts(2600,{context:{reading:true}}));
 assert.equal(quiet.quiet,true);
});

test('busy and pending API work yield before new decisions without counting failures',()=>{
 for(const extra of [{context:{busy:true}},{remotePending:true}]){
  const ai=createAutonomy();
  assert.equal(ai.choose(facts(0,extra)),null);
  assert.equal(ai.choose(facts(999)),null);
  const decision=ai.choose(facts(1000));assert.ok(decision);
  assert.equal(ai.choose(facts(1100,extra)),null);
  assert.equal(ai.snapshot().pending,null);
  assert.equal(ai.snapshot().completedCount,0);assert.equal(ai.snapshot().failedCount,0);
 }
});

test('achievements require successful execution rather than a proposal, acceptance, or cancellation',()=>{
 const ai=createAutonomy({seed:4}),choice=ai.choose(facts());
 assert.equal(choice.kind,'scene');
 assert.equal(ai.snapshot().targetHistory.length,0);assert.equal(ai.snapshot().achievementPending,false);
 accept(ai,choice,0);
 assert.equal(ai.snapshot().targetHistory.length,0);assert.equal(ai.snapshot().achievementPending,false);
 assert.equal(ai.complete({nowMs:1000}),false,'success must be explicit');
 assert.equal(ai.cancel('visitor-override',1000),true);
 assert.equal(ai.snapshot().targetHistory.length,0);assert.equal(ai.snapshot().achievementPending,false);
 const next=ai.choose(facts(3000));accept(ai,next,3000);
 assert.equal(ai.complete({success:false,reason:'route-blocked',nowMs:6000}),true);
 assert.equal(ai.snapshot().completedCount,0);assert.equal(ai.snapshot().achievementPending,false);
 const {decisions}=timeline(4,50_000);
 const celebration=decisions.find(value=>value.reason==='achievement');
 assert.ok(celebration);assert.ok(celebration.nowMs>4500);
 assert.equal(celebration.quiet,true);assert.equal(celebration.gesture,'none');
});

test('failed/rejected target routes cool down under stable identities instead of looping',()=>{
 for(const accepted of [true,false]){
  const ai=createAutonomy({seed:4}),choice=ai.choose(facts(0,{targets:[target('only')],selfPlayAvailable:false}));
  assert.equal(choice.targetId,'only');
  assert.equal(ai.resolve(choice.id,{accepted,nowMs:0}),true);
  if(accepted)assert.equal(ai.complete({success:false,reason:'route-blocked',nowMs:1000}),true);
  const entry=ai.snapshot().targetHistory[0];
  assert.equal(entry.successes,0);assert.equal(entry.lastSuccessAt,null);
  for(let nowMs=4000;nowMs<entry.cooldownUntil;nowMs+=3000){
   const decision=ai.choose(facts(nowMs,{targets:[target('recreated',{stableId:'only'})],selfPlayAvailable:false}));
   if(!decision)continue;
   assert.equal(decision.targetId,null,'same stable target must remain unavailable');
   accept(ai,decision,nowMs);assert.equal(ai.complete({success:true,nowMs}),true);
  }
  assert.equal(ai.snapshot().failedCount,1);
  assert.equal(ai.snapshot().targetHistory[0].successes,0);
 }
});

test('successful target/action cooldowns vary choices and use actual completion time',()=>{
 const {decisions,ai}=timeline(47,240_000);
 const lastTarget=new Map();
 for(const decision of decisions){
  if(decision.targetId===null)continue;
  if(lastTarget.has(decision.targetId))assert.ok(decision.nowMs-lastTarget.get(decision.targetId)>=14_000);
  lastTarget.set(decision.targetId,decision.nowMs);
 }
 assert.ok(ai.snapshot().targetHistory.every(entry=>entry.successes>0&&entry.lastSuccessAt!==null));
 const families=decisions.map(value=>value.reason);
 assert.ok(families.filter((value,index)=>index&&value===families[index-1]).length<=1);
});

test('only planner-offered actions and genuine available play are emitted',()=>{
 const ai=createAutonomy({seed:31});
 for(let nowMs=0;nowMs<180_000;nowMs+=1000){
  const decision=ai.choose(facts(nowMs,{targets:[target('limited',{actions:['inspect','perch']})],selfPlayAvailable:false}));
  if(!decision)continue;
  assert.ok(['inspect','perch','rest'].includes(decision.action));
  assert.equal(decision.play,null);assert.notEqual(decision.kind,'self-play');
  accept(ai,decision,nowMs);ai.complete({success:true,nowMs});
 }
 const noTargets=createAutonomy({seed:3});
 const choices=[];
 for(let nowMs=0;nowMs<120_000;nowMs+=1000){
  const decision=noTargets.choose(facts(nowMs,{targets:[]}));
  if(!decision)continue;
  choices.push(decision);assert.equal(decision.targetId,null);assert.notEqual(decision.play,'hide');
  accept(noTargets,decision,nowMs);noTargets.complete({success:true,nowMs});
 }
 assert.ok(choices.some(value=>value.kind==='self-play'&&value.play==='light'));
});

test('low energy strongly favors quiet rest; unavailable targets do not cause fake exploration',()=>{
 let rests=0;
 for(let seed=0;seed<50;seed++){
  const decision=createAutonomy({seed}).choose(facts(0,{energy:0,targets:[]}));
  assert.ok(['expression','rest'].includes(decision.kind));assert.equal(decision.play,null);
  if(decision.kind==='rest'){rests++;assert.equal(decision.affect,'sleepy');}
 }
 assert.ok(rests>=40);
});

test('card count does not inflate the utility of a behavior or overwhelm the energy need',()=>{
 const one=[target('card-0')],many=Array.from({length:64},(_,index)=>target('card-'+index));
 for(let seed=0;seed<40;seed++){
  const a=createAutonomy({seed}).choose(facts(20_000,{targets:one,energy:0}));
  const b=createAutonomy({seed}).choose(facts(20_000,{targets:many,energy:0}));
  assert.equal(a.reason,b.reason,'equally scored extra cards only offer alternate targets');
 }
});

test('invalid values, backwards clocks, foreign IDs, and snapshots cannot corrupt lifecycle',()=>{
 const ai=createAutonomy({seed:NaN});
 for(const nowMs of [NaN,Infinity,-1,Number.MAX_VALUE])assert.equal(ai.choose(facts(nowMs)),null);
 assert.equal(ai.choose(null),null);
 const malformed=[null,{},target('bad id'),target('offscreen',{visibleShare:0}),target('no-actions',{actions:['teleport']})];
 const decision=ai.choose(facts(5000,{targets:malformed,energy:Infinity,selfPlayAvailable:false}));
 assert.equal(decision.targetId,null);
 assert.equal(ai.resolve('unknown',{accepted:true,nowMs:5000}),false);
 assert.equal(ai.complete({success:true,nowMs:5000}),false);
 assert.deepEqual(ai.choose(facts(1000)),decision,'backwards time cannot expire or reroll a reservation');
 accept(ai,decision,5000);
 const snapshot=ai.snapshot();snapshot.active.affect='changed';snapshot.recent.push('external');
 assert.notEqual(ai.snapshot().active.affect,'changed');assert.ok(!ai.snapshot().recent.includes('external'));
 assert.equal(ai.complete({success:true,nowMs:Infinity}),false);
 assert.ok(ai.snapshot().active);
 assert.equal(ai.complete({success:true,nowMs:6000}),true);
 assert.ok(Number.isFinite(ai.snapshot().nextDecisionAt));
});

test('memory remains bounded over many real results and contains only safe IDs/outcomes',()=>{
 const ai=createAutonomy({seed:12});
 for(let index=0;index<1000;index++){
  const nowMs=index*40_000;
  const choice=ai.choose(facts(nowMs,{targets:[target('card-'+index,{title:'private text',el:{secret:'private'}})],selfPlayAvailable:false}));
  assert.ok(choice);accept(ai,choice,nowMs);
  ai.complete({success:index%5!==0,reason:'completed',nowMs:nowMs+1000});
 }
 const snapshot=ai.snapshot();
 assert.ok(snapshot.targetHistory.length<=24);assert.ok(snapshot.recent.length<=8);
 assert.ok(snapshot.targetHistory.length>=15);
 const encoded=JSON.stringify(snapshot);
 assert.ok(!encoded.includes('private'));assert.ok(!encoded.includes('secret'));
 for(const entry of snapshot.targetHistory){
  assert.ok(Number.isFinite(entry.cooldownUntil));assert.ok(entry.successes>=0&&entry.successes<=1000);
 }
 snapshot.targetHistory[0].id='external';
 assert.notEqual(ai.snapshot().targetHistory[0].id,'external');
});

test('nextDecisionAt is the exact lower bound after completion and explicit cancellation',()=>{
 const ai=createAutonomy({seed:9});
 const first=ai.choose(facts());accept(ai,first,0);assert.equal(ai.complete({success:true,nowMs:4000}),true);
 const due=ai.snapshot().nextDecisionAt;
 assert.ok(due>=6000&&due<=11_000);assert.equal(ai.choose(facts(due-1)),null);
 const next=ai.choose(facts(due));assert.ok(next);accept(ai,next,due);
 assert.equal(ai.cancel('visitor-override',due+1000),true);
 const resume=ai.snapshot().nextDecisionAt;
 assert.equal(ai.choose(facts(resume-1)),null);assert.ok(ai.choose(facts(resume)));
 assert.equal(ai.snapshot().completedCount,1);
});

test('character-memory reset clears local familiarity and reservations without inventing or erasing completion statistics',()=>{
 const brain=createAutonomy({seed:1}),decision=brain.choose({nowMs:0,context:{},energy:.8,targets:[{id:'surface-1',stableId:'project-1',actions:['inspect'],novelty:1,visibleShare:1,distance:0}]});
 assert.equal(decision.kind,'scene');brain.resolve(decision.id,{accepted:true,nowMs:0});brain.complete({success:true,nowMs:6000});
 assert.equal(brain.snapshot().targetHistory.length,1);assert.equal(brain.snapshot().completedCount,1);
 assert.equal(brain.resetMemory(7000),true);
 const reset=brain.snapshot();assert.equal(reset.targetHistory.length,0);assert.equal(reset.recent.length,0);
 assert.equal(reset.active,null);assert.equal(reset.pending,null);assert.equal(reset.achievementPending,false);
 assert.equal(reset.completedCount,1);assert.ok(reset.nextDecisionAt>7000);
});


test('an unfinished character goal chooses real offered light play or a specific safe lookout',()=>{
 const goals=[{id:'follow-light'},{id:'find-lookout',targetId:'card-b'},{id:'revisit-lookout',targetId:'card-b'}];
 for(const goal of goals){
  const ai=createAutonomy({seed:18425}),decision=ai.choose(facts(1000,{goal,energy:.8}));
  assert.equal(decision.characterGoal,goal.id);
  if(goal.id==='follow-light'){assert.equal(decision.kind,'self-play');assert.equal(decision.play,'light');}
  else{assert.equal(decision.kind,'scene');assert.equal(decision.action,'perch');assert.equal(decision.targetId,'card-b');}
  assert.equal(ai.snapshot().completedCount,0,'Wanting something is not completing it');
  accept(ai,decision,1000);
  assert.equal(ai.choose(facts(20_000,{goal:{id:'follow-light'}})),null,'A changing long goal cannot steal accepted physical work');
 }
});

test('character goals yield to reading, visitor interruption, low energy and unavailable offered actions',()=>{
 for(const goal of [{id:'follow-light'},{id:'find-lookout',targetId:'card-b'}]){
  const quiet=createAutonomy({seed:18425}).choose(facts(1000,{goal,context:{reading:true}}));
  assert.equal(quiet.quiet,true);assert.equal(quiet.characterGoal,undefined);
  for(const blocker of [{reducedMotion:true},{typing:true},{selection:true},{scrolling:true},{busy:true},{active:false}]){
   assert.equal(createAutonomy({seed:18425}).choose(facts(1000,{goal,context:blocker})),null);
  }
 }
 const unavailable=createAutonomy({seed:18425}).choose(facts(1000,{goal:{id:'find-lookout',targetId:'card-b'},targets:[target('card-b',{actions:['inspect']})]}));
 assert.equal(unavailable.characterGoal,undefined);
 const tired=createAutonomy({seed:18425}).choose(facts(1000,{goal:{id:'follow-light'},energy:.1,selfPlayAvailable:false}));
 assert.notEqual(tired.play,'light');assert.equal(tired.characterGoal,undefined);
});

test('a failed story lookout cools down the actual stable target without inventing another goal destination',()=>{
 const ai=createAutonomy({seed:18425}),goal={id:'find-lookout',targetId:'card-b'};
 const first=ai.choose(facts(1000,{goal}));assert.equal(first.characterGoal,goal.id);accept(ai,first,1000);
 assert.equal(ai.complete({success:false,reason:'no-safe-route',nowMs:2000}),true);
 const next=ai.choose(facts(6000,{goal}));
 assert.ok(next);assert.notEqual(next.targetId,'card-b');assert.equal(next.characterGoal,undefined);
 assert.equal(ai.snapshot().completedCount,0);
});

test('invalid character goals preserve the established V25 decision distribution',()=>{
 for(const goal of [{id:'arbitrary-code',targetId:'card-a'},'follow-light',[],null]){
  assert.deepEqual(createAutonomy({seed:47}).choose(facts(1000,{goal})),createAutonomy({seed:47}).choose(facts(1000)));
 }
 const absent=createAutonomy({seed:18425}).choose(facts(1000,{goal:{id:'revisit-lookout',targetId:'removed-card'}}));
 assert.equal(absent.characterGoal,undefined);
});

const routineFacts=(nowMs=0,extra={})=>facts(nowMs,{routinesAvailable:true,ballPlayAvailable:true,...extra});
function routineTimeline(seed,durationMs=240_000,extra={}){
 const ai=createAutonomy({seed}),decisions=[];let execution=null;
 for(let nowMs=0;nowMs<=durationMs;nowMs+=500){
  if(execution&&nowMs>=execution.until){assert.equal(ai.complete({success:true,nowMs}),true);execution=null;}
  const decision=ai.choose(routineFacts(nowMs,extra));if(!decision)continue;
  decisions.push({nowMs,...decision});accept(ai,decision,nowMs);
  execution={until:nowMs+(decision.gesture==='sleep'?12_400:decision.kind==='self-play'?15_000:decision.kind==='scene'?7000:5500)};
 }
 return {ai,decisions};
}

test('routine and ball availability are explicit capabilities; omitted and malformed flags preserve V25 exactly',()=>{
 for(const seed of [0,4,47,18425,91183])for(const value of [undefined,false,0,1,'true',null,{},[]]){
  const old=createAutonomy({seed}),disabled=createAutonomy({seed});
  for(const nowMs of [0,1000,10_000,90_000,180_000]){
   const a=old.choose(facts(nowMs)),b=disabled.choose(facts(nowMs,{routinesAvailable:value,ballPlayAvailable:value}));
   assert.deepEqual(b,a);assert.deepEqual(disabled.snapshot(),old.snapshot());
   if(a){accept(old,a,nowMs);accept(disabled,b,nowMs);old.complete({success:true,nowMs});disabled.complete({success:true,nowMs});}
  }
 }
});

test('new routines form varied reproducible intentions and autonomous ball play without visitor or provider input',()=>{
 const {decisions}=routineTimeline(18425),first=reason=>decisions.find(value=>value.reason===reason);
 for(const reason of ['sleep','think','hop','ball'])assert.ok(first(reason),reason+' must be naturally available');
 assert.ok(Math.max(...['sleep','think','hop','ball'].map(reason=>first(reason).nowMs))<=140_000,'all new intentions occur within about two minutes after the initial chapter');
 assert.deepEqual(routineTimeline(18425).decisions,decisions);
 const sleep=first('sleep'),think=first('think'),hop=first('hop'),ball=first('ball');
 assert.equal(sleep.kind,'rest');assert.equal(sleep.gesture,'sleep');assert.equal(sleep.affect,'dozing');assert.equal(sleep.quiet,true);
 assert.equal(think.kind,'expression');assert.equal(think.gesture,'think');assert.equal(think.affect,'pondering');
 assert.equal(hop.kind,'expression');assert.equal(hop.gesture,'hop');assert.equal(hop.affect,'joyful');assert.equal(hop.quiet,false);
 assert.equal(ball.kind,'self-play');assert.equal(ball.play,'ball');assert.equal(ball.gesture,'paw');assert.equal(ball.targetId,null);
 for(let i=1;i<decisions.length;i++)assert.notEqual(decisions[i].reason,decisions[i-1].reason,'family novelty avoids an immediate repetitive routine');
 assert.ok(new Set(decisions.map(value=>value.reason)).size>=9,'new routines must not replace all exploration');
});

test('routine safety gates still cancel actual ownership without counting a nap',()=>{
 for(const context of [{active:false},{hidden:true},{reducedMotion:true},{typing:true},{selection:true},{scrolling:true}]){
  const ai=createAutonomy({seed:18425}),choice=ai.choose(routineFacts());accept(ai,choice,0);
  assert.equal(ai.choose(routineFacts(1000,{context})),null);
  assert.equal(ai.snapshot().active,null);assert.equal(ai.snapshot().completedCount,0);
  assert.equal(ai.snapshot().needs.lastSleepAt,null);
 }
 for(const extra of [{context:{busy:true}},{remotePending:true}]){
  const ai=createAutonomy({seed:18425});assert.equal(ai.choose(routineFacts(0,extra)),null);
  assert.equal(ai.snapshot().current,null);assert.equal(ai.snapshot().needs.lastSleepAt,null);
 }
});

test('reading allows quiet thought and sleep but never new hopping or ball motion',()=>{
 const {decisions}=routineTimeline(18425,240_000,{context:{reading:true}});
 assert.ok(decisions.some(value=>value.reason==='think'));
 assert.ok(decisions.some(value=>value.reason==='sleep'));
 for(const decision of decisions){
  assert.equal(decision.quiet,true);assert.equal(decision.play,null);assert.equal(decision.targetId,null);
  assert.equal(decision.action,'rest');assert.ok(['none','think','sleep'].includes(decision.gesture));
  assert.ok(['rest','expression'].includes(decision.kind));
 }
});

test('ball and hopping obey independent availability and exact energy thresholds',()=>{
 let balls=0,hops=0;
 for(let index=0;index<200;index++){
  const seed=index*9973+17;
  const choose=extra=>createAutonomy({seed}).choose(routineFacts(0,{targets:[],selfPlayAvailable:false,...extra}));
  assert.notEqual(choose({ballPlayAvailable:false}).play,'ball');
  assert.notEqual(choose({energy:.3}).play,'ball');
  assert.notEqual(choose({energy:.4}).gesture,'hop');
  assert.notEqual(choose({routinesAvailable:false}).gesture,'hop');
  if(choose({energy:.8}).play==='ball')balls++;
  if(choose({energy:.8}).gesture==='hop')hops++;
 }
 assert.ok(balls>10&&hops>10,'both energetic alternatives can actually win utility selection');
});

test('nap need grows smoothly and low energy increasingly favors actual sleep across reproducible seeds',()=>{
 let tired=0,awake=0,urgent=0;
 for(let index=0;index<200;index++){
  const seed=index*9973+17;
  const choose=energy=>createAutonomy({seed}).choose(routineFacts(0,{energy,targets:[],selfPlayAvailable:false,ballPlayAvailable:false}));
  if(choose(.1).gesture==='sleep')tired++;
  if(choose(.9).gesture==='sleep')awake++;
  const ai=createAutonomy({seed});ai.choose(routineFacts(0,{context:{busy:true}}));
  assert.equal(ai.snapshot().needs.napUrge,0);
  ai.choose(routineFacts(45_000,{context:{busy:true}}));assert.equal(ai.snapshot().needs.napUrge,.5);
  if(ai.choose(routineFacts(90_000,{energy:.1,targets:[],selfPlayAvailable:false,ballPlayAvailable:false})).gesture==='sleep')urgent++;
 }
 assert.ok(tired>awake+45,'tired creatures choose sleep more frequently than rested ones');
 assert.ok(urgent>tired+30,'longer wakefulness adds a genuine graded need rather than a fixed schedule');
});

function queuedNap(){
 for(let index=0;index<100;index++){
  const ai=createAutonomy({seed:index*9973+17});
  ai.choose(routineFacts(0,{context:{busy:true}}));
  const choice=ai.choose(routineFacts(90_000,{energy:.1,targets:[],selfPlayAvailable:false,ballPlayAvailable:false}));
  if(choice.gesture==='sleep')return {ai,choice};
 }
 assert.fail('No deterministic sleep candidate found');
}
test('only successful sleep completion satisfies nap need; attempts, failure, cancellation and memory reset do not',()=>{
 for(const result of ['proposal','rejected','failed','cancelled','memory-reset','success']){
  const {ai,choice}=queuedNap();assert.equal(ai.snapshot().needs.napUrge,1);assert.equal(ai.snapshot().needs.lastSleepAt,null);
  if(result==='rejected')ai.resolve(choice.id,{accepted:false,nowMs:90_100});
  else if(result==='memory-reset')ai.resetMemory(90_100);
  else if(result!=='proposal'){
   accept(ai,choice,90_100);assert.equal(ai.snapshot().needs.napUrge,1);
   if(result==='cancelled')ai.cancel('visitor-interaction',95_000);
   else if(result==='failed')ai.complete({success:false,reason:'blocked',nowMs:103_000});
   else ai.complete({success:true,nowMs:103_000});
  }
  assert.equal(ai.snapshot().needs.lastSleepAt,result==='success'?103_000:null,result);
  assert.equal(ai.snapshot().needs.napUrge,result==='success'?0:1,result);
 }
});

test('a real sleep remains available while an unfinished story focuses other active behaviors',()=>{
 let naps=0,goals=0;
 for(let index=0;index<200;index++){
  const ai=createAutonomy({seed:index*9973+17});ai.choose(routineFacts(0,{context:{busy:true}}));
  const decision=ai.choose(routineFacts(90_000,{energy:.1,goal:{id:'find-lookout',targetId:'card-b'}}));
  if(decision.gesture==='sleep'){naps++;assert.equal(decision.kind,'rest');assert.equal(decision.characterGoal,undefined);}
  if(decision.characterGoal)goals++;
 }
 assert.ok(naps>40&&goals>40,'a strong story intention cannot suppress the physiological rest alternative');
 const focused=createAutonomy({seed:18425}).choose(routineFacts(1000,{goal:{id:'follow-light'}}));
 assert.equal(focused.characterGoal,'follow-light');assert.equal(focused.play,'light');
});
