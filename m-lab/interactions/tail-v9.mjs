/**
 * M Tail V9 — organic three-dimensional traveling-wave motion.
 * Local additive Euler angles per existing Tail.01 ... Tail.10 bone.
 * No random jitter, external physics engine, model edits, or DOM dependencies.
 */
const limit=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:0));
const sin=Math.sin;
export const TAIL_STYLES=Object.freeze(['organic','calm','playful']);

/**
 * Evaluate ten continuous joint offsets. The base starts the motion,
 * while the flexible tip receives a time-delayed, wider S-curve.
 * emotionAge/modeAge are local clocks reset when the action changes.
 */
export function tailPose({time=0,mode='float',modeAge=999,expression='neutral',
 emotionAge=999,style='organic',amount=1}={}){
 const t=Math.max(0,time),intensity=limit(amount,0,1.5);
 const selected=TAIL_STYLES.includes(style)?style:'organic';
 const calm=selected==='calm',playful=selected==='playful';
 const tempo=(calm?.77:playful?1.28:1)*(mode==='swim'?1.12:1);
 const gain=(calm?.78:playful?1.22:1);
 const phase=t*tempo;
 const poses={};
 // Incommensurate frequencies avoid the repetitive mechanical look.
 const slowBreath=sin(t*.31+.65),undulation=sin(t*.22+1.4);
 const happy=expression==='happy',curious=expression==='curious';
 const surprised=expression==='surprised';
 const shy=mode==='shy';
 for(let i=1;i<=10;i++){
  const k=i/10;
  // Phase propagates from root to tip, not all bones rotating together.
  const lag=(i-1)*.42;
  const main=sin(phase*1.28-lag+.20*sin(t*.27));
  const counter=sin(phase*.69-lag*.63+1.35);
  const lift=sin(phase*.86-lag*.83+1.08);
  const twist=sin(phase*.75-lag*1.05+2.1);
  const envelope=(.036+.056*k)*(1+.09*undulation);
  let x=envelope*.46*(.75*twist+.25*slowBreath);
  let y=envelope*(.80*main+.35*counter);
  let z=envelope*.72*(.84*lift+.20*sin(t*.47-lag*.35));
  // Gentle, alternating 3D wag and a more playful trailing tip.
  if(playful)y+=.020*(.4+.6*k)*sin(phase*2.0-lag*1.20);
  if(happy){
   y+=.023*(.5+.5*k)*sin(phase*2.25-lag*.93);
   z+=.009*sin(phase*1.4-lag*.9);
  }
  if(curious){
   y+=.014*(.4+.6*k)*sin(phase*.68-lag*.25);
   z+=.018*k; // Soft lift at the tip when listening.
  }
  if(shy){
   y+=.026*k;
   z+=.020*k; // Gently curls behind, without hard rotation changes.
  }
  // Short reactive ripple travels down the whole tail after a surprise.
  if(surprised && emotionAge<2.5){
   const after=Math.max(0,emotionAge-k*.11);
   const burst=Math.exp(-after*2.2)*sin(after*9);
   x+=.016*k*burst;y+=.060*k*burst;
  }
  if(mode==='knock'&&modeAge<2.2){
   const after=Math.max(0,modeAge-k*.10-.6);
   y+=.037*k*Math.exp(-after*3)*sin(after*11);
  }
  // The original baked Swim V4 animates the tail already; keep additive
  // contribution moderate to avoid over-bending or clipping.
  const swimGain=mode==='swim'?.86:1;
  const multiplier=intensity*gain*swimGain;
  const bound=.21;
  poses['Tail.'+String(i).padStart(2,'0')]=[
   limit(x*multiplier,-bound,bound),
   limit(y*multiplier,-bound,bound),
   limit(z*multiplier,-bound,bound)
  ];
 }
 return poses;
}
