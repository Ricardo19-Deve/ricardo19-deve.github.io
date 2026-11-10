import test from 'node:test';
import assert from 'node:assert/strict';
import {createScenePlan,createScenePlayer,sceneTiming,SCENE_MAX_ACTIVE_MS,SCENE_STEP_TIMEOUT_MS} from './m-world-scenes.mjs';
const plan=(extra={})=>createScenePlan({targetId:'surface-card',action:'peek',gesture:'wink',expression:'happy',source:'director',actions:['peek','perch'],...extra});
test('a decision expands into look, safe travel, reaction, offered perch and rest',()=>{
 const input={targetId:'surface-card',action:'peek',gesture:'wink',expression:'happy',source:'director',actions:['peek','perch']};
 const copy=structuredClone(input),p=createScenePlan(input);
 assert.deepEqual(input,copy);
 assert.deepEqual(p.steps.map(step=>step.type),['look','travel','gesture','travel','rest']);
 assert.deepEqual(p.steps.filter(step=>step.type==='travel').map(step=>step.action),['peek','perch']);
 assert.ok(p.steps.every(step=>step.targetId==='surface-card'&&step.expression==='happy'));
 const noPerch=plan({actions:['peek']});
 assert.deepEqual(noPerch.steps.map(step=>step.type),['look','travel','gesture','rest']);
 assert.equal(createScenePlan({...input,actions:['inspect']}),null);
});
test('inspect has no invented travel and quiet rest has no invented gesture',()=>{
 assert.deepEqual(plan({action:'inspect',actions:['inspect']}).steps.map(step=>step.type),['look','gesture','rest']);
 assert.deepEqual(createScenePlan({action:'rest',targetId:null,gesture:'none',expression:'neutral'}).steps,[{type:'rest',targetId:null,expression:'neutral',durationMs:1400}]);
 for(const bad of [{targetId:'<script>'},{action:'click'},{gesture:'execute-code'},{expression:'angry'},{source:'external'},{actions:['peek','peek']}])assert.equal(plan(bad),null);
});
test('travel and reaction need actual completion acknowledgements; only timed holds advance themselves',()=>{
 const player=createScenePlayer();assert.equal(player.start(plan(),{nowMs:0}),true);
 assert.equal(player.step({nowMs:699}).stage,'look');
 const travel=player.step({nowMs:700});assert.equal(travel.stage,'travel');
 assert.equal(player.step({nowMs:9000}).command.id,travel.command.id);
 assert.equal(player.complete('not-the-current-command'),false);
 assert.equal(player.complete(travel.command.id,{},9000),true);
 const react=player.snapshot();assert.equal(react.stage,'react');assert.equal(react.command.gesture,'wink');
 assert.equal(player.complete(travel.command.id,{},9000),false);
 assert.equal(player.complete(react.command.id,{},10_000),true);
 const perch=player.snapshot();assert.equal(perch.command.action,'perch');
 assert.equal(player.complete(perch.command.id,{},11_000),true);
 assert.equal(player.snapshot().stage,'rest');
 assert.equal(player.complete(player.snapshot().command.id,{},11_000),false);
 assert.equal(player.step({nowMs:12_399}).status,'playing');
 assert.equal(player.step({nowMs:12_400}).status,'complete');
 assert.equal(player.snapshot().command,null);
});
test('invalid plans and silent replacements cannot capture the scene owner',()=>{
 const player=createScenePlayer();assert.equal(player.start({...plan(),url:'https://untrusted.invalid'}),false);
 assert.equal(player.start({...plan(),steps:[{type:'travel',targetId:'surface-card',expression:'happy',action:'click'}]}),false);
 assert.equal(player.start(plan(),{nowMs:NaN}),false);
 assert.equal(player.start(plan()),true);const before=player.snapshot();
 assert.equal(player.start(plan({source:'visitor'})),false);assert.deepEqual(player.snapshot(),before);
 assert.equal(player.cancel('visitor-interrupted'),true);assert.equal(player.start(plan({source:'visitor'})),true);
 assert.notEqual(player.snapshot().id,before.id);
 assert.equal(player.complete(before.id+':1'),false);
});
test('pauses exclude hidden or engaged time and resume without consuming the gap',()=>{
 const player=createScenePlayer();player.start(plan());
 assert.equal(player.step({nowMs:600}).elapsedMs,600);
 player.step({nowMs:700,blocked:true});player.step({nowMs:60_000,blocked:true});
 const resumed=player.step({nowMs:70_000,blocked:false});
 assert.equal(resumed.elapsedMs,600);assert.equal(resumed.stage,'look');
 assert.equal(player.step({nowMs:70_100}).stage,'travel');
});
test('a lost target or failed physical route cancels without a reaction',()=>{
 for(const loseTarget of [true,false]){
  const player=createScenePlayer();player.start(plan());const travel=player.step({nowMs:700});
  if(loseTarget)player.step({nowMs:800,targetAvailable:false,blocked:true});
  else assert.equal(player.complete(travel.command.id,{success:false,reason:'route-cancelled'},800),true);
  const state=player.snapshot();assert.equal(state.status,'cancelled');assert.equal(state.command,null);
  assert.equal(state.reason,loseTarget?'target-unavailable':'route-cancelled');
  assert.equal(player.complete(travel.command.id),false);
 }
});
test('an uncompleted route expires as a failure, never as a successful visit',()=>{
 const player=createScenePlayer();player.start(plan());const travel=player.step({nowMs:700});
 assert.equal(player.step({nowMs:700+SCENE_STEP_TIMEOUT_MS-1}).status,'playing');
 const expired=player.step({nowMs:700+SCENE_STEP_TIMEOUT_MS});
 assert.equal(expired.status,'cancelled');assert.equal(expired.reason,'step-timeout');
 assert.equal(player.complete(travel.command.id),false);
});
test('whole-scene active time remains bounded across successfully acknowledged steps',()=>{
 const player=createScenePlayer();player.start(plan());let state=player.step({nowMs:700});
 player.step({nowMs:34_700});player.complete(state.command.id,{},34_700);
 state=player.snapshot();player.step({nowMs:43_700});player.complete(state.command.id,{},43_700);
 assert.equal(player.step({nowMs:SCENE_MAX_ACTIVE_MS}).reason,'scene-timeout');
 assert.equal(player.snapshot().status,'cancelled');
});
test('nonfinite/backward clocks and mutated snapshots cannot rewind or alter commands',()=>{
 const player=createScenePlayer(),p=plan();player.start(p);p.steps[0].durationMs=100;
 const first=player.step({nowMs:600});first.command.expression='surprised';
 assert.equal(player.step({nowMs:NaN}).elapsedMs,600);
 assert.equal(player.step({nowMs:-1}).elapsedMs,600);
 assert.equal(player.step({nowMs:500}).elapsedMs,600);
 assert.equal(player.snapshot().command.expression,'happy');
 assert.equal(player.step({nowMs:700}).stage,'travel');
});
test('acknowledgement timestamps cannot bypass a route deadline or scene active budget',()=>{
 const player=createScenePlayer();player.start(plan());const current=player.step({nowMs:700});
 assert.equal(player.complete(current.command.id,{},40_000),false);
 assert.equal(player.snapshot().reason,'step-timeout');
});
test('reaction budget includes safe staging before the actual gesture finishes',()=>{
 const player=createScenePlayer();player.start(createScenePlan({targetId:'card-1',action:'inspect',gesture:'curious'}),{nowMs:0});
 const reaction=player.step({nowMs:700});assert.equal(reaction.command.type,'gesture');
 assert.equal(player.step({nowMs:18000}).status,'playing','A valid long approach may precede the gesture');
 assert.equal(player.complete(reaction.command.id,{},22000),true);
 assert.equal(player.snapshot().stage,'rest');
});

test('context extends focused observation and tired recovery without inventing actions',()=>{
 const baseline=sceneTiming(),focused=sceneTiming({focus:1}),tired=sceneTiming({energy:.2});
 assert.deepEqual(baseline,{lookMs:700,restMs:1400});
 assert.ok(focused.lookMs>baseline.lookMs);assert.ok(tired.restMs>baseline.restMs);
 assert.ok(sceneTiming({energy:.9}).restMs<tired.restMs);
 const original=plan(),contextual=plan({timing:{energy:.2,focus:.8,arousal:.2}});
 assert.deepEqual(contextual.steps.map(step=>step.type),original.steps.map(step=>step.type));
 assert.deepEqual(contextual.steps.filter(step=>!['look','rest'].includes(step.type)),original.steps.filter(step=>!['look','rest'].includes(step.type)));
 const inspect=plan({action:'inspect',actions:['inspect'],timing:{energy:.2,focus:1}});
 assert.equal(inspect.steps.some(step=>step.type==='travel'),false);
 const rest=plan({action:'rest',targetId:null,gesture:'none',actions:[],timing:{energy:.2}});
 assert.equal(rest.steps.length,1);assert.equal(rest.steps[0].type,'rest');
 assert.ok(rest.steps[0].durationMs>1400);
});

test('context timing stays finite and bounded and preserves strict scene-player ownership',()=>{
 for(const timing of [undefined,null,{},false,'unused',{energy:NaN,focus:Infinity,arousal:'loud'}])assert.deepEqual(sceneTiming(timing),{lookMs:700,restMs:1400});
 for(const energy of [-100,0,.5,1,100])for(const focus of [-100,0,.5,1,100])for(const arousal of [-100,0,.5,1,100]){
  const timing={energy,focus,arousal},copy={...timing},values=sceneTiming(timing),p=plan({timing});
  assert.deepEqual(timing,copy);assert.ok(values.lookMs>=450&&values.lookMs<=1300);
  assert.ok(values.restMs>=900&&values.restMs<=2400);
  const player=createScenePlayer();assert.equal(player.start(p),true);
  assert.equal(player.step({nowMs:values.lookMs-1}).stage,'look');
  const travel=player.step({nowMs:values.lookMs});assert.equal(travel.stage,'travel');
  assert.equal(player.step({nowMs:values.lookMs+1}).command.id,travel.command.id);
 }
});
