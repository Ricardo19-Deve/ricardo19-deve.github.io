import test from 'node:test';
import assert from 'node:assert/strict';
import {planBallFlight,sampleBallFlight} from './m-world-ball.mjs';

const INPUT={origin:{x:200,y:200},viewport:{width:640,height:480,headerBottom:64}};
const plan=extra=>planBallFlight({...INPUT,...extra});
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

test('the preferred full arc keeps a copied paw point and radius-aware clearance',()=>{
 const result=plan();
 assert.deepEqual(result,{origin:{x:200,y:200},side:1,spread:42,height:32,radius:8,
  bounds:{left:188,right:254,top:156,bottom:212}});
 assert.notEqual(result.origin,INPUT.origin);
 assert.equal(plan({side:-1}).side,-1);
});

test('blocked text or viewport on the preferred side selects the full opposite arc',()=>{
 const text={left:225,top:150,right:260,bottom:220};
 const result=plan({protectedRects:[text]});
 assert.equal(result.side,-1);assert.equal(result.spread,42);
 assert.equal(intersects(result.bounds,text),false);
 const edge=plan({origin:{x:620,y:200}});
 assert.equal(edge.side,-1);assert.equal(edge.spread,42);assert.ok(edge.bounds.right<=640);
});

test('narrow corridors shrink the toss instead of crossing text on either side',()=>{
 const masks=[{left:0,right:153,top:80,bottom:300},{left:247,right:640,top:80,bottom:300}];
 const medium=plan({protectedRects:masks});
 assert.equal(medium.spread,32);assert.equal(medium.height,24);
 const small=plan({protectedRects:[{left:0,right:162,top:80,bottom:300},{left:238,right:640,top:80,bottom:300}]});
 assert.equal(small.spread,22);assert.equal(small.height,16);
});

test('the sticky header forces a smaller lift, never a crossing',()=>{
 const medium=plan({origin:{x:200,y:104}});
 assert.equal(medium.height,24);assert.ok(medium.bounds.top>=64);
 const small=plan({origin:{x:200,y:94}});
 assert.equal(small.height,16);assert.ok(small.bounds.top>=64);
 assert.equal(plan({origin:{x:200,y:90}}),null);
});

test('no safe room, protected origin or oversized ball fails closed',()=>{
 assert.equal(plan({viewport:{width:30,height:90,headerBottom:64}}),null);
 assert.equal(plan({protectedRects:[{left:195,right:205,top:195,bottom:205}]}),null);
 assert.equal(plan({origin:{x:200,y:474}}),null);
 assert.equal(plan({radius:400}),null);
 assert.equal(plan({viewport:{width:640,height:480,headerBottom:500}}),null);
});

test('edge and x/y/size rectangles protect the same region without mutating inputs',()=>{
 const origin=Object.freeze({x:200,y:200}),viewport=Object.freeze(INPUT.viewport);
 const protectedRects=Object.freeze([Object.freeze({x:225,y:150,width:35,height:70})]);
 const input=Object.freeze({origin,viewport,protectedRects});
 assert.deepEqual(planBallFlight(input),plan({protectedRects:[{left:225,top:150,right:260,bottom:220}]}));
 assert.equal(protectedRects[0].x,225);assert.deepEqual(origin,{x:200,y:200});
});

test('invalid geometry and unknown protected regions do not create an unsafe path',()=>{
 for(const input of[null,{}, {...INPUT,origin:{x:NaN,y:200}}, {...INPUT,origin:{x:'200',y:200}},
  {...INPUT,viewport:{width:Infinity,height:480}}, {...INPUT,viewport:{width:640,height:480,headerBottom:NaN}},
  {...INPUT,radius:NaN}, {...INPUT,radius:0}, {...INPUT,radius:-8}, {...INPUT,protectedRects:null},
  {...INPUT,protectedRects:[null]}, {...INPUT,protectedRects:[{left:200,top:100,right:NaN,bottom:300}]},
 ])assert.equal(planBallFlight(input),null);
});

test('thousands of samples keep the whole ball and clearance inside safe planned bounds',()=>{
 const cases=[plan(),plan({side:-1}),plan({origin:{x:370,y:250},viewport:{width:390,height:844,headerBottom:76}}),
  plan({origin:{x:25,y:94},viewport:{width:320,height:640,headerBottom:64},side:-1}),plan({radius:12})];
 for(const result of cases){
  assert.ok(result);
  for(let i=0;i<=5000;i++){
   const sample=sampleBallFlight(result,i/5000),r=result.radius+4;
   assert.ok([sample.x,sample.y,sample.rotation].every(Number.isFinite));
   assert.ok(sample.x-r>=result.bounds.left-1e-9&&sample.x+r<=result.bounds.right+1e-9);
   assert.ok(sample.y-r>=result.bounds.top-1e-9&&sample.y+r<=result.bounds.bottom+1e-9);
   assert.ok(sample.y<=result.origin.y+1e-9);
  }
 }
});

test('a complete toss departs from and returns exactly to the real paw coordinate',()=>{
 const result=plan(),start=sampleBallFlight(result,0),middle=sampleBallFlight(result,.5),end=sampleBallFlight(result,1);
 assert.equal(start.x,result.origin.x);assert.equal(start.y,result.origin.y);assert.equal(start.complete,false);
 assert.equal(middle.x,result.origin.x+result.spread);assert.ok(middle.y<result.origin.y);
 assert.equal(end.x,result.origin.x);assert.equal(end.y,result.origin.y);assert.equal(end.complete,true);
 assert.equal(end.rotation,2*Math.PI);
 assert.equal(sampleBallFlight(plan({side:-1}),1).rotation,-2*Math.PI);
});

test('quintic timing makes endpoint velocities approach zero without an artificial hold',()=>{
 const result=plan(),h=.0001;
 const a=sampleBallFlight(result,0),b=sampleBallFlight(result,h),c=sampleBallFlight(result,1-h),d=sampleBallFlight(result,1);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)/h<.001);
 assert.ok(Math.hypot(d.x-c.x,d.y-c.y)/h<.001);
 assert.ok(Math.abs(b.rotation-a.rotation)/h<.001);
 assert.ok(Math.abs(d.rotation-c.rotation)/h<.001);
 assert.ok(Math.hypot(b.x-a.x,b.y-a.y)>0,'The ball begins moving smoothly rather than waiting at an arbitrary threshold.');
});

test('the lift is deliberately asymmetric rather than a circular or time-mirrored orbit',()=>{
 const result=plan(),departure=sampleBallFlight(result,.25),returning=sampleBallFlight(result,.75);
 assert.ok(Math.abs(departure.x-returning.x)<1e-9);
 assert.ok(departure.y<returning.y-1,'The departure lift and return dip differ at matching horizontal positions.');
});

test('progress is clamped and non-finite inputs cannot contaminate the renderer',()=>{
 const result=plan();
 assert.deepEqual(sampleBallFlight(result,-1),sampleBallFlight(result,0));
 assert.deepEqual(sampleBallFlight(result,2),sampleBallFlight(result,1));
 for(const value of[NaN,Infinity,-Infinity,'0.5',null])assert.deepEqual(sampleBallFlight(result,value),sampleBallFlight(result,0));
 for(const value of[null,{}, {...result,spread:NaN}, {...result,side:0}, {...result,bounds:{}}])assert.equal(sampleBallFlight(value,.5),null);
});
