/**
 * M V31 — private, bounded experience learning across visits.
 *
 * No visitor IDs, prompts, page text, network activity or paid AI. This is
 * reinforcement of observable LOCAL autonomous outcomes, not LLM training.
 * The visitor's existing "Remember M" preference remains authoritative.
 */
export const M_GROWTH_STORAGE_KEY='m-world-growth-v31';
export const GROWTH_FAMILIES=Object.freeze([
 'inspect','peek','perch','orbit','light','ball','hop','think','sleep','observe','rest',
 'goal-light','goal-lookout','achievement'
]);
const MAX_COUNT=100000,MAX_BYTES=3000;
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_COUNT;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'));
const empty=day=>({version:1,day,days:1,opens:1,completed:0,attempts:0,recent:[],wins:{},failures:{}});
const valid=(v)=>{
 if(!exact(v,['version','day','days','opens','completed','attempts','recent','wins','failures'])
    ||v.version!==1||!isoDate(v.day)||!count(v.days)||!count(v.opens)
    ||!count(v.completed)||!count(v.attempts)||v.completed>v.attempts
    ||!Array.isArray(v.recent)||v.recent.length>8||v.recent.some(x=>!GROWTH_FAMILIES.includes(x)))return false;
 for(const table of [v.wins,v.failures]){
  if(!table||typeof table!=='object'||Array.isArray(table))return false;
  if(Object.keys(table).some(k=>!GROWTH_FAMILIES.includes(k)||!count(table[k])))return false;
 }
 return true;
};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
export function lisbonGrowthDay(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const pick=type=>parts.find(x=>x.type===type)?.value;
 return [pick('year'),pick('month'),pick('day')].join('-');
}
/** Independent private randomness per page load, never a stable visitor identifier.
 * Deterministic engines still accept explicit test seeds unchanged.
 */
export function makeLivingSeed({cryptoImpl=globalThis.crypto,random=Math.random,now=Date.now}={}){
 try{
  if(typeof cryptoImpl?.getRandomValues==='function'){
   const words=new Uint32Array(1);cryptoImpl.getRandomValues(words);
   if(words[0]!==0)return words[0];
  }
 }catch{}
 let t=0,r=0;
 try{t=Number(now());}catch{}
 try{r=Number(random());}catch{}
 return ((Math.trunc(Number.isFinite(t)?t:0)^Math.trunc(clamp(r,0,.999999999)*4294967296))>>>0)||18421;
}
export function createGrowthMemory({storage,now=Date.now,remember=true}={}){
 let enabled=remember===true,available=false,lastSavedDay=null;
 try{storage??=globalThis.localStorage;}catch{storage=null;}
 const today=()=>{try{const n=Number(now());return lisbonGrowthDay(new Date(Number.isFinite(n)&&n>=0?n:0));}catch{return '1970-01-01';}};
 let state=empty(today());
 function read(){
  if(!enabled||!storage)return null;
  try{
   const raw=storage.getItem(M_GROWTH_STORAGE_KEY);
   if(typeof raw!=='string'||raw.length>MAX_BYTES||!raw)return null;
   const value=JSON.parse(raw);
   return valid(value)?value:null;
  }catch{return null;}
 }
 function write(){
  available=false;
  if(!enabled||!storage)return false;
  try{
   const previous=storage.getItem(M_GROWTH_STORAGE_KEY);
   if(typeof previous==='string'&&previous.length<=MAX_BYTES){
    const decoded=JSON.parse(previous);
    if(Number.isInteger(decoded?.version)&&decoded.version>1)return false;
   }
   const raw=JSON.stringify(state);if(raw.length>MAX_BYTES)return false;
   storage.setItem(M_GROWTH_STORAGE_KEY,raw);
   available=storage.getItem(M_GROWTH_STORAGE_KEY)===raw;
  }catch{available=false;}
  return available;
 }
 if(enabled){
  const saved=read();
  if(saved){state=saved;lastSavedDay=saved.day;
   const newDay=today();
   if(newDay>saved.day){state.day=newDay;state.days=Math.min(MAX_COUNT,state.days+1);}
   state.opens=Math.min(MAX_COUNT,state.opens+1);
  }else{lastSavedDay=state.day;}
  write();
 }
 function refresh(){
  const saved=read();
  if(!saved)return;
  // Preserve a more advanced concurrent tab's record, but never import private content.
  if(saved.attempts>state.attempts||(saved.attempts===state.attempts&&saved.opens>state.opens))state=saved;
 }
 function record({family,success}={}){
  if(!enabled||!GROWTH_FAMILIES.includes(family)||typeof success!=='boolean')return false;
  refresh();state.attempts=Math.min(MAX_COUNT,state.attempts+1);
  if(success)state.completed=Math.min(MAX_COUNT,state.completed+1);
  const table=success?state.wins:state.failures;table[family]=Math.min(MAX_COUNT,(table[family]||0)+1);
  if(success){state.recent.push(family);state.recent=state.recent.slice(-8);}
  const next=today();if(next>state.day){state.day=next;state.days=Math.min(MAX_COUNT,state.days+1);}
  write();return true;
 }
 function preferences(){
  const weights={};const last=state.recent.at(-1);
  for(const family of GROWTH_FAMILIES){
   const successes=state.wins[family]||0,failures=state.failures[family]||0;
   const quality=(successes+failures)?successes/(successes+failures):.5;
   // Both positive outcome memory and exploration of less-practiced actions.
   const novelty=.12/Math.sqrt(1+successes);
   const confidence=.08*(quality-.5);
   const recentCount=state.recent.slice(-5).filter(f=>f===family).length;
   weights[family]=Math.round(clamp(1+novelty+confidence-recentCount*.065-(last===family?.12:0),.7,1.2)*1000)/1000;
  }
  return {weights,recent:[...state.recent.slice(-5)],days:state.days,
   level:1+Math.min(4,Math.floor(state.completed/24)+Math.floor((state.days-1)/7))};
 }
 function snapshot(){return {enabled,storageAvailable:available,days:enabled?state.days:0,
  opens:enabled?state.opens:0,completed:enabled?state.completed:0,attempts:enabled?state.attempts:0,
  level:enabled?preferences().level:1,recent:enabled?[...state.recent]:[]};}
 function clear(){
  try{storage?.removeItem(M_GROWTH_STORAGE_KEY);}catch{}
  state=empty(today());available=false;
 }
 function setRemember(value){
  if(typeof value!=='boolean')return false;
  if(!value){enabled=false;clear();}
  else if(!enabled){enabled=true;state=empty(today());write();}
  return true;
 }
 function reset(){clear();if(enabled)write();}
 return {record,preferences,snapshot,setRemember,reset};
}
