import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
const source=readFileSync(new URL('./scroll-buddy.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const begin=source.indexOf('function updateDirectorActivity(now){'),end=source.indexOf('\n function updateDirector(',begin);
assert.ok(begin>=0&&end>begin);
const script=new Script('('+source.slice(begin,end).trim()+')');
function fixture(scene={id:'scene-7',status:'playing'}){
 const recorded=[],context=createContext({directorActivity:{sceneId:'scene-7',started:1000,targetId:'surface-1',action:'peek'},directorLastExecution:{status:'sequencing'},state:{clock:4},scenes:{snapshot:()=>({...scene})},rememberDirector:value=>recorded.push({...value})});
 return {context,recorded,update:script.runInContext(context),scene};
}
test('AI scene cancellation never claims a visit or replays a follow-up',()=>{
 const f=fixture({id:'scene-7',status:'cancelled'});f.update(2000);assert.equal(f.context.directorLastExecution.status,'cancelled');assert.equal(f.recorded.length,0);assert.equal(f.context.directorActivity,null);
});
test('another scene cannot complete an earlier AI intention',()=>{
 const f=fixture({id:'scene-8',status:'complete'});f.update(2000);assert.equal(f.recorded.length,0);assert.equal(f.context.directorLastExecution.status,'cancelled');
});
test('an active scene never creates a premature completed visit',()=>{
 const f=fixture();f.update(2000);assert.equal(f.recorded.length,0);assert.ok(f.context.directorActivity);
});
test('a completed full scene records the actual intention once',()=>{
 const f=fixture({id:'scene-7',status:'complete'});f.update(2000);f.update(2100);assert.equal(f.recorded.length,1);assert.equal(f.recorded[0].action,'peek');assert.equal(f.context.directorActivity,null);
});
test('a late completion cannot bypass the bounded ownership timeout',()=>{
 const f=fixture({id:'scene-7',status:'complete'});f.update(92000);assert.equal(f.recorded.length,0);assert.equal(f.context.directorLastExecution.status,'cancelled');
});

function privateControllerFunction(name,nextName){
 const from=source.indexOf('function '+name+'('),to=source.indexOf('\n function '+nextName+'(',from);
 assert.ok(from>=0&&to>from,'The actual '+name+' function must remain testable');
 return new Script('('+source.slice(from,to).trim()+')',{filename:'scroll-buddy.js:'+name});
}
const clearSceneScript=privateControllerFunction('clearScene','stopPlay');
const beginSceneScript=privateControllerFunction('beginCharacterScene','beginLightGoal');
const updateCharacterScript=privateControllerFunction('updateCharacter','currentSection');
function cleanupFixture({gesture=null,hold=null,pending=null,route=null}={}){
 const cancelled=[],context=createContext({
  scenes:{snapshot:()=>({id:'scene-7',status:'playing'}),cancel:reason=>cancelled.push(reason)},
  state:{gesture,expressionHold:hold,emotionUntil:Infinity,emotion:'happy',affect:{name:'delight'},clock:3},
  route,pendingGesture:pending,nextChoice:Infinity,nextSceneAt:0,performance:{now:()=>1000},
  sceneMeta:{decision:{targetId:'surface-a',action:'peek'}},sceneCommand:'scene-7:2',
  directorLastExecution:null,directorActivity:{sceneId:'scene-7'}
 });
 return {context,cancelled,clear:clearSceneScript.runInContext(context)};
}
test('scene cancellation releases its pending gesture staging route and finite scheduling',()=>{
 const f=cleanupFixture({pending:{sceneId:'scene-7'},route:{free:true,gestureStage:true}});
 f.clear('visitor-action');
 assert.equal(f.context.route,null);assert.equal(f.context.pendingGesture,null);
 assert.equal(f.context.nextChoice,1800);assert.equal(f.context.nextSceneAt,18000);
 assert.equal(f.context.state.affect,null);assert.equal(f.context.directorActivity,null);
 assert.equal(f.context.directorLastExecution.status,'cancelled');
 assert.deepEqual(f.cancelled,['visitor-action']);
});
test('scene cancellation releases Infinity expression ownership for both gesture and hold',()=>{
 for(const owned of ['gesture','hold']){
  const f=cleanupFixture({[owned]:{sceneId:'scene-7'},route:{free:true,gestureStage:true}});
  f.clear('paused');
  assert.equal(f.context.route,null);
  assert.equal(f.context.state.gesture,null);assert.equal(f.context.state.expressionHold,null);
  assert.equal(f.context.state.emotionUntil,1600);assert.equal(f.context.state.emotion,'neutral');
  assert.ok(Number.isFinite(f.context.nextChoice));
 }
});
test('cancelling a look without a route cannot leave nextChoice at Infinity',()=>{
 const f=cleanupFixture();f.clear('hidden');
 assert.ok(Number.isFinite(f.context.nextChoice));
 assert.equal(f.context.nextChoice,1800);
});
test('scene cleanup preserves a visitor gesture and staging route owned elsewhere',()=>{
 const visitor={source:'visitor',name:'wave'},route={free:true,gestureStage:true};
 const f=cleanupFixture({gesture:visitor,pending:{source:'visitor',name:'wink'},route});
 f.clear('replaced');
 assert.equal(f.context.state.gesture,visitor);assert.equal(f.context.route,route);
 assert.equal(f.context.state.emotionUntil,Infinity,'The independent visitor gesture still owns its expression');
 assert.equal(f.context.pendingGesture.name,'wink');
});
function beginSceneFixture(){
 const starts=[],surface={id:'surface-visible',element:{}},world={surfaces:[surface]};
 const context=createContext({
  avatar:{},active:true,reducedMotion:false,frozen:false,state:{gesture:null,expressionHold:null,clock:0},
  performance:{now:()=>1000},worldSnapshot:()=>world,publicComponents:()=>[{id:surface.id}],
  publicComponent:value=>value?{id:'project-visible'}:null,memory:{score:()=>1},
  companion:{isOpen:()=>false},directorBlocked:()=>({}),interest:{attentionId:surface.id},
  directorPlan:(_world,_surface,kind)=>({plan:{kind},side:1}),
  createScenePlan:value=>({...value,steps:[]}),
  scenes:{snapshot:()=>({id:'scene-8',status:'idle'}),start:(value,options)=>{starts.push({value,options});return true;}},
  clearScene:()=>assert.fail('No existing scene should be cancelled'),
  route:{untouched:true},pendingGesture:{untouched:true},nextChoice:0,sceneCommand:null,
  completedSceneRoute:null,completedSceneGesture:null,sceneMeta:null,directorActivity:null,directorLastExecution:null
 });
 return {context,starts,begin:beginSceneScript.runInContext(context)};
}
test('an explicitly requested lost scene target cannot redirect to a different visible card',()=>{
 const f=beginSceneFixture();
 assert.equal(f.begin({source:'assistant',targetId:'surface-lost',action:'inspect'}),false);
 assert.equal(f.starts.length,0);
 assert.equal(f.context.route.untouched,true);assert.equal(f.context.pendingGesture.untouched,true);
 assert.equal(f.context.interest.attentionId,'surface-visible');
});
test('a rest without a target cannot borrow the attention card or invent its visit',()=>{
 const f=beginSceneFixture();
 assert.equal(f.begin({source:'director',targetId:null,action:'rest',gesture:'none',expression:'neutral'}),true);
 assert.equal(f.starts.length,1);assert.equal(f.starts[0].value.targetId,null);
 assert.equal(f.context.sceneMeta.stableId,null);assert.equal(f.context.sceneMeta.action,'rest');
 assert.equal(f.context.interest.attentionId,null);
});
test('an available explicit scene target records the selected local action, not an inspect fallback',()=>{
 const f=beginSceneFixture();
 assert.equal(f.begin({source:'visitor',targetId:'surface-visible',action:'peek'}),true);
 assert.equal(f.starts[0].value.targetId,'surface-visible');
 assert.equal(f.context.sceneMeta.stableId,'project-visible');assert.equal(f.context.sceneMeta.action,'peek');
});
function completionFixture(status='complete'){
 const visits=[];let scene={id:'scene-9',targetId:'surface-visible',source:'visitor',status:'playing',command:null};
 const context=createContext({
  state:{affect:null,clock:4},AFFECT_DURATIONS:{},lastMemoryAt:1000,scrollY:0,lastPaceScroll:0,
  document:{activeElement:null,hidden:false},active:true,reducedMotion:false,interest:{scrollUntil:0,readingUntil:0},
  game:null,companion:{isOpen:()=>false},onScreen:()=>true,
  scenes:{snapshot:()=>({...scene}),step:()=>{scene={...scene,status};return {...scene};}},
  memory:{noteVisit:(id,options)=>visits.push({id,action:options.action})},
  sceneMeta:{stableId:'project-visible',action:'peek',decision:null},sceneCommand:null,
  route:null,nextChoice:Infinity,nextSceneAt:0,completedSceneRoute:null,completedSceneGesture:null,
  directorLastExecution:null,director:null,brainState:{spontaneousAllowed:true},pendingGesture:null
 });
 return {context,visits,update:updateCharacterScript.runInContext(context),
  world:{surfaces:[{id:'surface-visible'}],viewport:{}}};
}
test('only an entire completed local scene records its actual action once',()=>{
 const f=completionFixture('complete');f.update(0,1000,f.world);f.update(0,1100,f.world);
 assert.deepEqual(f.visits,[{id:'project-visible',action:'peek'}]);
 assert.equal(f.context.sceneMeta,null);assert.ok(Number.isFinite(f.context.nextChoice));
});
test('a cancelled local scene cannot invent a memory visit',()=>{
 const f=completionFixture('cancelled');f.update(0,1000,f.world);
 assert.deepEqual(f.visits,[]);assert.equal(f.context.sceneMeta,null);
});
test('automatic focus on an empty chat input does not cancel its contextual reaction',()=>{
 const f=completionFixture('playing'),scene={id:'scene-9',source:'assistant',targetId:'surface-visible',status:'playing',command:null};
 f.context.scenes={snapshot:()=>scene,step:()=>scene};
 f.context.document.activeElement={id:'m-companion-message',value:'',matches:()=>true};f.context.companion.isOpen=()=>true;
 f.context.clearScene=()=>assert.fail('The accepted response owns this short reaction');
 f.update(0,1000,f.world);assert.equal(f.visits.length,0);
});
test('new typing still interrupts a contextual reaction immediately',()=>{
 const f=completionFixture('playing'),scene={id:'scene-9',source:'assistant',targetId:'surface-visible',status:'playing',command:null},cancelled=[];
 f.context.scenes={snapshot:()=>scene,step:()=>scene};
 f.context.document.activeElement={id:'m-companion-message',value:'New question',matches:()=>true};
 f.context.clearScene=reason=>cancelled.push(reason);f.update(0,1000,f.world);
 assert.deepEqual(cancelled,['visitor-interaction']);
});

test('a perch hold clock starts at physical foot arrival, including a slow approach',()=>{
 const begin=source.indexOf('function advanceRoute(dt,now,world){'),end=source.indexOf('\n function componentKind(',begin);
 assert.ok(begin>=0&&end>begin);
 const element={isConnected:true},surface={id:'surface-1',element,left:0,top:0,width:100,height:100};
 const route={plan:{duration:50000,rect:{left:0,top:0},metrics:{contact:{x:0,y:0}}},elapsed:100,version:1,element};
 const state={x:0,y:0,mode:'perch',depthTarget:1,depth:1,targetId:surface.id};
 const context=createContext({state,route,nextChoice:0,game:null,metrics:{contact:{x:0,y:0}},scrollX:0,scrollY:0,onScreen:()=>true,
  clampActor:p=>p,bound:(n,min,max)=>Math.min(max,Math.max(min,n)),
  sampleCardAction:()=>({x:20,y:0,depth:1,phase:'hold'}),
  actorRect:()=>({left:0,right:20,top:0,bottom:20}),resolveDepth:()=>({depth:1,portalClear:true}),
  brain:{noteVisit:()=>true}});
 const advance=new Script('('+source.slice(begin,end).trim()+')').runInContext(context);
 const world={surfaces:[surface],version:1,viewport:{width:1000,height:1000},protectedRects:[]};
 advance(.016,1000,world);assert.equal(route.elapsed,100,'Travel cannot consume the resting hold');
 state.x=20;advance(.016,1016,world);assert.equal(route.elapsed,116,'The full hold begins after real arrival');
});
