/** V28 reversible facial crossfade over the original V6 happy/curious/surprised
 * and HAT eyelid channels. Only blends existing morphs; no new mesh or texture. */
const channels=Object.freeze(['happy','curious','surprised']);
const sides=Object.freeze(['left','right']);
const finite=value=>Number.isFinite(value)?value:0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value)));
export function createFacialContinuity(){
 const weights={happy:0,curious:0,surprised:0},eyelids={left:0,right:0};
 function reset(){for(const key of channels)weights[key]=0;for(const key of sides)eyelids[key]=0;}
 function sample({dt=0,weights:targetWeights=null,eyelids:targetLids=null,reducedMotion=false,gestureActive=false}={}){
  // Explicit gestures and accessibility are authoritative; never retain
  // half-closed eyelids across sleep, a requested gesture or reduced motion.
  if(reducedMotion||gestureActive){reset();return null;}
  const t=clamp(dt,0,.06);
  const target={happy:clamp(targetWeights?.happy,0,1),curious:clamp(targetWeights?.curious,0,1),surprised:clamp(targetWeights?.surprised,0,1)};
  const lids={left:clamp(targetLids?.left,0,.5),right:clamp(targetLids?.right,0,.5)};
  for(const key of channels){
   const halfLife=target[key]>weights[key]?.07:.11;
   weights[key]+= (target[key]-weights[key])*(1-Math.pow(.5,t/halfLife));
   if(Math.abs(weights[key])<.0001&&target[key]===0)weights[key]=0;
  }
  // Different attack/release rates can oversubscribe a crossfade even when
  // both endpoints are normalized. Keep the final original-morph budget valid.
  const sum=weights.happy+weights.curious+weights.surprised;
  if(sum>1)for(const key of channels)weights[key]/=sum;
  for(const key of sides){
   const halfLife=lids[key]>eyelids[key]?.08:.12;
   eyelids[key]+= (lids[key]-eyelids[key])*(1-Math.pow(.5,t/halfLife));
   if(Math.abs(eyelids[key])<.0001&&lids[key]===0)eyelids[key]=0;
  }
  if([...Object.values(weights),...Object.values(eyelids)].every(v=>v===0))return null;
  return {weights:{...weights},eyelids:{...eyelids}};
 }
 return {sample,reset,snapshot:()=>({weights:{...weights},eyelids:{...eyelids}})};
}
