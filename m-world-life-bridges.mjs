/**
 * V43 — organic, continuous physical intentions for the ORIGINAL V6 M.
 *
 * Complements V39 motion continuity / V40 emotion / V41 pose handoffs.
 * Reads only actual page-life signals (movement, action, attention, mood);
 * never chooses an action, resets the rig, alters depth, or owns navigation.
 */
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,finite(v,min)));
const approach=(value,target,dt,halfLife)=>value+(target-value)*(1-Math.pow(.5,dt/halfLife));
const neutral=()=>({mode:'quiet',pose:{},stage:{x:0,y:0,rx:0,ry:0,rz:0,scale:0},
 energy:0,tailFlow:0,engagement:0});
const names=['Tail.01','Tail.02','Tail.03','Tail.04','Tail.05',
 'Tail.06','Tail.07','Tail.08','Tail.09','Tail.10'];
export function lifeMode(mode='float',gesture=''){
 if(gesture==='sleep'||gesture==='think')return 'rest';
 if(gesture==='paw'||gesture==='hop'||gesture==='playful'||gesture==='wave')return 'play';
 if(gesture==='curious'||gesture==='nod')return 'observe';
 if(mode==='perch'||mode==='rest'||mode==='settle')return 'rest';
 if(mode==='peek'||mode==='inspect'||mode==='curious')return 'observe';
 if(mode==='orbit'||mode==='swim'||mode==='glide'||mode==='float')return 'explore';
 if(mode==='play'||mode==='spin'||mode==='dash')return 'play';
 return 'observe';
}
export function createLifeBridges(){
 let movement=0,curiosity=0,joy=0,rest=0,turnFast=0,turnSlow=0,
  gazeX=0,energy=0,mode='quiet',lastMode=null,frames=0,transitions=0,tailFlow=0;
 function reset(){
  movement=curiosity=joy=rest=turnFast=turnSlow=gazeX=energy=tailFlow=0;
  mode='quiet';lastMode=null;
 }
 function sample({
  dt=0,mode:activity='float',gesture=null,phase='hold',
  vx=0,vy=0,turn=0,attention={x:0,y:0},emotion='neutral',
  affect=null,characterEnergy=.65,attached=false,reading=false,
  reducedMotion=false
 }={}){
  if(reducedMotion){reset();return neutral();}
  const h=clamp(dt,0,.06),gestureName=typeof gesture==='string'?gesture:gesture?.name||'';
  if(!h)return neutral();
  const sleeping=gestureName==='sleep',kind=lifeMode(activity,gestureName);
  if(kind!==lastMode){if(lastMode!==null)transitions++;lastMode=kind;}
  const speed=clamp(Math.hypot(finite(vx),finite(vy))/170,0,1);
  const turning=clamp(turn,-1,1);
  const intensity=clamp(affect?.envelope,0,1);
  const feeling=typeof affect?.name==='string'&&intensity>.03?affect.name:emotion;
  const lively=['delight','joyful','happy','mischief','proud','anticipation'].includes(feeling);
  const exploring=kind==='explore'&&!sleeping&&!attached;
  const observing=kind==='observe'&&!sleeping;
  const playing=kind==='play'&&!sleeping&&!attached;
  const resting=kind==='rest'||sleeping||attached;
  const fatigue=clamp(characterEnergy,0,1);
  const suppression=reading?.35:1;
  // Independent time constants avoid a mode change becoming a full-body reset.
  movement=approach(movement,exploring?Math.max(.18,speed):playing?.42:0,h,.21);
  curiosity=approach(curiosity,observing?.78:exploring?.27:.08,h,.3);
  joy=approach(joy,playing?.75:lively?.36*intensity:.08,h,.28);
  rest=approach(rest,resting?1:0,h,.42);
  energy=approach(energy,fatigue,h,.5);
  gazeX=approach(gazeX,clamp(attention?.x,-1,1),h,.16);
  turnFast=approach(turnFast,turning,h,.13);
  turnSlow=approach(turnSlow,turning,h,.49);
  const delayedTurn=clamp(turnFast-turnSlow,-.9,.9);
  tailFlow=approach(tailFlow,playing?.78:exploring?.6:observing?.32:.12,h,.33);
  const restraint=(sleeping?0:attached?.22:1)*(gestureName?.58:1)*suppression;
  const curious=curiosity*restraint,play=joy*restraint,move=movement*restraint;
  const settle=rest*restraint;
  const head=[clamp(-.021*curious-.018*move+.013*settle,-.06,.06),
   clamp(.026*gazeX+.02*delayedTurn,-.065,.065),
   clamp(.018*curious+.011*play-.015*delayedTurn,-.06,.06)];
  const ear=clamp(.029*curious+.02*play-.015*settle, -.03,.07);
  const pose={
   Head:head,Neck:[head[0]*.44,head[1]*.43,head[2]*.4],
   Chest:[clamp(-move*.015+settle*.014,-.04,.04),0,clamp(-delayedTurn*.008,-.02,.02)],
   'Arm.L':[clamp(-play*.026+settle*.012,-.045,.045),0,clamp(play*.022,-.045,.045)],
   'Arm.R':[clamp(-play*.022+settle*.013,-.045,.045),0,clamp(-play*.023,-.045,.045)],
   'Ear.L':[-ear*.74,0,ear*.66],
   'Ear.R':[-ear*.59,0,-ear*.62]
  };
  // A real 10-joint tail: each segment receives a delayed, increasingly
  // flexible reaction from prior turning, excitement and gentle rest.
  // Damping in V41 preserves this pose AND its velocity across mode changes.
  for(let i=0;i<names.length;i++){
   const u=(i+1)/10;
   const momentum=-delayedTurn*(.008+.012*u)*(1+tailFlow*.25);
   const happy=play*(.003+.012*u),droop=-settle*.011*u;
   const curve=clamp((momentum+happy+droop)*restraint,-.035,.035);
   pose[names[i]]=[clamp(-settle*.005*u,-.012,.012),0,curve];
  }
  const stage={x:0,y:clamp(-settle*.003+play*.002,-.008,.008),
   rx:clamp(-move*.006+settle*.005,-.015,.015),
   ry:clamp(delayedTurn*.008*restraint,-.016,.016),
   rz:clamp((curious*.005-delayedTurn*.011)*restraint,-.025,.025),
   scale:clamp(play*.002-settle*.002,-.006,.006)};
  mode=kind;frames++;
  return {mode,pose:restraint?pose:{},stage:restraint?stage:neutral().stage,
   energy,tailFlow,engagement:clamp(curiosity+joy+movement,0,2)};
 }
 function snapshot(){return {mode,frames,transitions,movement,curiosity,joy,rest,tailFlow,
  lag:turnFast-turnSlow};}
 return {sample,reset,snapshot};
}
