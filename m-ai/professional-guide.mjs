/**
 * M V53 — the portfolio's professional presentation and M's fictional
 * character story are different modes. This local classifier selects the
 * answer's style only; it never permits access to private data or tools.
 */
const fold=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').toLowerCase();

export function isPublicationQuestion(message=''){
 return /(?:linkedin|\bposts?\b|publica(?:c)(?:ao|oes)|publicou|published|publication|recent updates)/iu.test(fold(message));
}
export function isProfessionalQuestion(message=''){
 const q=fold(message).trim();
 if(!q)return false;
 if(/\b(?:quem es tu|quem e a m|who are you|what do you like|o que gostas|a tua historia|your story|pequena luz|little light|recanto|lookout|as tuas aventuras|your adventures)\b/u.test(q)
    && !/\b(?:ricardo|trabalho|servicos|services|professional|career|carreira)\b/u.test(q))return false;
 return /\b(?:ricardo|pinheiro|about him|sobre ele|who is he|his experience|his background|quem e ele|quem e o autor|developer|desenvolvedor|salesforce|consult|servicos?|services?|ajudar|help me with|contratar|hire|collaborat|colaborar|parceria|contact|contat|linkedin|github|percurso|carreira|career|experiencia|experience|competencias|expertise|skills|certificac|certification|projetos?|projects?|portfolio|portefolio|empresa|business systems|software|integrac|integrations?|architect|tecnologia|technology|profissao|profissional|professional)\b/u.test(q);
}

export const PROFESSIONAL_PRESENTATION_RULES = [
 'PROFESSIONAL PORTFOLIO PRESENTATION — HIGHEST PRIORITY FOR THIS QUESTION:',
 "This site introduces Ricardo Pinheiro to prospective collaborators, hiring managers, clients and professional contacts. The visitor asks about the person and his work, NOT M's fictional adventures. Speak as a knowledgeable, credible, welcoming professional guide.",
 "Start DIRECTLY with Ricardo and the requested fact or value; never start with M's tastes, little lights, fictional corners, magical discoveries, what you like to explore or any fantasy metaphor.",
 'For open questions such as Who is Ricardo / O que podes dizer sobre o Ricardo: explain his professional role, Salesforce and enterprise-systems expertise, and independent software-product experience; naturally invite the visitor to explore relevant work or the Contact section.',
 'For what services / how can he help: explain capabilities verifiable in the public portfolio: Salesforce solution design, Apex/LWC, CRM workflows, system integrations, web/mobile/cloud applications, and AI-enabled independent projects if relevant. Do NOT promise packaged paid services, availability for freelance work, guaranteed results or confidential employer projects.',
 'For career questions, describe the progression and impact areas clearly instead of dumping a list of technologies. For contact questions, point to the Contact section with public LinkedIn/GitHub links; do not invent an email address.',
 'Answer in the visitor language. Use 2–4 cohesive short sentences with a conversational, credible tone, at most 700 characters. Keep the gentle warmth of M, but never her fictional mythology, in professional answers. Avoid unsupported metrics, employers, outcomes or claims.'
].join('\n');
