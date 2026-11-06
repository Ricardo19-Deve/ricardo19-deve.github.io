import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHandler,API_URL} from './core.mjs';
import {createDMALiveReader,DMA_SNAPSHOT_URL,DMA_SNAPSHOT_DOMAIN} from './linkedin-live.mjs';

const PUBLIC_LINK='https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321000';
const marker='CONFIDENTIAL_ACCOUNT_DATA_NOT_FOR_M';
const snap={elements:[{snapshotDomain:DMA_SNAPSHOT_DOMAIN,snapshotData:[
 {Date:'2026-11-05',Visibility:'Public',ShareCommentary:'A public Salesforce design post.',
  ShareLink:PUBLIC_LINK,Phone:marker,Contacts:[marker],Messages:[marker],ProfileMetadata:marker},
 {Date:'2026-11-04',Visibility:'Connections',ShareCommentary:marker,
  ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321001'},
 {Date:'2026-11-03',Visibility:'Private',ShareCommentary:marker,
  ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321002'},
 {Date:'2026-11-02',Visibility:null,ShareCommentary:marker,
  ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321003'}
]}],paging:{links:[]}};
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
test('Posts-only LinkedIn permission boundary: the integration requests no other member data domain',async()=>{
 const requests=[];
 const reader=createDMALiveReader({token:'private-mock-token',fetchImpl:async(url,options)=>{
  requests.push({url,options});return json(snap);
 }});
 const result=await reader.get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,1);
 assert.equal(result.posts[0].text,'A public Salesforce design post.');
 assert.equal(result.posts[0].url,PUBLIC_LINK);
 assert.ok(!JSON.stringify(result).includes(marker),'private source fields are never sent to the model');
 assert.equal(requests.length,1);
 const u=new URL(requests[0].url);
 assert.equal(u.origin,'https://api.linkedin.com');
 assert.equal(u.pathname,'/rest/memberSnapshotData');
 assert.equal(u.searchParams.get('domain'),'MEMBER_SHARE_INFO');
 assert.deepEqual([...u.searchParams.keys()].sort(),['domain','q','start']);
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.redirect,'manual');
 assert.equal(requests[0].options.credentials,'omit');
});
test('Posts-only Ask M context receives no private LinkedIn fields and no token',async()=>{
 const calls=[];
 const handle=createHandler({env:{OPENAI_API_KEY:'test-openai',LINKEDIN_DMA_ACCESS_TOKEN:'private-mock-token'},
  quota:{ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}},
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   if(url.startsWith(DMA_SNAPSHOT_URL))return json(snap);
   if(url===API_URL)return json({status:'completed',output:[{type:'message',content:[{
    type:'output_text',text:JSON.stringify({reply:'Ricardo publicou sobre Salesforce.',
     expression:'neutral',gesture:'none',section:'none'})
   }]}]});
   throw Error('Unexpected external request');
  }});
 const req=new Request('https://local.invalid/api/m/respond',{method:'POST',headers:{
  origin:'https://ricardo19-deve.github.io','content-type':'application/json'
 },body:JSON.stringify({message:'Que posts partilhou o Ricardo no LinkedIn?',
  history:[],context:{section:'home',language:'pt'}})});
 const response=await handle(req);
 assert.equal(response.status,200);
 assert.equal(calls.length,2,'only public-post snapshot and OpenAI; no third-party data collection');
 const ai=JSON.parse(calls[1].opts.body);
 assert.match(ai.input.at(-1).content,/A public Salesforce design post/);
 for(const raw of [marker,'private-mock-token','Contacts','Messages','ProfileMetadata'])
  assert.ok(!JSON.stringify(ai).includes(raw),'the model must never receive '+raw);
 assert.equal(calls[0].opts.headers.Authorization,'Bearer private-mock-token');
 assert.ok(!JSON.stringify(await response.json()).includes(marker));
});
test('Posts-only scope is fixed in production: no Changelog, Contacts, Profile, Inbox or memberAuthorizations API',()=>{
 const live=readFileSync(new URL('linkedin-live.mjs',import.meta.url),'utf8');
 const core=readFileSync(new URL('core.mjs',import.meta.url),'utf8');
 const worker=readFileSync(new URL('worker.mjs',import.meta.url),'utf8');
 for(const text of [live,core,worker]){
  assert.doesNotMatch(text,/\/rest\/memberChangeLogs|\/rest\/memberAuthorizations|\/rest\/contacts|\/rest\/messages|\/rest\/memberProfile/i);
 }
 assert.match(live,/DMA_SNAPSHOT_DOMAIN='MEMBER_SHARE_INFO'/);
 assert.match(live,/visibility!=='PUBLIC'&&visibility!=='EVERYONE'/);
 assert.match(live,/No raw snapshot, token, database writes|NO raw snapshot, token, database writes/i);
});
