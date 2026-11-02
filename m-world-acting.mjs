/** Expressive V6 acting: bounded local Euler offsets; no rig or asset changes. */
export const M_GESTURES=Object.freeze(['wave','curious','surprised','shy']);
export const GESTURE_DURATIONS=Object.freeze({wave:3.1,curious:3.6,surprised:2.25,shy:3.3});
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const smooth=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
const rise=(p,a,b)=>smooth((p-a)/(b-a));
const window=(p,a,b,c,d)=>rise(p,a,b)*(1-rise(p,c,d));
const pulse=(p,a,b,c)=>window(p,a,b,b,c);
const phases=Object.freeze({wave:[.19,.72],curious:[.22,.75],surprised:[.12,.49],shy:[.23,.73]});
const expressions=Object.freeze({wave:'happy',curious:'curious',surprised:'surprised',shy:'neutral'});

/**
 * age is elapsed seconds. Every channel has zero value and velocity at the
 * boundaries. Parent joints lead; ears, forearms and wrists settle later.
 * side=1 leads with the left arm; side=-1 leads with the right arm.
 */
export function sampleGesture({name,age=0,side=1,reducedMotion=false}={}){
 const valid=M_GESTURES.includes(name),duration=valid?GESTURE_DURATIONS[name]:0;
 const active=valid&&!reducedMotion&&Number.isFinite(age)&&age>0&&age<duration;
 const progress=duration?clamp(age/duration):0;
 const empty={name:valid?name:null,duration,progress,phase:age>=duration&&valid?'complete':'idle',envelope:0,expression:'neutral',pose:{}};
 if(!active)return empty;
 const p=progress,s=side<0?-1:1,lead=s>0?'L':'R',other=s>0?'R':'L',pose={};
 const add=(bone,x=0,y=0,z=0)=>{pose[bone]=[x,y,z].map(v=>clamp(v,-.9,.9));};
 const [anticipationEnd,actionEnd]=phases[name];
 const envelope=window(p,0,.13,.79,1);
 const phase=p<anticipationEnd?'anticipation':p<actionEnd?'action':'recovery';
 if(name==='wave'){
  const coil=pulse(p,0,.12,.29),lift=window(p,.07,.29,.71,.98);
  const greeting=window(p,.22,.32,.65,.80),swing=Math.sin((p-.27)*Math.PI*9.8);
  const wristSwing=Math.sin((p-.29)*Math.PI*9.8),lag=window(p,.13,.33,.75,1);
  add('Body',.028*coil-.022*lift,0,-s*.025*lift);
  add('Chest',.035*coil-.035*lift,s*.045*lift,-s*.035*lift);
  add('Head',-.075*lift,s*.055*lift,s*(.095*lift+.018*greeting*swing));
  add('Neck',-.022*lift,0,s*.026*lag);
  // A compact shoulder lift; elbow and wrist carry the visible greeting.
  add('Arm.'+lead,.045*coil-.17*lift,s*.025*lift,-s*.16*lift);
  add('Forearm.'+lead,s*(.31*lag+.20*greeting*swing),s*.045*lag,-s*(.62*lag+.08*greeting*swing));
  add('Hand.'+lead,s*.07*lag,s*.17*greeting*wristSwing,-s*.31*greeting*wristSwing);
  add('Arm.'+other,.025*lift,0,-s*.035*lift);
  add('Ear.'+lead,-.085*lag,0,s*.06*lag);
  add('Ear.'+other,-.045*lift,0,-s*.028*lift);
  add('EarTip.'+lead,.035*lag,0,s*.035*greeting*wristSwing);
 }else if(name==='curious'){
  const notice=pulse(p,0,.13,.33),lean=window(p,.10,.35,.72,.98);
  const inspect=window(p,.22,.39,.65,.91),second=pulse(p,.43,.57,.76);
  const ear=window(p,.16,.37,.76,1),reach=window(p,.29,.44,.64,.91);
  add('Body',-.055*lean,s*.035*lean,s*.025*lean);
  add('Chest',-.075*lean,s*.06*inspect,s*.055*lean);
  add('Neck',-.015*notice+.032*inspect,s*.055*inspect,s*.055*ear);
  add('Head',-.075*notice+.085*inspect-.045*second,s*(.18*inspect-.13*second),s*(.21*lean-.07*second));
  add('Arm.'+lead,-.095*reach,0,-s*.075*reach);
  add('Forearm.'+lead,s*.23*reach,s*.04*reach,-s*.28*reach);
  add('Hand.'+lead,s*.08*reach,0,-s*.12*reach);
  add('Ear.'+lead,-.14*ear,0,s*.09*ear);
  add('Ear.'+other,.055*inspect,0,-s*.035*ear);
  add('EarTip.'+lead,-.055*window(p,.22,.43,.8,1),0,s*.04*second);
 }else if(name==='surprised'){
  const gather=pulse(p,0,.075,.19),recoil=window(p,.07,.22,.40,.87);
  const settle=pulse(p,.40,.60,.94),ears=window(p,.11,.25,.56,1);
  add('Body',.035*gather-.055*recoil+.018*settle);
  add('Chest',.03*gather-.085*recoil+.025*settle);
  add('Neck',.025*gather-.085*recoil);
  add('Head',.045*gather-.24*recoil+.055*settle,-s*.035*recoil,-s*.045*recoil);
  for(const [suffix,sign]of [['L',1],['R',-1]]){
   add('Arm.'+suffix,.035*gather-.13*recoil,0,sign*.13*recoil);
   add('Forearm.'+suffix,-sign*.20*recoil,0,sign*.17*recoil);
   add('Hand.'+suffix,-sign*.07*recoil,0,sign*.12*recoil);
   add('Ear.'+suffix,-.19*ears,0,sign*.12*ears);
   add('EarTip.'+suffix,.07*window(p,.17,.30,.63,1));
  }
 }else if(name==='shy'){
  const glance=pulse(p,0,.14,.34),tuck=window(p,.12,.36,.70,.98);
  const peek=pulse(p,.45,.59,.77),hands=window(p,.19,.41,.74,1);
  add('Body',.045*tuck,0,-s*.025*tuck);
  add('Chest',.055*tuck,-s*.025*tuck,s*.035*tuck);
  add('Neck',.055*tuck,-s*.035*glance,s*.035*tuck);
  add('Head',.22*tuck-.075*peek,-s*(.095*glance-.10*peek),s*(.12*tuck-.04*peek));
  for(const [suffix,sign]of [['L',1],['R',-1]]){
   add('Arm.'+suffix,.11*tuck,0,sign*.075*tuck);
   add('Forearm.'+suffix,sign*.30*hands,0,-sign*.24*hands);
   add('Hand.'+suffix,sign*.12*hands,0,-sign*.10*hands);
   add('Ear.'+suffix,.15*window(p,.17,.39,.76,1),0,-sign*.085*tuck);
   add('EarTip.'+suffix,.085*window(p,.25,.46,.80,1));
  }
 }
 return {name,duration,progress,phase,envelope,expression:expressions[name],pose};
}

/**
 * Same reversible additive contract as motion-v8: remove our exact previous
 * quaternion BEFORE motion.prepare()/mixer.update(), then apply AFTER base
 * motion. Storing the rotation avoids rest-pose resets and partial-clip drift.
 * bones is the renderer's canonical-name Map of original V6 bone objects.
 */
export function createGestureLayer(bones,THREE){
 const applied=new Map(),angles=new THREE.Euler(),rotation=new THREE.Quaternion(),inverse=new THREE.Quaternion();
 function prepare(){
  for(const [name,offset]of applied){
   const bone=bones.get(name);if(bone)bone.quaternion.multiply(inverse.copy(offset).invert());
  }
  applied.clear();
 }
 function apply(pose={}){
  prepare();
  for(const [name,value]of Object.entries(pose)){
   const bone=bones.get(name);if(!bone||!Array.isArray(value)||value.length!==3||!value.every(Number.isFinite))continue;
   angles.set(...value.map(v=>clamp(v,-.9,.9)),'XYZ');rotation.setFromEuler(angles);
   bone.quaternion.multiply(rotation);applied.set(name,rotation.clone());
  }
 }
 return {prepare,apply};
}