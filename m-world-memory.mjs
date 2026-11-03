/** Bounded tab-local familiarity. Only public component IDs and motion statistics. */
export const CHARACTER_MEMORY_KEY='m-world-character-memory-v24';
export const CHARACTER_MEMORY_LIMIT=24;
const ACTIONS=['inspect','peek','perch','orbit','rest'];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const safeId=value=>typeof value==='string'&&/^[a-z][a-z0-9:_-]{0,63}$/u.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const finite=value=>Number.isFinite(value)&&value>=0;
const copy=value=>structuredClone(value);
const empty=()=>({version:1,energy:.35,components:[],recent:[]});
function validState(value){
 if(!exact(value,['version','energy','components','recent'])||value.version!==1||!finite(value.energy)||value.energy>1
  ||!Array.isArray(value.components)||value.components.length>CHARACTER_MEMORY_LIMIT
  ||!Array.isArray(value.recent)||value.recent.length>6)return false;
 const ids=new Set();
 for(const item of value.components){
  if(!exact(item,['id','visits','dwellMs','lastSeenAt','lastVisitAt'])||!safeId(item.id)||ids.has(item.id)
   ||!Number.isInteger(item.visits)||item.visits<0||item.visits>99||!finite(item.dwellMs)||item.dwellMs>300_000
   ||!finite(item.lastSeenAt)||(item.lastVisitAt!==null&&!finite(item.lastVisitAt)))return false;
  ids.add(item.id);
 }
 return value.recent.every(item=>exact(item,['id','action','atMs'])&&ids.has(item.id)&&ACTIONS.includes(item.action)&&finite(item.atMs));
}
export function createSessionMemory({storage,now=Date.now}={}){
 let state=empty(),available=false,lastAt=0,lastSave=-Infinity;
 const clock=()=>{const value=now();if(finite(value))lastAt=Math.max(lastAt,value);return lastAt;};
 clock();
 try{
  storage??=globalThis.sessionStorage;
  const raw=storage?.getItem(CHARACTER_MEMORY_KEY);
  if(raw&&raw.length<=16_384){const value=JSON.parse(raw);if(validState(value))state=value;}
 }catch{ /* Corrupt or unavailable state never disables local behavior. */ }
 function persist(force=false){
  const at=clock();if(!force&&at-lastSave<500)return;
  try{
   const serialized=JSON.stringify(state);storage?.setItem(CHARACTER_MEMORY_KEY,serialized);
   available=Boolean(storage&&storage.getItem(CHARACTER_MEMORY_KEY)===serialized);lastSave=at;
  }catch{available=false;}
 }
 persist(true);
 function itemFor(id){
  let item=state.components.find(value=>value.id===id);
  if(item)state.components=state.components.filter(value=>value!==item);
  else item={id,visits:0,dwellMs:0,lastSeenAt:clock(),lastVisitAt:null};
  state.components.push(item);
  if(state.components.length>CHARACTER_MEMORY_LIMIT){const removed=state.components.shift();state.recent=state.recent.filter(value=>value.id!==removed.id);}
  return item;
 }
 function noteExposure(id,{dwellMs=0}={}){
  if(!safeId(id)||!finite(dwellMs)||dwellMs===0)return false;
  const item=itemFor(id);item.dwellMs=Math.min(300_000,item.dwellMs+Math.min(2000,dwellMs));item.lastSeenAt=clock();persist();return true;
 }
 function noteVisit(id,{action='inspect'}={}){
  if(!safeId(id)||!ACTIONS.includes(action))return false;
  const at=clock(),item=itemFor(id);item.visits=Math.min(99,item.visits+1);item.lastSeenAt=item.lastVisitAt=at;
  state.recent.push({id,action,atMs:at});state.recent=state.recent.slice(-6);persist(true);return true;
 }
 /** Higher means less familiar. Repetition relaxes with time, visits remain remembered. */
 function score(id){
  if(!safeId(id))return 0;
  const item=state.components.find(value=>value.id===id);if(!item)return 1;
  const recent=item.lastVisitAt===null?0:.25*Math.max(0,1-(clock()-item.lastVisitAt)/60_000);
  return clamp(1-Math.min(.6,item.visits*.12)-Math.min(.2,item.dwellMs/300_000*.2)-recent,.05,1);
 }
 /** deltaScroll is pixels; dtMs is milliseconds between pace observations. */
 function recordPace(deltaScroll=0,dtMs=1000){
  if(!Number.isFinite(deltaScroll)||!Number.isFinite(dtMs)||dtMs<=0)return state.energy;
  const dt=clamp(dtMs,16,5000),speed=clamp(Math.abs(deltaScroll)/dt*1000,0,1600);
  const target=.2+.7*speed/(speed+500),weight=1-Math.exp(-dt/1800);
  state.energy=clamp(state.energy+(target-state.energy)*weight,0,1);persist();return state.energy;
 }
 function snapshot(){return {energy:state.energy,components:copy(state.components),recent:copy(state.recent),storageAvailable:available};}
 function clear(){
  state=empty();lastSave=-Infinity;
  try{storage?.removeItem(CHARACTER_MEMORY_KEY);available=Boolean(storage);}catch{available=false;}
  return snapshot();
 }
 return {noteExposure,noteVisit,score,recordPace,snapshot,clear};
}