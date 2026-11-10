/**
 * V28: reversible, bounded performance smoothing over the ORIGINAL V6 rig.
 * This module never creates bones, changes textures or owns a route/depth gate.
 * Filtering gaze and movement-derived signals prevents hard changes in head,
 * torso and tail energy when user attention or locomotion changes abruptly.
 * Optional V66 performance uses energy/arousal/focus in [0,1] and valence in
 * [-1,1]. Its reused tailMood target belongs to the existing ten-joint solver;
 * callers needing a historical value should use snapshot() or clone it.
 */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,finite(value,0)));
const approach=(from,to,dt,halfLife)=>from+(to-from)*(1-Math.pow(.5,dt/halfLife));

export function createPresenceDynamics(){
 let gazeX=0,gazeY=0,velocityX=0,velocityY=0,activity=0,turn=0;
 let tailPhase=0,tailTempo=1,performanceActive=false;
 // Reused numeric profile. The existing joint solver remains the only tail
 // physics owner; this profile changes its targets, not the rig or topology.
 const tailMood={energy:.65,arousal:.35,valence:0,focus:0,drive:.3,sleep:0,startle:0,
  intent:'observe',mood:'neutral',eventId:null,eventAge:null};
 function reset(){
  gazeX=gazeY=velocityX=velocityY=activity=turn=tailPhase=0;tailTempo=1;performanceActive=false;
  Object.assign(tailMood,{energy:.65,arousal:.35,valence:0,focus:0,drive:.3,sleep:0,startle:0,
   intent:'observe',mood:'neutral',eventId:null,eventAge:null});
 }
 function sample({dt=0,vx=0,vy=0,attention={x:0,y:0},nearCard=false,calm=false,reducedMotion=false,performance=null}={}){
  const contextual=performance!==null&&typeof performance==='object'&&!Array.isArray(performance);
  if(reducedMotion){
   reset();
   if(contextual){
    performanceActive=true;tailTempo=0;
    for(const key of ['energy','arousal','valence','focus','drive','sleep','startle'])tailMood[key]=0;
   }
   return {attention:{x:0,y:0},energy:0,tailEnergy:0,tailReactivity:0,tailFlow:.83,performanceImpact:0,
    bodyMotion:{rotation:{y:0,z:0},velocity:{x:0,y:0}},stageYaw:0,moving:0,
    ...(contextual?{tailPhase:0,tailTempo:0,tailMood,performance:tailMood}:{})};
  }
  const step=clamp(dt,0,.06),ax=clamp(attention?.x,-1,1),ay=clamp(attention?.y,-1,1);
  const currentX=clamp(vx,-600,600),currentY=clamp(vy,-600,600);
  let blocked=false,sleeping=false;
  if(contextual){
   performanceActive=true;
   const intent=typeof performance.intent==='string'?performance.intent:'observe';
   const phase=typeof performance.phase==='string'?performance.phase:'';
   const mood=typeof performance.mood==='string'?performance.mood:'neutral';
   sleeping=intent==='sleep'||phase==='sleeping'||mood==='sleeping';
   blocked=performance.blocked===true;
   const energy=clamp(finite(performance.energy,.65)),arousal=clamp(finite(performance.arousal,.35));
   const focus=clamp(finite(performance.focus,0)),valence=clamp(performance.valence,-1,1);
   tailMood.energy=approach(tailMood.energy,energy,step,.32);
   tailMood.arousal=approach(tailMood.arousal,arousal,step,.27);
   tailMood.valence=approach(tailMood.valence,valence,step,.43);
   tailMood.focus=approach(tailMood.focus,focus,step,.24);
   tailMood.sleep=approach(tailMood.sleep,sleeping?1:0,step,sleeping?.18:.4);
   tailMood.drive=approach(tailMood.drive,clamp(energy*(.3+.7*arousal)),step,.3);
   tailMood.startle=approach(tailMood.startle,mood==='surprised'?arousal:0,step,.13);
   tailMood.intent=intent;tailMood.mood=mood;
   tailMood.eventId=performance.eventId??null;
   tailMood.eventAge=tailMood.eventId!==null&&Number.isFinite(performance.eventAge)?Math.max(0,performance.eventAge):null;
   const tempo=sleeping?.12:clamp(.45+.5*tailMood.energy+.28*tailMood.arousal-.12*tailMood.focus,.35,1.3);
   const rate=Math.LN2/.36,decay=Math.exp(-rate*step),previous=tailTempo;
   tailTempo=tempo+(previous-tempo)*decay;
   // Exact integral of the smoothed frequency. Multiplying absolute time by
   // a changing tempo would visibly jump the tail's phase at every mood change.
   tailPhase+=tempo*step+(previous-tempo)*(1-decay)/rate;
  }else{
   performanceActive=false;tailPhase+=step;tailTempo=1;
  }
  // Eyes/head lead, torso follows, and the connected ten-bone tail settles last.
  const gazeHalf=(nearCard?.105:.15)*(contextual?1.22-.32*tailMood.focus+.3*(1-tailMood.energy):1);
  gazeX=approach(gazeX,blocked?0:ax,step,gazeHalf);gazeY=approach(gazeY,blocked?0:ay,step,gazeHalf);
  velocityX=approach(velocityX,currentX,step,.14);
  velocityY=approach(velocityY,currentY,step,.14);
  activity=approach(activity,clamp(Math.hypot(currentX,currentY)/220),step,.2);
  turn=approach(turn,clamp(Math.abs(currentX-velocityX)/160+Math.abs(currentY-velocityY)/160),step,.24);
  const intent=calm?.12:activity;
  const out={
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
  if(contextual){
   const quiet=performance.reading===true?.5:1,gate=blocked||sleeping?0:1;
   out.energy=gate*clamp(out.energy*(.35+.65*tailMood.energy)*(.82+.3*tailMood.arousal),0,.84);
   out.tailEnergy=gate*quiet*clamp(.09+.17*tailMood.energy+.18*activity+.04*turn,0,.62);
   out.tailReactivity=gate*quiet*clamp(.28+.8*tailMood.arousal+.22*tailMood.focus+.12*turn,0,1.3);
   out.tailFlow=clamp(.86-.055*tailMood.arousal+.035*tailMood.focus,.8,.92);
   out.performanceImpact=gate*quiet*(.35+.65*tailMood.arousal);
   out.tailPhase=tailPhase;out.tailTempo=tailTempo;out.tailMood=tailMood;out.performance=tailMood;
  }
  return out;
 }
 return {sample,reset,snapshot:()=>({attention:{x:gazeX,y:gazeY},velocity:{x:velocityX,y:velocityY},moving:activity,turn,
  ...(performanceActive?{tailPhase,tailTempo,performance:{...tailMood}}:{})})};
}
