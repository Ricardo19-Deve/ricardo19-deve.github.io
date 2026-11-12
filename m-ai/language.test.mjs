import test from 'node:test';
import assert from 'node:assert/strict';
import {questionLanguage,replyInDifferentLanguage,languageInstruction,languageFallback} from './language.mjs';
import {createHandler,API_URL} from './core.mjs';

const answer=(reply)=>({reply,expression:'neutral',gesture:'none',section:'none'});
const completed=(value)=>new Response(JSON.stringify({
 status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]
}),{headers:{'content-type':'application/json'}});
const input=(message,{language='en',history=[]}={})=>({message,history,context:{section:'home',language}});
async function ask(value,replies){
 const seen=[],queue=[...replies];
 const worker=createHandler({
  env:{OPENAI_API_KEY:'test-secret-openai-token',OPENAI_MODEL:'gpt-5-mini'},
  quota:{ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}},
  fetchImpl:async(url,options)=>{
   if(url!==API_URL)throw Error('Unexpected URL: '+url);
   seen.push(JSON.parse(options.body));
   return completed(answer(queue.shift()??''));
  }
 });
 const res=await worker(new Request('https://m.local/api/m/respond',{
  method:'POST',headers:{'content-type':'application/json',origin:'https://ricardo19-deve.github.io'},
  body:JSON.stringify(value)
 }));
 return {status:res.status,reply:await res.json(),seen};
}

test('V63 the newest question overrides English website locale and prior English answers',()=>{
 assert.equal(questionLanguage('Conta-me mais sobre esse projeto.',[], 'en'),'pt');
 assert.equal(questionLanguage('Qual foi a última publicação do Ricardo no LinkedIn?',[], 'en'),'pt');
 assert.equal(questionLanguage('Tell me more about this project.',[], 'pt'),'en');
 assert.equal(questionLanguage('¿Puedes contarme más sobre este proyecto?',[], 'en'),'es');
 assert.equal(questionLanguage('Parlez-moi de ce projet, s’il vous plaît.',[], 'en'),'fr');
 assert.equal(questionLanguage('E o link?',[
  {role:'user',content:'Qual foi o último post no LinkedIn?'},
  {role:'assistant',content:'The owner presented M in a new post.'}
 ],'en'),'pt');
 assert.equal(questionLanguage('And the link?',[], 'pt'),'en');
 assert.equal(questionLanguage('Salesforce',[], 'pt'),'pt','ambiguous brand name uses site locale');
});

test('Portuguese posso disambiguates a Contact question from an English locale and history',()=>{
 const question='Como posso contactar o Ricardo pela secção Contact?';
 assert.equal(questionLanguage(question,[],'en'),'pt');
 assert.equal(questionLanguage(question,[{role:'user',content:'Tell me about Ricardo.'}],'en'),'pt');
 assert.equal(questionLanguage('How can I contact Ricardo?',[],'pt'),'en');
 assert.equal(questionLanguage('¿Cómo puedo contactar con Ricardo?',[],'en'),'es');
 assert.equal(questionLanguage('Comment contacter Ricardo ?',[],'en'),'fr');
});
test('V63 detects a wrong-language long answer without treating tech names as English prose',()=>{
 const english='Ricardo presented me as an experimental 3D character for his portfolio, a guided interface with AI integration to help visitors explore projects and context.';
 assert.equal(replyInDifferentLanguage(english,'pt'),true);
 assert.equal(replyInDifferentLanguage('O Ricardo apresentou-me como uma personagem 3D com IA. O projeto combina Blender e desenvolvimento web.','pt'),false);
 assert.equal(replyInDifferentLanguage('Ricardo built this interactive portfolio to explain his projects and show his work.','en'),false);
 assert.equal(replyInDifferentLanguage('https://www.linkedin.com/feed/update/urn:li:activity:7523386814880047107/','pt'),false);
 assert.match(languageInstruction('pt'),/European Portuguese/);
 assert.match(languageFallback('pt'),/Desculpa/);
});
test('V63 Portuguese follow-up on English-locale page gets strict PT-PT and one safe rewrite when necessary',async()=>{
 const english='Ricardo presented me as an experimental 3D character for his portfolio, combining animation and artificial intelligence to guide visitors.';
 const portuguese='O Ricardo apresentou-me como uma personagem 3D do seu portefólio, combinando animação e inteligência artificial para ajudar quem visita a página.';
 const {status,reply,seen}=await ask(input('Conta-me mais sobre esse projeto.',{
  language:'en',
  history:[{role:'user',content:'What was the last LinkedIn post?'},{role:'assistant',content:'It was about M.'}]
 }),[english,portuguese]);
 assert.equal(status,200);
 assert.equal(reply.reply,portuguese);
 assert.equal(seen.length,2);
 assert.match(seen[0].instructions,/STRICT ANSWER LANGUAGE: European Portuguese/);
 assert.match(seen[0].input.at(-1).content,/"language":"pt"/);
 assert.match(seen[1].instructions,/Rewrite ONLY the reply/);
 assert.equal(seen[1].store,false);
 assert.doesNotMatch(seen[1].input[0].content,/test-secret-openai-token/);
});
test('V63 an English question on a Portuguese-locale page stays English without needless retry',async()=>{
 const english="Ricardo built this 3D portfolio experiment to explain his projects and share his work. It's still evolving.";
 const {status,reply,seen}=await ask(input('Tell me about this project.',{language:'pt'}),[english]);
 assert.equal(status,200);assert.equal(reply.reply,english);assert.equal(seen.length,1);
 assert.match(seen[0].instructions,/STRICT ANSWER LANGUAGE: English/);
 assert.match(seen[0].input.at(-1).content,/"language":"en"/);
});
test('V63 unsuccessful rewrite fails closed in the requested language rather than showing English',async()=>{
 const english='Ricardo presented the website as his main portfolio, displaying technical work and personal projects in a guided interface.';
 const {status,reply,seen}=await ask(input('Fala-me do portefólio do Ricardo.',{language:'en'}),[english,english]);
 assert.equal(status,200);
 assert.match(reply.reply,/^Desculpa,/);
 assert.equal(reply.section,'none');
 assert.equal(seen.length,2);
});
