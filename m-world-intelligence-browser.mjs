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
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')});report.browser=browser.version();
try{
 for(const [name,options] of [['desktop',{viewport:{width:1280,height:900},deviceScaleFactor:2}],['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
  const context=await browser.newContext({...options,reducedMotion:'no-preference',...(name==='desktop'?{recordVideo:{dir:path.join(out,'raw-video'),size:{width:1280,height:900}}}:{})});
  const page=await context.newPage(),errors=[];let apiRequests=0;
  page.on('pageerror',error=>errors.push(String(error)));page.on('request',request=>{if(/api\.openai\.com|\/api\/m\/respond/.test(request.url()))apiRequests++;});
  const url=new URL(base);url.searchParams.set('m-debug','1');await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
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
   return route.fulfill({contentType:'application/json',headers,body:JSON.stringify(paidCalls===1?{reply:'Ricardo builds software and cloud integrations. Explore the projects section.',expression:'happy',gesture:'none',section:'projects'}:{reply:'Invalid fixture',expression:'happy',gesture:'eval',section:'projects'})});
  });
  await chat.goto(url.href);await chat.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
  await chat.getByRole('button',{name:'Talk to M',exact:true}).click();
  check(name+': chat never sends on open',paidCalls===0);
  await chat.locator('#m-companion-message').fill('Show me the projects');await chat.getByRole('button',{name:'Send',exact:true}).click();
  await chat.waitForFunction(()=>document.querySelector('.m-companion-status').textContent==='Answered with OpenAI.');
  check(name+': explicit send validates reply and offers optional navigation',paidCalls===1&&lastInput.message==='Show me the projects'&&lastInput.history.length===0&&await chat.getByRole('button',{name:'Explore projects',exact:true}).isVisible()&&new URL(chat.url()).hash!=='#projects'&&await chat.evaluate(()=>window.MWorld.snapshot().state.emotion==='happy'));
  await chat.locator('#m-companion-message').fill('Another question');await chat.getByRole('button',{name:'Send',exact:true}).click();
  await chat.waitForFunction(()=>document.querySelector('.m-companion-status').textContent.includes('unreadable'));
  check(name+': malformed remote action is rejected',await chat.locator('.m-companion-message.assistant').count()===1&&await chat.locator('.m-companion-section').isHidden()&&lastInput.history.length===2);
  await chat.close();await context.close();
 }
 report.passed=report.checks.every(c=>c.passed);
}finally{await browser.close();writeFileSync(path.join(out,'gesture-ui-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),out}));if(!report.passed)process.exitCode=1;
