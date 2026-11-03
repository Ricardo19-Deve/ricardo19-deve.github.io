import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,characterReceiptId,M_CHARACTER_STORAGE_KEY as KEY,M_CHARACTER_BACKUP_KEY as BACKUP,M_CHARACTER_REMEMBER_KEY as REMEMBER,M_CHARACTER_JOURNAL_LIMIT,M_CHARACTER_RECEIPT_LIMIT} from './m-world-character.mjs';
import {validateCharacterContext} from './m-world-character-context.mjs';
function store(initial=[]){const data=new Map(initial);return {data,reads:0,getItem(key){this.reads++;return data.get(key)??null;},setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
function receipt(character,execution,goal,success=true,extra={}){return {id:characterReceiptId(character.snapshot().visitId,execution),goal,success,...extra};}
function light(character,id='light'){return character.record(receipt(character,id,'follow-light'));}
function lookout(character,id='lookout',componentId='project-epoxy',publicComponent='project-epoxy'){return character.record(receipt(character,id,'find-lookout',true,{componentId,publicComponent}));}
function complete(character){assert.equal(light(character),true);assert.equal(lookout(character),true);}

test('a fresh character has an authored bounded context and no invented experiences',()=>{
 const storage=store(),character=createCharacter({storage,now:()=>1000}),s=character.snapshot();
 assert.equal(validateCharacterContext(character.getContext()),true);
 assert.equal(s.beat,'seeking');assert.equal(s.goal,'follow-light');assert.equal(s.discovery,'none');
 assert.equal(s.preference,'small-lights');assert.equal(s.recall,'first-visit');assert.equal(s.visits,1);assert.equal(s.visitId,1);
 assert.deepEqual(s.journal,[]);assert.equal(s.favorite,null);assert.equal(s.remember,true);assert.equal(s.storageAvailable,true);
 assert.equal(storage.data.size,1);assert.equal(JSON.parse(storage.data.get(KEY)).version,1);
});

test('only a successful light receipt discovers the light; failure cannot later become success',()=>{
 const character=createCharacter({storage:store(),now:()=>1000}),failed=receipt(character,'failed','follow-light',false);
 assert.equal(character.record(failed),false);assert.equal(character.record({...failed,success:true}),false);
 assert.equal(character.snapshot().beat,'seeking');assert.deepEqual(character.snapshot().journal,[]);
 assert.equal(light(character),true);assert.equal(light(character),false);
 assert.equal(character.snapshot().beat,'returning');assert.equal(character.getContext().goal,'find-lookout');
 assert.equal(character.snapshot().journal[0].id,'light-found');assert.equal(character.snapshot().discovery,'little-light');
 assert.equal(validateCharacterContext(character.getContext()),true);
});

test('finding a real lookout establishes a stable preference and coherent journal',()=>{
 const character=createCharacter({storage:store(),now:()=>1000});complete(character);
 const s=character.snapshot();assert.equal(s.beat,'complete');assert.equal(s.goal,'explore');
 assert.equal(s.preference,'quiet-lookouts');assert.equal(s.favoriteComponent,'project-epoxy');
 assert.deepEqual(s.favorite,{stableId:'project-epoxy',publicId:'project-epoxy'});
 assert.deepEqual(s.journal.map(x=>x.id),['light-found','lookout-found']);
 assert.equal(validateCharacterContext(character.getContext()),true);
 assert.equal(lookout(character),false);assert.equal(s.journal.length,2);
});

test('closing and reopening resumes an unfinished chapter without inventing progress',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000});light(first);
 const resumed=createCharacter({storage,now:()=>2000});
 assert.equal(resumed.snapshot().visits,2);assert.equal(resumed.snapshot().visitId,2);
 assert.equal(resumed.snapshot().recall,'returning');assert.equal(resumed.snapshot().beat,'returning');
 assert.equal(resumed.snapshot().journal.length,1);assert.equal(resumed.snapshot().goal,'find-lookout');
 assert.equal(lookout(resumed),true);assert.equal(resumed.snapshot().goal,'explore');
});

test('a later visit remembers the lookout and requires a real matching revisit exactly once',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000});complete(first);
 const returned=createCharacter({storage,now:()=>2000}),s=returned.snapshot();
 assert.equal(s.beat,'complete');assert.equal(s.goal,'revisit-lookout');assert.equal(s.recall,'returning');assert.equal(s.journal.length,2);
 assert.equal(validateCharacterContext(returned.getContext()),true);
 const base=receipt(returned,'revisit','revisit-lookout',true,{componentId:'project-other',publicComponent:null});
 assert.equal(returned.record(base),false);
 assert.equal(returned.record({...base,componentId:'project-epoxy',publicComponent:'project-epoxy'}),true);
 assert.equal(returned.snapshot().goal,'explore');assert.equal(returned.snapshot().journal.length,3);
 assert.equal(returned.record({...base,componentId:'project-epoxy',publicComponent:'project-epoxy'}),false);
});

test('stale visit receipts cannot complete a later revisit even when old receipts were evicted',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000});
 for(let i=0;i<M_CHARACTER_RECEIPT_LIMIT+5;i++)first.record(receipt(first,'failed-'+i,'follow-light',false));
 complete(first);const returned=createCharacter({storage,now:()=>2000});
 assert.equal(returned.record({id:characterReceiptId(1,'stale'),'goal':'revisit-lookout',success:true,componentId:'project-epoxy',publicComponent:'project-epoxy'}),false);
 assert.equal(returned.snapshot().goal,'revisit-lookout');assert.equal(returned.snapshot().journal.length,2);
 assert.ok(JSON.parse(storage.data.get(KEY)).receipts.length<=M_CHARACTER_RECEIPT_LIMIT);
});

test('invalid, private, expanded and out-of-order receipts cannot change the story',()=>{
 const character=createCharacter({storage:store(),now:()=>1000}),base=receipt(character,'valid','follow-light');
 for(const invalid of [null,[],{}, {...base,goal:'navigate'}, {...base,success:1}, {...base,id:'PRIVATE message'}, {...base,id:'visit-2:wrong-visit'}, {...base,message:'PRIVATE'}, {...base,componentId:'https://private.invalid'}, {...base,publicComponent:'unknown-project'},receipt(character,'early','find-lookout',true,{componentId:'project-epoxy'})]){
  assert.equal(character.record(invalid),false);
 }
 assert.equal(character.snapshot().beat,'seeking');assert.deepEqual(character.snapshot().journal,[]);
});

test('the story and journal stay bounded over many genuine returns',()=>{
 const storage=store();let character=createCharacter({storage,now:()=>1000});complete(character);
 for(let i=2;i<=30;i++){
  character=createCharacter({storage,now:()=>i*1000});
  assert.equal(character.record(receipt(character,'revisit','revisit-lookout',true,{componentId:'project-epoxy',publicComponent:'project-epoxy'})),true);
 }
 const s=character.snapshot(),saved=JSON.parse(storage.data.get(KEY));
 assert.equal(s.visits,30);assert.equal(s.journal.length,M_CHARACTER_JOURNAL_LIMIT);
 assert.deepEqual(s.journal.slice(0,2).map(x=>x.id),['light-found','lookout-found']);
 assert.ok(s.journal.slice(2).every(x=>x.id==='lookout-revisited'));assert.ok(saved.receipts.length<=M_CHARACTER_RECEIPT_LIMIT);
 assert.ok(storage.data.get(KEY).length<16_384);assert.equal(validateCharacterContext(character.getContext()),true);
});

test('snapshot/context reads are detached and do not repeatedly touch synchronous storage',()=>{
 const storage=store(),character=createCharacter({storage,now:()=>1000});complete(character);const before=storage.reads;
 const s=character.snapshot();s.journal[0].id='lookout-revisited';s.favorite.stableId='elsewhere';
 const c=character.getContext();c.favoriteComponent='project-other';
 for(let i=0;i<100;i++){character.snapshot();character.getContext();}
 assert.equal(storage.reads,before);assert.equal(character.snapshot().journal[0].id,'light-found');
 assert.equal(character.snapshot().favorite.stableId,'project-epoxy');assert.equal(character.getContext().favoriteComponent,'project-epoxy');
});

test('backward, invalid or throwing clocks cannot create invalid timestamps',()=>{
 let at=5000;const character=createCharacter({storage:store(),now:()=>{if(at==='throw')throw new Error('clock');return at;}});
 light(character);at=-100;lookout(character);assert.ok(character.snapshot().journal.every(x=>x.atMs===5000));
 for(const value of [NaN,Infinity,'throw']){at=value;assert.doesNotThrow(()=>character.reset());}
});

test('opting out erases only M story data, preserves local play and survives reopening',()=>{
 const quota='m-world-director-session-v1',chat='other-chat-key',storage=store([[quota,'KEEP'],[chat,'KEEP CHAT']]);
 const character=createCharacter({storage,now:()=>1000});light(character);
 assert.equal(character.setRemember(false),true);assert.equal(character.snapshot().remember,false);assert.equal(character.snapshot().storageAvailable,false);
 assert.equal(storage.data.has(KEY),false);assert.equal(storage.data.has(BACKUP),false);assert.equal(storage.data.get(REMEMBER),'false');
 assert.equal(storage.data.get(quota),'KEEP');assert.equal(storage.data.get(chat),'KEEP CHAT');
 assert.equal(lookout(character),true);assert.equal(character.snapshot().beat,'complete');assert.equal(storage.data.has(KEY),false);
 const reopened=createCharacter({storage,now:()=>2000});assert.equal(reopened.snapshot().remember,false);assert.equal(reopened.snapshot().beat,'seeking');
});

test('opting back in saves the current RAM experience without requiring another adventure',()=>{
 const storage=store(),character=createCharacter({storage,now:()=>1000});character.setRemember(false);complete(character);
 assert.equal(character.setRemember(true),true);assert.equal(character.snapshot().storageAvailable,true);
 const returned=createCharacter({storage,now:()=>2000});assert.equal(returned.snapshot().beat,'complete');assert.equal(returned.snapshot().goal,'revisit-lookout');
});

test('reset clears current story and backup while preserving preference, quota and incarnation',()=>{
 const quota='m-world-director-session-v1',storage=store([[quota,'KEEP']]),character=createCharacter({storage,now:()=>1000});
 complete(character);assert.ok(storage.data.has(BACKUP));const visitId=character.snapshot().visitId;
 character.reset();assert.equal(character.snapshot().beat,'seeking');assert.deepEqual(character.snapshot().journal,[]);assert.equal(character.snapshot().favorite,null);
 assert.equal(character.snapshot().visitId,visitId);assert.equal(storage.data.has(BACKUP),false);assert.equal(storage.data.get(quota),'KEEP');
 character.setRemember(false);character.reset();assert.equal(character.snapshot().remember,false);assert.equal(storage.data.has(KEY),false);
});

test('unavailable storage never disables genuine in-memory progression',()=>{
 const storage={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');},removeItem(){throw new Error('denied');}};
 const character=createCharacter({storage,now:()=>1000});assert.equal(character.snapshot().storageAvailable,false);complete(character);
 assert.equal(character.snapshot().beat,'complete');assert.doesNotThrow(()=>character.setRemember(false));assert.doesNotThrow(()=>character.reset());
});

test('silent write loss is detected rather than reporting durable success',()=>{
 const storage=store();storage.setItem=()=>{};const character=createCharacter({storage,now:()=>1000});complete(character);
 assert.equal(character.snapshot().storageAvailable,false);assert.equal(character.snapshot().beat,'complete');assert.equal(storage.data.has(KEY),false);
});

test('a failed primary write leaves a valid previous save and RAM state usable',()=>{
 const storage=store(),character=createCharacter({storage,now:()=>1000}),set=storage.setItem;
 storage.setItem=(key,value)=>{if(key===KEY)throw new Error('disk full');return set(key,value);};
 assert.equal(light(character),true);assert.equal(character.snapshot().beat,'returning');assert.equal(character.snapshot().storageAvailable,false);
 assert.equal(JSON.parse(storage.data.get(KEY)).beat,'seeking');assert.equal(JSON.parse(storage.data.get(BACKUP)).beat,'seeking');
 storage.setItem=set;assert.equal(lookout(character),true);assert.equal(character.snapshot().storageAvailable,true);
});

test('a corrupted primary recovers only a validated last-good snapshot',()=>{
 const storage=store(),character=createCharacter({storage,now:()=>1000});complete(character);
 assert.equal(JSON.parse(storage.data.get(BACKUP)).beat,'returning');storage.data.set(KEY,'{');
 const recovered=createCharacter({storage,now:()=>2000});assert.equal(recovered.snapshot().beat,'returning');assert.equal(recovered.snapshot().journal.length,1);
 assert.equal(recovered.snapshot().storageAvailable,true);assert.equal(JSON.parse(storage.data.get(KEY)).beat,'returning');
});

test('unknown future-version saves are preserved and do not get overwritten by an older client',()=>{
 const future=JSON.stringify({version:2,unknown:'future data'}),storage=store([[KEY,future]]),character=createCharacter({storage,now:()=>1000});
 assert.equal(character.snapshot().storageAvailable,false);assert.equal(storage.data.get(KEY),future);assert.equal(light(character),true);
 assert.equal(storage.data.get(KEY),future);assert.equal(character.snapshot().beat,'returning');
 character.reset();assert.equal(JSON.parse(storage.data.get(KEY)).version,1);assert.equal(character.snapshot().beat,'seeking');
});

test('a future backup also prevents an older client from destroying it',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000});light(first);
 const future=JSON.stringify({version:9,newFeature:true});storage.data.set(BACKUP,future);
 const character=createCharacter({storage,now:()=>2000});assert.equal(character.snapshot().beat,'returning');assert.equal(character.snapshot().storageAvailable,false);
 assert.equal(storage.data.get(BACKUP),future);assert.equal(lookout(character),true);assert.equal(storage.data.get(BACKUP),future);
});

test('corrupt, expanded, oversized and incompatible prior schemas fall back without copying private fields',()=>{
 const sampleStorage=store();createCharacter({storage:sampleStorage,now:()=>1000});const sample=JSON.parse(sampleStorage.data.get(KEY));
 for(const raw of ['{','x'.repeat(20_000),JSON.stringify({...sample,version:0}),JSON.stringify({...sample,message:'PRIVATE'}),JSON.stringify({...sample,visits:Infinity}),JSON.stringify({...sample,beat:'complete'})]){
  const storage=store([[KEY,raw],[BACKUP,'PRIVATE']]),character=createCharacter({storage,now:()=>2000});
  assert.equal(character.snapshot().beat,'seeking');assert.equal(character.snapshot().storageAvailable,true);
  assert.ok(![...storage.data.values()].some(value=>value.includes('PRIVATE')));
 }
});

test('an unavailable public catalogue entry does not erase its stable discovery',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000});complete(first);
 const data=JSON.parse(storage.data.get(KEY));data.favorite.publicId='project-removed';data.journal[1].publicComponent='project-removed';storage.data.set(KEY,JSON.stringify(data));
 const returned=createCharacter({storage,now:()=>2000});assert.equal(returned.snapshot().beat,'complete');assert.equal(returned.snapshot().favorite.stableId,'project-epoxy');
 assert.equal(returned.snapshot().favoriteComponent,null);assert.equal(returned.snapshot().goal,'revisit-lookout');assert.equal(validateCharacterContext(returned.getContext()),true);
});

test('a newer device snapshot is adopted at completion so a second tab cannot replay a chapter beat',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000}),second=createCharacter({storage,now:()=>2000});
 assert.equal(light(first),true);assert.equal(light(second),false);assert.equal(second.snapshot().beat,'returning');
 assert.equal(lookout(second),true);assert.equal(first.record(receipt(first,'late','follow-light')),false);
 assert.equal(first.snapshot().beat,'complete');assert.equal(first.snapshot().visits,2);assert.equal(first.snapshot().visitId,1);
 assert.deepEqual(first.snapshot().journal.map(x=>x.id),['light-found','lookout-found']);
});

test('another tab opting out prevents an older tab from recreating stored history',()=>{
 const storage=store(),first=createCharacter({storage,now:()=>1000}),second=createCharacter({storage,now:()=>2000});
 second.setRemember(false);assert.equal(light(first),true);assert.equal(first.snapshot().remember,false);assert.equal(storage.data.has(KEY),false);
});

test('receipt IDs are bounded opaque execution identifiers rather than user text',()=>{
 for(const visit of [0,-1,NaN,Infinity,1.5,1_000_000_001])assert.equal(characterReceiptId(visit,'autonomy-1'),null);
 for(const id of [null,'','a'.repeat(65),'visitor message','https://invalid','<script>'])assert.equal(characterReceiptId(1,id),null);
 assert.equal(characterReceiptId(2,'autonomy-12'),'visit-2:autonomy-12');
});
