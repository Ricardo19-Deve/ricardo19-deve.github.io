/**
 * M V14 — a living, flowing tail.
 *
 * Generates continuous local X/Z bends over the original Tail01..Tail10
 * skeleton. The spring solver in motion-v8.mjs handles inertia and carries
 * the parent motion toward the tip. No GLB mutation, no new geometry.
 */
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(v)?v:0));
const softLimit=(x,max)=>max*Math.tanh(x/max);
const delayedKick=(age,delay,decay=1.85,rate=7.4)=>{
 const u=age-delay;
 return u<=0?0:Math.exp(-decay*u)*Math.sin(rate*u);
};
export const TAIL_STYLES_V14=Object.freeze(['organic','calm','playful']);

/**
 * flow: amount of phase travel and follow-through (0 to 1).
 * Base/reaction remain independent; local Y is minimal longitudinal twist.
 */
export function tailPoseV14({
 time=0,mode='float',modeAge=99,expression='neutral',emotionAge=99,
 style='organic',amount=.85,reactivity=1.75,flow=.73,
 pointer={x:0,y:0},headTurn=0,bodyMotion={},swimWeight=0
}={}){
 const t=Math.max(0,time),base=clamp(amount,0,1.5),
       react=clamp(reactivity,0,2),fluid=clamp(flow,0,1);
 const selected=TAIL_STYLES_V14.includes(style)?style:'organic';
 const calm=selected==='calm',playful=selected==='playful';
 const tempo=calm?.76:playful?1.24:1;
 const scale=calm?.79:playful?1.17:1;
 const rot=bodyMotion.rotation||{},velocity=bodyMotion.velocity||{},
       angular=bodyMotion.angularVelocity||{};
 const turn=clamp((rot.y||0)*1.7+(angular.y||0)*.25+headTurn*.48,-1.5,1.5);
 const roll=clamp((rot.z||0)*1.45+(angular.z||0)*.2,-1.4,1.4);
 const drift=clamp((velocity.x||0)*.33,-1.2,1.2);
 const lift=clamp((velocity.y||0)*.24,-1.0,1.0);
 const ptr=clamp(pointer?.x,-1,1),swim=clamp(swimWeight,0,1);
 const out={};
 for(let i=1;i<=10;i++){
  const k=(i-1)/9,root=Math.exp(-1.65*k),tip=.28+.72*k;
  // Delay increases across each joint, so the tip finishes each wave later.
  const phase=k*(1.35+2.45*fluid),breathPhase=k*.53;
  const fundamental=Math.sin(t*1.8*tempo-phase+.13*Math.sin(t*.36));
  const harmonic=Math.sin(t*.94*tempo-phase*.55+.85);
  const liftWave=Math.sin(t*1.34*tempo-phase*.78+1.1);
  // Continuous, intentionally modest idle motion.
  let x=base*scale*(.026+.015*k)*(.75*fundamental+.34*harmonic);
  let z=base*scale*(.022+.015*k)*(.88*liftWave+.22*Math.sin(t*.5-breathPhase));
  let y=base*.002*Math.sin(t*.7-phase*.4);
  if(playful)x+=base*.012*Math.sin(t*3.3-phase*.9);
  // A physical counter-swing follows chest/head turns and lateral movement.
  x+=react*(-.106*turn-.066*drift)*(.30+.70*root);
  z+=react*(-.082*roll-.045*lift)*(.31+.69*root);
  // Propulsion travels from root to tip as the baked swim action blends in.
  x+=base*swim*(.047+.020*k)*Math.sin(t*3.0-phase*1.04);
  z+=base*swim*(.034+.015*k)*Math.sin(t*2.1-phase*.78+.48);
  if(expression==='happy'){
   // The joyful wag repeats but its phase runs *along* the tail.
   x+=react*(.056+.012*k)*Math.sin(t*3.0-phase*1.05);
   z+=react*.030*tip*Math.sin(t*2.05-phase*.76);
   // A longer starting sweep settles back into the happy wag.
   x+=react*.105*root*delayedKick(emotionAge,k*.15,1.75,7.3);
  }else if(expression==='curious'){
   // Lift, pause and gently explore: not a locked single-angle pose.
   x+=react*(.066*root+.025*tip);
   z+=react*(.067*root-.018*tip);
   x+=react*.032*tip*Math.sin(t*.95-phase*.38);
   z+=react*.024*tip*Math.sin(t*.72-phase*.25);
  }else if(expression==='surprised'){
   // Fast recoil and an extended damped follow-through down the tail.
   z-=react*(.107*root+.019*tip);
   x+=react*.15*root*delayedKick(emotionAge,k*.17,1.55,9.1);
   z-=react*.065*tip*delayedKick(emotionAge,k*.19,1.55,7.6);
  }
  if(mode==='shy'){
   x-=react*(.105*root+.016*tip);
   z+=react*(.08*root+.023*tip);
  }else if(mode==='peek'){
   x+=react*.077*root;
   z-=react*.032*tip;
  }else if(mode==='follow'){
   x-=react*.068*root*ptr;
  }else if(mode==='knock'){
   const a=delayedKick(modeAge,.65+k*.14,2,9.8);
   const b=delayedKick(modeAge,1.15+k*.14,2.1,10.2);
   x+=react*.12*root*(a+b);
   z+=react*.055*tip*(a+b);
  }
  const key='Tail.'+String(i).padStart(2,'0');
  out[key]=base===0&&react===0?[0,0,0]:[
   softLimit(x,.27),softLimit(y,.015),softLimit(z,.25)
  ];
 }
 return out;
}
