import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
import {createCharacter,characterReceiptId} from './m-world-character.mjs';
import {createAutonomy} from './m-world-autonomy.mjs';
import {getContextComponent} from './m-world-context.mjs';
import {planGestureStage} from './m-world-action-policy.mjs';
import {actorRect} from './m-world-spatial.mjs';
const source=readFileSync(new URL('./scroll-buddy.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};};
function actual(name,next,context){const from=source.indexOf('function '+name+'('),to=source.indexOf('\n function '+next+'(',from);assert.ok(from>=0&&to>from);return new Script('('+source.slice(from,to).trim()+')').runInContext(context);}
function fixture(profileStorage=storage()){
 const profile=createCharacter({storage:profileStorage,now:()=>1_000_000});
 const world={viewport:{width:900,height:700,headerBottom:60},surfaces:[],protectedRects:[]};
 const calls={outcomes:[],cancelled:0,cleared:0,refresh:0};
 const context=createContext({character:profile,characterReceiptId,getContextComponent,planGestureStage,actorRect,
  state:{x:250,y:220,depth:1,depthTarget:1,affect:null},metrics:{size:100,footprint:{left:0,top:0,right:100,bottom:100,width:100,height:100},neutralFootprint:{left:15,top:15,right:85,bottom:85,width:70,height:70}},
  currentSection:()=> 'home',overlap:(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,
  world,autonomy:createAutonomy({seed:18425}),autoExecution:null,route:null,pendingGesture:null,
  directorRecent:[],directorEvent:'idle',nextChoice:0,
  noteAutonomy:(status,decision,now,reason)=>calls.outcomes.push({status,id:decision.id,reason}),
  releaseCharacterAffect:()=>{},setCharacterAffect:name=>{context.state.affect={name};},
  cancelAutonomy:()=>{calls.cancelled++;context.autoExecution=null;context.autonomy.cancel('memory-reset',20_000);},
  memory:{clear:()=>{calls.cleared++;}},performance:{now:()=>20_000},companion:{refresh:()=>{calls.refresh++;}}
 });
 for(const [name,next]of [['currentCharacterGoal','recordCharacterExperience'],['recordCharacterExperience','resetCharacterMemory'],['resetCharacterMemory','setCharacterAffect'],['finishAutonomy','cancelAutonomy']])context[name]=actual(name,next,context);
 return {context,profile,profileStorage,world,calls};
}
const targets=[{id:'surface-current',stableId:'portrait-ricardo',actions:['perch','inspect'],distance:180}];
function execute(f,goal,success=true,nowMs=1000){
 const decision=f.context.autonomy.choose({nowMs,goal,context:{active:true},energy:.8,selfPlayAvailable:true,targets});
 assert.equal(decision.characterGoal,goal.id);assert.equal(f.context.autonomy.resolve(decision.id,{accepted:true,nowMs}),true);
 f.context.autoExecution={decision,characterVisit:f.profile.snapshot().visitId,characterComponent:goal.restingPlace||targets.find(t=>t.id===decision.targetId)?.stableId||null,characterPublicComponent:goal.restingPlace?null:targets.find(t=>t.id===decision.targetId)?.stableId||null};
 f.context.finishAutonomy(success,success?'actual-complete':'route-cancelled',nowMs+1000);return decision;
}

test('actual completion receipts advance a chapter exactly once and a failed action cannot discover the light',()=>{
 const f=fixture();execute(f,{id:'follow-light'},false);
 assert.equal(f.profile.snapshot().beat,'seeking');assert.equal(f.profile.snapshot().journal.length,0);
 execute(f,{id:'follow-light'},true,10_000);
 assert.equal(f.profile.snapshot().beat,'returning');assert.deepEqual(f.profile.snapshot().journal.map(e=>e.id),['light-found']);
 assert.equal(f.context.state.affect.name,'proud');
 f.context.finishAutonomy(true,'duplicate',12_000);assert.equal(f.profile.snapshot().journal.length,1);
});

test('a physical owner without the matching autonomy acknowledgement cannot advance character history',()=>{
 const f=fixture();f.context.autoExecution={decision:{id:'lost-owner',characterGoal:'follow-light',kind:'self-play'},characterVisit:f.profile.snapshot().visitId};
 f.context.finishAutonomy(true,'claimed-complete',1000);
 assert.equal(f.profile.snapshot().beat,'seeking');assert.equal(f.profile.snapshot().journal.length,0);
 assert.equal(f.calls.outcomes[0].status,'failed');assert.equal(f.calls.outcomes[0].reason,'ownership-lost');
});

test('a completed mapped lookout persists and resolves by stable ID after a new page incarnation',()=>{
 const f=fixture();execute(f,{id:'follow-light'});execute(f,{id:'find-lookout',targetId:'surface-current'},true,10_000);
 assert.equal(f.profile.snapshot().beat,'complete');assert.equal(f.profile.snapshot().favorite.stableId,'portrait-ricardo');
 const reopened=fixture(f.profileStorage);assert.equal(reopened.profile.getContext().goal,'revisit-lookout');
 const moved=[{...targets[0],id:'surface-new-layout'}];
 assert.equal(reopened.context.currentCharacterGoal(moved,reopened.world).targetId,'surface-new-layout');
 assert.equal(reopened.context.currentCharacterGoal([],reopened.world),null,'A missing favorite cannot be substituted or erased');
 assert.equal(reopened.profile.snapshot().favorite.stableId,'portrait-ricardo');
 execute(reopened,{id:'revisit-lookout',targetId:'surface-current'});
 assert.equal(reopened.profile.getContext().goal,'explore');assert.equal(reopened.profile.snapshot().journal.at(-1).id,'lookout-revisited');
});

test('a responsive layout without a mapped card can establish a genuinely clear hover lookout',()=>{
 const f=fixture();execute(f,{id:'follow-light'});
 const goal=f.context.currentCharacterGoal([],f.world);assert.equal(goal.restingPlace,'lookout-home');assert.equal(goal.targetId,null);
 execute(f,goal,true,10_000);assert.equal(f.profile.snapshot().favorite.stableId,'lookout-home');assert.equal(f.profile.getContext().favoriteComponent,null);
 const reopened=fixture(f.profileStorage);assert.equal(reopened.context.currentCharacterGoal([],reopened.world).restingPlace,'lookout-home');
 reopened.context.currentSection=()=> 'projects';assert.equal(reopened.context.currentCharacterGoal([],reopened.world),null);
});

test('a fully protected layout cannot manufacture a lookout or a story receipt',()=>{
 const f=fixture();execute(f,{id:'follow-light'});
 f.world.protectedRects=[{left:0,top:0,right:900,bottom:700}];
 assert.equal(f.context.currentCharacterGoal([],f.world),null);
 assert.equal(f.profile.snapshot().beat,'returning');assert.equal(f.profile.snapshot().journal.length,1);
});

test('reset clears the story and owner but preserves unrelated accounting and chat storage',()=>{
 const f=fixture();f.profileStorage.setItem('m-world-director-session-v1','quota-kept');f.profileStorage.setItem('unrelated-chat','draft-kept');
 execute(f,{id:'follow-light'});f.context.resetCharacterMemory();
 assert.equal(f.calls.cancelled,1);assert.equal(f.calls.cleared,1);assert.equal(f.calls.refresh,1);
 assert.equal(f.profile.snapshot().beat,'seeking');assert.equal(f.profile.snapshot().journal.length,0);
 assert.equal(f.profileStorage.getItem('m-world-director-session-v1'),'quota-kept');assert.equal(f.profileStorage.getItem('unrelated-chat'),'draft-kept');
});
