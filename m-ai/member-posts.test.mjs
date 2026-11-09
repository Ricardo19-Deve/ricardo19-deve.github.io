import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberPostsReader,LINKEDIN_MEMBER_POSTS_URL} from './member-posts.mjs';
import {refreshAutomaticLinkedIn,M_LINKEDIN_SYNC_CRON} from './automatic-linkedin.mjs';
import {createHandler,API_URL} from './core.mjs';

const person='urn:li:person:ricardoApp123';
const token='approved-member-social-test-token';
const now=()=>Date.parse('2026-11-09T12:30:00.000Z');
const post=(extra={})=>({author:person,id:'urn:li:share:7523386814880047107',visibility:'PUBLIC',
 lifecycleState:'PUBLISHED',publishedAt:Date.parse('2026-11-03T17:00:00Z'),
 commentary:'Meet M!! An original 3D AI companion.',...extra});
const response=(elements,status=200)=>new Response(JSON.stringify({elements,paging:{count:50,start:0,links:[]}}),
 {status,headers:{'content-type':'application/json'}});
const officialReader=(fetchImpl,opts={})=>createMemberPostsReader({token,personUrn:person,fetchImpl,now,...opts});

test('V61 official finder requests only the authenticated author and validates PUBLIC PUBLISHED posts',async()=>{
 const calls=[],reader=officialReader(async(url,options)=>{
  calls.push({url,options});
  return response([
   post(),
   post({id:'urn:li:share:7523386814880047108',visibility:'CONNECTIONS',commentary:'PRIVATE RECORD'}),
   post({id:'urn:li:share:7523386814880047109',lifecycleState:'DRAFT',commentary:'DRAFT RECORD'}),
   post({id:'urn:li:share:7523386814880047110',author:'urn:li:person:other',commentary:'OTHER MEMBER'}),
   post({id:'urn:li:ugcPost:7523386814880047111',commentary:'PUBLIC new post about Salesforce'}),
   post({id:'urn:li:ugcPost:7523386814880047111',commentary:'PUBLIC new post about Salesforce'})
  ]);
 });
 const result=await reader.get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,2);
 assert.match(result.posts[0].url,/urn:li:/);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE RECORD|DRAFT RECORD|OTHER MEMBER|approved-member-social-test-token/);
 const req=new URL(calls[0].url);
 assert.equal(req.origin,'https://api.linkedin.com');
 assert.equal(req.pathname,'/rest/posts');
 assert.equal(req.searchParams.get('q'),'author');
 assert.equal(req.searchParams.get('author'),person);
 assert.equal(req.searchParams.get('viewContext'),'READER');
 assert.equal(calls[0].options.headers.Authorization,'Bearer '+token);
 assert.equal(calls[0].options.headers['X-RestLi-Method'],'FINDER');
 assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.redirect,'manual');
 const repeat=await reader.get();
 assert.equal(repeat.posts.length,2);assert.equal(calls.length,1,'short cache prevents redundant polling');
});
test('V61 official member access cannot be inferred from a DMA token or another author URN',async()=>{
 let called=0;
 const r=createMemberPostsReader({token:'',personUrn:person,fetchImpl:async()=>called++});
 assert.equal(r.enabled,false);assert.equal((await r.get()).status,'not-configured');
 const bad=createMemberPostsReader({token,personUrn:'urn:li:organization:123',fetchImpl:async()=>called++});
 assert.equal(bad.enabled,false);assert.equal(called,0);
 const denied=await officialReader(async()=>new Response('not allowed',{status:403})).get();
 assert.equal(denied.status,'not-authorized');assert.deepEqual(denied.posts,[]);
});
test('V61 cron publishes only safely verified explicit-public posts, never connection-only exports',async()=>{
 const writes=[];
 const env={LINKEDIN_DMA_ACCESS_TOKEN:'dma-owner-approved-token'};
 const fetchImpl=async url=>{assert.match(url,/memberSnapshotData/);
  return new Response(JSON.stringify({elements:[{
   snapshotDomain:'MEMBER_SHARE_INFO',
   snapshotData:[
    {Date:'2026-11-08 14:00:00',
     ShareLink:'https://www.linkedin.com/feed/update/urn:li:share:7523386814880047114',
     ShareCommentary:'Public Salesforce post',Visibility:'PUBLIC'},
    {Date:'2026-11-09 11:00:00',
     ShareLink:'https://www.linkedin.com/feed/update/urn:li:share:7523386814880047115',
     ShareCommentary:'Never publish my private post',Visibility:'MEMBER_NETWORK'}
   ]}],paging:{links:[]}}));
 };
 const result=await refreshAutomaticLinkedIn(env,{fetchImpl,now,store:async(_env,posts)=>{writes.push(posts);return true;}});
 assert.equal(result.state,'updated');assert.equal(result.provider,'dma');
 assert.equal(writes.length,1);
 assert.equal(writes[0].posts.length,1);
 assert.doesNotMatch(JSON.stringify(writes),/Never publish my private post/);
 assert.equal(M_LINKEDIN_SYNC_CRON,'15 2,5,8,11,14,17,20,23 * * *');
});
test('V61 cron never stores MEMBER_NETWORK-only content as verified public data',async()=>{
 let stored=0;
 const res=await refreshAutomaticLinkedIn({LINKEDIN_DMA_ACCESS_TOKEN:'dma-owner-approved-token'},
  {now,fetchImpl:async()=>new Response(JSON.stringify({elements:[{
    snapshotDomain:'MEMBER_SHARE_INFO',
    snapshotData:[{Visibility:'MEMBER_NETWORK',ShareCommentary:'secret text'}]
   }],paging:{links:[]}})),store:async()=>{stored++;return true;}});
 assert.equal(res.state,'unavailable');assert.equal(stored,0);
});
test('V61 server can use official member public posts with correct source provenance',async()=>{
 const outbound=[];
 const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
 const handler=createHandler({env:{
  OPENAI_API_KEY:'openai-mock-secret',LINKEDIN_MEMBER_SOCIAL_ACCESS_TOKEN:token,LINKEDIN_MEMBER_PERSON_URN:person
 },quota,fetchImpl:async(url,options)=>{
  outbound.push({url,options});
  if(url.startsWith(LINKEDIN_MEMBER_POSTS_URL))return response([post()]);
  if(url===API_URL)return new Response(JSON.stringify({status:'completed',output:[{
   type:'message',content:[{type:'output_text',text:JSON.stringify({
    reply:'O Ricardo apresentou-me a 3 de novembro.',expression:'neutral',gesture:'none',section:'none'
   })}]}]}));
  throw Error('Unexpected connection');
 }});
 const req=new Request('https://m.test/api/m/respond',{method:'POST',headers:{
  origin:'https://ricardo19-deve.github.io','content-type':'application/json'
 },body:JSON.stringify({message:'Qual foi o último post do Ricardo no LinkedIn?',history:[],context:{section:'home',language:'pt'}})});
 const res=await handler(req);
 assert.equal(res.status,200);
 const data=JSON.parse(outbound.at(-1).options.body);
 assert.match(data.input.at(-1).content,/Meet M!!/);
 assert.doesNotMatch(JSON.stringify(data),/approved-member-social-test-token|openai-mock-secret/);
 assert.equal((await res.json()).reply,'O Ricardo apresentou-me a 3 de novembro.');
});
