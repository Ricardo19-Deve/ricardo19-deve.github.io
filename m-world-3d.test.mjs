import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const base=new URL('./',import.meta.url);
const modelParts=Array.from({length:19},(_,i)=>new URL('assets/m-v6-web/part-'+String(i).padStart(2,'0')+'.bin',base));
const fullModel=Buffer.concat(modelParts.map(p=>readFileSync(p)));

test('the real original Blender V6 GLB is hosted in 19 ordered binary chunks',()=>{
 assert.equal(modelParts.length,19);
 assert.equal(fullModel.byteLength,16899868);
 assert.equal(fullModel.toString('ascii',0,4),'glTF');
 assert.equal(fullModel.readUInt32LE(4),2);
 assert.equal(fullModel.readUInt32LE(8),fullModel.byteLength);
 assert.equal(statSync(modelParts[0]).size,900000);
 assert.equal(statSync(modelParts[18]).size,699868);
});
test('optimized V6 retains its real animations, skin, facial morph targets and ten tail bones',()=>{
 const jsonLength=fullModel.readUInt32LE(12);
 const data=JSON.parse(fullModel.subarray(20,20+jsonLength).toString('utf8'));
 assert.equal(data.animations.length,6);
 assert.ok(data.animations.some(a=>a.name==='M_Swim_V4'));
 assert.ok(data.animations.some(a=>a.name==='M_LeftBlink_V4'));
 assert.ok(data.animations.some(a=>a.name==='M_Expression_Happy_V1'));
 assert.equal(data.skins.length,1);
 assert.equal(data.meshes.length,11);
 assert.ok(data.meshes[0].primitives[0].targets.length>=5);
 const names=data.nodes.map(n=>n.name||'');
 for(let i=1;i<=10;i++)assert.ok(names.includes('Tail.'+String(i).padStart(2,'0')),'tail joint '+i);
});
test('V6 texture buffer views remain in bounds after web optimization',()=>{
 const len=fullModel.readUInt32LE(12),start=20+len;
 const binLength=fullModel.readUInt32LE(start);
 const j=JSON.parse(fullModel.subarray(20,20+len).toString('utf8'));
 assert.equal(j.images.length,19);
 assert.equal(j.buffers[0].byteLength,binLength);
 for(const view of j.bufferViews)
  assert.ok((view.byteOffset||0)+view.byteLength<=binLength);
 for(const image of j.images)
  assert.ok(['image/png','image/jpeg'].includes(image.mimeType));
});
test('main portfolio mounts the original V6 through the spatial renderer API',()=>{
 const main=readFileSync(new URL('scroll-buddy.js',base),'utf8');
 const three=readFileSync(new URL('m-world-3d.mjs',base),'utf8');
 const css=readFileSync(new URL('m-world.css',base),'utf8');
 assert.ok(main.includes('mountMWorld3D'));
 assert.ok(main.includes("import('./m-world-3d.mjs?v="));
 assert.ok(main.includes('.setSpatialFrame('));
 assert.ok(main.includes('.getMetrics('));
 assert.ok(css.includes('m-world-canvas'));
 assert.match(three,/preserveFullSkinning/);
 assert.match(three,/createFacialV6/);
 assert.match(three,/createMotionV8/);
 assert.match(three,/PART_COUNT=19/);
 assert.doesNotThrow(()=>new Function(three.replace(/^import .*;$/gm,'').replace(/^export /gm,'')));
});

test('high fidelity facial and body maps are hosted from original V6 textures',()=>{
 const assets=[0,1,2,3,4,6,8,9,11,12];
 for(const id of assets){
  const ext=[3,8,11].includes(id)?'webp':[0,1,2].includes(id)?'jpg':'png';
  const file=new URL('assets/m-v6-detail/m-original-'+id+'.'+ext,base);
  const raw=readFileSync(file);
  assert.ok(raw.byteLength>12000,id+' detail map missing or corrupt');
  if(ext==='png')assert.equal(raw.subarray(1,4).toString(),'PNG');
  if(ext==='jpg')assert.equal(raw[0],0xff);
 }
 const renderer=readFileSync(new URL('m-world-3d.mjs',base),'utf8');
 assert.ok(renderer.includes('tex.flipY=false'));
 assert.ok(renderer.includes('detailMaps'));
 assert.ok(renderer.includes('renderer.setPixelRatio(pixelRatio)'));
});

const rendererSource=readFileSync(new URL('m-world-3d.mjs',base),'utf8');
const spatialMath=new Function(rendererSource.replace(/^import .*;$/gm,'').replace(/^export /gm,'')+
 ';return {normalizeActorRect,viewportPointToNDC,overlappingViewportRect,appendRoundedRectTriangles,depthLayerPlacement,fitCharacterFrame,projectedPoseBounds,localRectFromNDC};')();

test('viewport conversion uses the actual canvas actor, including negative/offscreen coordinates',()=>{
 const actor={left:100,top:50,width:272,height:272};
 assert.deepEqual(spatialMath.viewportPointToNDC(100,50,actor),{x:-1,y:1});
 assert.deepEqual(spatialMath.viewportPointToNDC(236,186,actor),{x:0,y:0});
 assert.deepEqual(spatialMath.viewportPointToNDC(372,322,actor),{x:1,y:-1});
 assert.deepEqual(spatialMath.viewportPointToNDC(-36,50,actor),{x:-2,y:1});
 assert.equal(spatialMath.normalizeActorRect({left:0,top:0,width:0,height:100}),null);
});
test('overlap retains full DOM rectangle corners instead of rounding the clipped intersection',()=>{
 const actor={left:100,top:100,width:272,height:272};
 assert.deepEqual(spatialMath.overlappingViewportRect({left:20,top:80,width:300,height:220,radius:20},actor),
  {left:20,top:80,width:300,height:220,radius:20});
 assert.equal(spatialMath.overlappingViewportRect({left:372,top:100,width:50,height:50},actor),null);
 assert.equal(spatialMath.overlappingViewportRect({left:0,top:0,width:50,height:50},actor),null);
 assert.equal(spatialMath.overlappingViewportRect({left:150,top:100,width:40,height:20,radius:99},actor).radius,10);
});
test('rounded depth batches cover card interiors with bounded convex triangle area',()=>{
 const points=spatialMath.appendRoundedRectTriangles({left:0,top:0,width:200,height:100,radius:20});
 assert.equal(points.length%6,0);
 assert.ok(points.every(Number.isFinite));
 let area=0;
 for(let i=0;i<points.length;i+=6){
  const [ax,ay,bx,by,cx,cy]=points.slice(i,i+6);
  area+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;
  for(const [x,y]of [[ax,ay],[bx,by],[cx,cy]])assert.ok(x>=0&&x<=200&&y>=0&&y<=100);
 }
 const expected=200*100-(4-Math.PI)*20*20;
 assert.ok(Math.abs(area-expected)/expected<.005);
 const square=spatialMath.appendRoundedRectTriangles({left:10,top:20,width:50,height:40,radius:0});
 assert.equal(square.length,12);
});
test('depth endpoints move the whole 3D volume to one side while text remains in front',()=>{
 for(const half of [.1,.5,1.2]){
  const front=spatialMath.depthLayerPlacement(1,half),back=spatialMath.depthLayerPlacement(-1,half);
  assert.ok(front.bodyZ-half>front.surfaceZ);
  assert.ok(back.bodyZ+half<back.surfaceZ);
  assert.ok(front.protectedZ>front.bodyZ+half);
  assert.equal(spatialMath.depthLayerPlacement(4,half).bodyZ,front.bodyZ);
  assert.equal(spatialMath.depthLayerPlacement(-4,half).bodyZ,back.bodyZ);
  assert.equal(spatialMath.depthLayerPlacement(0,half).bodyZ,0);
 }
});
test('actual animated bounds fit consistently at both canvas sizes with a real margin',()=>{
 const bounds={min:{x:-1,y:-2,z:-.5},max:{x:1,y:2,z:.5}};
 const desktop=spatialMath.fitCharacterFrame(bounds,272),mobile=spatialMath.fitCharacterFrame(bounds,208);
 assert.equal(desktop.scale,mobile.scale);
 for(const [size,result]of [[272,desktop],[208,mobile]]){
  assert.ok(result.footprint.left>0&&result.footprint.top>0);
  assert.ok(result.footprint.right<size&&result.footprint.bottom<size);
  assert.ok(Math.abs(result.footprint.height-size*.86)<1e-9);
 }
 assert.throws(()=>spatialMath.fitCharacterFrame({min:{x:1,y:1,z:0},max:{x:1,y:1,z:0}},272));
});
test('source asset keeps the original 31 joints and disabled right socket normal',()=>{
 const len=fullModel.readUInt32LE(12),data=JSON.parse(fullModel.subarray(20,20+len).toString('utf8'));
 assert.equal(data.skins[0].joints.length,31);
 assert.ok(data.meshes[0].primitives[0].attributes.JOINTS_3!==undefined);
 assert.ok(data.meshes[0].primitives[0].attributes.WEIGHTS_3!==undefined);
 const right=data.materials.find(m=>m.name.startsWith('M_R_UnifiedSkin_'));
 assert.equal(right.normalTexture.scale,0);
 assert.ok(data.nodes.some(n=>n.name==='Foot.L'));
 assert.ok(data.nodes.some(n=>n.name==='Foot.R'));
});

test('framing rotates real correlated pose points instead of impossible combined-box corners',()=>{
 const points=[2,0,0,-2,0,0,0,0,2,0,0,-2];
 const result=spatialMath.projectedPoseBounds(points,{angles:{x:[0],y:[Math.PI/4],z:[0]},scaleLimit:1,paddingRatio:0});
 assert.ok(Math.abs(result.min.x+Math.SQRT2)<1e-10);
 assert.ok(Math.abs(result.max.x-Math.SQRT2)<1e-10);
 assert.ok(Math.abs(result.max.z-Math.SQRT2)<1e-10);
 // Rotating an AABB would invent x/z corners and double the required width.
 assert.ok(result.max.x<2*Math.SQRT2-.5);
});
test('pose projection matches XYZ rotations, centering and bounded stage scale',()=>{
 const angles={x:[Math.PI/2],y:[0],z:[0]};
 const result=spatialMath.projectedPoseBounds([3,2,5],{center:{x:3,y:2,z:4},angles,scaleLimit:1.03,paddingRatio:0});
 assert.ok(Math.abs(result.min.y+1.03)<1e-10);
 assert.ok(Math.abs(result.max.x)<1e-10);
 assert.ok(Math.abs(result.max.z)<1e-10);
 assert.throws(()=>spatialMath.projectedPoseBounds([]));
 assert.throws(()=>spatialMath.projectedPoseBounds([0,0,NaN]));
});

test('neutral intro rectangle converts fixed camera bounds to local CSS pixels at both sizes',()=>{
 const bounds={minX:-.5,maxX:.5,minY:-.25,maxY:.75};
 const desktop=spatialMath.localRectFromNDC(bounds,272),mobile=spatialMath.localRectFromNDC(bounds,208);
 assert.deepEqual(desktop,{left:68,top:34,right:204,bottom:170,width:136,height:136});
 assert.deepEqual(mobile,{left:52,top:26,right:156,bottom:130,width:104,height:104});
 assert.equal(desktop.width/272,mobile.width/208);
});
