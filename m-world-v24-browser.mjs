/** V24 browser QA: actual original V6 renderer/routes; all provider responses are mocked. */
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {getContextComponent} from './m-world-context.mjs';
import {validateDirectorInput,validateDirectorReply} from './m-world-director-protocol.mjs';
const require=createRequire(import.meta.url);
function loadDriver(){
 const candidates=[process.env.PLAYWRIGHT_MODULE,'playwright-core','playwright',path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
 for(const candidate of candidates)try{return require(candidate);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
 throw new Error('Install playwright-core or set PLAYWRIGHT_MODULE to an available browser driver.');
}
function chromeExecutable(){
 if(process.env.CHROME_BIN){if(!existsSync(process.env.CHROME_BIN))throw new Error('CHROME_BIN does not exist: '+process.env.CHROME_BIN);return process.env.CHROME_BIN;}
 const candidates=[process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),process.env.ProgramFiles&&path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),process.env['ProgramFiles(x86)']&&path.join(process.env['ProgramFiles(x86)'],'Google/Chrome/Application/chrome.exe'),'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
 const executable=candidates.find(file=>existsSync(file));
 if(!executable)throw new Error('Native Chrome was not found. Set CHROME_BIN to its executable path.');
 return executable;
}
const {chromium}=loadDriver();
const base=process.env.BASE_URL||'http://127.0.0.1:4183/';
const out=process.env.M_WORLD_ARTIFACT_DIR||path.resolve('../work/M_V24_Validation');
const scope=process.env.M_WORLD_V24_SCOPE||'all',onlyProfile=process.env.M_WORLD_V24_PROFILE||'';
const softwareGPU=process.env.M_WORLD_V24_SOFTWARE_GPU==='1';
const runAI=process.env.M_WORLD_V24_AI==='1',record=process.env.M_WORLD_V24_RECORD!=='0';
const memoryKey='m-world-character-memory-v24',quotaKey='m-world-director-session-v1',enabledKey='m-world-director-enabled-v1';
const sentinel='V24_PRIVATE_FORM_VALUE_93741';
const report={url:base,softwareGPU,scope:softwareGPU?'Actual Chrome software-GPU harness. Original V6 load and warm FPS use real draws. Only intermediate raster draws are suppressed during logical native-RAF observations; screenshots re-enable real GPU drawing. This mode is not realtime artistic/FPS validation. All API replies are mocked; no forced clock, pose or arrival.':'Native Chrome and original V6 actor. All director/chat/health replies are explicitly mocked. No real OpenAI call; no forced scene arrival, pose or clock.',gpuCheckpoints:[],checks:[],profiles:[],artifacts:[],manualChecks:[{name:'Physical phone, Safari, real hidden-tab and physical IME',status:'not_verified'}],passed:false};
mkdirSync(out,{recursive:true});
if(softwareGPU)report.manualChecks.push({name:'Realtime artistic/FPS validation in software-GPU observation mode',status:'not_verified',reason:'The warm performance record is unsuppressed. Intermediate raster draws are skipped afterwards; native artistic evidence is a separate run.'});
const check=(name,passed,details)=>report.checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});
const read=page=>page.evaluate(()=>MWorld.snapshot());
function compact(s){return {ready:s.ready,active:s.active,frozen:s.frozen,state:{mode:s.state.mode,phase:s.state.phase,targetId:s.state.targetId,gesture:s.state.gesture,affect:s.state.affect,x:s.state.x,y:s.state.y,depth:s.state.depth},character:s.character,renderer:{gesture:s.renderer?.gesture,affect:s.renderer?.affect,expression:s.renderer?.expression,blink:s.renderer?.blink,bones:s.renderer?.bones,maxInfluences:s.renderer?.maxInfluences,detailMaps:s.renderer?.detailMaps,shaderErrors:s.renderer?.shaderErrors},director:{enabled:s.director?.enabled,source:s.director?.source,attempts:s.director?.attempts,lastExecution:s.director?.lastExecution},stats:s.stats};}
/** Test-only adaptation for slow CI software rasterization; clocks and CPU updates stay real. */
function installSoftwareRasterObserver(){
 const native=HTMLCanvasElement.prototype.getContext,wrapped=new WeakSet();
 globalThis.__v24RasterSuppressed=false;
 globalThis.__v24RasterStats={contexts:0,actualDrawCalls:0,skippedDrawCalls:0};
 HTMLCanvasElement.prototype.getContext=function(...args){
  const gl=native.apply(this,args);
  if(!gl||typeof gl.drawElements!=='function'||wrapped.has(gl))return gl;
  wrapped.add(gl);globalThis.__v24RasterStats.contexts++;
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
   if(typeof gl[name]!=='function')continue;
   const draw=gl[name].bind(gl);
   gl[name]=(...values)=>{
    if(globalThis.__v24RasterSuppressed){globalThis.__v24RasterStats.skippedDrawCalls++;return;}
    globalThis.__v24RasterStats.actualDrawCalls++;return draw(...values);
   };
  }
  return gl;
 };
}
async function shot(page,name){
 const file=path.join(out,name+(softwareGPU?'-software-gpu':'')+'.png');let checkpoint=null;
 try{
  if(softwareGPU)checkpoint=await page.evaluate(async()=>{
   globalThis.__v24RasterSuppressed=false;
   const before=globalThis.__v24RasterStats.actualDrawCalls,active=Boolean(globalThis.MWorld?.snapshot().active);
   // Request a paint through the public controller, without resuming a paused M.
   if(active)MWorld.setActive(true,false);
   await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   return {active,before,...globalThis.__v24RasterStats};
  });
  await page.screenshot({path:file,scale:'css'});report.artifacts.push(file);
  if(softwareGPU){
   const after=await page.evaluate(()=>({...globalThis.__v24RasterStats}));
   report.gpuCheckpoints.push({name,file,active:checkpoint.active,actualDrawCalls:after.actualDrawCalls-checkpoint.before,stats:after});
   if(checkpoint.active&&after.actualDrawCalls<=checkpoint.before)throw new Error('Active M checkpoint produced no actual GPU draw.');
  }
  return file;
 }finally{
  if(softwareGPU)await page.evaluate(()=>{globalThis.__v24RasterSuppressed=true;}).catch(()=>{});
 }
}
async function openPanel(page){if(!await page.locator('.m-companion').isVisible())await page.getByRole('button',{name:'Talk to M',exact:true}).click();}
async function closePanel(page){if(await page.locator('.m-companion').isVisible())await page.getByRole('button',{name:'Close',exact:true}).click();}
async function openTools(page){await openPanel(page);const details=page.locator('.m-companion-character');if(!await details.evaluate(el=>el.open))await details.locator('summary').click();}
async function scrollProjects(page){await closePanel(page);await page.locator('#projects .card').first().scrollIntoViewIfNeeded();await page.waitForTimeout(1600);}
async function readyForAction(page){await page.waitForFunction(()=>{const s=MWorld.snapshot();return !s.state.gesture&&!s.state.expressionHold;},undefined,{timeout:15000});}
async function stopPlay(page){const stop=page.getByRole('button',{name:'Stop play',exact:true});if(await stop.isVisible())await stop.click();}
async function beginTrace(page){
 await page.evaluate(()=>{
  globalThis.__v24Trace=[];globalThis.__v24TraceRunning=true;
  function frame(){
   if(!globalThis.__v24TraceRunning)return;
   if(globalThis.MWorld){const s=MWorld.snapshot();globalThis.__v24Trace.push({at:performance.now(),x:s.state.x,y:s.state.y,depth:s.state.depth,mode:s.state.mode,phase:s.state.phase,scene:s.character?.scene?{id:s.character.scene.id,status:s.character.scene.status,stage:s.character.scene.stage,source:s.character.scene.source,command:s.character.scene.command?.id}:null,game:s.character?.game?{...s.character.game}:null,gesture:s.renderer?.gesture?{...s.renderer.gesture}:null,affect:s.renderer?.affect?{...s.renderer.affect}:null,frames:s.stats.frames});if(globalThis.__v24Trace.length>18000)globalThis.__v24Trace.shift();}
   requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
 });
}
async function startVideo(page){
 if(softwareGPU||!record||!await page.evaluate(()=>Boolean(document.querySelector('.m-world-canvas')?.captureStream&&globalThis.MediaRecorder)))return false;
 await page.evaluate(()=>{
  const stream=document.querySelector('.m-world-canvas').captureStream(30),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});
  globalThis.__v24Video=new Promise(resolve=>{recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=async()=>{stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:'video/webm'}),bytes=new Uint8Array(await blob.arrayBuffer());let base64='';for(let i=0;i<bytes.length;i+=16384)base64+=String.fromCharCode(...bytes.subarray(i,i+16384));resolve({base64:btoa(base64),bytes:bytes.length});};});
  recorder.start();setTimeout(()=>recorder.stop(),5000);
 });return true;
}
async function finishVideo(page,name){
 const video=await page.evaluate(()=>globalThis.__v24Video);
 if(!video||video.bytes<2048){report.manualChecks.push({name:'Usable native canvas recording',status:'not_verified',reason:'Recorder produced no playable data',bytes:video?.bytes??0});return null;}
 const file=path.join(out,name+'.webm');writeFileSync(file,Buffer.from(video.base64,'base64'));
 const decoded=await page.evaluate(async data=>{
  const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'video/webm'})),video=document.createElement('video');video.muted=true;video.src=url;
  try{
   await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error('Video decode failed'));setTimeout(()=>reject(new Error('Video metadata timeout')),8000);});
   await video.play();await new Promise((resolve,reject)=>{video.onended=resolve;video.onerror=()=>reject(new Error('Video playback failed'));setTimeout(()=>reject(new Error('Video playback timeout')),10000);});
   return {width:video.videoWidth,height:video.videoHeight,frames:video.getVideoPlaybackQuality?.().totalVideoFrames??null,ended:video.ended};
  }finally{video.pause();URL.revokeObjectURL(url);}
 },video.base64);
 report.artifacts.push(file);check('desktop: short native canvas video decodes actual frames',decoded.ended&&decoded.frames>1,{file,bytes:video.bytes,...decoded});return {file,bytes:video.bytes,...decoded};
}
async function faces(page,name,profile){
 await openTools(page);
 const selections=name==='desktop'?[['focus','Focused'],['content','Content'],['doubt','Unsure'],['sleepy','Sleepy'],['delight','Delighted']]:[['doubt','Unsure'],['sleepy','Sleepy']];
 profile.affects=[];
 for(const [affect,label]of selections){
  await openTools(page);
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.waitForFunction(affect=>{const a=MWorld.snapshot().renderer.affect;return a?.name===affect&&a.phase==='hold'&&a.envelope>.6;},affect,{timeout:35000});
  if(['doubt','sleepy'].includes(affect))await page.waitForFunction(name=>{const s=MWorld.snapshot(),b=s.renderer.blink;return s.renderer.affect?.name===name&&s.renderer.affect.phase==='hold'&&Math.max(b.leftClosure,b.rightClosure)<.8&&(name==='doubt'?Math.abs(b.leftClosure-b.rightClosure)>.04:Math.min(b.leftClosure,b.rightClosure)>.15);},affect,{timeout:5000});
  const s=await read(page),a=s.renderer.affect,w=a.weights||{},values=Object.values(w).filter(Number.isFinite),blink=s.renderer.blink;
  check(name+': '+label+' uses bounded original morphs',values.length>=3&&values.every(v=>v>=0&&v<=1.00001)&&values.reduce((x,y)=>x+y,0)<=1.00002&&s.renderer.bones===31&&s.renderer.shaderErrors.length===0,{affect:a,blink});
  if(affect==='doubt')check(name+': Unsure has asymmetric eyelid rest',Math.abs((blink.leftClosure??0)-(blink.rightClosure??0))>.04,{left:blink.leftClosure,right:blink.rightClosure});
  if(['doubt','sleepy'].includes(affect))await shot(page,name+'-'+affect+'-original-morphs');
  if(affect==='sleepy'){
   check(name+': Sleepy is a curved partial HAT closure',blink.leftClosure>.15&&blink.leftClosure<.8&&blink.rightClosure>.15&&blink.rightClosure<.8,blink);
   if(name==='desktop'&&await startVideo(page))profile.video=await finishVideo(page,'M_V24_sleepy_recovery');
  }
  profile.affects.push(compact(s));
  await page.waitForFunction(affect=>{const a=MWorld.snapshot().renderer.affect;return a?.name!==affect||['complete','idle'].includes(a?.phase);},affect,{timeout:10000});
 }
 await openTools(page);await page.getByRole('button',{name:'Reset face',exact:true}).click();
 await page.waitForTimeout(350);check(name+': Reset face clears affect ownership',!(await read(page)).state.affect,(await read(page)).renderer.affect);
 await closePanel(page);
}
async function scene(page,name,profile,source='visitor'){
 await scrollProjects(page);await openTools(page);
 const from=await page.evaluate(()=>globalThis.__v24Trace.length);
 await readyForAction(page);await page.getByRole('button',{name:'Explore this card',exact:true}).click();
 await page.waitForFunction(()=>MWorld.snapshot().character?.scene?.status==='playing',undefined,{timeout:10000});
 const started=await read(page),id=started.character.scene.id;profile.sceneStart=compact(started);
 check(name+': optional exploration starts a real scene with known target',source===started.character.scene.source&&Boolean(started.character.scene.targetId),started.character.scene);
 const captured=new Set();
 const until=Date.now()+80000;
 while(Date.now()<until){
  const row=await page.evaluate(()=>{const s=MWorld.snapshot();return {scene:s.character.scene,gesture:s.renderer.gesture};});
  if(row.scene.id===id&&['complete','cancelled'].includes(row.scene.status))break;
  if(!softwareGPU&&row.scene.id===id&&!captured.has(row.scene.stage)&&((row.scene.stage==='travel'&&row.scene.elapsedMs>2000)||(row.scene.stage==='react'&&row.gesture.phase==='action'))){captured.add(row.scene.stage);await shot(page,name+'-scene-'+row.scene.stage);}
  await page.waitForTimeout(250);
 }
 const end=await read(page);profile.sceneEnd=compact(end);
 const trace=await page.evaluate(from=>globalThis.__v24Trace.slice(from),from),rows=trace.filter(x=>x.scene?.id===id),stages=[...new Set(rows.map(x=>x.scene.stage).filter(Boolean))],travel=rows.filter(x=>x.scene.stage==='travel');
 const distance=travel.length?Math.hypot(travel.at(-1).x-travel[0].x,travel.at(-1).y-travel[0].y):0;
 check(name+': scene completes after actual travel and reaction',end.character.scene.status==='complete'&&['look','travel','react','rest'].every(stage=>stages.includes(stage))&&distance>8,{stages,distance,status:end.character.scene.status,reason:end.character.scene.reason});
 check(name+': scene has no forced pose or clock',!end.frozen&&end.stats.frames>started.stats.frames+20,{before:started.stats.frames,after:end.stats.frames});
 await shot(page,name+'-scene-completed');
 profile.sceneTrace=rows;
}
async function games(page,name,profile){
 await scrollProjects(page);await openTools(page);await readyForAction(page);await page.getByRole('button',{name:'Find M',exact:true}).click();
 await page.waitForFunction(()=>Boolean(MWorld.snapshot().character?.game),undefined,{timeout:10000});
 check(name+': Find M is visitor initiated and closes chat',!await page.locator('.m-companion').isVisible()&&await page.locator('.m-play-dock').isVisible(),(await read(page)).character.game);
 const found=page.getByRole('button',{name:'I found M',exact:true});
 await page.waitForFunction(()=>{const g=MWorld.snapshot().character.game;return g?.name==='hide'&&g.searchUntil>performance.now();},undefined,{timeout:35000});
 await found.waitFor({state:'visible',timeout:5000});await shot(page,name+'-find-m');
 await found.click();
 await page.waitForTimeout(300);profile.hide=compact(await read(page));
 await stopPlay(page);
 check(name+': Stop play dismisses the optional dock',!await page.locator('.m-play-dock').isVisible(),(await read(page)).character.game);
 await openTools(page);await readyForAction(page);await page.getByRole('button',{name:'Follow a light',exact:true}).click();
 await page.waitForFunction(()=>Boolean(MWorld.snapshot().character?.game),undefined,{timeout:10000});
 const light=page.locator('.m-play-light'),before=await read(page);
 check(name+': light prop cannot intercept page clicks',await light.isVisible()&&await light.evaluate(el=>getComputedStyle(el).pointerEvents==='none'));
 const lightTraceFrom=await page.evaluate(()=>globalThis.__v24Trace.length);
 const scoreBefore=before.character.game.score;
 await page.getByRole('button',{name:'Move light',exact:true}).click();
 check(name+': moving the light does not award an arrival',(await read(page)).character.game?.score===scoreBefore);
 await page.waitForTimeout(1200);profile.light=compact(await read(page));await shot(page,name+'-follow-light');
 check(name+': light pursuit keeps actual body moving',profile.light.stats.frames>before.stats.frames&&!profile.light.frozen,{before:before.state,after:profile.light.state});
 await page.waitForFunction(()=>!MWorld.snapshot().character.game,undefined,{timeout:50000});
 const lightEnd=await read(page),lightTrace=await page.evaluate(index=>globalThis.__v24Trace.slice(index),lightTraceFrom),lightRows=lightTrace.filter(row=>row.game?.name==='light'),scores=[...new Set(lightRows.map(row=>row.game.score))];
 const arrivals=[0,1,2].map(score=>Math.min(...lightRows.filter(row=>row.game.score===score&&row.game.goal).map(row=>Math.hypot(row.x-row.game.goal.x,row.y-row.game.goal.y))));
 check(name+': three light targets require physical arrivals',scores.includes(0)&&scores.includes(1)&&scores.includes(2)&&arrivals.every(distance=>distance<12)&&!lightEnd.character.game,{scores,minimumDistances:arrivals,lastGesture:lightEnd.renderer.gesture});
 profile.lightTrace=lightRows;
 await stopPlay(page);
 await openTools(page);await readyForAction(page);await page.getByRole('button',{name:'Follow a light',exact:true}).click();
 await page.getByRole('button',{name:'Pause M',exact:true}).click();await page.waitForTimeout(250);
 check(name+': pausing M cancels optional play',!await page.locator('.m-play-dock').isVisible()&&!(await read(page)).active,(await read(page)).character.game);
 await page.getByRole('button',{name:'Resume M',exact:true}).click();
}
async function contextualChat(page,name,profile){
 await scrollProjects(page);await page.locator('#projects .card').first().hover();await openPanel(page);
 const row=page.locator('.m-companion-context');
 await row.waitFor({state:'visible',timeout:5000});const label=await row.innerText();
 const count=profile.chats.length;
 await page.getByRole('button',{name:'Explain this card',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.m-companion-log')?.textContent.includes('V24 contextual fixture answer.'),undefined,{timeout:10000});
 const call=profile.chats[count],context=call?.context;
 check(name+': Explain this card sends one stable public component',profile.chats.length===count+1&&Boolean(getContextComponent(context?.component))&&Object.keys(context).sort().join(',')==='component,language,section'&&!JSON.stringify(call).includes(sentinel),{label,call});
 const input=page.getByLabel('Message M',{exact:true});await input.fill('Keyboard check');await input.press('Shift+Enter');
 check(name+': Shift Enter retains newline',await input.inputValue()==='Keyboard check\n');
 await input.press('Enter');await page.waitForFunction(()=>document.querySelectorAll('.m-companion-message.assistant').length>=2,undefined,{timeout:10000});
 check(name+': Enter submits once without losing contextual metadata',profile.chats.length===count+2&&profile.chats.at(-1).message==='Keyboard check'&&Boolean(getContextComponent(profile.chats.at(-1).context.component)),profile.chats.at(-1));
 await shot(page,name+'-contextual-chat');await closePanel(page);
}
async function memory(page,name,profile){
 const before=await page.evaluate(({memoryKey,quotaKey})=>({memory:JSON.parse(sessionStorage.getItem(memoryKey)),quota:sessionStorage.getItem(quotaKey)}),{memoryKey,quotaKey});
 check(name+': public component memory is bounded without chat values',before.memory?.components.length>0&&before.memory.components.length<=24&&!JSON.stringify(before.memory).includes(sentinel)&&!JSON.stringify(before.memory).includes('Keyboard check'),before.memory);
 await page.reload();await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
 if(softwareGPU)await page.evaluate(()=>{globalThis.__v24RasterSuppressed=true;});
 const after=await page.evaluate(({memoryKey,quotaKey})=>({memory:JSON.parse(sessionStorage.getItem(memoryKey)),quota:sessionStorage.getItem(quotaKey)}),{memoryKey,quotaKey});
 check(name+': reload preserves session familiarity and separate AI accounting',before.memory.components.every(a=>after.memory.components.some(b=>b.id===a.id&&b.visits>=a.visits))&&after.quota===before.quota,{before:before.memory,after:after.memory,quotaUnchanged:before.quota===after.quota});
 await openTools(page);await page.getByRole('button',{name:'Reset character memory',exact:true}).click();
 const reset=await page.evaluate(({memoryKey,quotaKey})=>({memory:sessionStorage.getItem(memoryKey)?JSON.parse(sessionStorage.getItem(memoryKey)):null,quota:sessionStorage.getItem(quotaKey)}),{memoryKey,quotaKey});
 check(name+': clearing character memory never resets AI allowance',reset.quota===after.quota&&(!reset.memory||reset.memory.components.every(item=>item.visits===0)),reset);
 profile.memory={before,after,reset};await closePanel(page);
}
async function motionNeutral(page,name,profile){
 await openTools(page);await readyForAction(page);await page.getByRole('button',{name:'Sleepy',exact:true}).click();
 await page.waitForFunction(()=>{const s=MWorld.snapshot();return s.renderer.affect?.name==='sleepy'&&s.renderer.affect.phase==='hold'&&s.renderer.blink.leftClosure>.25;},undefined,{timeout:35000});
 const before=await read(page);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>MWorld.snapshot().preferences.reducedMotion);await page.waitForTimeout(500);
 const after=await read(page),weights=after.renderer.blink.expressionWeights,closure=after.renderer.blink;
 profile.motionNeutral={before:compact(before),after:compact(after)};
 check(name+': reduced motion settles actual facial morphs to neutral',Object.values(weights).every(value=>Math.abs(value)<.001)&&Math.abs(closure.leftClosure)<.001&&Math.abs(closure.rightClosure)<.001,{before:{weights:before.renderer.blink.expressionWeights,left:before.renderer.blink.leftClosure,right:before.renderer.blink.rightClosure,frames:before.stats.frames},after:{weights,left:closure.leftClosure,right:closure.rightClosure,frames:after.stats.frames},preferences:after.preferences});
 check(name+': reduced motion restores front depth and releases surface ownership',after.state.depth===1&&after.state.depthTarget===1&&after.state.targetId===null,{depth:after.state.depth,target:after.state.depthTarget,surface:after.state.targetId});
 await shot(page,name+'-reduced-motion-neutral');
 await page.waitForTimeout(300);const stopped=await read(page);check(name+': reduced motion leaves actual pose and face stationary',Math.hypot(stopped.state.x-after.state.x,stopped.state.y-after.state.y)<.001&&Math.abs(stopped.renderer.blink.leftClosure)<.001&&Math.abs(stopped.renderer.blink.rightClosure)<.001&&Object.values(stopped.renderer.blink.expressionWeights).every(value=>Math.abs(value)<.001),{afterFrame:after.stats.frames,stoppedFrame:stopped.stats.frames,positionAfter:{x:after.state.x,y:after.state.y},positionLater:{x:stopped.state.x,y:stopped.state.y},staticRedrawsPermitted:true});
 await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>!MWorld.snapshot().preferences.reducedMotion);
}
async function touchControls(page,profile){
 await closePanel(page);
 await page.evaluate(()=>{globalThis.__v24TouchCount=0;document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')globalThis.__v24TouchCount++;});});
 await page.getByRole('button',{name:'Talk to M',exact:true}).tap();
 const details=page.locator('.m-companion-character');if(!await details.evaluate(el=>el.open))await details.locator('summary').tap();
 await readyForAction(page);
 await page.getByRole('button',{name:'Follow a light',exact:true}).tap();
 await page.waitForFunction(()=>MWorld.snapshot().character.game?.name==='light',undefined,{timeout:5000});
 await page.getByRole('button',{name:'Stop play',exact:true}).tap();
 const touches=await page.evaluate(()=>globalThis.__v24TouchCount);
 check('mobile: play controls respond to actual touch events',touches>=3&&!await page.locator('.m-play-dock').isVisible(),{touchPointerEvents:touches,game:(await read(page)).character.game});
 profile.touch={touchPointerEvents:touches};
}
async function automaticScene(page,name,profile){
 if(name!=='desktop'||!runAI)return;
 await scrollProjects(page);await openPanel(page);await page.getByRole('button',{name:'Enable AI play',exact:true}).click();await closePanel(page);
 await page.waitForFunction(()=>MWorld.snapshot().director.source==='openai',undefined,{timeout:35000});
 const first=profile.decisions[0];check('desktop: mocked AI suggests one real offered action',profile.decisions.length===1&&validateDirectorInput(first.input)&&validateDirectorReply(first.reply,first.input),first);
 await page.waitForFunction(()=>{const s=MWorld.snapshot().character.scene;return s.source==='director'&&['complete','cancelled'].includes(s.status);},undefined,{timeout:80000});
 const end=await read(page);profile.automatic=compact(end);check('desktop: AI intent expands into a completed local scene',end.character.scene.status==='complete',end.character.scene);
 await openPanel(page);const pause=page.getByRole('button',{name:'Pause AI play',exact:true});if(await pause.count())await pause.click();await closePanel(page);
 check('desktop: no extra API calls are needed for scene steps',profile.decisions.length===1,{decisions:profile.decisions.length});
}
async function profile(browser,name,options){
 const context=await browser.newContext({...options,reducedMotion:'no-preference'}),result={name,softwareGPU,errors:[],assetErrors:[],blocked:[],chats:[],decisions:[],health:0};
 if(softwareGPU)await context.addInitScript(installSoftwareRasterObserver);
 await context.addInitScript(({enabledKey,quotaKey,sentinel})=>{
  if(sessionStorage.getItem(enabledKey)===null)sessionStorage.setItem(enabledKey,'false');
  if(sessionStorage.getItem(quotaKey)===null)sessionStorage.setItem(quotaKey,JSON.stringify({attempts:2,lastAt:Date.now()-120000,contexts:[]}));
  document.addEventListener('DOMContentLoaded',()=>{const input=document.createElement('textarea');input.hidden=true;input.value=sentinel;input.id='v24-private-fixture';document.body.append(input);});
 },{enabledKey,quotaKey,sentinel});
 const headers={'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 await context.route('**/*',async route=>{
  const req=route.request(),url=req.url(),pathname=new URL(url).pathname;
  if(/\/health$/u.test(pathname)&&url.includes('m-portfolio-companion')){result.health++;return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({configured:true,director:{version:1,enabled:true},contextualChat:{version:1}})});}
  if(/\/api\/m\/(?:respond|direct)$/u.test(pathname)){
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const input=JSON.parse(req.postData()||'null');
   if(pathname.endsWith('/respond')){result.chats.push(input);return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({reply:'V24 contextual fixture answer.',expression:'neutral',gesture:'none',section:'none'})});}
   if(runAI&&name==='desktop'&&result.decisions.length===0){const target=input.snapshot.targets.find(t=>t.actions.includes('peek'))||input.snapshot.targets[0];const reply={snapshot:input.snapshot.revision,targetId:target?.id??null,action:target?(target.actions.includes('peek')?'peek':'inspect'):'rest',gesture:'curious',expression:'curious'};result.decisions.push({input,reply,at:Date.now()});return route.fulfill({headers,contentType:'application/json',body:JSON.stringify(reply)});}
   result.blocked.push({url,method:req.method()});return route.abort('blockedbyclient');
  }
  if(/api\.openai\.com/u.test(url)){result.blocked.push({url,method:req.method()});return route.abort('blockedbyclient');}
  return route.continue();
 });
 let page;
 try{
  page=await context.newPage();page.on('pageerror',error=>result.errors.push(String(error)));page.on('response',response=>{if(response.status()>=400&&response.url().startsWith(new URL(base).origin))result.assetErrors.push({url:response.url(),status:response.status()});});
  const url=new URL(base);url.searchParams.set('m-debug','1');await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});await beginTrace(page);
  const initial=await read(page);result.initial=compact(initial);
  check(name+': v29 entry point',await page.locator('script[src*="scroll-buddy.js?v=30"]').count()===1);
  check(name+': unchanged original actor and full skinning',initial.renderer.bones===31&&initial.renderer.tailBones===10&&initial.renderer.maxInfluences===14&&initial.renderer.skinSets===4&&initial.renderer.detailMaps===10&&initial.renderer.clips.length===6&&initial.renderer.shaderErrors.length===0,{bones:initial.renderer.bones,tail:initial.renderer.tailBones,maxInfluences:initial.renderer.maxInfluences,skinSets:initial.renderer.skinSets,maps:initial.renderer.detailMaps,clips:initial.renderer.clips});
  check(name+': native sharp framebuffer remains bounded',initial.renderer.renderPixels.every(n=>n===(name==='desktop'?544:416))&&await page.locator('.m-world-canvas').evaluate(el=>getComputedStyle(el).filter==='none'),initial.renderer.renderPixels);
  result.performance=await page.evaluate(async()=>{const start=performance.now(),before=MWorld.snapshot().stats.frames,times=[],cpu=[];let last=start;while(performance.now()-start<3000){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);cpu.push(MWorld.snapshot().stats.lastFrameMs);last=now;}const q=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length*.95)];return {fps:(MWorld.snapshot().stats.frames-before)*1000/(performance.now()-start),frameP95:q(times),cpuP95:q(cpu),heap:performance.memory?.usedJSHeapSize};});
  check(name+': actual native render continues',result.performance.fps>0&&result.performance.cpuP95<50,result.performance);
  if(softwareGPU){
   result.unsuppressedWarmRaster=await page.evaluate(()=>({...globalThis.__v24RasterStats,suppressed:globalThis.__v24RasterSuppressed}));
   await page.evaluate(()=>{globalThis.__v24RasterSuppressed=true;});
  }
  if(scope==='motion'||scope==='final')await motionNeutral(page,name,result);
  if(scope==='all'||scope==='faces')await faces(page,name,result);
  if(name==='desktop'&&(scope==='all'||scope==='integration'||scope==='final'||scope==='scene'))await scene(page,name,result);
  if(scope==='all'||scope==='integration'||scope==='games')await games(page,name,result);
  if(scope==='all'||scope==='integration'||scope==='final'||scope==='context')await contextualChat(page,name,result);
  if(scope==='all'||scope==='integration'||scope==='memory')await memory(page,name,result);
  if(scope==='all'||scope==='integration'||scope==='ai')await automaticScene(page,name,result);
  if(name==='mobile'&&['all','integration','games'].includes(scope))await touchControls(page,result);
  check(name+': UI and original portfolio have no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  check(name+': no JS, assets or unmocked API requests failed',result.errors.length===0&&result.assetErrors.length===0&&result.blocked.length===0,{errors:result.errors,assets:result.assetErrors,blocked:result.blocked});
  result.final=compact(await read(page));result.trace=await page.evaluate(()=>globalThis.__v24Trace);
  if(softwareGPU)result.finalRaster=await page.evaluate(()=>({...globalThis.__v24RasterStats,suppressed:globalThis.__v24RasterSuppressed}));
 }catch(error){result.error=String(error.stack||error);check(name+': V24 browser execution',false,{error:String(error.message||error)});if(page)try{await shot(page,name+'-failure');result.failure=compact(await read(page));result.trace=await page.evaluate(()=>globalThis.__v24Trace);}catch{}}
 finally{if(page)try{await page.evaluate(()=>{globalThis.__v24TraceRunning=false;});}catch{}await context.close();report.profiles.push(result);}
}
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:chromeExecutable()});report.browserVersion=browser.version();
 for(const [name,options]of [['desktop',{viewport:{width:1280,height:900},deviceScaleFactor:1}],['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}]])if(!onlyProfile||onlyProfile===name)await profile(browser,name,options);
}catch(error){report.error=String(error.stack||error);check('Chrome launch',false,{error:String(error.message||error)});}
finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);writeFileSync(path.join(out,'v24-browser-report-'+scope+(onlyProfile?'-'+onlyProfile:'')+(softwareGPU?'-software-gpu':'')+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(x=>!x.passed),scope,onlyProfile,softwareGPU,out}));if(!report.passed)process.exitCode=1;}
