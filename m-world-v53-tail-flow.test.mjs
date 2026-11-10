import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpontaneousPlay} from './m-world-spontaneous-play.mjs';

function run(engine,options={}) {
 return engine.sample({
  dt:1/60,mode:'float',phase:'hold',energy:.9,speed:0,
  attention:{x:.8,y:-.3},turn:.65,...options
 });
}
test('V53 tail momentum follows page attention without snapping at a direction reversal',()=>{
 const m=createSpontaneousPlay({seed:31});
 let active=null;
 for(let i=0;i<60*18;i++){
  const current=run(m);
  if(current.active&&current.progress>.3&&current.progress<.75){active=current;break;}
 }
 assert.ok(active,'a naturally chosen miniature started');
 const previous=m.snapshot().tailMomentum;
 assert.equal(previous.length,10);
 assert.ok(previous.some(x=>Math.abs(x)>.001),'real joint inertia developed');
 const changed=run(m,{attention:{x:-1,y:1},turn:-1});
 const after=m.snapshot().tailMomentum;
 assert.equal(after.length,10);
 assert.ok(after.every(v=>Number.isFinite(v)&&Math.abs(v)<=.045));
 assert.ok(Math.max(...after.map((v,i)=>Math.abs(v-previous[i])))<.008,
  'no instantaneous tail reset after attention reverses');
 assert.ok(changed.pose['Tail.10'].length===3);
});

test('V53 last tail segments react with a progressively delayed but bounded curve',()=>{
 const m=createSpontaneousPlay({seed:123});
 let active=null;
 for(let i=0;i<60*28;i++){
  const frame=run(m,{attention:{x:1,y:-.5},turn:.7});
  if(frame.active&&frame.envelope>.75){active=frame;break;}
 }
 assert.ok(active,'the character should have started a miniature');
 const state=m.snapshot().tailMomentum;
 assert.equal(state.length,10);
 assert.ok(new Set(state.map(x=>x.toFixed(5))).size>=5,'joints react differently');
 assert.ok(active.pose['Tail.10'][2]!==active.pose['Tail.01'][2]);
 assert.ok(state.every(x=>Math.abs(x)<=.045));
});

test('V53 explicit gestures and rest silence new play while V41 owns displayed transition',()=>{
 const m=createSpontaneousPlay({seed:74});
 let seen=false;
 for(let i=0;i<60*24;i++){
  const frame=run(m);
  if(frame.active&&frame.envelope>.6){seen=true;break;}
 }
 assert.ok(seen);
 const cancelled=run(m,{gesture:{name:'sleep'},mode:'rest'});
 assert.equal(cancelled.active,false);
 assert.deepEqual(cancelled.pose,{});
 assert.equal(cancelled.face,null);
 for(let i=0;i<60*3;i++)run(m,{gesture:{name:'sleep'},mode:'rest'});
 assert.ok(m.snapshot().tailMomentum.every(v=>Math.abs(v)<.005));
 const reduced=run(m,{reducedMotion:true});
 assert.deepEqual(reduced.pose,{});
 assert.deepEqual(m.snapshot().tailMomentum,Array(10).fill(0));
});

test('V53 each miniature still returns exactly to the original neutral bones on completion',()=>{
 const m=createSpontaneousPlay({seed:17});
 let finished=null;
 for(let i=0;i<60*45;i++){
  const out=run(m);
  if(out.active&&out.progress===1){finished=out;break;}
 }
 assert.ok(finished);
 assert.equal(finished.envelope,0);
 for(const vector of Object.values(finished.pose))assert.ok(vector.every(x=>Math.abs(x)<1e-7));
 for(const value of Object.values(finished.stage))assert.ok(Math.abs(value)<1e-7);
});

test('V53 tail movement is local original-rig math, not an extra browser/LinkedIn tracker',()=>{
 const src=readFileSync(new URL('m-world-spontaneous-play.mjs',import.meta.url),'utf8');
 assert.match(src,/tailMomentum=Array\.from\(\{length:10\}/);
 assert.match(src,/followTail\(step/);
 assert.doesNotMatch(src,/\bfetch\s*\(|localStorage|sessionStorage|window\.|document\.|LINKEDIN_DMA_|OPENAI_API_KEY/);
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(renderer,/secondaryTargets\[5\]\.pose=lastPlay\.pose/);
 assert.match(renderer,/secondaryPose\.sample\(\{dt,layers:secondaryTargets,reducedMotion:reduced\}\)/);
 assert.match(renderer,/secondaryLayer\.apply\(combinedSecondary\)/);
 assert.match(renderer,/tailPhase:dynamics\.tailPhase,tailMood:dynamics\.tailMood/);
});
