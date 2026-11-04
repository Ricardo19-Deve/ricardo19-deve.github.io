import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantEndpoint,validateAssistantReply,createMCompanion} from './m-world-companion.mjs';
test('assistant accepts only explicit HTTPS or local development endpoints, without embedded credentials',()=>{
 assert.equal(assistantEndpoint(''),null);
 assert.equal(assistantEndpoint('https://m.example.workers.dev/api/m/respond'),'https://m.example.workers.dev/api/m/respond');
 assert.equal(assistantEndpoint('http://127.0.0.1:4184/api/m/respond'),'http://127.0.0.1:4184/api/m/respond');
 for(const bad of ['http://example.com/api/m/respond','javascript:alert(1)','https://user:secret@example.com/api/m/respond','https://example.com/api/m/respond?key=secret','https://example.com/v1/responses'])assert.equal(assistantEndpoint(bad),null,bad);
});
test('assistant validates bounded gestures and section hints instead of interpreting arbitrary actions',()=>{
 const good={reply:'Hello!',expression:'happy',gesture:'wave',section:'projects'};
 assert.deepEqual(validateAssistantReply(good),good);
 for(const patch of [{gesture:'eval'},{section:'https://evil.example'},{reply:'x'.repeat(701)},{expression:'angry'},{command:'run'}])assert.equal(validateAssistantReply({...good,...patch}),null);
 assert.equal(validateAssistantReply(null),null);
});

class CompanionElement extends EventTarget {
 constructor(tag,document){super();this.tag=tag;this.ownerDocument=document;this.dataset={};this.childNodes=[];this.className='';this.value='';this.disabled=false;this.submissions=0;}
 setAttribute(name,value){this[name]=value;}
 append(...elements){for(const element of elements){element.parent=this;this.childNodes.push(element);}}
 replaceChildren(...elements){this.childNodes=[];this.append(...elements);}
 get firstChild(){return this.childNodes[0];}
 focus(){this.ownerDocument.activeElement=this;}
 remove(){if(this.parent)this.parent.childNodes=this.parent.childNodes.filter(element=>element!==this);}
 requestSubmit(submitter){this.submissions++;const event=new Event('submit',{cancelable:true});event.submitter=submitter;this.dispatchEvent(event);}
}
function companionFixture(options={}){
 const document=new EventTarget(),elements=[],requests=[];
 document.location={href:'https://portfolio.example/'};
 document.createElement=tag=>{const element=new CompanionElement(tag,document);elements.push(element);return element;};
 document.body=document.createElement('body');
 const companion=createMCompanion({document,endpoint:'https://m-companion-test.invalid/api/m/respond',fetchImpl:(url,options)=>new Promise((resolve,reject)=>{
  const request={url,options,body:JSON.parse(options.body),reply:value=>resolve({ok:true,json:async()=>value})};requests.push(request);
  options.signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true});
 }),...options});
 const find=cls=>elements.find(element=>element.className===cls);
 return {companion,document,requests,story:find('m-companion-story'),storyChapter:find('m-companion-story-chapter'),storyGoal:find('m-companion-story-goal'),storyDiscovery:find('m-companion-story-discovery'),storyPreference:find('m-companion-story-preference'),storyJournal:find('m-companion-story-journal'),storyStorage:find('m-companion-story-storage'),rememberCharacter:find('m-companion-remember-character'),enableMotion:find('m-companion-enable-motion'),motionNote:elements.find(element=>element.textContent?.startsWith('Reduced motion is on.')),gesture:label=>elements.find(element=>element.tag==='button'&&element.textContent===label),input:elements.find(element=>element.tag==='textarea'),form:find('m-companion-form'),send:find('m-companion-send'),clear:find('m-companion-clear'),status:find('m-companion-status'),log:find('m-companion-log')};
}
function keydown(input,properties={}){
 const event=Object.assign(new Event('keydown',{cancelable:true}),{key:'Enter',shiftKey:false,isComposing:false,keyCode:13,repeat:false},properties);
 input.dispatchEvent(event);return event;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const validReply={reply:'A fixture response.',expression:'neutral',gesture:'none',section:'none'};

test('Enter submits once through the form and cannot repeat while pending or after completion',async t=>{
 const fixture=companionFixture(),{companion,input,send,form,requests,status,log}=fixture;t.after(()=>companion.destroy());
 input.value=' First question ';
 assert.equal(keydown(input).defaultPrevented,true);
 assert.equal(form.submissions,1);
 assert.equal(requests.length,1);
 assert.equal(requests[0].body.message,'First question');
 assert.deepEqual(requests[0].body.history,[]);
 assert.equal(companion.snapshot().pending,true);
 assert.equal(input.disabled,true);assert.equal(send.disabled,true);
 assert.equal(status.textContent,'M is thinking…');
 keydown(input,{repeat:true});keydown(input);form.requestSubmit(send);
 assert.equal(requests.length,1);
 requests[0].reply(validReply);await settle();
 assert.equal(companion.snapshot().messages,2);
 assert.equal(companion.snapshot().pending,false);
 assert.equal(input.disabled,false);assert.equal(send.disabled,false);
 assert.equal(status.textContent,'Answered with OpenAI.');assert.equal(log.childNodes.length,2);
 input.value='Do not send while Enter is held';keydown(input,{repeat:true});
 assert.equal(requests.length,1);assert.equal(input.value,'Do not send while Enter is held');
 input.value='Button submission';form.requestSubmit(send);
 assert.equal(requests.length,2);assert.equal(requests[1].body.history.length,2);
 requests[1].reply(validReply);await settle();
 assert.equal(companion.snapshot().messages,4);
});

test('Shift+Enter, IME composition and non-Enter keys preserve textarea editing',t=>{
 const {companion,input,form,requests}=companionFixture();t.after(()=>companion.destroy());input.value='Draft';
 for(const properties of [{shiftKey:true},{isComposing:true},{keyCode:229},{key:'a'}])assert.equal(keydown(input,properties).defaultPrevented,false);
 assert.equal(form.submissions,0);assert.equal(requests.length,0);assert.equal(input.value,'Draft');
 input.value='  ';assert.equal(keydown(input).defaultPrevented,true);assert.equal(requests.length,0);
});

test('disabled controls and destruction prevent keyboard submission, while Clear preserves tab-local history behavior',async t=>{
 const {companion,input,send,clear,form,requests,log,status}=companionFixture();t.after(()=>companion.destroy());input.value='Draft';
 input.disabled=true;keydown(input);input.disabled=false;send.disabled=true;keydown(input);
 assert.equal(form.submissions,0);assert.equal(requests.length,0);
 send.disabled=false;keydown(input);requests[0].reply(validReply);await settle();
 clear.dispatchEvent(new Event('click'));
 assert.equal(companion.snapshot().messages,0);assert.equal(log.childNodes.length,0);assert.equal(status.textContent,'Chat cleared.');
 companion.destroy();input.value='After destruction';keydown(input);
 assert.equal(requests.length,1);
});
 test('reduced motion remains off until explicit local consent, and gestures report accepted versus motion-off',t=>{
  let motion={active:true,reducedMotion:true},enabled=0,gestures=0;
  const {companion,enableMotion,motionNote,gesture,status,requests}=companionFixture({getMotionStatus:()=>motion,onEnableMotion:()=>{enabled++;motion={...motion,reducedMotion:false};return true;},onGesture:()=>{gestures++;return !motion.reducedMotion;}});t.after(()=>companion.destroy());
  assert.equal(enabled,0);assert.equal(enableMotion.hidden,false);assert.equal(motionNote.hidden,false);
  gesture('Wave').dispatchEvent(new Event('click'));
  assert.equal(status.textContent,'Motion is off. Enable M motion to try a gesture.');assert.equal(enabled,0);
  enableMotion.dispatchEvent(new Event('click'));
  assert.equal(enabled,1);assert.equal(enableMotion.hidden,true);assert.equal(motionNote.hidden,true);assert.equal(status.textContent,'M motion enabled for this tab.');
  gesture('Wave').dispatchEvent(new Event('click'));
  assert.equal(gestures,2);assert.equal(status.textContent,'Gesture requested. M will respond from a safe resting place.');assert.equal(requests.length,0);
 });

 test('enabling motion preserves pause, and refreshing follows later motion preference changes',t=>{
  let motion={active:false,reducedMotion:true};
  const {companion,enableMotion,motionNote,gesture,status,requests}=companionFixture({getMotionStatus:()=>motion,onEnableMotion:()=>{motion={...motion,reducedMotion:false};return true;}});t.after(()=>companion.destroy());
  enableMotion.dispatchEvent(new Event('click'));
  assert.equal(motion.active,false);assert.equal(status.textContent,'Resume M to try a gesture.');
  gesture('Curious').dispatchEvent(new Event('click'));assert.equal(status.textContent,'Resume M to try a gesture.');
  motion={active:true,reducedMotion:true};companion.refreshMotionControl();
  assert.equal(enableMotion.hidden,false);assert.equal(motionNote.hidden,false);
  motion.reducedMotion=false;companion.refresh();assert.equal(enableMotion.hidden,true);assert.equal(requests.length,0);
 });

 test('a rejected assistant gesture keeps the validated chat answer and never enables motion',async t=>{
  let enabled=0,gestures=0;
  const {companion,input,requests,status,enableMotion}=companionFixture({getMotionStatus:()=>({active:true,reducedMotion:true}),onEnableMotion:()=>{enabled++;return false;},onGesture:()=>{gestures++;return false;}});t.after(()=>companion.destroy());
  input.value='A question';keydown(input);requests[0].reply({...validReply,gesture:'wave'});await settle();
  assert.equal(companion.snapshot().messages,2);assert.equal(status.textContent,'Answered with OpenAI.');
  assert.equal(gestures,1);assert.equal(enabled,0);assert.equal(enableMotion.hidden,false);assert.equal(requests.length,1);
 });
test('new local gestures stay separate from the backward-compatible four chat gestures',t=>{
 const played=[];
 const {companion,gesture,requests}=companionFixture({onGesture:(name,metadata)=>{played.push({name,metadata});return true;}});t.after(()=>companion.destroy());
 for(const label of ['Playful','Wink','Nod'])gesture(label).dispatchEvent(new Event('click'));
 assert.deepEqual(played.map(value=>value.name),['playful','wink','nod']);assert.ok(played.every(value=>value.metadata.source==='visitor'));assert.equal(requests.length,0);
 for(const name of ['playful','wink','nod'])assert.equal(validateAssistantReply({...validReply,gesture:name}),null);
});

test('AI play defaults on, pauses independently, and refresh never initiates network or enables motion',t=>{
 let state={enabled:true,available:true,pending:false,attempts:3,limit:6,source:'openai'},enabledMotion=0;const changes=[];
 const {companion,requests}=companionFixture({getDirectorStatus:()=>state,getMotionStatus:()=>({active:true,reducedMotion:false}),onEnableMotion:()=>{enabledMotion++;return true;},onDirectorEnabled:value=>{changes.push(value);state={...state,enabled:value};}});t.after(()=>companion.destroy());
 const {directorToggle,directorStatus}=companion.elements;
 assert.equal(directorToggle.textContent,'Pause AI play');assert.equal(directorToggle['aria-pressed'],'true');assert.equal(directorStatus.role,'status');assert.match(directorStatus.textContent,/3 of 6/);
 directorToggle.dispatchEvent(new Event('click'));assert.equal(changes[0],false);assert.equal(directorToggle.textContent,'Enable AI play');assert.match(directorStatus.textContent,/paused/);
 directorToggle.dispatchEvent(new Event('click'));assert.equal(changes[1],true);assert.equal(state.attempts,3);
 for(let n=0;n<8;n++)companion.refresh();assert.equal(requests.length,0);assert.equal(enabledMotion,0);
});

test('AI status honestly reports unavailable, reduced motion and session limits without changing chat status',t=>{
 let state={enabled:true,available:false,pending:false,attempts:1,limit:6},motion={active:true,reducedMotion:false};
 const {companion,status,requests}=companionFixture({getDirectorStatus:()=>state,getMotionStatus:()=>motion});t.after(()=>companion.destroy());
 const {directorStatus}=companion.elements;assert.match(directorStatus.textContent,/unavailable/);assert.match(directorStatus.textContent,/locally/);const chatStatus=status.textContent;
 motion.reducedMotion=true;companion.refresh();assert.match(directorStatus.textContent,/motion is off/);
 motion.reducedMotion=false;state={...state,attempts:6,reason:'session-limit'};companion.refresh();assert.match(directorStatus.textContent,/request limit/);
 assert.equal(status.textContent,chatStatus);assert.equal(requests.length,0);
});
test('autonomous play is presented as independent of optional input and status refresh stays local',t=>{
 let autonomy={current:{kind:'scene',id:'internal-scene-17',anchorId:'project-epoxy'}},enabledMotion=0,gestures=0;
 const {companion,requests,input,form,status}=companionFixture({getAutonomyStatus:()=>autonomy,onEnableMotion:()=>{enabledMotion++;return true;},onGesture:()=>{gestures++;return true;}});t.after(()=>companion.destroy());
 const {panel}=companion.elements,intro=panel.childNodes.find(element=>element.className==='m-companion-intro'),autonomyNote=panel.childNodes.find(element=>element.className==='m-companion-autonomy');
 assert.match(intro.textContent,/explores and plays on her own/);assert.match(intro.textContent,/optional gesture/);assert.equal(intro.hidden,false);
 assert.equal(autonomyNote.hidden,false);assert.equal(autonomyNote['aria-live'],'off');
 const chatStatus=status.textContent;input.value='Unsent private draft';
 for(const [next,expected]of [
  [{current:{kind:'scene',id:'internal-scene-17',anchorId:'project-epoxy'}},'M is exploring the page.'],
  [{active:{kind:'rest',quiet:true,id:'internal-rest-22',anchorId:'project-revmend'}},'M is watching quietly.'],
  [{current:{kind:'scene',id:'internal-scene-17'},execution:{kind:'game',id:'internal-game-04',componentId:'project-stackout'}},'M is playing on her own.'],
  [{current:{kind:'affect',id:'internal-affect-03',name:'mischief'}},'M decides where to explore, play and rest.']
 ]){
  autonomy=next;for(let i=0;i<4;i++)companion.refresh();
  assert.equal(autonomyNote.textContent,expected);assert.equal(autonomyNote['aria-live'],'off');assert.equal(autonomyNote.hidden,false);
  assert.doesNotMatch(autonomyNote.textContent,/internal-|project-|mischief/);
 }
 assert.equal(companion.isOpen(),false);assert.equal(input.value,'Unsent private draft');assert.equal(form.submissions,0);
 assert.equal(status.textContent,chatStatus);assert.equal(requests.length,0);assert.equal(enabledMotion,0);assert.equal(gestures,0);
 autonomy=null;companion.refresh();assert.equal(autonomyNote.hidden,true);assert.equal(requests.length,0);
});

test('AI pause remains independent of local autonomous status and respects pause and reduced-motion labels',t=>{
 let director={enabled:true,available:true,attempts:2,limit:6},motion={active:true,reducedMotion:false},autonomy={current:{kind:'scene',id:'internal-scene-17'}},enabledMotion=0;const changes=[];
 const {companion,requests,status,enableMotion,motionNote}=companionFixture({getDirectorStatus:()=>director,getMotionStatus:()=>motion,getAutonomyStatus:()=>autonomy,onDirectorEnabled:enabled=>{changes.push(enabled);director={...director,enabled};},onEnableMotion:()=>{enabledMotion++;return true;}});t.after(()=>companion.destroy());
 const {directorToggle,directorStatus,panel}=companion.elements,autonomyNote=panel.childNodes.find(element=>element.className==='m-companion-autonomy'),chatStatus=status.textContent;
 assert.equal(autonomyNote.textContent,'M is exploring the page.');
 directorToggle.dispatchEvent(new Event('click'));
 assert.deepEqual(changes,[false]);assert.equal(directorToggle.textContent,'Enable AI play');assert.equal(directorToggle['aria-pressed'],'false');
 assert.equal(directorStatus.textContent,'AI play is paused. Local play continues.');assert.equal(autonomyNote.textContent,'M is exploring the page.');
 autonomy={execution:{kind:'game',id:'internal-game-04'}};companion.refresh();assert.equal(autonomyNote.textContent,'M is playing on her own.');
 motion={active:false,reducedMotion:false};companion.refresh();assert.equal(autonomyNote.textContent,'M is paused.');
 motion={active:true,reducedMotion:true};companion.refresh();assert.equal(autonomyNote.textContent,'M is resting while motion is off.');assert.equal(enableMotion.hidden,false);assert.equal(motionNote.hidden,false);
 motion={active:false,reducedMotion:true};companion.refresh();assert.equal(autonomyNote.textContent,'M is paused.');
 motion={active:true,reducedMotion:false};companion.refresh();assert.equal(autonomyNote.textContent,'M is playing on her own.');assert.equal(enableMotion.hidden,true);
 assert.equal(director.enabled,false);assert.equal(director.attempts,2);assert.equal(directorStatus.textContent,'AI play is paused. Local play continues.');
 assert.equal(autonomyNote['aria-live'],'off');assert.doesNotMatch(autonomyNote.textContent,/internal-|game-04/);
 assert.equal(status.textContent,chatStatus);assert.equal(enabledMotion,0);assert.equal(requests.length,0);
 directorToggle.dispatchEvent(new Event('click'));assert.deepEqual(changes,[false,true]);assert.equal(directorToggle.textContent,'Pause AI play');assert.match(directorStatus.textContent,/2 of 6/);assert.equal(autonomyNote.textContent,'M is playing on her own.');assert.equal(requests.length,0);
});

test('the original four gestures stay prominent while extra gestures have an accessible disclosure',t=>{
 const {companion}=companionFixture();t.after(()=>companion.destroy());
 const panel=companion.elements.panel,actions=panel.childNodes.find(element=>element.className==='m-companion-actions'),more=companion.elements.moreGestures;
 assert.equal(actions.childNodes.length,4);assert.deepEqual(actions.childNodes.map(element=>element.textContent),['Wave','Curious','Surprised','Shy']);
 assert.equal(more.tag,'details');assert.equal(Boolean(more.open),false);assert.equal(more.firstChild.tag,'summary');assert.equal(more.firstChild.textContent,'More gestures');assert.deepEqual(more.childNodes[1].childNodes.map(element=>element.textContent),['Playful','Wink','Nod']);
});
test('contextual chat negotiates capability and has one animation owner',async t=>{
 const requests=[],effects=[];
 const f=companionFixture({getContext:()=>({section:'projects',language:'en',component:'project-epoxy'}),fetchImpl:async(url,init)=>{
  requests.push({url,init});
  return {ok:true,json:async()=>init.method==='GET'?{contextualChat:{version:1}}:{...validReply,expression:'curious',gesture:'curious'}};
 },onExpression:()=>effects.push('expression'),onGesture:()=>effects.push('gesture'),onContextResponse:(id,reply)=>{effects.push({id,gesture:reply.gesture});return true;}});
 t.after(()=>f.companion.destroy());f.input.value='Explain this project';keydown(f.input);await settle();await settle();
 assert.equal(requests.length,2);assert.equal(requests[0].init.method,'GET');
 const sent=JSON.parse(requests[1].init.body);assert.equal(sent.context.component,'project-epoxy');
 assert.deepEqual(effects,[{id:'project-epoxy',gesture:'curious'}]);
});
test('legacy Worker receives the old context and fallback reactions remain available',async t=>{
 const requests=[],effects=[];
 const f=companionFixture({getContext:()=>({section:'projects',language:'pt',component:'project-epoxy'}),fetchImpl:async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>init.method==='GET'?{configured:true}:{...validReply,gesture:'wave'}};},onContextResponse:()=>{effects.push('context');return true;},onExpression:()=>effects.push('expression'),onGesture:()=>effects.push('gesture')});
 t.after(()=>f.companion.destroy());f.input.value='Explain Epoxy';keydown(f.input);await settle();await settle();
 assert.deepEqual(JSON.parse(requests[1].init.body).context,{section:'projects',language:'pt'});
 assert.deepEqual(effects,['expression','gesture']);
});
test('optional character controls call local callbacks without consuming an API attempt',()=>{
 const effects=[],f=companionFixture({onAffect:name=>{effects.push(name);return true;},onGame:name=>{effects.push(name);return false;},onResetMemory:()=>effects.push('clear-memory')});
 f.gesture('Sleepy').dispatchEvent(new Event('click'));f.gesture('Find M').dispatchEvent(new Event('click'));f.gesture('Reset character memory').dispatchEvent(new Event('click'));
 assert.deepEqual(effects,['sleepy','hide','clear-memory']);assert.equal(f.requests.length,0);f.companion.destroy();
});

for(const label of ['Sleepy','Wave'])test('compact '+label+' presentation makes room for M and preserves the draft and keyboard return',()=>{
 const f=companionFixture({onAffect:()=>true,onGesture:()=>true});
 f.document.defaultView={matchMedia:query=>({matches:query==='(max-width: 720px)'})};
 f.companion.elements.toggle.dispatchEvent(new Event('click'));f.input.value='Unsent private draft';
 f.gesture(label).dispatchEvent(new Event('click'));
 assert.equal(f.companion.isOpen(),false);
 assert.equal(f.document.activeElement.className,'m-companion-toggle');
 assert.equal(f.input.value,'Unsent private draft');assert.equal(f.requests.length,0);
 f.companion.elements.toggle.dispatchEvent(new Event('click'));assert.equal(f.input.value,'Unsent private draft');f.companion.destroy();
});
test('desktop controls stay open and compact rejected expressions keep motion controls available',()=>{
 const desktop=companionFixture({onAffect:()=>true});desktop.document.defaultView={matchMedia:()=>({matches:false})};
 desktop.companion.elements.toggle.dispatchEvent(new Event('click'));desktop.gesture('Sleepy').dispatchEvent(new Event('click'));assert.equal(desktop.companion.isOpen(),true);desktop.companion.destroy();
 const mobile=companionFixture({onAffect:()=>false});mobile.document.defaultView={matchMedia:()=>({matches:true})};
 mobile.companion.elements.toggle.dispatchEvent(new Event('click'));mobile.gesture('Sleepy').dispatchEvent(new Event('click'));assert.equal(mobile.companion.isOpen(),true);assert.equal(mobile.requests.length,0);mobile.companion.destroy();
});

test('compact expression presentation preserves an in-flight chat and never steals focus on its reply',async()=>{
 const f=companionFixture({onAffect:()=>true});f.document.defaultView={matchMedia:()=>({matches:true})};
 f.companion.elements.toggle.dispatchEvent(new Event('click'));f.input.value='Explain this project';keydown(f.input);
 assert.equal(f.companion.snapshot().pending,true);f.gesture('Sleepy').dispatchEvent(new Event('click'));
 assert.equal(f.companion.isOpen(),false);assert.equal(f.requests[0].options.signal.aborted,false);
 f.requests[0].reply(validReply);await settle();
 assert.equal(f.companion.snapshot().messages,2);assert.equal(f.companion.snapshot().pending,false);
 assert.equal(f.document.activeElement.className,'m-companion-toggle');assert.equal(f.requests.length,1);
 f.companion.elements.toggle.dispatchEvent(new Event('click'));assert.equal(f.log.childNodes.length,2);f.companion.destroy();
});


const characterContext=(patch={})=>({version:1,chapter:'small-light',beat:'seeking',goal:'follow-light',discovery:'none',preference:'small-lights',recall:'first-visit',favoriteComponent:null,...patch});
const characterStatus=(patch={})=>({...characterContext(),remember:true,storageAvailable:true,visits:1,journal:[],favorite:null,...patch});
const journalEntry=(id,patch={})=>({id,atMs:1000,visit:1,componentId:null,publicComponent:null,...patch});

test('M story is an optional quiet disclosure and never requires an input to advance',t=>{
 let storyState=characterStatus(),actions=0;
 const f=companionFixture({getCharacterStatus:()=>storyState,onScene:()=>actions++,onGame:()=>actions++,onGesture:()=>actions++});t.after(()=>f.companion.destroy());
 assert.equal(f.story.hidden,false);assert.equal(Boolean(f.story.open),false);assert.equal(f.story['aria-live'],'off');
 assert.equal(f.story.firstChild.tag,'summary');assert.equal(f.story.firstChild.textContent,'M’s story');
 assert.match(f.storyChapter.textContent,/The Small Light/);assert.match(f.storyGoal.textContent,/where that little light goes/);
 assert.match(f.storyPreference.textContent,/small lights and winding paths/);assert.equal(f.storyJournal.hidden,true);
 assert.equal(f.rememberCharacter['aria-pressed'],'true');assert.match(f.storyStorage.textContent,/discoveries stay on this device/);assert.match(f.storyStorage.textContent,/Chat stays in this tab/);
 f.input.value='Private unsent question';const chatStatus=f.status.textContent;
 for(let i=0;i<20;i++)f.companion.refresh();
 assert.equal(actions,0);assert.equal(f.requests.length,0);assert.equal(f.form.submissions,0);assert.equal(f.input.value,'Private unsent question');assert.equal(f.status.textContent,chatStatus);
 storyState=null;f.companion.refresh();assert.equal(f.story.hidden,true);
});

test('story progress, actual discoveries and preferences update without restarting or rebuilding unchanged content',t=>{
 let state=characterStatus();const f=companionFixture({getCharacterStatus:()=>state});t.after(()=>f.companion.destroy());
 state=characterStatus({beat:'returning',goal:'find-lookout',discovery:'little-light',journal:[journalEntry('light-found')]});f.companion.refresh();
 assert.match(f.storyChapter.textContent,/discovery to remember/);assert.match(f.storyGoal.textContent,/quiet lookout/);assert.equal(f.storyDiscovery.textContent,'Discovery: the little light.');assert.equal(f.storyJournal.childNodes.length,1);assert.equal(f.storyJournal.firstChild.textContent,'I caught the little light.');
 const first=f.storyJournal.firstChild;for(let i=0;i<5;i++)f.companion.refresh();assert.equal(f.storyJournal.firstChild,first,'An unchanged story must keep the same DOM nodes');
 state=characterStatus({beat:'complete',goal:'revisit-lookout',discovery:'little-light',preference:'quiet-lookouts',recall:'returning',favoriteComponent:'project-epoxy',journal:[journalEntry('light-found'),journalEntry('lookout-found',{componentId:'stable-private-18',publicComponent:'project-epoxy'})]});f.companion.refresh();
 assert.match(f.storyChapter.textContent,/adventure remembered/);assert.match(f.storyGoal.textContent,/revisit my favourite lookout/);assert.equal(f.storyPreference.textContent,'My favourite lookout is by Epoxy Platform.');assert.equal(f.storyJournal.childNodes.length,2);assert.match(f.storyJournal.childNodes[1].textContent,/Epoxy Platform/);
 assert.ok(f.storyJournal.childNodes.every(element=>!element.textContent.includes('stable-private-18')));assert.equal(f.requests.length,0);
});

test('story never renders unknown journal text, unapproved places or fabricated milestone entries',t=>{
 let state=characterStatus({beat:'complete',goal:'explore',discovery:'little-light',preference:'quiet-lookouts',journal:[
  journalEntry('light-found'),
  journalEntry('<img src=x onerror=alert(1)>'),
  journalEntry('lookout-found',{publicComponent:'<script>private prompt</script>'}),
  {...journalEntry('lookout-found'),message:'leaked raw chat'},
  journalEntry('lookout-revisited',{componentId:'https://unapproved.example'}),
  journalEntry('lookout-found',{atMs:Infinity}),
  journalEntry('lookout-found',{visit:-1})
 ]});
 const f=companionFixture({getCharacterStatus:()=>state});t.after(()=>f.companion.destroy());
 assert.equal(f.storyJournal.childNodes.length,1);assert.equal(f.storyJournal.firstChild.textContent,'I caught the little light.');
 assert.doesNotMatch(f.storyJournal.firstChild.textContent,/private|script|chat|https|img/);
 state=characterStatus({journal:[journalEntry('light-found'),journalEntry('lookout-found')]});f.companion.refresh();
 assert.equal(f.storyJournal.childNodes.length,0,'A seeking state cannot claim a discovery from an injected entry');
 state=characterStatus({beat:'arbitrary-script'});f.companion.refresh();assert.equal(f.story.hidden,true);
 assert.equal(f.requests.length,0);
});

test('remember preference and story reset preserve drafts, chat and AI allowance independently of motion',t=>{
 let state=characterStatus(),director={enabled:false,attempts:3,limit:6};const changes=[];
 const f=companionFixture({getCharacterStatus:()=>state,getDirectorStatus:()=>director,getMotionStatus:()=>({active:false,reducedMotion:true}),onRememberCharacter:value=>{changes.push(value);state={...state,remember:value,storageAvailable:value};},onResetMemory:()=>{state=characterStatus({remember:state.remember,storageAvailable:state.remember});}});t.after(()=>f.companion.destroy());
 f.input.value='Unsent private draft';f.rememberCharacter.dispatchEvent(new Event('click'));
 assert.deepEqual(changes,[false]);assert.equal(f.rememberCharacter['aria-pressed'],'false');assert.match(f.storyStorage.textContent,/last while this page is open/);
 f.rememberCharacter.dispatchEvent(new Event('click'));assert.deepEqual(changes,[false,true]);assert.equal(f.rememberCharacter['aria-pressed'],'true');
 state={...state,storageAvailable:false};f.companion.refresh();assert.match(f.storyStorage.textContent,/cannot save it for another visit/);
 state={...state,beat:'returning',goal:'find-lookout',discovery:'little-light',journal:[journalEntry('light-found')]};f.companion.refresh();
 f.gesture('Reset character memory').dispatchEvent(new Event('click'));
 assert.match(f.storyChapter.textContent,/curiosity to follow/);assert.equal(f.storyJournal.childNodes.length,0);
 assert.equal(f.input.value,'Unsent private draft');assert.equal(f.companion.snapshot().messages,0);assert.equal(f.requests.length,0);assert.equal(director.attempts,3);assert.equal(director.enabled,false);
});

test('character chat negotiates independently and reuses its capability without persisting conversation',async t=>{
 const requests=[],context=characterContext();
 const f=companionFixture({getContext:()=>({section:'home',language:'en',character:context}),fetchImpl:async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>init.method==='GET'?{character:{version:1}}:validReply};}});t.after(()=>f.companion.destroy());
 f.input.value='What do you want to discover?';keydown(f.input);await settle();await settle();
 assert.equal(requests.length,2);assert.equal(requests[0].init.method,'GET');assert.deepEqual(JSON.parse(requests[1].init.body).context,{section:'home',language:'en',character:context});
 f.input.value='What do you like?';keydown(f.input);await settle();await settle();
 assert.equal(requests.length,3);assert.equal(requests[2].init.method,'POST');assert.equal(JSON.parse(requests[2].init.body).history.length,2);
 f.clear.dispatchEvent(new Event('click'));assert.equal(f.companion.snapshot().messages,0);assert.equal(requests.length,3);
});

test('component and character capabilities are independent and legacy Workers get the exact old body',async t=>{
 for(const [health,component,character]of [[{configured:true},false,false],[{contextualChat:{version:1}},true,false],[{character:{version:1}},false,true],[{contextualChat:{version:1},character:{version:1}},true,true],[{contextualChat:{version:1},character:{version:2}},true,false]]){
  const requests=[],context=characterContext();
  const f=companionFixture({getContext:()=>({section:'projects',language:'pt',component:'project-epoxy',character:context}),fetchImpl:async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>init.method==='GET'?health:validReply};}});t.after(()=>f.companion.destroy());
  f.input.value='Tell me your story';keydown(f.input);await settle();await settle();
  const sent=JSON.parse(requests[1].init.body).context;
  assert.deepEqual(sent,{section:'projects',language:'pt',...(component?{component:'project-epoxy'}:{}),...(character?{character:context}:{})});
  assert.equal(requests.length,2);assert.equal(f.companion.snapshot().messages,2);
 }
});

test('invalid character context never triggers health or leaks raw history into a request',async t=>{
 const requests=[];
 const f=companionFixture({getContext:()=>({section:'home',language:'en',character:{...characterContext(),journal:['private unsent history']}}),fetchImpl:async(url,init)=>{requests.push({url,init});return {ok:true,json:async()=>validReply};}});t.after(()=>f.companion.destroy());
 f.input.value='Hello';keydown(f.input);await settle();await settle();
 assert.equal(requests.length,1);assert.equal(requests[0].init.method,'POST');assert.deepEqual(JSON.parse(requests[0].init.body).context,{section:'home',language:'en'});
});
