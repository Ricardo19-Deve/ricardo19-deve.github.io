import test from 'node:test';
import assert from 'node:assert/strict';
import {createDMALiveReader,DMA_SNAPSHOT_URL,DMA_SNAPSHOT_DOMAIN} from './linkedin-live.mjs';
import {createPublicActivityReader,PUBLIC_ACTIVITY_URL,LINKEDIN_PROFILE_URL} from './public-activity.mjs';
import {readFileSync} from 'node:fs';

const safePost={
 Date:'2026-11-05',
 ShareCommentary:'Ricardo published a public update about Salesforce architecture.',
 ShareLink:'https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321000',
 Visibility:'Public'
};
const json=obj=>new Response(JSON.stringify(obj),{headers:{'content-type':'application/json'}});
const snapshot=json({elements:[{snapshotDomain:DMA_SNAPSHOT_DOMAIN,snapshotData:[safePost]}],paging:{links:[]}});
const curated=json({
 version:1,owner:'Ricardo Pinheiro',
 profileUrl:LINKEDIN_PROFILE_URL,asOf:'2026-11-06',
 posts:[{id:'post-1',publishedAt:'2026-11-05',text:'Public update about Salesforce architecture.',
 url:safePost.ShareLink,source:'owner-curated',visibility:'public'}]
});

test('V49 Cloudflare fetch rejects redirect:error before any request: manual allows real DMA post retrieval',async()=>{
 let calls=0;
 const fetchImpl=async(url,init)=>{
  calls++;
  assert.equal(new URL(url).origin,'https://api.linkedin.com');
  if(init.redirect==='error')throw new TypeError('Cloudflare Workers does not implement redirect:error');
  assert.equal(init.redirect,'manual');
  assert.equal(init.headers['Linkedin-Version'],'202312');
  assert.equal(init.headers.Authorization,'Bearer simulated-token');
  return snapshot.clone();
 };
 const reader=createDMALiveReader({token:'simulated-token',fetchImpl});
 const result=await reader.get();
 assert.equal(result.status,'ready');
 assert.equal(result.posts.length,1);
 assert.equal(result.posts[0].url,safePost.ShareLink);
 assert.equal(calls,1);
});

test('V49 manual redirect fails closed: never follow LinkedIn 302 to another origin with owner secret',async()=>{
 let calls=0;
 const reader=createDMALiveReader({token:'simulated-token',fetchImpl:async(_,init)=>{
  calls++;
  assert.equal(init.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://untrusted.example/collect-token'}});
 }});
 const data=await reader.get();
 assert.equal(calls,1);
 assert.equal(data.status,'request-rejected');
 assert.equal(data.posts.length,0);
 assert.doesNotMatch(JSON.stringify(data),/simulated-token/);
});

test('V49 Cloudflare supported redirect mode also fixes the existing reviewed-public-post fallback',async()=>{
 let calls=0;
 const reader=createPublicActivityReader({url:PUBLIC_ACTIVITY_URL,fetchImpl:async(url,init)=>{
  calls++;
  assert.equal(url,PUBLIC_ACTIVITY_URL);
  assert.equal(init.redirect,'manual');
  return curated.clone();
 }});
 const data=await reader.get();
 assert.equal(data.status,'ready');
 assert.equal(data.posts.length,1);
 assert.equal(calls,1);
});

test('V49 reviewed public posts never follow a 302 redirect outside the fixed public origin',async()=>{
 let calls=0;
 const reader=createPublicActivityReader({url:PUBLIC_ACTIVITY_URL,fetchImpl:async(_,init)=>{
  calls++;
  assert.equal(init.redirect,'manual');
  return new Response(null,{status:302,headers:{location:'https://untrusted.example/redirect'}});
 }});
 const data=await reader.get();
 assert.equal(data.status,'unavailable');
 assert.equal(data.posts.length,0);
 assert.equal(calls,1);
});

test('V49 no Cloudflare Worker outbound fetch uses unsupported redirect:error',()=>{
 for(const path of ['linkedin-live.mjs','public-activity.mjs']){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(source,/redirect:\s*['"]error['"]/);
  assert.match(source,/redirect:\s*['"]manual['"]/);
 }
 assert.equal(DMA_SNAPSHOT_URL,'https://api.linkedin.com/rest/memberSnapshotData');
});
