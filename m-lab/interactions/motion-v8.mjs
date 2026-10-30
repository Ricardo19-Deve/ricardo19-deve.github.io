import {smoothSpring,createSpring,transitionFrequency} from './fluid-v8.mjs';
import {tailPoseV15} from './tail-v15.mjs';
import {performanceBodyPoseV15} from './performance-v15.mjs';

/**
 * M V8 fluid secondary-body motion layer.
 * Fluid springs drive rotations AFTER the baked GLB clip is evaluated.
 * Never changes morph targets, clip tracks or the original rig/skin data.
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
const wave=(t,speed,phase=0)=>Math.sin(t*speed+phase);
const bump=(t,at,width)=>Math.exp(-Math.pow((t-at)/width,2));

/** Pure pose evaluator: values are local additive Euler angles in radians. */
export function motionPose({time=0,modeAge=0,emotionAge=999,mode='float',expression='neutral',pointer={x:0,y:0},energy=.7,tailEnergy=1.1,tailReactivity=1.5,tailStyle='organic',tailFlow=.73,performanceImpact=1.12,bodyMotion={},swimWeight=0}={}) {
 const e=clamp(energy,0,1.3),t=Math.max(0,time),p={x:clamp(pointer?.x,-1,1),y:clamp(pointer?.y,-1,1)};
 const bones={};
 const add=(name,x=0,y=0,z=0)=>{
  const a=bones[name]||(bones[name]=[0,0,0]);
  a[0]+=x;a[1]+=y;a[2]+=z;
 };
 // Subtle asymmetry keeps the character alive even without the swim clip.
 const breath=Math.sin(t*1.55);
 add('Chest',.023*breath,.021*wave(t,.9),.022*wave(t,1.18));
 add('Body',.018*breath,.01*wave(t,.55),.015*wave(t,.77));
 add('Neck',.03*wave(t,.85),.022*wave(t,1.4));
 add('Head',.034*wave(t,.8),.05*wave(t,.61,.6),.038*wave(t,.72,1.1));
 add('Ear.L',.025*wave(t,2.1),0,.065*wave(t,1.3));
 add('Ear.R',.03*wave(t,2.05,.35),0,-.058*wave(t,1.2,.25));
 add('EarTip.L',.04*wave(t,2.6,.5),0,.045*wave(t,1.6));
 add('EarTip.R',.04*wave(t,2.4,1.1),0,-.04*wave(t,1.65));
 add('Arm.L',.11*wave(t,1.65),0,.07*wave(t,1.1));
 add('Arm.R',.10*wave(t,1.65,1.6),0,-.075*wave(t,1.07,.8));
 add('Forearm.L',.07*wave(t,1.7,.5),0,.025*wave(t,.9));
 add('Forearm.R',.075*wave(t,1.73,1.8),0,-.03*wave(t,.95));
 add('Leg.L',.045*wave(t,1.25),0,.025*wave(t,1.4));
 add('Leg.R',.055*wave(t,1.2,1.3),0,-.025*wave(t,1.35,.6));
 // Deliberate full-body acting poses replace the old small facial gestures.
 // All are smoothly blended by bone springs downstream.
 const acting=performanceBodyPoseV15({time:t,mode,expression,emotionAge,modeAge,
  pointer:p,impact:performanceImpact});
 for(const [bone,rotation] of Object.entries(acting))add(bone,...rotation);
 if(mode==='curious') {
  add('Head',-.035,p.x*.16,.12);
  add('Neck',0,p.x*.06,.04);
 }
 if(mode==='peek') {
  add('Head',0,.10,-.17);add('Chest',0,.055,-.08);
  add('Arm.L',.12,0,.10);add('Arm.R',-.07,0,-.11);
 }
 if(mode==='follow') {
  add('Head',-p.y*.16,p.x*.22,p.x*.08);
  add('Neck',-p.y*.05,p.x*.06);
  add('Ear.L',p.y*.04);add('Ear.R',p.y*.04);
 }
 if(mode==='shy') {
  add('Head',.14,0,.09);add('Neck',.06,0,.06);
  add('Ear.L',.18,0,-.10);add('Ear.R',.18,0,.10);
  add('Arm.L',.22,0,-.20);add('Arm.R',.22,0,.20);
  // Tail tuck is controlled exclusively by tail-v9 so the intensity slider remains authoritative.
 }
 if(mode==='knock') {
  const hit=bump(modeAge,.75,.16)+bump(modeAge,1.23,.16);
  add('Arm.R',-.3*hit,0,-.2*hit);
  add('Forearm.R',.4*hit,0,.10*hit);
  add('Hand.R',.13*hit);
  add('Head',-.06*hit,0,.03*hit);
 }
 // Body response is driven by its own energy slider. V10 tail uses the
 // same global master energy, but independent base and emotion amplitudes,
 // without the old .7 Swim penalty that hid it during swimming.
 const damp=mode==='swim'?.7:1;
 for(const a of Object.values(bones))for(let i=0;i<3;i++)a[i]=e===0?0:a[i]*e*damp;
 const headTurn=bones.Head?.[1]||0;
 const tail=tailPoseV15({time:t,mode,modeAge,expression,emotionAge,
  pointer:p,headTurn,bodyMotion,swimWeight,
  style:tailStyle,amount:tailEnergy,reactivity:tailReactivity,flow:tailFlow,performance:performanceImpact});
 for(const [name,angles] of Object.entries(tail))
  bones[name]=angles.map(angle=>e===0?0:angle*e);
 return bones;
}

/**
 * Stores an exact inverse for every additive rotation. Call prepare() BEFORE
 * AnimationMixer.update(), then update() AFTER, so unanimated bones never
 * accumulate procedural rotations across frames, even with partial clips.
 */
/**
 * The actual THREE r184 PropertyBinding.sanitizeNodeName strips dots.
 *   "Tail.01" -> "Tail01"; "Ear.L" -> "EarL".
 * Keep original imported bone objects/names for AnimationMixer bindings.
 * Resolve only our separate procedural motion target names.
 *
 * Also accept _ and . variants for GLBs produced by other exporters.
 */
export function canonicalBoneName(rawName){
 const name=String(rawName||'');
 const compact=name.replace(/[._\s-]/g,'');
 if(/^Tail\d{1,2}$/i.test(compact)){
  const segment=Number(compact.slice(4));
  if(segment>=1&&segment<=10)
   return 'Tail.'+String(segment).padStart(2,'0');
 }
 const stems=['EarTip','Forearm','Shoulder','Hand','Foot','Arm','Leg','Ear'];
 for(const stem of stems){
  for(const side of ['L','R'])
   if(compact.toLowerCase()===(stem+side).toLowerCase())
    return stem+'.'+side;
 }
 return name;
}

export function createMotionV8(root,THREE){
 const bones=new Map(),rest=new Map(),states=new Map(),originalNames=new Map();
 const extra=new THREE.Quaternion(),inverse=new THREE.Quaternion(),angles=new THREE.Euler();
 root.traverse(o=>{
  if(!o.isBone)return;
  const canonical=canonicalBoneName(o.name);
  if(bones.has(canonical)&&bones.get(canonical)!==o)
   throw new Error('Duplicate canonical bone name: '+canonical);
  bones.set(canonical,o);
  originalNames.set(canonical,o.name);
  rest.set(canonical,o.quaternion.clone());
  states.set(canonical,{
   angles:[createSpring(),createSpring(),createSpring()],
   applied:new THREE.Quaternion()
  });
 });
 let time=0,modeAge=0,emotionAge=999,priorMode=null,priorEmotion=null;
 let isApplied=false;
 let lastTailBend=0;
 function prepare(){
  if(!isApplied)return;
  for(const [name,bone] of bones){
   inverse.copy(states.get(name).applied).invert();
   bone.quaternion.multiply(inverse);
   states.get(name).applied.identity();
  }
  isApplied=false;
 }
 function reset(){
  prepare();time=0;modeAge=0;emotionAge=999;priorMode=null;priorEmotion=null;
  for(const [name,bone] of bones){
   bone.quaternion.copy(rest.get(name));
   const state=states.get(name);
   for(const angle of state.angles){angle.value=0;angle.velocity=0;}
   state.applied.identity();
  }
 }
 return {
  get availableBones(){return bones.size;},
  get tailDiagnostics(){
   const tailNames=[...bones.keys()].filter(n=>n.startsWith('Tail.')&&Number.isInteger(Number(n.slice(5))));
   const renamed=tailNames.map(n=>({expected:n,loaded:originalNames.get(n)}));
   return {
    connected:tailNames.length,
    mapped:renamed,
    maxBend:lastTailBend,
    animationAxes:'X/Z bend, Y twist'
   };
  },
  prepare,reset,
  update(dt,{mode='float',expression='neutral',pointer={x:0,y:0},energy=.7,
              clipActive=false,smoothness=.75,tailEnergy=1.1,tailReactivity=1.5,tailStyle='organic',tailFlow=.73,performanceImpact=1.12,bodyMotion={},swimWeight=0}={}){
   dt=Math.max(0,Math.min(.075,dt));time+=dt;
   if(mode!==priorMode){modeAge=0;priorMode=mode;}else modeAge+=dt;
   if(expression!==priorEmotion){emotionAge=0;priorEmotion=expression;}else emotionAge+=dt;
   const poses=motionPose({time,modeAge,emotionAge,mode,expression,pointer,energy,tailEnergy,tailReactivity,tailStyle,tailFlow,performanceImpact,bodyMotion,swimWeight});
   const baseFrequency=transitionFrequency(smoothness);
   lastTailBend=0;
   for(const [name,bone] of bones){
    const state=states.get(name),desired=poses[name]||[0,0,0];
    const tail=name.startsWith('Tail.')?Number(name.slice(5)):0;
    const tip=tail>0?(tail-1)/9:0;
    const fluid=clamp(tailFlow,0,1);
    // Root reacts first (fast but controlled), while each successive
    // joint settles more slowly and swings softly past the target.
    const speed=tail>0?(10.8-4.4*tip*fluid):baseFrequency*
      (/EarTip/.test(name)?.68:/Forearm|Hand/.test(name)?.76:1);
    const damping=tail>0?(0.92-0.23*tip*fluid):
      (/EarTip|Forearm/.test(name)?.86:.97);
    let target=desired;
    // Transfer a small amount of parent angular momentum to the next joint.
    // This is additive over the mathematically delayed traveling-wave target.
    // It is disabled whenever both tail amplitude controls are at zero.
    if(tail>1&&energy>0&&(tailEnergy>0||tailReactivity>0)){
      const parent=states.get('Tail.'+String(tail-1).padStart(2,'0'));
      if(parent){
        const follow=0.030*fluid;
        target=[
          desired[0]+clamp(parent.angles[0].velocity*follow,-.025,.025),
          desired[1],
          desired[2]+clamp(parent.angles[2].velocity*follow,-.025,.025)
        ];
      }
    }
    const x=smoothSpring(state.angles[0],target[0],dt,speed,damping);
    const y=smoothSpring(state.angles[1],target[1],dt,speed,damping);
    const z=smoothSpring(state.angles[2],target[2],dt,speed,damping);
    if(tail>0)lastTailBend=Math.max(lastTailBend,Math.hypot(x,z));
    // For a GLB without a baked body clip, start from unmodified rest pose.
    if(!clipActive)bone.quaternion.copy(rest.get(name));
    angles.set(x,y,z,'XYZ');
    extra.setFromEuler(angles);
    bone.quaternion.multiply(extra);
    state.applied.copy(extra);
   }
   isApplied=true;
  }
 };
}
