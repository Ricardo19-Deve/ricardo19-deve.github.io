/**
 * V29: distinguish reading protection (spatial/navigation constraint) from
 * actual visible occlusion (the geometry of a card).
 * Behind a card, text-sized boxes MUST NOT cut square holes into M.
 * The card's rounded shape handles depth; while in front, protected text may
 * still mask an unsafe animation frame as a final legibility safeguard.
 */
export function visualDepthMasks({depth=1,surfaces=[],protectedRects=[]}={}){
 const d=Number.isFinite(depth)?depth:1;
 return {
  surfaces:Array.isArray(surfaces)?surfaces:[],
  protectedRects:d<0?[]:Array.isArray(protectedRects)?protectedRects:[]
 };
}
