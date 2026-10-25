import * as THREE from 'three';

// r184's stock shader and CPU SkinnedMesh path use four influences only.
// Preserve every original influence in a reversible, runtime-only adapter.
export function preserveFullSkinning(gltf,raw) {
  const meshes=[];let maxUsed=0,maxSumError=0,affectedVertices=0;
  gltf.scene.traverse(mesh=>{
    if(!mesh.isSkinnedMesh) return;
    const assoc=gltf.parser.associations.get(mesh);
    if(!assoc||assoc.meshes===undefined) throw new Error('Missing glTF primitive association.');
    const primitive=raw.json.meshes[assoc.meshes].primitives[assoc.primitives??0];
    const sets=[];
    for(let set=0;primitive.attributes['JOINTS_'+set]!==undefined;set++){
      const j=raw.accessor(primitive.attributes['JOINTS_'+set]),w=raw.accessor(primitive.attributes['WEIGHTS_'+set]);
      const indices=new THREE.BufferAttribute(new Uint16Array(j.array),4);
      const weights=new THREE.BufferAttribute(w.array,4);
      const suffix=set===0?'':String(set);
      mesh.geometry.setAttribute('skinIndex'+suffix,indices);
      mesh.geometry.setAttribute('skinWeight'+suffix,weights);
      sets.push({indices,weights});
    }
    for(let i=0;i<sets[0].weights.count;i++){
      let sum=0,used=0,extra=0;
      for(let s=0;s<sets.length;s++) for(let c=0;c<4;c++){
        const w=sets[s].weights.array[i*4+c];sum+=w;if(w>1e-7)used++;if(s>0)extra+=w;
      }
      maxUsed=Math.max(maxUsed,used);maxSumError=Math.max(maxSumError,Math.abs(sum-1));if(extra>1e-7)affectedVertices++;
    }
    mesh.userData.fullSkinSets=sets;
    mesh.applyBoneTransform=function(index,target){return skinPoint(this,index,target,sets.length);};
    mesh.frustumCulled=false; // The complete animated envelope is framed separately.
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const material of materials){
      material.onBeforeCompile=shader=>{
        let declarations='',boneExtra='',positionExtra='',normalExtra='';
        for(let s=1;s<sets.length;s++){
          declarations+=`attribute vec4 skinIndex${s};\nattribute vec4 skinWeight${s};\n`;
          for(let c=0;c<4;c++){
            const channel='xyzw'[c],id=`mBone_${s}_${c}`;
            boneExtra+=`mat4 ${id}=getBoneMatrix(skinIndex${s}.${channel});\n`;
            positionExtra+=`skinned += ${id} * skinVertex * skinWeight${s}.${channel};\n`;
            normalExtra+=`skinMatrix += skinWeight${s}.${channel} * ${id};\n`;
          }
        }
        const base=THREE.ShaderChunk.skinbase_vertex+`\n#ifdef USE_SKINNING\n${boneExtra}#endif\n`;
        const skin=THREE.ShaderChunk.skinning_vertex.replace('transformed = ( bindMatrixInverse',positionExtra+'transformed = ( bindMatrixInverse');
        const normal=THREE.ShaderChunk.skinnormal_vertex.replace('skinMatrix = bindMatrixInverse',normalExtra+'skinMatrix = bindMatrixInverse');
        shader.vertexShader='#ifdef USE_SKINNING\n'+declarations+'#endif\n'+shader.vertexShader
          .replace('#include <skinbase_vertex>',base).replace('#include <skinning_vertex>',skin).replace('#include <skinnormal_vertex>',normal);
      };
      material.customProgramCacheKey=()=>`m-original-skin-r184-${sets.length}`;
      material.needsUpdate=true;
    }
    meshes.push(mesh);
  });
  return {meshes,maxUsed,maxSumError,affectedVertices,sets:Math.max(...meshes.map(m=>m.userData.fullSkinSets.length))};
}

const base=new THREE.Vector3(),term=new THREE.Vector3(),matrix=new THREE.Matrix4();
export function skinPoint(mesh,index,target,setCount=Infinity,normalizeFirstSet=false){
  const sets=mesh.userData.fullSkinSets;
  base.copy(target).applyMatrix4(mesh.bindMatrix);target.set(0,0,0);
  let denom=1;
  if(normalizeFirstSet){denom=0;for(let c=0;c<4;c++)denom+=sets[0].weights.array[index*4+c];denom=denom||1;}
  for(let s=0;s<Math.min(setCount,sets.length);s++)for(let c=0;c<4;c++){
    const weight=sets[s].weights.array[index*4+c]/denom;if(weight===0)continue;
    const j=sets[s].indices.array[index*4+c];
    matrix.multiplyMatrices(mesh.skeleton.bones[j].matrixWorld,mesh.skeleton.boneInverses[j]);
    term.copy(base).applyMatrix4(matrix);target.addScaledVector(term,weight);
  }
  return target.applyMatrix4(mesh.bindMatrixInverse);
}