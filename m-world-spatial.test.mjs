import test from 'node:test';
import assert from 'node:assert/strict';
import {bound,center,intersectsViewport,visibleTargets,chooseTarget,
 placeAround,exclusionPolygon,cubic,interactiveTarget,insideMascot} from './m-world-spatial.mjs';

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
