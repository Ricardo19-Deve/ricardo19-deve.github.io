import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DMA_ENDPOINT,DMA_VERSION,DMA_DOMAIN,convertSnapshotRows,fetchMemberShareSnapshot,buildPublicReview} from './linkedin-dma-member.mjs';

const item=(extra={})=>({
 Date:'2026-11-05',ShareCommentary:'A public post about architecture and football coaching',
 ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321000',
 Visibility:'Public',...extra
});
const body=(rows,more=null)=>({elements:[{snapshotDomain:DMA_DOMAIN,snapshotData:rows}],
 paging:{links:more===null?[]:[{rel:'next',href:'/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start='+more}]}});
const response=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
test('V44 only genuinely PUBLIC dated authored member shares enter the review draft',()=>{
 const records=[
  item(),item({ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321001',Date:'2026-11-04',Visibility:'Everyone'}),
  item({ShareLink:'https://www.linkedin.com/posts/ricardoappinheiro_public-post-7381-ABcd',Visibility:'Connections'}),
  item({ShareLink:'https://www.linkedin.com/posts/ricardoappinheiro_public-post-7382-ABcd',Visibility:'Private'}),
  item({ShareLink:'https://www.linkedin.com/posts/ricardoappinheiro_public-post-7383-ABcd',Visibility:''}),
  item({ShareLink:'https://evil.test/fake',Visibility:'Public'}),
  item({ShareCommentary:'',ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321004'}),
  item()
 ];
 const {draft,stats}=convertSnapshotRows(records,{today:'2026-11-06'});
 assert.equal(draft.posts.length,2);
 assert.equal(draft.posts[0].visibility,'public');
 assert.equal(stats.nonPublic,2);
 assert.equal(stats.unknownAudience,1);
 assert.equal(stats.invalidLink,1);
 assert.equal(stats.missingText,1);
 assert.equal(stats.duplicates,1);
 assert.equal(draft.posts[1].publishedAt,'2026-11-04');
});
test('V44 the token is sent only to LinkedIn fixed snapshot endpoint; private domains are never requested',async()=>{
 const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});
  return response(body([item()],1));
 };
 const result=await fetchMemberShareSnapshot({token:'opaque-secret',fetchImpl,maxPages:2}).catch(error=>error);
 assert.ok(result instanceof Error,'endless/unknown next page must fail closed instead of producing a partial review');
 assert.equal(calls.length,2);
 for(const call of calls){
  const url=new URL(call.url);
  assert.equal(url.origin,'https://api.linkedin.com');
  assert.equal(url.pathname,'/rest/memberSnapshotData');
  assert.equal(url.searchParams.get('domain'),'MEMBER_SHARE_INFO');
  assert.equal(url.searchParams.get('q'),'criteria');
  assert.equal(call.options.headers['Linkedin-Version'],'202312');
  assert.equal(call.options.headers.Authorization,'Bearer opaque-secret');
  assert.equal(call.options.redirect,'error');
 }
});
test('V44 valid multi-page member posts are combined; 404 after data terminates pagination',async()=>{
 let called=0;
 const fetchImpl=async url=>{
  called++;
  const start=Number(new URL(url).searchParams.get('start'));
  if(start===0)return response(body([item()],1));
  if(start===1)return response(body([item({ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321001'})],2));
  return new Response('No data found for this memberId',{status:404});
 };
 const result=await buildPublicReview({token:'opaque-secret',fetchImpl,today:'2026-11-06'});
 assert.equal(result.status,'ready');assert.equal(called,3);
 assert.equal(result.review.draft.posts.length,2);
 assert.equal(result.review.stats.received,2);
});
test('V44 not-yet-ready initial LinkedIn snapshot does not generate an empty public update',async()=>{
 const result=await buildPublicReview({token:'opaque-secret',fetchImpl:async()=>new Response('No data found',{status:404})});
 assert.equal(result.status,'not-ready');assert.equal(result.review,null);
});
test('V44 malicious pagination URLs, domain mixing and unusable tokens fail closed',async()=>{
 for(const href of ['https://evil.test/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start=1',
  '/rest/memberSnapshotData?q=criteria&domain=INBOX&start=1',
  '/rest/memberSnapshotData?q=criteria&domain=MEMBER_SHARE_INFO&start=0']){
  await assert.rejects(()=>fetchMemberShareSnapshot({token:'opaque-secret',
   fetchImpl:async()=>response({elements:[{snapshotDomain:DMA_DOMAIN,snapshotData:[item()]}],paging:{links:[{rel:'next',href}]}})}));
 }
 await assert.rejects(()=>fetchMemberShareSnapshot({token:'',fetchImpl:async()=>{throw Error('network must not run');}}));
 await assert.rejects(()=>fetchMemberShareSnapshot({token:'opaque-secret',fetchImpl:async()=>response(body([{Visibility:'Public',ShareCommentary:'fake',Date:'2026-11-05'}]))}).then(r=>convertSnapshotRows(r.rows,{today:'2026-11-06'})).then(r=>{if(r.draft.posts.length===0)throw Error('no safe public post');}));
});
test('V44 strict LinkedIn API and storage boundaries are documented in source',()=>{
 const source=readFileSync(new URL('linkedin-dma-member.mjs',import.meta.url),'utf8');
 assert.match(source,/DMA_DOMAIN='MEMBER_SHARE_INFO'/);
 assert.match(source,/DMA_VERSION='202312'/);
 assert.doesNotMatch(source,/\/rest\/memberSnapshotData.*INBOX|\/rest\/memberSnapshotData.*CONTACTS/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|page\.cookies|chromium\.launch/);
 assert.equal(DMA_ENDPOINT,'https://api.linkedin.com/rest/memberSnapshotData');
 assert.equal(DMA_VERSION,'202312');
});
