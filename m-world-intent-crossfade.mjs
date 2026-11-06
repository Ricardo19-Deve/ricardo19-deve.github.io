/**
 * M World V55 — a single, continuous expressive bridge between
 * spontaneous play and attentive quiet, on the ORIGINAL V6 rig.
 *
 * V41 continues to own angular-velocity-preserving bone handoffs and V28
 * still owns final facial morph crossfades. This layer mixes the TARGETS
 * before those systems receive them; it does not control the route,
 * world depth, card contact, gestures, sleep, visitors or external data.
 */
import {dampChannel} from './m-world-pose-handoff.mjs?v=55';

const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
const CHANNELS=Object.freeze(['happy','curious','surprised']);
const LIDS=Object.freeze(['left','right']);
const ZERO_STAGE=Object.freeze({rx:0,ry:0,rz:0,y:0,scale:0});
const freshFace=()=>({
 weights:{happy:0,curious:0,surprised:0},
 eyelids:{left:0,right:0}
});
const sanitizeFace=face=>({
 weights:Object.fromEntries(CHANNELS.map(name=>[name,clamp(face?.weights?.[name])])),
 eyelids:Object.fromEntries(LIDS.map(name=>[name,clamp(face?.eyelids?.[name],0,.5)]))
});

export function scaleExpressivePose(pose={},weight=0){
 const fraction=clamp(weight);
 if(fraction<.000001)return {};
 const result={};
 for(const [name,angles] of Object.entries(pose||{})){
  if(typeof name!=='string'||!Array.isArray(angles)||angles.length!==3)continue;
  result[name]=angles.map(value=>clamp(value,-2,2)*fraction);
 }
 return result;
}
export function scaleExpressiveStage(stage={},weight=0){
 const fraction=clamp(weight);
 return Object.fromEntries(Object.keys(ZERO_STAGE).map(key=>[
  key,clamp(stage?.[key],-.15,.15)*fraction
 ]));
}

export function createIntentCrossfade({halfLife=.17}={}){
 const play={position:0,velocity:0},ambient={position:0,velocity:0};
 let playFace=freshFace(),ambientFace=freshFace(),frames=0,
  handoffs=0,lastLeader='none',last={leader:'none',play:0,ambient:0,face:null};
 function reset(){
  play.position=play.velocity=ambient.position=ambient.velocity=0;
  playFace=freshFace();ambientFace=freshFace();
  lastLeader='none';last={leader:'none',play:0,ambient:0,face:null};
 }
 function shift(channel,target,dt){
  const next=dampChannel(channel.position,channel.velocity,target,dt,halfLife);
  // Critical damping preserves velocity without a sudden mid-action reset.
  // Clamp eventual tiny overshoots safely when the target is 0 or 1.
  const position=clamp(next.position);
  channel.velocity=(position!==next.position)?0:next.velocity;
  channel.position=position;
  return position;
 }
 function sample({dt=0,playState=null,ambientState=null,
  gestureActive=false,resting=false,priorityAffect=false,
  reducedMotion=false}={}){
  frames++;
  if(reducedMotion){
   reset();
   return {playPose:{},ambientPose:{},playStage:{...ZERO_STAGE},
    playWeight:0,ambientWeight:0,face:null,leader:'none'};
  }
  const step=clamp(dt,0,.06);
  const blocked=Boolean(gestureActive||resting||priorityAffect);
  const p=Boolean(playState?.active)&&!blocked;
  const a=Boolean(ambientState?.active)&&!blocked&&!p;
  const leader=blocked?'priority':p?'play':a?'observe':'quiet';
  if(leader!==lastLeader&&frames>1)handoffs++;
  lastLeader=leader;
  // Stop the old intention softly. This weight is applied to current
  // input only; V41 retains the last live bone pose/velocity across exit.
  const playWeight=shift(play,p?1:0,step);
  const ambientWeight=shift(ambient,a?1:0,step);
  // Prevent two overlapping intentions exceeding one full performance.
  const normalizer=Math.max(1,playWeight+ambientWeight);
  const pw=playWeight/normalizer,aw=ambientWeight/normalizer;
  if(p&&playState?.face)playFace=sanitizeFace(playState.face);
  if(a&&ambientState?.face)ambientFace=sanitizeFace(ambientState.face);
  // Retain the last VERIFIED expression briefly as a weight decays;
  // the original V28 continuity then adds the final reversible crossfade.
  const strength=pw+aw;
  let face=null;
  if(!blocked&&strength>.00005){
   face={
    weights:Object.fromEntries(CHANNELS.map(key=>[key,clamp(
     playFace.weights[key]*pw+ambientFace.weights[key]*aw
    )])),
    eyelids:Object.fromEntries(LIDS.map(key=>[key,clamp(
     playFace.eyelids[key]*pw+ambientFace.eyelids[key]*aw,0,.5
    )]))
   };
  }
  last={leader,play:pw,ambient:aw,face};
  return {
   playPose:blocked?{}:scaleExpressivePose(playState?.pose,pw),
   ambientPose:blocked?{}:scaleExpressivePose(ambientState?.pose,aw),
   playStage:blocked?{...ZERO_STAGE}:scaleExpressiveStage(playState?.stage,pw),
   playWeight:pw,ambientWeight:aw,face,leader
  };
 }
 function snapshot(){return {
  ...{leader:last.leader,play:last.play,ambient:last.ambient},
  frames,handoffs,activeFacialBlend:!!last.face,
  moving:Math.abs(play.velocity)>.0005||Math.abs(ambient.velocity)>.0005
 };}
 return {sample,reset,snapshot};
}
