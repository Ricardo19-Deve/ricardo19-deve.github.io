/**
 * V71 — stage motion for M's nap on the original V6 Three.js stage.
 *
 * V32 tipped the whole stage about 76° so M lay on her side as one rigid
 * block. The nap now curls the rig itself (m-world-sleep.mjs: spine, head,
 * knees, folded arms and a wrapped tail), so the stage only adds a gentle
 * roll towards the resting side, a soft settle and the faint rise of each
 * breath. It is an additive render-only pose, not a new mesh, rig or asset.
 * All channels return to their neutral positions with zero slope.
 */
import {SLEEP_DURATION,SLEEP_STAGE_ROLL,SLEEP_STAGE_SCALE,sampleSleep} from './m-world-sleep.mjs?v=69';

export const REST_TILT_RADIANS=SLEEP_STAGE_ROLL;
export const REST_MIN_SCALE=SLEEP_STAGE_SCALE;
const NEUTRAL=Object.freeze({resting:false,phase:'awake',weight:0,rotationZ:0,rotationX:0,
 positionX:0,positionY:0,scale:1,breath:0});

/** age and duration are in seconds; side is the direction M curls towards. */
export function sampleEmbodiedRest({name=null,age=0,duration=SLEEP_DURATION,side=1,reducedMotion=false}={}){
 if(name!=='sleep'||reducedMotion)return {...NEUTRAL};
 const nap=sampleSleep({age,duration,side});
 if(!nap)return {...NEUTRAL};
 return {resting:nap.weight>0,phase:nap.phase,weight:nap.weight,...nap.stage,breath:nap.breath};
}
