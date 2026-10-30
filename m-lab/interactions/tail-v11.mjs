/**
 * M V11 — RIG-AXIS-CORRECT expressive tail.
 *
 * Verified against the real Blender V6 GLB: Tail.01...Tail.10 children
 * extend along each bone's LOCAL +Y axis. Rotating about Y mostly TWISTS
 * the tail rather than bending it. The visible bend must use local X/Z.
 *
 * The returned [x,y,z] are additive bone-local Euler rotations in radians.
 * Stateful interpolation and undo of previous deltas are in motion-v8.mjs.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const squash=(v,cap)=>cap*Math.tanh(v/cap);
const kick=(age,delay,decay=2.5,freq=9.2)=>{
 const u=age-delay;
 return u<=0?0:Math.exp(-u*decay)*Math.sin(u*freq);
};
export const TAIL_STYLES_V11=Object.freeze(['organic','calm','playful']);
export function tailPoseV11({
 time=0,mode='float',modeAge=99,expression='neutral',emotionAge=99,
 style='organic',amount=.90,reactivity=1.5,
 pointer={x:0,y:0},headTurn=0,
 bodyMotion={},swimWeight=0
}={}){
 const t=Math.max(0,time),base=clamp(amount,0,1.5),react=clamp(reactivity,0,2);
 const selection=TAIL_STYLES_V11.includes(style)?style:'organic';
 const calm=selection==='calm',playful=selection==='playful';
 const tempo=(calm?.72:playful?1.22:1);
 const gain=calm?.8:playful?1.23:1;
 const rot=bodyMotion.rotation||{},vel=bodyMotion.velocity||{},omega=bodyMotion.angularVelocity||{};
 const turn=clamp((rot.y||0)*1.7+(omega.y||0)*.24+headTurn*.5,-1.5,1.5);
 const roll=clamp((rot.z||0)*1.7+(omega.z||0)*.19,-1.3,1.3);
 const side=clamp((vel.x||0)*.28,-1,1);
 const rise=clamp((vel.y||0)*.23,-1,1);
 const ptr=clamp(pointer?.x,-1,1),swim=clamp(swimWeight,0,1);
 const out={};
 for(let i=1;i<=10;i++){
  const k=i/10,lag=(i-1)*.42;
  const root=Math.exp(-(i-1)/3.4),mid=Math.sin(Math.PI*i/11),tip=k;
  const traveling=Math.sin(t*tempo*1.42-lag+.12*Math.sin(t*.38));
  const second=Math.sin(t*tempo*.77-lag*.54+1.1);
  // Base is calm; major visible poses come from emotion and body steering.
  let bx=base*gain*(.026+.012*tip)*(.82*traveling+.22*second);
  let bz=base*gain*(.021+.012*tip)*Math.sin(t*tempo*.94-lag*.88+.5);
  let twist=base*.0035*Math.sin(t*.7-lag*.7);
  if(playful)bx+=base*.013*Math.sin(t*tempo*2.1-lag*1.1);
  // Tail counter-steers when the chest turns or the character accelerates.
  bx+=react*(-.11*turn-.070*side)*(.3+.7*root);
  bz+=react*(-.085*roll-.040*rise)*(.3+.7*root);
  // Swimming propels through a smooth wave with phase traveling to the tip.
  bx+=base*swim*(.040+.021*tip)*Math.sin(t*2.5-lag*.93);
  bz+=base*swim*(.030+.017*tip)*Math.sin(t*1.8-lag*.73+.5);
  if(expression==='happy'){
   // Rhythmic, obvious wag, with a starting celebratory kick.
   bx+=react*(.053+.025*tip)*Math.sin(t*2.95-lag*1.02);
   bz+=react*.027*mid*Math.sin(t*2.15-lag*.85);
   bx+=react*.100*root*kick(emotionAge,k*.065,2.6,11);
  }else if(expression==='curious'){
   // Head tilts; root lifts and sidesweeps while tip follows slowly.
   bx+=react*(.095*root+.022*mid);
   bz+=react*(.074*root-.018*tip);
   bx+=react*.025*tip*Math.sin(t*.87-lag*.28);
  }else if(expression==='surprised'){
   // Discrete recoil then held startled pose, not generic wag.
   bz-=react*(.13*root+.022*mid);
   bx+=react*.12*root*kick(emotionAge,k*.065,2.35,11.5);
   bz-=react*.048*mid*kick(emotionAge,k*.075,2.3,10);
  }
  if(mode==='shy'){
   bx-=react*(.12*root+.014*mid);
   bz+=react*(.10*root+.018*mid);
  }else if(mode==='peek'){
   bx+=react*.092*root;
   bz-=react*.031*mid;
  }else if(mode==='follow'){
   bx-=react*.065*root*ptr;
  }else if(mode==='knock'){
   const impulse=kick(modeAge,.69+k*.065,2.6,12)+kick(modeAge,1.17+k*.065,3,12.5);
   bx+=react*.13*root*impulse;
   bz+=react*.055*mid*impulse;
  }
  const key='Tail.'+String(i).padStart(2,'0');
  // Disabling both sliders removes additive movement exactly.
  out[key]=base===0&&react===0?[0,0,0]:[
   squash(bx,.25), squash(twist,.025), squash(bz,.24)
  ];
 }
 return out;
}
