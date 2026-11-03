/** Native V26 QA. Observations read M; they never command her story or movement. */
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir,tmpdir} from 'node:os';
import {M_CONTEXT_COMPONENTS} from './m-world-context.mjs';

const require=createRequire(import.meta.url);
function driver(){for(const id of [process.env.PLAYWRIGHT_MODULE,'playwright-core','playwright',path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{return require(id);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}throw new Error('Install Playwright or provide PLAYWRIGHT_MODULE.');}
const {chromium}=driver();
const root=path.dirname(fileURLToPath(import.meta.url));
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:4186/');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw new Error('Only an isolated loopback site is allowed.');
const chrome=process.env.CHROME_BIN||[path.join(homedir(),'AppData/Local/Google/Chrome/Application/chrome.exe'),'/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(file=>existsSync(file));
if(!chrome||!existsSync(chrome))throw new Error('Installed native Chrome not found.');
const out=process.env.M_WORLD_ARTIFACT_DIR||path.join(tmpdir(),'m-world-v26-artifacts');
const only=process.env.M_WORLD_V26_PROFILE||'';
if(only&&!['desktop','mobile'].includes(only))throw new Error('Unknown profile.');
const runId=new Date().toISOString().replace(/[^0-9A-Za-z]/gu,'-');
const profileRoot=path.join(out,'profiles-'+runId);
mkdirSync(profileRoot,{recursive:true});
const keys={state:'m-world-character-v26',backup:'m-world-character-v26-backup',remember:'m-world-character-v26-remember',quota:'m-world-director-session-v1'};
const report={startedAt:new Date().toISOString(),url:base.href,onlyProfile:only||null,checks:[],profiles:[],artifacts:[],errors:[],assetErrors:[],network:{mockedHealth:0,paidAttempts:0,blockedExternalBackend:[]},passed:false,
 scope:'Installed native Chrome; actual RAF, original WebGL and persistent isolated profiles. Initial chapter and reopened revisit observations contain no user input or M action/pose/clock/route/arrival commands. Later UI/accessibility tests are labelled separately. All AI health is mocked offline; paid and external backend requests are intercepted. No story/localStorage progress is injected.',
 limitations:['Mobile is emulated Chrome, not a physical phone.','Safari/iOS, actual IME and OS background-tab behavior are not covered.']};
function check(name,passed,details){const row={name,passed:Boolean(passed),...(details===undefined?{}:{details})};report.checks.push(row);console.log(JSON.stringify({check:name,passed:row.passed}));return row.passed;}
function artifact(file){report.artifacts.push(file);return file;}
function saveJson(file,value){writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function percentile(values){const list=values.filter(Number.isFinite).sort((a,b)=>a-b);return list[Math.min(list.length-1,Math.floor(list.length*.95))]??null;}
const storyFingerprint=story=>JSON.stringify({beat:story?.beat,discovery:story?.discovery,favorite:story?.favorite,journal:story?.journal,visitId:story?.visitId});
const foundedJournal=story=>(story?.journal||[]).filter(e=>e.id==='light-found'||e.id==='lookout-found');
const originOf=url=>{try{return new URL(url).origin;}catch{return '';}};

async function installNetwork(context){
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/health'){
   report.network.mockedHealth++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({configured:false,director:{version:1,enabled:false},contextualChat:{version:1},character:{version:1}})});
  }
  if(/\/api\/(?:m\/)?(?:direct|respond)$/.test(url.pathname)||/(^|\.)openai\.com$/u.test(url.hostname)){
   report.network.paidAttempts++;return route.abort();
  }
  if((url.hostname.endsWith('.workers.dev')||(['fetch','xhr','websocket'].includes(request.resourceType())&&url.origin!==base.origin))){
   report.network.blockedExternalBackend.push({url:url.href,type:request.resourceType()});return route.abort();
  }
  return route.continue();
 });
 await context.addInitScript(()=>{
  globalThis.__v26Inputs=0;
  for(const type of ['click','pointermove','keydown','touchstart','wheel'])document.addEventListener(type,()=>globalThis.__v26Inputs++,{passive:true});
 });
}
async function openProfile(name,userDataDir){
 const mobile=name==='mobile';
 const context=await chromium.launchPersistentContext(userDataDir,{headless:true,executablePath:chrome,viewport:mobile?{width:390,height:844}:{width:1280,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
 await installNetwork(context);
 const page=context.pages()[0]||await context.newPage();
 page.on('pageerror',error=>report.errors.push({profile:name,error:String(error)}));
 page.on('response',response=>{if(originOf(response.url())===base.origin&&response.status()>=400)report.assetErrors.push({profile:name,url:response.url(),status:response.status()});});
 const url=new URL(base);url.searchParams.set('m-debug','1');
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.MWorld?.snapshot().ready,undefined,{timeout:90000});
 await page.evaluate(()=>document.fonts.ready);
 return {context,page};
}
async function read(page){return page.evaluate(storageKeys=>{
 const s=MWorld.snapshot(),canvas=document.querySelector('.m-world-canvas'),r=canvas.getBoundingClientRect(),f=s.metrics.neutralFootprint||s.metrics.footprint,scale=r.width/s.metrics.size;
 const body={left:r.left+f.left*scale,right:r.left+f.right*scale,top:r.top+f.top*scale,bottom:r.top+f.bottom*scale};
 const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
 const area=Math.max(1,(body.right-body.left)*(body.bottom-body.top));
 const clipped=s.protectedRects.map(x=>({left:Math.max(body.left,x.left),right:Math.min(body.right,x.right),top:Math.max(body.top,x.top),bottom:Math.min(body.bottom,x.bottom)})).filter(x=>x.right>x.left&&x.bottom>x.top);
 const xs=[...new Set(clipped.flatMap(x=>[x.left,x.right]))].sort((a,b)=>a-b);let covered=0;
 for(let i=1;i<xs.length;i++){const middle=(xs[i]+xs[i-1])/2,ys=clipped.filter(x=>x.left<middle&&x.right>middle).map(x=>[x.top,x.bottom]).sort((a,b)=>a[0]-b[0]);let lo=0,hi=0,h=0;for(const [a,b]of ys){if(a>hi){h+=hi-lo;lo=a;hi=b;}else hi=Math.max(hi,b);}covered+=(h+hi-lo)*(xs[i]-xs[i-1]);}
 let raw=null,parsed=null,backup=null,remember=null,quota=null,storageError=null;
 try{raw=localStorage.getItem(storageKeys.state);parsed=raw?JSON.parse(raw):null;backup=localStorage.getItem(storageKeys.backup);remember=localStorage.getItem(storageKeys.remember);quota=sessionStorage.getItem(storageKeys.quota);}catch(error){storageError=String(error);}
 return {snapshot:s,inputs:globalThis.__v26Inputs||0,storage:{raw,parsed,backup,remember,quota,error:storageError},body,viewportShare:overlap(body,{left:0,top:0,right:innerWidth,bottom:innerHeight})/area,protectedShare:covered/area,overflow:document.documentElement.scrollWidth-innerWidth,canvasFilter:getComputedStyle(canvas).filter,pointerEvents:getComputedStyle(canvas).pointerEvents};
},keys);}
async function beginTrace(page){
 await page.evaluate(()=>{
  globalThis.__v26Trace=[];globalThis.__v26TraceActive=true;let sampled=-Infinity;
  const frame=now=>{
   if(!globalThis.__v26TraceActive)return;
   if(globalThis.MWorld&&now-sampled>=100){
    const s=MWorld.snapshot(),game=s.character.game,scene=s.character.scene;
    globalThis.__v26Trace.push({at:now,x:s.state.x,y:s.state.y,depth:s.state.depth,mode:s.state.mode,phase:s.state.phase,affect:s.renderer.affect,gesture:s.renderer.gesture,story:s.character.story,
     game:game?{id:game.id,name:game.name,autonomous:game.autonomous,autonomyId:game.autonomyId,score:game.score,goal:game.goal,moveAfter:game.moveAfter,goalStarted:game.goalStarted}:null,
     scene:scene?{id:scene.id,status:scene.status,stage:scene.stage,command:scene.command,reason:scene.reason}:null,
     autonomy:s.character.autonomy,pendingIntent:s.pendingIntent,frames:s.stats.frames,cpuMs:s.stats.lastFrameMs,renderCalls:s.renderer.render?.calls,inputs:globalThis.__v26Inputs||0});
    sampled=now;
   }
   requestAnimationFrame(frame);
  };requestAnimationFrame(frame);
 });
}
async function warmCadence(page){return page.evaluate(async()=>{
 const start=performance.now(),before=MWorld.snapshot().stats.frames,cpu=[],raf=[],draw=[];let last=start;
 while(performance.now()-start<4000){await new Promise(requestAnimationFrame);const now=performance.now(),s=MWorld.snapshot();cpu.push(s.stats.lastFrameMs);raf.push(now-last);draw.push(s.renderer.render?.calls||0);last=now;}
 const p95=list=>[...list].sort((a,b)=>a-b)[Math.floor(list.length*.95)];const wallMs=performance.now()-start,frames=MWorld.snapshot().stats.frames-before;
 return {wallMs,frames,fps:frames*1000/wallMs,cpuP95:p95(cpu),rafP95:p95(raf),drawSamples:draw.filter(x=>x>0).length,samples:draw.length,minRenderCalls:Math.min(...draw),heapBytes:performance.memory?.usedJSHeapSize,scope:'Warm actual drawing without recording or forced clock.'};
});}
async function screenshot(page,name){
 const file=path.join(out,name+'.png'),before=await read(page);await page.screenshot({path:file,scale:'css'});const after=await read(page);
 artifact(file);saveJson(file.replace(/\.png$/u,'.json'),{before,after});return file;
}
async function observe(page,name,stage,{deadlineMs,predicate}){
 const started=Date.now(),initial=await read(page),from=stage==='first-adventure'?0:await page.evaluate(()=>__v26Trace.length);let final=initial,naturalCapture=null,lastBeat=initial.snapshot.character.story.beat;
 const milestones=[{atMs:0,beat:lastBeat,goal:initial.snapshot.character.story.goal,story:initial.snapshot.character.story}];
 while(Date.now()-started<deadlineMs&&!predicate(final)){
  await page.waitForTimeout(500);final=await read(page);
  const story=final.snapshot.character.story;
  if(story.beat!==lastBeat){lastBeat=story.beat;milestones.push({atMs:Date.now()-started,beat:story.beat,goal:story.goal,story});}
  const affect=final.snapshot.renderer.affect;
  if(!naturalCapture&&final.viewportShare>.985&&final.protectedShare<.01&&final.snapshot.state.depth>.95&&['anticipation','proud','content','mischief'].includes(affect?.name)&&affect.envelope>.65){
   naturalCapture=await screenshot(page,name+'-'+stage+'-natural');
  }
 }
 final=await read(page);const rows=await page.evaluate(index=>__v26Trace.slice(index),from);
 const trace=path.join(out,name+'-'+stage+'-trace.json');saveJson(trace,rows);artifact(trace);
 const events=[];let key='';
 for(const row of rows){const next=JSON.stringify({beat:row.story.beat,goal:row.story.goal,execution:row.autonomy.execution,scene:row.scene?.stage,score:row.game?.score,gameId:row.game?.id});if(next!==key){events.push(row);key=next;}}
 const scores=rows.filter(row=>row.game?.name==='light').map(row=>({at:row.at,id:row.game.id,autonomous:row.game.autonomous,score:row.game.score,goal:row.game.goal}));
 const stored=final.storage.parsed;
 return {stage,wallMs:Date.now()-started,deadlineMs,complete:predicate(final),initial,final,milestones,events,lightScores:scores,receipts:stored?.receipts||[],trace,naturalCapture,inputs:final.inputs};
}
function initialStoryComplete(value){return value.snapshot.character.story?.beat==='complete';}
function revisitComplete(value){const story=value.snapshot.character.story;return story?.goal==='explore'&&story.journal.some(entry=>entry.id==='lookout-revisited'&&entry.visit===story.visitId);}
function revisitAvailability(value){
 const favorite=value.snapshot.character.story?.favorite;
 if(!favorite)return {available:false,reason:'no-favorite'};
 if(/^lookout-(?:home|hero)$/u.test(favorite.stableId))return {available:true,reason:'same-home-region-layout',semantic:true,favorite};
 const known=M_CONTEXT_COMPONENTS.find(record=>record.id===favorite.publicId),targets=value.snapshot.director.perception?.targets||[];
 const offered=known&&targets.find(target=>target.title===known.title&&target.actions.includes('perch'));
 return {available:Boolean(offered),reason:offered?'same-visible-mapped-perch':'matching-visible-perch-not-offered',semantic:false,favorite,offered:offered||null};
}
function validateOriginal(name,value){
 const r=value.snapshot.renderer;
 check(name+': original rig, full weights, maps and clips',r.bones===31&&r.tailBones===10&&r.maxInfluences===14&&r.skinSets===4&&r.detailMaps===10&&r.clips.length===6,{bones:r.bones,tail:r.tailBones,influences:r.maxInfluences,skinSets:r.skinSets,maps:r.detailMaps,clips:r.clips});
 check(name+': native sharp bounded render',r.renderPixels.every(n=>n===(name==='mobile'?416:544))&&value.canvasFilter==='none'&&r.shaderErrors.length===0,{pixels:r.renderPixels,filter:value.canvasFilter,shaderErrors:r.shaderErrors});
}
async function interactiveChecks(page,name){
 const results={},start=await read(page);results.start=start;
 await page.locator('.m-companion-toggle').click();
 await page.locator('.m-companion-story > summary').click();
 await page.locator('.m-companion textarea').fill('Private unsent V26 validation draft');
 await page.waitForTimeout(1500);
 const typing=await read(page);results.typing=typing;
 check(name+': typing cancels owned activity without inventing story progress',typing.snapshot.character.autonomy.execution===null&&storyFingerprint(typing.snapshot.character.story)===storyFingerprint(start.snapshot.character.story),{execution:typing.snapshot.character.autonomy.execution,before:start.snapshot.character.story,after:typing.snapshot.character.story});
 const accepted=typing.snapshot.character.autonomy.accepted;await page.waitForTimeout(1200);const typingHold=await read(page);
 check(name+': focused draft prevents new autonomous commitments',typingHold.snapshot.character.autonomy.accepted===accepted&&typingHold.snapshot.character.autonomy.execution===null);
 check(name+': story UI exposes authored state without internal IDs',await page.locator('.m-companion-story').evaluate(el=>!el.hidden&&/The Small Light/u.test(el.textContent)&&!/autonomy-[0-9]+|visit-[0-9]+:|stable-private/u.test(el.textContent)));
 results.storyCapture=await screenshot(page,name+'-story-panel');
 const beforeMemory=await read(page),remember=page.locator('.m-companion-remember-character');
 if(beforeMemory.snapshot.character.story.remember)await remember.click();
 const forgotten=await read(page);results.forgotten=forgotten;
 check(name+': remember opt-out clears only story persistence and keeps draft/quota',forgotten.snapshot.character.story.remember===false&&forgotten.storage.raw===null&&forgotten.storage.backup===null&&forgotten.storage.quota===beforeMemory.storage.quota&&await page.locator('.m-companion textarea').inputValue()==='Private unsent V26 validation draft');
 await remember.click();const remembered=await read(page);results.remembered=remembered;
 check(name+': remembering can resume without sending chat',remembered.snapshot.character.story.remember===true&&remembered.storage.raw!==null&&remembered.storage.quota===beforeMemory.storage.quota&&remembered.snapshot.companion.messages===0);
 await page.locator('.m-companion-character > summary').click();await page.getByRole('button',{name:'Reset character memory',exact:true}).click();
 const reset=await read(page);results.reset=reset;
 check(name+': explicit reset clears story but preserves draft, visit identity and AI accounting',reset.snapshot.character.story.beat==='seeking'&&reset.snapshot.character.story.discovery==='none'&&reset.snapshot.character.story.journal.length===0&&reset.snapshot.character.story.visitId===remembered.snapshot.character.story.visitId&&reset.storage.quota===beforeMemory.storage.quota&&await page.locator('.m-companion textarea').inputValue()==='Private unsent V26 validation draft');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1500);const reducedBefore=await read(page);await page.waitForTimeout(1500);const reducedAfter=await read(page);results.reduced={before:reducedBefore,after:reducedAfter};
 check(name+': reduced motion stays visible and cannot advance a chapter',reducedAfter.snapshot.preferences.reducedMotion===true&&reducedAfter.snapshot.character.autonomy.execution===null&&reducedAfter.snapshot.state.depth>.95&&reducedAfter.snapshot.renderer.expression==='neutral'&&storyFingerprint(reducedAfter.snapshot.character.story)===storyFingerprint(reducedBefore.snapshot.character.story));
 check(name+': controls preserve responsive layout',reducedAfter.overflow<=1&&reducedAfter.snapshot.renderer.shaderErrors.length===0,{overflow:reducedAfter.overflow,shaderErrors:reducedAfter.snapshot.renderer.shaderErrors});
 return results;
}

async function profile(name){
 const result={name,userDataDir:path.join(profileRoot,name),initial:null,reopened:null,interactive:null,passed:false};report.profiles.push(result);let context=null,page=null;
 try{
  ({context,page}=await openProfile(name,result.userDataDir));
  await beginTrace(page);const first=await read(page);result.first=first;
  check(name+': first visit starts from real empty persistent profile',first.snapshot.character.story.beat==='seeking'&&first.snapshot.character.story.visits===1&&first.snapshot.character.story.visitId===1&&first.snapshot.character.story.journal.length===0&&first.inputs===0,first.snapshot.character.story);
  validateOriginal(name,first);result.cadence=await warmCadence(page);
  check(name+': real warm drawing meets native frame budget',result.cadence.fps>=40&&result.cadence.drawSamples===result.cadence.samples,result.cadence);
  result.initial=await observe(page,name,'first-adventure',{deadlineMs:150000,predicate:initialStoryComplete});
  const original=result.initial.final.snapshot.character.story,stored=result.initial.final.storage.parsed;
  check(name+': untouched M completes the first chapter within the real deadline',result.initial.complete&&result.initial.inputs===0,{wallMs:result.initial.wallMs,story:original,events:result.initial.events.map(row=>({at:row.at,beat:row.story.beat,goal:row.story.goal,execution:row.autonomy.execution,game:row.game,scene:row.scene}))});
  check(name+': verified discoveries and favourite exist in the stored state',original.beat==='complete'&&original.discovery==='little-light'&&original.favorite&&foundedJournal(original).map(e=>e.id).join(',')==='light-found,lookout-found'&&stored?.beat==='complete'&&stored.favorite?.stableId===original.favorite?.stableId,{story:original,stored});
  const scores=result.initial.lightScores.map(row=>row.score);
  check(name+': actual autonomous light scores precede the recorded discovery',scores.includes(0)&&scores.includes(1)&&scores.includes(2)&&result.initial.lightScores.some(row=>row.autonomous===true)&&result.initial.receipts.some(r=>r.goal==='follow-light'&&r.success===true),{observedScores:[...new Set(scores)],receipt:result.initial.receipts.find(r=>r.goal==='follow-light'&&r.success===true),note:'Score 3 can be cleared in the same real update as stopPlay; the harness records observed scores and the verified final receipt rather than inventing an observable terminal score.'});
  if(!result.initial.naturalCapture)result.initial.naturalCapture=await screenshot(page,name+'-first-adventure-final');
  check(name+': initial observation has no user commands or overflow',result.initial.inputs===0&&result.initial.final.overflow<=1,{inputs:result.initial.inputs,overflow:result.initial.final.overflow});
  await context.close();context=null;result.closedFirstContext=true;
  ({context,page}=await openProfile(name,result.userDataDir));await beginTrace(page);
  const reopened=await read(page);result.reopenedFirst=reopened;const next=reopened.snapshot.character.story;
  check(name+': full browser reopen restores the same experience with a new fixed visit identity',next.visitId!==original.visitId&&next.visits>original.visits&&next.recall==='returning'&&next.beat===original.beat&&next.discovery===original.discovery&&JSON.stringify(next.favorite)===JSON.stringify(original.favorite)&&JSON.stringify(foundedJournal(next))===JSON.stringify(foundedJournal(original)),{before:original,after:next});
  if(original.beat==='complete'){
   await page.waitForTimeout(1000);result.revisitAvailability=revisitAvailability(await read(page));
   result.reopened=await observe(page,name,'remembered-lookout',{deadlineMs:90000,predicate:revisitComplete});
   check(name+': remembered lookout produces a genuine new-visit completion',result.reopened.complete&&result.reopened.inputs===0,{availability:result.revisitAvailability,wallMs:result.reopened.wallMs,story:result.reopened.final.snapshot.character.story,receipts:result.reopened.receipts});
  }else result.reopened={complete:false,notVerified:'First chapter failed; no completed history or revisit is claimed.'};
  const persisted=await read(page);check(name+': saved story contains no private conversation or live objects',persisted.storage.raw!==null&&persisted.storage.raw.length<=16384&&!/Private unsent|message|history|password|token|element|route|quaternion/u.test(persisted.storage.raw),{bytes:persisted.storage.raw?.length,keys:Object.keys(persisted.storage.parsed||{})});
  result.interactive=await interactiveChecks(page,name);
  result.passed=report.checks.filter(row=>row.name.startsWith(name+':')).every(row=>row.passed);
 }catch(error){report.errors.push({profile:name,error:String(error),stack:error.stack});check(name+': harness completed without a technical failure',false,String(error));if(page)try{await screenshot(page,name+'-technical-failure');}catch{} }
 finally{if(context)await context.close();saveJson(path.join(out,name+'-report.json'),result);}
}
try{
 for(const name of ['desktop','mobile'].filter(name=>!only||name===only))await profile(name);
 check('no paid provider or external backend request was allowed',report.network.paidAttempts===0&&report.network.blockedExternalBackend.length===0,report.network);
 check('no JavaScript or local asset errors',report.errors.length===0&&report.assetErrors.length===0,{errors:report.errors,assetErrors:report.assetErrors});
}finally{
 report.completedAt=new Date().toISOString();report.passed=report.checks.length>0&&report.checks.every(row=>row.passed)&&report.profiles.every(p=>p.passed);
 saveJson(path.join(out,'report.json'),report);
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(row=>!row.passed).map(row=>row.name),out}));
}
if(!report.passed)process.exitCode=1;
