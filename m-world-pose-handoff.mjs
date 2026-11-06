/**
 * M World V41 — seamless handoff for reversible additive V6 bone layers
 * and bounded stage channels. A critically damped, analytic spring preserves
 * BOTH the previous pose and its angular velocity when intent changes.
 *
 * The autonomous director still owns intent, the spatial planner owns real
 * position/depth/contact, and authored gestures own their exact timings.
 * This is render-only: no scene graph mutation, network, storage or AI calls.
 */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value)));
const ZERO=[0,0,0];
const OMEGA_HALF_LIFE=1.67834699001666;
/** Continuous position and velocity for a fixed target over a finite step. */
export function dampChannel(position,velocity,target,dt,halfLife=.12){
 const step=clamp(dt,0,.06),t=clamp(target,-2,2),p=clamp(position,-2,2),v=clamp(velocity,-20,20);
 if(step===0)return {position:p,velocity:v};
 const omega=OMEGA_HALF_LIFE/clamp(halfLife,.025,1.5);
 const delta=p-t,carry=v+omega*delta,decay=Math.exp(-omega*step);
 return {
  position:clamp(t+(delta+carry*step)*decay,-2,2),
  velocity:clamp((v-omega*carry*step)*decay,-20,20)
 };
}
/**
 * Each original bone keeps the exact pose/velocity it had before a layer is
 * suppressed. Missing targets fade towards zero rather than snapping at the
 * next action. When reduced motion is requested, bypass the transition.
 */
export function createPoseHandoff({halfLife=.12,epsilon=.000035,limit=2}={}){
 const tracks=new Map();
 let frames=0,transitions=0,priorKeys='';
 const bound=clamp(limit,.01,2);
 function reset(){tracks.clear();priorKeys='';}
 function safePose(pose={}){
  const out={};
  for(const [name,angles]of Object.entries(pose||{})){
   if(typeof name!=='string'||!Array.isArray(angles)||angles.length!==3)continue;
   out[name]=angles.map(value=>clamp(value,-bound,bound));
  }
  return out;
 }
 function sample(pose={},dt=0,{immediate=false}={}){
  const targets=safePose(pose);
  if(immediate){reset();return targets;}
  const step=clamp(dt,0,.06),signature=Object.keys(targets).sort().join('|');
  if(signature!==priorKeys){if(frames)transitions++;priorKeys=signature;}
  const output={};
  const names=new Set([...tracks.keys(),...Object.keys(targets)]);
  for(const name of names){
   const desired=targets[name]||ZERO;
   const previous=tracks.get(name)||{position:[0,0,0],velocity:[0,0,0]};
   const position=[],velocity=[];
   for(let axis=0;axis<3;axis++){
    const next=dampChannel(previous.position[axis],previous.velocity[axis],desired[axis],step,halfLife);
    position.push(clamp(next.position,-bound,bound));velocity.push(next.velocity);
   }
   const alive=position.some((value,i)=>Math.abs(value)>epsilon||Math.abs(velocity[i])>epsilon);
   if(alive){tracks.set(name,{position,velocity});output[name]=position;}
   else tracks.delete(name);
  }
  frames++;
  return output;
 }
 function snapshot(){
  return {channels:tracks.size,frames,transitions,
   movingChannels:[...tracks.values()].filter(track=>track.velocity.some(v=>Math.abs(v)>.0005)).length};
 }
 return {sample,reset,snapshot};
}
