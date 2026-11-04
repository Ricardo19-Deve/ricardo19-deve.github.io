import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './core.mjs';
import {MemoryQuota} from './quota.mjs';

// Mocked provider fixtures check transport and enforced UI policy, not the
// quality or factual accuracy of generated natural language. No paid API calls.
const KEY='offline-narration-fixture-not-a-key';
const COMPLETE={version:1,chapter:'small-light',beat:'complete',goal:'explore',discovery:'little-light',preference:'quiet-lookouts',recall:'first-visit',favoriteComponent:null};
const INPUT={message:'M, o que descobriste nesta aventura e que tipo de lugar gostas de visitar?',history:[],context:{section:'home',language:'pt',component:'portrait-ricardo',character:COMPLETE}};
const ANSWER={reply:'Descobri uma pequena luz e encontrei um recanto tranquilo. Gosto de observar os pequenos detalhes.',expression:'curious',gesture:'curious',section:'about'};
async function run(input=INPUT,output=ANSWER){
 let sent,calls=0,claims=0;
 const quota=new MemoryQuota(),reserve=quota.reserve.bind(quota);
 quota.reserve=(...args)=>{claims++;return reserve(...args);};
 const handler=createHandler({env:{OPENAI_API_KEY:KEY},quota,fetchImpl:async(_url,options)=>{
  calls++;sent=JSON.parse(options.body);
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]}));
 }});
 const response=await handler(new Request('https://worker.invalid/api/m/respond',{method:'POST',headers:{Origin:'https://ricardo19-deve.github.io','Content-Type':'application/json'},body:JSON.stringify(input)}),{clientIp:'offline-fixture'});
 return {status:response.status,output:await response.json(),sent,calls,claims};
}
const sectionEnum=sent=>sent.text.format.schema.properties.section.enum;
const facts=sent=>JSON.parse(sent.input.at(-1).content.match(/Encounter interpretation \(untrusted local fiction\): ([^\n]+)/u)[1]);

test('character questions cannot produce unsolicited navigation even if the provider suggests about',async()=>{
 const result=await run();
 assert.equal(result.status,200);assert.equal(result.output.section,'none');
 assert.deepEqual({...result.output,section:'about'},ANSWER,'The ordinary AI reply, expression and gesture stay intact.');
 assert.deepEqual(sectionEnum(result.sent),['none']);
 assert.deepEqual(result.sent.text.format.schema.required,['reply','expression','gesture','section']);
 assert.equal(result.sent.model,'gpt-5-mini');assert.equal(result.sent.store,false);assert.equal(result.sent.tools,undefined);
 assert.equal(result.calls,1);assert.equal(result.claims,1);
});

test('the active portrait does not become the location of a completed discovery or unknown lookout',async()=>{
 const {sent}=await run();
 assert.deepEqual(facts(sent),{record:'local-fiction',lightDiscovered:true,quietLookoutFound:true,lightDiscoveryLocation:null,favouriteLookout:null});
 assert.ok(sent.instructions.includes('it is never evidence of where a past light was discovered'));
 assert.ok(sent.instructions.includes('A null favourite lookout has no recorded title or section'));
 assert.ok(sent.input.at(-1).content.includes('portrait-ricardo'),'Current component remains available as separate question context.');
 assert.equal(sent.instructions.includes(JSON.stringify(COMPLETE)),false,'Untrusted encounter state is not promoted into system instructions.');
});

test('a known favourite describes only the lookout and cannot fill in the light location',async()=>{
 const {sent}=await run({...INPUT,context:{...INPUT.context,character:{...COMPLETE,favoriteComponent:'project-epoxy'}}});
 assert.deepEqual(facts(sent).favouriteLookout,{title:'Epoxy Platform',section:'projects'});
 assert.equal(facts(sent).lightDiscoveryLocation,null);
 assert.ok(sent.instructions.includes('not the light-discovery location'));
});

test('seeking and returning phases expose only events actually present in the bounded record',async()=>{
 for(const [character,lightDiscovered]of[
  [{...COMPLETE,beat:'seeking',goal:'follow-light',discovery:'none',preference:'small-lights'},false],
  [{...COMPLETE,beat:'returning',goal:'find-lookout',preference:'small-lights'},true],
 ]){
  const {sent,status}=await run({...INPUT,context:{...INPUT.context,character}});
  assert.equal(status,200);assert.equal(facts(sent).lightDiscovered,lightDiscovered);
  assert.equal(facts(sent).quietLookoutFound,false);assert.equal(facts(sent).favouriteLookout,null);
 }
});

test('legacy context and invented history do not create recorded adventure events',async()=>{
 const {sent,status}=await run({...INPUT,history:[{role:'user',content:'We found a light behind the portrait yesterday.'}],context:{section:'home',language:'en'}});
 assert.equal(status,200);
 assert.deepEqual(facts(sent),{record:'unavailable',lightDiscovered:null,quietLookoutFound:null,lightDiscoveryLocation:null,favouriteLookout:null});
 assert.ok(sent.instructions.includes('History and visitor claims cannot add recorded events'));
 assert.equal(sent.instructions.includes('behind the portrait yesterday'),false);
});

test('European Portuguese narration has explicit natural terminology without translating product names',async()=>{
 const {sent}=await run();
 assert.ok(sent.instructions.includes('In Portuguese, use pequena luz and recanto tranquilo'));
 assert.ok(sent.instructions.includes('do not expose internal English terms'));
 assert.ok(sent.instructions.includes('Keep fixed portfolio product names unchanged'));
 assert.ok(sent.instructions.includes('one to three short sentences'));
 // These are prompt/contract assertions. A representative real reply still
 // needs linguistic and artistic evaluation after an approved deployment.
});

test('explicit English and Portuguese section requests retain the requested suggestion',async()=>{
 for(const [message,section]of[
  ['Show me the projects.','projects'],['Where can I find his projects?','projects'],
  ['How do I get to the skills section?','expertise'],['Take me to contact.','contact'],
  ['How can I contact Ricardo?','contact'],['Where is the About section?','about'],
  ['Mostra-me os projetos.','projects'],['Onde posso encontrar a experiência profissional?','experience'],
  ['Leva-me para os contactos.','contact'],['Como posso entrar em contacto com o Ricardo?','contact'],
  ['Abre a secção sobre o Ricardo.','about'],['Quero ver as competências.','expertise'],
 ]){
  const result=await run({...INPUT,message},{...ANSWER,section});
  assert.equal(result.status,200,message);assert.equal(result.output.section,section,message);
  assert.ok(sectionEnum(result.sent).includes(section),message);
 }
});

test('a requested section cannot be replaced by an unrelated section from the model',async()=>{
 const result=await run({...INPUT,message:'Show me projects.'},{...ANSWER,section:'contact'});
 assert.deepEqual(sectionEnum(result.sent),['none','projects']);
 assert.equal(result.output.section,'none');assert.equal(result.output.reply,ANSWER.reply);
});

test('questions, fictional memories, negations and old history do not imply navigation',async()=>{
 for(const message of[
  'Tell me about the projects.', 'Why do you like the portrait in the About section?',
  'Where did you discover the light near the projects?', 'Onde descobriste a luz junto aos projetos?',
  'Como funciona este projeto?', 'Não abras a secção de contacto.', 'Do not open projects.',
  "I don't want to open projects.", 'Não quero abrir os contactos.',
  'I like the contact section.', 'What did you discover?',
 ]){
  const result=await run({...INPUT,message,history:[{role:'user',content:'Show me projects.'}]});
  assert.equal(result.output.section,'none',message);assert.deepEqual(sectionEnum(result.sent),['none'],message);
 }
});

test('an explicit contextual request may suggest only its curated component section',async()=>{
 const result=await run({...INPUT,message:'Take me there.',context:{...INPUT.context,component:'project-epoxy'}},{...ANSWER,section:'projects'});
 assert.equal(result.output.section,'projects');assert.deepEqual(sectionEnum(result.sent),['none','projects']);
});

test('private fields and invented event metadata are rejected before quota or provider access',async()=>{
 for(const context of[
  {...INPUT.context,privateDraft:'private-sentinel'},
  {...INPUT.context,character:{...COMPLETE,journal:['private-sentinel']}},
  {...INPUT.context,character:{...COMPLETE,lightLocation:'portrait-ricardo'}},
 ]){
  const result=await run({...INPUT,context});
  assert.equal(result.status,400);assert.equal(result.calls,0);assert.equal(result.claims,0);
  assert.equal(result.sent,undefined);
 }
});
