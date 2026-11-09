import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PUBLIC_ACTIVITY_URL,LINKEDIN_PROFILE_URL,validatePublicActivity,createPublicActivityReader,mergeVerifiedActivities} from './public-activity.mjs';
import {createHandler,API_URL} from './core.mjs';

const post=(x={})=>({id:'post-1',publishedAt:'2026-11-02',
 text:'I began the UEFA C football coaching course and am connecting technology with training.',
 url:'https://www.linkedin.com/posts/ricardoappinheiro_coaching-activity-7381000012345678900-ABcd',
 visibility:'public',source:'owner-curated',...x});
const feed=(posts=[post()])=>({version:1,owner:'Ricardo Pinheiro',profileUrl:LINKEDIN_PROFILE_URL,asOf:'2026-11-05',posts});
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
test('V43 accepts only verified-owner public posts with dates and source links',()=>{
 const result=validatePublicActivity(feed([post(),post({id:'post-2',publishedAt:'2026-10-25',url:null})]));
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,2);
 assert.equal(result.posts[0].publishedAt,'2026-11-02');
 assert.equal(result.posts[1].url,null);
});
test('V43 rejects wrong owner, nonpublic, duplicate, invalid dates and untrusted domains',()=>{
 for(const invalid of [
  {...feed(),owner:'Unknown'}, {...feed(),profileUrl:'https://elsewhere.test/'},
  feed([post({visibility:'connections'})]),
  feed([post({url:'https://evil.test/posts/ricardoappinheiro_fake'})]),
  feed([post({url:'http://www.linkedin.com/posts/bad_post'})]),
  feed([post({publishedAt:'2026-02-30'})]),
  feed([post(),post()]),
  feed([post({text:'x'.repeat(1501)})])
 ])assert.equal(validatePublicActivity(invalid).status,'invalid');
});
test('V43 public activity cache avoids repeated external fetches and never follows arbitrary endpoints',async()=>{
 let calls=0,t=1000;
 const reader=createPublicActivityReader({url:PUBLIC_ACTIVITY_URL,now:()=>t,fetchImpl:async url=>{
  calls++;assert.equal(url,PUBLIC_ACTIVITY_URL);return json(feed());
 }});
 assert.equal((await reader.get()).status,'ready');
 t+=1000;assert.equal((await reader.get()).posts.length,1);
 assert.equal(calls,1);
 const wrong=createPublicActivityReader({url:'https://evil.test/m-posts',fetchImpl:async()=>{throw Error('should not fetch');}});
 assert.equal(wrong.enabled,false);
 assert.equal((await wrong.get()).status,'not-configured');
});
test('V43 empty feed never implies live access to LinkedIn',async()=>{
 const reader=createPublicActivityReader({url:PUBLIC_ACTIVITY_URL,fetchImpl:async()=>json(feed([]))});
 const empty=await reader.get();
 assert.equal(empty.status,'empty');assert.deepEqual(empty.posts,[]);
 const source=readFileSync(new URL('core.mjs',import.meta.url),'utf8');
 assert.match(source,/no verified public LinkedIn posts/i);
 assert.match(source,/Do not claim access to the user's LinkedIn profile/);
});
test('V43 Ask M receives selected dated posts on SERVER only, separate from visitor context',async()=>{
 const key='test-mock-key',requests=[];
 const reader=async(url,init)=>{
  requests.push({url,init});
  if(url===PUBLIC_ACTIVITY_URL)return json(feed());
  if(url===API_URL){
   const output={reply:'The public post is dated 2 November 2026.',expression:'neutral',gesture:'none',section:'none'};
   return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
  }
  throw Error('Unexpected host');
 };
 const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
 const handle=createHandler({env:{OPENAI_API_KEY:key,PUBLIC_ACTIVITY_FEED_URL:PUBLIC_ACTIVITY_URL},fetchImpl:reader,quota});
 const payload={message:'What has Ricardo published on LinkedIn?',history:[],context:{section:'home',language:'en'}};
 const answer=await handle(new Request('https://local.test/api/m/respond',{method:'POST',headers:{origin:'https://ricardo19-deve.github.io','content-type':'application/json'},body:JSON.stringify(payload)}),{clientIp:'127.0.0.1'});
 assert.equal(answer.status,200);
 assert.deepEqual(requests.map(x=>x.url),[PUBLIC_ACTIVITY_URL,API_URL]);
 const body=JSON.parse(requests.at(-1).init.body);
 assert.ok(!body.instructions.includes('UEFA C football coaching course'),'untrusted post text must never enter system instructions');
 const lastMessage=body.input.at(-1).content;
 assert.match(lastMessage,/UEFA C football coaching course/);
 assert.match(lastMessage,/2026-11-02/);
 assert.match(lastMessage,/untrusted external evidence/);
 assert.ok(!body.instructions.includes(key),'never echo the API key');
});
test('V43 no feed, timeout and invalid feed degrade to existing portfolio Q&A',async()=>{
 for(const selected of ['',PUBLIC_ACTIVITY_URL]){
  const calls=[];const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
  const handle=createHandler({env:{OPENAI_API_KEY:'secret',PUBLIC_ACTIVITY_FEED_URL:selected},quota,
   fetchImpl:async(url)=>{calls.push(url);if(url===PUBLIC_ACTIVITY_URL)throw Error('source outage');
    return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({reply:'The public portfolio lists Salesforce work.',expression:'neutral',gesture:'none',section:'none'})}]}]});}});
  const input={message:'What does Ricardo do?',history:[],context:{section:'home',language:'en'}};
  const res=await handle(new Request('https://local.test/api/m/respond',{method:'POST',headers:{origin:'https://ricardo19-deve.github.io','content-type':'application/json'},body:JSON.stringify(input)}));
  assert.equal(res.status,200);
  assert.equal(calls.at(-1),API_URL);
 }
});

// The owner confirmed that the existing 'Meet M!!' LinkedIn publication uses
// the Anyone audience. This exact reviewed permalink is a safe public fallback
// while MEMBER_NETWORK values in automatic exports remain ambiguous.
test('V57 curated Meet M publication is a dated, validated, owner-confirmed public fallback',()=>{
 const raw=JSON.parse(readFileSync(new URL('../data/m-public-activity.json',import.meta.url),'utf8'));
 const valid=validatePublicActivity(raw);
 assert.equal(valid.status,'ready');
 assert.equal(valid.asOf,'2026-11-09');
 assert.equal(valid.posts[0].publishedAt,'2026-11-03');
 assert.equal(valid.posts[0].url,'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/');
 assert.match(valid.posts[0].text,/Meet M!!/);
});

test('V60 combines verified public DMA posts and reviewed posts without duplicate link or private records',()=>{
 const reviewed=validatePublicActivity(feed([post({
  id:'meet-m',publishedAt:'2026-11-03',text:'Meet M, a 3D portfolio companion.',
  url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/'
 })]));
 const live=validatePublicActivity(feed([
  post({id:'dma-new',publishedAt:'2026-11-08',
   text:'A new public update about Salesforce and AI.',
   url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047110/',source:'member-export'}),
  post({id:'dma-old',publishedAt:'2026-11-03',text:'Less complete raw share',
   url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/',source:'member-export'})
 ]));
 const result=mergeVerifiedActivities(live,reviewed);
 assert.equal(result.status,'ready');
 assert.deepEqual(result.posts.map(p=>p.publishedAt),['2026-11-08','2026-11-03']);
 assert.equal(result.posts[1].text,'Meet M, a 3D portfolio companion.');
 assert.equal(result.posts.length,2);
});
test('V60 a short LinkedIn follow-up gets the verified feed, never an arbitrary link',async()=>{
 const requests=[];
 const linked='https://www.linkedin.com/posts/ricardoappinheiro_coaching-activity-7381000012345678900-ABcd';
 const handler=createHandler({env:{OPENAI_API_KEY:'mock-key',PUBLIC_ACTIVITY_FEED_URL:PUBLIC_ACTIVITY_URL},
  quota:{ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}},
  fetchImpl:async(url,init)=>{
   requests.push({url,init});
   if(url===PUBLIC_ACTIVITY_URL)return json(feed());
   if(url===API_URL)return json({status:'completed',output:[{type:'message',content:[{type:'output_text',
    text:JSON.stringify({reply:linked,expression:'neutral',gesture:'none',section:'none'})}]}]});
   throw Error('Unexpected outbound URL');
  }});
 const input={message:'E o link?',history:[
  {role:'user',content:'Qual foi o último post no LinkedIn?'},
  {role:'assistant',content:'O Ricardo falou do curso de treinadores e da tecnologia.'}
 ],context:{section:'home',language:'pt'}};
 const res=await handler(new Request('https://local.test/api/m/respond',
  {method:'POST',headers:{origin:'https://ricardo19-deve.github.io','content-type':'application/json'},body:JSON.stringify(input)}));
 assert.equal(res.status,200);assert.equal((await res.json()).reply,linked);
 assert.deepEqual(requests.map(x=>x.url),[PUBLIC_ACTIVITY_URL,API_URL]);
 const prompt=JSON.parse(requests.at(-1).init.body);
 assert.match(prompt.instructions,/FOLLOW-UP:/);
 assert.match(prompt.input.at(-1).content,/UEFA C football coaching course/);
});
