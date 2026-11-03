import {getContextComponent,contextualChatRequest} from './m-world-context.mjs?v=27';
/** Explicit chat, local gestures and automatic AI-play controls. No persistent chat storage. */
export const M_ASSISTANT_GESTURES=Object.freeze(['wave','curious','surprised','shy']);
export const M_LOCAL_GESTURES=Object.freeze([...M_ASSISTANT_GESTURES,'playful','wink','nod']);
const SECTIONS=['none','about','experience','projects','expertise','contact'];
export function assistantEndpoint(value,base='https://ricardo19-deve.github.io/'){
 if(!value)return null;
 try{
  const url=new URL(value,base),loopback=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!(loopback&&url.protocol==='http:'))||url.username||url.password||url.search||url.hash||url.pathname!=='/api/m/respond')return null;
  return url.href;
 }catch{return null;}
}
export function validateAssistantReply(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='expression,gesture,reply,section')return null;
 if(typeof value.reply!=='string'||!value.reply.trim()||value.reply.length>700||!['neutral','happy','curious','surprised'].includes(value.expression)||!['none',...M_ASSISTANT_GESTURES].includes(value.gesture)||!SECTIONS.includes(value.section))return null;
 return {reply:value.reply.trim(),expression:value.expression,gesture:value.gesture,section:value.section};
}
export function createMCompanion({document=globalThis.document,endpoint='',fetchImpl=globalThis.fetch,onGesture=()=>false,onExpression=()=>{},onSection=()=>{},onEngagement=()=>{},getMotionStatus=()=>({active:true,reducedMotion:false}),onEnableMotion=()=>false,getContext=()=>({section:'home',language:'en'}),getDirectorStatus=()=>({enabled:true,available:false,pending:false,attempts:0,limit:6,source:'local'}),onDirectorEnabled=()=>{},onAffect=()=>false,onScene=()=>false,onGame=()=>false,onContextResponse=()=>{},onResetMemory=()=>{}}={}){
 const target=assistantEndpoint(endpoint,document.location?.href),listeners=[];
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const button=(text,cls)=>{const el=make('button',cls,text);el.type='button';return el;};
 const toggle=button('Talk to M','m-companion-toggle');toggle.dataset.mOverlay='true';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','m-companion');
 const panel=make('section','m-companion');panel.id='m-companion';panel.dataset.mOverlay='true';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Talk to M');
 const header=make('div','m-companion-header'),title=make('h2','','Meet M'),close=button('Close','m-companion-close'),enableMotion=button('Enable M motion','m-companion-enable-motion');header.append(title,enableMotion,close);enableMotion.hidden=true;
 const intro=make('p','m-companion-intro',target?'A little curiosity, a little magic. Try a gesture or ask about this portfolio.':'A little curiosity, a little magic. Try one of M’s gestures.');
 const motionNote=make('p','m-companion-intro','Reduced motion is on. M stays still until you enable motion.');motionNote.hidden=true;
 const status=make('p','m-companion-status',target?'AI chat is ready.':'Local gestures are ready. AI chat is not connected yet.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const actions=make('div','m-companion-actions'),moreGestures=make('details','m-companion-more-gestures'),moreSummary=make('summary','','More gestures'),moreActions=make('div','m-companion-more-actions');moreGestures.append(moreSummary,moreActions);
 for(const name of M_LOCAL_GESTURES){const el=button({wave:'Wave',curious:'Curious',surprised:'Surprised',shy:'Shy',playful:'Playful',wink:'Wink',nod:'Nod'}[name]);(M_ASSISTANT_GESTURES.includes(name)?actions:moreActions).append(el);el.addEventListener('click',()=>{refreshMotionControl();const accepted=onGesture(name,{source:'visitor'}),motion=refreshMotionControl();status.textContent=accepted?'Gesture requested. M will respond from a safe resting place.':!motion.active?'Resume M to try a gesture.':motion.reducedMotion?'Motion is off. Enable M motion to try a gesture.':'M cannot perform this gesture yet. Please try again.';});}
 const directorControls=make('div','m-companion-director'),directorHeader=make('div','m-companion-director-header'),directorTitle=make('span','m-companion-director-title','AI play'),directorToggle=button('Pause AI play','m-companion-director-toggle'),directorStatus=make('p','m-companion-director-status');
 directorToggle.setAttribute('aria-pressed','true');directorStatus.setAttribute('role','status');directorStatus.setAttribute('aria-live','polite');directorHeader.append(directorTitle,directorToggle);directorControls.append(directorHeader,directorStatus);
 const autoPrivacy=make('details','m-companion-auto-privacy'),autoSummary=make('summary','m-companion-privacy','AI shares public summaries'),autoPrivacyNote=make('p','m-companion-privacy','AI play occasionally sends public component headings, types, coarse positions, safe action choices and recent actions to OpenAI, with up to 6 requests per tab. Form values and chat drafts stay private. Pause AI play any time.');autoPrivacy.append(autoSummary,autoPrivacyNote);const options=make('div','m-companion-options');options.append(moreGestures,autoPrivacy);
 const character=make('details','m-companion-character'),characterSummary=make('summary','','Expressions & play'),moods=make('div','m-companion-character-actions');
 character.append(characterSummary,moods);options.append(character);
 for(const [name,label]of [['focus','Focused'],['content','Content'],['doubt','Unsure'],['sleepy','Sleepy'],['delight','Delighted'],['neutral','Reset face']]){
  const el=button(label);moods.append(el);el.addEventListener('click',()=>{status.textContent=onAffect(name)?'Expression requested.':'Enable M motion to try an expression.';});
 }
 const explore=button('Explore this card'),hideGame=button('Find M'),lightGame=button('Follow a light'),resetMemory=button('Reset character memory');
 moods.append(explore,hideGame,lightGame,resetMemory);
 explore.addEventListener('click',()=>{const accepted=onScene();status.textContent=accepted?'M is exploring a nearby card.':'There is no safe visible card to explore here.';if(accepted)setOpen(false);});
 for(const [el,name]of [[hideGame,'hide'],[lightGame,'light']])el.addEventListener('click',()=>{const accepted=onGame(name);status.textContent=accepted?'Play started. Use the play controls to stop any time.':'No safe play space here. Try another section with motion enabled.';if(accepted)setOpen(false);});
 resetMemory.addEventListener('click',()=>{onResetMemory();status.textContent='Character memory cleared. Chat and AI request limits are unchanged.';});
 const contextRow=make('div','m-companion-context'),contextLabel=make('span'),explain=button('Explain this card');contextRow.append(contextLabel,explain);contextRow.hidden=true;
 explain.addEventListener('click',()=>{const c=getContextComponent(getContext()?.component);if(!c)return;input.value=(getContext()?.language==='pt'?'Explica este componente: ':'Explain this component: ')+c.title;form.requestSubmit(send);});
 const log=make('div','m-companion-log');log.setAttribute('role','log');log.setAttribute('aria-label','Conversation with M');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
 const suggestion=button('Explore projects','m-companion-section');suggestion.hidden=true;
 const form=make('form','m-companion-form'),label=make('label','','Message M'),input=make('textarea');input.id='m-companion-message';input.name='message';input.maxLength=1200;input.rows=2;input.placeholder=target?'Ask about Ricardo’s work…':'AI chat will be available once connected';input.disabled=!target;label.htmlFor=input.id;
 const send=button('Send','m-companion-send');send.type='submit';send.disabled=!target;
 const clear=button('Clear chat','m-companion-clear'),privacy=make('p','m-companion-privacy',target?'Sending shares your message, recent chat and section with OpenAI. Chat stays in this tab.':'Gestures run locally. Chat stays disconnected until the server is configured.');
 form.append(label,input,send,clear);form.hidden=!target;clear.hidden=!target;panel.append(header,intro,motionNote,actions,options,directorControls,status,log,suggestion,contextRow,form,privacy);document.body.append(toggle,panel);
 let history=[],pending=null,destroyed=false,sectionHint='none',open=false,directorUiEnabled=null,contextCapability=null;
 const listen=(el,name,fn)=>{el.addEventListener(name,fn);listeners.push(()=>el.removeEventListener(name,fn));};
 function refreshMotionControl(){const motion=getMotionStatus(),reducedMotion=Boolean(motion?.reducedMotion);enableMotion.hidden=motionNote.hidden=!reducedMotion;intro.hidden=history.length>0||reducedMotion;return {active:motion?.active!==false,reducedMotion};}
 function refreshDirectorControl(){
  const state=getDirectorStatus()||{},motion=getMotionStatus()||{},enabled=state.enabled!==false;
  if(directorUiEnabled!==enabled){directorToggle.textContent=enabled?'Pause AI play':'Enable AI play';directorToggle.setAttribute('aria-pressed',String(enabled));directorUiEnabled=enabled;}
  let text;
  if(!enabled)text='AI play is paused. Local play continues.';
  else if(motion.active===false)text='AI play waits while M is paused.';
  else if(motion.reducedMotion)text='AI play waits while motion is off.';
  else if(state.reason==='session-limit'||state.attempts>=state.limit)text='AI play has used this tab’s request limit. Local play continues.';
  else if(state.pending)text=state.available?'AI play is choosing a safe move…':'Checking AI play availability…';
  else if(state.available===false)text='AI play is unavailable. M keeps playing locally.';
  else if(state.available===true)text='AI play is connected. '+(state.attempts||0)+' of '+(state.limit||6)+' requests used this tab.';
  else text='AI play is automatic when available. M is playing locally.';
  if(directorStatus.textContent!==text)directorStatus.textContent=text;
  return state;
 }
 function refresh(){const motion=refreshMotionControl();refreshDirectorControl();const c=getContextComponent(getContext()?.component);contextRow.hidden=!c||!target;if(c)contextLabel.textContent='About: '+c.title;return motion;}
 function setOpen(value){refresh();open=Boolean(value);panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));onEngagement(open);if(open)(target?input:close).focus();else{pending?.abort();toggle.focus();}}
 function append(role,text){const row=make('p','m-companion-message '+role);row.textContent=text;log.append(row);while(log.childNodes.length>12)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
 listen(directorToggle,'click',()=>{const state=getDirectorStatus()||{};onDirectorEnabled(state.enabled===false);refresh();});
 listen(enableMotion,'click',()=>{const accepted=onEnableMotion(),motion=refreshMotionControl();status.textContent=!motion.active?'Resume M to try a gesture.':accepted&&!motion.reducedMotion?'M motion enabled for this tab.':'Motion is still off. Please try again.';});
 listen(toggle,'click',()=>setOpen(!open));listen(close,'click',()=>setOpen(false));
 listen(document,'keydown',event=>{if(open&&event.key==='Escape'){event.preventDefault();setOpen(false);}});
 listen(suggestion,'click',()=>{if(sectionHint!=='none'){onSection(sectionHint);setOpen(false);}});
 listen(clear,'click',()=>{pending?.abort();history=[];log.replaceChildren();suggestion.hidden=true;intro.hidden=false;status.textContent=target?'Chat cleared.':'Local gestures are ready.';refreshMotionControl();});
 listen(input,'keydown',event=>{
  if(event.key!=='Enter'||event.shiftKey||event.isComposing||event.keyCode===229)return;
  event.preventDefault();
  if(event.repeat||input.disabled||send.disabled||pending||destroyed)return;
  form.requestSubmit(send);
 });
 listen(form,'submit',async event=>{
  event.preventDefault();if(!target||pending||destroyed)return;
  const message=input.value.trim();if(!message)return;
  const context=getContext(),controller=new AbortController();pending=controller;send.disabled=true;input.disabled=true;suggestion.hidden=true;
  append('visitor',message);input.value='';status.textContent='M is thinking…';
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{
   if(getContextComponent(context?.component)&&contextCapability===null){
    try{const health=await fetchImpl(new URL('/health',target).href,{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal});contextCapability=health.ok&&(await health.json()).contextualChat?.version===1;}catch(error){if(controller.signal.aborted)throw error;contextCapability=false;}
   }
   const chatContext=contextualChatRequest(context,contextCapability);
   const response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal,body:JSON.stringify({message,history:history.slice(-6),context:chatContext})});
   if(!response.ok)throw new Error(response.status===429?'M needs a short rest. Please try again later.':response.status===503?'AI chat is not connected yet. Local gestures still work.':'M could not answer. Please try again.');
   const reply=validateAssistantReply(await response.json());if(!reply)throw new Error('M received an unreadable answer. Please try again.');
   if(destroyed||controller.signal.aborted)return;
   append('assistant',reply.reply);history=[...history,{role:'user',content:message.slice(0,600)},{role:'assistant',content:reply.reply.slice(0,600)}].slice(-6);
   intro.hidden=true;status.textContent='Answered with OpenAI.';
   const contextual=chatContext.component&&onContextResponse(chatContext.component,reply)===true;
   if(!contextual){onExpression(reply.expression);if(reply.gesture!=='none')onGesture(reply.gesture,{source:'assistant',expression:reply.expression});}
   if(reply.section!=='none'){sectionHint=reply.section;suggestion.textContent='Explore '+reply.section;suggestion.hidden=false;}
  }catch(error){if(!destroyed)status.textContent=controller.signal.aborted?'Chat request cancelled.':String(error.message||'M could not answer.');}
  finally{clearTimeout(timeout);if(pending===controller){pending=null;send.disabled=!target;input.disabled=!target;if(open&&!destroyed)input.focus();}}
 });
 refresh();
 return {elements:{toggle,panel,directorToggle,directorStatus,moreGestures},refresh,refreshMotionControl,refreshDirectorControl,isOpen:()=>open,snapshot:()=>({open,configured:Boolean(target),pending:Boolean(pending),messages:history.length}),destroy(){destroyed=true;pending?.abort();for(const remove of listeners)remove();onEngagement(false);toggle.remove();panel.remove();}};
}
