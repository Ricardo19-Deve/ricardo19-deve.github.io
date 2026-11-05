/**
 * V32 — embodied resting on the original V6 Three.js stage.
 *
 * The authored V6 sleep gesture bends the legs, folds the arms and closes the
 * eyelids. This companion *stage* motion lets the full original 31-bone rig
 * deliberately lie on its side instead of merely closing its eyes upright.
 * It is an additive render-only pose, not a new mesh, rig, sprite or asset.
 * All channels return to their neutral positions with zero slope.
 */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const ease=x=>{const v=clamp(x);return v*v*(3-2*v);};
const ramp=(p,start,end)=>ease((p-start)/(end-start));
const hold=(p,on,flat,release,done)=>ramp(p,on,flat)*(1-ramp(p,release,done));
export const REST_TILT_RADIANS=1.18;
export const REST_MIN_SCALE=.78;
/** age and duration are in seconds; side is the direction M chooses to curl. */
export function sampleEmbodiedRest({name=null,age=0,duration=12.4,side=1,reducedMotion=false}={}){
 const neutral={resting:false,phase:'awake',weight:0,rotationZ:0,rotationX:0,
  positionX:0,positionY:0,scale:1,breath:0};
 if(name!=='sleep'||reducedMotion||!Number.isFinite(age)||!Number.isFinite(duration)||duration<=0)return neutral;
 const p=clamp(age/duration),sign=side===-1?-1:1;
 const weight=hold(p,.045,.31,.78,.985);
 const falling=ramp(p,.035,.32),waking=ramp(p,.78,.99);
 const breath=weight*Math.sin((p-.3)*Math.PI*10)*.0045;
 return {
  resting:weight>0,
  phase:p<.05?'preparing':p<.32?'lying-down':p<.78?'sleeping':p<.995?'waking':'awake',
  weight,
  // about 68° to one side, against a compact floor-height rest pose.
  rotationZ:sign*REST_TILT_RADIANS*weight,
  rotationX:.035*falling*(1-waking),
  positionX:sign*.018*weight,
  positionY:-.05*weight+breath,
  // Fitting within the precomputed V6 animated safety envelope; intentionally
  // smaller than the standard stage while the entire body is horizontal.
  scale:1-(1-REST_MIN_SCALE)*weight+breath*.35,
  breath
 };
}
