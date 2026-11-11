import test from 'node:test';
import assert from 'node:assert/strict';
import {configureActorOcclusion,configureCardOcclusion,ACTOR_CARD_STENCIL} from './m-world-actor-occlusion.mjs';

const three={NotEqualStencilFunc:517,AlwaysStencilFunc:519,KeepStencilOp:7680,ReplaceStencilOp:7681};
const tree=nodes=>({traverse:visit=>nodes.forEach(visit)});

test('one card stencil rejects every actor material, including transparent accessories and lines',()=>{
 const skin={depthTest:true,depthWrite:true},canopy={transparent:true,opacity:.94,depthTest:true,depthWrite:true},ribs={transparent:true,depthWrite:false},metal={depthTest:true};
 const count=configureActorOcclusion(tree([{material:skin},{material:[canopy,metal]},{material:ribs},{material:metal},{}]),three);
 assert.equal(count,4);
 for(const material of [skin,canopy,ribs,metal]){
  assert.equal(material.stencilWrite,true);assert.equal(material.stencilWriteMask,0);
  assert.equal(material.stencilRef,ACTOR_CARD_STENCIL);assert.equal(material.stencilFunc,three.NotEqualStencilFunc);
  for(const key of ['stencilFail','stencilZFail','stencilZPass'])assert.equal(material[key],three.KeepStencilOp);
 }
 assert.equal(canopy.opacity,.94);assert.equal(canopy.transparent,true);assert.equal(canopy.depthWrite,true);
 assert.equal(ribs.depthWrite,false);assert.equal(skin.depthTest,true);
});

test('cards write the shared membership independently of subsequent physical actor depth',()=>{
 const mask=configureCardOcclusion({colorWrite:false,depthWrite:true,depthTest:true},three);
 assert.equal(mask.stencilRef,1);assert.equal(mask.stencilWriteMask,255);
 assert.equal(mask.stencilFunc,three.AlwaysStencilFunc);
 for(const key of ['stencilFail','stencilZFail','stencilZPass'])assert.equal(mask[key],three.ReplaceStencilOp);
 assert.deepEqual([mask.colorWrite,mask.depthWrite,mask.depthTest],[false,true,true]);
 const actor={};configureActorOcclusion(tree([{material:actor}]),three);
 // The same read-only stencil rule applies even when the canopy's physical
 // Z is in front of the card, unlike a body-only depth slab.
 for(const membership of [0,ACTOR_CARD_STENCIL])for(const physicalZ of [-100,0,100]){
  const accepted=membership!==actor.stencilRef;
  assert.equal(accepted,membership===0,'screen membership owns all depths '+physicalZ);
 }
});

test('configuration preserves geometry, original transforms, PBR maps, morphs and shared material identity',()=>{
 const map={},geometry={},quaternion={},influences=[.25,.75],material={map,roughness:.4,opacity:1};
 const node={material,geometry,quaternion,morphTargetInfluences:influences};
 configureActorOcclusion(tree([node]),three);const once={...material};
 configureActorOcclusion(tree([node]),three);
 assert.deepEqual(material,once);assert.equal(node.material,material);assert.equal(material.map,map);
 assert.equal(node.geometry,geometry);assert.equal(node.quaternion,quaternion);assert.equal(node.morphTargetInfluences,influences);
 assert.deepEqual(influences,[.25,.75]);
});

test('unsupported stencil disables only this state; the spatial planner receives the unsupported capability separately',()=>{
 const material={depthTest:true,depthWrite:true};configureActorOcclusion(tree([{material}]),three,{enabled:false});
 assert.equal(material.stencilWrite,false);assert.equal(material.depthTest,true);assert.equal(material.depthWrite,true);
 const mask=configureCardOcclusion({colorWrite:false},three,{enabled:false});assert.equal(mask.stencilWrite,false);
});
