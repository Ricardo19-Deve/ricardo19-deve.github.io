/**
 * V43 public professional updates: private-by-default LinkedIn knowledge bridge.
 *
 * Only an OWNER-CURATED public JSON file from the existing portfolio is read.
 * No LinkedIn scraping, browser session, cookies, credentials, visitor identity,
 * search results, or arbitrary URLs enter the AI prompt.
 */
export const PUBLIC_ACTIVITY_URL='https://ricardo19-deve.github.io/data/m-public-activity.json';
export const LINKEDIN_PROFILE_URL='https://www.linkedin.com/in/ricardoappinheiro/';
const MAX_BYTES=32768,MAX_POSTS=8,MAX_TEXT=1500,CACHE_MS=300000;
const errorState=reason=>({status:reason,posts:[],asOf:null,profileUrl:LINKEDIN_PROFILE_URL});
const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v);
const secureUrl=value=>{
 if(typeof value!=='string')return null;
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!['linkedin.com','www.linkedin.com','pt.linkedin.com'].includes(u.hostname))return null;
  if(!/^\/(?:posts\/[a-z0-9%_-]+|feed\/update\/urn:li:(?:activity|ugcPost|share):[0-9]+)\/?$/iu.test(u.pathname))return null;
  return u.href;
 }catch{return null;}
};
const date=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value))return null;
 const parsed=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value&&parsed.valueOf()<=Date.now()+86400000?value:null;
};
export function validatePublicActivity(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||
 raw.owner!=='Ricardo Pinheiro'||raw.profileUrl!==LINKEDIN_PROFILE_URL||
 !Array.isArray(raw.posts)||raw.posts.length>48||
 !(raw.asOf===null||date(raw.asOf)))return errorState('invalid');
 const seen=new Set(),posts=[];
 for(const item of raw.posts){
  if(!item||typeof item!=='object'||Array.isArray(item)||
   !text(item.id,100)||!text(item.text,MAX_TEXT)||!date(item.publishedAt)||
   item.visibility!=='public'||!['owner-curated','member-export'].includes(item.source))return errorState('invalid');
  const url=item.url===null?null:secureUrl(item.url);
  if(item.url!==null&&!url||seen.has(item.id))return errorState('invalid');
  seen.add(item.id);
  posts.push({publishedAt:item.publishedAt,text:item.text.trim(),url,source:item.source});
 }
 posts.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 const limited=[],maxChars=6200;
 let length=0;
 for(const item of posts){
  if(limited.length===MAX_POSTS||length+item.text.length>maxChars)break;
  limited.push(item);length+=item.text.length;
 }
 return {status:limited.length?'ready':'empty',posts:limited,asOf:raw.asOf,profileUrl:LINKEDIN_PROFILE_URL};
}
/**
 * The live DMA source may prove a few PUBLIC records while the curated owner
 * feed contains additional verified public posts. Merge ONLY validated,
 * public-origin records and prefer the author's reviewed text on duplicate
 * permalinks. Nothing ambiguous/private is promoted here.
 */
export function mergeVerifiedActivities(live,curated){
 const sources=[curated,live].filter(x=>x?.status==='ready'&&Array.isArray(x.posts));
 if(!sources.length)return curated||live||errorState('not-configured');
 const seen=new Set(),posts=[];
 for(const src of sources)for(const item of src.posts){
  if(!item||!text(item.text,MAX_TEXT)||!date(item.publishedAt))continue;
  const url=item.url===null?null:secureUrl(item.url);
  if(item.url!==null&&!url)continue;
  const key=url||item.publishedAt+':'+item.text;
  if(seen.has(key))continue;
  seen.add(key);posts.push({publishedAt:item.publishedAt,text:item.text,url,source:item.source});
 }
 posts.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 const trimmed=[];let total=0;
 for(const post of posts){
  if(trimmed.length>=MAX_POSTS||total+post.text.length>6200)break;
  trimmed.push(post);total+=post.text.length;
 }
 const asOf=sources.map(src=>src.asOf).filter(Boolean).sort().at(-1)||null;
 return {status:trimmed.length?'ready':'empty',posts:trimmed,asOf,profileUrl:LINKEDIN_PROFILE_URL};
}

async function boundedJson(response){
 if(!response?.ok)return null;
 const header=response.headers?.get?.('content-length');
 if(header&&Number(header)>MAX_BYTES)return null;
 const reader=response.body?.getReader?.();
 if(!reader)return null;
 const chunks=[];let size=0;
 try{
  while(true){
   const part=await reader.read();
   if(part.done)break;
   size+=part.value?.byteLength||0;
   if(size>MAX_BYTES){await reader.cancel();return null;}
   chunks.push(part.value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
 }catch{return null;}
 finally{reader.releaseLock();}
}
/**
 * One fixed origin and path, short timeout, low-frequency in-isolate cache.
 * A remote outage never blocks factual portfolio questions.
 */
export function createPublicActivityReader({fetchImpl=globalThis.fetch,url='',now=()=>Date.now(),ttlMs=CACHE_MS}={}){
 const enabled=url===PUBLIC_ACTIVITY_URL;
 let cached=errorState('not-configured'),expires=0,pending=null;
 async function get(signal){
  if(!enabled)return cached;
  const instant=now();
  if(instant<expires)return cached;
  if(pending)return pending;
  pending=(async()=>{
   const abort=new AbortController();
   const cancel=()=>abort.abort();
   signal?.addEventListener('abort',cancel,{once:true});
   const timeout=setTimeout(()=>abort.abort(),1800);
   try{
    if(signal?.aborted)return errorState('unavailable');
    const response=await fetchImpl(PUBLIC_ACTIVITY_URL,{
     method:'GET',redirect:'manual',cache:'no-store',credentials:'omit',
     signal:abort.signal,headers:{accept:'application/json'}
    });
    const value=await boundedJson(response);
    return value?validatePublicActivity(value):errorState('unavailable');
   }catch{return errorState('unavailable');}
   finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
  })();
  try{
   const result=await pending;
   if(result.status==='ready'||result.status==='empty')cached=result;
   else if(cached.status==='not-configured')cached=result;
   expires=now()+(result.status==='unavailable'?30000:Math.max(1000,ttlMs));
   return cached;
  }finally{pending=null;}
 }
 return {get,enabled};
}
