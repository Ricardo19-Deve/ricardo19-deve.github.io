import {cloneCharacterContext} from './m-world-character-context.mjs?v=37';
/** Public, stable component IDs shared by the page and contextual chat. */
const records=[
 ['portrait-ricardo','Ricardo Pinheiro portrait','portrait','home'],
 ['project-salesforce-mobile','Salesforce Mobile Platform','project','projects'],
 ['project-revmend','RevMend','project','projects'],
 ['project-epoxy','Epoxy Platform','project','projects'],
 ['project-buzz','BUZZ Math Challenge','project','projects'],
 ['project-magnet-bloom','Magnet Bloom','project','projects'],
 ['project-stackout','STACKOUT - Math Blocks','project','projects'],
 ['project-wordpour','WordPour','project','projects'],
 ['project-potion-mix','Potion Mix','project','projects'],
 ['experience-systems-lead','Business Systems Lead Analyst','experience','experience'],
 ['experience-systems-engineer','CRM & Systems Software Engineer','experience','experience'],
 ['experience-salesforce','Salesforce Developer','experience','experience'],
 ['experience-oracle','Oracle APEX Consultant','experience','experience'],
 ['experience-independent','Independent Software Projects','experience','experience'],
 ['projects-architecture','From idea to architecture.','project','projects'],
 ['expertise-salesforce','Salesforce','expertise','expertise'],
 ['expertise-integrations','Integrations','expertise','expertise'],
 ['expertise-software','Software','expertise','expertise'],
 ['expertise-cloud-ai','Cloud & AI','expertise','expertise'],
 ['about-systems','Think in systems.','about','about'],
 ['about-products','Build things that ship.','about','about'],
 ['about-experience','Make it feel effortless.','about','about']
];
export const M_CONTEXT_COMPONENTS=Object.freeze(records.map(([id,title,kind,section])=>Object.freeze({id,title,kind,section})));
export const getContextComponent=id=>M_CONTEXT_COMPONENTS.find(item=>item.id===id)||null;
const key=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').toLowerCase().replace(/[^a-z0-9]+/gu,' ').trim();
export function matchContextComponent({title,kind}={}){
 const label=key(title);
 return M_CONTEXT_COMPONENTS.find(item=>(!kind||item.kind===kind)&&key(item.title)===label)||null;
}
export function contextualChatRequest(context,capability=false,characterCapability=false){
 const safe={section:context?.section||'home',language:context?.language==='pt'?'pt':'en'};
 if(capability&&getContextComponent(context?.component))safe.component=context.component;
 const character=characterCapability?cloneCharacterContext(context?.character):null;
 if(character)safe.character=character;
 return safe;
}
