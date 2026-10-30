/**
 * M V7 secondary-body motion layer.
 * Applies small procedural rotations AFTER the baked GLB clip is evaluated.
 * Never changes morph targets, clip tracks or the original rig/skin data.
 */
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
const wave=(t,speed,phase=0)=>Math.sin(t*speed+phase);
const bump=(t,at,width)=>Math.exp(-Math.pow((t-at)/width,2));

/** Pure pose evaluator: values are local additive Euler angles in radians. */
export function motionPose({time=0,modeAge=0,emotionAge=999,mode='float',expression='neutral',pointer={x:0,y:0},energy=.7}={}) {
 const e=clamp(energy,0,1.3),t=Math.max(0,time),p={x:clamp(pointer?.x,-1,1),y:clamp(pointer?.y,-1,1)};
 const bones={};
 const add=(name,x=0,y=0,z=0)=>{
  const a=bones[name]||(bones[name]=[0,0,0]);
  a[0]+=x;a[1]+=y;a[2]+=z;
 };
 // Subtle asymmetry keeps the character alive even without the swim clip.
 add('Chest',.026*wave(t,2.0),.025*wave(t,.9),.028*wave(t,1.3));
 add('Neck',.03*wave(t,.85),.022*wave(t,1.4));
 add('Head',.045*wave(t,.8),.045*wave(t,.61,.6),.045*wave(t,.72,1.1));
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
 // Distributed tail wave travels down the actual ten-bone chain.
 for(let i=1;i<=10;i++){
  const k=i/10,phase=-i*.34,swim=mode==='swim'?1.15:1;
  add('Tail.'+String(i).padStart(2,'0'),
   .022*k*wave(t,2.1*swim,phase),
   (.035+.029*k)*wave(t,1.65*swim,phase),
   (.023+.027*k)*wave(t,1.9*swim,phase-.4));
 }
 // Emotion is expressed using the body, rather than the tiny facial morph alone.
 if(expression==='happy') {
  add('Head',-.055*wave(t,2.8),0,.12*wave(t,2.15));
  add('Ear.L',-.075,0,.115);add('Ear.R',-.075,0,-.115);
  add('Arm.L',.20*wave(t,2.9),0,.15);
  add('Arm.R',.20*wave(t,3.05,1.6),0,-.15);
 }
 if(expression==='curious') {
  add('Head',-.06,.10,.28);
  add('Neck',0,.035,.075);
  add('Ear.L',-.1,0,.065);add('Ear.R',.04,0,-.045);
  add('Arm.L',.05,0,.13);add('Arm.R',-.03,0,-.07);
 }
 if(expression==='surprised') {
  add('Head',-.19,0,-.06);
  add('Ear.L',-.23,0,.16);add('Ear.R',-.23,0,-.16);
  add('Arm.L',-.24,0,.28);add('Arm.R',-.24,0,-.28);
  add('Chest',-.045,0,0);
 }
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
  for(let i=6;i<=10;i++)add('Tail.'+String(i).padStart(2,'0'),0,.075,0);
 }
 if(mode==='knock') {
  const hit=bump(modeAge,.75,.16)+bump(modeAge,1.23,.16);
  add('Arm.R',-.3*hit,0,-.2*hit);
  add('Forearm.R',.4*hit,0,.10*hit);
  add('Hand.R',.13*hit);
  add('Head',-.06*hit,0,.03*hit);
 }
 // Short emotional anticipation adds life whenever a face button is selected.
 const pulse=Math.exp(-Math.max(0,emotionAge)*3)*Math.sin(Math.max(0,emotionAge)*11);
 if(expression==='happy'){add('Head',-.085*pulse,0,.05*pulse);add('Arm.L',.10*pulse);add('Arm.R',.10*pulse);}
 if(expression==='curious')add('Head',0,.08*pulse,.08*pulse);
 if(expression==='surprised'){add('Body',-.13*pulse);add('Head',-.09*pulse);add('Ear.L',-.08*pulse);add('Ear.R',-.08*pulse);}
 // Reduce secondary motion while the baked swim clip is moving every bone.
 const damp=mode==='swim'?.7:1;
 for(const a of Object.values(bones))for(let i=0;i<3;i++)a[i]*=e*damp;
 return bones;
}

export function createMotionV7(root,THREE) {
 const bones=new Map(),rest=new Map(),current=new Map(),extra=new THREE.Quaternion(),angles=new THREE.Euler();
 root.traverse(o=>{
  if(!o.isBone)return;
  bones.set(o.name,o);
  rest.set(o.name,o.quaternion.clone());
  current.set(o.name,[0,0,0]);
 });
 let elapsed=0,modeElapsed=0,emotionElapsed=999,previousMode=null,previousExpression=null;
 return {
  get availableBones(){return bones.size;},
  reset(){elapsed=0;modeElapsed=0;emotionElapsed=999;previousMode=null;previousExpression=null;for(const [name,bone] of bones){bone.quaternion.copy(rest.get(name));current.set(name,[0,0,0]);}},
  update(dt,{mode='float',expression='neutral',pointer={x:0,y:0},energy=.7,clipActive=false}={}){
   dt=clamp(dt,0,.09);elapsed+=dt;
   if(mode!==previousMode){modeElapsed=0;previousMode=mode;}else modeElapsed+=dt;
   if(expression!==previousExpression){emotionElapsed=0;previousExpression=expression;}else emotionElapsed+=dt;
   const poses=motionPose({time:elapsed,modeAge:modeElapsed,emotionAge:emotionElapsed,mode,expression,pointer,energy});
   const blend=1-Math.exp(-5.5*dt);
   for(const [name,bone] of bones){
    const previous=current.get(name),desired=poses[name]||[0,0,0];
    for(let axis=0;axis<3;axis++)previous[axis]+=(desired[axis]-previous[axis])*blend;
    // The mixer updates animated bones before us; idle bones use original rest pose.
    if(!clipActive)bone.quaternion.copy(rest.get(name));
    angles.set(previous[0],previous[1],previous[2],'XYZ');
    extra.setFromEuler(angles);
    bone.quaternion.multiply(extra);
   }
  }
 };
}
