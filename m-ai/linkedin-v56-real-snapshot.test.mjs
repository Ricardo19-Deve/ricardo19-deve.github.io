import test from 'node:test';
import assert from 'node:assert/strict';
import {createDMALiveReader,DMA_SNAPSHOT_URL} from './linkedin-live.mjs';
import {createHandler,API_URL} from './core.mjs';

const fakeToken='fake-owner-secret-do-not-expose';
const original='https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7382430987654321000';
const canonical='https://www.linkedin.com/feed/update/urn:li:share:7382430987654321000';
const exportRow=(extra={})=>({
 Date:'2026-11-05 15:44:45',
 ShareLink:original,
 ShareCommentary:'A public reflection on Salesforce and software architecture',
 Visibility:'PUBLIC',...extra
});
const page=(rows)=>new Response(JSON.stringify({
 elements:[{snapshotDomain:'MEMBER_SHARE_INFO',snapshotData:rows}],
 paging:{count:100,start:0,links:[]}
}),{headers:{'content-type':'application/json'}});
const reader=(rows,options={})=>createDMALiveReader({
 token:fakeToken,fetchImpl:async()=>page(rows),...options
});
test('V56 consumes the actual LinkedIn Shares.csv UTC date and percent-encoded share URN',async()=>{
 const output=await reader([exportRow()]).get();
 assert.equal(output.status,'ready');
 assert.equal(output.posts.length,1);
 assert.equal(output.posts[0].publishedAt,'2026-11-05');
 assert.equal(output.posts[0].url,canonical);
 assert.equal(output.posts[0].text,'A public reflection on Salesforce and software architecture');
 assert.ok(!JSON.stringify(output).includes(fakeToken));
});

test('V56 normalizes encoded activity and ugcPost permalinks, dropping tracker parameters',async()=>{
 const links=['https://pt.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A7382430987654321001?trk=share',
  'https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7382430987654321002#tracker',
  'https://linkedin.com/posts/ricardo-collaboration-activity-7382430987654321003-AbCd?utm_source=browser'];
 const result=await reader(links.map((ShareLink,i)=>exportRow({
  Date:'2026-11-0'+(5-i)+' 12:45:34',ShareLink
 }))).get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,3);
 assert.equal(result.posts[0].url,'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321001');
 assert.equal(result.posts[1].url,'https://www.linkedin.com/feed/update/urn:li:ugcPost:7382430987654321002');
 assert.equal(result.posts[2].url,'https://www.linkedin.com/posts/ricardo-collaboration-activity-7382430987654321003-AbCd');
});

test('V56 private-only exports are NEVER passed to M: MEMBER_NETWORK, CONNECTIONS and unknown visibility',async()=>{
 const result=await reader([
  exportRow({Visibility:'MEMBER_NETWORK'}),
  exportRow({Visibility:'CONNECTIONS',ShareCommentary:'private text'}),
  exportRow({Visibility:'PRIVATE',ShareCommentary:'secret'}),
  exportRow({Visibility:'LOGGED_IN'}),
  exportRow({Visibility:undefined}),
 ]).get();
 assert.equal(result.status,'no-public-posts');
 assert.deepEqual(result.posts,[]);
 assert.doesNotMatch(JSON.stringify(result),/secret|private text/);
});

test('V56 recognizes publicly shared reposts with no commentary without inventing the original post contents',async()=>{
 const result=await reader([exportRow({ShareCommentary:''})]).get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,1);
 assert.match(result.posts[0].text,/Partilha pública sem comentário próprio/);
 assert.equal(result.posts[0].url,canonical);
});

test('V56 longest public post content is safely excerpted rather than silently dropping the latest',async()=>{
 const text='A'.repeat(2500);
 const result=await reader([exportRow({ShareCommentary:text})]).get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,1);
 assert.ok(result.posts[0].text.length<=1500);
 assert.match(result.posts[0].text,/…$/u);
});

test('V56 keeps a closed post URL allowlist even with encoded traversal, unsafe hosts and other APIs',async()=>{
 const values=[
  'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A123%2F..%2Fadmin',
  'https://www.linkedin.com/%2Fadmin',
  'https://evil.example/feed/update/urn%3Ali%3Ashare%3A7382430987654321000',
  'https://www.linkedin.com/rest/memberSnapshotData?q=INBOX',
  'javascript:alert(1)',
  'http://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7382430987654321000',
  'https://user:pass@www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A7382430987654321000'
 ];
 const output=await reader(values.map((url,i)=>exportRow({ShareLink:url,Visibility:'PUBLIC',
  Date:'2026-11-05 15:44:45'}))).get();
 assert.equal(output.status,'unrecognized-public');
 assert.deepEqual(output.posts,[]);
});

test('V56 distinguishes empty snapshot from malformed public rows without exposing source contents',async()=>{
 const empty=await reader([]).get();
 assert.equal(empty.status,'empty');
 const malformed=await reader([exportRow({Date:'invalid'})]).get();
 assert.equal(malformed.status,'unrecognized-public');
 assert.deepEqual(malformed.posts,[]);
});

test('V56 drops previously verified posts immediately on API failure, never keeps stale snapshots forever',async()=>{
 let clock=Date.parse('2026-11-06T12:00:00Z'),calls=0;
 const m=createDMALiveReader({token:fakeToken,now:()=>clock,ttlMs:1000,
  fetchImpl:async()=>{
   calls++;
   if(calls===1)return page([exportRow()]);
   return new Response('No data found for this memberId',{status:404});
  }});
 const first=await m.get();
 assert.equal(first.status,'ready');
 clock+=1100;
 const later=await m.get();
 assert.equal(later.status,'not-ready');
 assert.deepEqual(later.posts,[],'cannot display old posts when current permission/snapshot is unavailable');
 assert.equal(m.snapshot().posts,0);
 assert.equal(calls,2);
});

test('V56 Ask M receives only validated public post text, date and canonical permalink, never private rows',async()=>{
 const calls=[];
 const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
 const handle=createHandler({env:{OPENAI_API_KEY:'fake-openai',LINKEDIN_DMA_ACCESS_TOKEN:fakeToken},
  quota,fetchImpl:async(url,options)=>{
   calls.push({url,options});
   if(url.startsWith(DMA_SNAPSHOT_URL))return page([
    exportRow({Visibility:'MEMBER_NETWORK',ShareCommentary:'STRICTLY-NONPUBLIC-POST'}),
    exportRow()
   ]);
   if(url===API_URL)return new Response(JSON.stringify({status:'completed',output:[
    {type:'message',content:[{type:'output_text',text:JSON.stringify({
     reply:'O último post público disponível foi sobre Salesforce.',
     expression:'neutral',gesture:'none',section:'none'
    })}]}]}),{headers:{'content-type':'application/json'}});
   throw Error('unexpected host');
  }});
 const req=new Request('https://example.test/api/m/respond',{method:'POST',headers:{
  origin:'https://ricardo19-deve.github.io','content-type':'application/json'
 },body:JSON.stringify({message:'Qual foi o último post do Ricardo no LinkedIn?',
  history:[],context:{section:'home',language:'pt'}})});
 const res=await handle(req);
 assert.equal(res.status,200);
 assert.equal(calls.length,2);
 const modelRequest=JSON.parse(calls[1].options.body);
 assert.match(modelRequest.input.at(-1).content,/A public reflection on Salesforce/);
 assert.match(modelRequest.input.at(-1).content,/urn:li:share:7382430987654321000/);
 assert.doesNotMatch(JSON.stringify(modelRequest),/STRICTLY-NONPUBLIC-POST/);
 assert.doesNotMatch(JSON.stringify(modelRequest),/fake-owner-secret-do-not-expose/);
});
