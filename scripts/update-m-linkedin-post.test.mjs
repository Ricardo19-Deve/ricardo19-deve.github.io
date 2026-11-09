import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addVerifiedPost} from './update-m-linkedin-post.mjs';
import {validatePublicActivity,LINKEDIN_PROFILE_URL} from '../m-ai/public-activity.mjs';
const now=new Date('2026-11-09T12:30:00Z');
const feed=()=>({version:1,owner:'Ricardo Pinheiro',profileUrl:LINKEDIN_PROFILE_URL,asOf:'2026-11-09',posts:[]});
const sample={url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/',publishedAt:'2026-11-03',summary:'Meet M: bringing 3D animation and AI into my portfolio.',audience:'PUBLIC_CONFIRMED'};
test('V60 owner can add a confirmed public post safely',()=>{
 const next=addVerifiedPost(feed(),sample,{now});
 assert.equal(next.posts.length,1);
 assert.equal(next.posts[0].visibility,'public');
 assert.equal(next.posts[0].source,'owner-curated');
 assert.equal(next.posts[0].id,'owner-reviewed-7523386814880047107');
 assert.equal(next.asOf,'2026-11-09');
 assert.equal(validatePublicActivity(next).status,'ready');
});
test('V60 can revise an already verified public post without duplicates',()=>{
 const first=addVerifiedPost(feed(),sample,{now});
 const again=addVerifiedPost(first,{...sample,summary:'Meet M: another public post description for this record.'},{now});
 assert.equal(again.posts.length,1);assert.match(again.posts[0].text,/another public/);
});
test('V60 rejects restricted/unknown visibility, wrong owner, bad domain and future dates',()=>{
 const bad=[
  {...sample,audience:'NOT_PUBLIC'},
  {...sample,audience:'CONNECTIONS'},
  {...sample,url:'https://evil.test/feed/update/urn:li:activity:7523386814880047107/'},
  {...sample,url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/?trk=tracking'},
  {...sample,url:'https://www.linkedin.com/login'},
  {...sample,publishedAt:'2026-12-30'},
  {...sample,publishedAt:'2026-02-30'},
  {...sample,summary:'short'},
  {...sample,summary:'a'.repeat(1501)}
 ];
 for(const candidate of bad)assert.throws(()=>addVerifiedPost(feed(),candidate,{now}));
 assert.throws(()=>addVerifiedPost(feed(),sample,{now,actor:'other-user'}));
});
test('V60 GitHub publishing flow requires owner action and no LinkedIn tokens',()=>{
 const yaml=readFileSync(new URL('../.github/workflows/m-linkedin-reviewed-post.yml',import.meta.url),'utf8');
 assert.match(yaml,/workflow_dispatch/);
 assert.match(yaml,/PUBLIC_CONFIRMED/);
 assert.match(yaml,/github.actor == 'Ricardo19-Deve'/);
 assert.match(yaml,/node scripts\/update-m-linkedin-post.mjs/);
 assert.doesNotMatch(yaml,/CLOUDFLARE_API_TOKEN|LINKEDIN_DMA_ACCESS_TOKEN|OPENAI_API_KEY/);
});
