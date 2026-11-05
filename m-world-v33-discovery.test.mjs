import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pickDiscovery,fetchDailyDiscovery,lisbonDate} from './scripts/update-m-world-daily.mjs';
import {
 WORLD_FEED_LOCAL,WORLD_FEED_LATEST,M_KNOWLEDGE_KEY,
 validateWorldFeed,loadWorldFeed,createWorldKnowledge,worldDay
} from './m-world-world-knowledge.mjs';
import {worldCandidateWeight} from './m-world-world-rhythm.mjs';

const at=new Date('2026-11-05T12:16:00Z'),day='2026-11-05';
const source='https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/11/05';
const result={schema:1,date:day,source:'Wikipedia — On this day',sourceUrl:source,
 items:[{id:day+':1969:science',year:1969,title:'Apollo 11 mission',url:'https://en.wikipedia.org/wiki/Apollo_11',topic:'science'}]};
const store=()=>{
 const values=new Map(),calls=[];
 return {values,calls,getItem(k){calls.push(['read',k]);return values.get(k)||null;},
 setItem(k,v){calls.push(['write',k]);values.set(k,v);},removeItem(k){calls.push(['delete',k]);values.delete(k);}};
};
const fakeFeed={
 selected:[
  {year:1969,text:'Science exploration reaches new heights',pages:[
   {title:'Apollo 11 mission',description:'Space astronomy and science',
    content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Apollo_11'}}}]},
  {year:1941,text:'War in distant regions',pages:[
   {title:'A historic war',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/World_War_II'}}}]},
  {year:1992,text:'Arts exhibition opens',pages:[
   {title:'Museum of modern art',description:'Art museum',
    content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Art_museum'}}}]}
 ]
};

test('V33 weekday and date use Lisbon calendar without location or visitor data',()=>{
 assert.equal(lisbonDate(at),day);
 assert.equal(worldDay(at),day);
 assert.equal(worldDay(new Date('2026-06-04T23:30:00Z')),'2026-06-05');
});

test('V33 batch editor selects sourced, safe, bounded public knowledge',()=>{
 const selected=pickDiscovery(fakeFeed,day,source);
 assert.ok(selected);
 assert.equal(selected.schema,1);
 assert.equal(selected.date,day);
 assert.equal(selected.source,'Wikipedia — On this day');
 assert.equal(selected.items.length,1);
 assert.ok(['science','culture'].includes(selected.items[0].topic));
 assert.ok(selected.items[0].url.startsWith('https://en.wikipedia.org/wiki/'));
 assert.doesNotMatch(JSON.stringify(selected),/war|private|description|event\.text/iu);
 assert.deepEqual(pickDiscovery(fakeFeed,day,source),selected,'stable result across CI re-runs');
 assert.equal(validateWorldFeed(selected,{date:day})?.item?.title,selected.items[0].title);
});

test('V33 editorial fetch uses one Wikimedia request, explicit user agent and fails closed',async()=>{
 const urls=[],f=async(url,options)=>{urls.push({url,options});return {ok:true,json:async()=>fakeFeed};};
 const result=await fetchDailyDiscovery({at,fetchImpl:f});
 assert.equal(result.date,day);
 assert.equal(urls.length,1);
 assert.equal(urls[0].url,source);
 assert.equal(urls[0].options.redirect,'error');
 assert.match(urls[0].options.headers['User-Agent'],/MWorldDailyDiscovery/);
 await assert.rejects(fetchDailyDiscovery({at,fetchImpl:async()=>({ok:false,status:429})}),/unavailable/);
});

test('V33 fails closed for tampered, stale, unsourced or malicious public facts',()=>{
 assert.equal(validateWorldFeed(result,{date:'2026-11-06'}),null);
 const bad=[{...result,source:'Unknown'}, {...result,items:[]},
  {...result,items:[{...result.items[0],url:'https://evil.example/wiki/Apollo_11'}]},
  {...result,items:[{...result.items[0],title:'<script>evil</script>'}]},
  {...result,items:[{...result.items[0],id:'wrong'}]},
  {...result,sourceUrl:'https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/01/01'}];
 for(const v of bad)assert.equal(validateWorldFeed(v,{date:day}),null);
});

test('V33 reads a fresh same-origin feed first; raw GitHub only as stale Pages fallback',async()=>{
 let calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});
  return {ok:true,text:async()=>JSON.stringify(url===WORLD_FEED_LOCAL?{...result,date:'2026-11-04'}:result)};};
 const found=await loadWorldFeed({at,fetchImpl});
 assert.equal(found?.item.title,'Apollo 11 mission');
 assert.deepEqual(calls.map(x=>x.url),[WORLD_FEED_LOCAL,WORLD_FEED_LATEST]);
 assert.ok(calls.every(x=>x.options.credentials==='omit'&&x.options.referrerPolicy==='no-referrer'));
 calls=[];
 const fail=await loadWorldFeed({at,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(fail,null);
});

test('V33 repeated loads record only one day and one bounded topic count',async()=>{
 const storage=store();
 const fetchImpl=async()=>({ok:true,text:async()=>JSON.stringify(result)});
 const knowledge=createWorldKnowledge({remember:true,storage,fetchImpl,now:()=>at});
 const first=await knowledge.load(),second=await knowledge.load();
 assert.equal(first?.date,day);assert.equal(second?.date,day);
 assert.equal(knowledge.snapshot().encounters,1);
 assert.equal(knowledge.snapshot().interests.science,1);
 assert.equal(knowledge.hint().topic,'science');
 assert.ok(knowledge.hint().interest>=1&&knowledge.hint().interest<=1.09);
 assert.ok(storage.values.get(M_KNOWLEDGE_KEY).length<2800);
 assert.doesNotMatch(storage.values.get(M_KNOWLEDGE_KEY),/Apollo|wikipedia|url|email|ip|chat|prompt|visitor/iu);
 const again=createWorldKnowledge({remember:true,storage,fetchImpl,now:()=>at});
 await again.load();
 assert.equal(again.snapshot().encounters,1,'same daily discovery must not double count');
});

test('V33 opt-out never reads storage and erases long-term topic interests',async()=>{
 const storage=store(),fetchImpl=async()=>({ok:true,text:async()=>JSON.stringify(result)});
 const disabled=createWorldKnowledge({remember:false,storage,fetchImpl,now:()=>at});
 await disabled.load();
 assert.equal(disabled.snapshot().available,true);
 assert.equal(disabled.snapshot().memoryEnabled,false);
 assert.equal(storage.calls.length,0);
 assert.equal(disabled.hint().interest,1);
 const enabled=createWorldKnowledge({remember:true,storage,fetchImpl,now:()=>at});
 await enabled.load();
 assert.equal(enabled.snapshot().encounters,1);
 enabled.setRemember(false);
 assert.equal(enabled.snapshot().encounters,0);
 assert.equal(storage.values.has(M_KNOWLEDGE_KEY),false);
 enabled.setRemember(true);
 assert.equal(enabled.snapshot().encounters,1,'current public discovery may be re-recorded only after opt-in');
 enabled.reset();
 assert.equal(enabled.snapshot().encounters,0);
});

test('V33 world knowledge gently changes authored curiosity, never rest or safety',()=>{
 const world={phase:'day',discovery:{topic:'science',interest:1.09}};
 assert.ok(worldCandidateWeight('think',world)>worldCandidateWeight('think',{phase:'day'}));
 assert.ok(worldCandidateWeight('inspect',world)>worldCandidateWeight('inspect',{phase:'day'}));
 assert.equal(worldCandidateWeight('sleep',world),worldCandidateWeight('sleep',{phase:'day'}));
 assert.equal(worldCandidateWeight('ball',world),worldCandidateWeight('ball',{phase:'day'}));
 assert.equal(worldCandidateWeight('think',{phase:'day',discovery:{topic:'invalid',interest:9}}),worldCandidateWeight('think',{phase:'day'}));
});

test('V33 original M, privacy controls and worker separation remain authoritative',()=>{
 const main=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 const chat=readFileSync(new URL('m-world-companion.mjs',import.meta.url),'utf8');
 const flow=readFileSync(new URL('.github/workflows/m-world-daily-discovery.yml',import.meta.url),'utf8');
 assert.match(main,/createWorldKnowledge/);
 assert.match(main,/worldKnowledge\.setRemember\(value\)/);
 assert.match(main,/worldKnowledge\.reset\(\)/);
 assert.match(main,/discovery:typeof worldKnowledge==='undefined'\?null:worldKnowledge\.hint\(\)/);
 assert.match(chat,/getWorldDiscovery=\(\)=>null/);
 assert.match(chat,/worldNote\.hidden=true/);
 assert.match(chat,/worldLink\.rel='noopener noreferrer'/);
 assert.match(flow,/cron: '17 7 \* \* \*'/);
 assert.match(flow,/contents: write/);
 assert.doesNotMatch(flow,/wrangler|CLOUDFLARE_API_TOKEN|OPENAI_API_KEY/);
 const model=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(model,/preserveFullSkinning/);
});
