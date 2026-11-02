import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const base=process.env.BASE_URL||'http://127.0.0.1:4183/';
const out=process.env.M_WORLD_ARTIFACT_DIR||path.resolve('../work/M_Intelligence_Validation/gestures');mkdirSync(out,{recursive:true});
const report={url:base,scope:'Native Chrome gesture/UI observation. API responses are explicitly mocked; no real OpenAI call.',checks:[],profiles:[],passed:false};
const check=(name,passed,details)=>report.checks.push({name,passed:Boolean(passed),details});
const longReply='Ricardo builds software and cloud integrations, combining practical delivery with a curious approach to difficult problems. His portfolio presents mobile products, Salesforce work and integration projects with clear descriptions of their purpose and current status. Explore the projects section to compare the examples, then use the experience and expertise sections for background on his approach. I can help you navigate this portfolio and explain the information already available here. For a professional conversation, use the contact section and Ricardo’s public LinkedIn link.';
if(longReply.length<500||longReply.length>700)throw new Error('Long chat fixture must exercise the supported response limit.');
const localConfig=page=>page.route('**/m-world-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:"export const M_WORLD_CONFIG={assistantEndpoint:''};"}));
// Set M_WORLD_INTELLIGENCE_SCOPE=keyboard to run only these mocked keyboard checks.
async function validateChatKeyboard(context,url,name){
 const page=await context.newPage(),requests=[],errors=[];
 let releaseFirst;const firstResponse=new Promise(resolve=>{releaseFirst=resolve;});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/m-world-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:"export const M_WORLD_CONFIG={assistantEndpoint:'https://m-companion-test.invalid/api/m/respond'};"}));
 await page.route('https://m-companion-test.invalid/api/m/respond',async route=>{
  const request=route.request(),headers={'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  requests.push(JSON.parse(request.postData()));if(requests.length===1)await firstResponse;
  return route.fulfill({contentType:'application/json',headers,body:JSON.stringify({reply:'Keyboard fixture reply.',expression:'neutral',gesture:'none',section:'none'})});
 });
 try{
  await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
  await page.getByRole('button',{name:'Talk to M',exact:true}).click();
  const input=page.locator('#m-companion-message'),send=page.getByRole('button',{name:'Send',exact:true});
  check(name+': keyboard fixture never sends on open',requests.length===0);
  await input.fill('Keyboard question');await page.keyboard.press('Shift+Enter');await page.keyboard.type('Second line');
  const draft=await input.inputValue();
  check(name+': actual Shift+Enter inserts a newline without sending',draft==='Keyboard question\nSecond line'&&requests.length===0,{draft,requests:requests.length});
  const composition=await input.evaluate(element=>[true,false].map(isComposing=>{
   const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,isComposing,keyCode:isComposing?13:229});
   element.dispatchEvent(event);return {isComposing:event.isComposing,keyCode:event.keyCode,prevented:event.defaultPrevented};
  }));
  check(name+': composing Enter and legacy IME 229 preserve the draft',composition.every(event=>!event.prevented)&&composition[0].isComposing&&composition[1].keyCode===229&&requests.length===0&&await input.inputValue()===draft,{events:composition,requests:requests.length});
  await page.keyboard.down('Enter');
  await page.waitForFunction(()=>window.MWorld.snapshot().companion.pending);
  const pending=await page.evaluate(()=>{const form=document.querySelector('.m-companion-form'),input=document.querySelector('#m-companion-message');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));form.requestSubmit(document.querySelector('.m-companion-send'));return {snapshot:window.MWorld.snapshot().companion,status:document.querySelector('.m-companion-status').textContent,visitorRows:document.querySelectorAll('.m-companion-message.visitor').length};});
  await page.keyboard.down('Enter');
  check(name+': actual Enter sends exactly once and pending controls reject duplicates',requests.length===1&&requests[0].message===draft&&requests[0].history.length===0&&await input.isDisabled()&&await send.isDisabled()&&pending.snapshot.pending&&pending.snapshot.messages===0&&pending.visitorRows===1&&pending.status==='M is thinking…',{requests:requests.length,...pending});
  releaseFirst();
  await page.waitForFunction(()=>!window.MWorld.snapshot().companion.pending&&document.querySelector('.m-companion-status').textContent==='Answered with OpenAI.');
  const first=await page.evaluate(()=>({snapshot:window.MWorld.snapshot().companion,visitorRows:document.querySelectorAll('.m-companion-message.visitor').length,assistantRows:document.querySelectorAll('.m-companion-message.assistant').length}));
  check(name+': Enter response records one conversation turn and restores controls',requests.length===1&&first.snapshot.messages===2&&first.visitorRows===1&&first.assistantRows===1&&!await input.isDisabled()&&!await send.isDisabled(),first);
  await input.fill('Held Enter draft');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
  check(name+': held Enter cannot send a second message after the reply',requests.length===1&&await input.inputValue()==='Held Enter draft'&&await page.locator('.m-companion-message.visitor').count()===1,{requests:requests.length});
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.MWorld.snapshot().companion.messages===4&&!window.MWorld.snapshot().companion.pending);
  check(name+': a fresh Enter sends once with the previous turn as history',requests.length===2&&requests[1].message==='Held Enter draft'&&requests[1].history.length===2,{requests:requests.length,history:requests[1]?.history.length});
  await input.fill('Button still sends');await send.click();
  await page.waitForFunction(()=>window.MWorld.snapshot().companion.messages===6&&!window.MWorld.snapshot().companion.pending);
  check(name+': Send button retains the same validated submission path',requests.length===3&&requests[2].message==='Button still sends'&&requests[2].history.length===4,{requests:requests.length,history:requests[2]?.history.length});
  await page.getByRole('button',{name:'Clear chat',exact:true}).click();
  await input.fill('Disabled draft');await send.evaluate(element=>{element.disabled=true;});await input.press('Enter');
  check(name+': disabled Send blocks Enter without consuming the draft',requests.length===3&&await input.inputValue()==='Disabled draft'&&await page.locator('.m-companion-status').textContent()==='Chat cleared.');
  await send.evaluate(element=>{element.disabled=false;});await input.fill('   ');await input.press('Enter');
  check(name+': clear resets tab history and empty Enter sends nothing',requests.length===3&&await page.locator('.m-companion-message').count()===0&&await page.evaluate(()=>window.MWorld.snapshot().companion.messages)===0);
  await page.keyboard.press('Escape');
  check(name+': keyboard chat still closes with Escape and restores focus',await page.locator('#m-companion').isHidden()&&await page.evaluate(()=>document.activeElement?.classList.contains('m-companion-toggle')));
  check(name+': keyboard chat adds no JavaScript errors',errors.length===0,errors);
  report.profiles.push({name:name+'-keyboard',requests:requests.length,composition,errors});
 }finally{releaseFirst();await page.keyboard.up('Enter');await page.close();}
}
// The OS preference is real Chrome emulation. Only the visible consent button
// may override it; no diagnostic pose, clock or preference setter is used.
async function validateReducedMotionConsent(browser,options,url,name){
 const context=await browser.newContext({...options,reducedMotion:'reduce'}),errors=[];let apiRequests=0;
 await context.route(/api\.openai\.com|\/api\/m\/respond(?:[?#]|$)/,route=>{apiRequests++;return route.abort('blockedbyclient');});
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(String(error)));
 await page.route('**/m-world-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:"export const M_WORLD_CONFIG={assistantEndpoint:'https://m-companion-test.invalid/api/m/respond'};"}));
 try{
  await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready&&window.MWorld.snapshot().preferences.reducedMotion&&window.MWorld.snapshot().state.mode==='rest',undefined,{timeout:90000});
  const initial=await page.evaluate(()=>{const s=window.MWorld.snapshot();return {x:s.state.x,y:s.state.y,preferences:s.preferences};});
  await page.getByRole('button',{name:'Talk to M',exact:true}).click();
  const enable=page.getByRole('button',{name:'Enable M motion',exact:true});
  await page.waitForTimeout(500);
  const parked=await page.evaluate(()=>{const s=window.MWorld.snapshot();return {x:s.state.x,y:s.state.y,preferences:s.preferences,gesture:s.state.gesture,pending:s.pendingGesture};});
  check(name+': reduced OS preference parks M until explicit consent',initial.preferences.systemReducedMotion&&initial.preferences.reducedMotion&&!initial.preferences.motionOptIn&&parked.preferences.reducedMotion&&Math.hypot(parked.x-initial.x,parked.y-initial.y)<1&&await enable.isVisible()&&await page.getByText('Reduced motion is on. M stays still until you enable motion.',{exact:true}).isVisible(),{initial,parked});
  await page.getByRole('button',{name:'Wave',exact:true}).click();
  check(name+': reduced-motion gesture explains why it was not executed',await page.locator('.m-companion-status').textContent()==='Motion is off. Enable M motion to try a gesture.'&&await page.evaluate(()=>!window.MWorld.snapshot().state.gesture&&!window.MWorld.snapshot().pendingGesture));
  const controls=[];
  for(const selector of ['.m-companion-enable-motion','.m-companion-close','.m-companion-actions button','#m-companion-message','.m-companion-send','.m-companion-clear']){
   for(const element of await page.locator(selector).all()){
    await element.scrollIntoViewIfNeeded();controls.push(await element.evaluate(element=>{const r=element.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return {label:element.textContent||element.name,reachable:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&Boolean(hit&&(hit===element||element.contains(hit)))};}));
   }
  }
  check(name+': reduced-motion note keeps every control reachable',controls.every(control=>control.reachable)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),controls);
  await page.screenshot({path:path.join(out,name+'-reduced-motion-consent.png')});
  await enable.click();
  check(name+': visible consent enables motion locally without changing the OS preference',await page.evaluate(()=>{const s=window.MWorld.snapshot();return s.active&&s.preferences.systemReducedMotion&&!s.preferences.reducedMotion&&s.preferences.motionOptIn;})&&await enable.isHidden()&&await page.locator('.m-companion-status').textContent()==='M motion enabled for this tab.');
  await page.getByRole('button',{name:'Wave',exact:true}).click();
  check(name+': accepted gesture reports a request while safe staging runs',await page.locator('.m-companion-status').textContent()==='Gesture requested. M will respond from a safe resting place.');
  await page.waitForFunction(()=>window.MWorld.snapshot().state.gesture?.name==='wave'&&window.MWorld.snapshot().renderer.gesture.phase==='action',undefined,{timeout:25000});
  await page.screenshot({path:path.join(out,name+'-motion-consented-wave.png')});
  check(name+': consented Wave reaches the real rig',await page.evaluate(()=>window.MWorld.snapshot().renderer.gesture.name==='wave'));
  await page.getByRole('button',{name:'Pause M',exact:true}).click();
  await page.getByRole('button',{name:'Curious',exact:true}).click();
  check(name+': paused gesture asks the visitor to resume M',await page.locator('.m-companion-status').textContent()==='Resume M to try a gesture.'&&await page.evaluate(()=>!window.MWorld.snapshot().active));
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!window.MWorld.snapshot().preferences.systemReducedMotion&&!window.MWorld.snapshot().preferences.motionOptIn);await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>window.MWorld.snapshot().preferences.reducedMotion&&!window.MWorld.snapshot().preferences.motionOptIn);
  check(name+': OS preference changes revoke the prior motion opt-in',await enable.isVisible());
  await enable.click();
  check(name+': enabling motion preserves a separate paused choice',await page.evaluate(()=>!window.MWorld.snapshot().active&&!window.MWorld.snapshot().preferences.reducedMotion)&&await page.locator('.m-companion-status').textContent()==='Resume M to try a gesture.');
  check(name+': motion consent and local gestures make no API requests',apiRequests===0,{apiRequests});
  check(name+': reduced-motion consent adds no JavaScript errors',errors.length===0,errors);
  report.profiles.push({name:name+'-motion-consent',initial,parked,controls,apiRequests,errors});
 }finally{await page.close();await context.close();}
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')});report.browser=browser.version();
try{
 for(const [name,options] of [['desktop',{viewport:{width:1280,height:900},deviceScaleFactor:2}],['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
  if(process.env.M_WORLD_INTELLIGENCE_SCOPE==='motion'){const url=new URL(base);url.searchParams.set('m-debug','1');await validateReducedMotionConsent(browser,options,url,name);continue;}
  const context=await browser.newContext({...options,reducedMotion:'no-preference',...(name==='desktop'?{recordVideo:{dir:path.join(out,'raw-video'),size:{width:1280,height:900}}}:{})});
  let unintendedAPIRequests=0;
  await context.route(/api\.openai\.com|\/api\/m\/respond(?:[?#]|$)/,route=>{unintendedAPIRequests++;return route.abort('blockedbyclient');});
  const url=new URL(base);url.searchParams.set('m-debug','1');
  if(process.env.M_WORLD_INTELLIGENCE_SCOPE==='keyboard'){
   await validateChatKeyboard(context,url,name);
   check(name+': fixture never attempts an unmocked AI request',unintendedAPIRequests===0,{unintendedAPIRequests});
   await context.close();continue;
  }
  const page=await context.newPage(),errors=[];let apiRequests=0;
  await localConfig(page);
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(/api\.openai\.com|\/api\/m\/respond/.test(request.url()))apiRequests++;});
  await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
  await page.getByRole('button',{name:'Talk to M',exact:true}).click();
  check(name+': disconnected chat is honest',await page.locator('#m-companion-message').isDisabled()&&await page.locator('.m-companion-status').textContent()==='Local gestures are ready. AI chat is not connected yet.');
  const results=[];
  for(const [gesture,label] of (name==='desktop'?[['wave','Wave'],['curious','Curious'],['surprised','Surprised'],['shy','Shy']]:[['wave','Wave'],['curious','Curious']])){
   await page.evaluate(()=>{window.__mGestureSamples=[];window.__mGestureSampling=true;function sample(){if(!window.__mGestureSampling)return;const s=window.MWorld.snapshot();window.__mGestureSamples.push({gesture:s.state.gesture,render:s.renderer.gesture,x:s.state.x,y:s.state.y});requestAnimationFrame(sample);}requestAnimationFrame(sample);});
   await page.getByRole('button',{name:label,exact:true}).click();
   await page.waitForFunction(name=>window.MWorld.snapshot().state.gesture?.name===name,gesture,{timeout:15000});
   await page.waitForFunction(()=>window.MWorld.snapshot().renderer.gesture.phase==='action',undefined,{timeout:8000});
   await page.waitForTimeout(300);await page.screenshot({path:path.join(out,name+'-'+gesture+'.png')});
   await page.waitForFunction(()=>!window.MWorld.snapshot().state.gesture,undefined,{timeout:10000});
   const trace=await page.evaluate(()=>{window.__mGestureSampling=false;return window.__mGestureSamples;});
   const active=trace.filter(s=>s.gesture?.name===gesture),phases=[...new Set(active.map(s=>s.render.phase))];
   const displacement=active.length?Math.max(...active.map(s=>Math.hypot(s.x-active[0].x,s.y-active[0].y))):Infinity;
   check(name+': '+gesture+' reaches real rig and recovers',active.length>20&&['anticipation','action','recovery'].every(p=>phases.includes(p))&&displacement<1,{samples:active.length,phases,displacement});
   results.push({gesture,phases,samples:active.length});
  }
  check(name+': local gestures make no API calls',apiRequests===0,{apiRequests});
  await page.keyboard.press('Escape');check(name+': Escape restores toggle focus',await page.locator('#m-companion').isHidden()&&await page.evaluate(()=>document.activeElement?.classList.contains('m-companion-toggle')));
  check(name+': controls remain separate',await page.evaluate(()=>{const a=document.querySelector('.m-world-toggle').getBoundingClientRect(),b=document.querySelector('.m-companion-toggle').getBoundingClientRect();return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top;}));
  check(name+': UI adds no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  report.profiles.push({name,gestures:results,errors});check(name+': no gesture/UI JS errors',errors.length===0,errors);
  const video=page.video();await page.close();if(video&&name==='desktop')await video.saveAs(path.join(out,'M_Gestures_V22.webm'));
  // Exercise a real interrupted production route, including the offscreen
  // mobile entry corridor. Do not set poses, depth or browser time directly.
  const recovery=await context.newPage(),recoveryErrors=[];
  await localConfig(recovery);
  recovery.on('pageerror',error=>recoveryErrors.push(String(error)));
  await recovery.goto(url.href);await recovery.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
  await recovery.locator('main h1').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
  await recovery.waitForFunction(()=>window.MWorld.snapshot().brain.context.reading);
  const readingStart=await recovery.evaluate(()=>{const s=window.MWorld.snapshot();return {actions:s.life.actions,target:s.state.targetId};});
  await recovery.waitForTimeout(1500);
  const readingEnd=await recovery.evaluate(()=>{const s=window.MWorld.snapshot();getSelection().removeAllRanges();return {allowed:s.brain.spontaneousAllowed,reading:s.brain.context.reading,quietRemaining:s.brain.quietUntil-s.brain.nowMs,actions:s.life.actions,target:s.state.targetId};});
  check(name+': reading selection suppresses spontaneous intent and leaves settling time',readingEnd.reading&&!readingEnd.allowed&&readingEnd.quietRemaining>6000&&readingEnd.actions===readingStart.actions&&readingEnd.target===readingStart.target,readingEnd);
  if(name==='mobile')await recovery.locator('.hero-visual').scrollIntoViewIfNeeded();
  const interruptedPlan=await recovery.evaluate(()=>window.MWorld.playAction({selector:'.hero-visual',kind:'peek'}).then(s=>s.plan));
  check(name+': recovery fixture starts a real hero peek',interruptedPlan.available&&interruptedPlan.kind==='peek',interruptedPlan);
  await recovery.waitForFunction(id=>{const s=window.MWorld.snapshot();return s.state.depth<-.95&&s.brain.recentTargets.some(item=>item.id===id);},interruptedPlan.targetId,{timeout:25000});
  const completedVisit=await recovery.evaluate(id=>window.MWorld.snapshot().brain.recentTargets.find(item=>item.id===id),interruptedPlan.targetId);
  await recovery.getByRole('button',{name:'Talk to M',exact:true}).click();
  await recovery.evaluate(()=>{
   window.__mRecoveryStart=performance.now();window.__mRecoverySamples=[];window.__mRecoverySampling=true;
   let lastSample=-Infinity;function sample(now){if(!window.__mRecoverySampling)return;if(now-lastSample>=40){lastSample=now;const s=window.MWorld.snapshot();window.__mRecoverySamples.push({ms:now-window.__mRecoveryStart,depth:s.state.depth,phase:s.state.phase,target:s.state.targetId,gesture:s.state.gesture?.name||null,pending:s.pendingGesture,engaged:s.brain.context.engaged,spontaneousAllowed:s.brain.spontaneousAllowed});}requestAnimationFrame(sample);}requestAnimationFrame(sample);
   document.querySelector('#contact').scrollIntoView({behavior:'instant'});
  });
  await recovery.getByRole('button',{name:'Wave',exact:true}).click();
  await recovery.waitForFunction(()=>window.MWorld.snapshot().state.gesture?.name==='wave',undefined,{timeout:35000});
  await recovery.waitForFunction(()=>window.MWorld.snapshot().renderer.gesture.phase==='action',undefined,{timeout:8000});
  await recovery.screenshot({path:path.join(out,name+'-interrupted-peek-wave.png')});
  await recovery.waitForFunction(()=>!window.MWorld.snapshot().state.gesture,undefined,{timeout:10000});
  const recoveryResult=await recovery.evaluate(id=>{window.__mRecoverySampling=false;const s=window.MWorld.snapshot();return {samples:window.__mRecoverySamples,visit:s.brain.recentTargets.find(item=>item.id===id),engaged:s.brain.context.engaged,depth:s.state.depth,pending:s.pendingGesture};},interruptedPlan.targetId);
  const front=recoveryResult.samples.find(s=>s.depth>.95),wave=recoveryResult.samples.find(s=>s.gesture==='wave');
  const recoveryDetails={frontMs:front?.ms??null,gestureMs:wave?.ms??null,samples:recoveryResult.samples.length,engaged:recoveryResult.engaged,targets:[...new Set(recoveryResult.samples.map(s=>s.target))]};
  check(name+': interrupted behind route recovers and plays queued wave while engaged',Boolean(front&&wave)&&wave.ms>=front.ms&&recoveryResult.depth>.95&&recoveryResult.pending===null&&recoveryResult.engaged&&recoveryResult.samples.every(s=>s.engaged&&!s.spontaneousAllowed&&(s.target===null||s.target===interruptedPlan.targetId)),recoveryDetails);
  check(name+': completed real route visit survives quiet recovery',Boolean(recoveryResult.visit)&&recoveryResult.visit.atMs===completedVisit.atMs&&recoveryResult.visit.count===completedVisit.count,{before:completedVisit,after:recoveryResult.visit});
  check(name+': no recovery/reading JS errors',recoveryErrors.length===0,recoveryErrors);
  writeFileSync(path.join(out,name+'-recovery-trace.json'),JSON.stringify(recoveryResult,null,2));
  report.profiles.find(profile=>profile.name===name).recovery=recoveryDetails;
  const recoveryVideo=recovery.video();await recovery.close();if(recoveryVideo&&name==='desktop')await recoveryVideo.saveAs(path.join(out,'M_Interrupted_Peek_Recovery_V22.webm'));
  let paidCalls=0,lastInput=null;
  const chat=await context.newPage();
  await chat.route('**/m-world-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:"export const M_WORLD_CONFIG={assistantEndpoint:'https://m-companion-test.invalid/api/m/respond'};"}));
  await chat.route('https://m-companion-test.invalid/api/m/respond',async route=>{
   const request=route.request(),headers={'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   paidCalls++;lastInput=JSON.parse(request.postData());
   return route.fulfill({contentType:'application/json',headers,body:JSON.stringify(paidCalls===1?{reply:longReply,expression:'happy',gesture:'none',section:'projects'}:{reply:'Invalid fixture',expression:'happy',gesture:'eval',section:'projects'})});
  });
  await chat.goto(url.href);await chat.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
  await chat.getByRole('button',{name:'Talk to M',exact:true}).click();
  check(name+': chat never sends on open',paidCalls===0);
  await chat.locator('#m-companion-message').fill('Show me the projects');await chat.getByRole('button',{name:'Send',exact:true}).click();
  await chat.waitForFunction(()=>document.querySelector('.m-companion-status').textContent==='Answered with OpenAI.');
  await chat.waitForFunction(()=>window.MWorld.snapshot().state.emotion==='happy'&&Boolean(window.MWorld.snapshot().state.expressionHold),undefined,{timeout:12000});
  check(name+': explicit send validates reply and offers optional navigation',paidCalls===1&&lastInput.message==='Show me the projects'&&lastInput.history.length===0&&await chat.getByRole('button',{name:'Explore projects',exact:true}).isVisible()&&new URL(chat.url()).hash!=='#projects'&&await chat.evaluate(()=>window.MWorld.snapshot().state.emotion==='happy'));
  await chat.waitForFunction(()=>window.MWorld.snapshot().state.emotion==='neutral',undefined,{timeout:8000});
  const longChatLayout=await chat.evaluate(()=>{
   const s=window.MWorld.snapshot(),panel=document.querySelector('#m-companion').getBoundingClientRect(),host=document.querySelector('.mascot-creature').getBoundingClientRect(),f=s.metrics.neutralFootprint;
   const neutral={left:host.left+f.left,top:host.top+f.top,right:host.left+f.right,bottom:host.top+f.bottom,width:f.width,height:f.height};
   const overlap=Math.max(0,Math.min(neutral.right,panel.right)-Math.max(neutral.left,panel.left))*Math.max(0,Math.min(neutral.bottom,panel.bottom)-Math.max(neutral.top,panel.top));
   const controls=Array.from(document.querySelectorAll('.m-world-toggle,.m-companion-toggle,.m-companion-close,.m-companion-actions button,.m-companion-section,.m-companion-send,.m-companion-clear,.m-companion textarea')).map(element=>{const r=element.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2,hit=document.elementFromPoint(x,y);return {label:element.textContent||element.name,visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&Boolean(hit&&(hit===element||element.contains(hit))),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}};});
   return {neutral,panel:{left:panel.left,top:panel.top,right:panel.right,bottom:panel.bottom},neutralCoveredFraction:overlap/Math.max(1,neutral.width*neutral.height),neutralInsideViewport:neutral.left>=0&&neutral.right<=innerWidth&&neutral.top>=0&&neutral.bottom<=innerHeight,active:s.active,depth:s.state.depth,emotion:s.state.emotion,controls,logOverflow:document.querySelector('.m-companion-log').scrollHeight>document.querySelector('.m-companion-log').clientHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2};
  });
  await chat.screenshot({path:path.join(out,name+'-long-chat-neutral.png')});
  writeFileSync(path.join(out,name+'-long-chat-layout.json'),JSON.stringify(longChatLayout,null,2));
  check(name+': long valid reply uses bounded scrollable log',await chat.locator('.m-companion-message.assistant').textContent()===longReply&&longChatLayout.logOverflow&&!longChatLayout.horizontalOverflow,{replyLength:longReply.length,logOverflow:longChatLayout.logOverflow,horizontalOverflow:longChatLayout.horizontalOverflow});
  check(name+': neutral mascot stays visible beside long chat panel',longChatLayout.active&&longChatLayout.depth>.95&&longChatLayout.emotion==='neutral'&&longChatLayout.neutralInsideViewport&&longChatLayout.neutralCoveredFraction===0,{neutral:longChatLayout.neutral,panel:longChatLayout.panel,coveredFraction:longChatLayout.neutralCoveredFraction});
  check(name+': long chat keeps controls visible and reachable',longChatLayout.controls.every(control=>control.visible),longChatLayout.controls);
  report.profiles.find(profile=>profile.name===name).longChat=longChatLayout;
  await chat.locator('#m-companion-message').fill('Another question');await chat.getByRole('button',{name:'Send',exact:true}).click();
  await chat.waitForFunction(()=>document.querySelector('.m-companion-status').textContent.includes('unreadable'));
  check(name+': malformed remote action is rejected',await chat.locator('.m-companion-message.assistant').count()===1&&await chat.locator('.m-companion-section').isHidden()&&lastInput.history.length===2);
  await chat.close();await validateChatKeyboard(context,url,name);
  check(name+': fixture never attempts an unmocked AI request',unintendedAPIRequests===0,{unintendedAPIRequests});
  await context.close();await validateReducedMotionConsent(browser,options,url,name);
 }
 report.passed=report.checks.every(c=>c.passed);
}finally{await browser.close();writeFileSync(path.join(out,'gesture-ui-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),out}));if(!report.passed)process.exitCode=1;
