import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visualDepthMasks,visualDepthSide} from './m-world-occlusion.mjs';

const sampleCard={left:55,top:60,width:440,height:520,radius:26};
const textBlocks=[
 {left:75,top:140,width:310,height:65,radius:0},
 {left:75,top:220,width:320,height:118,radius:0},
 {left:75,top:370,width:280,height:80,radius:0}
];

test('V30 intermediate depth fractions always put ALL of M on one side of the card plane',()=>{
 for(const depth of [-1,-.75,-.5,-.1,-.02,-.0001]){
  assert.equal(visualDepthSide(depth),-1,'Entire rig must stay behind the card for depth '+depth);
  const masks=visualDepthMasks({depth,surfaces:[sampleCard],protectedRects:textBlocks});
  assert.deepEqual(masks,{surfaces:[sampleCard],protectedRects:[]});
 }
 for(const depth of [0,.0001,.02,.1,.5,.75,1]){
  assert.equal(visualDepthSide(depth),1,'Entire rig must stay in front for depth '+depth);
  const masks=visualDepthMasks({depth,surfaces:[sampleCard],protectedRects:textBlocks});
  assert.deepEqual(masks,{surfaces:[],protectedRects:[]});
 }
});

test('V30 text boxes cannot produce rectangular silhouette cutouts in front or behind',()=>{
 for(const depth of [-1,-.05,0,.05,1]){
  const masks=visualDepthMasks({depth,surfaces:[sampleCard],protectedRects:textBlocks});
  assert.equal(masks.protectedRects.length,0,'Text is a route safety constraint, never a depth-buffer mesh');
  assert.equal(masks.surfaces.length,depth<0?1:0);
 }
 assert.equal(visualDepthMasks({depth:-1,surfaces:[sampleCard]}).surfaces[0].radius,26,'Rounded card silhouette stays intact');
});

test('V30 invalid depth values fail safe to a complete foreground layer',()=>{
 for(const depth of [undefined,null,NaN,Infinity,-Infinity,'behind']){
  assert.equal(visualDepthSide(depth),1);
 }
 assert.deepEqual(visualDepthMasks({depth:NaN,surfaces:[sampleCard],protectedRects:textBlocks}),
  {surfaces:[],protectedRects:[]});
});

test('V30 masked 3D has full rig separation for intermediate depth, no partial anatomical cross-section',()=>{
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(renderer,/import \{visualDepthMasks,visualDepthSide\} from '.\/m-world-occlusion.mjs\?v=51'/);
 assert.match(renderer,/const visualSide=visualDepthSide\(depth\)/);
 assert.match(renderer,/depthLayerPlacement\(visualSide,halfDepth\)/);
 assert.doesNotMatch(renderer,/const placement=depthLayerPlacement\(depth,halfDepth\)/);
 assert.match(renderer,/updateBatch\(surfaceBatch,masks.surfaces/);
 assert.match(renderer,/updateBatch\(protectedBatch,masks.protectedRects/);
 assert.match(renderer,/preserveFullSkinning/,'Original 31-bone rig stays loaded');
});

test('V30 protects text through the unchanged navigator, not visible mask rectangles',()=>{
 const spatial=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(spatial,/protectedRects:world.protectedRects/);
 assert.match(spatial,/planCardAction/);
 assert.match(spatial,/resolveDepth/);
 assert.match(spatial,/m-world-3d.mjs\?v=51/);
 const index=readFileSync(new URL('index.html',import.meta.url),'utf8');
 assert.match(index,/scroll-buddy.js\?v=51/);
});
