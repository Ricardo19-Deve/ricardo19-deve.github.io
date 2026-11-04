import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,Script} from 'node:vm';
import {planBallFlight,sampleBallFlight} from './m-world-ball.mjs';
import {GESTURE_DURATIONS,PAW_CONTACT_PROGRESS} from './m-world-acting.mjs';
import {actorRect} from './m-world-spatial.mjs';
import {gestureReady} from './m-world-action-policy.mjs';

const source=readFileSync(new URL('./scroll-buddy.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
function actual(name,next){
 const from=source.indexOf('function '+name+'('),end=source.indexOf(next.startsWith('playStop.')?'\n '+next:'\n function '+next+'(',from);
 assert.ok(from>=0&&end>from,'Actual '+name+' implementation must be exercised');
 return new Script('('+source.slice(from,end).trim()+')',{filename:'scroll-buddy.js:'+name});
}
function fixture(){
 const calls={queued:[],stopped:[],affects:[]};
 const world={viewport:{width:900,height:700,headerBottom:60},protectedRects:[],surfaces:[]};
 const context=createContext({
  planBallFlight,sampleBallFlight,GESTURE_DURATIONS,PAW_CONTACT_PROGRESS,actorRect,gestureReady,bound:(n,min,max)=>Math.max(min,Math.min(max,n)),
  metrics:{size:100,footprint:{left:0,top:0,right:100,bottom:100,width:100,height:100}},worldSnapshot:()=>world,
  performance:{now:()=>1000},avatar:{getInteractionPoint:()=>({x:50,y:50})},reducedMotion:false,active:true,
  document:{activeElement:null,hidden:false,getSelection:()=>({isCollapsed:true})},
  state:{x:100,y:100,vx:0,vy:0,phase:'hold',clock:1,depth:1,depthTarget:1,affect:null,emotion:'happy',emotionUntil:Infinity,gesture:{name:'paw',gameId:7,side:1,age:0}},
  game:{id:7,name:'ball',autonomous:true,autonomyId:'auto-ball',side:1,score:0,started:0,contacted:false,rallyStarted:false},
  pendingGesture:null,lastAutonomousGame:null,nextChoice:0,route:{gameId:7},
  playDock:{hidden:true},playLight:{hidden:true},playBall:{hidden:true,style:{}},playNote:{},
  clearScene:reason=>calls.stopped.push(reason),queueIntent:intent=>{calls.queued.push(intent);return true;},
  setCharacterAffect:(name,options)=>calls.affects.push({name,options}),
  AFFECT_DURATIONS:{},lastMemoryAt:1000,interest:{scrollUntil:0,readingUntil:0},scenes:{snapshot:()=>({})},
  overlap:(a,b,p=0)=>a.left<b.right+p&&a.right>b.left-p&&a.top<b.bottom+p&&a.bottom>b.top-p
 });
 for(const [name,next]of [['stopPlay','beginCharacterScene'],['queueBallPaw','renderBall'],['renderBall','playStop.addEventListener('],['updateCharacter','currentSection']])context[name]=actual(name,next).runInContext(context);
 return {context,world,calls,actor:{left:100,top:100}};
}

test('the ball waits at the actual projected paw and acceptance never scores a tap',()=>{
 const f=fixture();f.context.renderBall(f.world,f.actor);
 assert.equal(f.context.game.score,0);assert.equal(f.context.game.contacted,false);
 assert.equal(f.context.playBall.hidden,false);
 assert.deepEqual(JSON.parse(JSON.stringify(f.context.game.ballPoint)),{x:150,y:150});
});

test('a rendered paw contact starts one safe flight and scores exactly once',()=>{
 const f=fixture();f.context.state.gesture.age=GESTURE_DURATIONS.paw*PAW_CONTACT_PROGRESS;
 f.context.renderBall(f.world,f.actor);const flight=f.context.game.flight;
 assert.equal(f.context.game.score,1);assert.equal(f.context.game.contacted,true);
 assert.deepEqual(JSON.parse(JSON.stringify(flight.origin)),{x:150,y:150});
 f.context.state.gesture.age+=.2;f.context.renderBall(f.world,f.actor);f.context.renderBall(f.world,f.actor);
 assert.equal(f.context.game.score,1);assert.equal(f.context.game.flight,flight);
 assert.ok(f.context.game.ballPoint.y<150);
});

test('no room for a protected flight cancels without manufacturing contact or success',()=>{
 const f=fixture(),game=f.context.game;f.world.protectedRects=[{left:0,top:60,right:900,bottom:700}];
 f.context.state.gesture.age=GESTURE_DURATIONS.paw*.5;f.context.renderBall(f.world,f.actor);
 assert.equal(game.score,0);assert.equal(f.context.game,null);assert.equal(f.context.playBall.hidden,true);
 assert.equal(f.context.lastAutonomousGame.reason,'ball-court-unavailable');assert.equal(f.context.state.gesture,null);
});

test('a new text region during a flight interrupts the game instead of covering it',()=>{
 const f=fixture();f.context.state.gesture.age=GESTURE_DURATIONS.paw*.6;f.context.renderBall(f.world,f.actor);
 const p=f.context.game.ballPoint;f.world.protectedRects=[{left:p.x-5,right:p.x+5,top:p.y-5,bottom:p.y+5}];
 f.context.renderBall(f.world,f.actor);
 assert.equal(f.context.game,null);assert.equal(f.context.playBall.hidden,true);
 assert.equal(f.context.lastAutonomousGame.reason,'ball-space-changed');
});

test('a missing paw, reduced motion and a different owner cannot display a floating prop',()=>{
 for(const mode of ['missing','reduced','owner']){
  const f=fixture();if(mode==='missing')f.context.avatar.getInteractionPoint=()=>null;
  if(mode==='reduced')f.context.reducedMotion=true;if(mode==='owner')f.context.state.gesture.gameId=100;
  f.context.renderBall(f.world,f.actor);assert.equal(f.context.playBall.hidden,true,mode);
  assert.equal(f.context.game?.score||0,0,mode);
 }
});

test('the next bat preserves its paw side and the same single autonomous owner',()=>{
 const f=fixture();assert.equal(f.context.queueBallPaw(),true);
 const intent=f.calls.queued[0];assert.equal(intent.name,'paw');assert.equal(intent.side,1);
 assert.equal(intent.gameId,7);assert.equal(intent.autonomyId,'auto-ball');assert.equal(intent.source,'life');
});

test('three contacts only complete after the final paw has recovered',()=>{
 const f=fixture();f.context.game.score=3;f.context.game.rallyStarted=true;f.context.game.contacted=true;
 f.context.updateCharacter(.016,1000,f.world);assert.notEqual(f.context.game,null);
 f.context.state.gesture=null;f.context.updateCharacter(.016,1000,f.world);
 assert.equal(f.context.game,null);assert.equal(f.context.lastAutonomousGame.reason,'complete');
 assert.equal(f.calls.affects[0].name,'proud');
});

test('safe inter-rally reuse keeps the ball visible and blends smoothly to the next paw',()=>{
 const f=fixture();f.context.state.gesture.age=GESTURE_DURATIONS.paw*.99;f.context.renderBall(f.world,f.actor);
 const held=JSON.parse(JSON.stringify(f.context.game.ballPoint));f.context.state.gesture=null;
 assert.equal(f.context.queueBallPaw(),true);assert.equal(f.calls.queued[0].reuseStage,true);
 f.context.pendingGesture=f.calls.queued[0];f.context.renderBall(f.world,f.actor);
 assert.equal(f.context.playBall.hidden,false);assert.deepEqual(JSON.parse(JSON.stringify(f.context.game.ballPoint)),held);
 f.context.pendingGesture=null;f.context.avatar.getInteractionPoint=()=>({x:75,y:65});
 f.context.state.gesture={gameId:7,name:'paw',age:0};f.context.renderBall(f.world,f.actor);
 assert.deepEqual(JSON.parse(JSON.stringify(f.context.game.ballPoint)),held,'New anticipation cannot teleport the prop');
 f.context.state.gesture.age=GESTURE_DURATIONS.paw*PAW_CONTACT_PROGRESS;f.context.renderBall(f.world,f.actor);
 assert.deepEqual(JSON.parse(JSON.stringify(f.context.game.ballPoint)),{x:175,y:165});assert.equal(f.context.game.score,2);
});

test('inter-rally reuse requires a still and text-clear physical stage',()=>{
 for(const mode of ['moving','covered']){
  const f=fixture();f.context.game.rallyStarted=f.context.game.contacted=true;f.context.state.gesture=null;
  if(mode==='moving')f.context.state.vx=10;else f.world.protectedRects=[{left:100,right:200,top:100,bottom:200}];
  assert.equal(f.context.queueBallPaw(),false,mode);assert.equal(f.calls.queued.length,0,mode);
 }
});

test('stopping clears only the matching game gesture, queue, prop and route',()=>{
 const f=fixture();f.context.pendingGesture={gameId:7};f.context.stopPlay('typing');
 assert.equal(f.context.game,null);assert.equal(f.context.state.gesture,null);assert.equal(f.context.pendingGesture,null);
 assert.equal(f.context.route,null);assert.equal(f.context.playBall.hidden,true);assert.equal(f.context.lastAutonomousGame.reason,'typing');
 assert.equal(f.context.state.emotion,'neutral');assert.equal(f.context.state.emotionUntil,1600);
 const other=fixture();other.context.state.gesture.gameId=8;other.context.pendingGesture={gameId:8};other.context.route={gameId:8};
 other.context.stopPlay('manual');assert.equal(other.context.state.gesture.gameId,8);assert.equal(other.context.pendingGesture.gameId,8);assert.equal(other.context.route.gameId,8);
});
