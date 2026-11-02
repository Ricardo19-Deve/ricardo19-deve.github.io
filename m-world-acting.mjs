/** Expressive V6 acting: bounded local Euler offsets; no rig or asset changes. */
export const M_GESTURES=Object.freeze(['wave','curious','surprised','shy','playful','wink','nod']);
export const GESTURE_DURATIONS=Object.freeze({wave:3.1,curious:3.6,surprised:2.25,shy:3.3,playful:3.7,wink:2.5,nod:2.8});
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const smooth=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
const rise=(p,a,b)=>smooth((p-a)/(b-a));
const window=(p,a,b,c,d)=>rise(p,a,b)*(1-rise(p,c,d));
const pulse=(p,a,b,c)=>window(p,a,b,b,c);
export const GESTURE_PHASES=Object.freeze(Object.fromEntries(Object.entries({wave:[.19,.72],curious:[.22,.75],surprised:[.12,.49],shy:[.23,.73],playful:[.20,.73],wink:[.23,.65],nod:[.22,.73]}).map(([name,bounds])=>[name,Object.freeze(bounds)])));
const expressions=Object.freeze({wave:'happy',curious:'curious',surprised:'surprised',shy:'neutral',playful:'happy',wink:'happy',nod:'happy'});

/**
 * age is elapsed seconds. Every channel has zero value and velocity at the
 * boundaries. Parent joints lead; ears, forearms and wrists settle later.
 * side=1 leads with the left arm; side=-1 leads with the right arm.
 */
export function sampleGesture({name,age=0,side=1,reducedMotion=false}={}){
 const valid=M_GESTURES.includes(name),duration=valid?GESTURE_DURATIONS[name]:0;
 const active=valid&&!reducedMotion&&Number.isFinite(age)&&age>0&&age<duration;
 const progress=duration?clamp(age/duration):0;
 const empty={name:valid?name:null,duration,progress,phase:age>=duration&&valid?'complete':'idle',envelope:0,expression:'neutral',pose:{},blink:null};
 if(!active)return empty;
 const p=progress,s=side<0?-1:1,lead=s>0?'L':'R',other=s>0?'R':'L',pose={};
 const add=(bone,x=0,y=0,z=0)=>{pose[bone]=[x,y,z].map(v=>clamp(v,-.9,.9));};
 let blink=null;
 const [anticipationEnd,actionEnd]=GESTURE_PHASES[name];
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
 }else if(name==='playful'){
  // A curious little creature coils, offers a fin, then answers its own
  // sideways feint. The second beat is smaller, with the tail arriving last.
  const coil=pulse(p,0,.13,.30),lift=window(p,.10,.30,.69,.98);
  const first=pulse(p,.20,.35,.58),answer=pulse(p,.45,.61,.83),feint=first-.68*answer;
  const fins=window(p,.18,.37,.66,.94),tips=window(p,.25,.43,.73,1);
  add('Body',.035*coil-.026*lift,s*.028*feint,-s*.035*feint);
  add('Chest',.045*coil-.040*lift,s*.065*feint,-s*.055*feint);
  add('Neck',-.025*lift,s*.035*feint,s*.040*feint);
  add('Head',-.075*lift+.035*answer,s*.14*feint,s*.16*feint);
  add('Arm.'+lead,.040*coil-.10*fins,s*.02*fins,-s*.11*fins);
  add('Forearm.'+lead,s*(.24*fins+.10*feint),s*.035*fins,-s*.30*fins);
  add('Hand.'+lead,s*.065*tips,s*.09*feint,-s*.16*feint);
  add('Arm.'+other,-.055*fins,0,s*.065*fins);
  add('Forearm.'+other,-s*.15*tips,0,s*.19*tips);
  add('Hand.'+other,-s*.04*tips,0,s*.07*answer);
  add('Ear.'+lead,-.12*fins,0,s*.075*first);
  add('Ear.'+other,.055*answer-.035*lift,0,-s*.065*answer);
  add('EarTip.'+lead,-.045*tips,0,s*.045*answer);
  add('EarTip.'+other,.035*tips,0,-s*.025*first);
  for(let i=1;i<=10;i++){
   const lag=(i-1)*.011,follow=pulse(p,.22+lag,.40+lag,.70+lag)-.55*pulse(p,.49+lag,.64+lag,.88+lag);
   add('Tail.'+String(i).padStart(2,'0'),.012*follow,s*.005*follow,-s*.032*follow);
  }
 }else if(name==='wink'){
  const notice=pulse(p,0,.15,.34),tilt=window(p,.12,.33,.64,.98);
  const fin=window(p,.20,.39,.62,.94),ear=window(p,.23,.43,.72,1);
  const closure=window(p,.23,.36,.46,.67);
  // Original V6 HAT channels express the wink. Neither eye mesh nor eye
  // scale changes; null at completion releases only this temporary control.
  blink={left:s>0?closure:0,right:s<0?closure:0};
  add('Body',-.018*tilt,0,-s*.020*tilt);
  add('Chest',-.028*tilt,s*.028*tilt,-s*.025*tilt);
  add('Neck',.018*tilt,s*.025*tilt,s*.035*ear);
  add('Head',-.040*notice+.035*tilt,s*.075*tilt,s*.145*tilt);
  add('Arm.'+lead,-.060*fin,0,-s*.065*fin);
  add('Forearm.'+lead,s*.20*fin,0,-s*.24*fin);
  add('Hand.'+lead,s*.06*fin,0,-s*.11*closure);
  add('Arm.'+other,.025*tilt,0,-s*.025*tilt);
  add('Ear.'+lead,.085*ear,0,-s*.045*ear);
  add('Ear.'+other,-.065*tilt,0,-s*.045*tilt);
  add('EarTip.'+lead,.055*window(p,.28,.46,.77,1));
  for(let i=1;i<=10;i++){
   const lag=(i-1)*.012,follow=window(p,.20+lag,.39+lag,.72+lag,1);
   add('Tail.'+String(i).padStart(2,'0'),.006*follow,0,-s*.018*follow);
  }
 }else if(name==='nod'){
  const gather=pulse(p,0,.14,.31),bow=pulse(p,.21,.38,.61),echo=pulse(p,.51,.65,.88),agree=bow+.42*echo;
  const fins=window(p,.20,.39,.66,.97),ear=pulse(p,.27,.46,.71)+.35*pulse(p,.57,.73,1);
  add('Body',-.018*gather+.022*agree,0,-s*.012*fins);
  add('Chest',-.025*gather+.040*agree,0,s*.018*fins);
  add('Neck',-.020*gather+.060*agree);
  add('Head',-.050*gather+.20*agree,s*.025*fins,s*.045*fins);
  for(const [suffix,sign]of [[lead,s],[other,-s]]){
   add('Arm.'+suffix,-.035*fins,0,-sign*.045*fins);
   add('Forearm.'+suffix,sign*.12*fins,0,-sign*.14*fins);
   add('Hand.'+suffix,sign*.045*agree,0,-sign*.055*fins);
   add('Ear.'+suffix,.065*ear,0,-sign*.035*ear);
   add('EarTip.'+suffix,.045*ear);
  }
  for(let i=1;i<=10;i++){
   const lag=(i-1)*.012,follow=pulse(p,.25+lag,.43+lag,.72+lag);
   add('Tail.'+String(i).padStart(2,'0'),-.016*follow,0,s*.008*follow);
  }
 }
 return {name,duration,progress,phase,envelope,expression:expressions[name],pose,blink};
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
