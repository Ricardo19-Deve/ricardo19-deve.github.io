import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGrowthMemory,makeLivingSeed,lisbonGrowthDay,
 M_GROWTH_STORAGE_KEY,growthFamilyForDecision,GROWTH_FAMILIES} from './m-world-growth.mjs';
import {createAutonomy} from './m-world-autonomy.mjs';
import {createScenePlan} from './m-world-scenes.mjs';

const storage=(initial=[])=>{const map=new Map(initial);return {map,getItem:key=>map.get(key)||null,
 setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const clock={value:Date.parse('2026-11-05T08:00:00Z')};
const fresh=(s,remember=true)=>createGrowthMemory({storage:s,remember,now:()=>clock.value});
const target=id=>({id,stableId:id,actions:['inspect','peek','perch','orbit'],novelty:.8,visibleShare:1,distance:180});
const facts=(seed,opening)=>({nowMs:0,context:{active:true},energy:.78,targets:[target('a'),target('b')],
 selfPlayAvailable:true,ballPlayAvailable:true,routinesAvailable:true,
 habits:{...fresh(storage()).preferences(),opening}});

test('V31 new visit seed uses browser cryptography and does not repeat fixed starts',()=>{
 const s1=makeLivingSeed({cryptoImpl:{getRandomValues:a=>{a[0]=123456;a[0]++;}},random:()=>0,now:()=>0});
 const s2=makeLivingSeed({cryptoImpl:{getRandomValues:a=>{a[0]=123987;}},random:()=>0,now:()=>0});
 assert.equal(s1,123457);assert.equal(s2,123987);assert.notEqual(s1,s2);
 assert.ok(makeLivingSeed({cryptoImpl:null,random:()=>.23,now:()=>3456})>0);
});

test('V31 remembers only bounded behavioral outcomes over different Lisbon days',()=>{
 const s=storage();clock.value=Date.parse('2026-11-05T08:00:00Z');
 const m=fresh(s);assert.equal(m.snapshot().days,1);assert.equal(m.snapshot().opens,1);
 for(let i=0;i<15;i++)assert.equal(m.record({family:'light',success:true}),true);
 assert.equal(m.record({family:'ball',success:false}),true);
 assert.equal(m.record({family:'unknown',success:true}),false);
 assert.equal(m.record({family:'light',success:'true'}),false);
 assert.equal(m.snapshot().completed,15);assert.equal(m.snapshot().attempts,16);
 const p=m.preferences();for(const w of Object.values(p.weights))assert.ok(w>=.7&&w<=1.2);
 assert.ok(p.weights.light<p.weights.peek,'Repeated play becomes less likely than novel expressions');
 const raw=s.map.get(M_GROWTH_STORAGE_KEY);
 for(const data of ['http','ip','email','name','visitor','message','prompt','chat','userAgent'])
  assert.ok(!raw.includes('"'+data+'"'),'no personal fields are ever saved');
 assert.ok(raw.length<3000);
 clock.value=Date.parse('2026-11-06T08:00:00Z');
 const returned=fresh(s);assert.equal(returned.snapshot().days,2);assert.equal(returned.snapshot().opens,2);
 assert.equal(returned.snapshot().completed,15);assert.equal(returned.preferences().recent.at(-1),'light');
});

test('V31 daily rhythm follows Europe/Lisbon, not host UTC offset',()=>{
 assert.equal(lisbonGrowthDay(new Date('2026-06-04T23:30:00Z')),'2026-06-05');
 assert.equal(lisbonGrowthDay(new Date('2026-11-04T23:30:00Z')),'2026-11-04');
});

test('V31 opt-out never reads or persists local growth; consent revocation erases past learning',()=>{
 const s=storage();clock.value=Date.parse('2026-11-05T08:00:00Z');
 const m=fresh(s);m.record({family:'inspect',success:true});
 assert.equal(s.map.has(M_GROWTH_STORAGE_KEY),true);
 m.setRemember(false);
 assert.equal(s.map.has(M_GROWTH_STORAGE_KEY),false);
 assert.equal(m.record({family:'ball',success:true}),false);
 assert.equal(m.snapshot().completed,0);
 assert.equal(fresh(s,false).snapshot().completed,0);
 assert.equal(s.map.has(M_GROWTH_STORAGE_KEY),false);
 m.setRemember(true);
 assert.equal(m.snapshot().completed,0);
});

test('V31 reset clears adaptive outcomes without deleting unrelated portfolio data',()=>{
 const s=storage([['unrelated','retain']]);const m=fresh(s);
 m.record({family:'orbit',success:true});m.reset();
 assert.equal(m.snapshot().completed,0);assert.deepEqual(m.snapshot().recent,[]);
 assert.equal(s.map.get('unrelated'),'retain');
});

test('V31 ignores corrupt or futuristic growth records without mutating private text',()=>{
 const s=storage([[M_GROWTH_STORAGE_KEY,'{"version":99,"private":"do not overwrite"}']]);
 const growth=fresh(s);
 assert.equal(growth.snapshot().completed,0);
 assert.ok(s.map.get(M_GROWTH_STORAGE_KEY).includes('do not overwrite'));
 const bad=storage([[M_GROWTH_STORAGE_KEY,'{"version":1,"message":"private"}']]);
 const instance=fresh(bad);assert.equal(instance.snapshot().completed,0);
 assert.ok(!bad.map.get(M_GROWTH_STORAGE_KEY).includes('message'));
});

test('V31 safe decision labels never include DOM, prompts or visitor identities',()=>{
 assert.equal(growthFamilyForDecision({kind:'scene',action:'inspect',targetId:'private-name'}),'inspect');
 assert.equal(growthFamilyForDecision({characterGoal:'follow-light',play:'light'}),'goal-light');
 assert.equal(growthFamilyForDecision({kind:'rest',gesture:'sleep'}),'sleep');
 assert.equal(growthFamilyForDecision({kind:'self-play',play:'ball'}),'ball');
 assert.equal(growthFamilyForDecision({kind:'scene',action:'unknown'}),null);
 assert.equal(growthFamilyForDecision({kind:'expression',reason:'quiet-observe'}),'observe');
 assert.equal(growthFamilyForDecision({kind:'expression',gesture:'hop'}),'hop');
});

test('V31 a visitor gets different unscripted opening styles rather than an enforced first gesture',()=>{
 const families=new Set(),gestures=new Set(),actions=new Set();
 for(const opening of ['explore','play','observe'])for(let i=0;i<60;i++){
  const ai=createAutonomy({seed:(i+13)*9193});
  const choice=ai.choose(facts(i,opening));
  assert.ok(choice,'unrestricted visitor receives local activity');
  families.add(choice.reason);gestures.add(choice.gesture);actions.add(choice.action);
  if(choice.kind==='scene'){
   assert.ok(createScenePlan({targetId:choice.targetId,action:choice.action,gesture:choice.gesture,
    expression:choice.expression,source:'life',actions:['inspect','peek','perch','orbit']}));
  }
 }
 assert.ok(families.size>=5,'varied opening intentions');
 assert.ok(gestures.size>=5,'varied original-rig gestures');
 assert.ok(actions.size>=4,'more than a fixed first action');
});

test('V31 learned preferences cannot override motion, visitor typing or hidden page',()=>{
 const habits={weights:Object.fromEntries(GROWTH_FAMILIES.map(f=>[f,1.2])),opening:'play'};
 for(const context of [{active:false},{active:true,reducedMotion:true},{active:true,typing:true},{active:true,hidden:true}]){
  const ai=createAutonomy({seed:814});
  assert.equal(ai.choose({...facts(1,'play'),context,habits}),null);
 }
});

test('V31 page runtime connects new personality only to success acknowledgments and respects Remember switch',()=>{
 const src=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/seed:18421|seed:18425/);
 assert.match(src,/const livingSeed=makeLivingSeed\(\)/);
 assert.match(src,/createGrowthMemory\(\{remember:character.snapshot\(\).remember\}\)/);
 assert.match(src,/if\(acknowledged&&typeof growth!=='undefined'&&typeof growthFamilyForDecision==='function'\)/);
 assert.match(src,/growth\.setRemember\(value\)/);
 assert.match(src,/growth\.reset\(\)/);
 assert.match(src,/habits:typeof growth==='undefined'\?undefined:\{\.\.\.growth.preferences\(\),opening\}/);
});
