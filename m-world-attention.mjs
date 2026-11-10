/** Continuous presentation for the original rig/HAT channels. No action ownership,
 * DOM reads, iris geometry, storage, clocks, network or per-frame randomness.
 * Inputs are normalized attention [-1,1] and the shared physical character state.
 */
const clamp=(value,lo=0,hi=1,fallback=0)=>Math.min(hi,Math.max(lo,Number.isFinite(value)?value:fallback));
const smooth=value=>{const t=clamp(value);return t*t*t*(t*(t*6-15)+10);};
const stepTime=value=>Number.isFinite(value)&&value>=0?Math.min(value,.06):0;
function randomSource(seed){
 let value=0x6d2b79f5;
 if(Number.isFinite(seed))value=Math.trunc(seed)>>>0;
 else if(typeof seed==='string')for(let i=0;i<seed.length;i++)value=Math.imul(value^seed.charCodeAt(i),16777619)>>>0;
 if(!value)value=0x6d2b79f5;
 return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};
}
const asleep=state=>state?.intent==='sleep';

/** Reused result; phase marks genuine target changes and bounded offset returns.
 * blinkHold defers a NEW automatic blink while the gaze is shifting.
 * Explicit gestures, actual sleep, blocked input and reduced motion own the rig.
 */
export function createAttentionDirector({seed}={}){
 const random=randomSource(seed),attention={x:0,y:0};
 const output={attention,phase:'idle',shiftId:0,blinkHold:false};
 let clock=0,vx=0,vy=0,hasTarget=false,lastKey=null,anticipationEnd=0,settleEnd=0,
  nextGlance=Infinity,glanceStart=-1,glanceDuration=0,offsetX=0,offsetY=0;
 function schedule(focus){nextGlance=clock+3+5*random()*(.55+.45*focus);}
 function clear(phase){
  attention.x=attention.y=vx=vy=0;output.phase=phase;output.blinkHold=phase!=='idle';
  hasTarget=false;lastKey=null;nextGlance=Infinity;glanceStart=-1;anticipationEnd=settleEnd=0;
  return output;
 }
 function sample({dt=0,target=null,targetId=null,performance=null,gestureActive=false,reducedMotion=false}={}){
  const step=stepTime(dt);clock+=step;
  if(reducedMotion)return clear('reduced');
  if(!Number.isFinite(dt)||dt<0||performance?.blocked)return clear('blocked');
  if(asleep(performance))return clear('sleep');
  if(gestureActive)return clear('gesture');
  if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return clear('idle');
  const focus=clamp(performance?.focus,0,1,.35),energy=clamp(performance?.energy,0,1,.7),reading=performance?.reading===true;
  const key=typeof targetId==='string'||Number.isFinite(targetId)?targetId:null;
  if(!hasTarget||key!==lastKey){
   hasTarget=true;lastKey=key;output.shiftId++;anticipationEnd=clock+.22;settleEnd=anticipationEnd+.30;
   glanceStart=-1;if(reading)nextGlance=Infinity;else schedule(focus);
  }
  if(reading){glanceStart=-1;nextGlance=Infinity;}
  else if(nextGlance===Infinity&&glanceStart<0)schedule(focus);
  if(!reading&&glanceStart<0&&clock>=nextGlance){
   glanceStart=nextGlance;glanceDuration=.65+.55*random();
   const amplitude=1-.45*focus;
   offsetX=(random()*2-1)*.08*amplitude;offsetY=(random()*2-1)*.04*amplitude;
   output.shiftId++;anticipationEnd=0;settleEnd=glanceStart+glanceDuration+.30;
  }
  let envelope=0;
  if(glanceStart>=0){
   const age=clock-glanceStart;
   if(age>=glanceDuration){glanceStart=-1;schedule(focus);}
   else envelope=smooth(age/.18)*(1-smooth((age-(glanceDuration-.30))/.30));
  }
  const tx=clamp(target.x+offsetX*envelope,-1,1),ty=clamp(target.y+offsetY*envelope,-1,1);
  // Exact critically damped integration retains velocity across moving targets.
  const omega=10+3*energy,e=Math.exp(-omega*step);
  const dx=attention.x-tx,cx=(vx+omega*dx)*step,dy=attention.y-ty,cy=(vy+omega*dy)*step;
  attention.x=clamp(tx+(dx+cx)*e,-1,1);attention.y=clamp(ty+(dy+cy)*e,-1,1);
  vx=(vx-omega*cx)*e;vy=(vy-omega*cy)*e;
  output.phase=reading?'tracking':glanceStart>=0?'glance':clock<anticipationEnd?'anticipation':clock<settleEnd?'settling':'tracking';
  output.blinkHold=output.phase==='anticipation'||output.phase==='glance';
  return output;
 }
 return {sample};
}

const CLOSE=.075,CONTACT=.045,OPEN=.170,LAG=.008,CYCLE=CLOSE+CONTACT+OPEN+LAG;
function closure(age){
 if(age<=0||age>=CLOSE+CONTACT+OPEN)return 0;
 if(age<CLOSE)return smooth(age/CLOSE);
 if(age<CLOSE+CONTACT)return 1;
 return 1-smooth((age-CLOSE-CONTACT)/OPEN);
}

/** Reused blink is null between cycles: resting/gesture lids remain authoritative.
 * Pass the FULL attention-director result for contextual settling, not its vector.
 * cycles counts completed binocular cycles; cancelled gestures never count.
 * Single cycles are intentional; no repeated/double blink scheduler is added.
 */
export function createContextBlink({seed}={}){
 const random=randomSource(seed),lids={left:0,right:0},output={blink:null,phase:'idle',cycles:0};
 let clock=0,nextDue=NaN,started=-Infinity,lastStart=-Infinity,lastShift=null,
  pendingShift=false,shiftAt=0;
 function interval(state){
  const focus=clamp(state?.focus,0,1,.35),energy=clamp(state?.energy,0,1,.7);
  return 3+4.5*clamp(random()*.80+focus*.20-(1-energy)*.10);
 }
 function clear(phase){
  output.blink=null;output.phase=phase;lids.left=lids.right=0;
  started=-Infinity;nextDue=NaN;pendingShift=false;return output;
 }
 function sample({dt=0,performance=null,attention=null,gestureActive=false,reducedMotion=false}={}){
  const step=stepTime(dt);clock+=step;
  const shift=Number.isSafeInteger(attention?.shiftId)&&attention.shiftId>=0?attention.shiftId:null;
  if(reducedMotion){lastShift=shift;return clear('reduced');}
  if(!Number.isFinite(dt)||dt<0||performance?.blocked){lastShift=shift;return clear('blocked');}
  if(asleep(performance)){lastShift=shift;return clear('sleep');}
  if(gestureActive){lastShift=shift;return clear('gesture');}
  if(Number.isNaN(nextDue))nextDue=clock-step+interval(performance);
  if(shift!==null&&lastShift!==null&&shift!==lastShift){pendingShift=true;shiftAt=clock;}
  lastShift=shift;
  if(performance?.reading===true||clock-shiftAt>.8)pendingShift=false;
  const settled=attention?.phase==='settling'||attention?.phase==='tracking';
  const hold=attention?.blinkHold===true;
  if(started===-Infinity&&!hold&&clock-lastStart>=1.8&&
   (clock>=nextDue||pendingShift&&settled)){
   // A gaze hold may leave the deadline far behind the current frame. Begin
   // visibly on release instead of counting a blink that happened in the past.
   started=pendingShift&&settled?clock:Math.max(nextDue,lastStart+1.8,clock-step);lastStart=started;pendingShift=false;
  }
  if(started!==-Infinity){
   const age=clock-started;
   if(age>=CYCLE){
    output.cycles++;nextDue=started+interval(performance);started=-Infinity;
    output.blink=null;output.phase='idle';lids.left=lids.right=0;
   }else{
    lids.left=closure(age);lids.right=closure(age-LAG);output.blink=lids;
    output.phase=age<CLOSE+LAG?'closing':age<CLOSE+CONTACT?'contact':'opening';
   }
  }else{output.blink=null;output.phase=hold?'waiting':'idle';}
  return output;
 }
 return {sample};
}

/** Existing authored affect wins unchanged (apart from validity/weight budget).
 * New physical-state base uses ONLY original happy/curious/surprised/HAT targets.
 * Without performance this remains an authored affect/micro-face passthrough.
 */
export function createFacialTargetMixer(){
 const weights={happy:0,curious:0,surprised:0},eyelids={left:0,right:0},output={weights,eyelids};
 function normalize(){
  const sum=weights.happy+weights.curious+weights.surprised;
  if(sum>1){weights.happy/=sum;weights.curious/=sum;weights.surprised/=sum;}
 }
 function copy(face){
  weights.happy=clamp(face?.weights?.happy);weights.curious=clamp(face?.weights?.curious);weights.surprised=clamp(face?.weights?.surprised);
  eyelids.left=clamp(face?.eyelids?.left,0,.55);eyelids.right=clamp(face?.eyelids?.right,0,.55);normalize();return output;
 }
 function sample({performance=null,microFace=null,affect=null,gestureActive=false,reducedMotion=false}={}){
  if(reducedMotion||gestureActive||performance?.blocked||asleep(performance))return null;
  if(Number.isFinite(affect?.envelope)&&affect.envelope>.04)return copy(affect);
  if(!performance)return microFace?copy(microFace):null;
  const intent=performance.intent,energy=clamp(performance.energy,0,1,.7),focus=clamp(performance.focus),
   arousal=clamp(performance.arousal),valence=clamp(performance.valence,-1,1),positive=Math.max(0,valence);
  weights.happy=weights.curious=weights.surprised=0;eyelids.left=eyelids.right=0;
  if(intent==='play'||intent==='social'){weights.happy=.24+.38*positive;weights.curious=.12*focus;}
  else if(intent==='investigate'||intent==='observe'||intent==='think'){weights.curious=.12+.48*focus;weights.happy=.08*positive;}
  else if(intent==='reflect'){
   if(performance.mood==='happy')weights.happy=.14+.40*positive;
   else weights.curious=.10+.30*focus;
  }else if(intent==='wake'||intent==='recover')weights.happy=.10*positive;
  if(performance.mood==='surprised')weights.surprised=.12+.30*arousal;
  const resting=intent==='recover'||intent==='idle'||intent==='wake';
  if(resting){const tired=.35*clamp((.55-energy)/.55);eyelids.left=tired;eyelids.right=Math.max(0,tired-.02*(1-energy));}
  if(microFace){
   const mix=intent==='play'?.6:.3,keep=1-mix;
   weights.happy=weights.happy*keep+clamp(microFace.weights?.happy)*mix;
   weights.curious=weights.curious*keep+clamp(microFace.weights?.curious)*mix;
   weights.surprised=weights.surprised*keep+clamp(microFace.weights?.surprised)*mix;
   eyelids.left=eyelids.left*keep+clamp(microFace.eyelids?.left,0,.55)*mix;
   eyelids.right=eyelids.right*keep+clamp(microFace.eyelids?.right,0,.55)*mix;
  }
  if(resting){
   eyelids.left=Math.min(.35,eyelids.left);eyelids.right=Math.min(.35,eyelids.right);
   const mean=(eyelids.left+eyelids.right)/2;
   eyelids.left=clamp(eyelids.left,Math.max(0,mean-.02),mean+.02);eyelids.right=clamp(eyelids.right,Math.max(0,mean-.02),mean+.02);
  }
  if(performance.reading===true){weights.happy*=.62;weights.curious*=.62;weights.surprised*=.62;}
  normalize();return output;
 }
 return {sample};
}
