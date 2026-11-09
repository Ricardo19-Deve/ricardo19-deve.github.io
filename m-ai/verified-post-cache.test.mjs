import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker,{MVerifiedPosts} from './worker.mjs';
import {storeVerifiedPosts,readVerifiedPosts} from './verified-post-cache.mjs';
const publicPost={publishedAt:'2026-11-03',text:'The owner introduced M, a 3D companion in the portfolio.',
 url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/',
 source:'owner-curated'};
const validated={status:'ready',posts:[publicPost],asOf:'2026-11-09'};
function fixture(){
 let stored;
 const sql={exec:(query,...args)=>{
  if(query.startsWith('SELECT'))return {toArray:()=>stored?[stored]:[]};
  if(query.startsWith('INSERT'))stored={payload:args[0],expires:args[1]};
  return {toArray:()=>[]};
 }};
 const archive=new MVerifiedPosts({storage:{sql}});
 const binding={idFromName:name=>name,get:()=>({
  fetch:(url,options)=>archive.fetch(new Request(url,options))
 })};
 return {archive,binding,record:()=>stored};
}
test('V61 verified archive stores only valid public posts through its internal binding',async()=>{
 const f=fixture(),env={M_VERIFIED_POSTS:f.binding};
 assert.equal(await storeVerifiedPosts(env,validated),true);
 const cached=await readVerifiedPosts(env);
 assert.equal(cached.status,'ready');
 assert.equal(cached.posts.length,1);
 assert.equal(cached.posts[0].url,publicPost.url);
 assert.equal(cached.posts[0].text,publicPost.text);
 assert.equal(f.record().payload.includes('secret'),false);
});
test('V61 archive rejects private or malicious posts and expires automatically',async()=>{
 const f=fixture(),env={M_VERIFIED_POSTS:f.binding};
 const privatePost={...publicPost,source:'private-export'};
 assert.equal(await storeVerifiedPosts(env,{status:'ready',posts:[privatePost],asOf:'2026-11-09'}),false);
 assert.equal(await storeVerifiedPosts(env,{status:'ready',posts:[{...publicPost,url:'https://evil.test'}],asOf:'2026-11-09'}),false);
 assert.equal(await readVerifiedPosts(env),null);
 assert.equal(await storeVerifiedPosts(env,validated),true);
 f.record().expires=Date.now()-1;
 assert.equal(await readVerifiedPosts(env),null);
});
test('V61 Cloudflare scheduler is bound to only the M Worker with SQLite migration',async()=>{
 const config=JSON.parse(readFileSync(new URL('wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'m-portfolio-companion');
 assert.deepEqual(config.triggers.crons,['17 */3 * * *']);
 assert.ok(config.durable_objects.bindings.some(x=>x.name==='M_VERIFIED_POSTS'&&x.class_name==='MVerifiedPosts'));
 assert.ok(config.migrations.some(x=>x.tag==='v2'&&x.new_sqlite_classes.includes('MVerifiedPosts')));
 assert.equal(typeof worker.scheduled,'function');
 const waits=[];
 await worker.scheduled({}, {}, {waitUntil:promise=>waits.push(promise)});
 assert.equal(waits.length,1);
 await waits[0];
});
