import {tailPoseV14} from './tail-v14.mjs';
/**
 * M V15 performance tail — large, readable emotion-specific gestures
 * layered over the V14 continuous wave. Each gesture travels base-to-tip,
 * but all actual rotations are applied through reversible Three.js springs.
 */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:0));
const cap=(v,b)=>b*Math.tanh(v/b);
const shock=(age,lag,decay=1.75,freq=8.6)=>{
 const t=age-lag;return t<=0?0:Math.sin(t*freq)*Math.exp(-t*decay);
};
export function tailPoseV15(opts={}){
 const original=tailPoseV14(opts),out={};
 const t=Math.max(0,opts.time||0),expression=opts.expression||'neutral';
 const mode=opts.mode||'float',age=Math.max(0,opts.emotionAge??99);
 if(impact===0)return original;
 const amount=clamp(opts.amount??.85,0,1.5),
       react=clamp(opts.reactivity??1.75,0,2),
       impact=clamp(opts.performance??1.12,0,1.6);
 for(let i=1;i<=10;i++){
  const key='Tail.'+String(i).padStart(2,'0');
  const [ox,oy,oz]=original[key];
  const k=(i-1)/9;
  // Stronger near the base, but the final 6 bones propagate the motion
  // as a visible delayed wave rather than a rigid rod.
  const base=(1-.50*k),mid=Math.sin(Math.PI*(i)/11);
  const phase=k*2.0;
  let x=0,z=0;
  if(expression==='happy'){
   x+=.105*base*Math.sin(t*2.65-phase);
   z+=.064*mid*Math.sin(t*2.10-phase*.78+1.1);
   x+=.12*base*shock(age,k*.12,1.6,7.9);
  }else if(expression==='curious'){
   // Obvious raised/question-mark posture while the tip continues searching.
   x+=.16*base+.03*k*Math.sin(t*.87-phase*.4);
   z+=.075*mid+.035*k*Math.sin(t*.94-phase*.63);
  }else if(expression==='surprised'){
   // Backward spring/recoil, then long easing recovery.
   x-=.16*base;
   z-=.095*base;
   x+=.20*base*shock(age,k*.15,1.3,8.3);
   z+=.083*mid*shock(age,k*.18,1.3,7.7);
  }
  if(mode==='swim'){
   x+=.079*base*Math.sin(t*2.7-phase*.8);
   z+=.04*mid*Math.sin(t*1.85-phase*.65);
  }else if(mode==='shy'){
   x-=.065*base;z+=.047*mid;
  }else if(mode==='peek'){
   z+=.04*base;
  }else if(mode==='knock'){
   x+=.12*base*(shock(opts.modeAge??99,.64+k*.12)+shock(opts.modeAge??99,1.12+k*.12));
  }
  const multiplier=impact*react*.72;
  // Preserve separate V14 idle wave slider. Performance mode at zero
  // adds no movement; both tail controls zero still stop ALL extra motion.
  if(amount===0&&react===0){out[key]=[0,0,0];continue;}
  out[key]=[
   cap(ox+multiplier*x,.33),
   cap(oy,.018),
   cap(oz+multiplier*z,.30)
  ];
 }
 return out;
}
