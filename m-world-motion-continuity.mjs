/**
 * M World V39 — the original 31-bone V6 character has motion continuity.
 * The real spatial controller continues to own ALL position, contact, depth
 * and intent. This only adds a few reversible, bounded skin/torso reactions
 * when the already-observed movement starts, turns and comes to rest.
 *
 * No network, persistence, AI calls, DOM access, new geometry or looped clips.
 */
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,finite(n)));
const toward=(current,target,dt,halfLife)=>current+(target-current)*(1-Math.pow(.5,dt/halfLife));
const ease=x=>{const u=clamp(x,0,1);return u*u*(3-2*u);};
const bell=(age,length)=>Math.sin(Math.PI*ease(clamp(age/length,0,1)))**2;
const idleFrame=()=>({active:false,mode:'quiet',launch:0,settle:0,reorient:0,
 pose:{},stage:{x:0,y:0,rx:0,ry:0,rz:0,scale:0}});
const groupOf=mode=>{
 if(mode==='peek'||mode==='inspect'||mode==='curious')return 'inspect';
 if(mode==='orbit'||mode==='glide'||mode==='swim')return 'explore';
 if(mode==='play'||mode==='dash'||mode==='surf'||mode==='spin')return 'play';
 if(mode==='perch'||mode==='perched')return 'perch';
 if(mode==='rest'||mode==='settle'||mode==='sleep')return 'rest';
 return 'roam';
};
const tailName=i=>'Tail.'+String(i).padStart(2,'0');
export function createMotionContinuity(){
 let initialized=false,moving=false,filteredSpeed=0,turnFast=0,turnSlow=0,
  launchAge=20,settleAge=20,reorientAge=20,lastGroup='roam',
  launches=0,arrivals=0,reorientations=0,frames=0,mode='quiet';
 function reset(){
  initialized=false;moving=false;filteredSpeed=0;turnFast=0;turnSlow=0;
  launchAge=settleAge=reorientAge=20;lastGroup='roam';mode='quiet';
 }
 function sample({dt=0,vx=0,vy=0,turn=0,phase='hold',mode:activity='float',
  attached=false,reducedMotion=false,gestureActive=false,reading=false}={}){
  if(reducedMotion||gestureActive||attached||activity==='sleep'){
   reset();return idleFrame();
  }
  const h=clamp(dt,0,.06),speed=clamp(Math.hypot(finite(vx),finite(vy)),0,400);
  const steering=clamp(turn,-1,1),group=groupOf(activity);
  // Hysteresis avoids repeated stop/start events when velocity jitters.
  const nextMoving=moving?speed>=12:speed>=34;
  if(!initialized){
   initialized=true;moving=nextMoving;lastGroup=group;
  }else{
   if(!moving&&nextMoving){launchAge=0;launches++;}
   if(moving&&!nextMoving){settleAge=0;arrivals++;}
   if(group!==lastGroup&&['inspect','play','explore'].includes(group)){
    reorientAge=0;reorientations++;
   }
   moving=nextMoving;lastGroup=group;
  }
  launchAge+=h;settleAge+=h;reorientAge+=h;
  filteredSpeed=toward(filteredSpeed,Math.min(1,speed/145),h,moving?.22:.38);
  turnFast=toward(turnFast,steering,h,.12);
  turnSlow=toward(turnSlow,steering,h,.44);
  const launch=bell(launchAge,1.05);
  const settle=bell(settleAge,1.35);
  const reorient=bell(reorientAge,.95);
  const tailLag=clamp(turnFast-turnSlow,-.85,.85);
  const readingScale=reading?.3:1;
  const active=launch>.0001||settle>.0001||reorient>.0001||
   Math.abs(tailLag)>.005||filteredSpeed>.025;
  frames++;mode=launch>.2?'starting':settle>.2?'settling':
   reorient>.2?'considering':moving?'travelling':'quiet';
  if(!active)return idleFrame();
  // Eyes and ears lead, shoulders settle and each original connected
  // tail joint follows with more delay toward its tip.
  const start=launch*readingScale,stop=settle*readingScale,redirect=reorient*readingScale;
  const headPitch=clamp(-start*.033+stop*.033-redirect*.018,-.08,.08);
  const headYaw=clamp(turnFast*.031*readingScale+redirect*.024,-.07,.07);
  const lean=clamp(start*.023-stop*.014,-.04,.04);
  const pose={
   Head:[headPitch,headYaw,-tailLag*.022*readingScale],
   Neck:[headPitch*.6,headYaw*.42,-tailLag*.012*readingScale],
   Chest:[lean,-tailLag*.012*readingScale,tailLag*.013*readingScale],
   Body:[lean*.65,0,tailLag*.008*readingScale],
   'Arm.L':[-start*.022+stop*.009,0,-redirect*.014],
   'Arm.R':[-start*.018+stop*.009,0,redirect*.014],
   'Leg.L':[start*.027-stop*.013,0,0],
   'Leg.R':[start*.027-stop*.013,0,0],
   'Ear.L':[-redirect*.034-start*.011,0,tailLag*.014*readingScale],
   'Ear.R':[-redirect*.023-start*.008,0,-tailLag*.011*readingScale]
  };
  for(let i=1;i<=10;i++){
   const l=i/10;
   const inertia=clamp(-tailLag*(.007+.012*l)*readingScale+stop*.006*(1-l)-
    start*.005*l,-.024,.024);
   pose[tailName(i)]=[clamp(-stop*.003*l,-.01,.01),0,inertia];
  }
  const stage={
   x:0, // Never displace real screen-space card attachment / hit detection.
   y:clamp(-.0035*start+.002*stop,-.007,.007),
   rx:clamp(-.014*start+.011*stop-.005*filteredSpeed,-.028,.028),
   ry:clamp(redirect*.009*clamp(turnFast,-1,1),-.014,.014),
   rz:clamp(-tailLag*.013*readingScale+stop*.004,-.025,.025),
   scale:clamp(-start*.003+stop*.002,-.006,.006)
  };
  return {active,mode,launch,settle,reorient,pose,stage};
 }
 function snapshot(){
  return {mode,moving,filteredSpeed,turnLag:turnFast-turnSlow,launches,
   arrivals,reorientations,frames};
 }
 return {sample,reset,snapshot};
}
