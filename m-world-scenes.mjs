/** Local scene sequencing. The controller owns all paths, poses and safety checks. */
export const SCENE_MAX_ACTIVE_MS=70_000;
export const SCENE_STEP_TIMEOUT_MS=35_000;
const ACTIONS=['inspect','peek','perch','orbit','rest'];
const TRAVEL=['peek','perch','orbit'];
const GESTURES=['none','wave','curious','surprised','shy','playful','wink','nod'];
const EXPRESSIONS=['neutral','happy','curious','surprised'];
const SOURCES=['life','director','visitor','assistant','game'];
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const clone=value=>value===null?null:structuredClone(value);
const validTime=value=>Number.isFinite(value)&&value>=0;
const safeReason=value=>typeof value==='string'&&/^[a-z][a-z0-9-]{0,47}$/u.test(value)?value:'cancelled';

/** One high-level intention becomes a short local sequence, with no extra API call. */
export function createScenePlan({targetId=null,action='inspect',gesture='curious',expression='curious',source='life',actions=[]}={}){
 if(!ACTIONS.includes(action)||!GESTURES.includes(gesture)||!EXPRESSIONS.includes(expression)||!SOURCES.includes(source))return null;
 if(action!=='rest'&&!safeId(targetId))return null;
 if(action==='rest'&&targetId!==null&&!safeId(targetId))return null;
 if(!Array.isArray(actions)||actions.some(value=>!ACTIONS.includes(value))||new Set(actions).size!==actions.length)return null;
 // A nonempty offer is authoritative: never add an action the planner did not offer.
 if(actions.length&&!actions.includes(action))return null;
 const steps=[];
 const timed=(type,durationMs)=>steps.push({type,targetId,expression,durationMs});
 const travel=kind=>steps.push({type:'travel',targetId,expression,action:kind});
 if(action==='rest')timed('rest',1400);
 else{
  timed('look',700);
  if(TRAVEL.includes(action))travel(action);
  if(gesture!=='none')steps.push({type:'gesture',targetId,expression,gesture});
  if(['peek','orbit'].includes(action)&&actions.includes('perch'))travel('perch');
  timed('rest',1400);
 }
 return {targetId,source,steps};
}

function validPlan(plan){
 if(!exact(plan,['targetId','source','steps'])||!SOURCES.includes(plan.source)
  ||(plan.targetId!==null&&!safeId(plan.targetId))||!Array.isArray(plan.steps)||!plan.steps.length||plan.steps.length>6)return false;
 return plan.steps.every(command=>{
  if(!command||command.targetId!==plan.targetId||!EXPRESSIONS.includes(command.expression))return false;
  if(command.type==='look'||command.type==='rest')return exact(command,['type','targetId','expression','durationMs'])
   &&Number.isFinite(command.durationMs)&&command.durationMs>=100&&command.durationMs<=3000
   &&(command.type!=='look'||plan.targetId!==null);
  if(command.type==='travel')return exact(command,['type','targetId','expression','action'])&&safeId(plan.targetId)&&TRAVEL.includes(command.action);
  return command.type==='gesture'&&exact(command,['type','targetId','expression','gesture'])
   &&safeId(plan.targetId)&&GESTURES.includes(command.gesture)&&command.gesture!=='none';
 });
}

/** Stable command IDs require explicit completion for physical travel and gestures. */
export function createScenePlayer(){
 let serial=0,current=null,status='idle',reason=null,index=0,elapsedMs=0,stepMs=0,lastAt=0,wasBlocked=false;
 const command=()=>current&&status==='playing'?{...current.steps[index],id:current.id+':'+index}:null;
 function snapshot(){
  const active=command();
  return {id:current?.id??null,status,stage:active?(active.type==='gesture'?'react':active.type):null,
   source:current?.source??null,targetId:current?.targetId??null,command:clone(active),elapsedMs,reason};
 }
 function cancel(value='cancelled'){
  if(status!=='playing')return false;
  status='cancelled';reason=safeReason(value);return true;
 }
 function advance(){
  index++;stepMs=0;
  if(index>=current.steps.length){status='complete';reason=null;}
 }
 function start(plan,{nowMs=0}={}){
  if(status==='playing'||!validPlan(plan)||!validTime(nowMs))return false;
  current={...clone(plan),id:'scene-'+(++serial)};status='playing';reason=null;
  index=0;elapsedMs=stepMs=0;lastAt=nowMs;wasBlocked=false;return true;
 }
 function step({nowMs=lastAt,blocked=false,targetAvailable=true}={}){
  if(status!=='playing'||!validTime(nowMs))return snapshot();
  const at=Math.max(lastAt,nowMs),delta=blocked||wasBlocked?0:at-lastAt;
  lastAt=at;wasBlocked=Boolean(blocked);
  if(current.targetId!==null&&targetAvailable===false){cancel('target-unavailable');return snapshot();}
  if(blocked)return snapshot();
  elapsedMs+=delta;stepMs+=delta;
  if(elapsedMs>=SCENE_MAX_ACTIVE_MS){cancel('scene-timeout');return snapshot();}
  const next=command();
  if(next.type==='look'||next.type==='rest'){if(stepMs>=next.durationMs)advance();}
  else if(stepMs>=(next.type==='gesture'?10_000:SCENE_STEP_TIMEOUT_MS))cancel('step-timeout');
  return snapshot();
 }
 function complete(commandId,{success=true,reason:failure='execution-failed'}={},nowMs=lastAt){
  if(status!=='playing'||command()?.id!==commandId||!validTime(nowMs))return false;
  // Only the owner acknowledges physical effects; timed holds belong to this clock.
  if(!['travel','gesture'].includes(current.steps[index].type))return false;
  step({nowMs,blocked:wasBlocked});
  if(status!=='playing'||command()?.id!==commandId)return false;
  if(!success){cancel(failure);return true;}
  advance();return true;
 }
 return {start,step,complete,cancel,snapshot};
}