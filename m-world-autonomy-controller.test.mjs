import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
import {createAutonomy} from './m-world-autonomy.mjs';
import {createScenePlan,createScenePlayer} from './m-world-scenes.mjs';
import {AFFECT_DURATIONS,M_AFFECTS} from './m-world-affect.mjs';
import {actorRect,bound} from './m-world-spatial.mjs';
import {M_GESTURES,GESTURE_DURATIONS as AUTHORED_DURATIONS,PAW_CONTACT_PROGRESS} from './m-world-acting.mjs';
import {planBallFlight,sampleBallFlight} from './m-world-ball.mjs';
import {MLifeV16} from './m-lab/interactions/life-v16.mjs';
import {isExplicitGesture,selectGestureIntent,gestureIntentExpired,gestureReady,gestureViewportFits} from './m-world-action-policy.mjs';

const source=readFileSync(new URL('./scroll-buddy.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
/** Exercise the shipped private functions, with browser/render/network boundaries supplied by a VM. */
function privateControllerFunction(name,nextName){
 const from=source.indexOf('function '+name+'(');
 const next=nextName.startsWith('playStop.')?'\n '+nextName:'\n function '+nextName+'(';
 const to=source.indexOf(next,from);
 assert.ok(from>=0&&to>from,'The actual '+name+' function must remain testable');
 return new Script('('+source.slice(from,to).trim()+')',{filename:'scroll-buddy.js:'+name});
}
const functions=[
 ['directorBlocked','rememberDirector'],['updateDirector','publicComponent'],
 ['setCharacterAffect','releaseCharacterAffect'],['releaseCharacterAffect','noteAutonomy'],
 ['noteAutonomy','finishAutonomy'],['finishAutonomy','cancelAutonomy'],
 ['cancelAutonomy','autonomyStatus'],['updateAutonomy','clearScene'],
 ['clearScene','stopPlay'],['stopPlay','beginCharacterScene'],
 ['beginCharacterScene','beginLightGoal'],['startPlay','queueBallPaw'],['queueBallPaw','renderBall'],['renderBall','playStop.addEventListener('],
 ['queueIntent','queueGesture'],['queueGesture','queueExpression'],['reactToTap','stageGesture'],
 ['stageGesture','updateGesture'],['updateGesture','updateLife'],['updateLife','renderCurrent']
].map(([name,next])=>[name,privateControllerFunction(name,next)]);

function fixture(){
 const metrics={size:100,footprint:{left:0,top:0,right:100,bottom:100,width:100,height:100},
  neutralFootprint:{left:15,top:15,right:85,bottom:85,width:70,height:70}};
 const world={viewport:{width:900,height:700,headerBottom:60},surfaces:[],protectedRects:[],version:1};
 const calls={stages:0,scheduled:0,lightGoals:0,director:[]};
 const context=createContext({
  actorRect,bound,gestureReady,gestureViewportFits,isExplicitGesture,selectGestureIntent,gestureIntentExpired,
  currentCharacterGoal:()=>null,recordCharacterExperience:()=>false,character:{snapshot:()=>({visits:1})},getContextComponent:()=>null,createScenePlan,AFFECT_DURATIONS,M_AFFECTS,M_GESTURES,GESTURE_DURATIONS:{...AUTHORED_DURATIONS,curious:2.2,playful:3,wave:2.4},PAW_CONTACT_PROGRESS,planBallFlight,sampleBallFlight,
  avatar:{},active:true,reducedMotion:false,frozen:false,document:{activeElement:null,hidden:false,getSelection:()=>({isCollapsed:true})},
  navigator:{language:'en'},performance:{now:()=>1000},scrollX:0,scrollY:0,
  state:{x:120,y:120,vx:0,vy:0,depth:1,depthTarget:1,phase:'hold',mode:'rest',clock:0,
   gesture:null,expressionHold:null,affect:null,emotion:'neutral',emotionUntil:0},
  metrics,world,viewport:()=>world.viewport,worldSnapshot:()=>world,
  interest:{scrollUntil:0,readingUntil:0,userAttentionUntil:0,attentionId:null},
  companion:null,director:null,observer:null,directorComponents:[],directorActivity:null,directorLastExecution:null,
  directorNextRead:0,directorSnapshot:null,directorRevision:0,directorKey:'',directorEvent:'idle',directorRecent:[],
  publicComponents:()=>[],publicComponent:()=>null,currentSection:()=>'work',
  memory:{score:()=>1},characterEnergy:.7,autonomyFatigue:0,autonomyLastRead:0,autonomyNextRead:0,
  autonomy:createAutonomy({seed:7}),autoExecution:null,
  autoStats:{accepted:0,completed:0,failed:0,cancelled:0,events:[]},
  scenes:createScenePlayer(),sceneMeta:null,sceneCommand:null,completedSceneRoute:null,completedSceneGesture:null,
  game:null,gameSerial:0,lastAutonomousGame:null,route:null,pendingGesture:null,nextChoice:0,nextSceneAt:0,
  recentCorridors:[],chooseCorridorTarget:()=>null,directorPlan:()=>null,
  playNext:{},playNote:{},playDock:{hidden:true},playLight:{hidden:true},playBall:{hidden:true,style:{}},
  schedule:()=>{calls.scheduled++;},life:{manual:()=>{},random:()=>.5},
  planGestureStage:()=>{calls.stages++;return {target:{x:200,y:120},egress:{x:120,y:120},escape:false,reentry:false};},
  overlap:(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,
  beginLightGoal:()=>{calls.lightGoals++;return true;}
 });
 for(const [name,script]of functions)context[name]=script.runInContext(context);
 return {context,calls,world,metrics};
}

function startQuiet(f){
 f.context.interest.readingUntil=20_000;
 f.context.updateAutonomy(1000,f.world);
 assert.ok(f.context.autoExecution,'The real decider must reserve and accept a quiet intention');
 assert.equal(f.context.autoExecution.decision.quiet,true);
 return f.context.autoExecution.decision;
}

test('quiet reading choices queue and perform in place without calling staging',()=>{
 const f=fixture(),route={free:true,target:{x:120,y:120}},position={x:120,y:120};
 f.context.route=route;
 const decision=startQuiet(f);
 assert.equal(f.context.pendingGesture.quiet,true);
 assert.equal(f.context.pendingGesture.autonomyId,decision.id);
 assert.equal(f.calls.stages,0);assert.equal(f.context.route,route);
 f.context.updateGesture(.016,f.world,1016);
 assert.equal(f.calls.stages,0);
 assert.equal(f.context.route,route);
 assert.equal(f.context.state.expressionHold.autonomyId,decision.id);
 assert.deepEqual({x:f.context.state.x,y:f.context.state.y},position);
 assert.equal(f.context.state.affect.name,decision.affect);
});

test('quiet choices defer when the existing pose is moving or the neutral body covers protected text',()=>{
 for(const unsafe of ['approaching','covered']){
  const f=fixture();
  if(unsafe==='approaching')f.context.state.phase='approach';
  else f.world.protectedRects=[{left:145,top:145,right:165,bottom:165}];
  f.context.interest.readingUntil=20_000;
  const route={free:true,untouched:true};f.context.route=route;
  f.context.updateAutonomy(1000,f.world);
  assert.equal(f.context.autoExecution,null,unsafe);
  assert.equal(f.context.pendingGesture,null);
  assert.equal(f.context.route,route);assert.equal(f.calls.stages,0);
  assert.equal(f.context.autonomy.snapshot().completedCount,0);
  assert.equal(f.context.autoStats.completed,0);
 }
});

test('the remote director remains busy for accepted local staging and preserves its pending gesture',()=>{
 for(const staging of ['pending','route','both']){
  const f=fixture();
  const pending={source:'life',name:'curious',autonomyId:'autonomy-accepted'};
  f.context.pendingGesture=staging==='route'?null:pending;
  f.context.route=staging==='pending'?null:{free:true,gestureStage:true,autonomyId:'autonomy-accepted'};
  f.context.director={update:value=>f.calls.director.push(value),getStatus:()=>({pending:true})};
  f.context.observer={capture:()=>({targets:[]})};
  assert.equal(f.context.directorBlocked(1000).busy,true,staging);
  f.context.updateDirector(1000,f.world,true);
  assert.equal(f.calls.director.length,1);
  assert.equal(f.calls.director[0].busy,true);
  assert.equal(f.context.pendingGesture,staging==='route'?null:pending);
 }
});

test('staging created by the actual queue is stamped with its autonomous owner',()=>{
 const f=fixture();
 const intent={source:'life',name:'curious',expression:'curious',autonomyId:'autonomy-stage',queuedAt:0};
 assert.equal(f.context.queueIntent(intent),true);
 assert.equal(f.calls.stages,1);
 assert.equal(f.context.route.gestureStage,true);
 assert.equal(f.context.route.autonomyId,intent.autonomyId);
 assert.equal(f.context.directorBlocked(1000).busy,true);
});

test('manual light play cancels the autonomous gesture/face before the playback guard',()=>{
 for(const playing of ['gesture','expressionHold']){
  const f=fixture(),decision=startQuiet(f);
  f.context.pendingGesture=null;
  f.context.state[playing]={source:'life',autonomyId:decision.id,name:'curious',age:0};
  f.context.route={free:true,gestureStage:true,autonomyId:decision.id};
  assert.equal(f.context.startPlay('light'),true,playing);
  assert.equal(f.context.state.gesture,null);assert.equal(f.context.state.expressionHold,null);
  assert.equal(f.context.game.name,'light');assert.equal(f.context.game.autonomous,false);
  assert.equal(f.calls.lightGoals,1);
  assert.equal(f.context.autoExecution,null);
  assert.equal(f.context.autonomy.snapshot().lastOutcome.status,'cancelled');
  assert.equal(f.context.autoStats.cancelled,1);assert.equal(f.context.autoStats.completed,0);
 }
});

test('a manual scene also cancels its autonomous expression before testing whether a scene can start',()=>{
 const f=fixture(),decision=startQuiet(f);
 f.context.pendingGesture=null;
 f.context.state.expressionHold={source:'life',autonomyId:decision.id,age:0};
 assert.equal(f.context.beginCharacterScene({source:'visitor',action:'rest',gesture:'none'}),true);
 assert.equal(f.context.scenes.snapshot().status,'playing');
 assert.equal(f.context.scenes.snapshot().source,'visitor');
 assert.equal(f.context.state.expressionHold,null);
 assert.equal(f.context.autoExecution,null);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
});

test('finish releases orphaned owned staging after its pending gesture is lost',()=>{
 const f=fixture(),decision=startQuiet(f);
 f.context.pendingGesture=null;
 f.context.route={free:true,gestureStage:true,autonomyId:decision.id};
 f.context.finishAutonomy(false,'performance-unavailable',2000);
 assert.equal(f.context.route,null);
 assert.equal(f.context.autoExecution,null);
 assert.equal(f.context.autonomy.snapshot().lastOutcome.status,'failed');
 assert.equal(f.context.autoStats.failed,1);assert.equal(f.context.autoStats.completed,0);
 assert.ok(Number.isFinite(f.context.nextChoice));
});

test('finish and cancel preserve unrelated routes and pending visitor work',()=>{
 for(const cleanup of ['finish','cancel']){
  const f=fixture();startQuiet(f);
  const route={free:true,gestureStage:true,autonomyId:'another-owner'};
  const pending={source:'visitor',name:'wave',autonomyId:'another-owner'};
  f.context.route=route;f.context.pendingGesture=pending;
  if(cleanup==='finish')f.context.finishAutonomy(false,'interrupted',2000);
  else f.context.cancelAutonomy('visitor-action',2000);
  assert.equal(f.context.route,route,cleanup);
  assert.equal(f.context.pendingGesture,pending,cleanup);
  assert.equal(f.context.autonomy.snapshot().completedCount,0);
 }
});

test('cancelling an owned pending gesture cannot delete staging stamped with another owner',()=>{
 const f=fixture(),decision=startQuiet(f);
 assert.equal(f.context.pendingGesture.autonomyId,decision.id);
 const route={free:true,gestureStage:true,autonomyId:'another-owner'};
 f.context.route=route;
 f.context.cancelAutonomy('visitor-action',2000);
 assert.equal(f.context.pendingGesture,null);
 assert.equal(f.context.route,route,'Pending ownership does not confer ownership of a different stamped route');
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
});

test('a quiet performance is not complete while queued or visible, and completes exactly once after its actual hold',()=>{
 const f=fixture(),decision=startQuiet(f);
 f.context.updateAutonomy(1100,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,0,'queued work has no result');
 f.context.updateGesture(.016,f.world,1116);
 f.context.updateAutonomy(1116,f.world);
 assert.ok(f.context.autoExecution.visible);
 assert.equal(f.context.autonomy.snapshot().completedCount,0,'a visible in-progress face is still running');
 const duration=f.context.state.expressionHold.duration;
 f.context.updateGesture(duration-.001,f.world,2000);
 f.context.updateAutonomy(2000,f.world);
 assert.ok(f.context.state.expressionHold);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
 f.context.updateGesture(.002,f.world,2002);
 f.context.updateAutonomy(2002,f.world);
 assert.equal(f.context.autoExecution,null);
 assert.equal(f.context.autonomy.snapshot().completedCount,1);
 assert.equal(f.context.autoStats.completed,1);
 assert.equal(f.context.autoStats.events.at(-1).id,decision.id);
 f.context.updateAutonomy(2100,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,1);
 assert.equal(f.context.autoStats.completed,1);
});

test('a lost queued performance fails instead of inventing a completed expression',()=>{
 const f=fixture(),decision=startQuiet(f);
 f.context.pendingGesture=null;
 f.context.route={free:true,gestureStage:true,autonomyId:decision.id};
 f.context.updateAutonomy(2600,f.world);
 assert.equal(f.context.autoExecution,null);assert.equal(f.context.route,null);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
 assert.equal(f.context.autonomy.snapshot().failedCount,1);
 assert.equal(f.context.autoStats.events.at(-1).reason,'performance-unavailable');
});

function sceneFixture(){
 const f=fixture();
 const decision=f.context.autonomy.choose({nowMs:0,energy:.8,selfPlayAvailable:false,
  context:{active:true},targets:[{id:'card',stableId:'project',actions:['inspect'],novelty:1,visibleShare:1,distance:100}]});
 assert.equal(decision.kind,'scene');
 assert.equal(f.context.autonomy.resolve(decision.id,{accepted:true,nowMs:0}),true);
 const plan=createScenePlan({source:'life',targetId:decision.targetId,action:decision.action,
  gesture:decision.gesture,expression:decision.expression,actions:['inspect']});
 assert.equal(f.context.scenes.start(plan,{nowMs:0}),true);
 f.context.autoExecution={decision,kind:'scene',started:0,sceneId:f.context.scenes.snapshot().id,visible:false};
 return f;
}

test('physical scene ownership cannot finish before its gesture acknowledgement and final timed rest',()=>{
 const f=sceneFixture();
 f.context.updateAutonomy(500,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
 let scene=f.context.scenes.step({nowMs:700});
 assert.equal(scene.command.type,'gesture');
 f.context.updateAutonomy(1000,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
 assert.equal(f.context.scenes.complete(scene.command.id,{success:true},1000),true);
 f.context.updateAutonomy(2000,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,0,'the final rest remains part of the accepted scene');
 scene=f.context.scenes.step({nowMs:2400});assert.equal(scene.status,'complete');
 f.context.updateAutonomy(2400,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,1);
 assert.equal(f.context.autonomy.snapshot().targetHistory[0].successes,1);
 assert.equal(f.context.autoStats.completed,1);
 f.context.updateAutonomy(2500,f.world);
 assert.equal(f.context.autonomy.snapshot().completedCount,1);
});

test('a cancelled or replaced scene cannot complete the earlier autonomous intention',()=>{
 for(const replacement of [false,true]){
  const f=sceneFixture();
  f.context.scenes.cancel('no-safe-route');
  if(replacement){
   assert.equal(f.context.scenes.start(createScenePlan({source:'visitor',action:'rest',gesture:'none'}),{nowMs:1000}),true);
   f.context.scenes.step({nowMs:2500});
   assert.equal(f.context.scenes.snapshot().status,'complete');
  }
  f.context.updateAutonomy(2600,f.world);
  assert.equal(f.context.autonomy.snapshot().completedCount,0);
  assert.equal(f.context.autonomy.snapshot().failedCount,1);
  assert.equal(f.context.autoStats.failed,1);assert.equal(f.context.autoStats.completed,0);
  assert.equal(f.context.autonomy.snapshot().targetHistory[0].successes,0);
 }
});

test('a game result must match the owned game ID and report actual completion',()=>{
 for(const result of [{id:8,reason:'complete'},{id:7,reason:'route-cancelled'},{id:7,reason:'complete'}]){
  const f=fixture(),decision=startQuiet(f);
  f.context.pendingGesture=null;
  f.context.autoExecution={decision,kind:'game',gameId:7,started:1000};
  f.context.lastAutonomousGame=result;
  f.context.updateAutonomy(2000,f.world);
  const complete=result.id===7&&result.reason==='complete';
  assert.equal(f.context.autonomy.snapshot().completedCount,complete?1:0);
  assert.equal(f.context.autoStats.completed,complete?1:0);
  assert.equal(f.context.autoStats.failed,complete?0:1);
 }
});

test('a motionless visitor does not drain the autonomous internal energy',()=>{
 const f=fixture();let observed;f.context.characterEnergy=.2;
 f.context.autonomy.choose=facts=>{observed=facts;return null;};f.context.updateAutonomy(1000,f.world);
 assert.ok(Math.abs(observed.energy-.784)<1e-9);assert.equal(observed.context.reading,false);
});
test('without active reading M can reach a safe place for an unprompted quiet performance',()=>{
 const f=fixture();f.context.state.phase='approach';f.context.state.vx=10;
 f.context.autonomy=createAutonomy({seed:1000});
 f.context.updateAutonomy(1000,f.world);
 assert.ok(f.context.autoExecution);assert.equal(f.context.autoExecution.decision.quiet,true);
 assert.equal(f.context.pendingGesture.quiet,false);assert.ok(f.calls.stages>0);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
});
test('an autonomous game starts without showing an invitation or requiring a user control',()=>{
 const f=fixture();assert.equal(f.context.startPlay('light',{autonomous:true,decision:{id:'autonomy-1'}}),true);
 assert.equal(f.context.game.autonomous,true);assert.equal(f.context.game.autonomyId,'autonomy-1');
 assert.equal(f.context.playDock.hidden,true);assert.equal(f.calls.lightGoals,1);assert.equal(f.context.game.score,0);
});

test('explicit taps preserve the original single, double and repeated V16 reactions and override local play',()=>{
 const f=fixture();f.context.life=new MLifeV16({seed:18421});
 startQuiet(f);
 for(const [index,expression,names]of [[1,'happy',['wave','playful']],[2,'surprised',['surprised']],[3,'surprised',['surprised']],[4,'curious',['shy','wink']]]){
  assert.equal(f.context.reactToTap(),true);
  assert.equal(f.context.pendingGesture.source,'visitor');
  assert.equal(f.context.pendingGesture.expression,expression);
  assert.ok(names.includes(f.context.pendingGesture.name),index);
  assert.equal(f.context.pendingGesture.autonomyId,undefined);
  assert.equal(f.context.life.pending,null);
 }
 assert.equal(f.context.autoExecution,null);
 assert.equal(f.context.autonomy.snapshot().active,null);
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
});

test('tap reactions respect pause, reduced motion and an unloaded original model',()=>{
 for(const blocker of ['active','reducedMotion','avatar']){
  const f=fixture();f.context.life=new MLifeV16({seed:18421});
  f.context[blocker]=blocker==='reducedMotion'?true:blocker==='avatar'?null:false;
  assert.equal(f.context.reactToTap(),false);
  assert.equal(f.context.life.tapHistory.length,0);assert.equal(f.context.pendingGesture,null);
 }
});

test('legacy spontaneous V16 actions cannot regain motion ownership',()=>{
 const f=fixture();f.context.life=new MLifeV16({seed:18421});f.context.life.nextAction=0;
 f.context.brain={observe:()=>({spontaneousAllowed:true})};
 f.context.updateLife(.016,f.world,1000);
 assert.ok(f.context.lastLife.action,'The legacy sampler genuinely emitted an action');
 assert.equal(f.context.pendingGesture,null);assert.equal(f.context.state.gesture,null);
 assert.equal(f.context.route,null);assert.equal(f.calls.stages,0);
});


test('a requested diagnostic route preempts autonomous staging before it can replace the perch',async()=>{
 const f=fixture();startQuiet(f);
 const from=source.indexOf('async playAction('),to=source.indexOf('\n  setDepth(',from);
 assert.ok(from>=0&&to>from);
 const method=new Script('({'+source.slice(from,to).trim().replace(/,$/u,'')+'}).playAction').runInContext(f.context);
 const element={isConnected:true};f.context.cache={dirty:false,lastRead:1000};
 f.context.document.querySelectorAll=()=>[element];f.context.avatar.getMetrics=()=>f.metrics;
 f.context.startRoute=()=>{f.context.route={plan:{kind:'perch'},element};f.context.state.mode='perch';};
 f.context.setActive=()=>{};f.context.snapshot=()=>({});
 await method({kind:'perch'});
 assert.equal(f.context.autoExecution,null);assert.equal(f.context.pendingGesture,null);
 const requested=f.context.route;assert.equal(requested.explicit,true);
 f.context.updateGesture(.016,f.world,1100);
 assert.equal(f.context.route,requested);assert.equal(f.context.state.mode,'perch');
 assert.equal(f.context.autonomy.snapshot().completedCount,0);
});
