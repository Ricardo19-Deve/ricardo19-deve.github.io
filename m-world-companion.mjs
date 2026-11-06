import {getContextComponent,contextualChatRequest} from './m-world-context.mjs?v=50';
import {validateCharacterContext} from './m-world-character-context.mjs?v=50';
/** V36: public chat answers portfolio questions only. M's autonomous actions and private settings live outside the conversation. */
export const M_ASSISTANT_GESTURES=Object.freeze(['wave','curious','surprised','shy']);
export const M_LOCAL_GESTURES=Object.freeze([...M_ASSISTANT_GESTURES,'playful','wink','nod','sleep','hop','think']);
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
export function createMCompanion({document=globalThis.document,endpoint='',fetchImpl=globalThis.fetch,onGesture=()=>false,onExpression=()=>{},onSection=()=>{},onEngagement=()=>{},getMotionStatus=()=>({active:true,reducedMotion:false}),onEnableMotion=()=>false,getContext=()=>({section:'home',language:'en'}),getDirectorStatus=()=>({enabled:true,available:false,pending:false,attempts:0,limit:6,source:'local'}),onDirectorEnabled=()=>{},onAffect=()=>false,onScene=()=>false,onGame=()=>false,onContextResponse=()=>{},onResetMemory=()=>{},getAutonomyStatus=()=>null,getCharacterStatus=()=>null,onRememberCharacter=()=>{},getWorldDiscovery=()=>null,getWorldStory=()=>null}={}){
 const target=assistantEndpoint(endpoint,document.location?.href),listeners=[];
 const diagnostics=/(?:^|[?&])m-debug=1(?:&|$)/.test(document.location?.search||'');
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const button=(text,cls)=>{const el=make('button',cls,text);el.type='button';return el;};
 const toggle=button('Ask M','m-companion-toggle');toggle.dataset.mOverlay='true';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','m-companion');
 const panel=make('section','m-companion');panel.dataset.mode='questions';panel.id='m-companion';panel.dataset.mOverlay='true';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Talk to M');
 const header=make('div','m-companion-header'),title=make('h2','','Ask M'),close=button('Close','m-companion-close'),enableMotion=button('Enable M motion','m-companion-enable-motion'),privacyToggle=button('Privacy','m-companion-privacy-toggle');header.append(title,close);
 privacyToggle.hidden=false;
 privacyToggle.setAttribute('aria-expanded','false');
 privacyToggle.setAttribute('aria-controls','m-companion-settings');
 {
  privacyToggle.className='m-companion-settings-toggle';
  privacyToggle.textContent='⚙';
  privacyToggle.setAttribute('aria-label','M settings and privacy');
  privacyToggle.title='M settings and privacy';
  privacyToggle.dataset.mOverlay='true';
 }
 enableMotion.hidden=true;close.setAttribute('aria-label','Close M chat');
 const intro=make('p','m-companion-intro',target?'Curious about Ricardo’s work? Ask M anything about the projects and experience on this page, plus reviewed public LinkedIn posts when available.':'M explores the page on her own. Questions will be available when AI chat is connected.');
 const motionNote=make('p','m-companion-intro','Reduced motion is on. M stays still until you enable motion.');motionNote.hidden=true;
 // One collapsed, sourced observation, not an extra action-button panel.
 const worldNote=make('details','m-companion-world-note'),worldSummary=make('summary','','M’s discovery today'),
  worldText=make('p','m-companion-world-text'),worldNarrative=make('p','m-companion-world-story'),worldLink=make('a','m-companion-world-link','Source: Wikipedia');
 worldLink.target='_blank';worldLink.rel='noopener noreferrer';
 worldNote.append(worldSummary,worldText,worldNarrative,worldLink);worldNote.hidden=true;
 let worldNoteId=null;
 function refreshWorldNote(){
  const item=getWorldDiscovery();
  if(!item||typeof item.title!=='string'||!/^https:\/\/en\.wikipedia\.org\/wiki\//u.test(item.url||'')){
   worldNote.hidden=true;worldNoteId=null;return;
  }
  if(item.id!==worldNoteId){
   worldText.textContent=item.title+' ('+item.year+') · '+item.topic;
   worldLink.href=item.url;worldNoteId=item.id;
  }
  const lived=getWorldStory();
  worldNarrative.textContent=lived?.available&&typeof lived?.narrative==='string'?lived.narrative:'';
  worldNarrative.hidden=!worldNarrative.textContent;
  worldNote.hidden=false;
 }
 const status=make('p','m-companion-status',diagnostics?(target?'AI chat is ready.':'Local gestures are ready. AI chat is not connected yet.'):!target?'AI chat is not connected yet.':'');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const autonomyNote=make('p','m-companion-autonomy');autonomyNote.setAttribute('aria-live','off');autonomyNote.hidden=true;
 const actions=make('div','m-companion-actions'),moreGestures=make('details','m-companion-more-gestures'),moreSummary=make('summary','','More gestures'),moreActions=make('div','m-companion-more-actions');moreGestures.append(moreSummary,moreActions);
 for(const name of M_LOCAL_GESTURES){const el=button({wave:'Wave',curious:'Curious',surprised:'Surprised',shy:'Shy',playful:'Playful',wink:'Wink',nod:'Nod',sleep:'Sleep',hop:'Hop',think:'Think'}[name]);(M_ASSISTANT_GESTURES.includes(name)?actions:moreActions).append(el);el.addEventListener('click',()=>{refreshMotionControl();const accepted=onGesture(name,{source:'visitor'}),motion=refreshMotionControl();status.textContent=accepted?'Gesture requested. M will respond from a safe resting place.':!motion.active?'Resume M to try a gesture.':motion.reducedMotion?'Motion is off. Enable M motion to try a gesture.':'M cannot perform this gesture yet. Please try again.';makeRoomForCharacter(accepted);});}
 const directorControls=make('div','m-companion-director'),directorHeader=make('div','m-companion-director-header'),directorTitle=make('span','m-companion-director-title','AI play'),directorToggle=button('AI play · On','m-companion-director-toggle'),directorStatus=make('p','m-companion-director-status');
 directorControls.id='m-companion-director-options';directorToggle.setAttribute('aria-pressed','true');directorStatus.setAttribute('role','status');directorStatus.setAttribute('aria-live','polite');directorHeader.append(directorTitle);const rememberPrivacy=button('Remember M on this device','m-companion-remember-privacy');
 rememberPrivacy.setAttribute('aria-pressed','false');
 // Only two preferences are shown to visitors. These operate on existing
 // engines; no character actions, API calls or new tracking are created here.
 directorControls.append(directorHeader,directorStatus);
 const autoPrivacy=make('details','m-companion-auto-privacy'),autoSummary=make('summary','m-companion-privacy','AI shares public summaries'),autoPrivacyNote=make('p','m-companion-privacy','AI play occasionally sends public component headings, types, coarse positions, safe action choices, recent actions and M’s discoveries and current intention to OpenAI, with up to 6 requests per tab. Form values and chat drafts stay private. Pause AI play any time.');autoPrivacy.append(autoSummary,autoPrivacyNote);const options=make('div','m-companion-options');options.append(moreGestures,autoPrivacy);
 const story=make('details','m-companion-story'),storySummary=make('summary','','M’s story'),storyChapter=make('p','m-companion-story-chapter'),storyGoal=make('p','m-companion-story-goal'),storyDiscovery=make('p','m-companion-story-discovery'),storyPreference=make('p','m-companion-story-preference'),storyJournal=make('ol','m-companion-story-journal'),rememberCharacter=button('Remember on this device','m-companion-remember-character'),storyStorage=make('p','m-companion-story-storage');
 story.hidden=true;story.setAttribute('aria-live','off');storyJournal.setAttribute('aria-label','M’s remembered discoveries');rememberCharacter.setAttribute('aria-label','Remember M’s adventures on this device');rememberCharacter.setAttribute('aria-pressed','false');
 story.append(storySummary,storyChapter,storyGoal,storyDiscovery,storyPreference,storyJournal,rememberCharacter,storyStorage);options.append(story);
 const character=make('details','m-companion-character'),characterSummary=make('summary','','Expressions & play'),moods=make('div','m-companion-character-actions');
 character.append(characterSummary,moods);options.append(character);
 for(const [name,label]of [['focus','Focused'],['content','Content'],['doubt','Unsure'],['sleepy','Sleepy'],['delight','Delighted'],['pondering','Pondering'],['dozing','Dozing'],['joyful','Joyful'],['neutral','Reset face']]){
  const el=button(label);moods.append(el);el.addEventListener('click',()=>{const accepted=onAffect(name);status.textContent=accepted?'Expression requested.':'Enable M motion to try an expression.';makeRoomForCharacter(accepted);});
 }
 const explore=button('Explore this card'),hideGame=button('Find M'),lightGame=button('Follow a light'),ballGame=button('Floating ball'),resetMemory=button('Reset character memory');
 moods.append(explore,hideGame,lightGame,ballGame,resetMemory);
 explore.addEventListener('click',()=>{const accepted=onScene();status.textContent=accepted?'M is exploring a nearby card.':'There is no safe visible card to explore here.';if(accepted)setOpen(false);});
 for(const [el,name]of [[hideGame,'hide'],[lightGame,'light'],[ballGame,'ball']])el.addEventListener('click',()=>{const accepted=onGame(name);status.textContent=accepted?'Play started. Use the play controls to stop any time.':'No safe play space here. Try another section with motion enabled.';if(accepted)setOpen(false);});
 resetMemory.addEventListener('click',()=>{onResetMemory();refreshStoryControl();status.textContent='Character memory cleared. Chat and AI request limits are unchanged.';});
 const contextRow=make('div','m-companion-context'),contextLabel=make('span'),explain=button('Explain this card');contextRow.append(contextLabel,explain);contextRow.hidden=true;
 explain.addEventListener('click',()=>{const c=getContextComponent(getContext()?.component);if(!c)return;input.value=(getContext()?.language==='pt'?'Explica este componente: ':'Explain this component: ')+c.title;form.requestSubmit(send);});
 const prompts=make('div','m-companion-prompts');
 prompts.setAttribute('role','group');prompts.setAttribute('aria-label','Suggested questions for M');
 for(const question of ['What has Ricardo built?','How does Ricardo use AI?','What is his Salesforce experience?']){
  const item=button(question,'m-companion-question');prompts.append(item);
  item.addEventListener('click',()=>{if(!target||pending||destroyed)return;input.value=question;form.requestSubmit(send);});
 }
 prompts.hidden=!target;
 const log=make('div','m-companion-log');log.setAttribute('role','log');log.setAttribute('tabindex','0');log.setAttribute('aria-label','Conversation with M');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
 const suggestion=button('Explore projects','m-companion-section');suggestion.hidden=true;
 const form=make('form','m-companion-form'),label=make('label','','Message M'),input=make('textarea');input.id='m-companion-message';input.name='message';input.maxLength=1200;input.rows=2;input.wrap='soft';input.placeholder=target?'Ask M a question…':'AI chat will be available once connected';input.disabled=!target;label.htmlFor=input.id;
 const send=button('Send','m-companion-send');send.type='submit';send.disabled=!target;
 const clear=button('Clear chat','m-companion-clear'),privacy=make('p','m-companion-privacy',target?'AI-powered answers about public portfolio information. Chat stays in this tab.':'Chat is not connected yet.');
 form.append(label,input,send);form.hidden=!target;
 const conversation=make('div','m-companion-body');
 const settingsPanel=make('section','m-companion-settings');
 settingsPanel.id='m-companion-settings';settingsPanel.dataset.mOverlay='true';settingsPanel.hidden=true;
 settingsPanel.setAttribute('role','dialog');settingsPanel.setAttribute('aria-label','M preferences and privacy');
 const settingsHeader=make('div','m-companion-settings-header'),
 settingsTitle=make('h3','','M settings'),settingsClose=button('Close','m-companion-settings-close');
 settingsClose.setAttribute('aria-label','Close M preferences');settingsHeader.append(settingsTitle,settingsClose);
 // Detailed activity, discovery and memory-reset tools are internal diagnostics,
 // not settings that portfolio visitors need to read.
 rememberPrivacy.title='Turning memory off deletes M’s saved adventures on this device.';
 directorToggle.title='Optional AI play uses public portfolio summaries, never form entries.';
 // One and only one Ask M UI, even for developers: portfolio Q&A and Send.
 // A debug URL may expose separate tools, but never place them in the chat.
 conversation.append(intro,log,status,privacy);
 prompts.hidden=true;suggestion.hidden=true;contextRow.hidden=true;
 settingsPanel.append(settingsHeader,rememberPrivacy,directorToggle);
 const debugToggle=button('Dev tools','m-companion-debug-toggle'),
  debugPanel=make('section','m-companion-debug-panel'),
  debugHeader=make('div','m-companion-settings-header'),
  debugTitle=make('h3','','M diagnostics'),debugClose=button('Close','m-companion-debug-close');
 debugToggle.dataset.mOverlay='true';debugToggle.hidden=!diagnostics;
 debugToggle.setAttribute('aria-controls','m-companion-debug-panel');
 debugToggle.setAttribute('aria-expanded','false');
 debugPanel.dataset.mOverlay='true';debugPanel.id='m-companion-debug-panel';
 debugPanel.hidden=true;debugPanel.setAttribute('role','dialog');
 debugPanel.setAttribute('aria-label','M developer diagnostics');
 debugHeader.append(debugTitle,debugClose);
 if(diagnostics)debugPanel.append(debugHeader,actions,options,autonomyNote,contextRow,suggestion,clear,resetMemory,directorStatus);
 panel.append(header,conversation,form);
 if(diagnostics)document.body.append(toggle,privacyToggle,settingsPanel,debugToggle,debugPanel,panel);
 else document.body.append(toggle,privacyToggle,settingsPanel,panel);

 let history=[],pending=null,destroyed=false,sectionHint='none',open=false,directorUiEnabled=null,contextCapability=null,characterCapability=null,storyKey=null;
 const listen=(el,name,fn)=>{el.addEventListener(name,fn);listeners.push(()=>el.removeEventListener(name,fn));};
 function refreshMotionControl(){const motion=getMotionStatus(),reducedMotion=Boolean(motion?.reducedMotion);enableMotion.hidden=motionNote.hidden=!reducedMotion;intro.hidden=history.length>0||reducedMotion;return {active:motion?.active!==false,reducedMotion};}
 function refreshDirectorControl(){
  const state=getDirectorStatus()||{},motion=getMotionStatus()||{},enabled=state.enabled!==false;
  if(directorUiEnabled!==enabled){
   directorToggle.textContent='AI play · '+(enabled?'On':'Off');
   directorToggle.setAttribute('aria-label','Optional AI play: '+(enabled?'On':'Off')+'. Uses public page summaries only.');
   directorToggle.setAttribute('aria-pressed',String(enabled));
   directorUiEnabled=enabled;
  }
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
 function refreshAutonomyControl(){const current=getAutonomyStatus();autonomyNote.hidden=!diagnostics||!current;if(!current)return;const motion=getMotionStatus(),choice=current.current||current.active;const text=motion?.active===false?'M is paused.':motion?.reducedMotion?'M is resting while motion is off.':choice?.play==='ball'?'M is playing with a floating ball.':choice?.gesture==='sleep'?'M is having a quiet rest.':choice?.gesture==='hop'?'M is making a playful hop.':choice?.gesture==='think'?'M is thinking about her next discovery.':current.execution?.kind==='game'?'M is playing on her own.':choice?.kind==='scene'?'M is exploring the page.':choice?.quiet?'M is watching quietly.':'M decides where to explore, play and rest.';if(autonomyNote.textContent!==text)autonomyNote.textContent=text;}
 function refreshStoryControl(){
  const snapshot=getCharacterStatus();
  const {version,chapter,beat,goal,discovery,preference,recall,favoriteComponent}=snapshot||{};
  const context={version,chapter,beat,goal,discovery,preference,recall,favoriteComponent};
  if(!validateCharacterContext(context)||typeof snapshot.remember!=='boolean'||typeof snapshot.storageAvailable!=='boolean'){story.hidden=true;storyKey=null;return;}
  rememberPrivacy.textContent='Memory · '+(snapshot.remember?'On':'Off');
  rememberPrivacy.setAttribute('aria-label','Remember M on this device: '+(snapshot.remember?'On':'Off')+'. Turning off deletes saved adventures.');
  rememberPrivacy.setAttribute('aria-pressed',String(snapshot.remember));
  const entries=[];
  const phrases={'light-found':'I caught the little light.','lookout-found':'I found a lookout worth coming back to.','lookout-revisited':'I came back to my familiar lookout.'};
  for(const entry of (Array.isArray(snapshot.journal)?snapshot.journal:[]).slice(-12)){
   if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).sort().join(',')!=='atMs,componentId,id,publicComponent,visit'||!Object.hasOwn(phrases,entry.id)||!Number.isFinite(entry.atMs)||entry.atMs<0||!Number.isInteger(entry.visit)||entry.visit<1||entry.visit>1_000_000)continue;
   if(entry.componentId!==null&&(typeof entry.componentId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(entry.componentId)))continue;
   if(entry.publicComponent!==null&&!getContextComponent(entry.publicComponent))continue;
   if(discovery==='none'||(entry.id!=='light-found'&&beat!=='complete'))continue;
   const place=getContextComponent(entry.publicComponent),text=phrases[entry.id]+(place?' By '+place.title+'.':'');
   entries.push(text);
  }
  const key=JSON.stringify({context,remember:snapshot.remember,storage:snapshot.storageAvailable,entries});
  story.hidden=false;if(key===storyKey)return;storyKey=key;
  storyChapter.textContent='The Small Light · '+({seeking:'A curiosity to follow',returning:'A discovery to remember',complete:'An adventure remembered'}[beat]);
  storyGoal.textContent={ 'follow-light':'I want to find out where that little light goes.','find-lookout':'I want a quiet lookout to enjoy this discovery.','revisit-lookout':'I want to revisit my favourite lookout.',explore:'I want to discover another corner of this world.'}[goal];
  storyDiscovery.textContent=discovery==='little-light'?'Discovery: the little light.':'My discoveries grow from my adventures.';
  const favourite=getContextComponent(favoriteComponent);
  storyPreference.textContent=favourite?'My favourite lookout is by '+favourite.title+'.':preference==='quiet-lookouts'?'I like a quiet lookout after an adventure.':'I like small lights and winding paths.';
  storyJournal.replaceChildren(...entries.map(text=>make('li','',text)));storyJournal.hidden=entries.length===0;
  rememberCharacter.textContent='Remember on this device: '+(snapshot.remember?'On':'Off');rememberCharacter.setAttribute('aria-pressed',String(snapshot.remember));
  storyStorage.textContent=!snapshot.remember?'M’s discoveries last while this page is open. Chat stays in this tab.':snapshot.storageAvailable?'M’s discoveries stay on this device. Chat stays in this tab.':'M can keep this adventure going here, but this browser cannot save it for another visit. Chat stays in this tab.';
 }
 function refresh(){refreshViewport();refreshAutonomyControl();refreshStoryControl();refreshWorldNote();
  const motion=refreshMotionControl();refreshDirectorControl();
  const c=getContextComponent(getContext()?.component);
  contextRow.hidden=!diagnostics||!c||!target;
  if(c)contextLabel.textContent='About: '+c.title;
  return motion;
 }
 function makeRoomForCharacter(accepted){if(accepted&&document.defaultView?.matchMedia?.('(max-width: 720px)')?.matches)setOpen(false,{cancelPending:false});}
 function setOpen(value,{cancelPending=true}={}){refresh();
  if(value&&!settingsPanel.hidden){
   settingsPanel.hidden=true;privacyToggle.setAttribute('aria-expanded','false');
  }
  if(value&&diagnostics&&!debugPanel.hidden){debugPanel.hidden=true;debugToggle.setAttribute('aria-expanded','false');}
  open=Boolean(value);panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));onEngagement(open);if(open)(target?input:close).focus();else{if(cancelPending)pending?.abort();toggle.focus();}refreshViewport();}
 function append(role,text){prompts.hidden=true;const row=make('p','m-companion-message '+role);row.textContent=text;log.append(row);while(log.childNodes.length>12)log.firstChild.remove();log.scrollTop=role==='assistant'&&Number.isFinite(row.offsetTop)?row.offsetTop:log.scrollHeight;if(open)conversation.scrollTop=0;}
 function refreshViewport(){
  const view=document.defaultView,visual=view?.visualViewport,height=visual?.height||view?.innerHeight;
  if(!panel.style?.setProperty||!Number.isFinite(height)||height<=0)return;
  const offset=Number.isFinite(visual?.offsetTop)?visual.offsetTop:0,inset=Math.max(0,(view?.innerHeight||height)-offset-height);
  const set=(name,value)=>{if(panel.style.getPropertyValue?.(name)!==value)panel.style.setProperty(name,value);};
  set('--m-companion-visible-height',height+'px');set('--m-companion-keyboard-inset',inset+'px');
  panel.dataset.keyboardOpen=open&&document.activeElement===input&&inset>100?'true':'false';
 }
 const view=document.defaultView,visual=view?.visualViewport;
 if(view?.addEventListener)listen(view,'resize',refreshViewport);
 if(visual?.addEventListener){listen(visual,'resize',refreshViewport);listen(visual,'scroll',refreshViewport);}
 listen(input,'focus',refreshViewport);listen(input,'blur',refreshViewport);
 listen(rememberCharacter,'click',()=>{const current=getCharacterStatus();if(current&&typeof current.remember==='boolean'){onRememberCharacter(!current.remember);refreshStoryControl();}});
 listen(rememberPrivacy,'click',()=>{const current=getCharacterStatus();if(current&&typeof current.remember==='boolean'){onRememberCharacter(!current.remember);refreshStoryControl();}});
 listen(directorToggle,'click',()=>{const state=getDirectorStatus()||{};onDirectorEnabled(state.enabled===false);refresh();});
 function setSettingsOpen(value){
  if(value&&open)setOpen(false);
  if(value&&diagnostics&&!debugPanel.hidden){debugPanel.hidden=true;debugToggle.setAttribute('aria-expanded','false');}
  settingsPanel.hidden=!value;
  privacyToggle.setAttribute('aria-expanded',String(Boolean(value)));
  if(value)settingsClose.focus();
  else privacyToggle.focus();
 }
 listen(privacyToggle,'click',()=>setSettingsOpen(settingsPanel.hidden));
 function setDebugOpen(value){
  if(!diagnostics)return;
  if(value&&open)setOpen(false);
  if(value&&!settingsPanel.hidden){settingsPanel.hidden=true;privacyToggle.setAttribute('aria-expanded','false');}
  debugPanel.hidden=!value;debugToggle.setAttribute('aria-expanded',String(Boolean(value)));
  if(value)debugClose.focus();else debugToggle.focus();
 }
 listen(debugToggle,'click',()=>setDebugOpen(debugPanel.hidden));
 listen(debugClose,'click',()=>setDebugOpen(false));
 listen(settingsClose,'click',()=>setSettingsOpen(false));
 listen(enableMotion,'click',()=>{const accepted=onEnableMotion(),motion=refreshMotionControl();status.textContent=!motion.active?'Resume M to try a gesture.':accepted&&!motion.reducedMotion?'M motion enabled for this tab.':'Motion is still off. Please try again.';});
 listen(toggle,'click',()=>setOpen(!open));listen(close,'click',()=>setOpen(false));
 listen(document,'keydown',event=>{if(event.key==='Escape'&&!settingsPanel.hidden){event.preventDefault();setSettingsOpen(false);}else if(event.key==='Escape'&&diagnostics&&!debugPanel.hidden){event.preventDefault();setDebugOpen(false);}else if(open&&event.key==='Escape'){event.preventDefault();setOpen(false);}});
 listen(suggestion,'click',()=>{if(sectionHint!=='none'){onSection(sectionHint);setOpen(false);}});
 listen(clear,'click',()=>{pending?.abort();history=[];log.replaceChildren();suggestion.hidden=true;intro.hidden=false;conversation.scrollTop=0;status.textContent=target?'Chat cleared.':'Chat is not connected.';prompts.hidden=!target;refreshMotionControl();});
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
   if((getContextComponent(context?.component)&&contextCapability===null)||(validateCharacterContext(context?.character)&&characterCapability===null)){
    try{const health=await fetchImpl(new URL('/health',target).href,{method:'GET',credentials:'omit',cache:'no-store',signal:controller.signal}),capabilities=health.ok?await health.json():null;contextCapability=capabilities?.contextualChat?.version===1;characterCapability=capabilities?.character?.version===1;}catch(error){if(controller.signal.aborted)throw error;contextCapability=characterCapability=false;}
   }
   const chatContext=contextualChatRequest(context,contextCapability,characterCapability);
   const response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal,body:JSON.stringify({message,history:history.slice(-6),context:chatContext})});
   if(!response.ok)throw new Error(response.status===429?'M needs a short rest. Please try again later.':response.status===503?'AI chat is not connected yet. Local gestures still work.':'M could not answer. Please try again.');
   const reply=validateAssistantReply(await response.json());if(!reply)throw new Error('M received an unreadable answer. Please try again.');
   if(destroyed||controller.signal.aborted)return;
   append('assistant',reply.reply);history=[...history,{role:'user',content:message.slice(0,600)},{role:'assistant',content:reply.reply.slice(0,600)}].slice(-6);
   intro.hidden=true;status.textContent=diagnostics?'Answered with OpenAI.':'';
   // A chat reply is information only. It must never make the original
   // character perform gestures, express emotions, change a route or
   // initiate a game. M's autonomous director owns all that behavior.
   if(diagnostics&&reply.section!=='none'){
    sectionHint=reply.section;suggestion.textContent='Explore '+reply.section;
    suggestion.hidden=false;
   }
  }catch(error){if(!destroyed)status.textContent=controller.signal.aborted?'Chat request cancelled.':String(error.message||'M could not answer.');}
  finally{clearTimeout(timeout);if(pending===controller){pending=null;send.disabled=!target;input.disabled=!target;if(open&&!destroyed)input.focus();}}
 });
 refresh();
 return {elements:{toggle,panel,settingsPanel,settingsClose,debugToggle,debugPanel,debugClose,directorToggle,directorStatus,moreGestures,story,rememberCharacter,prompts,privacyToggle,worldNote,worldNarrative},refresh,refreshMotionControl,refreshDirectorControl,isOpen:()=>open,snapshot:()=>({open,configured:Boolean(target),pending:Boolean(pending),messages:history.length,settingsOpen:!settingsPanel.hidden}),destroy(){destroyed=true;pending?.abort();for(const remove of listeners)remove();onEngagement(false);toggle.remove();privacyToggle.remove();settingsPanel.remove();debugToggle.remove();debugPanel.remove();panel.remove();}};
}
