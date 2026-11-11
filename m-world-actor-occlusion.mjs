/** Screen-space card membership belongs to the WHOLE actor, not its Z extent.
 * Original meshes and every attached mesh/line share this read-only stencil
 * test. Their internal depth buffer, transparency and physical transforms stay
 * intact. No texture, shader, rig, geometry or screen-position exception.
 */
export const ACTOR_CARD_STENCIL=1;

export function configureActorOcclusion(root,three,{enabled=true}={}){
 const materials=new Set();
 root.traverse(object=>{
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(material&&typeof material==='object')materials.add(material);
  }
 });
 for(const material of materials){
  material.stencilWrite=Boolean(enabled);
  // Three enables stencil testing through stencilWrite. A zero write mask
  // keeps the actor read-only, so later transparent canopy/ribs cannot erase
  // the card stencil produced before the entire original character.
  material.stencilWriteMask=0;
  material.stencilRef=ACTOR_CARD_STENCIL;
  material.stencilFuncMask=0xff;
  material.stencilFunc=three.NotEqualStencilFunc;
  material.stencilFail=three.KeepStencilOp;
  material.stencilZFail=three.KeepStencilOp;
  material.stencilZPass=three.KeepStencilOp;
 }
 return materials.size;
}

export function configureCardOcclusion(material,three,{enabled=true}={}){
 material.stencilWrite=Boolean(enabled);
 material.stencilWriteMask=0xff;
 material.stencilRef=ACTOR_CARD_STENCIL;
 material.stencilFuncMask=0xff;
 material.stencilFunc=three.AlwaysStencilFunc;
 material.stencilFail=three.ReplaceStencilOp;
 material.stencilZFail=three.ReplaceStencilOp;
 material.stencilZPass=three.ReplaceStencilOp;
 return material;
}
