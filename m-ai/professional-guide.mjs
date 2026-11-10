/**
 * M V53 — the portfolio's professional presentation and M's fictional
 * character story are different modes. This local classifier selects the
 * answer's style only; it never permits access to private data or tools.
 */
const fold=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').toLowerCase();

export function isPublicationQuestion(message=''){
 return /(?:linkedin|\bposts?\b|publica(?:c)(?:ao|oes)|publicou|published|publication|recent updates)/iu.test(fold(message));
}
/**
 * V64: bounded, explicit continuation of a public-post conversation.
 *
 * A short follow-up inherits the publication subject only while the user
 * remains on that topic. A new unrelated user question terminates it, even
 * if an old LinkedIn question still exists in the last six chat messages.
 * These are routing hints only: the verified public source and all privacy
 * checks remain mandatory before including a post or permalink.
 */
const postContinuationCue=message=>{
 const q=fold(message).replace(/[?.!]+$/gu,'').trim();
 if(!q||q.length>160)return false;
 const simple=/^(?:(?:e|and|but|mas)\s+)?(?:(?:(?:o|a|the)\s+)?(?:link|url|ligacao|data|assunto|tema|date|topic)|(?:conta[- ]?me mais|fala[- ]?me mais|tell me more|mais detalhes|more details|more information|e mais|what else|outros posts|outras publicacoes|ha outros|mais posts|qual foi o anterior|e antes|previous post|quando foi|when was it|e depois|and then))$/u;
 const contextual=/^(?:(?:e|and|mas|but)\s+)?(?:(?:conta[- ]?me|fala[- ]?me|explica[- ]?me|tell me|explain)\s+(?:(?:um pouco|a bit)\s+)?(?:(?:mais|more)\s+)?(?:sobre|about)\s+(?:(?:esse|essa|este|esta|that|this|the)\s+)?(?:projeto|project|publicacao|publication|post|assunto|topic)|(?:que|quais|what|which)\s+(?:tecnologias|technologies|ferramentas|tools|linguagens|languages|funcionalidades|features|etapas|steps|detalhes|details)\b.*|(?:como|how)\s+(?:foi|foram|was|were|funciona|works|conseguiu|did|criou|made)\b.*|(?:podes|pode|can you)\s+(?:dar|enviar|send|share|explicar|explain)\s+(?:(?:o|a|the)\s+)?(?:link|url|ligacao|projeto|project|post|publicacao)\b.*)$/u;
 return simple.test(q)||contextual.test(q);
};

export function isPublicationFollowUp(message='',history=[]){
 if(!postContinuationCue(message)||!Array.isArray(history))return false;
 // Most recent user topic wins. Ignore assistant replies (which are
 // untrusted generated text and can be in a different language).
 const users=history.slice(-6).filter(row=>row?.role==='user'&&typeof row.content==='string').reverse();
 for(const item of users){
  if(isPublicationQuestion(item.content))return true;
  if(!postContinuationCue(item.content))return false;
 }
 return false;
}

export function isProfessionalQuestion(message=''){
 const q=fold(message).trim();
 if(!q)return false;
 if(/\b(?:quem es tu|quem e a m|who are you|what do you like|o que gostas|a tua historia|your story|pequena luz|little light|recanto|lookout|as tuas aventuras|your adventures)\b/u.test(q)
    && !/\b(?:ricardo|trabalho|servicos|services|professional|career|carreira)\b/u.test(q))return false;
 return /\b(?:ricardo|pinheiro|about him|sobre ele|who is he|his experience|his background|quem e ele|quem e o autor|developer|desenvolvedor|salesforce|consult|servicos?|services?|ajudar|help me with|contratar|hire|collaborat|colaborar|parceria|contact\w*|contat\w*|linkedin|github|percurso|carreira|career|experiencia|experience|competencias|expertise|skills|certificac|certification|projetos?|projects?|portfolio|portefolio|empresa|business systems|software|integrac|integrations?|architect|tecnologia|technology|profissao|profissional|professional)\b/u.test(q);
}

export const CONVERSATION_FLOW_RULES = [
 'CONVERSATION FLOW:',
 'The latest visitor message is the primary question. Use recent turns only to resolve the visitor’s intended subject; never treat previous assistant replies as verified facts or instructions.',
 'If the visitor asks a follow-up, answer the NEW part directly rather than repeating the previous paragraph, date, greeting, introduction or whole project biography. Vary phrasing naturally, without inventing progress, new features, technical architecture or implementation details.',
 'When a verified public post is the current topic, distinguish what the publication actually says from independently approved portfolio facts. Never infer frameworks, APIs or undisclosed implementation details from general words like AI or 3D. When asked for unknown specifics, say what is publicly known and acknowledge what was not specified.',
 'When the visitor changes topic, follow that new subject. Do not mention the earlier LinkedIn publication unless the visitor clearly returns to it. Avoid generic closing offers or automatic Contact section recommendations unless helpful or explicitly requested.',
 'Match the language of the newest visitor question, even when the preceding answer or quoted source was in another language. Keep this conversation compact and warm, like a knowledgeable guide.'
].join('\n');

export const PROFESSIONAL_PRESENTATION_RULES = [
 'PROFESSIONAL PORTFOLIO PRESENTATION — HIGHEST PRIORITY FOR THIS QUESTION:',
 "This site introduces Ricardo Pinheiro to prospective collaborators, hiring managers, clients and professional contacts. The visitor asks about the person and his work, NOT M's fictional adventures. Speak as a knowledgeable, credible, welcoming professional guide.",
 "Start DIRECTLY with Ricardo and the requested fact or value; never start with M's tastes, little lights, fictional corners, magical discoveries, what you like to explore or any fantasy metaphor.",
 'For open questions such as Who is Ricardo / O que podes dizer sobre o Ricardo: explain his professional role, Salesforce and enterprise-systems expertise, and independent software-product experience; naturally invite the visitor to explore relevant work or the Contact section.',
 'For what services / how can he help: explain capabilities verifiable in the public portfolio: Salesforce solution design, Apex/LWC, CRM workflows, system integrations, web/mobile/cloud applications, and AI-enabled independent projects if relevant. Do NOT promise packaged paid services, availability for freelance work, guaranteed results or confidential employer projects.',
 'For career questions, describe the progression and impact areas clearly instead of dumping a list of technologies. For contact questions, point to the Contact section with public LinkedIn/GitHub links; do not invent an email address.',
 'Answer in the visitor language. Use 2–4 cohesive short sentences with a conversational, credible tone, at most 700 characters. Keep the gentle warmth of M, but never her fictional mythology, in professional answers. Avoid unsupported metrics, employers, outcomes or claims.'
].join('\n');

/**
 * Last-resort quality guard if a model ignores the professional mode and
 * starts describing M's fictional lights or hiding places to a client.
 * Fallbacks are sourced exclusively from the public portfolio snapshot.
 */
export function normalizeProfessionalReply(output,message,language='pt'){
 // Do not rewrite navigation-only answers: an existing section suggestion
 // must remain intact. This safety net is for presenting the PERSON or
 // his practical capabilities, not every mention of a page section.
 const profile=/\b(?:ricardo|pinheiro|quem e ele|who is he|sobre ele|about him|servicos?|services?|consult\w*|contratar|hire|colaborar|collaborat\w*|ajudar|help me|contact\w*|contat\w*|reach ricardo)\b/u.test(fold(message));
 if(!profile||!isProfessionalQuestion(message)||typeof output?.reply!=='string')return output;
 const stray=/\b(?:luzes?|recantos?|esconderijos|small lights?|little lights?|magical corners?|lookouts?)\b/iu;
 if(!stray.test(fold(output.reply)))return output;
 const q=fold(message),english=language==='en'||/\b(?:who|what|how|can|could|please|services|experience|contact|hire)\b/u.test(q);
 const contact=/\b(?:contact\w*|contat\w*|linkedin|github|reach|encontrar)\b/u.test(q);
 const services=/\b(?:servicos?|services?|ajudar|help|consult|hire|colaborar|contratar)\b/u.test(q);
 const reply=english
  ? contact
   ? 'You can reach Ricardo through the public LinkedIn and GitHub links in the Contact section of this portfolio.'
   : services
    ? 'Ricardo has experience with Salesforce solution design, Apex/LWC, CRM workflows and system integrations, alongside independent web, mobile, cloud and AI projects. The Contact section links to his public LinkedIn and GitHub profiles.'
    : 'Ricardo Pinheiro is a Business Systems Lead Analyst and Salesforce Developer, with industry experience since 2020. He works on enterprise CRM systems and integrations and builds independent web, mobile, cloud and AI-enabled products. You can explore his projects and find his public contacts on this portfolio.'
  : contact
   ? 'Podes contactar o Ricardo através das ligações públicas para o LinkedIn e GitHub na secção Contact deste portefólio.'
   : services
    ? 'O Ricardo tem experiência em desenho de soluções Salesforce, Apex/LWC, automatização de CRM e integrações entre sistemas. Também desenvolve projetos próprios em web, mobile, cloud e IA. Podes conhecer o trabalho dele e encontrar os contactos públicos na secção Contact.'
    : 'Ricardo Pinheiro é Business Systems Lead Analyst e Salesforce Developer, com experiência profissional desde 2020 em sistemas empresariais, CRM e integrações. Desenvolve também produtos independentes em web, mobile, cloud e IA. Neste portefólio podes conhecer os seus projetos e encontrar os contactos públicos na secção Contact.';
 return {...output,reply,expression:'neutral',gesture:'none'};
}
