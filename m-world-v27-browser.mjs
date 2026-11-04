/** Native whole-app V27 evidence. Initial observations never command M. */
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
let chromium;for(const id of[process.env.PLAYWRIGHT_MODULE,'playwright-core','playwright',path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){
 try{({chromium}=require(id));break;}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
}
if(!chromium)throw Error('Install Playwright or provide PLAYWRIGHT_MODULE.');
const chrome=process.env.CHROME_BIN||[path.join(homedir(),'AppData/Local/Google/Chrome/Application/chrome.exe'),'/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if(!chrome)throw Error('Installed native Chrome is required.');
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4186/');
if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname))throw Error('Only an isolated loopback site is allowed.');
const out=process.env.M_WORLD_V27_ARTIFACT_DIR||process.env.M_WORLD_ARTIFACT_DIR||path.join(tmpdir(),'m-world-v27');mkdirSync(out,{recursive:true});
const selected=process.env.M_WORLD_V27_PROFILE||'',scope=process.env.M_WORLD_V27_SCOPE||'all';
if(selected&&!['desktop','mobile'].includes(selected))throw Error('Unknown profile.');
if(!['all','diagnostic','interaction'].includes(scope))throw Error('Unknown scope.');
const observeMs=Math.max(60000,Math.min(210000,Number(process.env.M_WORLD_V27_OBSERVE_MS)||160000));
const longReply=('I live among the little lights and quiet corners of this portfolio. I can explore on my own and pause while you read. This is a deliberately long offline interface fixture, not an AI answer.\n\n').repeat(5).slice(0,700);
const report={startedAt:new Date().toISOString(),url:base.href,scope,profiles:[],checks:[],errors:[],assetErrors:[],artifacts:[],network:{mockHealth:0,mockChat:0,blockedPaid:0,blockedBackend:[]},passed:false,
 evidenceScope:'Installed native Chrome, original WebGL actor, native RAF. Initial natural observations contain no M action/pose/route/progress/clock injection or user input. Later diagnostics explicitly request public gestures and use the public Floating ball control. Chat is a labelled 700-character offline fixture; no real AI calls.',
 limitations:['Mobile is emulated Chrome, not a physical phone or Safari.','Observed random actions are reported separately from diagnostic actions; missing random choices are not asserted as successes.','Numeric geometry and FPS do not establish artistic approval.']};
const save=(name,value)=>{const file=path.join(out,name);writeFileSync(file,JSON.stringify(value,null,2)+'\n');return file;};
const check=(name,passed,details)=>{report.checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});console.log(JSON.stringify({check:name,passed:Boolean(passed)}));};
const capture=async(page,name)=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});report.artifacts.push(file);return file;};
function installNetwork(context){return context.route('**/*',route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.pathname==='/health'){report.network.mockHealth++;return route.fulfill({contentType:'application/json',body:JSON.stringify({configured:true,director:{version:1,enabled:false},contextualChat:{version:1},character:{version:1}})});}
 if(/\/api\/m\/respond$/u.test(url.pathname)){report.network.mockChat++;return route.fulfill({contentType:'application/json',body:JSON.stringify({reply:longReply,expression:'neutral',gesture:'none',section:'none'})});}
 if(/\/api\/m\/direct$/u.test(url.pathname)||/(^|\.)openai\.com$/u.test(url.hostname)){report.network.blockedPaid++;return route.abort();}
 if(url.hostname.endsWith('.workers.dev')||(['fetch','xhr','websocket'].includes(request.resourceType())&&url.origin!==base.origin)){report.network.blockedBackend.push(url.href);return route.abort();}
 return route.continue();
});}
async function read(page){return page.evaluate(()=>{
 const s=MWorld.snapshot(),canvas=document.querySelector('.m-world-canvas'),c=canvas.getBoundingClientRect(),f=s.metrics.neutralFootprint||s.metrics.footprint,scale=c.width/s.metrics.size;
 const body={left:c.left+f.left*scale,right:c.left+f.right*scale,top:c.top+f.top*scale,bottom:c.top+f.bottom*scale};
 const area=Math.max(1,(body.right-body.left)*(body.bottom-body.top));
 const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 const viewportShare=overlap(body,{left:0,right:innerWidth,top:0,bottom:innerHeight})/area;
 const ball=document.querySelector('.m-play-ball'),b=ball?.getBoundingClientRect();
 return {snapshot:s,body,viewportShare,protectedShare:Math.min(1,s.protectedRects.reduce((n,r)=>n+overlap(body,r),0)/area),
  ball:{visible:Boolean(ball&&!ball.hidden&&b.width>0),rect:b?{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}:null},
  overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),filter:getComputedStyle(canvas).filter,inputs:globalThis.__v27Inputs||0};
});}
async function beginTrace(page){await page.evaluate(()=>{
 window.__v27Trace=[];window.__v27TraceActive=true;let previous=-Infinity;
 const tick=now=>{if(!window.__v27TraceActive)return;
  if(now-previous>=90&&window.MWorld){const s=MWorld.snapshot(),g=s.character.game,a=s.character.autonomy,el=document.querySelector('.m-play-ball');
   window.__v27Trace.push({at:now,x:s.state.x,y:s.state.y,depth:s.state.depth,mode:s.state.mode,phase:s.state.phase,gesture:s.renderer.gesture,blink:s.renderer.blink,affect:s.renderer.affect,
    game:g?{id:g.id,name:g.name,autonomous:g.autonomous,score:g.score,side:g.side,contacted:g.contacted,ballPoint:g.ballPoint,flight:g.flight}:null,
    ballVisible:Boolean(el&&!el.hidden),story:{beat:s.character.story.beat,goal:s.character.story.goal},autonomy:{current:a.current,active:a.active,accepted:a.accepted,completed:a.completed,failed:a.failed,events:a.events,execution:a.execution},frames:s.stats.frames,cpuMs:s.stats.lastFrameMs,inputs:window.__v27Inputs||0});previous=now;
  }requestAnimationFrame(tick);
 };requestAnimationFrame(tick);
});}
async function endTrace(page,name){const rows=await page.evaluate(()=>{window.__v27TraceActive=false;return window.__v27Trace;});const file=save(name+'-trace.json',rows);report.artifacts.push(file);return rows;}
async function cadence(page){return page.evaluate(async()=>{
 const start=performance.now(),before=MWorld.snapshot().stats.frames,cpu=[],raf=[];let previous=start;
 while(performance.now()-start<4000){await new Promise(requestAnimationFrame);const now=performance.now(),s=MWorld.snapshot();cpu.push(s.stats.lastFrameMs);raf.push(now-previous);previous=now;}
 const p95=list=>[...list].sort((a,b)=>a-b)[Math.floor(list.length*.95)],wallMs=performance.now()-start,frames=MWorld.snapshot().stats.frames-before;
 return {wallMs,frames,fps:frames*1000/wallMs,cpuP95:p95(cpu),rafP95:p95(raf),heapBytes:performance.memory?.usedJSHeapSize,scope:'Actual warm drawing, without video recording or a fake clock.'};
});}
function summarize(rows){
 const events=new Map();for(const row of rows)for(const e of row.autonomy.events||[])events.set(e.id+':'+e.status,e);
 const gestures=[...new Set(rows.map(row=>row.gesture.name).filter(Boolean))],balls=new Map();
 for(const row of rows)if(row.game?.name==='ball'){const g=row.game;const existing=balls.get(g.id)||{id:g.id,autonomous:g.autonomous,scores:[],visibleSamples:0};
  if(!existing.scores.includes(g.score))existing.scores.push(g.score);if(row.ballVisible)existing.visibleSamples++;balls.set(g.id,existing);}
 return {rows:rows.length,inputs:Math.max(0,...rows.map(row=>row.inputs)),gestures,selected:[...events.values()].filter(e=>e.status==='accepted'),completed:[...events.values()].filter(e=>e.status==='complete'),failed:[...events.values()].filter(e=>['failed','cancelled'].includes(e.status)),balls:[...balls.values()],sleepClosed:rows.some(r=>r.gesture.name==='sleep'&&r.blink.leftClosure>.95&&r.blink.rightClosure>.95),hopMaxLift:Math.max(0,...rows.filter(r=>r.gesture.name==='hop').map(r=>r.gesture.lift||0)),missingNatural:['sleep','hop','think','paw'].filter(name=>!gestures.includes(name))};
}
async function natural(page,name){
 await beginTrace(page);const start=Date.now(),captures={};
 while(Date.now()-start<observeMs){
  await page.waitForTimeout(350);const value=await read(page),g=value.snapshot.renderer.gesture;
  let label=null;
  if(g.name==='sleep'&&value.snapshot.renderer.blink.leftClosure>.95)label='sleep-closed';
  else if(g.name==='hop'&&g.lift>.12)label='hop-apex';
  else if(value.ball.visible&&value.snapshot.character.game?.contacted)label='ball-flight';
  if(label&&!captures[label])captures[label]=await capture(page,name+'-natural-'+label);
 }
 const rows=await endTrace(page,name+'-natural'),summary=summarize(rows);summary.wallMs=Date.now()-start;summary.captures=captures;summary.final=await read(page);
 check(name+': initial natural observation had no user or M control commands',summary.inputs===0,{inputs:summary.inputs,wallMs:summary.wallMs});
 check(name+': independent local activity actually completed',summary.completed.length>0,{selected:summary.selected,completed:summary.completed,failed:summary.failed});
 console.log(JSON.stringify({natural:name,gestures:summary.gestures,completed:summary.completed.map(e=>e.reason),balls:summary.balls,missingNatural:summary.missingNatural}));return summary;
}
async function gesture(page,name,profile){
 const accepted=await page.evaluate(name=>MWorld.playGesture(name,{source:'visitor'}),name),start=Date.now();let began=false,peak=null,file=null;
 await beginTrace(page);
 while(Date.now()-start<25000){
  const value=await read(page),g=value.snapshot.renderer.gesture;
  if(g.name===name&&g.envelope>0){began=true;if(!peak||(name==='hop'?g.lift>peak.snapshot.renderer.gesture.lift:g.envelope>peak.snapshot.renderer.gesture.envelope))peak=value;
   if(!file&&((name==='sleep'&&value.snapshot.renderer.blink.leftClosure>.98&&value.snapshot.renderer.blink.rightClosure>.98)||(name==='hop'&&g.lift>.13)||(name==='think'&&g.envelope>.9)))file=await capture(page,profile+'-diagnostic-'+name);
  }else if(began)break;
  await page.waitForTimeout(70);
 }
 const rows=await endTrace(page,profile+'-diagnostic-'+name),summary=summarize(rows);
 const performed=began&&(name==='sleep'?summary.sleepClosed:name==='hop'?summary.hopMaxLift>.13:rows.some(r=>r.gesture.name===name&&r.gesture.envelope>.8));
 check(profile+': diagnostic '+name+' is actually rendered',accepted&&performed,{accepted,began,sleepClosed:summary.sleepClosed,maxLift:summary.hopMaxLift,screenshot:file});
 if(peak)check(profile+': diagnostic '+name+' keeps full body clear and framed',peak.viewportShare>.985&&peak.protectedShare<.01,{viewportShare:peak.viewportShare,protectedShare:peak.protectedShare});
 return {accepted,began,summary,peak,screenshot:file};
}
async function startBall(page){
 const toggle=page.locator('.m-companion-toggle');
 if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
 await page.waitForFunction(()=>!MWorld.snapshot().state.gesture&&!MWorld.snapshot().state.expressionHold&&!MWorld.snapshot().pendingIntent,undefined,{timeout:18000});
 const details=page.locator('.m-companion-character');if(!await details.evaluate(el=>el.open))await details.locator('summary').click();
 await page.getByRole('button',{name:'Floating ball',exact:true}).click();
 await page.waitForTimeout(150);return read(page);
}
async function recordStart(page,name){
 if(process.env.M_WORLD_V27_RECORD==='0')return null;
 const session=await page.context().newCDPSession(page),directory=path.join(out,name+'-frames');mkdirSync(directory,{recursive:true});const frames=[];
 session.on('Page.screencastFrame',event=>{const file=path.join(directory,'frame-'+String(frames.length).padStart(6,'0')+'.jpg');writeFileSync(file,Buffer.from(event.data,'base64'));frames.push({file,timestamp:event.metadata.timestamp});void session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});
 await session.send('Page.startScreencast',{format:'jpeg',quality:72,everyNthFrame:2});return {session,frames,directory,name};
}
async function recordStop(recording){
 if(!recording)return null;await recording.session.send('Page.stopScreencast');await recording.session.detach();
 const frames=recording.frames;save(recording.name+'-frames.json',frames);
 const encoder=process.env.FFMPEG_BIN||[path.join(homedir(),'AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe'),'/usr/bin/ffmpeg'].find(existsSync);
 if(!encoder||frames.length<3)return {frames:frames.length,video:null,reason:'Encoder unavailable or too few captured frames.'};
 const seconds=frames.at(-1).timestamp-frames[0].timestamp,fps=(frames.length-1)/seconds,file=path.join(out,recording.name+'.webm');
 // Playwright's bundled encoder supports image2pipe, not the image2 pattern
 // demuxer. A JPEG stream also works with a standard system ffmpeg build.
 const input=Buffer.concat(frames.map(frame=>readFileSync(frame.file)));
 const result=spawnSync(encoder,['-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','pipe:0','-c:v','libvpx','-b:v','1500k','-crf','24','-pix_fmt','yuv420p',file],{input,encoding:'utf8',timeout:60000,windowsHide:true});
 if(result.status!==0)return {frames:frames.length,video:null,error:String(result.stderr).slice(-1600)};
 report.artifacts.push(file);return {frames:frames.length,sourceSeconds:seconds,encodedFPS:fps,video:file,scope:'Real CDP frames at average source cadence; source timestamps retained. Not a performance benchmark.'};
}
async function ballCycle(page,profile){
 const initial=await startBall(page),recording=profile==='desktop'?await recordStart(page,profile+'-diagnostic-floating-ball'):null;
 await beginTrace(page);let active=Boolean(initial.snapshot.character.game?.name==='ball'),peak=null,contactFile=null,flightFile=null;const start=Date.now();
 while(Date.now()-start<23000){const value=await read(page),g=value.snapshot.character.game;
  if(g?.name==='ball'){active=true;if(value.ball.visible){peak=value;
    if(!contactFile&&value.snapshot.renderer.gesture.contact>.8)contactFile=await capture(page,profile+'-diagnostic-paw-contact');
    if(!flightFile&&g.contacted&&value.snapshot.renderer.gesture.age>1.85)flightFile=await capture(page,profile+'-diagnostic-ball-flight');
   }
  }else if(active)break;
  await page.waitForTimeout(50);
 }
 const rows=await endTrace(page,profile+'-diagnostic-ball'),video=await recordStop(recording),summary=summarize(rows),games=summary.balls;
 const maxScore=Math.max(0,...games.flatMap(g=>g.scores));
 check(profile+': diagnostic floating ball executes three real paw contacts',active&&maxScore===3&&games.some(g=>g.visibleSamples>15),{maxScore,games,contactFile,flightFile,video});
 const visible=rows.filter(r=>r.game?.name==='ball'&&r.game.score>0&&r.game.score<3),missing=visible.filter(r=>!r.ballVisible);
 check(profile+': ball stays visible between observed rallies',visible.length>0&&missing.length===0,{samples:visible.length,missing:missing.map(r=>({at:r.at,score:r.game.score,gesture:r.gesture}))});
 if(peak)check(profile+': ball and original full actor stay clear of text',peak.viewportShare>.985&&peak.protectedShare<.01&&peak.ball.rect.left>=0&&peak.ball.rect.right<=(profile==='mobile'?390:1280),{viewportShare:peak.viewportShare,protectedShare:peak.protectedShare,ball:peak.ball});
 return {summary,video,peak,contactFile,flightFile};
}
async function interruptAndUI(page,profile){
 const before=await startBall(page);await page.waitForFunction(()=>MWorld.snapshot().character.game?.name==='ball'&&!document.querySelector('.m-play-ball').hidden,undefined,{timeout:15000});
 await page.locator('.m-companion-toggle').click();const input=page.locator('#m-companion-message');await input.fill('Unsent cancellation fixture');await page.waitForTimeout(400);
 const typing=await read(page);check(profile+': focusing and typing cancels the ball and its owned motion',before.snapshot.character.game?.name==='ball'&&typing.snapshot.character.game===null&&!typing.ball.visible&&typing.snapshot.character.autonomy.execution===null,{game:typing.snapshot.character.game,gesture:typing.snapshot.state.gesture,ball:typing.ball});
 await input.fill('Please show the offline long-reply fixture.');await input.press('Enter');await page.waitForFunction(()=>document.querySelector('.m-companion-message.assistant:last-child')?.textContent.length===700);await page.waitForTimeout(300);
 const ui=await page.evaluate(()=>{
  const panel=document.querySelector('.m-companion'),body=document.querySelector('.m-companion-body'),log=document.querySelector('.m-companion-log'),form=document.querySelector('.m-companion-form'),input=form.querySelector('textarea'),send=form.querySelector('.m-companion-send');
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},p=rect(panel),b=rect(body),l=rect(log),f=rect(form),hit=el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===el;};
  return {panel:p,log:l,form:f,visibleLog:Math.max(0,Math.min(b.bottom,l.bottom)-Math.max(b.top,l.top)),length:log.querySelector('.assistant:last-child')?.textContent.length,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),horizontal:[panel,body,log,form,input,...log.children].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className),inputHit:hit(input),sendHit:hit(send),actor:MWorld.snapshot().renderer.bones};
 });
 check(profile+': full-app long reply remains readable with M loaded',ui.length===700&&ui.visibleLog>=140&&ui.log.height>=150&&ui.actor===31,ui);
 check(profile+': long reply keeps composer clickable and has no horizontal overflow',ui.inputHit&&ui.sendHit&&ui.overflow<=1&&ui.horizontal.length===0,ui);
 const screenshot=await capture(page,profile+'-whole-app-long-reply');
 const beforeReduced=await startBall(page);await page.waitForFunction(()=>MWorld.snapshot().character.game?.name==='ball'&&!document.querySelector('.m-play-ball').hidden,undefined,{timeout:15000});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(450);const reduced=await read(page);
 check(profile+': reduced motion hides ball and releases the gesture and owner',beforeReduced.snapshot.character.game?.name==='ball'&&reduced.snapshot.preferences.reducedMotion&&reduced.snapshot.character.game===null&&!reduced.ball.visible&&reduced.snapshot.state.gesture===null&&reduced.snapshot.character.autonomy.execution===null&&reduced.snapshot.renderer.gesture.lift===0,{preferences:reduced.snapshot.preferences,game:reduced.snapshot.character.game,gesture:reduced.snapshot.state.gesture,ball:reduced.ball});
 return {typing,ui,screenshot,reduced};
}
async function profile(name){
 const mobile=name==='mobile',result={name,scope:scope==='all'&&!mobile?'natural-then-explicit-diagnostics':'explicit-diagnostics',passed:false};report.profiles.push(result);let browser,page;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-first-run','--no-default-browser-check']});report.browserVersion=browser.version();
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',reducedMotion:'no-preference'});
  await installNetwork(context);await context.addInitScript(()=>{window.__v27Inputs=0;for(const type of['click','keydown','pointermove','touchstart','wheel'])document.addEventListener(type,()=>window.__v27Inputs++,{passive:true});});
  page=await context.newPage();page.on('pageerror',error=>report.errors.push({profile:name,error:String(error),stack:error.stack}));
  page.on('response',response=>{if(response.url().startsWith(base.origin)&&response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.assetErrors.push({profile:name,status:response.status(),url:response.url()});});
  const url=new URL(base);url.searchParams.set('m-debug','1');await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>MWorld?.snapshot().ready,undefined,{timeout:90000});await page.evaluate(()=>document.fonts.ready);
  result.original=await read(page);const r=result.original.snapshot.renderer;
  check(name+': original Meshy rig, full skinning, textures and clips remain intact',r.bones===31&&r.tailBones===10&&r.maxInfluences===14&&r.skinSets===4&&r.detailMaps===10&&r.clips.length===6,{bones:r.bones,tail:r.tailBones,maxInfluences:r.maxInfluences,sets:r.skinSets,maps:r.detailMaps,clips:r.clips});
  check(name+': canvas is sharp and shaders are clean',result.original.filter==='none'&&r.shaderErrors.length===0,{filter:result.original.filter,pixels:r.renderPixels,shaderErrors:r.shaderErrors});
  result.cadence=await cadence(page);check(name+': native warm drawing stays within desktop budget',result.cadence.fps>=40,result.cadence);
  if(scope==='all'&&!mobile)result.natural=await natural(page,name);
  if(scope!=='interaction'){
   result.gestures={};for(const gestureName of['sleep','hop','think'])result.gestures[gestureName]=await gesture(page,gestureName,name);
   result.ball=await ballCycle(page,name);
  }
  result.ui=await interruptAndUI(page,name);
  result.final=await read(page);check(name+': full-app diagnostics preserve rig and page layout',result.final.snapshot.renderer.bones===31&&result.final.snapshot.renderer.shaderErrors.length===0&&result.final.overflow<=1);
 }catch(error){report.errors.push({profile:name,error:String(error),stack:error.stack});check(name+': native harness completed without technical failure',false,String(error));if(page)try{await capture(page,name+'-technical-failure');}catch{}}
 finally{if(browser)await browser.close();result.passed=report.checks.filter(c=>c.name.startsWith(name+':')).every(c=>c.passed);save(name+'-report.json',result);}
}
try{
 const response=await fetch(base,{method:'HEAD'});if(!response.ok)throw Error('The local server is unavailable: '+response.status);
 for(const name of['desktop','mobile'].filter(name=>!selected||name===selected))await profile(name);
 check('no paid provider or external backend request was allowed',report.network.blockedPaid===0&&report.network.blockedBackend.length===0,report.network);
 check('no JavaScript or local asset errors occurred',report.errors.length===0&&report.assetErrors.length===0,{errors:report.errors,assetErrors:report.assetErrors});
}finally{
 report.completedAt=new Date().toISOString();report.passed=report.checks.length>0&&report.checks.every(c=>c.passed);save('report.json',report);
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed).map(c=>c.name),out}));
}
if(!report.passed)process.exitCode=1;
