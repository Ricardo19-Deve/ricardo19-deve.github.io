/** Native-Chrome V23 diagnostics. All director replies are mocked; no paid API call. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {homedir} from 'node:os';
import {validateDirectorInput,validateDirectorReply} from './m-world-director-protocol.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const base=process.env.BASE_URL||'http://127.0.0.1:4183/';
const out=process.env.M_WORLD_ARTIFACT_DIR||path.resolve('../work/M_V23_Validation');mkdirSync(out,{recursive:true});
const endpoint='https://m-ai-v23.invalid/api/m/direct',health='https://m-ai-v23.invalid/health';
const sentinel='V23_PRIVATE_FORM_VALUE_DO_NOT_SHARE_7481';
const scope=process.env.M_WORLD_V23_SCOPE||'all',recordScope=new Set((process.env.M_RECORD_SCOPE||'playful,nod').split(','));
const cooldownWindow=64000;
const report={url:base,scope:'Actual native Chrome, original V6 renderer and real RAF. Director server replies are mocked; no real OpenAI call. Short clips capture only selected gesture canvases.',checks:[],manualChecks:[],profiles:[],artifacts:[],passedScope:'Executed checks only. manualChecks remain unverified.',passed:false};
const check=(name,passed,details)=>report.checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});
const screenshot=async(page,name)=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});report.artifacts.push(file);return file;};
const read=page=>page.evaluate(()=>window.MWorld.snapshot());
async function recordCanvas(page,name){
 if(!recordScope.has(name)||!await page.evaluate(()=>Boolean(document.querySelector('.m-world-canvas')?.captureStream&&globalThis.MediaRecorder)))return false;
 await page.evaluate(()=>{
  const stream=document.querySelector('.m-world-canvas').captureStream(30),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});
  globalThis.__v23Recording=new Promise(resolve=>{recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:'video/webm'});const bytes=new Uint8Array(await blob.arrayBuffer());let encoded='';for(let i=0;i<bytes.length;i+=16384)encoded+=String.fromCharCode(...bytes.subarray(i,i+16384));resolve({base64:btoa(encoded),bytes:bytes.length});};});
  recorder.start();setTimeout(()=>recorder.stop(),2200);
 });
 return true;
}
async function saveCanvasRecording(page,name){
 const data=await page.evaluate(()=>globalThis.__v23Recording);if(!data?.bytes)return null;
 if(data.bytes<2048)return {available:false,bytes:data.bytes,reason:'Native canvas recorder returned a header without usable video frames.'};
 const file=path.join(out,'M_V23_'+name+'.webm');writeFileSync(file,Buffer.from(data.base64,'base64'));report.artifacts.push(file);return {file,bytes:data.bytes,durationMs:2200};
}
async function startTrace(page){
 await page.evaluate(()=>{
  globalThis.__v23Trace=[];globalThis.__v23TraceRunning=true;
  function sample(){
   if(!globalThis.__v23TraceRunning)return;
   if(globalThis.MWorld){const s=MWorld.snapshot();globalThis.__v23Trace.push({at:performance.now(),x:s.state.x,y:s.state.y,vx:s.state.vx,vy:s.state.vy,depth:s.state.depth,targetId:s.state.targetId,mode:s.state.mode,phase:s.state.phase,active:s.active,frozen:s.frozen,frames:s.stats.frames,gesture:s.state.gesture?{name:s.state.gesture.name,side:s.state.gesture.side}:null,render:s.renderer?.gesture,expression:s.renderer?.expression,left:s.renderer?.blink?.leftClosure,right:s.renderer?.blink?.rightClosure,source:s.director?.source});if(globalThis.__v23Trace.length>12000)globalThis.__v23Trace.shift();}
   requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
 });
}
async function validateLocalGestures(page,name){
 const results=[];
 await page.getByRole('button',{name:'Talk to M',exact:true}).click();
 const pauseAI=page.getByRole('button',{name:'Pause AI play',exact:true});if(await pauseAI.count())await pauseAI.click();
 await page.locator('.m-companion-more-gestures summary').click();
 check(name+': More gestures exposes Playful, Wink and Nod',await page.getByRole('button',{name:'Playful',exact:true}).isVisible()&&await page.getByRole('button',{name:'Wink',exact:true}).isVisible()&&await page.getByRole('button',{name:'Nod',exact:true}).isVisible());
 for(const [gesture,label]of (name==='desktop'?[['wave','Wave'],['curious','Curious'],['surprised','Surprised'],['shy','Shy'],['playful','Playful'],['wink','Wink'],['nod','Nod']]:[['wink','Wink'],['playful','Playful']])){
  const index=await page.evaluate(()=>globalThis.__v23Trace.length);
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(gesture=>MWorld.snapshot().state.gesture?.name===gesture,gesture,{timeout:35000});
  await page.waitForFunction(gesture=>{const s=MWorld.snapshot(),g=s.renderer?.gesture;return g?.name===gesture&&g.phase==='action';},gesture,{timeout:10000});
  const recording=name==='desktop'&&await recordCanvas(page,gesture);
  if(gesture==='wink')await page.waitForFunction(()=>{const b=MWorld.snapshot().renderer.blink;return Math.max(b.leftClosure||0,b.rightClosure||0)>.99&&Math.min(b.leftClosure??1,b.rightClosure??1)<.001;},undefined,{timeout:5000});
  else await page.waitForFunction(gesture=>{const g=MWorld.snapshot().renderer.gesture,d={wave:3.1,curious:3.6,surprised:2.25,shy:3.3,playful:3.7,wink:2.5,nod:2.8}[gesture];return g.name===gesture&&g.age/d>=.36;},gesture,{timeout:5000});
  if(name==='desktop'&&['wave','playful','wink','nod'].includes(gesture))await screenshot(page,name+'-'+gesture+'-actual-rig');
  if(recording)results.push({gesture,video:await saveCanvasRecording(page,gesture)});
  await page.waitForFunction(()=>!MWorld.snapshot().state.gesture,undefined,{timeout:10000});
  const trace=await page.evaluate(index=>globalThis.__v23Trace.slice(index),index),active=trace.filter(row=>row.gesture?.name===gesture),phases=[...new Set(active.map(row=>row.render?.phase))];
  const displacement=active.length?Math.max(...active.map(row=>Math.hypot(row.x-active[0].x,row.y-active[0].y))):Infinity;
  check(name+': '+gesture+' has native anticipation, action and recovery',active.length>10&&['anticipation','action','recovery'].every(phase=>phases.includes(phase))&&displacement<1,{samples:active.length,phases,displacement});
  if(gesture==='wink'){
   const closed=active.filter(row=>Math.max(row.left??0,row.right??0)>.99),partial=active.filter(row=>Math.max(row.left??0,row.right??0)>.02&&Math.max(row.left??0,row.right??0)<.98);
   check(name+': visible Wink deforms exactly its selected original HAT eye',closed.length>0&&partial.length>5&&closed.every(row=>(row.gesture.side>0?row.left:row.right)>.99&&(row.gesture.side>0?row.right:row.left)<.001),{closedSamples:closed.length,partialSamples:partial.length,sides:[...new Set(active.map(row=>row.gesture.side))]});
  }
  results.push({gesture,phases,samples:active.length});
 }
 await page.keyboard.press('Escape');
 return results;
}
async function runProfile(browser,name,options){
 const context=await browser.newContext({...options,reducedMotion:'no-preference'}),result={name,options,requests:[],healthRequests:0,blocked:[],errors:[],responses:[]};
 let page;
 const headers={'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 await context.addInitScript(value=>document.addEventListener('DOMContentLoaded',()=>{const field=document.createElement('textarea');field.id='v23-private-fixture';field.value=value;field.setAttribute('aria-hidden','true');field.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px';document.body.append(field);const arbitrary=document.createElement('span');arbitrary.hidden=true;arbitrary.textContent=value+'_ARBITRARY_DOM';document.body.append(arbitrary);}),sentinel);
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();
  if(new URL(url).pathname.endsWith('/m-world-config.mjs'))return route.fulfill({contentType:'text/javascript',body:`export const M_WORLD_CONFIG=Object.freeze({assistantEndpoint:'',directorEndpoint:'${endpoint}'});`});
  if(url===health){result.healthRequests++;return route.fulfill({contentType:'application/json',headers,body:JSON.stringify({configured:true,director:{version:1,enabled:true}})});}
  if(url===endpoint){
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(request.method()!=='POST'){result.blocked.push({url,method:request.method()});return route.abort('blockedbyclient');}
   const input=JSON.parse(request.postData()||'null'),known=page?await page.evaluate(()=>{const s=MWorld.snapshot();return {surfaceIds:s.surfaces.map(surface=>surface.id),perception:s.director?.perception,companion:s.companion,frames:s.stats.frames};}):null;
   const target=input?.snapshot?.targets?.find(target=>target.actions.includes('inspect'));
   const reply={snapshot:input?.snapshot?.revision,targetId:target?.id??null,action:target?'inspect':'rest',gesture:'wink',expression:'happy'};
   result.requests.push({at:Date.now(),input,known,reply});
   return route.fulfill({contentType:'application/json',headers,body:JSON.stringify(reply)});
  }
  if(/api\.openai\.com/iu.test(url)||/\/api\/m\/(?:respond|direct)(?:[?#]|$)/u.test(url)||(request.method()==='POST'&&new URL(url).origin!==new URL(base).origin)){
   result.blocked.push({url,method:request.method()});return route.abort('blockedbyclient');
  }
  return route.continue();
 });
 try{
  page=await context.newPage();page.on('pageerror',error=>result.errors.push(String(error)));page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(new URL(base).origin))result.responses.push({status:response.status(),url:response.url()});});
  const url=new URL(base);url.searchParams.set('m-debug','1');
  await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});await startTrace(page);
  if(name==='mobile'){await page.locator('#projects').scrollIntoViewIfNeeded();await page.waitForTimeout(1200);}
  const initial=await read(page);result.initial={renderer:initial.renderer,preferences:initial.preferences};
  check(name+': original V6 rig, fourteen skin influences, ten material maps and six clips',initial.renderer.bones===31&&initial.renderer.tailBones===10&&initial.renderer.maxInfluences===14&&initial.renderer.skinSets===4&&initial.renderer.detailMaps===10&&initial.renderer.clips.length===6&&initial.renderer.shaderErrors.length===0,{bones:initial.renderer.bones,maxInfluences:initial.renderer.maxInfluences,skinSets:initial.renderer.skinSets,detailMaps:initial.renderer.detailMaps,clips:initial.renderer.clips.length,shaderErrors:initial.renderer.shaderErrors});
  if(scope!=='gestures'){
   await page.waitForFunction(()=>MWorld.snapshot().director?.source==='openai',undefined,{timeout:40000});
   const first=result.requests[0],payload=JSON.stringify(first?.input);
   check(name+': one automatic mocked decision occurs without Send or opening chat',result.requests.length===1&&first.known?.companion?.open===false&&first.known?.companion?.messages===0,{requests:result.requests.length,healthRequests:result.healthRequests});
   check(name+': outbound public snapshot is bounded and excludes form values or arbitrary DOM',validateDirectorInput(first?.input)&&first.input.snapshot.targets.length>0&&first.input.snapshot.targets.length<=8&&!payload.includes(sentinel)&&first.input.snapshot.targets.every(target=>first.known.surfaceIds.includes(target.id)),{snapshot:first?.input,knownSurfaceIds:first?.known?.surfaceIds});
   check(name+': mocked structured suggestion names one real offered component',validateDirectorReply(first?.reply,first?.input)&&first?.reply.action==='inspect'&&first.input.snapshot.targets.some(target=>target.id===first.reply.targetId),first?.reply);
   await page.waitForFunction(()=>{const s=MWorld.snapshot();return s.renderer.gesture.name==='wink'&&Math.max(s.renderer.blink.leftClosure??0,s.renderer.blink.rightClosure??0)>.99&&s.renderer.expression==='happy';},undefined,{timeout:45000});
   const during=await read(page);await screenshot(page,name+'-automatic-mocked-ai-wink');
   check(name+': automatic component decision reaches real HAT wink and happy expression',during.renderer.gesture.name==='wink'&&during.renderer.expression==='happy'&&Math.max(during.renderer.blink.leftClosure??0,during.renderer.blink.rightClosure??0)>.99&&Math.min(during.renderer.blink.leftClosure??1,during.renderer.blink.rightClosure??1)<.001,{director:during.director,gesture:during.renderer.gesture,blink:during.renderer.blink});
   await page.waitForFunction(()=>!MWorld.snapshot().state.gesture,undefined,{timeout:10000});
   const trace=await page.evaluate(()=>globalThis.__v23Trace),latest=await read(page);
   check(name+': original local body keeps updating through automatic AI staging',latest.stats.frames>initial.stats.frames+20&&!latest.frozen&&latest.director.lastExecution?.targetId===first.reply.targetId&&latest.director.lastExecution?.action==='inspect'&&latest.director.perception?.attentionId===first.reply.targetId,{initialFrames:initial.stats.frames,frames:latest.stats.frames,target:first.reply.targetId,lastExecution:latest.director.lastExecution,attentionId:latest.director.perception?.attentionId,observedTargets:[...new Set(trace.map(row=>row.targetId).filter(Boolean))]});
   if(name==='desktop'){
    const remaining=first.at+cooldownWindow-Date.now();if(remaining>0)await page.waitForTimeout(remaining);
    result.cooldownObservedMs=Date.now()-first.at;
    check(name+': no second POST throughout the actual 64-second minimum-interval window',result.requests.length===1&&result.cooldownObservedMs>=cooldownWindow,{requests:result.requests.length,observedMs:result.cooldownObservedMs,minimumIntervalMs:65000,nextAt:(await read(page)).director.nextAt});
   }
  }
  if(scope!=='auto')result.gestures=await validateLocalGestures(page,name);
  else{await page.getByRole('button',{name:'Talk to M',exact:true}).click();await page.getByRole('button',{name:'Pause AI play',exact:true}).click();await page.keyboard.press('Escape');}
  const requestsBeforeGates=result.requests.length,framesBefore=(await read(page)).stats.frames;
  await page.waitForTimeout(1200);const aiPaused=await read(page);
  check(name+': Pause AI play stops AI requests while local animation continues',!aiPaused.director.enabled&&result.requests.length===requestsBeforeGates&&aiPaused.stats.frames>framesBefore,{director:aiPaused.director,framesBefore,frames:aiPaused.stats.frames});
  await page.getByRole('button',{name:'Pause M',exact:true}).click();
  await page.getByRole('button',{name:'Talk to M',exact:true}).click();await page.getByRole('button',{name:'Enable AI play',exact:true}).click();await page.keyboard.press('Escape');
  const paused=await read(page);await page.waitForTimeout(1100);const stillPaused=await read(page);
  check(name+': Pause M stops native animation and AI requests',!stillPaused.active&&stillPaused.director.enabled&&stillPaused.stats.frames===paused.stats.frames&&result.requests.length===requestsBeforeGates,{framesBefore:paused.stats.frames,framesAfter:stillPaused.stats.frames});
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Resume M',exact:true}).click();await page.waitForFunction(()=>MWorld.snapshot().preferences.reducedMotion);const parked=await read(page);await page.waitForTimeout(1100);const stillParked=await read(page);
  check(name+': reduced motion parks M and makes no AI request',stillParked.preferences.reducedMotion&&Math.hypot(stillParked.state.x-parked.state.x,stillParked.state.y-parked.state.y)<1&&result.requests.length===requestsBeforeGates,{preferences:stillParked.preferences});
  const background=await context.newPage();await background.goto('about:blank');await background.bringToFront();
  const hidden=await page.evaluate(()=>document.hidden);await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(1100);
  if(hidden)check(name+': an actual background tab makes no AI request',result.requests.length===requestsBeforeGates,{actualDocumentHidden:true,requests:result.requests.length});
  else report.manualChecks.push({name:name+': actual hidden-tab AI suppression',status:'not_verified',reason:'Native Chrome headless kept document.visibilityState visible after opening another tab. No visibility property was overridden. A real background-tab check remains manual.',details:{actualDocumentHidden:false,requests:result.requests.length}});
  await background.close();await page.bringToFront();
  check(name+': every observed automatic POST respects the 65-second minimum interval',result.requests.every((request,index)=>index===0||request.at-result.requests[index-1].at>=65000),result.requests.map(request=>request.at));
  check(name+': no real OpenAI or unmocked assistant/director endpoint was attempted',result.blocked.length===0,result.blocked);
  check(name+': no JavaScript or local asset errors',result.errors.length===0&&result.responses.length===0,{errors:result.errors,responses:result.responses});
  check(name+': mobile and desktop UI add no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  result.final=await read(page);
 }catch(error){result.error=String(error.stack||error);check(name+': native V23 fixture execution',false,{error:String(error.message||error)});if(page)try{await screenshot(page,name+'-failure');result.failureSnapshot=await read(page);}catch{}}
 finally{if(page)try{await page.evaluate(()=>{globalThis.__v23TraceRunning=false;});result.trace=await page.evaluate(()=>globalThis.__v23Trace);}catch{};await context.close();report.profiles.push(result);}
}
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')});report.browserVersion=browser.version();
 for(const [name,options]of [['desktop',{viewport:{width:1280,height:900},deviceScaleFactor:1}],['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}]])if(!process.env.M_WORLD_V23_PROFILE||process.env.M_WORLD_V23_PROFILE===name)await runProfile(browser,name,options);
}catch(error){report.error=String(error.stack||error);check('Native Chrome launch',false,{error:String(error.message||error)});}
finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);writeFileSync(path.join(out,'v23-browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,browserVersion:report.browserVersion,checks:report.checks.length,failed:report.checks.filter(item=>!item.passed),out}));if(!report.passed)process.exitCode=1;}
