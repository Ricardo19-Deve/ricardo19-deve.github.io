/**
 * V28: local quality governor; no device fingerprinting or remote telemetry.
 * High-quality V6 source assets are always preserved. Only render resolution
 * changes after sustained frame pacing evidence, with hysteresis to avoid flicker.
 */
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,finite(n,min)));
export function createRenderQualityGovernor({maxRatio=2.5,minRatio=1.75}={}){
 let ceiling=clamp(maxRatio,1,3),floor=clamp(minRatio,1,ceiling),ratio=ceiling;
 let profile='desktop',elapsed=0,slow=0,fast=0,lastChange=0,changes=0;
 function configure({maxRatio=ceiling,minRatio=floor,device=profile}={}){
  const nextMax=clamp(maxRatio,1,3),nextMin=clamp(minRatio,1,nextMax);
  if(device!==profile||nextMax!==ceiling||nextMin!==floor){
   profile=device;ceiling=nextMax;floor=nextMin;ratio=ceiling;elapsed=slow=fast=lastChange=0;changes=0;
  }
  return ratio;
 }
 function observe(frameMs){
  if(!Number.isFinite(frameMs)||frameMs<8||frameMs>100)return false;
  const d=clamp(frameMs,8,60);elapsed+=d;
  if(d>=25){slow+=d;fast=0;}
  else if(d<=18){fast+=d;slow=Math.max(0,slow-d*2);}
  else{slow=Math.max(0,slow-d);fast=Math.max(0,fast-d);}
  if(elapsed<2500)return false;
  if(slow>=1500&&elapsed-lastChange>=4000&&ratio>floor){
   ratio=Math.max(floor,Math.round((ratio-.25)*1000)/1000);
   lastChange=elapsed;slow=fast=0;changes++;return true;
  }
  if(fast>=10_000&&elapsed-lastChange>=8000&&ratio<ceiling){
   ratio=Math.min(ceiling,Math.round((ratio+.125)*1000)/1000);
   lastChange=elapsed;slow=fast=0;changes++;return true;
  }
  return false;
 }
 return {configure,observe,snapshot:()=>({ratio,maxRatio:ceiling,minRatio:floor,device:profile,changes,slowMs:slow,fastMs:fast})};
}

/**
 * V70: frame pacing. M never draws more than 60 frames a second (120 Hz screens
 * do half the work), 30 while she sleeps or rests still on a card (unless the page
 * is scrolling, so a perched M stays attached), and 20 while she is entirely off
 * screen. Intervals stay within the controller's 50 ms time step, so her clock does
 * not slow down. Returns the minimum milliseconds between two drawn frames.
 */
export const M_FRAME_INTERVALS=Object.freeze({active:1000/60,calm:1000/30,offscreen:1000/20});
export function frameIntervalMs({sleeping=false,resting=false,scrolling=false,offscreen=false}={}){
 if(offscreen)return M_FRAME_INTERVALS.offscreen;
 if((sleeping||resting)&&!scrolling)return M_FRAME_INTERVALS.calm;
 return M_FRAME_INTERVALS.active;
}
/** True when the actor rectangle is completely outside the viewport. */
export function isOffscreen(rect,viewport){
 if(!rect||!viewport)return false;
 return rect.right<0||rect.bottom<0||rect.left>viewport.width||rect.top>viewport.height;
}
