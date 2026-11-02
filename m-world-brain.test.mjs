import test from 'node:test';
import assert from 'node:assert/strict';
import {MWorldBrain} from './m-world-brain.mjs';

const rect=(id,left=200,top=200,width=220,height=140,extra={})=>
 ({id,left,top,right:left+width,bottom:top+height,width,height,...extra});
const frame=(nowMs=0,actor={x:300,y:280},viewport={width:1000,height:800})=>({nowMs,actor,viewport});

test('the same seed and stable rectangles produce stable, order-independent choices',()=>{
 const candidates=Object.freeze([Object.freeze(rect('a',120)),Object.freeze(rect('b',500))]);
 const a=new MWorldBrain({seed:42}),b=new MWorldBrain({seed:42});
 const choice=a.chooseTarget(candidates,frame());
 assert.equal(b.chooseTarget([...candidates].reverse(),frame()),choice);
 assert.equal(a.chooseTarget(candidates,frame()),choice);
 assert.deepEqual(candidates[0],rect('a',120));
 assert.equal(a.snapshot().recentTargets.length,0,'a proposal is not a successful visit');
});

test('distance and visible space outweigh tiny seeded variation',()=>{
 for(const seed of [1,12,18421,999999]){
  const brain=new MWorldBrain({seed});
  assert.equal(brain.chooseTarget([rect('far',700,600),rect('near',190,200)],frame()),'near');
  assert.equal(brain.chooseTarget([rect('clipped',950,200),rect('visible',300,200)],frame()),'visible');
  assert.equal(brain.chooseTarget([rect('covered',190,200,220,140,{protectedCoverage:.9}),rect('clear',500,200)],frame()),'clear');
 }
});

test('protected coverage lowers available space even below the exclusion threshold',()=>{
 const brain=new MWorldBrain();
 assert.equal(brain.chooseTarget([rect('text-heavy',190,200,220,140,{protectedCoverage:.7}),rect('open',240,200)],frame()),'open');
});

test('successful visits enforce a real cooldown and prevent immediate repetition',()=>{
 const brain=new MWorldBrain(),candidates=[rect('a'),rect('b',500)];
 const first=brain.chooseTarget(candidates,frame());
 brain.noteVisit(first,0);
 const second=brain.chooseTarget(candidates,frame(1000));
 assert.notEqual(second,first);
 brain.noteVisit(second,1000);
 assert.equal(brain.chooseTarget(candidates,frame(2000)),null);
 assert.equal(brain.snapshot().reason,'visit-cooldown');
 assert.equal(brain.chooseTarget(candidates,frame(23999)),null);
 assert.equal(brain.chooseTarget(candidates,frame(24000)),first);
 assert.equal(brain.snapshot().reason,'revisit-after-cooldown');
});

test('unvisited places retain a novelty preference after a previous cooldown ends',()=>{
 const brain=new MWorldBrain();
 const candidates=[rect('familiar',190,200),rect('new',230,200)];
 brain.noteVisit('familiar',0);
 assert.equal(brain.chooseTarget(candidates,frame(30000)),'new');
});

test('memory is session-local, bounded, deduplicated and defensive',()=>{
 const brain=new MWorldBrain();
 brain.observe({nowMs:0,section:'work'});
 for(let i=0;i<30;i++)brain.noteVisit(`card-${i}`,i*1000);
 let snapshot=brain.snapshot();
 assert.equal(snapshot.recentTargets.length,24);
 assert.equal(snapshot.recentTargets[0].id,'card-6');
 assert.equal(snapshot.recentTargets.at(-1).section,'work');
 brain.noteVisit('card-29',31000);
 snapshot=brain.snapshot();
 assert.equal(snapshot.recentTargets.length,24);
 assert.equal(snapshot.recentTargets.at(-1).count,2);
 snapshot.recentTargets[0].id='changed';snapshot.recentTargets.push({id:'external'});
 snapshot.context.active=false;
 assert.equal(brain.snapshot().recentTargets[0].id,'card-6');
 assert.equal(brain.snapshot().context.active,true);
 assert.equal(new MWorldBrain().snapshot().recentTargets.length,0);
});

test('reading and engagement suppress new intents and leave a settling interval',()=>{
 for(const [flag,delay] of [['reading',6500],['engaged',4000]]){
  const brain=new MWorldBrain();
  brain.noteVisit('completed',0);
  brain.observe({nowMs:1000,[flag]:true});
  assert.equal(brain.chooseTarget([rect('a')],frame(2000)),null);
  assert.equal(brain.snapshot().reason,flag);
  brain.observe({nowMs:2000});
  assert.equal(brain.chooseTarget([rect('a')],frame(1000+delay-1)),null);
  assert.equal(brain.snapshot().reason,'settling');
  assert.equal(brain.chooseTarget([rect('a')],frame(1000+delay)),'a');
  assert.equal(brain.snapshot().recentTargets[0].id,'completed','quieting does not discard completed route memory');
 }
});

test('scrolling and section changes settle without endlessly extending a stable section',()=>{
 const brain=new MWorldBrain();
 brain.observe({nowMs:0,section:'hero',scrolling:true});
 assert.equal(brain.chooseTarget([rect('a')],frame(500)),null);
 brain.observe({nowMs:500,section:'hero'});
 assert.equal(brain.chooseTarget([rect('a')],frame(1399)),null);
 assert.equal(brain.chooseTarget([rect('a')],frame(1400)),'a');
 brain.observe({nowMs:2000,section:'work'});
 brain.observe({nowMs:2500,section:'work'});
 assert.equal(brain.snapshot().quietUntil,3100);
 assert.equal(brain.chooseTarget([rect('a')],frame(3100)),'a');
});

test('reduced motion, inactive and hidden states block spontaneous intents',()=>{
 for(const context of [{reducedMotion:true},{active:false},{hidden:true}]){
  const brain=new MWorldBrain();
  brain.observe({nowMs:1000,...context});
  assert.equal(brain.snapshot().spontaneousAllowed,false);
  assert.equal(brain.chooseTarget([rect('a')],frame(100000)),null);
  brain.observe({nowMs:100000});
  assert.equal(brain.chooseTarget([rect('a')],frame(100000)),'a');
 }
});

test('immediate resume honours the existing settling deadline',()=>{
 const brain=new MWorldBrain();
 brain.observe({nowMs:1000,reducedMotion:true});
 brain.observe({nowMs:1100});
 assert.equal(brain.chooseTarget([rect('a')],frame(2499)),null);
 assert.equal(brain.chooseTarget([rect('a')],frame(2500)),'a');
});

test('degenerate candidates never become targets or generate invalid scores',()=>{
 const brain=new MWorldBrain();
 const invalid=[null,{},rect('',200),rect('nan',NaN),rect('zero',200,200,0),
  rect('tiny',200,200,10,10),rect('offscreen',2000),rect('infinite',200,Infinity),
  rect('reversed',200,200,220,140,{right:100}),rect('bad-coverage',200,200,220,140,{protectedCoverage:NaN})];
 assert.equal(brain.chooseTarget(invalid,frame()),null);
 assert.equal(brain.snapshot().reason,'no-visible-candidate');
 assert.equal(brain.chooseTarget([...invalid,rect('valid')],frame()),'valid');
 assert.equal(brain.chooseTarget([rect(0)],frame()),0,'a finite numeric id is valid');
 assert.equal(brain.chooseTarget(null,frame()),null);
 assert.equal(brain.chooseTarget([rect('a')],frame(0,{}, {width:0,height:800})),null);
 assert.equal(brain.snapshot().reason,'invalid-viewport');
});

test('clock regressions and invalid visits cannot bypass attention or cooldown',()=>{
 const brain=new MWorldBrain();
 assert.equal(brain.noteVisit(null,0),false);
 assert.equal(brain.noteVisit('',0),false);
 brain.noteVisit('a',10000);
 assert.equal(brain.chooseTarget([rect('a')],frame(-10000)),null);
 assert.equal(brain.snapshot().nowMs,10000);
 assert.equal(brain.chooseTarget([rect('a')],frame(NaN)),null);
 assert.equal(brain.chooseTarget([rect('a')],frame(34000)),'a');
});
