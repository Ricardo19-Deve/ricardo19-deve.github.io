/** A bounded accessory probe of the ORIGINAL posed head/ears, not a collider
 * or a replacement skin. Select tips once using all original weight sets;
 * each frame evaluates at most nine existing vertices with full skinning.
 */
export function createHeadClearanceSampler(meshes,THREE,canonicalName=name=>name){
 const groups=new Map(['Head','Ear.L','Ear.R'].map(name=>[name,[]]));
 const point=new THREE.Vector3(),inverse=new THREE.Matrix4();
 for(const mesh of meshes){
  const sets=mesh.userData?.fullSkinSets||[],bones=mesh.skeleton?.bones||[];
  if(!sets.length||!mesh.geometry?.attributes.position)continue;
  const names=bones.map(bone=>canonicalName(bone.name).replace(/^EarTip\./u,'Ear.'));
  for(let index=0;index<mesh.geometry.attributes.position.count;index++){
   let weight=0,dominant=null,largest=0;
   for(const {indices,weights}of sets)for(let channel=0;channel<4;channel++){
    const offset=index*4+channel,name=names[indices.array[offset]],value=weights.array[offset];
    if(groups.has(name)){weight+=value;if(value>largest){largest=value;dominant=name;}}
   }
   if(weight<.5||!dominant)continue;
   mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld);
   const group=groups.get(dominant);
   if(group.length===3&&point.y<=group[2].y)continue;
   group.push({mesh,index,y:point.y});group.sort((a,b)=>b.y-a.y);group.length=Math.min(group.length,3);
  }
 }
 const samples=[...groups.values()].flat();
 return {
  count:samples.length,
  sample(container){
   if(!samples.length)return null;
   inverse.copy(container.matrixWorld).invert();let top=-Infinity;
   for(const {mesh,index}of samples){
    mesh.getVertexPosition(index,point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
    top=Math.max(top,point.y);
   }
   return Number.isFinite(top)?top:null;
  }
 };
}
