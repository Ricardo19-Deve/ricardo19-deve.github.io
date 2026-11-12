import {weatherPresentation} from './m-world-weather-behavior.mjs?v=66';
/** Shared physical motivation and presentation, not another action executor.
 * The controller supplies accepted work and acknowledges real terminal outcomes.
 * No visitor pace, wall clock, storage, randomness, network or page text is read.
 */
/** Accepted activity, then short acknowledged-outcome carry; never a new action.
 * recover is quiet rest/perching; sleep requires an actual sleep gesture.
 * reflect/wake after activity require successful owner acknowledgement.
 */
export const CHARACTER_INTENTS=Object.freeze([
 'idle','observe','investigate','play','recover','sleep','think','reflect','wake','social'
]);
const clamp=(value,lo,hi,fallback=lo)=>Math.min(hi,Math.max(lo,Number.isFinite(value)?value:fallback));
const validTime=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER-120_000;
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(value);
const KINDS=new Set(['scene','self-play','expression','rest']);
const ACTIONS=new Set(['inspect','peek','perch','orbit','rest']);
const GESTURES=new Set(['none','wave','curious','surprised','shy','playful','wink','nod','sleep','hop','think','paw']);
const PLAYS=new Set(['light','ball','hide']);
const TARGETS=Object.freeze({
 idle:[.20,.06,.16,'neutral'],observe:[.27,.08,.60,'curious'],
 investigate:[.43,.18,.88,'curious'],play:[.64,.70,.56,'happy'],
 recover:[.11,.18,.12,'neutral'],sleep:[.025,.10,0,'neutral'],
 think:[.24,.10,.74,'curious'],reflect:[.23,.18,.62,'curious'],
 wake:[.19,.24,.28,'neutral'],social:[.44,.52,.66,'happy']
});
const follow=(from,to,dt,tau)=>from+(to-from)*(1-Math.exp(-dt/tau));
function validDecision(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&safeId(value.id)
  &&KINDS.has(value.kind)&&ACTIONS.has(value.action)
  &&(value.gesture===undefined||GESTURES.has(value.gesture))
  &&(value.play===undefined||value.play===null||PLAYS.has(value.play))
  &&(value.targetId===undefined||value.targetId===null||safeId(value.targetId))
  &&(value.kind!=='scene'||safeId(value.targetId))
  &&(value.kind!=='self-play'||PLAYS.has(value.play));
}
function intention(value){
 if(value.gesture==='sleep')return 'sleep';
 if(value.gesture==='think')return 'think';
 if(value.play||value.gesture==='hop'||value.gesture==='paw'||value.gesture==='playful'||value.action==='peek')return 'play';
 if(value.action==='perch'||value.kind==='rest')return 'recover';
 if(value.action==='inspect'||value.action==='orbit')return 'investigate';
 if(value.gesture==='wave'||value.gesture==='wink')return 'social';
 if(value.reason==='achievement')return 'reflect';
 if(value.reason==='observe'||value.reason==='quiet-observe'||value.gesture==='curious')return 'observe';
 return 'idle';
}
/** Physical energy is independent from the visitor's scrolling rhythm. */
export function creatureEnergy(input={}){
 const {fatigue=0}=input??{};
 return clamp(.82-(Number.isFinite(fatigue)?fatigue:0),.2,.94);
}
/** Reused sample: energy/arousal/focus [0,1], valence [-1,1], eventAge seconds.
 * phase: idle/anticipation/engaged/settling/waking/interrupted/reading/blocked.
 * snapshot() alone allocates a copy; record() alone allocates bounded history.
 */
export function createCharacterState(){
 const output={intent:'idle',phase:'idle',energy:.7,arousal:0,valence:0,focus:0,
  mood:'neutral',eventId:null,eventAge:0,reading:false,blocked:false};
 const seen=new Set(),recent=[];
 let now=0,lastRecordAt=0,lastEvent=null,successful=null,activeId=null,activeAt=0,
  pendingMood='neutral',moodAge=0,appliedWeather=null;
 function record(event={}){
  if(!event||typeof event!=='object'||Array.isArray(event))return false;
  const {decision,status,at}=event;
  // These are owner acknowledgements, never proposals or inferred visits.
  if(!validDecision(decision)||!['complete','failed','cancelled'].includes(status)
   ||!validTime(at)||at<lastRecordAt||seen.has(decision.id))return false;
  seen.add(decision.id);recent.push(decision.id);if(recent.length>32)seen.delete(recent.shift());
  lastRecordAt=at;now=Math.max(now,at);
  lastEvent={id:decision.id+':'+status,status,at,intent:intention(decision)};
  successful=status==='complete'?lastEvent:null;
  return true;
 }
 function sample(input={}){
  const {dt=0,nowMs=0,energy=.7,active=null,reading=false,typing=false,
   scrolling=false,reducedMotion=false,hidden=false,nearCard=false,weather=null}=input??{};
  appliedWeather=null;
  output.energy=clamp(energy,0,1,.7);output.reading=reading===true;
  const validClock=validTime(nowMs),validStep=Number.isFinite(dt)&&dt>=0;
  if(validClock)now=Math.max(now,nowMs);
  output.blocked=!validClock||!validStep||typing===true||scrolling===true||reducedMotion===true||hidden===true;
  if(output.blocked){
   output.intent='idle';output.phase='blocked';output.arousal=output.valence=output.focus=0;
   output.mood='neutral';output.eventId=null;output.eventAge=0;
   pendingMood='neutral';moodAge=0;activeId=null;return output;
  }
  const step=Math.min(dt,.06),accepted=validDecision(active)?active:null;
  let intent=accepted?intention(accepted):'idle',phase=accepted?'engaged':'idle';
  if(accepted){
   if(activeId!==accepted.id){activeId=accepted.id;activeAt=now;}
   if(now-activeAt<650)phase='anticipation';
  }else activeId=null;
  const age=lastEvent?Math.max(0,(now-lastEvent.at)/1000):0;
  output.eventId=lastEvent&&age<12?lastEvent.id:null;output.eventAge=output.eventId?age:0;
  let carry=successful&&age<12?Math.exp(-age/4.5):0;
  if(!accepted&&carry>.1){
   const rested=successful.intent==='sleep'||successful.intent==='recover';
   intent=rested?'wake':'reflect';phase=rested?'waking':'settling';
  }else if(!accepted&&lastEvent&&lastEvent.status!=='complete'&&age<1.6)phase='interrupted';
  const target=TARGETS[intent];
  let arousal=target[0]*(.30+.70*output.energy),valence=target[1],focus=target[2],mood=target[3];
  if(carry>0){
   const eventTarget=TARGETS[successful.intent];
   if(accepted){valence=clamp(valence+eventTarget[1]*carry*.18,-1,1);focus=clamp(focus+eventTarget[2]*carry*.08,0,1);}
   else{
    arousal=TARGETS.idle[0]*(1-carry)+eventTarget[0]*.55*carry;
    valence=TARGETS.idle[1]*(1-carry)+eventTarget[1]*carry;
    focus=TARGETS.idle[2]*(1-carry)+eventTarget[2]*.8*carry;
    mood=successful.intent==='play'||successful.intent==='social'?'happy':successful.intent==='investigate'||successful.intent==='think'?'curious':'neutral';
   }
  }else if(!accepted&&lastEvent&&lastEvent.status!=='complete'){
   valence=-.08*Math.exp(-age/1.6);mood='neutral';
  }
  if(accepted?.gesture==='surprised')mood='surprised';
  if(nearCard===true&&intent!=='sleep'&&intent!=='recover')focus=Math.min(1,focus+.08);
  // The same cached forecast that motivates a choice colours its presentation.
  // Existing intent, acknowledged experience, sleep and safety remain the owners.
  const forecast=weatherPresentation(weather);
  if(intent!=='sleep'&&intent!=='recover'&&forecast.condition!=='unknown'){
   appliedWeather=forecast;
   arousal+=forecast.arousalOffset;
   focus=clamp(focus+forecast.focusOffset,0,1);
   valence=clamp(valence+forecast.valenceOffset,-1,1);
  }
  arousal=Math.min(arousal,.035+.76*output.energy);
  if(output.reading){arousal*=.35;focus=Math.min(focus,.65);phase='reading';}
  output.arousal=follow(output.arousal,clamp(arousal,0,1),step,arousal>output.arousal?.28:.85);
  output.valence=follow(output.valence,clamp(valence,-1,1),step,.65);
  output.focus=follow(output.focus,clamp(focus,0,1),step,focus>output.focus?.18:.55);
  if(mood!==pendingMood){pendingMood=mood;moodAge=0;}else moodAge+=step;
  if(moodAge>=.18)output.mood=pendingMood;
  output.intent=intent;output.phase=phase;
  return output;
 }
 function snapshot(){const result={...output};if(appliedWeather)result.weatherContext=appliedWeather;return result;}
 function reset(){
  seen.clear();recent.length=0;now=lastRecordAt=activeAt=moodAge=0;lastEvent=successful=activeId=appliedWeather=null;pendingMood='neutral';
  Object.assign(output,{intent:'idle',phase:'idle',energy:.7,arousal:0,valence:0,focus:0,mood:'neutral',eventId:null,eventAge:0,reading:false,blocked:false});
 }
 return {record,sample,snapshot,reset};
}
