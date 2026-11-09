/**
 * V45: live, server-only LinkedIn DMA Member public-post reader for Ask M.
 *
 * The owner-provided LINKEDIN_DMA_ACCESS_TOKEN remains a Cloudflare Secret.
 * We request only MEMBER_SHARE_INFO, never the full snapshot, private domains,
 * profile data, messages, contacts, cookies or the visitor's LinkedIn account.
 * The sanitized public posts exist in volatile Worker memory for a short TTL:
 * NO raw snapshot, token, database writes or public feed publication.
 */
import {LINKEDIN_PROFILE_URL,validatePublicActivity} from './public-activity.mjs';

export const DMA_SNAPSHOT_URL='https://api.linkedin.com/rest/memberSnapshotData';
export const DMA_SNAPSHOT_DOMAIN='MEMBER_SHARE_INFO';
export const DMA_SNAPSHOT_VERSION='202312';
const MAX_PAGES=12,MAX_ROWS=20000,MAX_RESPONSE_BYTES=256*1024;
const MAX_FETCH_MS=6000,READY_TTL_MS=15*60*1000,RETRY_TTL_MS=60*1000;

const blank=status=>({status,posts:[],asOf:null,profileUrl:LINKEDIN_PROFILE_URL});
const cleanName=name=>String(name||'').toLowerCase().replace(/[^a-z0-9]/gu,'');
const lookup=(row,...names)=>{
 const entries=Object.fromEntries(Object.entries(row).map(([key,value])=>[cleanName(key),value]));
 return names.map(name=>entries[cleanName(name)]).find(v=>v!==null&&v!==undefined&&String(v).trim()!=='')??null;
};
const dateString=raw=>{
 if(typeof raw==='number'&&Number.isFinite(raw)) {
  const date=new Date(raw);
  return Number.isFinite(date.valueOf())?date.toISOString().slice(0,10):null;
 }
 if(typeof raw!=='string')return null;
 // LinkedIn Shares.csv uses full UTC timestamps WITHOUT an offset, e.g.
 // "2026-11-07 15:44:45". Our V45 matcher mistakenly required a timezone
 // whenever a time was supplied and dropped every such legitimate post.
 const match=raw.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}| ?UTC)?)?$/iu);
 if(!match)return null;
 const d=new Date(match[1]+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===match[1]?match[1]:null;
};
const linkedinPermalink=value=>{
 if(typeof value!=='string')return null;
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||
    !['linkedin.com','www.linkedin.com','pt.linkedin.com'].includes(url.hostname))return null;
  // A real LinkedIn Shares.csv contains encoded URNs such as
  // /feed/update/urn%3Ali%3Ashare%3A123. Decode only the PATH once,
  // then verify it against an exact LinkedIn post allowlist.
  const path=decodeURIComponent(url.pathname);
  if(!/^\/(?:posts\/[a-z0-9%_-]+|feed\/update\/urn:li:(?:activity|ugcPost|share):\d+)\/?$/iu.test(path))return null;
  // Always discard tracking parameters/fragments and normalize to an exact
  // HTTPS post permalink; no redirects, user info, or other endpoints.
  return 'https://www.linkedin.com'+path;
 }catch{return null;}
};
function extractPublicPosts(rows,{nowMs=Date.now()}={}){
 const seen=new Set(),posts=[];
 let shareRows=0,publicRows=0;
 for(const raw of rows){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  shareRows++;
  const visibility=String(lookup(raw,'Visibility','Audience','Privacy')||'').trim().toUpperCase();
  // LinkedIn export "MEMBER_NETWORK" means connections-only. Never make
  // these rows visible to portfolio visitors, even with a valid post link.
  if(!['PUBLIC','EVERYONE','ANYONE'].includes(visibility))continue;
  publicRows++;
  const rawText=lookup(raw,'ShareCommentary','Shared Comments','Commentary','Content','Post Text','Text');
  const publishedAt=dateString(lookup(raw,'Date','Date/Time','CreatedAt','Created Date','PublishedAt','Published Date'));
  const url=linkedinPermalink(lookup(raw,'ShareLink','Share URL','Post URL','PostUrl','Permalink','URL'));
  if(!publishedAt||!url||seen.has(url))continue;
  // Reposts may contain no original text. State that accurately instead of
  // rejecting the entire PUBLIC share; never invent the reposted article.
  let text=typeof rawText==='string'?rawText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu,' ').trim():'';
  text=text?text.length>1500?text.slice(0,1499)+'…':text:'Partilha pública sem comentário próprio.';
  if(new Date(publishedAt+'T00:00:00Z').valueOf()>nowMs+86400000)continue;
  seen.add(url);
  posts.push({id:'dma-'+(posts.length+1),publishedAt,text:text.trim(),url,visibility:'public',source:'member-export'});
 }
 posts.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.url.localeCompare(b.url));
 // Distinguish no rows, restricted-only posts and a genuinely unknown
 // public-record shape. Only these categories leave the Worker, never
 // private rows, author info, raw URLs, field names or LinkedIn responses.
 if(!posts.length)return blank(shareRows===0?'empty':publicRows===0?'no-public-posts':'unrecognized-public');
 // The shared V43 validator limits the grounded context to eight posts and
 // 6,200 total chars. Always honor the same public-source trust boundary.
 const result=validatePublicActivity({version:1,owner:'Ricardo Pinheiro',
  profileUrl:LINKEDIN_PROFILE_URL,asOf:new Date(nowMs).toISOString().slice(0,10),
  posts:posts.slice(0,48)});
 return result.status==='ready'||result.status==='empty'?result:blank('unavailable');
}
async function boundedJson(response){
 const length=Number(response.headers?.get('content-length'));
 if(Number.isFinite(length)&&length>MAX_RESPONSE_BYTES)throw Error('oversize');
 const reader=response.body?.getReader();
 if(!reader)throw Error('missing-body');
 let size=0;const chunks=[];
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value?.byteLength||0;
   if(size>MAX_RESPONSE_BYTES){await reader.cancel();throw Error('oversize');}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
function nextStart(body,current){
 const links=body.paging?.links;
 if(links===undefined||links===null||Array.isArray(links)&&!links.length)return null;
 if(!Array.isArray(links))throw Error('invalid-pagination');
 const next=links.find(entry=>entry?.rel==='next');
 if(!next)return null;
 if(typeof next.href!=='string')throw Error('invalid-pagination');
 const u=new URL(next.href,'https://api.linkedin.com');
 if(u.origin!=='https://api.linkedin.com'||u.pathname!=='/rest/memberSnapshotData'||
  u.username||u.password||u.hash||u.searchParams.get('q')!=='criteria'||
  u.searchParams.get('domain')!==DMA_SNAPSHOT_DOMAIN||
  [...u.searchParams.keys()].some(k=>!['q','domain','count','start'].includes(k)))throw Error('invalid-pagination');
 const start=Number(u.searchParams.get('start'));
 if(!Number.isSafeInteger(start)||start<=current||start>MAX_PAGES*10000)throw Error('invalid-pagination');
 return start;
}
function parsePage(body){
 if(!body||!Array.isArray(body.elements)||body.elements.length!==1)throw Error('invalid-snapshot');
 const element=body.elements[0];
 if(element.snapshotDomain!==DMA_SNAPSHOT_DOMAIN||!Array.isArray(element.snapshotData))throw Error('invalid-domain');
 return element.snapshotData;
}

/**
 * In-isolate request coalescing and short TTL. No fetch occurs without the
 * actual owner token. Failure never elevates untrusted input or exposes data.
 */
export function createDMALiveReader({
 token='',fetchImpl=globalThis.fetch,now=()=>Date.now(),
 ttlMs=READY_TTL_MS,timeoutMs=MAX_FETCH_MS
}={}){
 const enabled=typeof token==='string'&&token.trim().length>0&&token.length<=4096;
 let cached=blank(enabled?'not-checked':'not-configured'),expires=0,pending=null;
 async function refresh(){
  if(!enabled)return cached;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),Math.max(200,timeoutMs));
  const rows=[];const seen=new Set();
  let start=0,latest=blank('unavailable');
  try{
   for(let page=0;page<MAX_PAGES;page++){
    if(seen.has(start))throw Error('invalid-pagination');
    seen.add(start);
    const url=new URL(DMA_SNAPSHOT_URL);
    url.searchParams.set('q','criteria');url.searchParams.set('domain',DMA_SNAPSHOT_DOMAIN);
    url.searchParams.set('start',String(start));
    const response=await fetchImpl(url.href,{
     method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal:abort.signal,
     headers:{Authorization:'Bearer '+token,'Linkedin-Version':DMA_SNAPSHOT_VERSION,Accept:'application/json'}
    });
    // The LinkedIn docs say a 404 after the first page can indicate the
    // end of a generated snapshot, while a first-page 404 may mean not ready.
    if(response.status===404){
     latest=page===0?blank('not-ready'):extractPublicPosts(rows,{nowMs:now()});
     break;
    }
    if(response.status===401||response.status===403){latest=blank('not-authorized');break;}
    // Retain only safe, finite diagnostic categories. Never read or return
    // LinkedIn's error response body (it may contain private account data).
    if(response.status===426){latest=blank('api-version-error');break;}
    if(response.status===400||response.status===422){latest=blank('request-rejected');break;}
    if(response.status===429){latest=blank('rate-limited');break;}
    if(response.status>=500){latest=blank('provider-error');break;}
    if(!response.ok){latest=blank('request-rejected');break;}
    const body=await boundedJson(response);
    rows.push(...parsePage(body));
    if(rows.length>MAX_ROWS)throw Error('row-limit');
    const next=nextStart(body,start);
    if(next===null){latest=extractPublicPosts(rows,{nowMs:now()});break;}
    if(page===MAX_PAGES-1)throw Error('page-limit');
    start=next;
   }
   return latest;
  }catch(error){
   if(abort.signal.aborted||error?.name==='AbortError'||error?.name==='TimeoutError')return blank('timeout');
   // A closed classification list: never expose arbitrary exception messages,
   // response bodies, bearer token, URLs, or connection identifiers.
   if(error?.message==='oversize')return blank('response-too-large');
   if(['invalid-domain','invalid-snapshot','missing-body'].includes(error?.message)||error instanceof SyntaxError)return blank('invalid-response');
   if(['invalid-pagination','page-limit'].includes(error?.message))return blank('invalid-pagination');
   if(error?.message==='row-limit')return blank('response-too-large');
   if(error instanceof TypeError)return blank('network-error');
   return blank('unavailable');
  }
  finally{clearTimeout(timer);}
 }
 async function get(){
  if(!enabled)return cached;
  const instant=now();
  if(instant<expires)return cached;
  if(pending)return pending;
  pending=refresh();
  try{
   const result=await pending;
   if(result.status==='ready'||result.status==='empty')cached=result;
   else if(cached.status!=='ready')cached=result;
   expires=now()+(result.status==='ready'||result.status==='empty'?Math.max(1000,ttlMs):RETRY_TTL_MS);
   return cached;
  }finally{pending=null;}
 }
 return {get,enabled,snapshot:()=>({enabled,status:cached.status,posts:cached.posts.length})};
}
