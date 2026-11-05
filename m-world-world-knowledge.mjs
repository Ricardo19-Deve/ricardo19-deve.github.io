/**
 * M V33 — validates centrally collected Wikimedia knowledge in the browser.
 * No per-visitor requests to Wikipedia, AI, geolocation, telemetry or D1.
 * One same-origin read with a GitHub raw fallback (GitHub Pages does not
 * republish commits authored solely by the default GITHUB_TOKEN).
 */
export const M_KNOWLEDGE_KEY='m-world-knowledge-v33';
export const WORLD_TOPICS=Object.freeze(['science','nature','culture','exploration','history']);
export const WORLD_FEED_LOCAL='/data/m-world-daily.json';
export const WORLD_FEED_LATEST='https://raw.githubusercontent.com/Ricardo19-Deve/ricardo19-deve.github.io/main/data/m-world-daily.json';
const limit=(n,max)=>Math.max(0,Math.min(max,Number.isSafeInteger(n)?n:0));
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'));
export function worldDay(at=new Date()){
 if(!(at instanceof Date)||!Number.isFinite(at.valueOf()))return null;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);
 const pick=t=>parts.find(p=>p.type===t)?.value;
 return pick('year')+'-'+pick('month')+'-'+pick('day');
}
const validWikiUrl=(value,{feed=false}={})=>{
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.hostname!=='en.wikipedia.org'||u.search||u.hash||u.username||u.password)return false;
  return feed?/^\/api\/rest_v1\/feed\/onthisday\/selected\/\d\d\/\d\d$/u.test(u.pathname):u.pathname.startsWith('/wiki/')&&u.pathname.length<=260;
 }catch{return false;}
};
export function validateWorldFeed(value,{date=worldDay()}={}){
 if(!value||value.schema!==1||!validDay(date)||value.date!==date||value.source!=='Wikipedia — On this day'
  ||!validWikiUrl(value.sourceUrl,{feed:true})||!Array.isArray(value.items)||value.items.length!==1)return null;
 const item=value.items[0];
 const topic=item?.topic,title=item?.title;
 const y=Number(item?.year);
 const suffix='/'+date.slice(5,7)+'/'+date.slice(8,10);
 if(!value.sourceUrl.endsWith(suffix)||!WORLD_TOPICS.includes(topic)||!Number.isInteger(y)||y<0||y>Number(date.slice(0,4))+1
  ||typeof title!=='string'||title.length<4||title.length>110||/[<>{}\r\n\x00-\x1f]/u.test(title)
  ||!validWikiUrl(item.url)||item.id!==date+':'+y+':'+topic)return null;
 return Object.freeze({date,source:value.source,sourceUrl:value.sourceUrl,
  item:Object.freeze({id:item.id,year:y,topic,title,url:item.url})});
}
async function getJson(fetchImpl,url){
 const response=await fetchImpl(url,{method:'GET',mode:'cors',cache:'no-store',
  credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(6500)});
 if(!response?.ok)return null;
 const raw=await response.text();
 if(raw.length>5500)return null;
 try{return JSON.parse(raw);}catch{return null;}
}
export async function loadWorldFeed({fetchImpl=globalThis.fetch,at=new Date()}={}){
 const date=worldDay(at);
 if(!date||typeof fetchImpl!=='function')return null;
 // All browser lookups read our own curated artifact, never Wikipedia directly.
 try{
  const first=validateWorldFeed(await getJson(fetchImpl,WORLD_FEED_LOCAL),{date});
  if(first)return first;
 }catch{}
 try{
  return validateWorldFeed(await getJson(fetchImpl,WORLD_FEED_LATEST),{date});
 }catch{return null;}
}
const empty=()=>({version:1,seen:[],counts:{}});
const goodRecord=data=>{
 if(!data||data.version!==1||!Array.isArray(data.seen)||data.seen.length>14
  ||data.seen.some(x=>typeof x!=='string'||!/^\d{4}-\d\d-\d\d:\d{1,4}:(science|nature|culture|exploration|history)$/u.test(x))
  ||!data.counts||typeof data.counts!=='object'||Array.isArray(data.counts)
  ||Object.keys(data.counts).some(x=>!WORLD_TOPICS.includes(x)||!Number.isInteger(data.counts[x])||data.counts[x]<0||data.counts[x]>999))return false;
 return true;
};
export function createWorldKnowledge({storage,remember=true,fetchImpl=globalThis.fetch,now=()=>new Date()}={}){
 let enabled=remember===true,record=empty(),current=null,loadPromise=null,storageAvailable=false;
 try{storage??=globalThis.localStorage;}catch{storage=null;}
 if(enabled&&storage){
  try{const raw=storage.getItem(M_KNOWLEDGE_KEY);
   if(typeof raw==='string'&&raw.length<2800){const parsed=JSON.parse(raw);if(goodRecord(parsed))record=parsed;}
  }catch{}
 }
 function save(){
  if(!enabled||!storage)return false;
  try{
   const old=storage.getItem(M_KNOWLEDGE_KEY);
   // A newer incompatible format is never overwritten by an older runtime.
   if(typeof old==='string'){
    const oldValue=JSON.parse(old);
    if(Number.isSafeInteger(oldValue?.version)&&oldValue.version>1)return false;
   }
   const raw=JSON.stringify(record);if(raw.length>2800)return false;
   storage.setItem(M_KNOWLEDGE_KEY,raw);storageAvailable=storage.getItem(M_KNOWLEDGE_KEY)===raw;
   return storageAvailable;
  }catch{return false;}
 }
 function discover(discovery){
  if(!discovery?.item||!WORLD_TOPICS.includes(discovery.item.topic))return false;
  const valid=validateWorldFeed({schema:1,date:discovery.date,source:discovery.source,
   sourceUrl:discovery.sourceUrl,items:[discovery.item]},{date:worldDay(now())});
  if(!valid)return false;
  current=valid;
  if(!enabled||record.seen.includes(valid.item.id))return true;
  record.seen.push(valid.item.id);record.seen=record.seen.slice(-14);
  const topic=valid.item.topic;
  record.counts[topic]=limit((record.counts[topic]||0)+1,999);
  save();return true;
 }
 async function load(){
  if(!loadPromise){
   loadPromise=(async()=>{
    let at;try{at=now();}catch{return null;}
    const result=await loadWorldFeed({fetchImpl,at});
    if(result)discover(result);
    return result;
   })();
  }
  return loadPromise;
 }
 function hint(){
  if(!current)return null;
  const topic=current.item.topic;
  const interest=enabled?(record.counts[topic]||0):0;
  return {topic,interest:Math.min(1.09,1+interest*.015)};
 }
 function snapshot(){
  return {available:Boolean(current),date:current?.date||null,
   discovery:current?{...current.item,source:current.source,sourceUrl:current.sourceUrl}:null,
   memoryEnabled:enabled,storageAvailable,encounters:enabled?record.seen.length:0,
   interests:enabled?{...record.counts}:{},localOnly:true};
 }
 function clear(){
  try{storage?.removeItem(M_KNOWLEDGE_KEY);}catch{}
  record=empty();storageAvailable=false;
 }
 function setRemember(value){
  if(typeof value!=='boolean')return false;
  if(!value){enabled=false;clear();}
  else if(!enabled){enabled=true;record=empty();if(current)discover(current);}
  return true;
 }
 function reset(){clear();}
 return {load,discover,hint,snapshot,setRemember,reset};
}
