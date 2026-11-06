import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDMALiveReader,DMA_SNAPSHOT_URL,DMA_SNAPSHOT_DOMAIN,DMA_SNAPSHOT_VERSION} from './linkedin-live.mjs';
import {createHandler,API_URL} from './core.mjs';

const example=(extra={})=>({
 Date:'2026-11-05',ShareCommentary:'Ricardo shares an update on Salesforce architecture and coaching',
 ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321000',
 Visibility:'Public',...extra
});
const snapshot=(rows,href=null)=>({
 paging:{start:0,count:10,links:href===null?[]:[{rel:'next',href}]},
 elements:[{snapshotDomain:DMA_SNAPSHOT_DOMAIN,snapshotData:rows}]
});
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
const dataUri=(start)=>'/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start='+start;
const pageFilter=rows=>{
 const reader=createDMALiveReader({token:'owner-private-token',fetchImpl:async()=>json(snapshot(rows))});
 return reader.get();
};

test('V45 retrieves only explicitly public authored posts, with date, source and whitelisted permalink',async()=>{
 const result=await pageFilter([
  example(),
  example({Date:'2026-11-04',ShareLink:'https://www.linkedin.com/posts/ricardoappinheiro_somepost-activity-7382430987654321001-AbCd',Visibility:'Everyone'}),
  example({Date:'2026-11-03',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321002',Visibility:'Connections'}),
  example({Date:'2026-11-02',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321003',Visibility:'Private'}),
  example({Date:'2026-11-01',ShareLink:'https://evil.example/posts/anything'}),
  example({Date:'2026-11-01',Visibility:'Unknown'}),
  example({Date:'not-a-date',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321004'}),
  example({ShareCommentary:'',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321005'}),
  example()
 ]);
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,2);
 assert.equal(result.posts[0].publishedAt,'2026-11-05');
 assert.equal(result.posts[1].publishedAt,'2026-11-04');
 assert.ok(result.posts.every(post=>post.source==='member-export'&&post.url.startsWith('https://www.linkedin.com/')));
});

test('V45 accepts official pagination and never fetches other LinkedIn account domains',async()=>{
 let calls=0;
 const reader=createDMALiveReader({token:'private-owner-token',fetchImpl:async(url,opts)=>{
  calls++;const u=new URL(url);
  assert.equal(u.origin,'https://api.linkedin.com');
  assert.equal(u.pathname,'/rest/memberSnapshotData');
  assert.equal(u.searchParams.get('q'),'criteria');
  assert.equal(u.searchParams.get('domain'),'MEMBER_SHARE_INFO');
  assert.equal(opts.headers['Linkedin-Version'],'202312');
  assert.equal(opts.headers.Authorization,'Bearer private-owner-token');
  assert.equal(opts.redirect,'error');
  if(calls===1)return json(snapshot([example()],dataUri(1)));
  if(calls===2)return json(snapshot([example({Date:'2026-11-03',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321006'})],dataUri(2)));
  return new Response('No data found for this memberId',{status:404});
 }});
 const result=await reader.get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,2);
 assert.equal(calls,3);
});

test('V45 cannot follow malicious pagination, reflect secrets or silently expose private snapshot',async()=>{
 for(const next of [
  'https://evil.example/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start=1',
  dataUri(0),
  '/rest/memberSnapshotData?q=criteria&domain=INBOX&start=1',
  '/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start=1&memberId=someone'
 ]){
  const reader=createDMALiveReader({token:'private-token',fetchImpl:async()=>json(snapshot([example()],next))});
  const result=await reader.get();
  assert.equal(result.status,'unavailable');
  assert.deepEqual(result.posts,[]);
  assert.ok(!JSON.stringify(result).includes('private-token'));
 }
 const src=readFileSync(new URL('linkedin-live.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/localStorage|sessionStorage|document\.cookie|/);
 assert.equal(DMA_SNAPSHOT_URL,'https://api.linkedin.com/rest/memberSnapshotData');
 assert.equal(DMA_SNAPSHOT_VERSION,'202312');
});

test('V45 initial 404 is pending, expired token blocks, unknown audience never becomes public',async()=>{
 for(const [status,expected]of [[404,'not-ready'],[401,'not-authorized'],[403,'not-authorized']]){
  const reader=createDMALiveReader({token:'private-token',fetchImpl:async()=>new Response('',{status})});
  const output=await reader.get();
  assert.equal(output.status,expected);
  assert.deepEqual(output.posts,[]);
 }
 const unknown=await pageFilter([example({Visibility:null})]);
 assert.equal(unknown.status,'empty');
 assert.deepEqual(unknown.posts,[]);
});

test('V45 caching avoids repeated LinkedIn reads; fresh post after expiry wins',async()=>{
 let clock=1793940000000,calls=0;
 const reader=createDMALiveReader({token:'private-token',now:()=>clock,ttlMs:10000,fetchImpl:async()=>{
  calls++;
  return json(snapshot([example({Date:'2026-11-04',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:'+String(7382430987654321000+calls)})]));
 }});
 const first=await reader.get();
 assert.equal(first.status,'ready');
 await reader.get();
 assert.equal(calls,1);
 clock+=10001;
 await reader.get();
 assert.equal(calls,2);
});

test('V45 Ask M uses the secret for LinkedIn fetch only and cites the latest verified post as untrusted evidence',async()=>{
 const requests=[],secret='should-remain-server-side',openai='openai-test-key';
 const fetchImpl=async(url,options)=>{
  requests.push({url,options});
  if(url.startsWith(DMA_SNAPSHOT_URL))return json(snapshot([example()]));
  if(url===API_URL)return json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
   reply:'O último post verificado, de 5 de novembro de 2026, fala de Salesforce.',expression:'neutral',gesture:'none',section:'none'
  })}]}]});
  throw Error('unexpected upstream '+url);
 };
 const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
 const handler=createHandler({env:{OPENAI_API_KEY:openai,LINKEDIN_DMA_ACCESS_TOKEN:secret},fetchImpl,quota});
 const request=message=>new Request('https://local.test/api/m/respond',{method:'POST',headers:{
  origin:'https://ricardo19-deve.github.io','content-type':'application/json'
 },body:JSON.stringify({message,history:[],context:{section:'home',language:'pt'}})});
 const answer=await handler(request('Qual foi o último post dele?'),{clientIp:'test'});
 assert.equal(answer.status,200);
 assert.deepEqual(requests.map(r=>new URL(r.url).hostname),['api.linkedin.com','api.openai.com']);
 assert.equal(requests[0].options.headers.Authorization,'Bearer '+secret);
 const payload=JSON.parse(requests[1].options.body);
 assert.ok(!payload.instructions.includes(example().ShareCommentary),'post text must not become a system instruction');
 assert.match(payload.input.at(-1).content,/Ricardo shares an update/);
 assert.match(payload.input.at(-1).content,/2026-11-05/);
 assert.ok(!JSON.stringify(payload).includes(secret),'owner token must never reach the model');
 assert.ok(!JSON.stringify(await answer.json()).includes(secret),'token must never reach a visitor');

 requests.length=0;
 const second=await handler(request('What is Ricardo’s Salesforce experience?'),{clientIp:'test'});
 assert.equal(second.status,200);
 assert.deepEqual(requests.map(r=>r.url),[API_URL],'unrelated questions must not spend LinkedIn API quota');
});

test('V45 no access token preserves V43 FAQ behavior; LinkedIn errors do not block chat',async()=>{
 for(const status of [null,401,500]){
  const calls=[],quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
  const handler=createHandler({env:{
   OPENAI_API_KEY:'openai-private-key',
   ...(status===null?{}:{LINKEDIN_DMA_ACCESS_TOKEN:'private-owner-token'})
  },quota,fetchImpl:async(url)=>{
   calls.push(url);
   if(url.startsWith(DMA_SNAPSHOT_URL))return new Response('error',{status});
   if(url===API_URL)return json({status:'completed',output:[{type:'message',content:[{type:'output_text',
    text:JSON.stringify({reply:'O portefólio tem um link público para o LinkedIn.',expression:'neutral',gesture:'none',section:'none'})}]}]});
   throw Error('Unexpected URL');
  }});
  const result=await handler(new Request('https://local.test/api/m/respond',{method:'POST',headers:{
   origin:'https://ricardo19-deve.github.io','content-type':'application/json'
  },body:JSON.stringify({message:'Qual o último post do LinkedIn?',history:[],context:{section:'home',language:'pt'}})}));
  assert.equal(result.status,200);
  assert.equal(calls.at(-1),API_URL);
 }
});
