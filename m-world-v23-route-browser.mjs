/** Two native physical-AI stories. Server replies are mocked; no real API call. */
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {validateDirectorInput,validateDirectorReply} from './m-world-director-protocol.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const base=process.env.BASE_URL||'http://127.0.0.1:4183/';
const out=process.env.M_WORLD_ARTIFACT_DIR||path.resolve('../work/M_V23_Route_Validation');mkdirSync(out,{recursive:true});
const endpoint='https://m-ai-v23-route.invalid/api/m/direct',health='https://m-ai-v23-route.invalid/health';
const report={url:base,scope:'Native Chrome 1280x900 DPR1. Two real controller routes with mocked structured AI replies; no forced pose, depth or clock. No real OpenAI request.',checks:[],stories:[],artifacts:[],passed:false};
const check=(name,passed,details)=>report.checks.push({name,passed:Boolean(passed),details});
const read=page=>page.evaluate(()=>MWorld.snapshot());
async function screenshot(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file});report.artifacts.push(file);return file;}
async function trace(page){
 await page.evaluate(()=>{
  globalThis.__v23RouteTrace=[];globalThis.__v23RouteRunning=true;
  const overlaps=(a,b,p=0)=>a.left<b.right+p&&a.right>b.left-p&&a.top<b.bottom+p&&a.bottom>b.top-p;
  function tick(){if(!globalThis.__v23RouteRunning)return;const s=MWorld.snapshot(),f=s.metrics.footprint,a={left:s.state.x+f.left,right:s.state.x+f.right,top:s.state.y+f.top,bottom:s.state.y+f.bottom},target=s.surfaces.find(r=>r.id===s.state.targetId);globalThis.__v23RouteTrace.push({at:performance.now(),clock:s.state.clock,scrollY,frames:s.stats.frames,x:s.state.x,y:s.state.y,depth:s.state.depth,depthTarget:s.state.depthTarget,targetId:s.state.targetId,mode:s.state.mode,phase:s.state.phase,gesture:s.state.gesture?{name:s.state.gesture.name,source:s.state.gesture.source,age:s.state.gesture.age}:null,render:s.renderer.gesture,actor:a,target:target?{id:target.id,left:target.left,top:target.top,right:target.right,bottom:target.bottom}:null,overlapTarget:Boolean(target&&overlaps(a,target)),overlappingCards:s.surfaces.filter(r=>overlaps(a,r,.4)).map(r=>r.id),occlusion:s.renderer.occlusion,activity:s.director.activity,execution:s.director.lastExecution,recent:s.director.perception?.recent||[],visits:s.brain.recentTargets,scrolling:s.brain.context.scrolling,frozen:s.frozen});requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
 });
}
async function nativeOcclusionPixels(page,name){
 const before=await read(page),file=await screenshot(page,name+'-native-behind'),behind=await page.screenshot();
 await page.locator('.m-world-canvas').evaluate(canvas=>{canvas.dataset.v23OldVisibility=canvas.style.visibility;canvas.style.visibility='hidden';});
 let empty;
 try{empty=await page.screenshot();}finally{await page.locator('.m-world-canvas').evaluate(canvas=>{canvas.style.visibility=canvas.dataset.v23OldVisibility||'';delete canvas.dataset.v23OldVisibility;});}
 const pixels=await page.evaluate(async({behind,empty,before})=>{
  async function decode(data){const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);return {width:canvas.width,height:canvas.height,pixels:context.getImageData(0,0,canvas.width,canvas.height).data};}
  const actual=await decode(behind),baseline=await decode(empty),target=before.surfaces.find(r=>r.id===before.state.targetId),a=before.actor,groups={cardInterior:{pixels:0,changed:0},outsideCard:{pixels:0,changed:0}};
  for(let y=Math.max(0,Math.floor(a.top));y<Math.min(actual.height,Math.ceil(a.bottom));y++)for(let x=Math.max(0,Math.floor(a.left));x<Math.min(actual.width,Math.ceil(a.right));x++){
   const inner=target&&x>=target.left+5&&x<target.right-5&&y>=target.top+5&&y<target.bottom-5,outside=target&&(x<target.left-3||x>=target.right+3||y<target.top-3||y>=target.bottom+3);
   if(!inner&&!outside)continue;const group=inner?groups.cardInterior:groups.outsideCard,offset=(y*actual.width+x)*4;group.pixels++;let delta=0;for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(actual.pixels[offset+c]-baseline.pixels[offset+c]));if(delta>=12)group.changed++;
  }
  return {...groups,threshold:12,scope:'Native behind pose compared with a temporarily hidden canvas; controller, pose and depth continued normally.'};
 },{behind:behind.toString('base64'),empty:empty.toString('base64'),before});
 return {file,depth:before.state.depth,targetId:before.state.targetId,pixels};
}
async function runStory(browser,name,cancel){
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'no-preference'}),story={name,requests:[],blocked:[],errors:[]};
 let page,releaseModel;const modelGate=new Promise(resolve=>{releaseModel=resolve;});
 const headers={'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
 await context.route('**/*',async route=>{
  const request=route.request(),url=request.url();
  if(new URL(url).pathname.endsWith('/m-world-config.mjs'))return route.fulfill({contentType:'text/javascript',body:`export const M_WORLD_CONFIG=Object.freeze({assistantEndpoint:'',directorEndpoint:'${endpoint}'});`});
  if(url.includes('/assets/m-v6-web/')){await modelGate;return route.continue();}
  if(url===health)return route.fulfill({contentType:'application/json',headers,body:JSON.stringify({configured:true,director:{version:1,enabled:true}})});
  if(url===endpoint){
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const input=JSON.parse(request.postData()||'null'),offered=input?.snapshot?.targets||[];
   let target=offered.find(target=>target.kind==='project'&&target.actions.includes('peek')),action='peek';
   if(!target){target=offered.find(target=>target.kind==='project'&&target.actions.includes('perch'));action='perch';}
   const reply={snapshot:input?.snapshot?.revision,targetId:target?.id??null,action:target?action:'rest',gesture:'playful',expression:'happy'};
   story.requests.push({at:Date.now(),input,reply});return route.fulfill({contentType:'application/json',headers,body:JSON.stringify(reply)});
  }
  if(/api\.openai\.com/iu.test(url)||/\/api\/m\/(?:respond|direct)(?:[?#]|$)/u.test(url)||(request.method()==='POST'&&new URL(url).origin!==new URL(base).origin)){story.blocked.push({url,method:request.method()});return route.abort('blockedbyclient');}
  return route.continue();
 });
 try{
  page=await context.newPage();page.on('pageerror',error=>story.errors.push(String(error)));
  const url=new URL(base);url.searchParams.set('m-debug','1');await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Talk to M',exact:true}).click();const before=await read(page);await page.getByRole('button',{name:'Pause AI play',exact:true}).click();
  check(name+': actual UI pauses AI before the original GLB is ready',!before.ready&&story.requests.length===0&&!(await read(page)).director.enabled,{ready:before.ready,requests:story.requests.length});
  releaseModel();await page.waitForFunction(()=>MWorld.snapshot().ready,undefined,{timeout:90000});
  await page.locator('#projects .card').first().scrollIntoViewIfNeeded();await page.waitForTimeout(1300);
  story.initial=await read(page);await trace(page);
  await page.getByRole('button',{name:'Enable AI play',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.waitForFunction(()=>MWorld.snapshot().director.lastExecution?.status==='travelling',undefined,{timeout:25000});
  const accepted=await read(page),decision=story.requests[0]?.reply;story.accepted=accepted.director;story.decision=decision;
  check(name+': one mocked AI reply chooses an offered physical project action',story.requests.length===1&&validateDirectorInput(story.requests[0].input)&&validateDirectorReply(decision,story.requests[0].input)&&['peek','perch'].includes(decision.action),{decision,offered:story.requests[0]?.input?.snapshot?.targets});
  story.domTarget=await page.evaluate(id=>{const s=MWorld.snapshot(),surface=s.surfaces.find(r=>r.id===id);if(!surface)return null;const element=[...document.querySelectorAll('#projects .card,#projects .case-teaser')].find(element=>{const r=element.getBoundingClientRect();return Math.max(Math.abs(r.left-surface.left),Math.abs(r.top-surface.top),Math.abs(r.width-surface.width),Math.abs(r.height-surface.height))<1;});return element?{id:surface.id,title:element.querySelector('h3')?.textContent?.trim(),visible:surface.bottom>0&&surface.top<innerHeight}:null;},decision.targetId);
  check(name+': real controller targets the actual visible DOM project',accepted.state.targetId===decision.targetId&&story.domTarget?.id===decision.targetId&&story.domTarget.visible,{stateTarget:accepted.state.targetId,domTarget:story.domTarget});
  check(name+': travelling is not yet recorded as completed director memory',!accepted.director.perception.recent.some(item=>item.targetId===decision.targetId&&item.action===decision.action),{status:accepted.director.lastExecution.status,recent:accepted.director.perception.recent});
  if(cancel){
   story.beforeCancel=await read(page);await page.evaluate(()=>document.getElementById('contact').scrollIntoView({behavior:'instant',block:'start'}));
   await page.waitForFunction(()=>MWorld.snapshot().director.lastExecution?.status==='cancelled',undefined,{timeout:8000});
   await page.waitForTimeout(1800);const after=await read(page);story.afterCancel=after;
   const traceRows=await page.evaluate(()=>globalThis.__v23RouteTrace);
   const previousVisits=story.beforeCancel.brain.recentTargets.find(item=>item.id===decision.targetId)?.count||0,visits=after.brain.recentTargets.find(item=>item.id===decision.targetId)?.count||0;
   check(name+': scroll invalidation cancels rather than records a false arrival',after.director.lastExecution.status==='cancelled'&&!after.director.perception.recent.some(item=>item.targetId===decision.targetId&&item.action===decision.action)&&visits===previousVisits,{execution:after.director.lastExecution,recent:after.director.perception.recent,previousVisits,visits});
   check(name+': cancelled physical route never launches its follow-up director gesture',(!after.state.gesture||after.state.gesture.source!=='director')&&traceRows.every(row=>row.gesture?.source!=='director'),{gesture:after.state.gesture,scrolling:after.brain.context.scrolling,traceDirectorGestures:traceRows.filter(row=>row.gesture?.source==='director').length});
   check(name+': rapid scroll spends no additional AI request',story.requests.length===1,{requests:story.requests.length});
   await screenshot(page,name+'-cancelled-at-contact');
  }else{
   if(decision.action==='peek'){
    await page.waitForFunction(()=>{const s=MWorld.snapshot(),r=s.surfaces.find(r=>r.id===s.state.targetId),a=s.actor;return s.state.depth<-.98&&s.state.phase==='hold'&&r&&a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top;},undefined,{timeout:34000});
    story.pixelEvidence=await nativeOcclusionPixels(page,name);
    const p=story.pixelEvidence.pixels;check(name+': native behind-card route visibly preserves real card pixels',p.cardInterior.pixels>200&&p.cardInterior.changed<=3&&p.outsideCard.changed>30,story.pixelEvidence);
   }
   await page.waitForFunction(()=>MWorld.snapshot().director.lastExecution?.status==='complete',undefined,{timeout:40000});
   story.completed=await read(page);
   await page.waitForFunction(()=>{const s=MWorld.snapshot();return s.state.gesture?.source==='director'&&s.renderer.gesture.name==='playful'&&s.renderer.gesture.phase==='action';},undefined,{timeout:25000});
   await screenshot(page,name+'-completed-playful');await page.waitForFunction(()=>MWorld.snapshot().director.perception.recent.length>0,undefined,{timeout:3000});
   const traceRows=await page.evaluate(()=>globalThis.__v23RouteTrace),firstComplete=traceRows.find(row=>row.execution?.status==='complete'),firstRecent=traceRows.find(row=>row.recent.some(item=>item.targetId===decision.targetId&&item.action===decision.action));
   story.peak=await read(page);
   check(name+': director memory appears only after the actual physical route completes',Boolean(firstComplete&&firstRecent&&firstRecent.at>=firstComplete.at)&&story.peak.director.perception.recent.some(item=>item.targetId===decision.targetId&&item.action===decision.action),{firstCompleteAt:firstComplete?.at,firstRecentAt:firstRecent?.at,execution:story.peak.director.lastExecution,recent:story.peak.director.perception.recent});
   check(name+': actual arrival is visited and followed by native Playful on the original rig',story.completed.brain.recentTargets.some(item=>item.id===decision.targetId)&&story.peak.state.gesture?.source==='director'&&story.peak.renderer.gesture.name==='playful'&&story.peak.renderer.expression==='happy',{visits:story.completed.brain.recentTargets,gesture:story.peak.renderer.gesture,expression:story.peak.renderer.expression});
   const relevant=traceRows.filter(row=>row.execution?.targetId===decision.targetId),flips=[];
   for(let i=1;i<relevant.length;i++)if(relevant[i].depthTarget!==relevant[i-1].depthTarget)flips.push({at:relevant[i].at,from:relevant[i-1].depthTarget,to:relevant[i].depthTarget,overlappingCards:relevant[i].overlappingCards});
   check(name+': native depth changes happen only with actual card clearance',flips.length>0&&flips.every(flip=>flip.overlappingCards.length===0),{flips});
   check(name+': physical route traverses real front and behind depth',decision.action!=='peek'||relevant.some(row=>row.depth>.95)&&relevant.some(row=>row.depth<-.95),{minDepth:Math.min(...relevant.map(row=>row.depth)),maxDepth:Math.max(...relevant.map(row=>row.depth))});
   await page.getByRole('button',{name:'Talk to M',exact:true}).click();await page.getByRole('button',{name:'Pause AI play',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();
   const filter=page.locator('.project-filters button[data-filter="all"]');await filter.click();
   check(name+': original project control still receives a real click through the overlay',await filter.getAttribute('aria-pressed')==='true'&&await page.evaluate(()=>getComputedStyle(document.querySelector('.mascot-world-v9')).pointerEvents==='none'));
  }
  check(name+': original rig and shader remain intact',(await read(page)).renderer.bones===31&&(await read(page)).renderer.maxInfluences===14&&(await read(page)).renderer.shaderErrors.length===0);
  check(name+': one request only, no real API or JS errors',story.requests.length===1&&story.blocked.length===0&&story.errors.length===0,{requests:story.requests.length,blocked:story.blocked,errors:story.errors});
 }catch(error){story.error=String(error.stack||error);check(name+': physical route story execution',false,{error:String(error.message||error)});if(page)try{story.failure=await read(page);await screenshot(page,name+'-failure');}catch{}}
 finally{releaseModel();if(page)try{await page.evaluate(()=>{globalThis.__v23RouteRunning=false;});story.trace=await page.evaluate(()=>globalThis.__v23RouteTrace);}catch{};await context.close();report.stories.push(story);}
}
let browser;
try{browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')});report.browserVersion=browser.version();await runStory(browser,'completed-physical-ai-route',false);await runStory(browser,'cancelled-physical-ai-route',true);}
catch(error){report.error=String(error.stack||error);check('Native Chrome launch',false,{error:String(error.message||error)});}
finally{if(browser)await browser.close();report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);report.finishedAt=new Date().toISOString();writeFileSync(path.join(out,'v23-route-browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(item=>!item.passed),out}));if(!report.passed)process.exitCode=1;}
