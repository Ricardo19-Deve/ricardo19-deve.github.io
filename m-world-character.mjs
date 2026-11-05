import {getContextComponent} from './m-world-context.mjs?v=40';

/** M's authored experiences on this device; no visitor identity, messages or live scene objects. */
export const M_CHARACTER_STORAGE_KEY='m-world-character-v26';
export const M_CHARACTER_BACKUP_KEY=M_CHARACTER_STORAGE_KEY+'-backup';
export const M_CHARACTER_REMEMBER_KEY=M_CHARACTER_STORAGE_KEY+'-remember';
export const M_CHARACTER_VERSION=1;
export const M_CHARACTER_JOURNAL_LIMIT=12;
export const M_CHARACTER_RECEIPT_LIMIT=32;
const MAX_BYTES=16_384,MAX_COUNT=1_000_000_000,MAX_TIME=8_640_000_000_000_000;
const GOALS=['follow-light','find-lookout','revisit-lookout'];
const BEATS=['seeking','returning','complete'];
const JOURNAL_IDS=['light-found','lookout-found','lookout-revisited'];
const integer=(value,min=0,max=MAX_COUNT)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const stamp=value=>integer(value,0,MAX_TIME);
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(value);
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const copy=value=>structuredClone(value);
const publicId=value=>value===null||safeId(value);
const knownPublic=value=>getContextComponent(value)?.id||null;

/** A receipt belongs to one page incarnation. Replaying an old visit cannot complete a new goal. */
export function characterReceiptId(visitId,executionId){
 return integer(visitId,1)&&safeId(executionId)?'visit-'+visitId+':'+executionId:null;
}
function receiptId(value){
 if(typeof value!=='string'||value.length>96)return false;
 const match=/^visit-([1-9][0-9]{0,9}):([a-zA-Z0-9][a-zA-Z0-9:_-]{0,63})$/u.exec(value);
 return Boolean(match&&integer(Number(match[1]),1));
}
function receiptVisit(id){return Number(id.slice(6,id.indexOf(':')));}
function empty(at,visits=1,revision=0){
 return {version:1,revision,visits,createdAt:at,updatedAt:at,beat:'seeking',favorite:null,revisitedVisit:0,journal:[],receipts:[]};
}
function validState(value){
 if(!exact(value,['version','revision','visits','createdAt','updatedAt','beat','favorite','revisitedVisit','journal','receipts'])
  ||value.version!==1||!integer(value.revision)||!integer(value.visits,1)
  ||!stamp(value.createdAt)||!stamp(value.updatedAt)||value.updatedAt<value.createdAt
  ||!BEATS.includes(value.beat)||!integer(value.revisitedVisit,0,value.visits)
  ||!Array.isArray(value.journal)||value.journal.length>M_CHARACTER_JOURNAL_LIMIT
  ||!Array.isArray(value.receipts)||value.receipts.length>M_CHARACTER_RECEIPT_LIMIT)return false;
 if(value.favorite!==null&&(!exact(value.favorite,['stableId','publicId'])||!safeId(value.favorite.stableId)||!publicId(value.favorite.publicId)))return false;
 if(value.beat!=='complete'&&(value.favorite!==null||value.revisitedVisit!==0))return false;
 if(value.beat==='complete'&&(value.favorite===null||value.revisitedVisit<1))return false;
 let previous=value.createdAt;
 for(const entry of value.journal){
  if(!exact(entry,['id','atMs','visit','componentId','publicComponent'])||!JOURNAL_IDS.includes(entry.id)
   ||!stamp(entry.atMs)||entry.atMs<previous||entry.atMs>value.updatedAt||!integer(entry.visit,1,value.visits)
   ||!(entry.componentId===null||safeId(entry.componentId))||!publicId(entry.publicComponent))return false;
  if(entry.id==='light-found'&&(entry.componentId!==null||entry.publicComponent!==null))return false;
  if(entry.id!=='light-found'&&(entry.componentId===null||entry.componentId!==value.favorite?.stableId||entry.publicComponent!==value.favorite?.publicId))return false;
  previous=entry.atMs;
 }
 if(value.beat==='seeking'&&value.journal.length!==0)return false;
 if(value.beat==='returning'&&(value.journal.length!==1||value.journal[0].id!=='light-found'))return false;
 if(value.beat==='complete'&&(value.journal.length<2||value.journal[0].id!=='light-found'||value.journal[1].id!=='lookout-found'||value.journal.slice(2).some(entry=>entry.id!=='lookout-revisited')))return false;
 const ids=new Set();
 return value.receipts.every(entry=>{
  if(!exact(entry,['id','goal','success','visit','atMs'])||!receiptId(entry.id)||ids.has(entry.id)
   ||!GOALS.includes(entry.goal)||typeof entry.success!=='boolean'||!integer(entry.visit,1,value.visits)
   ||receiptVisit(entry.id)!==entry.visit||!stamp(entry.atMs)||entry.atMs<value.createdAt||entry.atMs>value.updatedAt)return false;
  ids.add(entry.id);return true;
 });
}
function normalized(value){
 const result=copy(value);
 if(result.favorite)result.favorite.publicId=knownPublic(result.favorite.publicId);
 for(const entry of result.journal)if(entry.publicComponent!==null)entry.publicComponent=knownPublic(entry.publicComponent);
 return result;
}

export function createCharacter({storage,now=Date.now}={}){
 let lastAt=0,remember=true,storageAvailable=false,writeLocked=false,returning=false;
 const clock=()=>{try{const value=now();if(Number.isFinite(value)&&value>=0&&value<=MAX_TIME)lastAt=Math.max(lastAt,Math.floor(value));}catch{}return lastAt;};
 try{storage??=globalThis.localStorage;}catch{storage=null;}
 const read=key=>{
  const raw=storage?.getItem(key);
  if(typeof raw!=='string'||raw.length===0)return {value:null,future:false};
  if(raw.length>MAX_BYTES)return {value:null,future:false};
  let value;try{value=JSON.parse(raw);}catch{return {value:null,future:false};}
  if(Number.isInteger(value?.version)&&value.version>1)return {value:null,future:true};
  return {value:validState(value)?normalized(value):null,future:false};
 };
 function saved(){
  const primary=read(M_CHARACTER_STORAGE_KEY),backup=read(M_CHARACTER_BACKUP_KEY);
  writeLocked=primary.future||backup.future;
  const values=[primary.value,backup.value].filter(Boolean).sort((a,b)=>b.revision-a.revision);
  return values[0]||null;
 }
 let state=empty(clock());
 try{
  remember=storage?.getItem(M_CHARACTER_REMEMBER_KEY)!=='false';
  if(remember){const value=saved();if(value){state=value;returning=true;lastAt=Math.max(lastAt,value.updatedAt);state.visits=Math.min(MAX_COUNT,state.visits+1);}}
 }catch{storageAvailable=false;}
 const visitId=state.visits;
 function removeData(){
  let removed=true;
  for(const key of [M_CHARACTER_STORAGE_KEY,M_CHARACTER_BACKUP_KEY])try{
   storage?.removeItem(key);
   if(storage?.getItem(key)){storage?.setItem(key,'');if(storage?.getItem(key))removed=false;}
  }catch{removed=false;}
  return removed;
 }
 function save(){
  storageAvailable=false;
  if(!remember||!storage)return false;
  try{
   if(storage.getItem(M_CHARACTER_REMEMBER_KEY)==='false'){remember=false;return false;}
   const previous=saved();if(writeLocked||(previous&&previous.revision>state.revision))return false;
   // Save one complete JSON snapshot and retain only a validated previous snapshot.
   if(previous){const backup=JSON.stringify(previous);storage.setItem(M_CHARACTER_BACKUP_KEY,backup);if(storage.getItem(M_CHARACTER_BACKUP_KEY)!==backup)return false;}
   else storage.removeItem(M_CHARACTER_BACKUP_KEY);
   const serialized=JSON.stringify(state);if(serialized.length>MAX_BYTES)return false;
   storage.setItem(M_CHARACTER_STORAGE_KEY,serialized);
   storageAvailable=storage.getItem(M_CHARACTER_STORAGE_KEY)===serialized;
  }catch{storageAvailable=false;}
  return storageAvailable;
 }
 function refresh(){
  if(!remember||!storage||writeLocked)return;
  try{
   if(storage.getItem(M_CHARACTER_REMEMBER_KEY)==='false'){remember=false;storageAvailable=false;return;}
   const value=saved();
   if(value&&value.revision>state.revision){state=value;lastAt=Math.max(lastAt,state.updatedAt);}
  }catch{storageAvailable=false;}
 }
 function changed(){state.updatedAt=clock();state.revision=Math.min(MAX_COUNT,state.revision+1);save();}
 function getContext(){
  const complete=state.beat==='complete';
  return {version:1,chapter:'small-light',beat:state.beat,
   goal:state.beat==='seeking'?'follow-light':state.beat==='returning'?'find-lookout':returning&&state.revisitedVisit<visitId?'revisit-lookout':'explore',
   discovery:state.beat==='seeking'?'none':'little-light',preference:complete?'quiet-lookouts':'small-lights',
   recall:returning?'returning':'first-visit',favoriteComponent:complete?knownPublic(state.favorite?.publicId):null};
 }
 function snapshot(){return {...getContext(),remember,storageAvailable,visits:state.visits,visitId,revision:state.revision,journal:copy(state.journal),favorite:copy(state.favorite)};}
 function record(receipt){
  if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||!['id','goal','success'].every(key=>Object.hasOwn(receipt,key))
   ||Object.keys(receipt).some(key=>!['id','goal','success','componentId','publicComponent'].includes(key)))return false;
  const {id,goal,success,componentId=null,publicComponent=null}=receipt;
  if(!receiptId(id)||receiptVisit(id)!==visitId||!GOALS.includes(goal)||typeof success!=='boolean'
   ||!(componentId===null||safeId(componentId))||!(publicComponent===null||getContextComponent(publicComponent)))return false;
  refresh();
  if(goal!==getContext().goal||state.receipts.some(entry=>entry.id===id))return false;
  if(success&&goal!=='follow-light'&&componentId===null)return false;
  if(success&&goal==='revisit-lookout'&&(componentId!==state.favorite?.stableId||publicComponent!==state.favorite?.publicId))return false;
  const at=clock();
  state.receipts.push({id,goal,success,visit:visitId,atMs:at});state.receipts=state.receipts.slice(-M_CHARACTER_RECEIPT_LIMIT);
  if(success){
   let entry;
   if(goal==='follow-light'){state.beat='returning';entry={id:'light-found',atMs:at,visit:visitId,componentId:null,publicComponent:null};}
   else if(goal==='find-lookout'){
    state.beat='complete';state.favorite={stableId:componentId,publicId:publicComponent};state.revisitedVisit=visitId;
    entry={id:'lookout-found',atMs:at,visit:visitId,componentId,publicComponent};
   }else{state.revisitedVisit=Math.max(state.revisitedVisit,visitId);entry={id:'lookout-revisited',atMs:at,visit:visitId,componentId,publicComponent};}
   state.journal.push(entry);
   // Founding beats stay present; only old revisits are evicted.
   if(state.journal.length>M_CHARACTER_JOURNAL_LIMIT)state.journal.splice(2,state.journal.length-M_CHARACTER_JOURNAL_LIMIT);
  }
  changed();return success;
 }
 function setRemember(value){
  if(typeof value!=='boolean')return false;
  remember=value;storageAvailable=false;
  try{storage?.setItem(M_CHARACTER_REMEMBER_KEY,String(value));}catch{}
  if(!value){removeData();writeLocked=false;}
  else save();
  return true;
 }
 function reset(){
  removeData();writeLocked=false;returning=false;
  state=empty(clock(),Math.max(state.visits,visitId),Math.min(MAX_COUNT,state.revision+1));
  save();return snapshot();
 }
 changed();
 return {snapshot,getContext,record,setRemember,reset};
}
