import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weatherBehaviorProfile,weatherCandidateWeight,weatherEffortMultiplier,weatherPresentation} from './m-world-weather-behavior.mjs';
import {makeWeatherDemo} from './m-world-weather.mjs';
import {createAutonomy} from './m-world-autonomy.mjs';

const calm={status:'ready',condition:'clear',precipitation:0,cloud:0,windKmh:0,windDirection:0,isDay:true};
const storm={...calm,condition:'rain',precipitation:10,windKmh:60,cloud:1};
const clear=weatherBehaviorProfile(calm),wet=weatherBehaviorProfile(storm);
const ordinary=['perch','rest','observe','think','inspect','peek','orbit','light','ball','hop'];
const targets=[{id:'card-a',stableId:'project-a',actions:['inspect','peek','perch','orbit'],novelty:.7,visibleShare:.9,distance:220}];
const facts=(nowMs=60_000,weather=undefined,extra={})=>({nowMs,energy:.62,routinesAvailable:true,selfPlayAvailable:true,ballPlayAvailable:true,targets,weather,...extra,context:{active:true,...extra.context}});
const key=d=>d.kind+':'+d.action+':'+d.gesture+':'+d.play;
const activePlay=d=>d.kind==='self-play'||d.gesture==='hop'||d.action==='orbit'||d.action==='peek';
const quiet=d=>d.kind==='rest'||d.action==='perch'||d.reason==='observe'||d.gesture==='think';

test('weather profile is cached immutable normalized data from existing forecasts or debug demos',()=>{
 for(const kind of ['rain','wind','cloud','sun','snow']){
  const forecast=makeWeatherDemo(kind),before=structuredClone(forecast),profile=weatherBehaviorProfile(forecast);
  assert.ok(Object.isFrozen(profile));assert.deepEqual(forecast,before);
  for(const field of ['rain','wind','comfort'])assert.ok(Number.isFinite(profile[field])&&profile[field]>=0&&profile[field]<=1,field);
  assert.equal(weatherPresentation(profile),profile,'reuse cached presentation instead of allocating each frame');
  assert.equal(weatherEffortMultiplier(profile),profile.effortMultiplier);
 }
 assert.deepEqual(weatherBehaviorProfile(calm),clear);
 assert.equal(clear.effortMultiplier,1);assert.equal(wet.effortMultiplier,1.12);
 assert.equal(clear.arousalOffset,0);assert.equal(clear.focusOffset,0);
 assert.ok(wet.arousalOffset>clear.arousalOffset&&wet.focusOffset>clear.focusOffset);
 assert.ok(clear.valenceOffset>wet.valenceOffset);
});

test('unknown, unavailable and malformed forecasts have no behavioral or metabolic effect',()=>{
 const invalid=[null,undefined,false,[],{}, {...calm,status:'stale'}, {...calm,condition:'hurricane'},
  {...calm,windKmh:NaN},{...calm,windKmh:Infinity},{...calm,windKmh:-1},{...calm,windKmh:289},
  {...calm,precipitation:-1},{...calm,precipitation:101},{...calm,cloud:NaN},{...calm,cloud:1.1}];
 const neutral=weatherPresentation();
 for(const raw of invalid){
  assert.equal(weatherBehaviorProfile(raw),null);
  assert.equal(weatherPresentation(raw),neutral);assert.equal(weatherEffortMultiplier(raw),1);
  for(const family of ordinary)assert.equal(weatherCandidateWeight(family,raw),1);
 }
 assert.ok(Object.isFrozen(neutral));
 assert.equal(neutral.arousalOffset+neutral.focusOffset+neutral.valenceOffset,0);
});

test('rain and wind bias ordinary activity monotonically within a small fixed budget',()=>{
 let previousPlay=Infinity,previousPerch=0,previousEffort=0;
 for(const speed of [0,10,20,40,60,120]){
  const p=weatherBehaviorProfile({...calm,windKmh:speed});
  const play=weatherCandidateWeight('ball',p),perch=weatherCandidateWeight('perch',p);
  assert.ok(play<=previousPlay+1e-12);assert.ok(perch>=previousPerch-1e-12);
  assert.ok(weatherEffortMultiplier(p)>=previousEffort);previousPlay=play;previousPerch=perch;previousEffort=p.effortMultiplier;
  for(const family of ordinary){const w=weatherCandidateWeight(family,p);assert.ok(w>=.72&&w<=1.16,family);}
 }
 previousPlay=Infinity;previousPerch=0;
 for(const precipitation of [0,.5,1,2,5,10]){
  const p=weatherBehaviorProfile({...calm,condition:'rain',precipitation});
  const play=weatherCandidateWeight('hop',p),perch=weatherCandidateWeight('perch',p);
  assert.ok(play<=previousPlay+1e-12);assert.ok(perch>=previousPerch-1e-12);
  assert.equal(weatherEffortMultiplier(p),1,'rain alone is not invented physical fatigue');
  previousPlay=play;previousPerch=perch;
 }
});

test('weather cannot change sleep, achievement or persistent goal candidate weights',()=>{
 for(const kind of ['rain','wind','cloud','sun','snow'])for(const family of ['sleep','achievement','goal-light','goal-lookout','goal-new','unknown'])
  assert.equal(weatherCandidateWeight(family,weatherBehaviorProfile(makeWeatherDemo(kind))),1,family);
});

test('profile helpers reject corrupted derived values and cannot accept arbitrary external multipliers',()=>{
 const neutral=weatherPresentation(null);
 for(const bad of [{...wet,version:2},{...wet,wind:NaN},{...wet,effortMultiplier:900},
  {...wet,effortMultiplier:1.01},{...wet,arousalOffset:.01},{...wet,focusOffset:Infinity},
  {...wet,valenceOffset:.035},{...wet,condition:'unknown'},{rain:1,wind:1}]){
  assert.equal(weatherEffortMultiplier(bad),1);assert.equal(weatherPresentation(bad),neutral);
  assert.equal(weatherCandidateWeight('ball',bad),1);
 }
 assert.deepEqual(weatherBehaviorProfile({...storm,effortMultiplier:900,playBias:900}),wet,'provider extras never become instructions or multipliers');
});

function timeline(seed,weather){
 const ai=createAutonomy({seed}),rows=[];let execution=null;
 for(let now=1000;now<181_000;now+=1000){
  if(execution&&now>=execution.until){assert.equal(ai.complete({success:true,nowMs:now}),true);execution=null;}
  const choice=ai.choose(facts(now,weather));if(!choice)continue;
  rows.push({now,...choice});assert.equal(ai.resolve(choice.id,{accepted:true,nowMs:now}),true);
  execution={until:now+(choice.kind==='scene'?4500:choice.kind==='self-play'?6500:5500)};
 }
 return {rows,snapshot:ai.snapshot()};
}

test('invalid or omitted weather preserves complete seeded legacy choices and outcomes exactly',()=>{
 for(const seed of [1,7,47,7919]){
  const original=timeline(seed,undefined);
  for(const invalid of [null,false,{},storm,{...wet,focusOffset:NaN}])assert.deepEqual(timeline(seed,invalid),original);
 }
 assert.deepEqual(timeline(47,wet),timeline(47,wet),'profile never consumes an independent random stream');
 assert.notDeepEqual(timeline(47,wet).rows,timeline(48,wet).rows);
});

test('same-seed populations show weather-aware preferences without forcing a fixed action or loop',()=>{
 const picks=weather=>Array.from({length:512},(_,i)=>createAutonomy({seed:i*7919+17}).choose(facts(60_000,weather)));
 const sunny=picks(clear),rainy=picks(wet);
 const count=(rows,predicate)=>rows.filter(predicate).length;
 assert.ok(count(rainy,activePlay)<count(sunny,activePlay)-20,JSON.stringify({sunPlay:count(sunny,activePlay),rainPlay:count(rainy,activePlay)}));
 assert.ok(count(rainy,quiet)>count(sunny,quiet)+20);
 for(const rows of [sunny,rainy]){
  assert.ok(new Set(rows.map(key)).size>=6,'weather is a bias, not a new state machine');
  assert.ok(rows.some(activePlay)&&rows.some(quiet),'physical needs and alternative actions stay available');
 }
});

test('weather changes cannot preempt accepted ownership or fabricate completion and achievement',()=>{
 const ai=createAutonomy({seed:7}),choice=ai.choose(facts(1000,clear));
 assert.equal(ai.resolve(choice.id,{accepted:true,nowMs:1000}),true);
 for(const weather of [wet,null,clear]){
  assert.equal(ai.choose(facts(2000,weather)),null);
  assert.deepEqual(ai.snapshot().active,choice);assert.equal(ai.snapshot().completedCount,0);
 }
 assert.equal(ai.complete({success:false,reason:'route-interrupted',nowMs:3000}),true);
 assert.equal(ai.snapshot().completedCount,0);assert.equal(ai.snapshot().achievementPending,false);
 assert.equal(ai.snapshot().failedCount,1);
});

test('weather preserves accessibility/input safety, quiet reading and cooldown gates',()=>{
 for(const context of [{active:false},{hidden:true},{reducedMotion:true},{typing:true},{selection:true},{scrolling:true}]){
  assert.equal(createAutonomy({seed:7}).choose(facts(1000,wet,{context})),null);
 }
 for(let seed=0;seed<100;seed++){
  const choice=createAutonomy({seed}).choose(facts(1000,wet,{context:{reading:true}}));
  assert.ok(choice?.quiet);assert.notEqual(choice.kind,'scene');assert.notEqual(choice.kind,'self-play');
 }
 for(let seed=0;seed<100;seed++){
  const choice=createAutonomy({seed}).choose(facts(1000,wet,{energy:.1,routinesAvailable:false,selfPlayAvailable:false,ballPlayAvailable:false,targets:[]}));
  assert.ok(choice?.quiet);assert.equal(choice.targetId,null);
  assert.ok(!choice.play&&!['sleep','hop','paw'].includes(choice.gesture),'weather cannot create an unavailable action or bypass energy thresholds');
 }
 const ai=createAutonomy({seed:47}),choice=ai.choose(facts(1000,wet));
 ai.resolve(choice.id,{accepted:true,nowMs:1000});ai.complete({success:true,nowMs:2000});
 const nextAt=ai.snapshot().nextDecisionAt;
 assert.equal(ai.choose(facts(nextAt-1,clear)),null,'sunny weather cannot skip the real action cooldown');
});

test('weather behavior contains no clocks, network, storage, visitor data or separate scheduler',()=>{
 const source=readFileSync(new URL('m-world-weather-behavior.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(?:fetch|setInterval|setTimeout)\s*\(|Date\.|localStorage|sessionStorage|document\.|window\.|OPENAI_|LINKEDIN/u);
});
