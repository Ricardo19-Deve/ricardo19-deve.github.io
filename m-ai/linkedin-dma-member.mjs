/**
 * V44: official LinkedIn Member Data Portability (Member) snapshot importer.
 *
 * Uses ONLY the approved MEMBER_SHARE_INFO snapshot domain. Does NOT scrape,
 * fetch private domains, call the social/posts API, use browser cookies, or
 * publish the result. Requires an owner-created r_dma_portability_self_serve
 * token in the process environment. Always produces a LOCAL REVIEW DRAFT.
 *
 * From repository root (after LinkedIn authorization):
 * LINKEDIN_DMA_ACCESS_TOKEN=... node m-ai/linkedin-dma-member.mjs
 *
 * Never commit/share the token or the .review.json output.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {LINKEDIN_PROFILE_URL,validatePublicActivity} from './public-activity.mjs';

export const DMA_ENDPOINT='https://api.linkedin.com/rest/memberSnapshotData';
export const DMA_VERSION='202312';
export const DMA_DOMAIN='MEMBER_SHARE_INFO';
const MAX_PAGES=100,MAX_PAYLOAD_BYTES=512*1024;
const compact=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/gu,'');
const safeDate=value=>{
 if(typeof value==='number'&&Number.isFinite(value)){
  const d=new Date(value);return Number.isFinite(d.valueOf())?d.toISOString().slice(0,10):null;
 }
 if(typeof value!=='string')return null;
 const v=value.trim(),m=v.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u);
 if(!m)return null;
 const d=new Date(m[1]+'T00:00:00.000Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===m[1]?m[1]:null;
};
const indexRow=object=>Object.fromEntries(Object.entries(object).map(([k,v])=>[compact(k),v]));
const value=(row,...names)=>names.map(name=>row[compact(name)]).find(v=>v!==null&&v!==undefined&&String(v).trim())??null;
const validPermalink=link=>{
 if(link===null||link===undefined||link==='')return null;
 try{
  const url=new URL(String(link));
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
   !['www.linkedin.com','linkedin.com','pt.linkedin.com'].includes(url.hostname))return null;
  if(!/^\/(?:feed\/update\/urn:li:(?:activity|ugcPost|share):\d+|posts\/[a-z0-9%_-]+)\/?$/iu.test(url.pathname))return null;
  return url.href;
 }catch{return null;}
};

/** Fail closed: ONLY public posts with authored text, valid date and permalink. */
export function convertSnapshotRows(rows,{today=new Date().toISOString().slice(0,10)}={}){
 if(!Array.isArray(rows))throw Error('Invalid MEMBER_SHARE_INFO snapshot rows');
 const seen=new Set(),posts=[];
 const stats={received:rows.length,nonPublic:0,unknownAudience:0,missingText:0,invalidDate:0,invalidLink:0,duplicates:0,truncated:0};
 for(const item of rows){
  if(!item||typeof item!=='object'||Array.isArray(item)){stats.unknownAudience++;continue;}
  const row=indexRow(item);
  const visibility=String(value(row,'Visibility','Audience','Privacy')??'').trim().toUpperCase();
  if(visibility!=='PUBLIC'&&visibility!=='EVERYONE'){
   if(visibility==='CONNECTIONS'||visibility==='PRIVATE'||visibility==='ONLY_ME')stats.nonPublic++;
   else stats.unknownAudience++;
   continue;
  }
  const authored=value(row,'ShareCommentary','Commentary','Content','Post Text');
  const text=typeof authored==='string'?authored.trim():'';
  if(!text||text.length>1500){stats.missingText++;continue;}
  const date=safeDate(value(row,'Date','CreatedAt','PublishedAt','Created Date'));
  if(!date||date>today){stats.invalidDate++;continue;}
  const original=value(row,'ShareLink','Post URL','PostUrl','Permalink');
  const url=validPermalink(original);
  if(!url){stats.invalidLink++;continue;}
  const id=createHash('sha256').update(url+'|'+date).digest('hex').slice(0,22);
  if(seen.has(id)){stats.duplicates++;continue;}
  seen.add(id);
  posts.push({id,publishedAt:date,text,url,visibility:'public',source:'member-export'});
 }
 posts.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.url.localeCompare(b.url));
 if(posts.length>48){stats.truncated=posts.length-48;posts.length=48;}
 const draft={version:1,owner:'Ricardo Pinheiro',profileUrl:LINKEDIN_PROFILE_URL,asOf:today,posts};
 if(validatePublicActivity(draft).status==='invalid')throw Error('Invalid public-only review feed');
 return {draft,stats};
}

function snapshotPage(body){
 if(!body||typeof body!=='object'||!Array.isArray(body.elements))throw Error('Malformed DMA snapshot response');
 const rows=[];
 for(const element of body.elements){
  if(element.snapshotDomain!==DMA_DOMAIN)throw Error('Unexpected snapshot domain');
  if(!Array.isArray(element.snapshotData))throw Error('Invalid snapshotData field');
  rows.push(...element.snapshotData);
 }
 return rows;
}
function nextPage(body,current){
 const links=body.paging?.links;
 if(!Array.isArray(links))return null;
 const link=links.find(x=>x&&x.rel==='next'&&typeof x.href==='string');
 if(!link)return null;
 const url=new URL(link.href,'https://api.linkedin.com');
 if(url.origin!=='https://api.linkedin.com'||url.pathname!=='/rest/memberSnapshotData'||
  url.searchParams.get('q')!=='criteria'||url.searchParams.get('domain')!==DMA_DOMAIN||
  [...url.searchParams.keys()].some(x=>!['q','domain','start','count'].includes(x)))throw Error('Unsafe snapshot continuation');
 const num=Number(url.searchParams.get('start'));
 if(!Number.isSafeInteger(num)||num<=current||num>MAX_PAGES*10000)throw Error('Invalid snapshot continuation');
 return num;
}
async function boundedJson(response){
 const length=Number(response.headers?.get('content-length'));
 if(Number.isFinite(length)&&length>MAX_PAYLOAD_BYTES)throw Error('Snapshot page exceeds size limit');
 const r=response.body?.getReader?.();
 if(!r)throw Error('Missing snapshot body');
 let count=0;const chunks=[];
 try{
  while(true){
   const {done,value}=await r.read();
   if(done)break;
   count+=value.byteLength;
   if(count>MAX_PAYLOAD_BYTES){await r.cancel();throw Error('Snapshot page too large');}
   chunks.push(value);
  }
 }finally{r.releaseLock();}
 const output=new Uint8Array(count);let off=0;
 for(const chunk of chunks){output.set(chunk,off);off+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(output));
}

/** Server/CLI only; no auth token leaves the request to the exact LinkedIn host. */
export async function fetchMemberShareSnapshot({token,fetchImpl=globalThis.fetch,maxPages=MAX_PAGES}={}){
 if(typeof token!=='string'||!token.trim()||token.length>4096)throw Error('A private LinkedIn DMA token must be supplied via environment');
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES)throw Error('Invalid page cap');
 const rows=[],seen=new Set();
 let start=0;
 for(let page=0;page<maxPages;page++){
  if(seen.has(start))throw Error('Repeated DMA snapshot page');
  seen.add(start);
  const url=new URL(DMA_ENDPOINT);
  url.searchParams.set('q','criteria');
  url.searchParams.set('domain',DMA_DOMAIN);
  url.searchParams.set('start',String(start));
  const response=await fetchImpl(url.href,{
   method:'GET',redirect:'error',cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+token,'Linkedin-Version':DMA_VERSION,Accept:'application/json'},
   signal:AbortSignal.timeout(8000)
  });
  if(response.status===404){
   if(page===0)return {status:'not-ready',rows:[],pages:0};
   return {status:'ready',rows,pages:page};
  }
  if(response.status===401||response.status===403)throw Error('LinkedIn authorization missing, expired or not provisioned (HTTP '+response.status+')');
  if(response.status===426)throw Error('Incorrect LinkedIn API version (requires 202312)');
  if(!response.ok)throw Error('LinkedIn snapshot unavailable (HTTP '+response.status+')');
  const body=await boundedJson(response),part=snapshotPage(body);
  rows.push(...part);
  if(rows.length>20000)throw Error('Snapshot row limit exceeded; review pagination separately');
  const next=nextPage(body,start);
  if(next===null)return {status:'ready',rows,pages:page+1};
  start=next;
 }
 throw Error('Snapshot incomplete; hit maximum page limit. No review file generated.');
}

export async function buildPublicReview({token,fetchImpl,today}={}){
 const snapshot=await fetchMemberShareSnapshot({token,fetchImpl});
 if(snapshot.status!=='ready')return {status:snapshot.status,review:null};
 const review=convertSnapshotRows(snapshot.rows,today?{today}:{});
 return {status:'ready',review,pages:snapshot.pages};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const token=process.env.LINKEDIN_DMA_ACCESS_TOKEN;
 try{
  const result=await buildPublicReview({token});
  if(result.status==='not-ready')process.stdout.write('LinkedIn is still preparing MEMBER_SHARE_INFO. No file changed. Try again later.\n');
  else{
   const path=resolve('data/m-public-activity.review.json');
   writeFileSync(path,JSON.stringify(result.review.draft,null,2)+'\n',{mode:0o600});
   process.stdout.write('Local owner-review draft: '+path+'\n'+
    'Public posts selected: '+result.review.draft.posts.length+
    ' (pages: '+result.pages+'). Review every text/date/URL before publishing.\n'+
    'No token or private snapshot row was written.\n');
  }
 }catch(e){process.stderr.write('LinkedIn DMA import stopped: '+e.message+'\n');process.exitCode=1;}
}
