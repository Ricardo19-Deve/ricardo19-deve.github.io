/**
 * M V38 — contact-aware body language over the ORIGINAL 31-bone V6 rig.
 *
 * A card "landing" is physical only when the spatial route confirms that
 * M's actual footprint has reached its permitted perch and is attached to
 * the same moving DOM surface. No invented ground, no hitbox guessing, no
 * new mesh, no changes to the existing depth/card occlusion calculations.
 */
const finite=(n,defaultValue=0)=>Number.isFinite(n)?n:defaultValue;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,finite(n)));
const neutral=()=>({mode:'airborne',weight:0,impact:0,pose:{},
  stage:{x:0,y:0,rx:0,ry:0,rz:0,scale:0},supported:false});
export function createSurfaceContact(){
 let attached=false,contactAge=0,weight=0,sway=0,ticks=0,landings=0,releaseTime=0,stage='airborne';
 function clear(){attached=false;contactAge=0;weight=0;sway=0;releaseTime=0;stage='airborne';}
 function sample({
  dt=0,attached:nowAttached=false,mode='float',phase='hold',
  reducedMotion=false,gestureActive=false,reading=false,velocity={x:0,y:0}
 }={}){
  if(reducedMotion||gestureActive){clear();return neutral();}
  const h=clamp(dt,0,.06);
  // Only a verified perch route is permitted to acquire contact.
  const supported=nowAttached===true&&mode==='perch'&&phase==='hold';
  if(supported&&!attached){landings++;contactAge=0;releaseTime=0;}
  if(supported)contactAge=Math.min(20,contactAge+h);
  else if(attached)releaseTime=0;
  if(!supported)releaseTime=Math.min(2,releaseTime+h);
  attached=supported;
  const target=supported?1:0;
  // Smooth damped contact envelope; changing the page layout will release
  // naturally without a forced 2D jump or resetting the original animator.
  weight+=(target-weight)*(1-Math.exp(-h*(supported?5.8:8.3)));
  if(weight<.0001)weight=0;
  const tap=supported?Math.sin(contactAge*15)*Math.exp(-contactAge*7.5):0;
  const intensity=reading?.50:1;
  const impact=clamp(tap,-1,1)*weight;
  // Subtle movement of balance *while resting*, never during landing motion.
  sway+=h*(.85+.12*(landings%3));
  const balance=weight*Math.sin(sway*1.65)*.006*intensity;
  const breathing=weight*Math.sin(sway*2.4)*.0012*intensity;
  const leg=weight*(.04+impact*.012),torso=weight*(.018+impact*.008);
  const pose={
   Body:[torso,0,balance*.48],
   Chest:[-torso*.55,0,-balance*.68],
   'Leg.L':[leg,0,balance*.75],
   'Leg.R':[leg,0,-balance*.65],
   'Foot.L':[-leg*.8,0,-.008*weight],
   'Foot.R':[-leg*.8,0,.008*weight],
   'Ear.L':[-.010*weight,0,balance],
   'Ear.R':[-.012*weight,0,-balance*.85]
  };
  // Real connected tail, tiny anti-sway so the whole character has weight.
  for(let i=1;i<=10;i++){
   const ratio=i/10;
   pose['Tail.'+String(i).padStart(2,'0')]=[
    -.002*weight*ratio,0,
    clamp(-balance*(.3+ratio*.8)+impact*.007*(1-ratio),-.015,.015)
   ];
  }
  // The horizontal lock belongs exclusively to the existing spatial route.
  // No X translation, preventing movement away from the card edge.
  const stagePose={
   x:0,
   y:clamp(-.011*weight-.009*impact+breathing,-.027,.011),
   rx:clamp(-.012*weight,-.02,.02),
   ry:0,
   rz:clamp(balance*.85,-.009,.009),
   scale:clamp(-.008*weight+.002*impact,-.015,.004)
  };
  ticks++;stage=supported?(contactAge<.65?'landing':'perched'):weight>0?'lifting':'airborne';
  if(!weight)return neutral();
  return {mode:stage,weight,impact,pose,stage:stagePose,supported};
 }
 function snapshot(){return {mode:stage,attached,weight,contactAge,landings,ticks};}
 return {sample,snapshot,reset:clear};
}
