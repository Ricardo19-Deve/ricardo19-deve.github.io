/**
 * M World V72 — full-body idle moments on the ORIGINAL V6 rig.
 *
 * The V50 spontaneous beats are small secondary touches that the secondary
 * compositor scales down; between journeys M had little that read as a real
 * moment. These are complete little actions, sampled like the authored
 * gestures (additive local Euler offsets, same ±.9 rad contract) and applied
 * through the gesture layer:
 *
 *  ear-scratch   a front paw rises to the ear and scratches; the hind leg on
 *                the same side pedals in time, the head leans into it
 *  face-wash     grooming: a paw rises to the face, three strokes with the head
 *                rubbing into the paw, eyes closed
 *  look-around   a slow look to one side (blink on the turn, ears swivel), a
 *                pause, then the other side; chest follows, tail counters
 *  tail-catch    she notices her tail, it swings forward under her and the paws
 *                catch and hug it, then let go with a happy wag
 *  shake-off     a wet-dog shake: the chest twists back and forth, the head,
 *                ears and tail follow later and settle last
 *
 * Every channel starts and ends at zero with zero slope. Parents lead and
 * extremities follow (ears and tail are phase-delayed), so nothing pops.
 * The scheduler only plays a moment while M is quiet: no gesture, no travel,
 * not reading, not resting/sleeping, motion allowed. If something takes over
 * mid-moment, the moment keeps moving and fades out over RELEASE_SECONDS.
 */
export const IDLE_MOMENTS=Object.freeze(['ear-scratch','face-wash','look-around','tail-catch','shake-off']);
export const IDLE_DURATIONS=Object.freeze({'ear-scratch':3.4,'face-wash':4.4,'look-around':4.8,'tail-catch':4.6,'shake-off':2.6});
/** Seconds of quiet before the first moment, and between moments. */
export const IDLE_FIRST_DELAY=Object.freeze([12,20]);
export const IDLE_COOLDOWN=Object.freeze([22,40]);
/** The same moment never returns sooner than this. */
export const IDLE_REPEAT_GAP=75;
export const RELEASE_SECONDS=.4;
/** Moments that need some energy; a tired M only looks around or grooms. */
const LIVELY=new Set(['tail-catch','shake-off','ear-scratch']);
/** Moments that keep the feet still, so they also suit a perch on a card. */
const PERCH_SAFE=new Set(['face-wash','look-around']);

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const smooth=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
const rise=(p,a,b)=>smooth((p-a)/(b-a));
const window=(p,a,b,c,d)=>rise(p,a,b)*(1-rise(p,c,d));
const pulse=(p,a,b,c)=>window(p,a,b,b,c);
const wave=(p,cycles,offset=0)=>Math.sin(2*Math.PI*(cycles*p+offset));
const TAIL=Object.freeze(Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0')));

/**
 * age in seconds; side=1 leads with the left paw / looks left first.
 * Returns {name,duration,progress,envelope,pose,blink,lift,face} or a neutral
 * frame outside the moment.
 */
export function sampleIdleMoment({name,age=0,side=1,reducedMotion=false}={}){
 const valid=IDLE_MOMENTS.includes(name),duration=valid?IDLE_DURATIONS[name]:0;
 const neutral={name:valid?name:null,duration,progress:duration?clamp(age/duration):0,envelope:0,pose:{},blink:null,lift:0,face:null};
 if(!valid||reducedMotion||!Number.isFinite(age)||age<=0||age>=duration)return neutral;
 const p=clamp(age/duration),s=side<0?-1:1,lead=s>0?'L':'R',other=s>0?'R':'L',pose={};
 const add=(bone,x=0,y=0,z=0)=>{
  const prev=pose[bone]||[0,0,0];
  pose[bone]=[prev[0]+x,prev[1]+y,prev[2]+z].map(v=>clamp(v,-.9,.9));
 };
 const envelope=window(p,0,.12,.84,1);
 let blink=null,lift=0,face=null;
 if(name==='ear-scratch'){
  const reach=window(p,.08,.26,.70,.92),scratch=window(p,.24,.32,.64,.74);
  const rub=scratch*wave(p,7.5),pedal=scratch*wave(p,7.5,.25),lean=window(p,.10,.30,.72,.95);
  add('Body',.03*lean,0,s*.05*lean);
  add('Chest',.03*lean,s*.05*lean,s*.08*lean);
  add('Neck',.02*lean,s*.04*lean,s*.10*lean);
  add('Head',.06*lean+.015*rub,s*.12*lean,s*(.26*lean+.035*rub));
  add('Arm.'+lead,-.22*reach,s*.04*reach,-s*.20*reach);
  add('Forearm.'+lead,s*(.34*reach+.05*rub),s*.05*reach,-s*(.66*reach+.07*rub));
  add('Hand.'+lead,s*.10*reach,s*.10*rub,-s*(.18*reach+.10*rub));
  add('Leg.'+lead,.22*lean+.10*pedal,0,s*.06*lean);
  add('Foot.'+lead,-.10*lean-.08*pedal);
  add('Ear.'+lead,.12*scratch+.05*rub,0,-s*.08*scratch);
  add('Ear.'+other,-.05*lean,0,-s*.04*lean);
  add('EarTip.'+lead,.06*scratch);
  const squint=window(p,.24,.32,.66,.76);
  blink={left:clamp((s>0?.72:.30)*squint),right:clamp((s>0?.30:.72)*squint)};
  face={happy:.55*squint,curious:0,surprised:0};
  for(let i=0;i<10;i++){
   const u=(i+1)/10,lag=window(p,.14+i*.008,.34+i*.008,.70+i*.008,.96);
   add(TAIL[i],0,0,-s*(.04*lag+.03*scratch*wave(p,3.75,-u*.3))*u);
  }
 }else if(name==='face-wash'){
  const reach=window(p,.06,.22,.76,.94),strokes=window(p,.20,.27,.70,.78);
  const stroke=strokes*wave(p,5),down=strokes*Math.max(0,wave(p,5,.25));
  const bow=window(p,.08,.26,.74,.96);
  add('Body',.04*bow,0,0);
  add('Chest',.06*bow,s*.04*bow,0);
  add('Neck',.06*bow+.02*down,s*.04*bow,s*.04*stroke);
  add('Head',.16*bow+.05*down,s*(.10*bow+.04*stroke),s*(.10*bow+.07*stroke));
  add('Arm.'+lead,-.16*reach+.04*down,0,-s*.10*reach);
  add('Forearm.'+lead,s*(.44*reach+.08*stroke),s*.08*reach,-s*(.58*reach-.06*down));
  add('Hand.'+lead,s*(.14*reach+.06*stroke),0,-s*.16*reach);
  add('Arm.'+other,-.05*bow,0,s*.04*bow);
  add('Forearm.'+other,-s*.12*bow,0,s*.14*bow);
  add('Ear.'+lead,.10*bow,0,-s*.06*bow);
  add('Ear.'+other,.06*bow,0,s*.05*bow);
  const closed=window(p,.18,.26,.74,.82);
  blink={left:clamp(.88*closed),right:clamp(.88*closed)};
  face={happy:.35*closed,curious:0,surprised:0};
  for(let i=0;i<10;i++){
   const u=(i+1)/10,lag=window(p,.12+i*.009,.32+i*.009,.74+i*.009,.98);
   add(TAIL[i],.02*lag*u,0,s*.05*lag*u);
  }
 }else if(name==='look-around'){
  const first=window(p,.08,.26,.40,.52),second=window(p,.46,.62,.78,.94);
  const look=first-second,lookLate=window(p,.12,.30,.44,.56)-window(p,.50,.66,.82,.97);
  const up=pulse(p,.24,.33,.44)+pulse(p,.62,.71,.80);
  add('Chest',0,s*.10*lookLate,0);
  add('Neck',-.02*up,s*.12*look,0);
  add('Head',-.07*up,s*.34*look,s*(.06*look+.03*up));
  add('Ear.L',-.04*up,0,.10*look*s);
  add('Ear.R',-.04*up,0,.10*look*s);
  add('EarTip.L',0,0,.05*lookLate*s);
  add('EarTip.R',0,0,.05*lookLate*s);
  add('Arm.'+lead,-.04*first,0,0);
  add('Arm.'+other,-.04*second,0,0);
  // A natural blink rides each head turn.
  const turnBlink=pulse(p,.10,.14,.19)+pulse(p,.47,.51,.56);
  blink={left:clamp(.85*turnBlink),right:clamp(.85*turnBlink)};
  face={happy:0,curious:.55*Math.max(first,second),surprised:0};
  for(let i=0;i<10;i++){
   const u=(i+1)/10,counter=window(p,.14+i*.012,.32+i*.012,.42+i*.012,.56)-window(p,.52+i*.012,.68+i*.012,.82+i*.012,.98);
   add(TAIL[i],0,0,s*.10*counter*u);
  }
 }else if(name==='tail-catch'){
  const notice=window(p,.05,.18,.86,.98),swing=window(p,.12,.34,.66,.88);
  const hug=window(p,.30,.42,.60,.72),wag=window(p,.66,.74,.90,1)*wave(p,6);
  add('Body',.06*notice,0,-s*.04*notice);
  add('Chest',.08*notice,-s*.10*swing,-s*.05*notice);
  add('Neck',.06*notice,-s*.08*swing,0);
  add('Head',.16*notice+.04*hug,-s*.18*swing,-s*(.10*notice-.06*hug));
  for(const [suffix,sign]of [['L',1],['R',-1]]){
   add('Arm.'+suffix,.10*hug,0,sign*.08*hug);
   add('Forearm.'+suffix,sign*.30*hug,0,-sign*.26*hug);
   add('Hand.'+suffix,sign*.10*hug,0,-sign*.10*hug);
   add('Ear.'+suffix,-.08*notice,0,sign*.06*notice);
  }
  // The V72 sleep tuck: drop at the root, then bend forward and across under her.
  for(let i=0;i<10;i++){
   const u=(i+1)/10,follow=window(p,.12+i*.010,.34+i*.010,.62+i*.010,.86);
   if(i<2)add(TAIL[i],0,0,-.30*follow+.03*wag*u);
   else add(TAIL[i],-.22*follow,-s*.11*follow,.09*wag*u);
  }
  const joy=window(p,.36,.46,.82,.96);
  blink={left:clamp(.45*joy),right:clamp(.45*joy)};
  face={happy:.75*joy,curious:.4*window(p,.04,.14,.30,.42),surprised:0};
 }else if(name==='shake-off'){
  const gather=pulse(p,.02,.12,.22),shake=window(p,.14,.20,.60,.78),settle=pulse(p,.62,.78,.97);
  const twist=shake*wave(p,8.5),late=shake*wave(p,8.5,-.12),later=shake*wave(p,8.5,-.24);
  add('Body',.04*gather,.12*twist,0);
  add('Chest',.05*gather,.16*late,.04*twist);
  add('Neck',0,.10*later,.04*late);
  add('Head',.06*gather-.04*settle,.14*later,.08*later);
  for(const [suffix,sign]of [['L',1],['R',-1]]){
   add('Arm.'+suffix,.06*gather,0,sign*.10*shake);
   add('Forearm.'+suffix,sign*.08*later,0,sign*.06*later);
   add('Ear.'+suffix,.10*gather+.08*later,0,sign*.16*later);
   add('EarTip.'+suffix,.08*later);
  }
  for(let i=0;i<10;i++){
   const u=(i+1)/10,whip=shake*wave(p,8.5,-.18-u*.35);
   add(TAIL[i],0,0,.10*whip*u+.03*settle*u);
  }
  lift=.025*gather+.02*settle;
  const squeeze=window(p,.15,.20,.62,.72);
  blink={left:clamp(.9*squeeze),right:clamp(.9*squeeze)};
  face={happy:.5*window(p,.62,.74,.88,1),curious:0,surprised:0};
 }
 return {name,duration,progress:p,envelope,pose,blink,lift,face};
}

const createRandom=seed=>{
 let state=(Number.isFinite(seed)?Math.trunc(seed):1)>>>0||0x9e3779b9;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
};

/**
 * Picks and plays the idle moments. sample() is called every frame with the
 * renderer's own facts; it never moves M, changes depth or starts a gesture.
 */
export function createIdleMoments({seed=1}={}){
 const random=createRandom(seed);
 const between=([a,b])=>a+(b-a)*random();
 let countdown=between(IDLE_FIRST_DELAY),active=null,releasing=null,started=0,completed=0,released=0,blockedBy=null;
 const lastPlayed=new Map(),history=[];
 let clock=0;
 const quiet=()=>({active:false,name:null,progress:0,weight:0,pose:{},blink:null,lift:0,face:null});

 function choose({perched,energy}){
  let options=IDLE_MOMENTS.filter(name=>(lastPlayed.get(name)??-Infinity)+IDLE_REPEAT_GAP<=clock&&name!==history.at(-1));
  if(perched)options=options.filter(name=>PERCH_SAFE.has(name));
  if(energy<.45)options=options.filter(name=>!LIVELY.has(name));
  if(!options.length)return null;
  return options[Math.floor(random()*options.length)%options.length];
 }
 function start(name){
  active={name,age:0,side:random()<.5?-1:1};started++;
  lastPlayed.set(name,clock);history.push(name);if(history.length>4)history.shift();
 }
 function frameFor(moment,weight){
  const frame=sampleIdleMoment({name:moment.name,age:moment.age,side:moment.side});
  if(weight>=1)return {active:true,name:moment.name,progress:frame.progress,weight:1,pose:frame.pose,blink:frame.blink,lift:frame.lift,face:frame.face};
  const pose={};
  for(const [bone,angles] of Object.entries(frame.pose))pose[bone]=angles.map(v=>v*weight);
  const blink=frame.blink?{left:frame.blink.left*weight,right:frame.blink.right*weight}:null;
  const face=frame.face?Object.fromEntries(Object.entries(frame.face).map(([k,v])=>[k,v*weight])):null;
  return {active:weight>0,name:moment.name,progress:frame.progress,weight,pose,blink,lift:frame.lift*weight,face};
 }

 function sample({dt=0,gesture=null,moving=false,reading=false,resting=false,perched=false,
  energy=.65,reducedMotion=false,busy=false}={}){
  if(reducedMotion){reset();return quiet();}
  const step=clamp(dt,0,.06);
  clock+=step;
  blockedBy=gesture?'gesture':moving?'moving':reading?'reading':resting?'resting':busy?'busy':null;
  const blocked=Boolean(blockedBy);
  if(active&&(blocked||(perched&&!PERCH_SAFE.has(active.name)))){
   // Something else takes over: keep the motion alive while it fades out.
   releasing={...active,fade:0};active=null;released++;countdown=between(IDLE_COOLDOWN);
  }
  if(releasing){
   releasing.age=Math.min(IDLE_DURATIONS[releasing.name],releasing.age+step);
   releasing.fade+=step;
   const weight=1-smooth(releasing.fade/RELEASE_SECONDS);
   if(weight<=0||releasing.age>=IDLE_DURATIONS[releasing.name]){releasing=null;return quiet();}
   return frameFor(releasing,weight);
  }
  if(!active){
   if(blocked||!step)return quiet();
   countdown-=step;
   if(countdown>0)return quiet();
   const name=choose({perched,energy:clamp(energy)});
   if(!name){countdown=between(IDLE_COOLDOWN)*.5;return quiet();}
   start(name);
  }
  active.age+=step;
  if(active.age>=IDLE_DURATIONS[active.name]){
   active=null;completed++;countdown=between(IDLE_COOLDOWN);return quiet();
  }
  return frameFor(active,1);
 }
 /** Diagnostics only: start a moment now (the debug page hook). */
 function force(name){
  if(!IDLE_MOMENTS.includes(name))return false;
  releasing=null;start(name);return true;
 }
 function reset(){active=null;releasing=null;countdown=between(IDLE_FIRST_DELAY);}
 function snapshot(){return {active:active?.name||null,releasing:releasing?.name||null,
  cooldown:Math.max(0,countdown),blockedBy,started,completed,released,history:[...history]};}
 return {sample,force,reset,snapshot};
}
