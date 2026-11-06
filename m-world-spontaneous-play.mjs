/**
 * M World V51 — spontaneous, individually varied miniature performances on ORIGINAL V6 rig.
 *
 * Strictly local, seeded, bounded, non-repeating actions. This layer adds
 * gestures BETWEEN the original authored V6 clips; it never controls the
 * route, cards, depth, page content, visibility or the owner's personal data.
 *
 * V41 pose handoffs handle additive bone exit velocity. Facial continuity V28
 * handles lid / expression exits. No second blink timer or locomotion engine.
 */
export const SPONTANEOUS_BEATS=Object.freeze([
 'double-take','peekaboo','tail-chase','little-dance','stretch','stargaze','ear-flick',
 'self-hug','little-bow','curious-scan','victory-wiggle'
]);
const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:min));
const smooth=t=>{const x=clamp(t);return x*x*(3-2*x);};
const cycle=(p,count=1,offset=0)=>Math.sin(2*Math.PI*(count*p+offset));
const LIDS=['left','right'];
const TAIL=Object.freeze(Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0')));
const quiet=()=>({active:false,kind:null,progress:0,envelope:0,pose:{},
 stage:{rx:0,ry:0,rz:0,y:0,scale:0},face:null});
const createRandom=seed=>{
 let state=(Number.isFinite(seed)?Math.trunc(seed):1)>>>0||0x9e3779b9;
 return ()=>{
  state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/4294967296;
 };
};
const DURATIONS=Object.freeze({
 'double-take':3.3,peekaboo:3.5,'tail-chase':4.1,'little-dance':3.5,
 stretch:4.2,stargaze:4.2,'ear-flick':2.5,
 'self-hug':3.7,'little-bow':3.2,'curious-scan':4.2,'victory-wiggle':3.8
});
const CHOICES=Object.freeze({
 explore:['double-take','stargaze','ear-flick','tail-chase','curious-scan'],
 observe:['double-take','peekaboo','stargaze','ear-flick','little-bow','curious-scan'],
 play:['little-dance','tail-chase','peekaboo','ear-flick','victory-wiggle','little-bow'],
 quiet:['stretch','stargaze','ear-flick','self-hug','little-bow','curious-scan']
});
export function createSpontaneousPlay({seed=1}={}){
 const random=createRandom(seed);
 let countdown=5+random()*6,active=null,lastTwo=[],seconds=0,
  started=0,completed=0,cancelled=0,gazeX=0,gazeY=0,turnFollow=0;
 const tail=(pose,i,x=0,y=0,z=0)=>{
  const key=TAIL[i];pose[key]=[clamp(x,-.085,.085),
   clamp(y,-.085,.085),clamp(z,-.115,.115)];
 };
 function select(category,energy){
  let list=CHOICES[category]||CHOICES.quiet;
  // A tired M stretches or looks around; she does not perform a dance.
  if(energy<.43)list=list.filter(k=>!['little-dance','tail-chase','victory-wiggle'].includes(k));
  if(!list.length)list=CHOICES.quiet;
  const notLast=list.filter(name=>name!==lastTwo.at(-1));
  const pool=notLast.length?notLast:list;
  const weights=pool.map(name=>Math.pow(.42,lastTwo.filter(x=>x===name).length));
  let roll=random()*weights.reduce((sum,x)=>sum+x,0);
  for(let i=0;i<pool.length;i++){roll-=weights[i];if(roll<=0)return pool[i];}
  return pool.at(-1);
 }
 function body(kind,p,e,{side=1,style=1,gaze={x:0,y:0},turn=0}={}){
  // Every performance has cubic zero-position/zero-velocity endpoints.
  // Joints are original V6 bones and the 10 connected original tail joints.
  const a=cycle(p,.5),b=cycle(p,2),c=cycle(p,3),q=cycle(p,1),
   f=e*style*Math.max(0,1+.18*cycle(p,1.5));
  let hx=0,hy=0,hz=0,chx=0,chy=0,chz=0,armsL=[0,0,0],armsR=[0,0,0],
   earL=[0,0,0],earR=[0,0,0],tailX=0,tailY=0,tailZ=0,
   stage={rx:0,ry:0,rz:0,y:0,scale:0},faceWeights={happy:0,curious:0,surprised:0},lids={left:0,right:0};
  if(kind==='double-take'){
   hy=.16*cycle(p,1.4)*f;hz=.078*cycle(p,.7)*f;chy=-.048*cycle(p,1.4)*f;
   earL=[-.02*f,0,.05*f];earR=[-.013*f,0,-.047*f];
   tailZ=-.04*cycle(p,1.4)*f;
   faceWeights={happy:.03*f,curious:.46*f,surprised:.22*f};
   lids={left:.14*(1+Math.max(0,b))*.5*f,right:.07*f};
  }else if(kind==='peekaboo'){
   const peek=Math.max(0,cycle(p,1.2));
   hx=.085*f-.10*peek*f;hy=.052*q*f;
   armsL=[-.12*f,.025*f,.11*f];armsR=[-.12*f,-.025*f,-.11*f];
   earL=[-.06*f,0,.03*f];earR=[-.06*f,0,-.03*f];
   chx=.045*f;tailZ=.055*q*f;
   lids={left:.36*f*(1-.65*peek),right:.34*f*(1-.65*peek)};
   faceWeights={happy:.30*f,curious:.20*peek*f,surprised:0};
  }else if(kind==='tail-chase'){
   hy=-.15*q*f;hz=.10*cycle(p,.5)*f;
   chy=.085*q*f;chz=.075*b*f;
   armsL=[-.045*f,0,.07*f];armsR=[-.045*f,0,-.07*f];
   tailY=.045*f;tailZ=.11*cycle(p,1.2)*f;
   stage={...stage,ry:.025*q*f,rz:.015*b*f};
   faceWeights={happy:.24*f,curious:.48*f,surprised:.10*f};
  }else if(kind==='little-dance'){
   hx=-.035*a*f;hz=.075*b*f;chz=.09*b*f;
   armsL=[-.11*Math.max(0,b)*f,0,.085*f];
   armsR=[-.11*Math.max(0,-b)*f,0,-.085*f];
   earL=[-.03*f,0,.06*b*f];earR=[-.03*f,0,-.06*b*f];
   tailX=.017*b*f;tailZ=.09*cycle(p,2.1)*f;
   stage={...stage,rz:.022*b*f,y:.007*(.5+.5*b)*f};
   faceWeights={happy:.62*f,curious:.12*f,surprised:0};
   lids={left:.06*f,right:.06*f};
  }else if(kind==='stretch'){
   hx=-.085*f;hz=.045*q*f;chx=-.10*f;
   armsL=[-.15*f,0,.16*f];armsR=[-.15*f,0,-.16*f];
   earL=[-.022*f,0,.042*f];earR=[-.022*f,0,-.042*f];
   tailX=-.047*f;tailZ=.025*q*f;
   stage={...stage,rx:-.012*f,y:.005*f};
   faceWeights={happy:.20*f,curious:.07*f,surprised:0};
   lids={left:.26*f,right:.25*f};
  }else if(kind==='stargaze'){
   hx=-.13*f;hy=.075*q*f;hz=.060*a*f;
   chx=-.040*f;earL=[-.05*f,0,.057*f];earR=[-.05*f,0,-.057*f];
   tailY=.045*f;tailZ=.042*a*f;
   faceWeights={happy:.10*f,curious:.56*f,surprised:.15*f};
   lids={left:.045*f,right:.045*f};
  }else if(kind==='ear-flick'){
   hx=.018*f;hy=.040*q*f;hz=.030*b*f;
   earL=[-.055*Math.max(0,c)*f,0,.070*c*f];
   earR=[-.045*Math.max(0,-c)*f,0,-.065*c*f];
   tailZ=.045*b*f;
   faceWeights={happy:.22*f,curious:.33*f,surprised:.04*f};
   lids={left:.11*f,right:.06*f};
  }else if(kind==='self-hug'){
   hx=.055*f;hz=.026*q*f;chx=.043*f;
   armsL=[-.085*f,.027*f,-.11*f];armsR=[-.085*f,-.027*f,.11*f];
   earL=[-.014*f,0,.026*f];earR=[-.014*f,0,-.026*f];
   tailX=-.020*f;tailZ=.028*q*f;
   faceWeights={happy:.43*f,curious:.08*f,surprised:0};
   lids={left:.18*f,right:.17*f};
  }else if(kind==='little-bow'){
   hx=.12*f-.038*Math.max(0,b)*f;hy=.029*q*f;chx=.075*f;
   armsL=[-.032*f,0,.034*f];armsR=[-.032*f,0,-.034*f];
   earL=[.028*f,0,.030*f];earR=[.028*f,0,-.030*f];
   tailX=.024*f;tailZ=.034*q*f;
   faceWeights={happy:.43*f,curious:.15*f,surprised:0};
   lids={left:.13*f,right:.13*f};
  }else if(kind==='curious-scan'){
   hx=-.028*f;hy=.12*cycle(p,.85)*f;hz=.057*q*f;
   chy=-.036*cycle(p,.85)*f;
   earL=[-.038*f,0,.056*f];earR=[-.033*f,0,-.053*f];
   tailY=.023*f;tailZ=-.042*cycle(p,.85)*f;
   faceWeights={happy:.06*f,curious:.53*f,surprised:.11*f};
   lids={left:.045*f,right:.055*f};
  }else if(kind==='victory-wiggle'){
   hx=-.043*f;hz=.09*b*f;chz=-.11*b*f;
   armsL=[-.092*Math.max(0,b)*f,0,.11*f];
   armsR=[-.092*Math.max(0,-b)*f,0,-.11*f];
   earL=[-.026*f,0,.063*b*f];earR=[-.026*f,0,-.061*b*f];
   tailX=.017*b*f;tailZ=.095*cycle(p,1.6)*f;
   stage={...stage,rz:.025*b*f,y:.006*(.5+.5*b)*f};
   faceWeights={happy:.68*f,curious:.10*f,surprised:0};
   lids={left:.055*f,right:.055*f};
  }
  // The direction and amplitude vary for each authored moment. Real gaze and
  // turning have a smoothed, bounded influence rather than producing snap turns.
  hy=clamp(hy*side+gaze.x*.024*e,-.23,.23);
  hz=clamp(hz*side+gaze.y*.020*e,-.18,.18);
  chy=clamp(chy*side,-.15,.15);
  chz=clamp(chz*side,-.16,.16);
  tailZ=clamp(tailZ*side-turn*.016*e,-.13,.13);
  const pose={
   Head:[hx,hy,hz],
   Neck:[hx*.43,hy*.38,hz*.38],
   Chest:[chx,chy,chz],
   'Arm.L':armsL.map(v=>clamp(v,-.18,.18)),
   'Arm.R':armsR.map(v=>clamp(v,-.18,.18)),
   'Ear.L':earL.map(v=>clamp(v,-.14,.14)),
   'Ear.R':earR.map(v=>clamp(v,-.14,.14))
  };
  // Tail travels as a wave, progressively later from root to tip. V41 will
  // keep the exit velocity continuous into the next original gesture.
  for(let i=0;i<10;i++){
   const u=(i+1)/10,lag=cycle(p,1.6,-u*.18);
   tail(pose,i,tailX*u,tailY*u,tailZ*(.28+.72*u)+.013*lag*u*f);
  }
  return {pose,stage,face:{weights:faceWeights,eyelids:lids},envelope:e};
 }
 function sample({dt=0,mode='float',phase='hold',gesture=null,energy=.65,
  speed=0,attached=false,reading=false,reducedMotion=false,affectActive=false,
  attention={x:0,y:0},turn=0}={}){
  if(reducedMotion){active=null;countdown=12;return quiet();}
  const step=clamp(dt,0,.06);
  if(!step)return quiet();
  seconds+=step;
  // Continuous attention follows the page target, not a visitor identity.
  // These channels never control the body unless a safe miniature is active.
  const damping=1-Math.pow(.5,step/.22);
  gazeX+=(clamp(attention?.x,-1,1)-gazeX)*damping;
  gazeY+=(clamp(attention?.y,-1,1)-gazeY)*damping;
  turnFollow+=(clamp(turn,-1,1)-turnFollow)*(1-Math.pow(.5,step/.31));
  const name=typeof gesture==='string'?gesture:gesture?.name||'';
  const blocked=Boolean(name)||attached||reading||affectActive||
   phase!=='hold'||!Number.isFinite(speed)||speed>24||
   ['rest','settle','sleep','perch','perched'].includes(mode)||energy<.24;
  if(blocked){
   if(active){active=null;cancelled++;countdown=8+random()*9;}
   return quiet();
  }
  const category=['play','spin','dash'].includes(mode)?'play':
   ['peek','inspect','curious'].includes(mode)?'observe':
   ['float','orbit','swim','glide'].includes(mode)?'explore':'quiet';
  if(!active){
   countdown-=step;
   if(countdown>0)return quiet();
   const kind=select(category,clamp(energy));
   active={kind,age:0,duration:DURATIONS[kind]*(.89+.22*random()),
    side:random()<.5?-1:1,style:.86+.26*random()};started++;
   lastTwo.push(kind);if(lastTwo.length>2)lastTwo.shift();
  }
  active.age=Math.min(active.duration,active.age+step);
  const p=clamp(active.age/active.duration);
  const e=smooth(p/.17)*(1-smooth((p-.74)/.26));
  const data=body(active.kind,p,e,{side:active.side,style:active.style,
   gaze:{x:gazeX,y:gazeY},turn:turnFollow});
  const result={active:true,kind:active.kind,progress:p,...data};
  if(p>=1){active=null;completed++;countdown=9+random()*17;}
  return result;
 }
 function snapshot(){return {active:active?.kind||null,style:active?.style||null,
  side:active?.side||null,attention:{x:gazeX,y:gazeY},turn:turnFollow,
  started,completed,cancelled,lastTwo:[...lastTwo],cooldown:Math.max(0,countdown),seconds};}
 function reset(){active=null;countdown=6+random()*5;lastTwo=[];gazeX=gazeY=turnFollow=0;}
 return {sample,snapshot,reset};
}
