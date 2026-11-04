import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const param=(content,name)=>content.match(new RegExp('^'+name+'\\s*=\\s*"([^"]+)"','m'))?.[1];

test('Cloudflare Git Builds can find real analytics worker from either repository root',()=>{
 const root=read('wrangler.toml'),analytics=read('analytics/wrangler.toml');
 for(const key of ['name','database_id','database_name','binding','compatibility_date','PUBLIC_ORIGIN']){
  assert.equal(param(root,key),param(analytics,key),key+' must not diverge between build roots');
 }
 assert.equal(param(root,'name'),'ricardo19-deve-github-io');
 assert.equal(param(root,'main'),'analytics/worker.mjs');
 assert.equal(param(analytics,'main'),'worker.mjs');
 assert.equal(param(root,'migrations_dir'),'analytics/migrations');
 assert.equal(param(analytics,'migrations_dir'),'migrations');
 assert.doesNotMatch(root,/^ADMIN_TOKEN\s*=/m);
 assert.doesNotMatch(analytics,/^ADMIN_TOKEN\s*=/m);
 const worker=read('analytics/worker.mjs');
 assert.match(worker,/path==='\/health'/);
 assert.match(worker,/path==='\/api\/visit'/);
 assert.match(worker,/path==='\/admin'/);
});
