/**
 * The visitor's newest question determines M's reply language. Browser
 * locale / portfolio language only applies to genuinely ambiguous messages.
 *
 * Small, deterministic cues avoid a third-party language detection service
 * and never transmit visitor text outside the existing chat request.
 */
const lexicons={
 pt:{
  strong:['qual','quais','ultimo','ultima','conta','podes','pode','queres','quero','consegues','consegue','tens','tenho','estou','gostava','obrigado','obrigada','portugues','publicacao','publicacoes','projeto','projetos','esse','essa','isto','diz','explica','explicar','falaste','tambem','entao','porque','pelo','pelos','sobre','fala','faz','fazer','foram','utilizadas','utilizados','usadas','usados','tecnologias','ferramentas','funcionalidades','criou','construiu','funciona','como','quando','onde','quem','meu','minha','teu','tua','mais','nao','sim','este','esta','foi','sabes','preciso','ajudar','apresentou'],
  short:['o','a','e','os','as','do','da','dos','das','um','uma','no','na','nos','nas','em','ao','aos','me','de','que','se','por','com']
 },
 en:{
  strong:['what','which','who','when','where','why','how','tell','could','would','should','please','about','more','technologies','frameworks','tools','built','using','implemented','created','worked','this','that','these','those','your','you','my','their','latest','last','project','projects','portfolio','posted','published','explain','explore','share','shared','hello','thanks','thank','describe','show','can','does','did','were','was','have','has','with','work','working','another','before','after','english'],
  short:['the','is','are','of','an','a','and','to','for','from','it','in','on','me','we','do','or','be']
 },
 es:{
  strong:['cual','cuales','cuando','donde','como','puedes','podrias','quiero','queria','cuentame','explicame','publicacion','publicaciones','proyecto','proyectos','ultimo','ultima','sobre','este','esta','ese','esa','gracias','hola','espanol','tienes','tengo','necesito','dime','hablame','mas','quien','porque','tambien','ahora','hacer','estoy'],
  short:['el','los','las','del','una','un','y','por','con','que','me','de','en','lo']
 },
 fr:{
  strong:['pourquoi','quel','quelle','quels','quelles','quand','comment','pouvez','pourrais','raconte','parle','parlez','projet','projets','publication','publications','dernier','derniere','merci','bonjour','francais','encore','votre','expliquer','savoir','connais','avec','plus','sur','est','vous','moi'],
  short:['le','la','les','des','du','de','une','un','et','ce','cette','dans','pour','je','tu','il','elle']
 }
};
const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').toLowerCase().replace(/[’']/gu,"'");
function scores(value){
 const tokens=normalize(value).match(/\p{L}+/gu)||[];
 const result={pt:0,en:0,es:0,fr:0};
 for(const lang of Object.keys(result)){
  const strong=new Set(lexicons[lang].strong),weak=new Set(lexicons[lang].short);
  for(const t of tokens){if(strong.has(t))result[lang]+=3;else if(weak.has(t))result[lang]++;}
 }
 // Distinctive PT enclitics and accented question words disambiguate short
 // questions even when surrounded by English product or company names.
 if(/\b(?:conta|diz|explica|fala)-me\b/iu.test(normalize(value)))result.pt+=5;
 if(/^\s*e\s+o\s+/iu.test(normalize(value)))result.pt+=5;
 if(/^\s*and\s+the\s+/iu.test(normalize(value)))result.en+=5;
 if(/[¿¡]/u.test(value))result.es+=4;
 if(/\b(?:qu'est|s'il|c'est)\b/iu.test(String(value)))result.fr+=5;
 return result;
}
function strongLanguage(value){
 const ranking=Object.entries(scores(value)).sort((a,b)=>b[1]-a[1]);
 return ranking[0][1]>=3&&ranking[0][1]>=ranking[1][1]+2?ranking[0][0]:null;
}
export function questionLanguage(message,history=[],fallback='en'){
 const chosen=strongLanguage(message);
 if(chosen)return chosen;
 if(Array.isArray(history)){
  for(const row of [...history].reverse()){
   if(row?.role!=='user')continue;
   const previous=strongLanguage(row.content);
   if(previous)return previous;
  }
 }
 return ['pt','en','es','fr'].includes(fallback)?fallback:'en';
}
export function languageInstruction(lang){
 return ({
  pt:'European Portuguese (Portugal, PT-PT). Use natural Portuguese vocabulary and grammar, not English. Keep product names, source quotes and approved post URLs unchanged.',
  en:'English. Use natural English vocabulary and grammar, not Portuguese. Keep product names, source quotes and approved post URLs unchanged.',
  es:'Spanish. Use natural Spanish vocabulary and grammar, not English or Portuguese. Keep product names, source quotes and approved post URLs unchanged.',
  fr:'French. Use natural French vocabulary and grammar, not English or Portuguese. Keep product names, source quotes and approved post URLs unchanged.'
 })[lang]||'English';
}
export function replyInDifferentLanguage(reply,expected){
 // Never translate a URL-only answer, short technical term, quoted proper
 // name or opaque reply. Only clearly wrong-language prose triggers repair.
 const withoutUrls=String(reply||'').replace(/https?:\/\/\S+/giu,' ');
 const count=(withoutUrls.match(/\p{L}+/gu)||[]).length;
 if(count<3)return false;
 const votes=scores(withoutUrls),target=votes[expected]||0;
 const winner=Object.entries(votes).filter(([name])=>name!==expected).sort((a,b)=>b[1]-a[1])[0];
 return Boolean(winner&&winner[1]>=5&&winner[1]>=target+4);
}
export function languageFallback(lang){
 switch(lang){
  case 'pt':return 'Desculpa, não consegui formular essa resposta em português. Podes repetir a pergunta?';
  case 'es':return 'Lo siento, no he conseguido formular esa respuesta en español. ¿Puedes repetir la pregunta?';
  case 'fr':return "Désolée, je n'ai pas réussi à formuler cette réponse en français. Peux-tu répéter ta question ?";
  default:return 'Sorry, I could not prepare that answer in English. Could you repeat your question?';
 }
}
