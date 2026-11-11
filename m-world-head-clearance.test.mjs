import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeadClearanceSampler} from './m-world-head-clearance.mjs';

class Vector3{set(x,y,z){Object.assign(this,{x,y,z});return this;}applyMatrix4(matrix){this.y+=matrix.y||0;return this;}}
class Matrix4{copy(matrix){this.y=matrix.y||0;return this;}invert(){this.y=-this.y;return this;}}
const THREE={Vector3,Matrix4};
function mesh(){
 const count=24,sets=Array.from({length:4},()=>({indices:{array:new Uint16Array(count*4)},weights:{array:new Float32Array(count*4)}}));
 for(let i=0;i<count;i++){sets[3].indices.array[i*4]=i%3+1;sets[3].weights.array[i*4]=1;}
 return {userData:{fullSkinSets:sets},skeleton:{bones:['Tail.10','Head','Ear.L','Ear.R'].map(name=>({name}))},
  geometry:{attributes:{position:{count}}},matrixWorld:{y:4},offset:0,
  getVertexPosition(index,target){return target.set(0,index+this.offset,0);}};
}
test('head accessory clearance reads the fourth original skin set and selects only nine original tips',()=>{
 const original=mesh(),probe=createHeadClearanceSampler([original],THREE);
 assert.equal(probe.count,9);assert.equal(probe.sample({matrixWorld:{y:2}}),25);
 original.offset=3;assert.equal(probe.sample({matrixWorld:{y:2}}),28,'evaluates the actual posed vertices again');
 assert.equal(original.userData.fullSkinSets.length,4);
});
test('tail vertices cannot set the head roof and missing samples have a conservative caller fallback',()=>{
 const original=mesh();original.userData.fullSkinSets[3].indices.array[23*4]=0;
 const probe=createHeadClearanceSampler([original],THREE);
 assert.equal(probe.sample({matrixWorld:{y:0}}),26);
 const empty=createHeadClearanceSampler([],THREE);assert.equal(empty.count,0);assert.equal(empty.sample({}),null);
});
test('the actual ear-tip bones contribute to the bounded left and right ear probes',()=>{
 const original=mesh();original.skeleton.bones.push({name:'EarTip.L'},{name:'EarTip.R'});
 original.userData.fullSkinSets[3].indices.array[23*4]=5;
 const probe=createHeadClearanceSampler([original],THREE);
 assert.equal(probe.count,9);assert.equal(probe.sample({matrixWorld:{y:0}}),27);
});
