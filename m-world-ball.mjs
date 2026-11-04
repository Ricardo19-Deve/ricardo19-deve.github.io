/** A floating magical ball, not a rigid-body physics simulation. No DOM state. */
const SIZES=Object.freeze([[42,32],[32,24],[22,16]]);
const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y);
const clamp=value=>Math.min(1,Math.max(0,value));
function rectangle(value){
 if(!value||typeof value!=='object')return null;
 const left=value.left??value.x,top=value.top??value.y;
 const right=value.right??left+value.width,bottom=value.bottom??top+value.height;
 return [left,top,right,bottom].every(Number.isFinite)&&right>=left&&bottom>=top?{left,top,right,bottom}:null;
}
const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

/**
 * Viewport coordinates. bounds includes the entire arc, ball radius and 4px
 * clearance; it deliberately rejects some safe curved paths to protect text.
 * Prefer a full toss on either side before trying the two smaller variants.
 */
export function planBallFlight(options={}){
 if(!options||typeof options!=='object')return null;
 const {origin,viewport,protectedRects=[],radius=8}=options;
 if(!point(origin)||!viewport||!Number.isFinite(viewport.width)||viewport.width<=0
  ||!Number.isFinite(viewport.height)||viewport.height<=0||!Number.isFinite(radius)||radius<=0
  ||!Array.isArray(protectedRects))return null;
 const headerBottom=viewport.headerBottom??0;
 if(!Number.isFinite(headerBottom))return null;
 const masks=protectedRects.map(rectangle);
 if(masks.some(value=>!value))return null;
 const preferred=options.side<0?-1:1,padding=radius+4;
 for(const [spread,height]of SIZES)for(const side of[preferred,-preferred]){
  const end=origin.x+side*spread;
  const bounds={left:Math.min(origin.x,end)-padding,right:Math.max(origin.x,end)+padding,
   top:origin.y-height-padding,bottom:origin.y+padding};
  if(bounds.left<0||bounds.right>viewport.width||bounds.top<Math.max(0,headerBottom)||bounds.bottom>viewport.height
   ||masks.some(mask=>overlaps(bounds,mask)))continue;
  return {origin:{x:origin.x,y:origin.y},side,spread,height,radius,bounds};
 }
 return null;
}

/** Smooth departure and return to the recorded paw point, rotation in radians. */
export function sampleBallFlight(plan,progress=0){
 if(!plan||!point(plan.origin)||![plan.spread,plan.height,plan.radius].every(value=>Number.isFinite(value)&&value>0)
  ||![1,-1].includes(plan.side)||!rectangle(plan.bounds))return null;
 const t=Number.isFinite(progress)?clamp(progress):0;
 const u=clamp(t*t*t*(t*(t*6-15)+10));
 const arc=t===0||t===1?0:Math.sin(Math.PI*u);
 return {x:plan.origin.x+plan.side*plan.spread*arc,
  y:plan.origin.y-plan.height*arc*(.7+.3*Math.cos(Math.PI*u)),
  rotation:plan.side*2*Math.PI*u,progress:t,complete:t===1};
}
