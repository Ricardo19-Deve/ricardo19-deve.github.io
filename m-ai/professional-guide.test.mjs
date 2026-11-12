import test from 'node:test';
import assert from 'node:assert/strict';
import {
 isProfessionalQuestion,isPublicationQuestion,isPublicationFollowUp,normalizeProfessionalReply,
 PROFESSIONAL_PRESENTATION_RULES
} from './professional-guide.mjs';
import {createHandler,API_URL} from './core.mjs';

test('V53 career, work, services and contact requests use professional mode instead of fictional M mode',()=>{
 for(const q of [
  'o que podes dizer sobre o ricardo','Quem é o Ricardo Pinheiro?',
  'Que serviços pode prestar?','Como posso entrar em contacto?',
  'What does Ricardo do?','Can he help with Salesforce integrations?',
  'Tell me about his professional experience','Que projetos desenvolveu?',
  'Gostaria de colaborar com o Ricardo'
 ])assert.equal(isProfessionalQuestion(q),true,q);
 for(const q of ['Quem és tu, M?','O que gostas de fazer?','Onde encontraste a pequena luz?',
  'What do you like in your world?','Dá-me um abraço'])assert.equal(isProfessionalQuestion(q),false,q);
 assert.equal(isPublicationQuestion('qual foi o último post no LinkedIn?'),true);
 assert.equal(isPublicationQuestion('o que podes dizer sobre o ricardo'),false);
 assert.match(PROFESSIONAL_PRESENTATION_RULES,/Start DIRECTLY with Ricardo/);
});

test('V53 accidental "I love chasing lights" lead is replaced by verified professional portfolio presentation',()=>{
 const noisy={reply:'Gosto de investigar as luzes dos perfis — aqui vai o essencial: Ricardo Pinheiro trabalha com Salesforce.',
  expression:'happy',gesture:'wave',section:'about'};
 const result=normalizeProfessionalReply(noisy,'o que podes dizer sobre o ricardo','pt');
 assert.match(result.reply,/^Ricardo Pinheiro é Business Systems Lead Analyst/);
 assert.match(result.reply,/Salesforce Developer/);
 assert.match(result.reply,/secção Contact/);
 assert.doesNotMatch(result.reply,/luzes|recantos|magia/i);
 assert.equal(result.gesture,'none');
 assert.equal(result.expression,'neutral');
 assert.equal(result.section,'about'); // explicit navigation policy is enforced later by core
 assert.ok(result.reply.length<=700);
});

test('V53 other professional requests use capability- and contact-specific fallbacks without promises',()=>{
 const fantasy={reply:'Pelas luzes do meu mundo...',expression:'curious',gesture:'shy',section:'none'};
 const services=normalizeProfessionalReply(fantasy,'Como me podes ajudar com Salesforce?','pt');
 assert.match(services.reply,/Apex\/LWC/);
 assert.match(services.reply,/integrações/);
 assert.doesNotMatch(services.reply,/disponível|contratação garantida/);
 const contact=normalizeProfessionalReply(fantasy,'Onde encontro o contacto do Ricardo?','pt');
 assert.match(contact.reply,/LinkedIn e GitHub/);
 assert.doesNotMatch(contact.reply,/@|https:|mail\.com/);
 const english=normalizeProfessionalReply(fantasy,'Who is Ricardo?','en');
 assert.match(english.reply,/^Ricardo Pinheiro is a Business Systems Lead Analyst/);
 const unrelated=normalizeProfessionalReply(fantasy,'Quem és tu, M?','pt');
 assert.deepEqual(unrelated,fantasy);
 const normal={reply:'Ricardo trabalha com Salesforce e integrações.',expression:'neutral',gesture:'none',section:'none'};
 assert.deepEqual(normalizeProfessionalReply(normal,'Que sabes sobre o Ricardo?','pt'),normal);
});

const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
const response=reply=>new Response(JSON.stringify({status:'completed',
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
  reply,expression:'curious',gesture:'none',section:'none'
 })}]}]}),{headers:{'content-type':'application/json'}});
const makeRequest=(message,language='pt')=>new Request('https://unit.test/api/m/respond',
 {method:'POST',headers:{origin:'https://ricardo19-deve.github.io','content-type':'application/json'},
  body:JSON.stringify({message,history:[],context:{section:'home',language}})});
async function query(message,answer='Ricardo trabalha em desenho de soluções Salesforce.',language='pt'){
 const calls=[];
 const handler=createHandler({env:{OPENAI_API_KEY:'mock-secret'},quota,
  fetchImpl:async(url,opts)=>{
   calls.push({url,opts});
   if(url===API_URL)return response(answer);
   throw Error('Unexpected outbound connection to '+url);
  }});
 const res=await handler(makeRequest(message,language));
 assert.equal(res.status,200);
 assert.equal(calls.length,1);
 return {result:await res.json(),prompt:JSON.parse(calls[0].opts.body)};
}

test('V53 professional question to Ask M excludes story encounter and LinkedIn absence from model prompt',async()=>{
 const {result,prompt}=await query('o que podes dizer sobre o ricardo');
 assert.equal(result.reply,'Ricardo trabalha em desenho de soluções Salesforce.');
 assert.match(prompt.instructions,/PROFESSIONAL PORTFOLIO PRESENTATION/);
 assert.match(prompt.instructions,/Business Systems Lead Analyst/);
 assert.match(prompt.instructions,/professionalStory/);
 assert.doesNotMatch(prompt.instructions,/AUTHORED CHARACTER IDENTITY/);
 assert.doesNotMatch(prompt.instructions,/ENCOUNTER NARRATION RULES/);
 assert.doesNotMatch(prompt.input.at(-1).content,/Encounter interpretation/);
 assert.doesNotMatch(prompt.input.at(-1).content,/No verified public LinkedIn posts/);
 assert.doesNotMatch(prompt.input.at(-1).content,/Public professional updates/);
 assert.equal(result.section,'none');
});

test('V53 real mocked OpenAI response with old "lights" opener is corrected BEFORE visitor sees it',async()=>{
 const {result}=await query('o que podes dizer sobre o ricardo',
  'Gosto de investigar as luzes dos perfis — aqui vai o essencial: Ricardo Pinheiro trabalha em Salesforce.');
 assert.match(result.reply,/^Ricardo Pinheiro é Business Systems Lead Analyst/);
 assert.doesNotMatch(result.reply,/luzes|recantos/i);
 assert.ok(result.reply.length<=700);
});

test('V53 M character questions still use authored story and ignore professional selling mode',async()=>{
 const {prompt}=await query('Quem és tu, M?','Sou a M e gosto de explorar os recantos da página.');
 assert.match(prompt.instructions,/AUTHORED CHARACTER IDENTITY/);
 assert.match(prompt.input.at(-1).content,/Encounter interpretation/);
 assert.doesNotMatch(prompt.instructions,/PROFESSIONAL PORTFOLIO PRESENTATION/);
});

test('V53 professional question about LinkedIn still receives only a verified public snapshot',async()=>{
 assert.equal(isProfessionalQuestion('Qual foi o último post do Ricardo no LinkedIn?'),true);
 assert.equal(isPublicationQuestion('Qual foi o último post do Ricardo no LinkedIn?'),true);
});

test('V59 M answers ordinary LinkedIn questions naturally while keeping provenance on demand',async()=>{
 const {prompt}=await query('Qual foi o último post do Ricardo no LinkedIn?');
 assert.match(prompt.instructions,/1–2 natural short sentences/);
 assert.match(prompt.instructions,/O Ricardo apresentou-me/);
 assert.match(prompt.instructions,/Mention the review\/capture date and technical limitations only if/);
 assert.match(prompt.instructions,/never imply LinkedIn processed a new post instantly/i);
 const general=await query('O que faz o Ricardo?');
 assert.match(general.prompt.instructions,/knowledgeable portfolio guide/);
 assert.match(general.prompt.instructions,/one or two short sentences/);
});

test('V60 contextual LinkedIn follow-ups require a preceding post question',()=>{
 const history=[{role:'user',content:'Qual foi o último post no LinkedIn?'},{role:'assistant',content:'O Ricardo apresentou a M em novembro.'}];
 for(const question of ['E o link?','Conta-me mais','Qual foi o anterior?','E a data?','Tell me more','Outros posts?'])
  assert.equal(isPublicationFollowUp(question,history),true,question);
 assert.equal(isPublicationFollowUp('E o link?',[]),false);
 assert.equal(isPublicationFollowUp('E o meu email pessoal?',history),false);
 assert.equal(isPublicationFollowUp('Dá-me o link de uma conta privada do LinkedIn',history),false);
 assert.equal(isPublicationFollowUp('O que faz Ricardo na Salesforce?',history),false);
});

test('professional fallback respects selected Portuguese when the question names the Contact section',()=>{
 const output={reply:'Gosto de seguir as luzes do meu mundo.',expression:'happy',gesture:'wave',section:'none'};
 const result=normalizeProfessionalReply(output,'Como posso contactar o Ricardo pela secção Contact?','pt');
 assert.equal(result.reply,'Podes contactar o Ricardo através das ligações públicas para o LinkedIn e GitHub na secção Contact deste portefólio.');
 assert.equal(result.expression,'neutral');
 assert.equal(result.gesture,'none');
 assert.equal(result.section,'none');
});

test('Portuguese Contact fallback avoids a second language-repair request from an English page context',async()=>{
 const {result,prompt}=await query('Como posso contactar o Ricardo pela secção Contact?',
  'Gosto de seguir as luzes do meu mundo.','en');
 assert.match(result.reply,/^Podes contactar o Ricardo/);
 assert.match(prompt.instructions,/STRICT ANSWER LANGUAGE: European Portuguese/);
 assert.equal(result.section,'none');
});

const localizedProfessionalCases=[
 {
  language:'es',fantasy:'Me gusta seguir pequeñas luces por los rincones mágicos de mi mundo.',
  cases:[
   ['¿Quién es Ricardo?',/^Ricardo Pinheiro es Business Systems Lead Analyst y Salesforce Developer/,/desde 2020/],
   ['¿Qué servicios puede prestar Ricardo?',/^Ricardo tiene experiencia en diseño de soluciones Salesforce/,/Apex\/LWC/],
   ['¿Cómo puedo contactar con Ricardo?',/^Puedes contactar con Ricardo/,/LinkedIn y GitHub/]
  ]
 },
 {
  language:'fr',fantasy:"J'aime suivre les petites lumières dans les coins magiques de mon monde.",
  cases:[
   ['Qui est Ricardo ?',/^Ricardo Pinheiro est Business Systems Lead Analyst et Salesforce Developer/,/depuis 2020/],
   ['Quels services propose Ricardo ?',/^Ricardo possède une expérience en conception de solutions Salesforce/,/Apex\/LWC/],
   ['Comment contacter Ricardo ?',/^Vous pouvez contacter Ricardo/,/LinkedIn et GitHub/]
  ]
 }
];

test('Spanish and French fantasy fallbacks retain verified professional facts in the selected language',()=>{
 for(const {language,fantasy,cases} of localizedProfessionalCases){
  for(const [message,start,fact] of cases){
   const output={reply:fantasy,expression:'curious',gesture:'shy',section:'none'};
   const result=normalizeProfessionalReply(output,message,language);
   assert.match(result.reply,start,message);
   assert.match(result.reply,fact,message);
   assert.equal(result.expression,'neutral');
   assert.equal(result.gesture,'none');
   assert.equal(result.section,'none');
   assert.ok(result.reply.length<=700);
   assert.doesNotMatch(result.reply,/@|https?:|garanti|garantiz|disponib|disponí|privad|privé|magique|mágic|lumière|luces/iu);
  }
 }
});

for(const {language,fantasy,cases} of localizedProfessionalCases){
 test(`${language} known professional fallbacks answer directly with one mocked provider call`,async()=>{
  for(const [message,start,fact] of cases){
   const {result,prompt}=await query(message,fantasy,'en');
   assert.match(result.reply,start,message);
   assert.match(result.reply,fact,message);
   assert.match(prompt.instructions,new RegExp('STRICT ANSWER LANGUAGE: '+(language==='es'?'Spanish':'French')));
   assert.equal(result.section,'none');
  }
 });
}

test('Spanish service requests without a name use professional routing and one localized fallback call',async()=>{
 const question='¿Qué servicios puede ofrecer?';
 const {result,prompt}=await query(question,'Me gusta seguir pequeñas luces por los rincones mágicos de mi mundo.','en');
 assert.equal(isProfessionalQuestion(question),true);
 assert.match(prompt.instructions,/PROFESSIONAL PORTFOLIO PRESENTATION/);
 assert.match(result.reply,/^Ricardo tiene experiencia en diseño de soluciones Salesforce/);
 assert.match(result.reply,/Apex\/LWC/);
 assert.equal(result.section,'none');
});

test('localized factual or unknown professional answers and unrelated character replies stay untouched',()=>{
 for(const [message,language,reply] of [
  ['Quels sont les projets privés de Ricardo ?','fr',"Je ne connais pas les détails de ses projets privés."],
  ['¿Cuál es el correo privado de Ricardo?','es','No conozco su correo privado.'],
  ['Quem és tu, M?','pt','Gosto de seguir as luzes do meu mundo.'],
  ['What does Ricardo do?','en','Ricardo works on enterprise CRM systems and integrations.']
 ]){
  const output={reply,expression:'neutral',gesture:'none',section:'none'};
  assert.equal(normalizeProfessionalReply(output,message,language),output);
 }
});
