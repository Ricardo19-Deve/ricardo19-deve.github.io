import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpontaneousPlay,SPONTANEOUS_BEATS} from './m-world-spontaneous-play.mjs';

const next=(engine,opts={})=>engine.sample({dt:1/60,mode:'peek',
  phase:'hold',energy:.87,speed:0,attention:{x:.4,y:-.2},turn:.12,...opts});
function run({seed=22,mode='peek',seconds=650}={}){
 const engine=createSpontaneousPlay({seed});
 const kinds=[],samples=[];let last=null;
 for(let i=0;i<seconds*60;i++){
  const f=next(engine,{mode});
  if(f.active&&f.kind!==last){kinds.push(f.kind);last=f.kind;}
  if(!f.active)last=null;
  if(f.active&&f.envelope>.65)samples.push(f);
 }
 return {kinds,samples,snapshot:engine.snapshot()};
}

test('V51 adds four expressive natural gestures to the seven original V50 mini-games',()=>{
 assert.deepEqual(SPONTANEOUS_BEATS,[
  'double-take','peekaboo','tail-chase','little-dance','stretch','stargaze',
  'ear-flick','self-hug','little-bow','curious-scan','victory-wiggle']);
 const seen=new Set();
 for(const mode of ['float','peek','play','unknown']){
  const {kinds}=run({mode,seconds:760});
  for(const kind of kinds)seen.add(kind);
  for(let i=1;i<kinds.length;i++)assert.notEqual(kinds[i],kinds[i-1]);
 }
 assert.deepEqual([...seen].sort(),[...SPONTANEOUS_BEATS].sort());
});

test('V51 real attention is smoothed, bounded and reflected in face orientation',()=>{
 const a=createSpontaneousPlay({seed:76});
 for(let i=0;i<60*27;i++)next(a,{attention:{x:-.8,y:.4}});
 const before=a.snapshot();
 next(a,{attention:{x:1,y:-1},turn:-1});
 const after=a.snapshot();
 assert.ok(Math.abs(after.attention.x-before.attention.x)<.16);
 assert.ok(Math.abs(after.attention.y-before.attention.y)<.16);
 assert.ok(Math.abs(after.turn-before.turn)<.09);
 assert.ok(after.attention.x>=-1&&after.attention.x<=1);
 assert.ok(after.attention.y>=-1&&after.attention.y<=1);
 const b=createSpontaneousPlay({seed:76});
 let changed=false;
 for(let i=0;i<60*35;i++){
  const left=next(a,{attention:{x:-1,y:1},turn:-1});
  const right=next(b,{attention:{x:1,y:-1},turn:1});
  if(left.active&&right.active&&Math.abs(left.pose.Head[1]-right.pose.Head[1])>.008)changed=true;
 }
 assert.ok(changed,'the face turns differently for different actual attention');
});

test('V51 performance details vary by session seed, without switching rig or routes',()=>{
 const frames=[];
 for(const seed of [2,3,4]){
  const engine=createSpontaneousPlay({seed});
  for(let i=0;i<60*25;i++){
   const result=next(engine);
   if(result.active&&result.envelope>.5){frames.push({kind:result.kind,side:engine.snapshot().side,style:engine.snapshot().style});break;}
  }
 }
 assert.equal(frames.length,3);
 assert.ok(new Set(frames.map(x=>x.kind+':'+x.side+':'+x.style)).size>=2);
 assert.ok(frames.every(x=>x.side===-1||x.side===1));
 assert.ok(frames.every(x=>x.style>=.86&&x.style<=1.12));
 const repeat=()=>run({seed:51,seconds:130}).kinds;
 assert.deepEqual(repeat(),repeat());
});

test('V51 all eleven performers remain in bounds on original bones and ten-joint tail',()=>{
 const samples=['float','peek','play','unknown'].flatMap(mode=>run({mode,seconds:720}).samples);
 assert.ok(samples.length>100);
 const styles=new Set();
 for(const out of samples){
  styles.add(out.kind);
  assert.equal(Object.keys(out.pose).filter(k=>/^Tail\.\d{2}$/.test(k)).length,10);
  assert.ok(out.pose.Head.every(x=>Number.isFinite(x)&&Math.abs(x)<.25));
  assert.ok(out.pose.Chest.every(x=>Number.isFinite(x)&&Math.abs(x)<.2));
  for(const k of ['Arm.L','Arm.R','Ear.L','Ear.R']){
   assert.ok(out.pose[k].every(x=>Number.isFinite(x)&&Math.abs(x)<.2));
  }
  assert.ok(Object.values(out.stage).every(x=>Number.isFinite(x)&&Math.abs(x)<.045));
  assert.ok(Object.values(out.face.weights).every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  assert.ok(Object.values(out.face.eyelids).every(x=>Number.isFinite(x)&&x>=0&&x<=.5));
  assert.ok(!Object.hasOwn(out.stage,'x'));
 }
 assert.equal(styles.size,SPONTANEOUS_BEATS.length);
});

test('V51 never plays while sleeping, card-attached, reading, gesturing or reduced motion',()=>{
 const blocked=[{gesture:{name:'sleep'}},{gesture:{name:'wave'}},{attached:true},
  {reading:true},{reducedMotion:true},{phase:'approach'}, {speed:150},
  {mode:'perch'},{mode:'rest'},{affectActive:true},{energy:.1}];
 for(const opts of blocked){
  const engine=createSpontaneousPlay({seed:5});
  for(let i=0;i<60*40;i++){
   const out=next(engine,opts);
   assert.equal(out.active,false,JSON.stringify(opts));
   assert.equal(out.face,null);
  }
  assert.equal(engine.snapshot().started,0);
 }
});

test('V51 natural reaction inputs never access LinkedIn or personal visitor information',()=>{
 const src=readFileSync(new URL('m-world-spontaneous-play.mjs',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(renderer,/attention:dynamics\.attention,turn:state\.locomotion\?\.turn\|\|0/);
 assert.match(renderer,/handoffs\.play\.sample/);
 assert.doesNotMatch(src,/\bfetch\s*\(|localStorage|sessionStorage|LINKEDIN_DMA_|document\.|window\.|navigator\./i);
});
