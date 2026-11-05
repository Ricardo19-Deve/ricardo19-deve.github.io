/** Pure local intentions. Existing scene/spatial executors own every physical effect. */
export const AUTONOMY_RESERVATION_MS=2000;
const MAX_TARGETS=64,MAX_HISTORY=24,MAX_RECENT=8;
const ACTIONS=['inspect','peek','perch','orbit'];
const validTime=value=>Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER-120_000;
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(value);
const safeReason=(value,fallback)=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,47}$/u.test(value)?value:fallback;
const clamp=(value,fallback=0)=>Math.max(0,Math.min(1,Number.isFinite(value)?value:fallback));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const clone=value=>value===null?null:structuredClone(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};

function targetsOf(value){
 if(!Array.isArray(value))return [];
 const targets=new Map();
 for(const raw of value.slice(0,MAX_TARGETS)){
  const target=object(raw);
  if(!safeId(target.id)||targets.has(target.id)||!Array.isArray(target.actions))continue;
  const actions=ACTIONS.filter(action=>target.actions.includes(action));
  const visibleShare=clamp(target.visibleShare,.7);
  if(!actions.length||visibleShare<.15)continue;
  targets.set(target.id,{id:target.id,stableId:safeId(target.stableId)?target.stableId:target.id,actions,
   novelty:clamp(target.novelty,.6),attention:clamp(target.attention,0),visibleShare,
   proximity:1/(1+Math.max(0,Math.min(10_000,Number.isFinite(target.distance)?target.distance:500))/500)});
 }
 return [...targets.values()].sort((a,b)=>a.id.localeCompare(b.id,'en'));
}

/**
 * choose reserves one intention; resolve accepts/rejects it; complete acknowledges actual work.
 * Time is caller-owned and monotonic. No wall clock, DOM, storage, network, or user text is read.
 */
export function createAutonomy({seed=18421}={}){
 let randomState=(Number.isFinite(seed)?Math.trunc(seed):18421)>>>0;
 const random=()=>{randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;};
 let serial=0,lastAt=0,nextDecisionAt=0,pending=null,active=null,reason='ready',lastOutcome=null;
 let completedCount=0,failedCount=0,lastAchievementAt=null,achievement=null,lastPlayAt=0;
 let routinesStartedAt=null,lastSleepAt=null;
 const history=new Map(),familyUntil=new Map(),recent=[];
 const time=value=>validTime(value)?Math.max(lastAt,value):null;
 const remember=(id,entry)=>{
  history.delete(id);history.set(id,entry);
  while(history.size>MAX_HISTORY)history.delete(history.keys().next().value);
 };
 const entryFor=id=>history.get(id)||{lastSuccessAt:null,successes:0,cooldownUntil:0};
 const hasTarget=choice=>choice.decision.targetId!==null;
 function outcome(choice,status,value,at){
  lastOutcome={id:choice.decision.id,kind:choice.decision.kind,status,reason:value,at};
 }
 function settle(at,delay=1600){nextDecisionAt=Math.max(nextDecisionAt,at+delay);}
 function release(value,at){
  const choice=active||pending;
  if(!choice)return false;
  outcome(choice,'cancelled',value,at);active=pending=null;reason=value;settle(at);return true;
 }
 function fail(choice,value,at){
  failedCount=Math.min(1_000_000,failedCount+1);
  if(hasTarget(choice)){
   const entry=entryFor(choice.stableId);
   remember(choice.stableId,{...entry,cooldownUntil:at+18_000+Math.floor(random()*6000)});
  }
  familyUntil.set(choice.family,at+5000);
  outcome(choice,'failed',value,at);reason=value;settle(at,2500);
 }
 function expire(at){
  if(!pending||at<pending.expiresAt)return;
  outcome(pending,'expired','reservation-expired',at);pending=null;
  reason='reservation-expired';settle(at,1000);
 }
 function routineNeeds(at){
  const awakeMs=Math.max(0,at-(lastSleepAt??routinesStartedAt??at));
  return {napUrge:clamp(awakeMs/90_000),awakeMs:Math.min(600_000,awakeMs),lastSleepAt};
 }
 function snapshot(){
  return {status:active?'active':pending?'pending':'idle',current:clone((active||pending)?.decision??null),
   active:clone(active?.decision??null),pending:clone(pending?.decision??null),
   reservationUntil:pending?.expiresAt??null,nextDecisionAt,reason,lastOutcome:clone(lastOutcome),
   completedCount,failedCount,achievementPending:achievement!==null,
   ...(routinesStartedAt===null?{}:{needs:routineNeeds(lastAt)}),
   recent:[...recent],targetHistory:[...history].map(([id,entry])=>({id,...entry}))};
 }
 function choose(facts={}){
  facts=object(facts);
  const at=time(facts.nowMs);
  if(at===null){reason='invalid-time';return null;}
  lastAt=at;
  const routinesAvailable=facts.routinesAvailable===true;
  if(routinesAvailable&&routinesStartedAt===null)routinesStartedAt=at;
  const context=object(facts.context);
  const blocked=context.active===false?'inactive':context.hidden?'hidden':context.reducedMotion?'reduced-motion':
   context.typing?'typing':context.selection?'selection':context.scrolling?'scrolling':null;
  if(blocked){release(blocked,at);reason=blocked;settle(at);return null;}
  // Commitment is hysteresis: external work/reading cannot replace an accepted intention.
  if(active){reason='active';return null;}
  expire(at);
  if(context.busy||facts.remotePending){
   const value=context.busy?'busy':'remote-pending';
   release(value,at);reason=value;settle(at,1000);return null;
  }
  const reading=Boolean(context.reading);
  if(pending){
   if(reading&&!pending.decision.quiet)release('reading',at);
   else{reason='reserved';return clone(pending.decision);}
  }
  if(at<nextDecisionAt){reason='cooldown';return null;}
  if(achievement&&at>=achievement.expiresAt)achievement=null;
  const energy=clamp(facts.energy,.65),restNeed=1-smooth(energy);
  const playNeed=clamp((at-lastPlayAt)/40_000,.5);
  const curiosity=clamp((at-(lastAchievementAt??0))/30_000,.5);
  const napUrge=routineNeeds(at).napUrge;
  const requestedGoal=object(facts.goal),goal=['follow-light','find-lookout','revisit-lookout'].includes(requestedGoal.id)?requestedGoal:null;
  const availableTargets=targetsOf(facts.targets);
  // V31: the optional, bounded local learning profile never outranks safety.
  // Omitted profile preserves the exact legacy deterministic test behavior.
  const habits=object(facts.habits),learned=object(habits.weights);
  const openers=['explore','play','observe'];
  const opening=completedCount===0&&openers.includes(habits.opening)?habits.opening:null;
  const candidates=[];
  const add=(family,score,decision,stableId=null)=>{
   if(at<(familyUntil.get(family)||0))return;
   const repeats=recent.filter(value=>value===family).length;
   const variety=Math.pow(.68,repeats)*(recent.at(-1)===family?.3:1);
   const memoryWeight=Number.isFinite(learned[family])?Math.max(.7,Math.min(1.2,learned[family])):1;
   const openingWeight=opening==='explore'?(['inspect','peek','orbit'].includes(family)?1.32:family==='goal-light'?.58:1):
    opening==='play'?(['light','ball','hop'].includes(family)?1.3:family==='goal-light'?.82:1):
    opening==='observe'?(['observe','think','rest'].includes(family)?1.44:family==='goal-light'?.44:1):1;
   candidates.push({family,stableId,score:clamp(score*memoryWeight*openingWeight)*variety,
    decision:{kind:'expression',targetId:null,action:'rest',gesture:'none',expression:'neutral',
     affect:'calm',play:null,quiet:true,reason:family,...decision}});
  };
  if(!reading){
   for(const target of availableTargets){
    if(at<entryFor(target.stableId).cooldownUntil)continue;
    const {novelty:n,visibleShare:v,proximity:p,attention:a}=target;
    for(const action of target.actions){
     if(action==='inspect')add('inspect',.20+.28*n+.16*v+.12*p+.12*energy+.12*curiosity+.14*a,
      {kind:'scene',targetId:target.id,action,gesture:'curious',expression:'curious',affect:'focus',quiet:false},target.stableId);
     if(action==='peek')add('peek',.14+.18*n+.18*v+.10*p+.22*energy+.18*playNeed+.07*a,
      {kind:'scene',targetId:target.id,action,gesture:'playful',expression:'happy',affect:'mischief',play:'hide',quiet:false},target.stableId);
     if(action==='perch')add('perch',.15+.14*(1-n)+.17*v+.13*p+.31*restNeed+.10*(1-playNeed)+.09*a,
      {kind:'scene',targetId:target.id,action,gesture:'nod',expression:'happy',affect:'content',quiet:false},target.stableId);
     if(action==='orbit')add('orbit',.12+.22*n+.15*v+.11*p+.25*energy+.15*playNeed+.07*a,
      {kind:'scene',targetId:target.id,action,gesture:'curious',expression:'curious',affect:'anticipation',quiet:false},target.stableId);
    }
   }
   if(facts.selfPlayAvailable===true&&energy>.25)add('light',.19+.31*smooth(energy)+.30*playNeed+.20*curiosity,
    {kind:'self-play',gesture:'playful',expression:'happy',affect:'anticipation',play:'light',quiet:false});
   if(facts.ballPlayAvailable===true&&energy>.3)add('ball',.20+.27*smooth(energy)+.31*playNeed+.14*curiosity,
    {kind:'self-play',gesture:'paw',expression:'happy',affect:'anticipation',play:'ball',quiet:false});
   if(routinesAvailable&&energy>.4)add('hop',.13+.24*smooth(energy)+.28*playNeed+.12*curiosity,
    {gesture:'hop',expression:'happy',affect:'joyful',quiet:false});
   if(goal?.id==='follow-light'&&facts.selfPlayAvailable===true&&energy>.25)add('goal-light',.65+.35*smooth(energy),
    {kind:'self-play',gesture:'playful',expression:'happy',affect:'anticipation',play:'light',quiet:false,reason:'follow-light',characterGoal:goal.id});
   if(['find-lookout','revisit-lookout'].includes(goal?.id)){
    const target=availableTargets.find(value=>value.id===goal.targetId&&value.actions.includes('perch'));
    if(target&&at>=entryFor(target.stableId).cooldownUntil)add('goal-lookout',.88+.12*restNeed,
     {kind:'scene',targetId:target.id,action:'perch',gesture:'nod',expression:'happy',affect:goal.id==='find-lookout'?'proud':'content',quiet:false,reason:goal.id,characterGoal:goal.id},target.stableId);
    else if(goal.targetId===null&&safeId(goal.restingPlace)&&at>=entryFor(goal.restingPlace).cooldownUntil)add('goal-lookout',.88+.12*restNeed,
     {kind:'expression',gesture:'nod',expression:'happy',affect:goal.id==='find-lookout'?'proud':'content',quiet:false,reason:goal.id,characterGoal:goal.id},goal.restingPlace);
   }
   if(achievement)add('achievement',1,{expression:'happy',affect:achievement.affect,reason:'achievement'});
  }
  add('observe',reading?.72:.24+.17*curiosity+.10*(1-restNeed),
   {expression:'curious',affect:'focus',reason:reading?'quiet-observe':'observe'});
  add('rest',reading?.62+.25*restNeed:.17+.61*restNeed,
   {kind:'rest',affect:energy<.3?'sleepy':'calm',reason:reading?'quiet-rest':'rest'});
  if(routinesAvailable){
   add('think',(reading?.36:.18)+.22*curiosity+.12*(1-playNeed)+.12*(1-restNeed),
    {gesture:'think',expression:'curious',affect:'pondering',quiet:reading});
   add('sleep',.17+.55*restNeed+.38*smooth(napUrge),
    {kind:'rest',gesture:'sleep',affect:'dozing',quiet:true});
  }
  if(!candidates.length){reason='unavailable';settle(at,1000);return null;}
  // A persistent intention focuses attention while rest and safety remain available.
  if(candidates.some(value=>value.decision.characterGoal))for(const candidate of candidates){if(!candidate.decision.characterGoal&&candidate.decision.kind!=='rest'&&candidate.family!=='observe')candidate.score*=.72;}
  // A low-temperature softmax adds reproducible variety without ignoring strong needs.
  candidates.sort((a,b)=>(a.family+':'+(a.decision.targetId||'')).localeCompare(b.family+':'+(b.decision.targetId||''),'en'));
  const peak=Math.max(...candidates.map(value=>value.score));
  // More cards create more routes, not a greater need to explore instead of resting.
  const counts=new Map();
  for(const candidate of candidates)counts.set(candidate.family,(counts.get(candidate.family)||0)+1);
  const weights=candidates.map(value=>Math.exp((value.score-peak)/.12)/counts.get(value.family));
  let roll=random()*weights.reduce((sum,value)=>sum+value,0),index=weights.length-1;
  for(let i=0;i<weights.length;i++){roll-=weights[i];if(roll<=0){index=i;break;}}
  const selected=candidates[index];
  // An independently chosen gesture variant gives each inspection a different
  // emotional beat, without changing the original 31-bone rig or action plan.
  // Explicit/manual actions and unprofiled test simulations are unaffected.
  if(opening!==null||Object.keys(learned).length){
   const palettes={
    inspect:['curious','nod','shy','wink'],peek:['playful','shy','wink'],
    perch:['nod','curious','shy'],orbit:['curious','surprised','nod']
   };
   const gestures=palettes[selected.decision.action];
   if(selected.decision.kind==='scene'&&gestures){
    const gesture=gestures[Math.floor(random()*gestures.length)];
    selected.decision.gesture=gesture;
    selected.decision.expression=['surprised'].includes(gesture)?'surprised':
     ['shy'].includes(gesture)?'neutral':
     ['curious'].includes(gesture)?'curious':'happy';
   }
  }
  const satisfiesGoal=goal?.id==='follow-light'&&selected.decision.play==='light'||['find-lookout','revisit-lookout'].includes(goal?.id)&&selected.decision.action==='perch'&&selected.decision.targetId===goal.targetId;
  const decision={id:'autonomy-'+(++serial),...selected.decision,...(satisfiesGoal?{characterGoal:goal.id}:{})};
  pending={decision,stableId:selected.stableId,family:selected.family,expiresAt:at+AUTONOMY_RESERVATION_MS};
  reason=decision.reason;return clone(decision);
 }
 function resolve(id,{accepted=false,nowMs=lastAt}={}){
  const at=time(nowMs);
  if(at===null||!pending||pending.decision.id!==id)return false;
  lastAt=at;expire(at);
  if(!pending)return false;
  const choice=pending;pending=null;
  if(accepted!==true){fail(choice,'rejected',at);return true;}
  active=choice;reason='active';recent.push(choice.family);
  if(recent.length>MAX_RECENT)recent.shift();
  // An accepted proposal is an attempt, never a visit or an achievement.
  return true;
 }
 function complete({success,reason:resultReason,nowMs=lastAt}={}){
  const at=time(nowMs);
  if(at===null||!active||typeof success!=='boolean')return false;
  lastAt=at;const choice=active;active=null;
  if(!success){fail(choice,safeReason(resultReason,'execution-failed'),at);return true;}
  completedCount=Math.min(1_000_000,completedCount+1);
  if(hasTarget(choice)){
   const entry=entryFor(choice.stableId);
   remember(choice.stableId,{lastSuccessAt:at,successes:Math.min(1000,entry.successes+1),
    cooldownUntil:at+9000+Math.floor(random()*6000)});
  }
  if(choice.decision.kind==='scene'||choice.decision.kind==='self-play'){
   lastAchievementAt=at;achievement={affect:choice.decision.kind==='self-play'?'proud':'delight',expiresAt:at+14_000};
   if(choice.decision.play!==null)lastPlayAt=at;
  }else if(choice.family==='achievement')achievement=null;
  // Only an acknowledged finished performance satisfies these physical needs.
  // Proposals, failures, cancellations and story-memory resets cannot fake rest.
  if(choice.family==='sleep')lastSleepAt=at;
  if(choice.family==='hop')lastPlayAt=at;
  const delay=choice.family==='achievement'?2800:choice.decision.quiet?4500:2000;
  familyUntil.set(choice.family,at+6500+Math.floor(random()*4000));
  outcome(choice,'complete',safeReason(resultReason,'completed'),at);reason='complete';
  nextDecisionAt=at+delay+Math.floor(random()*1400);return true;
 }
 function cancel(value='cancelled',nowMs=lastAt){
  const at=time(nowMs);
  if(at===null)return false;
  lastAt=at;return release(safeReason(value,'cancelled'),at);
 }
 function resetMemory(nowMs=lastAt){
  const at=time(nowMs);if(at===null)return false;lastAt=at;
  release('memory-reset',at);history.clear();recent.length=0;familyUntil.clear();
  achievement=null;lastAchievementAt=null;lastPlayAt=at;nextDecisionAt=at+1600;reason='memory-reset';return true;
 }
 return {choose,resolve,complete,cancel,resetMemory,snapshot};
}
