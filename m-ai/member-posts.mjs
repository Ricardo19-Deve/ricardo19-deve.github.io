/**
 * Official LinkedIn Posts author finder. This works ONLY when LinkedIn has
 * explicitly granted r_member_social to the owner's app. DMA permission is
 * not a substitute; never scrape a profile or use a visitor session.
 */
import {validatePublicActivity,LINKEDIN_PROFILE_URL} from './public-activity.mjs';

export const LINKEDIN_MEMBER_POSTS_URL='https://api.linkedin.com/rest/posts';
export const LINKEDIN_MEMBER_POSTS_VERSION='202607';
const MAX_PAGES=3,COUNT=50,MAX_BYTES=192*1024,TTL_MS=15*60*1000;
const blank=status=>({status,posts:[],asOf:null,profileUrl:LINKEDIN_PROFILE_URL});
const validUrn=v=>typeof v==='string'&&/^urn:li:person:[a-z0-9_-]{3,128}$/iu.test(v);
const dateMillis=(v,now)=>{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1262304000000||v>now+86400000)return null;
 const d=new Date(v);return Number.isFinite(d.valueOf())?d.toISOString().slice(0,10):null;
};
function validatePost(post,personUrn,now){
 if(!post||typeof post!=='object'||post.author!==personUrn||
  post.visibility!=='PUBLIC'||post.lifecycleState!=='PUBLISHED'||
  !/^urn:li:(?:share|ugcPost):[0-9]{6,25}$/u.test(post.id||''))return null;
 const publishedAt=dateMillis(post.publishedAt??post.createdAt,now);
 if(!publishedAt)return null;
 let commentary=typeof post.commentary==='string'?post.commentary.trim():'';
 commentary=commentary.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu,' ');
 if(commentary.length>1500)commentary=commentary.slice(0,1499)+'…';
 if(!commentary)commentary='Partilha pública sem comentário próprio.';
 const url='https://www.linkedin.com/feed/update/'+post.id+'/';
 return {id:'official-'+post.id.split(':').at(-1),publishedAt,text:commentary,
  url,visibility:'public',source:'member-export'};
}
async function boundedJson(response){
 const size=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(size)&&size>MAX_BYTES)throw Error('response-too-large');
 const reader=response.body?.getReader?.();
 if(!reader)throw Error('invalid-response');
 const parts=[];let length=0;
 try{
  while(true){
   const p=await reader.read();if(p.done)break;
   length+=p.value?.byteLength||0;
   if(length>MAX_BYTES){await reader.cancel();throw Error('response-too-large');}
   parts.push(p.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let pos=0;
 for(const part of parts){bytes.set(part,pos);pos+=part.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function createMemberPostsReader({token='',personUrn='',fetchImpl=globalThis.fetch,
 now=()=>Date.now(),timeoutMs=7000,ttlMs=TTL_MS}={}){
 const enabled=typeof token==='string'&&token.length>=12&&token.length<=4096&&validUrn(personUrn);
 let cached=blank(enabled?'not-checked':'not-configured'),expires=0,pending=null;
 async function refresh(){
  if(!enabled)return cached;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(250,timeoutMs));
  const posts=[];const seen=new Set();
  try{
   for(let page=0;page<MAX_PAGES;page++){
    const url=new URL(LINKEDIN_MEMBER_POSTS_URL);
    url.searchParams.set('q','author');url.searchParams.set('author',personUrn);
    url.searchParams.set('viewContext','READER');url.searchParams.set('count',String(COUNT));
    url.searchParams.set('sortBy','CREATED');url.searchParams.set('start',String(page*COUNT));
    const response=await fetchImpl(url.href,{
     method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal:controller.signal,
     headers:{Authorization:'Bearer '+token,'Linkedin-Version':LINKEDIN_MEMBER_POSTS_VERSION,
      'X-Restli-Protocol-Version':'2.0.0','X-RestLi-Method':'FINDER',Accept:'application/json'}
    });
    if(response.status===401||response.status===403)return blank('not-authorized');
    if(response.status===429)return blank('rate-limited');
    if(response.status===426)return blank('api-version-error');
    if(response.status>=500)return blank('provider-error');
    if(!response.ok)return blank('request-rejected');
    const payload=await boundedJson(response);
    if(!payload||!Array.isArray(payload.elements)||payload.elements.length>COUNT)throw Error('invalid-response');
    for(const row of payload.elements){
     const post=validatePost(row,personUrn,now());
     if(post&&!seen.has(post.url)){posts.push(post);seen.add(post.url);}
    }
    if(payload.elements.length<COUNT||posts.length>=48)break;
   }
   const validated=validatePublicActivity({version:1,owner:'Ricardo Pinheiro',
    profileUrl:LINKEDIN_PROFILE_URL,asOf:new Date(now()).toISOString().slice(0,10),posts:posts.slice(0,48)});
   return validated.status==='ready'||validated.status==='empty'?validated:blank('invalid-response');
  }catch(error){
   if(controller.signal.aborted||error?.name==='AbortError')return blank('timeout');
   if(error?.message==='response-too-large')return blank('response-too-large');
   if(error?.message==='invalid-response'||error instanceof SyntaxError)return blank('invalid-response');
   return blank(error instanceof TypeError?'network-error':'unavailable');
  }finally{clearTimeout(timer);}
 }
 async function get(){
  if(!enabled)return cached;
  if(now()<expires)return cached;
  if(pending)return pending;
  pending=refresh();
  try{
   cached=await pending;
   expires=now()+(cached.status==='ready'||cached.status==='empty'?Math.max(1000,ttlMs):60000);
   return cached;
  }finally{pending=null;}
 }
 return {enabled,get,snapshot:()=>({enabled,status:cached.status,posts:cached.posts.length})};
}
