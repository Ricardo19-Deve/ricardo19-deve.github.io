/** Render-only inertial handoff for interrupted original-rig gestures.
 * Authored frames pass through exactly until cancellation/replacement. Only
 * their visual pose, lids and lift receive a decaying residual; gesture phase,
 * contact, action ownership and completion remain with the existing owner.
 */
import {M_GESTURES,GESTURE_DURATIONS,sampleGesture} from './m-world-acting.mjs?v=66';

const bones=Object.freeze(['Body','Chest','Neck','Head',
 'Arm.L','Arm.R','Forearm.L','Forearm.R','Hand.L','Hand.R',
 'Leg.L','Leg.R','Foot.L','Foot.R','Ear.L','Ear.R','EarTip.L','EarTip.R',
 ...Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0'))]);
const boneSet=new Set(bones),gestureSet=new Set(M_GESTURES),sides=Object.freeze(['left','right']),DERIVATIVE_STEP=.0001;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const read=(frame,channel)=>channel.kind===0?(frame.pose[channel.bone]?.[channel.axis]??0)
 :channel.kind===1?(frame.blink?.[channel.side]??0):frame.lift;

function validFrame(frame){
 if(!frame||typeof frame!=='object'||!frame.pose||typeof frame.pose!=='object'
  ||!Number.isFinite(frame.lift)||frame.lift<0||frame.lift>.16
  ||!Number.isFinite(frame.duration)||frame.duration<0
  ||!Number.isFinite(frame.progress)||frame.progress<0||frame.progress>1
  ||(frame.name!==null&&!gestureSet.has(frame.name)))return false;
 if(frame.name!==null&&frame.duration!==GESTURE_DURATIONS[frame.name])return false;
 if(frame.blink!==null&&(!frame.blink||!sides.every(side=>
  Number.isFinite(frame.blink[side])&&frame.blink[side]>=0&&frame.blink[side]<=1)))return false;
 for(const name in frame.pose){
  const value=frame.pose[name];
  if(!boneSet.has(name)||!Array.isArray(value)||value.length!==3
   ||!value.every(angle=>Number.isFinite(angle)&&Math.abs(angle)<=.9))return false;
 }
 return true;
}

export function createGestureHandoff({halfLife=.12}={}){
 const omega=1.67834699001666/(Number.isFinite(halfLife)?clamp(halfLife,.06,.3):.12);
 const pose={},poseArrays={},blink={left:0,right:0},channels=[];
 for(const bone of bones){
  poseArrays[bone]=[0,0,0];
  for(let axis=0;axis<3;axis++)channels.push({kind:0,bone,axis,min:-.9,max:.9,
   value:0,velocity:0,target:0,targetVelocity:0,offset:0,offsetVelocity:0});
 }
 for(const side of sides)channels.push({kind:1,side,min:0,max:1,
  value:0,velocity:0,target:0,targetVelocity:0,offset:0,offsetVelocity:0});
 channels.push({kind:2,min:0,max:.16,value:0,velocity:0,target:0,targetVelocity:0,offset:0,offsetVelocity:0});
 const output={pose,blink:null,lift:0,transitioning:false};
 const neutral={name:null,duration:0,progress:0,pose:{},blink:null,lift:0};
 let initialized=false,previousName=null,previousProgress=0,previousSide=1,previousDuration=0,transitions=0;

 function reset(){
  for(const channel of channels)channel.value=channel.velocity=channel.target=channel.targetVelocity=channel.offset=channel.offsetVelocity=0;
  for(const bone of bones){delete pose[bone];poseArrays[bone].fill(0);}
  blink.left=blink.right=0;output.pose=pose;output.blink=null;output.lift=0;output.transitioning=false;
  initialized=false;previousName=null;previousProgress=previousDuration=transitions=0;previousSide=1;
  return output;
 }

 function sample({frame=neutral,dt=0,reducedMotion=false,side=1}={}){
  if(reducedMotion||!Number.isFinite(dt)||dt<0||!validFrame(frame))return reset();
  const step=Math.min(dt,.06),leadingSide=side<0?-1:1,name=frame.name;
  const changed=previousName!==name||(name!==null&&(previousSide!==leadingSide||frame.progress+1e-9<previousProgress));
  const naturalEnd=previousName!==null&&previousProgress+step/previousDuration>=1-1e-9;
  const retarget=initialized&&changed&&!naturalEnd&&(previousName!==null||output.transitioning);
  if(retarget){
   // Sample derivatives only on an interruption, never on every render. The
   // exact authored tangent plus any existing residual tangent survives even
   // a second replacement during the first handoff.
   const oldAge=previousProgress*previousDuration;
   const oldA=previousName?sampleGesture({name:previousName,age:oldAge-DERIVATIVE_STEP,side:previousSide}):neutral;
   const oldB=previousName?sampleGesture({name:previousName,age:oldAge+DERIVATIVE_STEP,side:previousSide}):neutral;
   const incomingAge=name?Math.max(0,frame.progress*frame.duration-step):0;
   const incoming=name?sampleGesture({name,age:incomingAge,side:leadingSide}):neutral;
   const incomingA=name?sampleGesture({name,age:incomingAge-DERIVATIVE_STEP,side:leadingSide}):neutral;
   const incomingB=name?sampleGesture({name,age:incomingAge+DERIVATIVE_STEP,side:leadingSide}):neutral;
   const currentAge=name?frame.progress*frame.duration:0;
   const currentA=name?sampleGesture({name,age:currentAge-DERIVATIVE_STEP,side:leadingSide}):neutral;
   const currentB=name?sampleGesture({name,age:currentAge+DERIVATIVE_STEP,side:leadingSide}):neutral;
   for(const channel of channels){
    const outgoingVelocity=(read(oldB,channel)-read(oldA,channel))/(2*DERIVATIVE_STEP)+channel.offsetVelocity;
    const incomingVelocity=(read(incomingB,channel)-read(incomingA,channel))/(2*DERIVATIVE_STEP);
    channel.offset=channel.value-read(incoming,channel);
    channel.offsetVelocity=outgoingVelocity-incomingVelocity;
    channel.targetVelocity=(read(currentB,channel)-read(currentA,channel))/(2*DERIVATIVE_STEP);
   }
   transitions++;
  }

  let residual=false,blinkResidual=false;
  const decay=Math.exp(-omega*step);
  for(const channel of channels){
   const target=read(frame,channel),previousTarget=channel.target;
   if(channel.offset!==0||channel.offsetVelocity!==0){
    // The same critically damped analytic solution as the existing V41
    // handoff, applied to a residual rather than filtering the authored pose.
    const carry=channel.offsetVelocity+omega*channel.offset;
    channel.offset=(channel.offset+carry*step)*decay;
    channel.offsetVelocity=(channel.offsetVelocity-omega*carry*step)*decay;
    if(Math.abs(channel.offset)<1e-6&&Math.abs(channel.offsetVelocity)<1e-5)channel.offset=channel.offsetVelocity=0;
   }
   channel.value=clamp(target+channel.offset,channel.min,channel.max);
   if(retarget)channel.velocity=channel.targetVelocity+channel.offsetVelocity;
   else if(step>0)channel.velocity=(target-previousTarget)/step+channel.offsetVelocity;
   channel.target=target;
   const alive=channel.offset!==0||channel.offsetVelocity!==0;
   residual||=alive;if(channel.kind===1)blinkResidual||=alive;
   if(channel.kind===0)poseArrays[channel.bone][channel.axis]=channel.value;
   else if(channel.kind===1)blink[channel.side]=channel.value;
   else output.lift=channel.value;
  }
  if(residual){
   for(const bone of bones){
    const value=poseArrays[bone];
    if(frame.pose[bone]||value[0]!==0||value[1]!==0||value[2]!==0)pose[bone]=value;
    else delete pose[bone];
   }
   output.pose=pose;output.blink=frame.blink!==null||blinkResidual?blink:null;
  }else{
   // Keep even the exact authored object/nullable blink contract unchanged.
   output.pose=frame.pose;output.blink=frame.blink;output.lift=frame.lift;
  }
  output.transitioning=residual;
  previousName=name;previousProgress=frame.progress;previousSide=leadingSide;previousDuration=frame.duration;
  initialized=true;return output;
 }

 function snapshot(){
  const velocities={},rendered={};
  for(const bone of ['Head','Forearm.L','Forearm.R','Leg.L','Leg.R']){
   const start=bones.indexOf(bone)*3;
   rendered[bone]=channels.slice(start,start+3).map(channel=>channel.value);
   velocities[bone]=channels.slice(start,start+3).map(channel=>channel.velocity);
  }
  return {transitioning:output.transitioning,transitions,pose:rendered,velocity:velocities,
   blink:{left:blink.left,right:blink.right},lift:output.lift,
   blinkVelocity:{left:channels[bones.length*3].velocity,right:channels[bones.length*3+1].velocity},
   liftVelocity:channels[channels.length-1].velocity};
 }
 return {sample,reset,snapshot};
}
