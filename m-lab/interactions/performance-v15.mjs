/**
 * M V15 — readable character acting and staging.
 * Pure mathematical poses: keeps the Blender GLB and rig unchanged.
 * Apply body bone offsets through motion-v8 spring rig and stage offsets
 * through the existing stageRig springs.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const pulse=(age,delay=.08,width=.30)=>{
 const a=Math.max(0,age-delay);
 return Math.exp(-Math.pow((a-width)/Math.max(.04,width),2));
};
const smoothPulse=(age)=>Math.exp(-Math.max(0,age)*1.8)*Math.sin(Math.max(0,age)*7.6);
const add=(bones,name,x=0,y=0,z=0)=>{
 const b=bones[name]||(bones[name]=[0,0,0]);
 b[0]+=x;b[1]+=y;b[2]+=z;
};
/** Head/arms/ears/chest form character-readable body silhouettes. */
export function performanceBodyPoseV15({
 time=0,mode='float',expression='neutral',emotionAge=99,modeAge=99,
 pointer={x:0,y:0},impact=1
}={}){
 const t=Math.max(0,time),p=clamp(impact,0,1.6),bones={};
 const glance=Math.sin(t*.53+.7)*Math.sin(t*.21+.4);
 // A natural recurring curious head glance, rather than uniform rotation.
 add(bones,'Head',.021*Math.sin(t*.88),.049*glance,.015*Math.sin(t*.71));
 add(bones,'Neck',.018*Math.sin(t*.71),.015*glance);
 add(bones,'Ear.L',.017*Math.sin(t*1.8),0,.026*Math.sin(t*.85));
 add(bones,'Ear.R',.021*Math.sin(t*1.68+.6),0,-.022*Math.sin(t*.91));
 const reaction=smoothPulse(emotionAge);
 if(expression==='happy'){
  // Brisk but soft wave, lifted ears and small head bob.
  add(bones,'Head',-.16-.040*Math.sin(t*2.6),.055+.038*Math.sin(t*1.8),.095+.12*Math.sin(t*1.65));
  add(bones,'Neck',-.045,0,.041*Math.sin(t*1.7));
  add(bones,'Arm.L',-.065+.17*Math.sin(t*2.8),0,.15);
  add(bones,'Arm.R',-.055+.18*Math.sin(t*2.9+1.6),0,-.15);
  add(bones,'Forearm.L',.12+.09*Math.sin(t*2.8+.5),0,.04);
  add(bones,'Forearm.R',.11+.09*Math.sin(t*2.9+2.1),0,-.04);
  add(bones,'Ear.L',-.11,0,.11);add(bones,'Ear.R',-.11,0,-.11);
  add(bones,'Head',-.065*reaction,0,.07*reaction);
 }else if(expression==='curious'){
  // Asymmetric question-mark pose: one raised ear and a still, tilted head.
  add(bones,'Head',-.065,.13,.24);
  add(bones,'Neck',0,.065,.085);
  add(bones,'Chest',-.04,.03,.065);
  add(bones,'Arm.L',.11,0,.18);
  add(bones,'Forearm.L',.11,0,.08);
  add(bones,'Arm.R',-.08,0,-.055);
  add(bones,'Ear.L',-.15,0,.14);
  add(bones,'Ear.R',.045,0,-.065);
  add(bones,'Head',0,.10*reaction,.07*reaction);
 }else if(expression==='surprised'){
  // Readable silhouette: head recoil, ears perk, arms visibly open.
  add(bones,'Head',-.21,-.025,-.055);
  add(bones,'Neck',-.12,0,-.024);
  add(bones,'Chest',-.095,0,0);
  add(bones,'Arm.L',-.22,0,.25);
  add(bones,'Arm.R',-.22,0,-.25);
  add(bones,'Forearm.L',-.11,0,.12);
  add(bones,'Forearm.R',-.11,0,-.12);
  add(bones,'Ear.L',-.24,0,.16);
  add(bones,'Ear.R',-.24,0,-.16);
  add(bones,'Head',-.12*reaction,0,.015*reaction);
 }
 if(mode==='swim'){
  add(bones,'Chest',.045*Math.sin(t*2.1),.04*Math.sin(t*1.3));
  add(bones,'Arm.L',.075*Math.sin(t*2.6),0,.045*Math.sin(t*1.5));
  add(bones,'Arm.R',.075*Math.sin(t*2.6+Math.PI),0,-.045*Math.sin(t*1.5));
 }
 if(mode==='peek'){
  add(bones,'Head',-.045,.14,.10);
  add(bones,'Chest',0,.045,.095);
 }
 if(mode==='shy'){
  add(bones,'Head',.14,0,.1);
  add(bones,'Arm.L',.18,0,-.10);
  add(bones,'Arm.R',.18,0,.1);
 }
 if(mode==='follow'){
  add(bones,'Head',-clamp(pointer?.y,-1,1)*.10,clamp(pointer?.x,-1,1)*.16);
 }
 if(mode==='knock'){
  const bump=pulse(modeAge,.57,.22)+pulse(modeAge,1.08,.2);
  add(bones,'Head',-.12*bump,0,.08*bump);
  add(bones,'Arm.R',-.20*bump,0,-.09*bump);
 }
 for(const angles of Object.values(bones))
  for(let i=0;i<3;i++)angles[i]=p===0?0:angles[i]*p;
 return bones;
}

/** Whole-character, small silhouette motion, blended by existing springs. */
export function performanceStagePoseV15({
 time=0,mode='float',modeAge=99,expression='neutral',emotionAge=99,impact=1,
 reducedMotion=false
}={}){
 const t=Math.max(0,time),k=clamp(impact,0,1.6)*(reducedMotion?.2:1);
 const p={x:0,y:0,z:0,rx:0,ry:0,rz:0,scale:0};
 if(k===0)return p;
 // A bit of buoyancy avoids the "floating statue" look.
 p.y=.03*Math.sin(t*1.32);
 p.rz=.022*Math.sin(t*.74);
 const bounce=Math.exp(-Math.max(0,emotionAge)*2.4)*Math.sin(Math.max(0,emotionAge)*7.2);
 if(expression==='happy'){
  p.y+=.095*Math.sin(t*2.35)+.075*bounce;
  p.rz+=.10*Math.sin(t*1.6);
  p.ry+=.09*Math.sin(t*.9);
  p.scale+=.022*Math.sin(t*2.4);
 }else if(expression==='curious'){
  p.x+=.07;p.y+=.05;
  p.ry+=.17;p.rz+=.13;
  p.rx-=.055;
  p.rz+=.035*Math.sin(t*1.2);
 }else if(expression==='surprised'){
  p.y+=.13+.17*Math.exp(-Math.max(0,emotionAge)*2.9);
  p.z+=.13;
  p.rx-=.11;
  p.scale+=.052*Math.exp(-Math.max(0,emotionAge)*2.8);
 }
 if(mode==='swim'){
  p.rx+=.075*Math.sin(t*2.1);
  p.rz+=.10*Math.sin(t*.9);
  p.y+=.055*Math.sin(t*2.2);
 }
 if(mode==='shy')p.rz-=.10;
 if(mode==='peek')p.ry-=.085;
 if(mode==='knock'){
  const bump=pulse(modeAge,.6,.20)+pulse(modeAge,1.16,.20);
  p.z+=.11*bump;p.rx+=.08*bump;
 }
 for(const key of ['x','y','z','rx','ry','rz','scale'])p[key]=p[key]*k;
 return p;
}
