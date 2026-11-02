/** Pure screen-space steering. Spatial clearance and depth stay with the caller. */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value)));
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const limited=(x,y,max)=>{const length=Math.hypot(x,y),scale=length>max?max/length:1;return [x*scale,y*scale];};

/**
 * Returns a new state; never mutates the route, target or caller state.
 * x/y are pixels; velocity and acceleration use seconds. Small substeps make
 * 30/60/120 Hz follow the same curve while limiting BOTH speed and steering.
 * The caller still clamps the result against its authoritative geometry.
 * Persist heading/turn/travel/leanX/leanY with x/y/vx/vy for continuous anticipation.
 */
export function advanceLocomotion(state={},target={},dt=0,{maxSpeed=150,maxAcceleration=340,arrivalRadius=72}={}){
 const speedLimit=clamp(maxSpeed,1,1000),accelerationLimit=clamp(maxAcceleration,1,4000),radius=clamp(arrivalRadius,8,600);
 const elapsed=clamp(dt,0,.1),result={x:finite(state.x),y:finite(state.y),vx:finite(state.vx),vy:finite(state.vy),ax:0,ay:0,
  heading:finite(state.heading,Math.atan2(finite(state.vy),finite(state.vx))),turn:clamp(state.turn,-1,1),travel:clamp(state.travel,0,1),leanX:clamp(state.leanX,-1,1),leanY:clamp(state.leanY,-1,1)};
 if(!elapsed||!Number.isFinite(target.x)||!Number.isFinite(target.y))return result;
 [result.vx,result.vy]=limited(result.vx,result.vy,speedLimit);
 const initialVelocity={x:result.vx,y:result.vy},steps=Math.ceil(elapsed*240),h=elapsed/steps;
 // Critical damping in the arrival region, without a discontinuous stop gate.
 const response=radius/(4*speedLimit);
 for(let i=0;i<steps;i++){
  const dx=target.x-result.x,dy=target.y-result.y,distance=Math.hypot(dx,dy);
  const desiredSpeed=speedLimit*Math.min(1,distance/radius);
  const desiredX=distance?dx/distance*desiredSpeed:0,desiredY=distance?dy/distance*desiredSpeed:0;
  const [ax,ay]=limited((desiredX-result.vx)/response,(desiredY-result.vy)/response,accelerationLimit);
  const previousX=result.vx,previousY=result.vy;
  [result.vx,result.vy]=limited(previousX+ax*h,previousY+ay*h,speedLimit);
  result.x+=(previousX+result.vx)*h*.5;result.y+=(previousY+result.vy)*h*.5;
  const speed=Math.hypot(result.vx,result.vy),heading=speed>.5?Math.atan2(result.vy,result.vx):result.heading;
  const targetHeading=distance>.05?Math.atan2(dy,dx):heading;
  const desiredTurn=clamp(angleDifference(targetHeading,heading)/(Math.PI*.5),-1,1)*Math.min(1,distance/24);
  // Gaze and ears lead the turn; the chest and tail use smaller opposite arcs.
  result.turn+=(desiredTurn-result.turn)*(1-Math.exp(-8*h));
  result.travel+=(Math.min(1,speed/speedLimit)-result.travel)*(1-Math.exp(-6*h));
  result.leanX+=(ax/accelerationLimit-result.leanX)*(1-Math.exp(-8*h));
  result.leanY+=(ay/accelerationLimit-result.leanY)*(1-Math.exp(-8*h));
  result.heading=heading;
 }
 result.ax=(result.vx-initialVelocity.x)/elapsed;result.ay=(result.vy-initialVelocity.y)/elapsed;
 return result;
}

/** Compact original-rig offsets. Apply through a reversible quaternion layer. */
export function sampleLocomotionPose(state={}, {reducedMotion=false}={}){
 if(reducedMotion)return {};
 const turn=clamp(state.turn,-1,1),travel=clamp(state.travel,0,1);
 const pushX=clamp(finite(state.leanX,finite(state.ax)/340),-1,1),pushY=clamp(finite(state.leanY,finite(state.ay)/340),-1,1);
 if(Math.abs(turn)+travel+Math.abs(pushX)+Math.abs(pushY)<1e-8)return {};
 const pose={
  Head:[-.025*pushY,.085*turn,-.045*pushX+.045*turn],
  Neck:[-.014*pushY,.025*turn,-.020*pushX],
  Chest:[.020*pushY,-.022*turn,-.030*pushX],
  Body:[.012*pushY,-.014*turn,-.020*pushX],
  'Ear.L':[-.025*travel-.020*turn,0,.024*turn],
  'Ear.R':[-.025*travel+.020*turn,0,.024*turn],
  'EarTip.L':[-.012*travel,0,-.012*turn],
  'EarTip.R':[-.012*travel,0,-.012*turn]
 };
 for(let i=1;i<=10;i++){
  const follow=(i-1)/9;
  pose['Tail.'+String(i).padStart(2,'0')]=[.004*pushY*(1-follow),-.003*turn,-(.012+.009*follow)*turn+.001*pushX];
 }
 return pose;
}
