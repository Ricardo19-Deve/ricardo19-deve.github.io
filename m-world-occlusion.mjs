/**
 * V30 solid-card occlusion, with no rectangular text clipping.
 *
 * The WebGL actor is drawn in one of TWO visual depth layers. Interpolating
 * its centre through the card plane causes anatomical pieces (paws / tail) to
 * poke through the DOM card, even while most of M is hidden. The camera is
 * orthographic, so snapping the Z layer at the crossing boundary does not
 * change the perceived scale or screen position. X/Y route easing remains
 * continuous and the card edge itself reveals M naturally.
 *
 * Text/control rectangles are used by the spatial planner to avoid covering
 * legible content. They are NEVER rendered as invisible rectangles into the
 * WebGL depth buffer: that produced the square text-shaped holes in M.
 */

/** The sign, not the fractional progress, owns visual card depth. */
export function visualDepthSide(depth=1){
 return Number.isFinite(depth)&&depth<0?-1:1;
}

/** Only the actual card silhouettes can occlude M, and only from behind. */
export function visualDepthMasks({depth=1,surfaces=[]}={}){
 return {
  surfaces:visualDepthSide(depth)<0&&Array.isArray(surfaces)?surfaces:[],
  protectedRects:[]
 };
}
