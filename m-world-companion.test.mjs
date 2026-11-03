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
 return {companion,document,requests,enableMotion:find('m-companion-enable-motion'),motionNote:elements.find(element=>element.textContent?.startsWith('Reduced motion is on.')),gesture:label=>elements.find(element=>element.tag==='button'&&element.textContent===label),input:elements.find(element=>element.tag==='textarea'),form:find('m-companion-form'),send:find('m-companion-send'),clear:find('m-companion-clear'),status:find('m-companion-status'),log:find('m-companion-log')};
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
