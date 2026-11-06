import test from 'node:test';
import assert from 'node:assert/strict';
import {createDMALiveReader,DMA_SNAPSHOT_URL} from './linkedin-live.mjs';
import {createHandler,API_URL} from './core.mjs';

const reader=response=>{
 const fetchImpl=async()=>response;
 return createDMALiveReader({token:'PRIVATE-OWNER-BEARER',fetchImpl}).get();
};
const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
const aiResponse=()=>new Response(JSON.stringify({status:'completed',
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
 reply:'Ainda não consegui confirmar o último post.',expression:'neutral',gesture:'none',section:'none'
 })}]}]}),{headers:{'content-type':'application/json'}});

test('V48 distinguishes LinkedIn HTTP rejection, throttling, outages and version mismatch',async()=>{
 for(const [code,kind]of [
  [400,'request-rejected'],[401,'not-authorized'],[403,'not-authorized'],
  [404,'not-ready'],[422,'request-rejected'],[426,'api-version-error'],
  [429,'rate-limited'],[500,'provider-error'],[503,'provider-error']
 ]){
  const result=await reader(new Response('Bearer PRIVATE-OWNER-BEARER',{status:code}));
  assert.equal(result.status,kind,'HTTP '+code+' category');
  assert.deepEqual(result.posts,[]);
  assert.ok(!JSON.stringify(result).includes('PRIVATE-OWNER-BEARER'));
 }
});

test('V48 classifies malformed API replies, over-limit payloads and unsafe pagination separately',async()=>{
 const malformed=await reader(new Response('{not json',{headers:{'content-type':'application/json'}}));
 assert.equal(malformed.status,'invalid-response');
 const wrongDomain=await reader(new Response(JSON.stringify({elements:[{snapshotDomain:'INBOX',snapshotData:[{Content:'private'}]}]})));
 assert.equal(wrongDomain.status,'invalid-response');
 const oversize=await reader(new Response(JSON.stringify({elements:[]}),{headers:{'content-length':'400000'}}));
 assert.equal(oversize.status,'response-too-large');
 const unsafe=await reader(new Response(JSON.stringify({
  elements:[{snapshotDomain:'MEMBER_SHARE_INFO',snapshotData:[]}],
  paging:{links:[{rel:'next',href:'https://evil.example/steal?token=PRIVATE-OWNER-BEARER'}]}
 })));
 assert.equal(unsafe.status,'invalid-pagination');
});

test('V48 differentiates network exception from request timeout without echoing exception content',async()=>{
 const network=createDMALiveReader({token:'PRIVATE-OWNER-BEARER',
  fetchImpl:async()=>{throw new TypeError('network aborted with token PRIVATE-OWNER-BEARER');}});
 const timed=createDMALiveReader({token:'PRIVATE-OWNER-BEARER',
  fetchImpl:async()=>{const error=new Error('PRIVATE-OWNER-BEARER');error.name='AbortError';throw error;}});
 assert.equal((await network.get()).status,'network-error');
 assert.equal((await timed.get()).status,'timeout');
 for(const reader of [network,timed])assert.ok(!JSON.stringify(reader.snapshot()).includes('PRIVATE-OWNER-BEARER'));
});

test('V48 Ask M receives specific provider status as untrusted evidence, never secret or high-priority instructions',async()=>{
 for(const [code,label]of [[400,/rejected the snapshot request/],
  [426,/requires Linkedin-Version: 202312/],
  [429,/rate limit/],[503,/returned a 5xx error/]]){
  const calls=[];
  const handler=createHandler({env:{OPENAI_API_KEY:'mock-openai',LINKEDIN_DMA_ACCESS_TOKEN:'PRIVATE-OWNER-BEARER'},
   quota,fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(url.startsWith(DMA_SNAPSHOT_URL))return new Response('PRIVATE-OWNER-BEARER',{status:code});
    if(url===API_URL)return aiResponse();
    throw Error('unexpected upstream');
   }});
  const request=new Request('https://site.local/api/m/respond',{method:'POST',headers:{
   origin:'https://ricardo19-deve.github.io','content-type':'application/json'},
   body:JSON.stringify({message:'Não consigo ver os posts no LinkedIn. Qual é o estado?',
    history:[],context:{section:'home',language:'pt'}})});
  const result=await handler(request);
  assert.equal(result.status,200,'chat remains operational HTTP '+code);
  assert.equal(calls.length,2);
  const payload=JSON.parse(calls[1].options.body);
  assert.match(payload.input.at(-1).content,label);
  assert.doesNotMatch(JSON.stringify(payload),/PRIVATE-OWNER-BEARER/);
  assert.doesNotMatch(payload.instructions,/The LinkedIn API rejected the snapshot request/);
 }
});

test('V48 a successful public-only snapshot still returns verified posts and does not degrade availability',async()=>{
 const publicRow={Date:'2026-11-05',ShareCommentary:'About Salesforce design',
  ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321000',Visibility:'Public'};
 const data=await reader(new Response(JSON.stringify({
  paging:{links:[]},
  elements:[{snapshotDomain:'MEMBER_SHARE_INFO',snapshotData:[publicRow]}]
 }),{headers:{'content-type':'application/json'}}));
 assert.equal(data.status,'ready');
 assert.equal(data.posts.length,1);
});
