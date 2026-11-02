/** Explicit, optional chat and local gesture controls. No persistent chat storage. */
export const M_ASSISTANT_GESTURES=Object.freeze(['wave','curious','surprised','shy']);
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
export function createMCompanion({document=globalThis.document,endpoint='',fetchImpl=globalThis.fetch,onGesture=()=>false,onExpression=()=>{},onSection=()=>{},onEngagement=()=>{},getContext=()=>({section:'home',language:'en'})}={}){
 const target=assistantEndpoint(endpoint,document.location?.href),listeners=[];
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const button=(text,cls)=>{const el=make('button',cls,text);el.type='button';return el;};
 const toggle=button('Talk to M','m-companion-toggle');toggle.dataset.mOverlay='true';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','m-companion');
 const panel=make('section','m-companion');panel.id='m-companion';panel.dataset.mOverlay='true';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Talk to M');
 const header=make('div','m-companion-header'),title=make('h2','','Meet M'),close=button('Close','m-companion-close');header.append(title,close);
 const intro=make('p','m-companion-intro',target?'A little curiosity, a little magic. Try a gesture or ask about this portfolio.':'A little curiosity, a little magic. Try one of M’s gestures.');
 const status=make('p','m-companion-status',target?'AI chat is ready.':'Local gestures are ready. AI chat is not connected yet.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const actions=make('div','m-companion-actions');
 for(const name of M_ASSISTANT_GESTURES){const el=button({wave:'Wave',curious:'Curious',surprised:'Surprised',shy:'Shy'}[name]);actions.append(el);el.addEventListener('click',()=>{const accepted=onGesture(name,{source:'visitor'});status.textContent=accepted?'Gesture selected. M responds from a safe resting place.':'Resume M to try a gesture. Motion preferences are respected.';});}
 const log=make('div','m-companion-log');log.setAttribute('role','log');log.setAttribute('aria-label','Conversation with M');log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
 const suggestion=button('Explore projects','m-companion-section');suggestion.hidden=true;
 const form=make('form','m-companion-form'),label=make('label','','Message M'),input=make('textarea');input.id='m-companion-message';input.name='message';input.maxLength=1200;input.rows=2;input.placeholder=target?'Ask about Ricardo’s work…':'AI chat will be available once connected';input.disabled=!target;label.htmlFor=input.id;
 const send=button('Send','m-companion-send');send.type='submit';send.disabled=!target;
 const clear=button('Clear chat','m-companion-clear'),privacy=make('p','m-companion-privacy',target?'Only Send shares your message, recent chat and section with OpenAI. Chat stays in this tab.':'Gestures run locally. Chat stays disconnected until the server is configured.');
 form.append(label,input,send,clear);form.hidden=!target;clear.hidden=!target;panel.append(header,intro,actions,status,log,suggestion,form,privacy);document.body.append(toggle,panel);
 let history=[],pending=null,destroyed=false,sectionHint='none',open=false;
 const listen=(el,name,fn)=>{el.addEventListener(name,fn);listeners.push(()=>el.removeEventListener(name,fn));};
 function setOpen(value){open=Boolean(value);panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));onEngagement(open);if(open)(target?input:close).focus();else{pending?.abort();toggle.focus();}}
 function append(role,text){const row=make('p','m-companion-message '+role);row.textContent=text;log.append(row);while(log.childNodes.length>12)log.firstChild.remove();log.scrollTop=log.scrollHeight;}
 listen(toggle,'click',()=>setOpen(!open));listen(close,'click',()=>setOpen(false));
 listen(document,'keydown',event=>{if(open&&event.key==='Escape'){event.preventDefault();setOpen(false);}});
 listen(suggestion,'click',()=>{if(sectionHint!=='none'){onSection(sectionHint);setOpen(false);}});
 listen(clear,'click',()=>{pending?.abort();history=[];log.replaceChildren();suggestion.hidden=true;intro.hidden=false;status.textContent=target?'Chat cleared.':'Local gestures are ready.';});
 listen(form,'submit',async event=>{
  event.preventDefault();if(!target||pending||destroyed)return;
  const message=input.value.trim();if(!message)return;
  const controller=new AbortController();pending=controller;send.disabled=true;input.disabled=true;suggestion.hidden=true;
  append('visitor',message);input.value='';status.textContent='M is thinking…';
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await fetchImpl(target,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',cache:'no-store',signal:controller.signal,body:JSON.stringify({message,history:history.slice(-6),context:getContext()})});
   if(!response.ok)throw new Error(response.status===429?'M needs a short rest. Please try again later.':response.status===503?'AI chat is not connected yet. Local gestures still work.':'M could not answer. Please try again.');
   const reply=validateAssistantReply(await response.json());if(!reply)throw new Error('M received an unreadable answer. Please try again.');
   if(destroyed||controller.signal.aborted)return;
   append('assistant',reply.reply);history=[...history,{role:'user',content:message.slice(0,600)},{role:'assistant',content:reply.reply.slice(0,600)}].slice(-6);
   intro.hidden=true;status.textContent='Answered with OpenAI.';onExpression(reply.expression);
   if(reply.gesture!=='none')onGesture(reply.gesture,{source:'assistant',expression:reply.expression});
   if(reply.section!=='none'){sectionHint=reply.section;suggestion.textContent='Explore '+reply.section;suggestion.hidden=false;}
  }catch(error){if(!destroyed)status.textContent=controller.signal.aborted?'Chat request cancelled.':String(error.message||'M could not answer.');}
  finally{clearTimeout(timeout);if(pending===controller){pending=null;send.disabled=!target;input.disabled=!target;if(open&&!destroyed)input.focus();}}
 });
 return {elements:{toggle,panel},isOpen:()=>open,snapshot:()=>({open,configured:Boolean(target),pending:Boolean(pending),messages:history.length}),destroy(){destroyed=true;pending?.abort();for(const remove of listeners)remove();onEngagement(false);toggle.remove();panel.remove();}};
}
