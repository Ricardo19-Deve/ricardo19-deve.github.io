/** V67: bounded secondary wind response for the ORIGINAL M rig. */
import {weatherVisual} from './m-world-weather.mjs?v=66&sky=67';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
export function weatherActorPose(weather,{reducedMotion=false,reading=false,resting=false,gesture=false,sleeping=false}={}){
 const v=weatherVisual(weather);
 const enabled=!reducedMotion&&!reading&&!resting&&!gesture;
 const force=enabled?clamp((v.wind-.20)/.8,0,.75):0;
 const cross=force*v.drift;
 const pose={};
 if(force>.001){
  pose.Head=[0,0,-cross*.018];
  pose.Neck=[0,0,-cross*.012];
  pose.Chest=[0,0,-cross*.019];
  for(let i=1;i<=10;i++){
   const name='Tail.'+String(i).padStart(2,'0');
   pose[name]=[0,0,cross*(.014+i*.0022)];
  }
 }
 return {pose,stageRoll:-cross*.028,umbrella:!reducedMotion&&!sleeping&&v.umbrella,
  umbrellaTilt:!reducedMotion&&!sleeping?-v.drift*.15:0,ambientWind:reducedMotion?0:v.wind,wind:force,drift:v.drift};
}
