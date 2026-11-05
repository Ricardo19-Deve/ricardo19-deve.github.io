import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {M_STORY_KEY,STORY_BEATS,storyCandidateWeight,livedStoryText,createLivedWorldStories} from './m-world-lived-stories.mjs';
import {worldCandidateWeight} from './m-world-world-rhythm.mjs';

let timestamp=new Date('2026-11-05T12:30:00Z');
const at=()=>timestamp;
const fact=(date='2026-11-05',topic='science')=>({
 date,
 discovery:{id:date+':2013:'+topic,year:2013,title:'ISRO',
  url:'https://en.wikipedia.org/wiki/ISRO',topic,
  source:'Wikipedia — On this day',
  sourceUrl:'https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/'+date.slice(5,7)+'/'+date.slice(8,10)}
});
const store=()=>{
 const values=new Map(),calls=[];
 return {values,calls,getItem:key=>{calls.push(['read',key]);return values.get(key)||null;},
 setItem:(key,value)=>{calls.push(['write',key]);values.set(key,value);},removeItem:key=>{calls.push(['delete',key]);values.delete(key);}};
};

test('V34 begins from the actual validated daily discovery, not unsourced text',()=>{
 timestamp=new Date('2026-11-05T12:30:00Z');
 const mem=createLivedWorldStories({storage:store(),now:at});
 assert.equal(mem.begin({date:'2026-11-05',discovery:{...fact().discovery,url:'https://evil.example/ISRO'}}),false);
 assert.equal(mem.begin(fact('2026-11-04')),false);
 assert.equal(mem.begin(fact()),true);
 const snap=mem.snapshot();
 assert.equal(snap.available,true);assert.equal(snap.step,0);assert.equal(snap.phase,'notice');
 assert.match(snap.narrative,/science/);
 assert.equal(snap.completed,false);
});

test('V34 only acknowledged compatible physical actions advance each beat',()=>{
 timestamp=new Date('2026-11-05T12:30:00Z');
 const m=createLivedWorldStories({storage:store(),now:at});
 assert.equal(m.record({family:'inspect',success:true}),null,'no verified source');
 m.begin(fact());
 assert.equal(m.record({family:'ball',success:true}),null,'cannot skip noticing');
 assert.equal(m.record({family:'observe',success:false}),null,'failed actions do not become memories');
 assert.deepEqual(m.record({family:'observe',success:true}),
  {beat:'notice',complete:false,step:1,topic:'science'});
 assert.equal(m.snapshot().phase,'explore');
 assert.equal(m.record({family:'think',success:true}),null,'no fake exploration');
 assert.deepEqual(m.record({family:'inspect',success:true}),
  {beat:'explore',complete:false,step:2,topic:'science'});
 assert.match(m.snapshot().narrative,/explored her surroundings/);
 assert.equal(m.record({family:'hop',success:true}),null,'must reflect');
 assert.deepEqual(m.record({family:'think',success:true}),
  {beat:'reflect',complete:true,step:3,topic:'science'});
 assert.equal(m.snapshot().completed,true);
 assert.deepEqual(m.snapshot().adventures,[{date:'2026-11-05',topic:'science'}]);
 assert.equal(m.record({family:'think',success:true}),null,'one real adventure per day');
});

test('V34 remembers completed experiences across visits without recording private data',()=>{
 timestamp=new Date('2026-11-05T12:30:00Z');
 const local=store(),a=createLivedWorldStories({storage:local,now:at});
 a.begin(fact());for(const family of ['observe','orbit','rest'])assert.ok(a.record({family,success:true}));
 assert.ok(local.values.has(M_STORY_KEY));
 const encoded=local.values.get(M_STORY_KEY);
 assert.ok(encoded.length<2800);
 for(const phrase of ['ISRO','wikipedia','/wiki/','visitor','email','prompt','message','userAgent','ipAddress']){
  assert.ok(!encoded.includes(phrase),'private/external text must not be stored: '+phrase);
 }
 const b=createLivedWorldStories({storage:local,now:at});
 b.begin(fact());assert.equal(b.snapshot().step,3);assert.equal(b.snapshot().adventures.length,1);
 timestamp=new Date('2026-11-06T12:30:00Z');
 assert.equal(b.begin(fact('2026-11-06','culture')),true);
 assert.equal(b.snapshot().step,0);
 assert.deepEqual(b.snapshot().adventures,[{date:'2026-11-05',topic:'science'}]);
 assert.equal(b.record({family:'inspect',success:true})?.beat,'notice');
 assert.equal(b.snapshot().step,1);
});

test('V34 opt-out erases journal and does not read or write persistent data',()=>{
 timestamp=new Date('2026-11-05T12:30:00Z');
 const local=store(),m=createLivedWorldStories({storage:local,remember:false,now:at});
 assert.equal(local.calls.length,0);
 m.begin(fact());
 for(const family of ['observe','inspect','think'])assert.ok(m.record({family,success:true}));
 assert.equal(m.snapshot().completed,true);
 assert.deepEqual(m.snapshot().adventures,[]);
 assert.equal(local.calls.length,0);
 assert.equal(m.setRemember(true),true);
 assert.equal(m.snapshot().step,0,'newly consented memory starts clean');
 assert.equal(local.values.has(M_STORY_KEY),true);
 for(const family of ['observe','inspect','think'])m.record({family,success:true});
 assert.equal(m.snapshot().adventures.length,1);
 m.setRemember(false);
 assert.equal(local.values.has(M_STORY_KEY),false);
 assert.equal(m.snapshot().adventures.length,0);
 assert.equal(m.snapshot().step,0);
 m.reset();
 assert.equal(local.values.has(M_STORY_KEY),false);
});

test('V34 corrupted or unsupported future records cannot be trusted or overwritten',()=>{
 timestamp=new Date('2026-11-05T12:30:00Z');
 const local=store();local.values.set(M_STORY_KEY,'{"version":99,"private":"not mine"}');
 const m=createLivedWorldStories({storage:local,now:at});
 assert.equal(m.begin(fact()),true);
 assert.match(local.values.get(M_STORY_KEY),/not mine/);
 const corrupt=store();corrupt.values.set(M_STORY_KEY,'{"version":1,"journal":[{"email":"bad"}]}');
 const n=createLivedWorldStories({storage:corrupt,now:at});
 n.begin(fact());assert.equal(n.snapshot().adventures.length,0);
 assert.equal(n.snapshot().step,0);
});

test('V34 source outage or a new date cannot manufacture progress',()=>{
 timestamp=new Date('2026-11-05T12:30:00Z');
 const m=createLivedWorldStories({storage:store(),now:at});
 m.begin(fact());
 m.record({family:'think',success:true});
 timestamp=new Date('2026-11-06T11:00:00Z');
 assert.equal(m.record({family:'inspect',success:true}),null);
 assert.equal(m.hint(),null);
 assert.equal(m.snapshot().available,false);
 assert.equal(m.snapshot().adventures.length,0,'unfinished story never becomes a success');
});

test('V34 each theme favors available authored activities but never forces them',()=>{
 const phases=['notice','explore','reflect'],topic='nature';
 for(const phase of phases){
  assert.ok(STORY_BEATS.includes(phase));
  assert.equal(storyCandidateWeight('sleep',{phase,topic}),1,'sleep is never displaced');
  assert.equal(storyCandidateWeight('unsupported',{phase,topic}),1);
 }
 assert.equal(storyCandidateWeight('inspect',{phase:'explore',topic}),1.24);
 assert.equal(storyCandidateWeight('think',{phase:'reflect',topic}),1.21);
 assert.equal(storyCandidateWeight('observe',{phase:'notice',topic}),1.17);
 assert.equal(storyCandidateWeight('inspect',{phase:'unknown',topic}),1);
 const base={phase:'day',discovery:{topic:'science',interest:1}};
 const withStory={...base,story:{topic:'science',phase:'notice'}};
 assert.ok(worldCandidateWeight('think',withStory)>worldCandidateWeight('think',base));
 assert.equal(worldCandidateWeight('sleep',withStory),worldCandidateWeight('sleep',base));
 assert.equal(worldCandidateWeight('ball',withStory),worldCandidateWeight('ball',base));
 assert.equal(worldCandidateWeight('think',{...base,story:{topic:'nature',phase:'notice'}}),worldCandidateWeight('think',base));
});

test('V34 narratives are templates for real actions, never synthetic article claims',()=>{
 assert.match(livedStoryText({topic:'culture',step:3}),/noticed, explored and reflected/);
 assert.equal(livedStoryText({topic:'unknown',step:2}),'');
 assert.equal(livedStoryText({topic:'science',step:6}),'');
});

test('V34 integration remains privacy-scoped with the original 3D M and AI budgets',()=>{
 const main=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 const chat=readFileSync(new URL('m-world-companion.mjs',import.meta.url),'utf8');
 const model=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(main,/createLivedWorldStories/);
 assert.match(main,/worldStories\.begin\(worldKnowledge\.snapshot\(\)\)/);
 assert.match(main,/worldStories\.record\(\{family,success\}\)/);
 assert.match(main,/worldStories\.reset\(\)/);
 assert.match(main,/worldStories\.setRemember\(value\)/);
 assert.match(main,/story:typeof worldStories==='undefined'\?null:worldStories\.hint\(\)/);
 assert.match(main,/worldStory:worldStories\.snapshot\(\)/);
 assert.match(chat,/worldNote\.append\(worldSummary,worldText,worldNarrative,worldLink\)/);
 assert.match(chat,/worldNarrative\.hidden=!worldNarrative\.textContent/);
 assert.match(chat,/getWorldStory=\(\)=>null/);
 assert.match(model,/preserveFullSkinning/);
});
