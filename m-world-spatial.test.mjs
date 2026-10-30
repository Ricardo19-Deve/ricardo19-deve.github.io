import test from 'node:test';
import assert from 'node:assert/strict';
import {bound,center,intersectsViewport,visibleTargets,chooseTarget,
 placeAround,exclusionPolygon,cubic,interactiveTarget,insideMascot,cardPerformance,activeOccluder} from './m-world-spatial.mjs';

const rect={left:200,top:220,right:470,bottom:480,width:270,height:260};
test('visible card and viewport clipping reject offscreen geometry',()=>{
 assert.equal(intersectsViewport(rect,900,650),true);
 assert.equal(intersectsViewport({...rect,left:1000,right:1200},900,650),false);
 const element={getBoundingClientRect:()=>rect,closest:()=>null};
 const found=visibleTargets([element],900,650);
 assert.equal(found.length,1);
 assert.deepEqual(center(rect),{x:335,y:350});
});
test('M can peek from either side of a card without leaving viewport',()=>{
 const left=placeAround(rect,900,650,'peek',-1),right=placeAround(rect,900,650,'peek',1);
 assert.ok(left.x<rect.left);
 assert.ok(right.x>rect.right-100);
 for(const point of [left,right]){
  assert.ok(point.x>=0&&point.x<=780);
  assert.ok(point.y>=48&&point.y<=522);
 }
});
test('perch, orbit and glide positions are different and safe on mobile',()=>{
 for(const [w,h] of [[390,700],[820,600],[1400,900]]){
  for(const style of ['perch','orbit','glide']){
   const pos=placeAround(rect,w,h,style,1);
   assert.ok(pos.x>=0&&pos.x<=Math.max(3,w-123));
   assert.ok(pos.y>=48&&pos.y<=Math.max(48,h-128));
  }
 }
});
test('masked card occlusion uses a real evenodd cutout covering rect',()=>{
 const mask=exclusionPolygon(rect,900,650,1);
 assert.ok(mask.startsWith('polygon(evenodd,'));
 assert.ok(mask.includes('199px 219px'));
 assert.ok(mask.includes('471px 481px'));
 assert.equal(exclusionPolygon({...rect,width:1,right:201},900,650),'');
});
test('waypoint selection prefers visible candidates and stays deterministic',()=>{
 const a={el:{id:'a'},rect},b={el:{id:'b'},rect:{...rect,left:550,right:780}};
 const chosen=chooseTarget([a,b],{x:340,y:300},900,650,()=>0);
 assert.equal(chosen.el.id,'a');
 assert.equal(chooseTarget([],{x:0,y:0},900,650),null);
});
test('smooth cubic path keeps endpoints and curved midpoint',()=>{
 const a={x:0,y:0},b={x:150,y:0},c={x:150,y:200},d={x:300,y:200};
 assert.deepEqual(cubic(a,b,c,d,0),a);
 assert.deepEqual(cubic(a,b,c,d,1),d);
 const p=cubic(a,b,c,d,.5);
 assert.ok(p.x>0&&p.x<300&&p.y>0&&p.y<200);
});
test('click zones cannot intercept buttons and links',()=>{
 const target={closest:selector=>selector.includes('button')?{tagName:'BUTTON'}:null};
 assert.equal(interactiveTarget(target),true);
 assert.equal(interactiveTarget({closest:()=>null}),false);
 assert.equal(insideMascot(60,60,0,0),true);
 assert.equal(insideMascot(220,220,0,0),false);
});
test('helper safely clamps invalid inputs',()=>{
 assert.equal(bound(NaN,0,1),0);
 assert.equal(bound(2,0,1),1);
});

test('peeking begins mostly hidden then reveals M beyond a real card edge',()=>{
 const first=cardPerformance(rect,900,650,'peek',1,0);
 const middle=cardPerformance(rect,900,650,'peek',1,.55);
 const final=cardPerformance(rect,900,650,'peek',1,1);
 assert.equal(first.behind,true);
 assert.equal(final.behind,false);
 assert.ok(first.x<final.x-55,JSON.stringify({first,middle,final}));
 assert.ok(final.x>rect.right-35);
 assert.equal(activeOccluder(rect,{x:first.x,y:first.y,size:120},true),true);
 assert.equal(activeOccluder(rect,{x:first.x,y:first.y,size:120},false),false);
});
test('perch crosses the upper edge but never lands over card text',()=>{
 const early=cardPerformance(rect,900,650,'perch',-1,0);
 const late=cardPerformance(rect,900,650,'perch',-1,1);
 assert.ok(late.y<rect.top-65,JSON.stringify({early,late}));
 assert.equal(late.behind,false);
 assert.ok(Math.abs(early.x-late.x)>8);
});
test('orbit travels across the card rather than oscillating at one border',()=>{
 const start=cardPerformance(rect,900,650,'orbit',-1,0);
 const top=cardPerformance(rect,900,650,'orbit',-1,.58);
 const end=cardPerformance(rect,900,650,'orbit',-1,1);
 assert.ok(start.x<rect.left);
 assert.ok(top.x>rect.left+70&&top.x<rect.right-100);
 assert.ok(end.x>rect.right-100);
 assert.equal(start.behind,false);
 assert.equal(end.behind,true);
 assert.ok(top.y<rect.top-60);
});
test('all spatial choreography stays within mobile and desktop bounds',()=>{
 for(const [w,h] of [[390,700],[1280,820]]){
  for(const kind of ['peek','perch','orbit']){
   for(const side of [-1,1]){
    for(let i=0;i<=20;i++){
     const p=cardPerformance(rect,w,h,kind,side,i/20);
     assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
     assert.ok(p.x>=3&&p.x<=Math.max(3,w-123));
     assert.ok(p.y>=48&&p.y<=Math.max(48,h-128));
    }
   }
  }
 }
});
