/**
 * V28: reversible, bounded performance smoothing over the ORIGINAL V6 rig.
 * This module never creates bones, changes textures or owns a route/depth gate.
 * Filtering gaze and movement-derived signals prevents hard changes in head,
 * torso and tail energy when user attention or locomotion changes abruptly.
 */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,finite(value,0)));
const approach=(from,to,dt,halfLife)=>from+(to-from)*(1-Math.pow(.5,dt/halfLife));

export function createPresenceDynamics(){
 let gazeX=0,gazeY=0,velocityX=0,velocityY=0,activity=0,turn=0;
 function reset(){gazeX=gazeY=velocityX=velocityY=activity=turn=0;}
 function sample({dt=0,vx=0,vy=0,attention={x:0,y:0},nearCard=false,calm=false,reducedMotion=false}={}){
  if(reducedMotion){
   reset();
   return {attention:{x:0,y:0},energy:0,tailEnergy:0,tailReactivity:0,tailFlow:.83,performanceImpact:0,
    bodyMotion:{rotation:{y:0,z:0},velocity:{x:0,y:0}},stageYaw:0,moving:0};
  }
  const step=clamp(dt,0,.06),ax=clamp(attention?.x,-1,1),ay=clamp(attention?.y,-1,1);
  const currentX=clamp(vx,-600,600),currentY=clamp(vy,-600,600);
  // Eyes/head lead, torso follows, and the connected ten-bone tail settles last.
  const gazeHalf=nearCard?.105:.15;
  gazeX=approach(gazeX,ax,step,gazeHalf);gazeY=approach(gazeY,ay,step,gazeHalf);
  velocityX=approach(velocityX,currentX,step,.14);
  velocityY=approach(velocityY,currentY,step,.14);
  activity=approach(activity,clamp(Math.hypot(currentX,currentY)/220),step,.2);
  turn=approach(turn,clamp(Math.abs(currentX-velocityX)/160+Math.abs(currentY-velocityY)/160),step,.24);
  const intent=calm?.12:activity;
  return {
   attention:{x:gazeX,y:gazeY},moving:activity,
   energy:calm?.12:clamp(.35+.49*intent,0,.84),
   tailEnergy:calm?.18:clamp(.25+.62*intent+.06*turn,0,.94),
   tailReactivity:calm?.25:clamp(1.2+.3*turn,0,1.5),
   tailFlow:clamp(.80+.035*activity,0,.84),
   performanceImpact:calm?.2:1,
   bodyMotion:{rotation:{y:clamp(velocityX*.001,-.4,.4),z:clamp(velocityY*.001,-.4,.4)},
    velocity:{x:clamp(velocityX*.002,-.5,.5),y:clamp(velocityY*.002,-.5,.5)}},
   stageYaw:clamp(gazeX*(nearCard?.02:.01),-.02,.02)
  };
 }
 return {sample,reset,snapshot:()=>({attention:{x:gazeX,y:gazeY},velocity:{x:velocityX,y:velocityY},moving:activity,turn})};
}
