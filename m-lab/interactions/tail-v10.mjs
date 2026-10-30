/**
 * M V10 — expressive, body-driven tail choreography.
 * Only additive local bone rotations for the original Tail.01 ... Tail.10 rig.
 * The source GLB, animation mixer and shoulder-corrective morphs are untouched.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const pulse=(age,delay,decay=2.9,speed=10)=>{
 const t=age-delay;
 return t<=0?0:Math.exp(-t*decay)*Math.sin(t*speed);
};
const smoothCap=(value,bound)=>bound*Math.tanh(value/bound);
export const TAIL_STYLES_V10=Object.freeze(['organic','calm','playful']);

/** Pure, continuous poses. bodyMotion is fed from the already-spring-smoothed stage. */
export function tailPoseV10({
 time=0,mode='float',modeAge=999,expression='neutral',emotionAge=999,
 style='organic',amount=1.1,reactivity=1.5,
 pointer={x:0,y:0},headTurn=0,
 bodyMotion={},swimWeight=0
}={}){
 const t=Math.max(0,time),base=clamp(amount,0,1.5),react=clamp(reactivity,0,2.0);
 const chosen=TAIL_STYLES_V10.includes(style)?style:'organic';
 const calm=chosen==='calm',playful=chosen==='playful';
 const rate=calm?.78:playful?1.28:1;
 const character=calm?.77:playful?1.20:1;
 const rot=bodyMotion.rotation||{},velocity=bodyMotion.velocity||{},
  angular=bodyMotion.angularVelocity||{};
 const ptrX=clamp(pointer?.x,-1,1);
 const turn=clamp((rot.y||0)*2+(angular.y||0)*.26+headTurn*.75+
  (mode==='follow'?ptrX*.26:0),-1.7,1.7);
 const roll=clamp((rot.z||0)*1.8+(angular.z||0)*.15,-1.5,1.5);
 const drift=clamp((velocity.x||0)*.36,-1.2,1.2);
 const lift=clamp((velocity.y||0)*.27,-1,1);
 const swimming=clamp(swimWeight,0,1);
 const lagUnit=.33; // Phase delay varies per tail segment.
 const poses={};
 for(let i=1;i<=10;i++){
  const k=i/10,lag=(i-1)*lagUnit;
  const edge=.3+.7*k,soft=.58+.42*k;
  const a=t*rate;
  // Idle remains alive but softer than the emotion and motion response.
  const flow=Math.sin(a*1.16-lag+.18*Math.sin(t*.31));
  const counter=Math.sin(a*.68-lag*.55+1.15);
  const upsweep=Math.sin(a*.83-lag*.77+.8);
  let x=base*character*(.024+.032*k)*(.68*counter+.35*Math.sin(a*.39-lag*.25));
  let y=base*character*(.050+.058*k)*(.76*flow+.32*counter);
  let z=base*character*(.033+.052*k)*(.81*upsweep+.2*Math.sin(a*.43-lag*.35));
  if(playful)y+=base*.022*edge*Math.sin(a*2.2-lag*1.1);
  // Swimming is a propulsion stroke; both stage speed and GLB clip weight
  // matter so the wave does not suddenly disappear on mode transitions.
  y+=base*swimming*(.035+.035*k)*Math.sin(a*2.05-lag*.94);
  z+=base*swimming*.026*edge*Math.sin(a*1.55-lag*.65);
  // Whole-body follow-through: counterturn after head/body steering,
  // then a softer travelling offset at the tip through per-joint springs.
  y+=react*edge*(-.078*turn-.052*drift);
  z+=react*edge*(-.054*roll-.042*lift);
  x+=react*edge*(.038*roll-.025*turn);
  // A personality for every expression — not a generic fixed tail wag.
  if(expression==='happy'){
   y+=react*soft*(.068*Math.sin(a*2.75-lag*1.14)+.032*Math.sin(a*1.68-lag*.7));
   z+=react*.035*edge*Math.sin(a*2.1-lag*.9);
   y+=react*.040*edge*pulse(emotionAge,k*.07,3.2,11);
  }
  if(expression==='curious'){
   y+=react*(.060+.032*k);  // Lift to one side, head leans in.
   z+=react*.056*k;
   y+=react*.028*edge*Math.sin(a*.9-lag*.4);
  }
  if(expression==='surprised'){
   // Quick kick with delayed recovery. The shock arrives base-to-tip.
   y+=react*edge*.16*pulse(emotionAge,k*.11,2.6,10.5);
   x-=react*edge*.062*pulse(emotionAge,k*.09,3,12);
   z+=react*edge*.05*Math.exp(-Math.max(0,emotionAge-k*.11)*1.9);
  }
  if(mode==='shy'){
   y+=react*edge*.092;
   z+=react*edge*.074; // Curl behind the silhouette.
  }
  if(mode==='peek'){
   y-=react*edge*.07;
   z+=react*edge*.039;
  }
  if(mode==='follow'){
   y-=react*edge*.038*ptrX; // Tail counters the head tracking the pointer.
  }
  if(mode==='knock'){
   const ripple=pulse(modeAge,.69+k*.09,3.1,12)+pulse(modeAge,1.17+k*.09,3.4,13);
   y+=react*edge*.108*ripple;
   z+=react*edge*.035*ripple;
  }
  // Bounded, smooth saturation prevents sharp clipping even at 200%.
  // 0 base + 0 reaction means no additional tail animation at all.
  const key='Tail.'+String(i).padStart(2,'0');
  poses[key]=base===0&&react===0?[0,0,0]:[
   smoothCap(x,.26),smoothCap(y,.29),smoothCap(z,.26)
  ];
 }
 return poses;
}
