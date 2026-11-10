import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSurfaceContact} from './m-world-surface-contact.mjs';

const step=(contact,n=120,options={})=>{
 let state;
 for(let i=0;i<n;i++)state=contact.sample({dt:1/60,...options});
 return state;
};
const zeroStage={x:0,y:0,rx:0,ry:0,rz:0,scale:0};

test('V38 only actual attached perch contact, never nearby cards, triggers a landing',()=>{
 const contact=createSurfaceContact();
 for(const options of [
  {attached:true,mode:'float',phase:'hold'},
  {attached:true,mode:'perch',phase:'approach'},
  {attached:true,mode:'perch',phase:'reveal'},
  {attached:false,mode:'perch',phase:'hold'}
 ]){
  const frame=step(contact,20,options);
  assert.equal(frame.supported,false);
  assert.equal(frame.weight,0);
  assert.deepEqual(frame.pose,{});
  assert.deepEqual(frame.stage,zeroStage);
 }
 assert.equal(contact.snapshot().landings,0);
 const touched=contact.sample({dt:1/60,attached:true,mode:'perch',phase:'hold'});
 assert.equal(touched.supported,true);
 assert.equal(touched.mode,'landing');
 assert.ok(touched.weight>0);
 assert.equal(contact.snapshot().landings,1);
});

test('V38 real landing settles with subtle compressive body weight and genuine ten-tail follow',()=>{
 const contact=createSurfaceContact();
 const first=contact.sample({dt:1/60,attached:true,mode:'perch',phase:'hold'});
 const landed=step(contact,115,{attached:true,mode:'perch',phase:'hold'});
 assert.equal(landed.mode,'perched');
 assert.ok(landed.weight>.99);
 assert.ok(landed.pose.Body[0]>0);
 assert.ok(landed.pose['Leg.L'][0]>.02);
 assert.ok(landed.pose['Leg.R'][0]>.02);
 assert.ok(landed.pose['Foot.L'][0]<0);
 assert.ok(landed.stage.y<0);
 assert.equal(landed.stage.x,0,'route owns screen-space card contact: do not drift horizontally');
 assert.equal(Object.keys(landed.pose).filter(k=>/^Tail\.\d\d$/.test(k)).length,10);
 assert.ok(Math.abs(first.impact)<1);
 assert.equal(contact.snapshot().landings,1);
});

test('V38 release from card is physically smoothed, not frozen or teleported',()=>{
 const contact=createSurfaceContact();step(contact,120,{attached:true,mode:'perch',phase:'hold'});
 const started=contact.sample({dt:1/60,attached:false,mode:'float',phase:'approach'});
 assert.equal(started.mode,'lifting');
 assert.ok(started.weight>0&&started.weight<1);
 const ended=step(contact,140,{attached:false,mode:'float',phase:'approach'});
 assert.equal(ended.mode,'airborne');assert.equal(ended.weight,0);
 assert.deepEqual(ended.stage,zeroStage);
 assert.deepEqual(ended.pose,{});
 assert.equal(contact.snapshot().landings,1);
});

test('V38 landing is bounded over many frames and remains performance-friendly',()=>{
 const contact=createSurfaceContact();
 for(let i=0;i<2500;i++){
  const frame=contact.sample({dt:i%81===0?.05:1/60,
   attached:i%430<180,mode:i%430<180?'perch':'float',phase:'hold',reading:i%2===0});
  assert.ok(frame.weight>=0&&frame.weight<=1.000001);
  for(const value of Object.values(frame.stage))assert.ok(Number.isFinite(value));
  for(const values of Object.values(frame.pose))
   for(const a of values)assert.ok(Number.isFinite(a)&&Math.abs(a)<.1);
  assert.ok(frame.stage.x===0);
  assert.ok(frame.stage.y>=-.027&&frame.stage.y<=.011);
  assert.ok(Math.abs(frame.stage.rz)<=.009);
  assert.ok(frame.stage.scale>=-.015&&frame.stage.scale<=.004);
 }
 assert.ok(contact.snapshot().landings>=3);
});

test('V38 author gestures, sleep and reduced motion always outrank landing',()=>{
 const contact=createSurfaceContact();step(contact,60,{attached:true,mode:'perch',phase:'hold'});
 const custom=contact.sample({dt:.016,attached:true,mode:'perch',phase:'hold',gestureActive:true});
 assert.equal(custom.mode,'airborne');assert.deepEqual(custom.stage,zeroStage);
 assert.equal(contact.snapshot().attached,false);
 const reduced=contact.sample({dt:.016,attached:true,mode:'perch',phase:'hold',reducedMotion:true});
 assert.deepEqual(reduced.pose,{});
 const sleep=contact.sample({dt:.016,attached:true,mode:'sleep',phase:'hold'});
 assert.equal(sleep.supported,false);
 assert.equal(sleep.weight,0);
});

test('V38 physical contact reads geometry ownership from DOM route and never invents a landing',()=>{
 const controller=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(controller,/surfaceContact:Boolean\(route\?\.attached&&route\?\.plan\?\.kind==='perch'/);
 assert.match(controller,/route\.element\?\.isConnected/);
 assert.match(controller,/state\.depthTarget>\.95/);
 assert.match(renderer,/createSurfaceContact\(\)/);
 assert.match(renderer,/secondaryLayer=createGestureLayer\(bones,THREE\)/);
 assert.match(renderer,/secondaryLayer\.prepare\(\);gestureLayer\.prepare\(\)/);
 assert.match(renderer,/secondaryTargets\[1\]\.pose=lastContact\.pose/);
 assert.match(renderer,/lastContact=surfaceContact\.sample\(\{dt,attached:state\.surfaceContact===true/);
 assert.match(renderer,/preserveFullSkinning/);
 assert.match(renderer,/depthLayerPlacement\(visualSide,halfDepth\)/);
});

test('V38 contact is independent of visibility data, AI instructions, D1 and visitor memory',()=>{
 const src=readFileSync(new URL('m-world-surface-contact.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|localStorage|sessionStorage|OpenAI|Authorization|analytics|\bwindow\.|document\./);
 assert.ok(src.length<12000);
});
