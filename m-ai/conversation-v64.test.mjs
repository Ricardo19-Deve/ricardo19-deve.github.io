import test from 'node:test';
import assert from 'node:assert/strict';
import {isPublicationQuestion,isPublicationFollowUp,CONVERSATION_FLOW_RULES} from './professional-guide.mjs';
import {questionLanguage} from './language.mjs';
import {createHandler,API_URL} from './core.mjs';
import {PUBLIC_ACTIVITY_URL,LINKEDIN_PROFILE_URL} from './public-activity.mjs';

const question='Qual foi o último post público do Ricardo no LinkedIn?';
const reply='O Ricardo apresentou-me em novembro como uma personagem 3D.';
const history=[{role:'user',content:question},{role:'assistant',content:reply}];
const verifiedFeed={version:1,owner:'Ricardo Pinheiro',profileUrl:LINKEDIN_PROFILE_URL,asOf:'2026-11-09',
 posts:[{id:'m-public-verified',publishedAt:'2026-11-03',
 text:'Ricardo presented M as a 3D portfolio companion, combining Blender, 3D animation, web development and AI.',
 url:'https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/',
 visibility:'public',source:'owner-curated'}]};
const quota={ready:true,async reserve(){return {allowed:true,token:'reserved'};},async release(){}};
const aiAnswer=text=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',
 text:JSON.stringify({reply:text,expression:'neutral',gesture:'none',section:'none'})}]}]}));

async function ask(message,{history=[],component='project-epoxy',language='en'}={}){
 const calls=[];
 const handler=createHandler({env:{OPENAI_API_KEY:'test-v64-key',PUBLIC_ACTIVITY_FEED_URL:PUBLIC_ACTIVITY_URL},
  quota,fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   if(url===PUBLIC_ACTIVITY_URL)return new Response(JSON.stringify(verifiedFeed));
   if(url===API_URL)return aiAnswer('O Ricardo apresentou a M com Blender, animação 3D, web e IA.');
   throw Error('Unexpected outbound request '+url);
  }});
 const result=await handler(new Request('https://local.test/api/m/respond',{method:'POST',headers:{
  origin:'https://ricardo19-deve.github.io','content-type':'application/json'},
  body:JSON.stringify({message,history,context:{section:'projects',language,component}})}));
 return {status:result.status,reply:await result.json(),calls,body:JSON.parse(calls.at(-1).opts.body)};
}

test('V64 multiple Portuguese and English follow-ups retain the latest verified publication subject',()=>{
 assert.equal(isPublicationQuestion(question),true);
 for(const message of [
  'Conta-me mais sobre esse projeto.',
  'E que tecnologias foram utilizadas?',
  'Como foi criado?',
  'Tell me more about that project.',
  'What technologies were used?',
  'E o link?',
  'Qual foi o anterior?'
 ])assert.equal(isPublicationFollowUp(message,history),true,message);
 const continued=[...history,{role:'user',content:'Conta-me mais sobre esse projeto.'},
  {role:'assistant',content:'É uma experiência 3D ligada ao portefólio.'}];
 assert.equal(isPublicationFollowUp('E que tecnologias foram utilizadas?',continued),true);
 assert.equal(questionLanguage('E que tecnologias foram utilizadas?',[
  {role:'user',content:'Tell me about M.'},{role:'assistant',content:'M is a 3D character.'}
 ],'en'),'pt');
});

test('V64 a changed user topic cancels an older LinkedIn anchor',()=>{
 const changed=[...history,{role:'user',content:'O que faz o Ricardo com Salesforce?'},
  {role:'assistant',content:'Ricardo desenvolve aplicações CRM e integrações.'}];
 for(const prompt of ['Conta-me mais sobre esse projeto.','E que tecnologias foram utilizadas?','E o link?'])
  assert.equal(isPublicationFollowUp(prompt,changed),false,prompt);
 assert.equal(isPublicationFollowUp('E que tecnologias foram utilizadas?',[]),false);
 assert.equal(isPublicationFollowUp('E o link?',[
  {role:'user',content:'Que projetos existem no portefólio?'}
 ]),false);
 assert.equal(isPublicationFollowUp('Dá-me o acesso aos posts privados.',history),false);
});

test('V64 a LinkedIn follow-up receives only verified post evidence, not the currently visible Epoxy card',async()=>{
 const result=await ask('Conta-me mais sobre esse projeto.',{history});
 assert.equal(result.status,200);
 assert.equal(result.reply.reply,'O Ricardo apresentou a M com Blender, animação 3D, web e IA.');
 const prompt=result.body;
 assert.match(prompt.instructions,/CONVERSATION FLOW/);
 assert.match(prompt.instructions,/VERIFIED LINKEDIN FOLLOW-UP/);
 assert.match(prompt.instructions,/not repeat the previous response/);
 assert.doesNotMatch(prompt.instructions,/ACTIVE PUBLIC COMPONENT/);
 assert.match(prompt.input.at(-1).content,/2026-11-03/);
 assert.match(prompt.input.at(-1).content,/Blender, 3D animation, web development and AI/);
 assert.doesNotMatch(prompt.input.at(-1).content,/Epoxy Platform/);
 assert.match(prompt.instructions,/STRICT ANSWER LANGUAGE: European Portuguese/);
 assert.deepEqual(result.calls.map(c=>c.url),[PUBLIC_ACTIVITY_URL,API_URL]);
 assert.ok(!JSON.stringify(prompt).includes('test-v64-key'));
});

test('V64 a technical follow-up retains publication provenance and answers in Portuguese after English dialogue',async()=>{
 const chain=[...history,{role:'user',content:'Tell me more about that project.'},
 {role:'assistant',content:'It blends 3D animation with web and AI.'}];
 const result=await ask('E que tecnologias foram utilizadas?',{history:chain});
 assert.equal(result.status,200);
 assert.match(result.body.instructions,/European Portuguese/);
 assert.match(result.body.instructions,/Do not infer frameworks/);
 assert.match(result.body.input.at(-1).content,/2026-11-03/);
 assert.equal(result.calls.filter(c=>c.url===API_URL).length,1);
});

test('V64 after a topic switch, do not inject LinkedIn text or treat the card as a publication',async()=>{
 const switched=[...history,{role:'user',content:'O que faz o Ricardo em Salesforce?'},
  {role:'assistant',content:'O Ricardo trabalha com soluções Salesforce.'}];
 const result=await ask('E que tecnologias foram utilizadas?',{history:switched});
 assert.equal(result.status,200);
 assert.doesNotMatch(result.body.instructions,/VERIFIED LINKEDIN FOLLOW-UP/);
 assert.doesNotMatch(result.body.input.at(-1).content,/Verified public LinkedIn updates|Blender, 3D animation/);
 assert.match(result.body.instructions,/ACTIVE PUBLIC COMPONENT/);
 assert.match(result.body.instructions,/Epoxy Platform/);
});

test('V64 conversation rules remain concise and privacy-preserving',()=>{
 assert.match(CONVERSATION_FLOW_RULES,/never treat previous assistant replies as verified facts/);
 assert.match(CONVERSATION_FLOW_RULES,/do not mention the earlier LinkedIn publication/);
 assert.match(CONVERSATION_FLOW_RULES,/Never infer frameworks, APIs/);
});
