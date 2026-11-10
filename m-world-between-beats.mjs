/**
 * M V54 — quiet presence between authored actions on the ORIGINAL V6 rig.
 *
 * The character's visual attention never needs a separate AI call, identity
 * tracker, visitor memory, new UI control, extra model or fabricated scene
 * interaction. Tiny head/ear/tail reactions follow only existing page-world
 * attention and turn signals. Major gestures, play and rest take priority.
 */
import {dampChannel} from './m-world-pose-handoff.mjs?v=66';

const bound=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:min));
const norm=v=>bound(v,-1,1);
const tailNames=Object.freeze(Array.from({length:10},(_,i)=>'Tail.'+String(i+1).padStart(2,'0')));
const zero=()=>({active:false,pose:{},face:null,engagement:0,mode:'quiet',pulse:0});

function randomSequence(seed){
 let x=(Number.isFinite(seed)?Math.trunc(seed):1)>>>0||0x9e3779b9;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}

export function createBetweenBeats({seed=1}={}){
 const random=randomSequence(seed);
 const yaw={position:0,velocity:0},pitch={position:0,velocity:0},
  interest={position:0,velocity:0};
 const tail=tailNames.map(()=>({position:0,velocity:0}));
 let elapsed=0,frames=0,reacted=0,quietSeconds=0,cycleAge=0,cycleLength=0,
  nextPulse=4+random()*8,looks=0,lastX=0,lastY=0,active=false,mode='quiet',
  surprise=0;

 function reset(){
  for(const channel of [yaw,pitch,interest,...tail]){channel.position=0;channel.velocity=0;}
  elapsed=frames=reacted=quietSeconds=cycleAge=cycleLength=looks=surprise=0;
  lastX=lastY=0;active=false;mode='quiet';nextPulse=4+random()*8;
 }
 function follow(channel,target,dt,halfLife){
  const next=dampChannel(channel.position,channel.velocity,target,dt,halfLife);
  channel.position=next.position;channel.velocity=next.velocity;
  return next.position;
 }
 function sample({dt=0,mode:activity='float',phase='hold',energy=.6,speed=0,
  attention={x:0,y:0},turn=0,gesture=null,attached=false,
  reading=false,miniActive=false,affectActive=false,reducedMotion=false}={}){
  if(reducedMotion){reset();return zero();}
  const step=bound(dt,0,.06);
  if(!step)return zero();
  elapsed+=step;frames++;
  const name=typeof gesture==='string'?gesture:gesture?.name||'';
  const blocked=Boolean(name)||attached||reading||affectActive||
   phase!=='hold'||!Number.isFinite(speed)||speed>24||
   ['rest','settle','sleep','perch','perched'].includes(activity)||energy<.25;
  const awaked=!blocked&&!miniActive;
  // Follow existing intent at distinct speeds even when animation is
  // suppressed. V41 manages the continuous exit of displayed bone layers.
  const x=norm(attention?.x),y=norm(attention?.y),rotation=norm(turn);
  const change=Math.hypot(x-lastX,y-lastY);
  lastX=x;lastY=y;
  if(awaked&&change>.16){
   surprise=Math.max(surprise,Math.min(.55,change*.35));
   reacted++;
  }
  surprise*=Math.exp(-step/1.1);
  const gaze=follow(yaw,awaked?x*.033+rotation*.024:0,step,.23);
  const nod=follow(pitch,awaked?y*.025:0,step,.32);
  const engage=follow(interest,awaked?bound(.20+energy*.55,0,.85):0,step,.24);
  for(let i=0;i<tail.length;i++){
   const u=(i+1)/tail.length;
   const target=awaked?(gaze*.15+rotation*.018+surprise*.014)*u:0;
   follow(tail[i],target,step,.11+.18*u);
  }
  if(!awaked){
   active=false;mode=blocked?'blocked':'playing';
   return zero();
  }
  mode=activity;active=true;quietSeconds+=step;
  nextPulse-=step;
  if(nextPulse<=0&&!cycleLength){
   cycleLength=1.5+random()*1.4;cycleAge=0;looks++;
  }
  let pulse=0;
  if(cycleLength){
   cycleAge=Math.min(cycleLength,cycleAge+step);
   const p=cycleAge/cycleLength;
   pulse=Math.pow(Math.sin(Math.PI*p),2);
   if(cycleAge>=cycleLength){
    cycleLength=0;cycleAge=0;nextPulse=5+random()*12;
   }
  }
  const restless=activity==='peek'||activity==='inspect'||activity==='curious';
  const emphasis=restless?1:.6;
  const curiosity=bound((.035+.09*pulse+.08*surprise)*emphasis*engage,0,.23);
  const happy=bound((.028+.045*pulse)*engage,0,.09);
  const poses={
   Head:[bound(-.016*curiosity-.007*pulse,-.025,.025),
    bound(gaze,-.075,.075),bound(nod+.012*pulse*emphasis,-.055,.055)],
   Neck:[bound(-.005*curiosity,-.013,.013),
    bound(gaze*.42,-.034,.034),bound(nod*.4,-.026,.026)],
   'Ear.L':[bound(-curiosity*.21,-.04,.04),0,bound(curiosity*.23+.016*surprise,-.06,.06)],
   'Ear.R':[bound(-curiosity*.17,-.04,.04),0,bound(-curiosity*.22-.008*surprise,-.06,.06)]
  };
  tailNames.forEach((key,i)=>{
   const u=(i+1)/tailNames.length;
   poses[key]=[0,0,bound(tail[i].position+.004*pulse*Math.sin(2*Math.PI*(elapsed*.34-u*.19))*u,-.035,.035)];
  });
  return {active:true,pose:poses,
   face:{weights:{happy,curious:curiosity,surprised:bound(surprise*.11*engage,0,.07)},
    eyelids:{left:bound(.012+.022*pulse,0,.045),right:bound(.012+.019*pulse,0,.045)}},
   engagement:engage,mode,pulse};
 }
 function snapshot(){return {active,mode,frames,quietSeconds,reacted,looks,
  pulseActive:cycleLength>0,head:{yaw:yaw.position,pitch:pitch.position},
  tail:tail.map(c=>c.position),interest:interest.position};}
 return {sample,reset,snapshot};
}
