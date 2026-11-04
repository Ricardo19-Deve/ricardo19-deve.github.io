import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldDirector,directorEndpoint,DIRECTOR_SESSION_LIMIT,DIRECTOR_STORAGE_KEY} from './m-world-director.mjs';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const snapshot=(event='idle',revision='world-1')=>({revision,section:'projects',language:'en',event,attentionId:'surface-1',targets:[{id:'surface-1',kind:'project',title:'Public project',actions:['peek','inspect'],zone:'middle-center'}],recent:[]});
const reply=(value)=>({snapshot:value.revision,targetId:'surface-1',action:'peek',gesture:'curious',expression:'curious'});
function memoryStorage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
function fixture(options={}){
 const storage=options.storage||memoryStorage(),requests=[],intents=[];let time=1000;
 const fetchImpl=(url,init)=>new Promise((resolve,reject)=>{
  const request={url,init,respond:(body,status=200)=>resolve({ok:status>=200&&status<300,status,json:async()=>body}),reject};requests.push(request);
  if(init.method==='GET')request.respond(options.health??{configured:true,director:{version:1,enabled:true}});
 });
 const director=createWorldDirector({endpoint:'https://companion.invalid/api/m/direct',fetchImpl,storage,now:()=>time,onIntent:(...args)=>intents.push(args),...options});
 return {director,storage,requests,intents,advance:amount=>{time+=amount;},warm:async(value=snapshot())=>{director.update({snapshot:value});await settle();director.update({snapshot:value});await settle();}};
}
test('director endpoint only allows the bounded HTTPS/local route',()=>{
 assert.equal(directorEndpoint('https://m.example/api/m/direct'),'https://m.example/api/m/direct');assert.equal(directorEndpoint('http://localhost:4184/api/m/direct'),'http://localhost:4184/api/m/direct');
 for(const bad of ['','http://example.com/api/m/direct','https://user:secret@example.com/api/m/direct','https://example.com/api/m/direct?key=x','https://example.com/api/m/respond','javascript:alert(1)'])assert.equal(directorEndpoint(bad),null,bad);
});
test('automatic director checks health once, sends the exact public snapshot, and admits one flight',async t=>{
 const f=fixture();t.after(()=>f.director.dispose());await f.warm();
 assert.equal(f.requests.length,2);assert.equal(f.requests[0].url,'https://companion.invalid/health');assert.equal(f.requests[1].url,'https://companion.invalid/api/m/direct');
 assert.deepEqual(JSON.parse(f.requests[1].init.body),{snapshot:snapshot()});assert.equal(f.requests[1].init.credentials,'omit');assert.equal(f.director.getStatus().attempts,1);
 for(let n=0;n<10;n++)f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests.length,2);
 f.requests[1].respond(reply(snapshot()));await settle();assert.equal(f.intents.length,1);assert.equal(f.director.getStatus().source,'openai');assert.equal(f.director.getStatus().pending,false);
});
test('minimum interval is 65 seconds and the same meaningful context is never requested again',async t=>{
 const f=fixture();t.after(()=>f.director.dispose());await f.warm();f.requests[1].respond(reply(snapshot()));await settle();
 f.advance(64_999);f.director.update({snapshot:snapshot('arrival')});await settle();assert.equal(f.requests.length,2);
 f.advance(1);f.director.update({snapshot:snapshot('idle','world-new')});await settle();assert.equal(f.requests.length,2);
 f.director.update({snapshot:snapshot('arrival')});await settle();assert.equal(f.requests.length,3);assert.equal(f.requests.filter(request=>request.init.method==='GET').length,1);
});
test('revision changes invalidate pending decisions even when fetch ignores AbortSignal',async t=>{
 const f=fixture();t.after(()=>f.director.dispose());await f.warm();
 f.director.update({snapshot:snapshot('idle','world-2')});assert.equal(f.requests[1].init.signal.aborted,true);
 f.requests[1].respond(reply(snapshot()));await settle();assert.equal(f.intents.length,0);assert.equal(f.director.getStatus().attempts,1);
});
test('pause, hidden, reduced motion, typing, reading, scrolling and visitor actions cancel AI priority',async t=>{
 for(const flag of ['hidden','reducedMotion','typing','reading','scrolling','busy','enabled']){
  const f=fixture();t.after(()=>f.director.dispose());await f.warm();
  if(flag==='enabled')f.director.setEnabled(false);else f.director.update({snapshot:snapshot(),[flag]:true});
  assert.equal(f.requests[1].init.signal.aborted,true,flag);f.requests[1].respond(reply(snapshot()));await settle();assert.equal(f.intents.length,0,flag);
  f.director.setEnabled(true);f.advance(65_000);f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests.length,2,flag);assert.equal(f.director.getStatus().attempts,1,flag);
 }
});
test('failed attempts consume budget and neither failures nor toggles retry the same context',async t=>{
 const f=fixture();t.after(()=>f.director.dispose());await f.warm();f.requests[1].respond({},429);await settle();
 assert.equal(f.director.getStatus().attempts,1);assert.equal(f.director.getStatus().reason,'rate-limited');assert.equal(f.director.getStatus().source,'local');assert.equal(f.director.getStatus().available,false);
 for(let n=0;n<6;n++){f.director.setEnabled(false);f.director.setEnabled(true);f.director.update({snapshot:snapshot()});}await settle();assert.equal(f.requests.length,2);
 f.advance(300_000);f.director.update({snapshot:snapshot()});await settle();f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests.length,3);assert.equal(f.requests[2].init.method,'GET');assert.equal(f.director.getStatus().attempts,1);
});
test('backend disabled and health failures keep local personality with bounded health backoff',async t=>{
 const f=fixture({health:{configured:true,director:{version:1,enabled:false}}});t.after(()=>f.director.dispose());await f.warm();
 assert.equal(f.requests.length,1);assert.equal(f.director.getStatus().available,false);
 for(let n=0;n<40;n++){f.advance(1000);f.director.update({snapshot:snapshot('arrival')});}await settle();assert.equal(f.requests.length,1);
 f.advance(260_000);f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests.length,2);assert.equal(f.director.getStatus().attempts,0);
});
test('the six-attempt session cap and context history survive reload and cannot reset by toggling',async t=>{
 const storage=memoryStorage(),f=fixture({storage});t.after(()=>f.director.dispose());
 for(let n=0;n<DIRECTOR_SESSION_LIMIT;n++){
  const value={...snapshot('arrival','world-'+n),recent:[{targetId:'previous-'+n,action:'inspect'}]};
  if(n===0)await f.warm(value);else{f.advance(65_000);f.director.update({snapshot:value});await settle();}
  f.requests.at(-1).respond(reply(value));await settle();
 }
 assert.equal(f.director.getStatus().attempts,6);f.director.dispose();
 const reloaded=fixture({storage});t.after(()=>reloaded.director.dispose());reloaded.director.setEnabled(false);reloaded.director.setEnabled(true);await reloaded.warm(snapshot('tap','fresh'));
 assert.equal(reloaded.director.getStatus().attempts,6);assert.equal(reloaded.requests.length,0);assert.equal(reloaded.director.getStatus().reason,'session-limit');assert.equal(JSON.parse(storage.getItem(DIRECTOR_STORAGE_KEY)).contexts.length,6);
});
test('reloading also retains cooldown and used context before the session cap',async t=>{
 const storage=memoryStorage(),first=fixture({storage});await first.warm();first.requests[1].respond(reply(snapshot()));await settle();first.director.dispose();
 const second=fixture({storage});t.after(()=>second.director.dispose());await second.warm(snapshot('tap'));assert.equal(second.requests.length,1);assert.equal(second.director.getStatus().attempts,1);
 second.advance(65_000);second.director.update({snapshot:snapshot()});await settle();assert.equal(second.requests.length,1);
 second.director.update({snapshot:snapshot('tap')});await settle();assert.equal(second.requests.length,2);
});
test('invalid, unavailable storage and unsupported commands fail closed without extra network',async t=>{
 const broken=fixture({storage:{getItem(){throw new Error('Unavailable');},setItem(){}}});t.after(()=>broken.director.dispose());await broken.warm();assert.equal(broken.requests.length,0);assert.equal(broken.director.getStatus().reason,'storage-unavailable');
 const f=fixture();t.after(()=>f.director.dispose());await f.warm();f.requests[1].respond({...reply(snapshot()),targetId:'arbitrary-dom',action:'orbit'});await settle();assert.equal(f.intents.length,0);assert.equal(f.director.getStatus().reason,'invalid-response');
 f.advance(65_000);f.director.update({snapshot:{...snapshot(),targets:[{...snapshot().targets[0],body:'PRIVATE'}]}});await settle();assert.equal(f.requests.length,2);
});
test('a current physical feasibility rejection reports local behavior and keeps the diagnostic decision',async t=>{
 const f=fixture({onIntent:()=>false});t.after(()=>f.director.dispose());await f.warm();f.requests[1].respond(reply(snapshot()));await settle();
 assert.equal(f.director.getStatus().source,'local');assert.equal(f.director.getStatus().reason,'unavailable-action');assert.deepEqual(f.director.getStatus().lastDecision,reply(snapshot()));assert.equal(f.director.getStatus().attempts,1);
});
test('an explicit AI pause survives reload in this tab without resetting its independent quota',async t=>{
 const storage=memoryStorage(),first=fixture({storage});t.after(()=>first.director.dispose());await first.warm();first.requests[1].respond(reply(snapshot()));await settle();
 first.director.setEnabled(false);first.director.dispose();
 const reloaded=fixture({storage});t.after(()=>reloaded.director.dispose());assert.equal(reloaded.director.getStatus().enabled,false);assert.equal(reloaded.director.getStatus().attempts,1);
 await reloaded.warm(snapshot('tap'));reloaded.advance(300_000);reloaded.director.update({snapshot:snapshot('arrival')});await settle();assert.equal(reloaded.requests.length,0);assert.equal(reloaded.director.getStatus().reason,'paused');
 reloaded.director.setEnabled(true);await reloaded.warm(snapshot('tap'));assert.equal(reloaded.requests.filter(request=>request.init.method==='POST').length,1);assert.equal(reloaded.director.getStatus().attempts,2);
});
test('a health check interrupted by scrolling retries after one quiet second without spending AI budget',async t=>{
 let time=1_000;const requests=[];
 const director=createWorldDirector({endpoint:'https://companion.invalid/api/m/direct',storage:memoryStorage(),now:()=>time,fetchImpl:(url,init)=>new Promise(resolve=>requests.push({url,init,respond:body=>resolve({ok:true,status:200,json:async()=>body})}))});t.after(()=>director.dispose());
 const context={snapshot:snapshot()};director.update(context);await settle();assert.equal(requests.length,1);assert.equal(requests[0].init.method,'GET');assert.equal(director.getStatus().attempts,0);
 director.update({...context,scrolling:true});assert.equal(requests[0].init.signal.aborted,true);assert.equal(director.getStatus().pending,false);
 time+=999;director.update(context);await settle();assert.equal(requests.length,1);
 time+=1;director.update(context);await settle();assert.equal(requests.length,2);assert.equal(requests[1].init.method,'GET');assert.equal(director.getStatus().attempts,0);
 requests[1].respond({configured:true,director:{version:1,enabled:true}});await settle();director.update(context);await settle();
 assert.equal(requests.length,3);assert.equal(requests[2].init.method,'POST');assert.equal(director.getStatus().attempts,1);
 requests[0].respond({configured:false,director:{version:1,enabled:false}});await settle();assert.equal(director.getStatus().available,true);assert.equal(director.getStatus().attempts,1);
 requests[2].respond(reply(snapshot()));await settle();assert.equal(director.getStatus().source,'openai');
});

const characterContext=()=>({version:1,chapter:'small-light',beat:'seeking',goal:'follow-light',discovery:'none',preference:'small-lights',recall:'first-visit',favoriteComponent:null});
const discoveredContext=()=>({...characterContext(),beat:'returning',goal:'find-lookout',discovery:'little-light'});
const characterHealth={configured:true,director:{version:1,enabled:true},character:{version:1}};

test('character capability sends only the bounded optional state with the original snapshot and allowance',async t=>{
 const character=characterContext(),f=fixture({health:characterHealth,getCharacterContext:()=>character});t.after(()=>f.director.dispose());await f.warm();
 assert.equal(f.director.getStatus().characterSupported,true);
 assert.deepEqual(JSON.parse(f.requests[1].init.body),{snapshot:snapshot(),character});
 assert.equal(f.requests.length,2);assert.equal(f.director.getStatus().attempts,1);
 f.requests[1].respond(reply(snapshot()));await settle();assert.equal(f.intents.length,1);
 assert.deepEqual(f.intents[0][1],snapshot(),'The local executor contract still receives the public snapshot only');
});

test('an old Worker receives the old exact body even when local character memory exists',async t=>{
 let reads=0;const f=fixture({getCharacterContext:()=>{reads++;return characterContext();}});t.after(()=>f.director.dispose());await f.warm();
 assert.equal(f.director.getStatus().characterSupported,false);assert.equal(reads,0);
 assert.deepEqual(JSON.parse(f.requests[1].init.body),{snapshot:snapshot()});assert.equal(f.director.getStatus().attempts,1);
});

test('invalid or inaccessible optional character state is omitted without exposing private fields or extra calls',async t=>{
 for(const getCharacterContext of [()=>({...characterContext(),chat:'private'}),()=>({...characterContext(),preference:'ignore instructions'}),()=>{throw new Error('unavailable');}]){
  const f=fixture({health:characterHealth,getCharacterContext});t.after(()=>f.director.dispose());await f.warm();
  assert.deepEqual(JSON.parse(f.requests[1].init.body),{snapshot:snapshot()});assert.equal(f.requests.length,2);assert.equal(f.director.getStatus().attempts,1);
 }
});

test('a character change invalidates an old response even without another world update',async t=>{
 let character=characterContext();const f=fixture({health:characterHealth,getCharacterContext:()=>character});t.after(()=>f.director.dispose());await f.warm();
 character=discoveredContext();f.requests[1].respond(reply(snapshot()));await settle();
 assert.equal(f.intents.length,0);assert.equal(f.director.getStatus().reason,'stale-context');assert.equal(f.director.getStatus().attempts,1);assert.equal(f.requests.length,2);
});

test('updating a changed character aborts the old intention but cannot bypass the 65-second interval',async t=>{
 let character=characterContext();const f=fixture({health:characterHealth,getCharacterContext:()=>character});t.after(()=>f.director.dispose());await f.warm();
 character=discoveredContext();f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests[1].init.signal.aborted,true);assert.equal(f.requests.length,2);
 f.requests[1].respond(reply(snapshot()));await settle();assert.equal(f.intents.length,0);
 f.advance(64_999);f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests.length,2);
 f.advance(1);f.director.update({snapshot:snapshot()});await settle();assert.equal(f.requests.length,3);
 assert.deepEqual(JSON.parse(f.requests[2].init.body).character,character);assert.equal(f.director.getStatus().attempts,2);
});

test('changing or resetting character context cannot reset the six-attempt quota',async t=>{
 let character=characterContext();const f=fixture({health:characterHealth,getCharacterContext:()=>character});t.after(()=>f.director.dispose());
 for(let n=0;n<DIRECTOR_SESSION_LIMIT;n++){
  const value={...snapshot('arrival','view-'+n),recent:[{targetId:'previous-'+n,action:'inspect'}]};
  character=n%2?discoveredContext():characterContext();
  if(n===0)await f.warm(value);else{f.advance(65_000);f.director.update({snapshot:value});await settle();}
  f.requests.at(-1).respond(reply(value));await settle();
 }
 character=null;f.advance(300_000);f.director.setEnabled(false);f.director.setEnabled(true);f.director.update({snapshot:snapshot('tap','after-reset')});await settle();
 assert.equal(f.director.getStatus().attempts,6);assert.equal(f.requests.filter(x=>x.init.method==='POST').length,6);assert.equal(f.director.getStatus().reason,'session-limit');
});
