/**
 * V35 — embodied intention over the ORIGINAL V6 rig.
 *
 * A small bounded gesture layer lets M glance before moving, use both ears
 * asymmetrically, let the ten connected tail joints follow the head, and
 * physically react to *acknowledged* lived-story moments.
 *
 * Never replaces Blender bones, authored gestures, facial morphs, depth
 * protection or the autonomous decision maker. No network or storage.
 */
const clamp=(value,min=-1,max=1)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:0));
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const pulse=(time,duration)=>{const t=clamp(time/duration,0,1);return Math.sin(Math.PI*t)**2;};
const zero=()=>({pose:{},stage:{x:0,y:0,rx:0,ry:0,rz:0,scale:0},active:false,mode:'quiet',idle:0,reaction:0});
const MOMENTS=Object.freeze({
 notice:Object.freeze({head:[-.035,.03,.045],ears:.04,tail:.003,stageY:0}),
 explore:Object.freeze({head:[-.055,.07,.025],ears:.055,tail:.008,stageY:.003}),
 reflect:Object.freeze({head:[.075,-.02,-.045],ears:-.035,tail:-.004,stageY:-.002}),
 complete:Object.freeze({head:[-.09,.03,.035],ears:.08,tail:.018,stageY:.007})
});
const IDLES=Object.freeze(['notice','listen','ponder','glance']);
const safeSeed=seed=>(Number.isFinite(seed)?Math.trunc(seed)>>>0:18421)||18421;

/** Stateful, bounded and deterministic when seeded. Production gets a fresh visit seed. */
export function createLivingPerformance({seed=18421}={}){
 let randomState=safeSeed(seed),idleWait=2,elapsed=0,activeIdle=null,side=1,idleDuration=0,
  moveIntent=0,gazeX=0,gazeY=0,frames=0,completedIdles=0;
 const random=()=>{
  randomState^=randomState<<13;randomState^=randomState>>>17;randomState^=randomState<<5;
  return (randomState>>>0)/4294967296;
 };
 idleWait=3.2+random()*5.2;
 function reset(){
  idleWait=3.2+random()*5.2;elapsed=0;activeIdle=null;idleDuration=0;
  moveIntent=0;gazeX=0;gazeY=0;frames=0;
 }
 function sample({
  dt=0,vx=0,vy=0,attention={x:0,y:0},phase='hold',
  mode='float',gestureActive=false,reducedMotion=false,reading=false,
  reaction=null
 }={}){
  if(reducedMotion||gestureActive||mode==='sleep'){
   reset();return zero();
  }
  const step=clamp(dt,0,.06),speed=Math.hypot(clamp(vx,-700,700),clamp(vy,-700,700));
  const approaching=phase==='approach';
  const headed=clamp(attention?.x),lookingUp=clamp(attention?.y);
  const gazeFilter=1-Math.pow(.5,step/.2);
  gazeX+=(headed-gazeX)*gazeFilter;gazeY+=(lookingUp-gazeY)*gazeFilter;
  const intentTarget=approaching&&speed<85?1:0;
  moveIntent+=(intentTarget-moveIntent)*(1-Math.pow(.5,step/(intentTarget?.13:.25)));
  // Spontaneous gestures only arise during a genuine pause, on an irregular
  // seed-dependent schedule. Reading makes them smaller, not intrusive.
  const atRest=speed<18&&!approaching&&phase!=='reveal'&&phase!=='depart';
  if(!atRest){
   activeIdle=null;elapsed=0;idleWait=Math.max(idleWait,2.5);
  }else if(activeIdle){
   elapsed+=step;
   if(elapsed>=idleDuration){
    activeIdle=null;elapsed=0;idleWait=3.5+random()*8.5;completedIdles++;
   }
  }else{
   idleWait-=step;
   if(idleWait<=0){
    activeIdle=IDLES[Math.floor(random()*IDLES.length)];
    side=random()<.5?-1:1;idleDuration=1.5+random()*2.4;elapsed=0;
   }
  }
  const idle=activeIdle?pulse(elapsed,idleDuration)*(reading?.27:1):0;
  const profile={
   notice:{rx:-.05,ry:.06,rz:.025,ears:.05,tail:.01},
   listen:{rx:.012,ry:-.07,rz:.065,ears:.08,tail:-.008},
   ponder:{rx:.07,ry:.02,rz:-.045,ears:-.035,tail:.006},
   glance:{rx:-.005,ry:.11,rz:.03,ears:.065,tail:.012}
  }[activeIdle]||{rx:0,ry:0,rz:0,ears:0,tail:0};
  const moment=MOMENTS[reaction?.name]||null;
  const age=clamp(reaction?.age??0,0,6),duration=clamp(reaction?.duration??4.2,.5,6);
  const reactionWeight=moment&&Number.isFinite(reaction?.age)&&reaction.age>=0&&reaction.age<duration?
   pulse(age,duration)*(reading?.45:1):0;
  const active=idle>.0001||moveIntent>.0001||reactionWeight>.0001||Math.abs(gazeX)>.003;
  if(!active){
   frames++;return {...zero(),mode:activeIdle||'quiet',idle:0};
  }
  // Head starts turning toward future destination BEFORE the torso follows.
  const lean=moveIntent*.09;
  const rx=clamp(profile.rx*idle-lean+reactionWeight*(moment?.head[0]||0),-.16,.16);
  const ry=clamp(profile.ry*idle*side+gazeX*.09+reactionWeight*(moment?.head[1]||0)*side,-.19,.19);
  const rz=clamp(profile.rz*idle*side+gazeY*.025+reactionWeight*(moment?.head[2]||0)*side,-.15,.15);
  const ear=clamp(profile.ears*idle+moveIntent*.033+reactionWeight*(moment?.ears||0),-.12,.13);
  const tail=clamp(profile.tail*idle+reactionWeight*(moment?.tail||0)+moveIntent*.006,-.03,.035);
  const pose={
   Head:[rx,ry,rz],
   Neck:[rx*.37,ry*.4,rz*.3],
   Chest:[rx*.15,ry*.16,rz*.1],
   'Ear.L':[-ear*.85,0,ear*.56],
   'Ear.R':[-ear*.55,0,-ear*.46],
   'EarTip.L':[ear*.3,0,-ear*.18],
   'EarTip.R':[ear*.22,0,ear*.16]
  };
  // Small travelling counter-wave through existing ten connected tail bones:
  // each joint is below 0.04 radians; no synthetic tail mesh is created.
  for(let i=1;i<=10;i++){
   const lag=i/10;
   const follow=Math.sin(elapsed*2.2-lag*1.7)*idle;
   pose['Tail.'+String(i).padStart(2,'0')]=[
    clamp(-.004*reactionWeight*lag,-.02,.02),
    0,
    clamp(side*(tail*(.55+.45*lag)+follow*.003)*(.75+.25*lag),-.04,.04)
   ];
  }
  const stage={
   x:clamp(gazeX*.003*idle,-.006,.006),
   y:clamp(reactionWeight*(moment?.stageY||0),-.01,.01),
   rx:clamp(moveIntent*.01+reactionWeight*.007,-.025,.025),
   ry:clamp(gazeX*.008,-.015,.015),
   rz:clamp(idle*.009*side+reactionWeight*.012*side,-.026,.026),
   scale:clamp(reactionWeight*(reaction?.name==='complete'?.007:0),0,.009)
  };
  frames++;
  return {pose,stage,active,mode:reactionWeight>.05?'lived-'+reaction.name:
   moveIntent>.2?'anticipating':activeIdle||'attending',
   idle,reaction:reactionWeight};
 }
 function snapshot(){return {mode:activeIdle||'quiet',pendingIdle:Math.max(0,idleWait),
  moveIntent,gaze:{x:gazeX,y:gazeY},completedIdles,frames};}
 return {sample,snapshot,reset};
}
