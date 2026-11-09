import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import analytics from './worker.mjs';
import {MLinkedInSyncService} from '../m-ai/worker.mjs';

const canonical=readFileSync(new URL('wrangler.toml',import.meta.url),'utf8');
const root=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const m=JSON.parse(readFileSync(new URL('../m-ai/wrangler.jsonc',import.meta.url),'utf8'));
const CRON='15 2,5,8,11,14,17,20,23 * * *';

function envFor(events){
 return {
  ANALYTICS_DB:{
   prepare(sql){
    events.push(['sql',sql]);
    return {bind(cutoff){events.push(['cutoff',cutoff]);return {run:async()=>{
     events.push(['cleanup']);return {success:true};
    }};}};
   }
  },
  M_LINKEDIN_SYNC:{async refresh(){
   events.push(['m-refresh']);
   return {state:'updated',stored:true,count:1};
  }}
 };
}
test('V62 reuses exactly the existing analytics Cron with one private service binding',()=>{
 for(const config of [canonical,root]){
  assert.match(config,/crons = \["15 2,5,8,11,14,17,20,23 \* \* \*"\]/);
  assert.match(config,/\[\[services\]\]\s+binding = "M_LINKEDIN_SYNC"\s+service = "m-portfolio-companion"\s+entrypoint = "MLinkedInSyncService"/);
  assert.match(config,/keep_vars = true/);
 }
 assert.deepEqual(m.triggers.crons,[],'the M Worker must not add a sixth Cron Trigger');
 assert.equal(m.name,'m-portfolio-companion');
 assert.ok(m.durable_objects.bindings.some(x=>x.class_name==='MVerifiedPosts'));
});

test('V62 each scheduled analytics run refreshes verified M posts but retains analytics cleanup once a day',async()=>{
 const events=[],env=envFor(events);
 await analytics.scheduled({scheduledTime:Date.parse('2026-11-09T02:15:00Z')},env);
 assert.deepEqual(events.map(e=>e[0]),['sql','cutoff','cleanup','m-refresh']);
 const cutoff=events.find(e=>e[0]==='cutoff')[1];
 assert.match(cutoff,/^\d{4}-\d{2}-\d{2}$/);
 events.length=0;
 await analytics.scheduled({scheduledTime:Date.parse('2026-11-09T05:15:00Z')},env);
 assert.deepEqual(events,[['m-refresh']],'M refreshes without repeating analytics cleanup');
});

test('V62 analytics cleanup and private M synchronization are isolated from failures',async()=>{
 const events=[],env=envFor(events);
 env.M_LINKEDIN_SYNC.refresh=async()=>{events.push(['m-error']);throw new Error('transient-provider-error');};
 await analytics.scheduled({scheduledTime:Date.parse('2026-11-09T02:15:00Z')},env);
 assert.ok(events.some(e=>e[0]==='cleanup'),'D1 cleanup must run if LinkedIn is unavailable');
 events.length=0;
 env.ANALYTICS_DB.prepare=()=>({bind:()=>({run:async()=>{events.push(['d1-error']);throw Error('D1 temporarily down');}})});
 env.M_LINKEDIN_SYNC.refresh=async()=>{events.push(['m-refresh']);return {state:'not-configured',stored:false,count:0};};
 await analytics.scheduled({scheduledTime:Date.parse('2026-11-09T02:15:00Z')},env);
 assert.deepEqual(events,[['d1-error'],['m-refresh']]);
});

test('V62 no official LinkedIn authorization fails closed without exposing a public refresh endpoint',async()=>{
 assert.equal(typeof MLinkedInSyncService,'function');
 // Simulate only the Node regression runner; Cloudflare supplies real
 // WorkerEntrypoint env/context when called over the bound private RPC.
 const service=new MLinkedInSyncService({}, {});
 assert.deepEqual(await service.refresh(),{state:'not-configured',stored:false,count:0});
 const result=await analytics.fetch(new Request('https://analytics.test/internal/m-sync'),{});
 assert.equal(result.status,404);
});
