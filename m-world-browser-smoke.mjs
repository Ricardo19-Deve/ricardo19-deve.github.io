import {createRequire} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';

const require=createRequire(import.meta.url);
function loadDriver(){
 const candidates=[process.env.PLAYWRIGHT_MODULE,'playwright-core','playwright',
  path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
 for(const candidate of candidates){try{return {driver:require(candidate),source:candidate};}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
 throw new Error('Playwright driver unavailable. Install the pinned playwright-core from the browser workflow or set PLAYWRIGHT_MODULE.');
}
function chromeExecutable(){
 const explicit=process.env.CHROME_BIN;
 if(explicit){if(!existsSync(explicit))throw new Error('CHROME_BIN does not exist: '+explicit);return explicit;}
 const candidates=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser',
  process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),
  process.env.ProgramFiles&&path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),
  process.env['ProgramFiles(x86)']&&path.join(process.env['ProgramFiles(x86)'],'Google/Chrome/Application/chrome.exe')].filter(Boolean);
 const found=candidates.find(p=>existsSync(p));if(!found)throw new Error('No Chrome available; set CHROME_BIN to the intended browser.');return found;
}
const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const artifactDir=process.env.M_WORLD_ARTIFACT_DIR||process.env.ARTIFACT_DIR||path.join(tmpdir(),'m-world-smoke');
const report={startedAt:new Date().toISOString(),url:base,passed:false,
 scope:'Real Chrome desktop and emulated mobile/touch smoke; no physical-phone or artistic approval.',
 contexts:[],artifacts:[],checks:[]};
const check=(name,passed,details={})=>report.checks.push({name,passed:Boolean(passed),...details});
const icon=url=>{try{return new URL(url).pathname==='/favicon.ico';}catch{return false;}};
report.selectedProfiles=(process.env.M_WORLD_PROFILES||'desktop,mobile').split(',').map(s=>s.trim());
mkdirSync(artifactDir,{recursive:true});
async function settleScroll(page){
 await page.evaluate(()=>new Promise(resolve=>{let last=scrollY,stable=0;function tick(){if(Math.abs(scrollY-last)<.1)stable++;else stable=0;last=scrollY;if(stable>=4)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
}
async function scrollElementTo(page,selector,top){
 await page.evaluate(({selector,top})=>{const el=document.querySelector(selector);if(!el)throw Error('Missing spatial fixture '+selector);scrollTo({top:scrollY+el.getBoundingClientRect().top-top,behavior:'instant'});},{selector,top});
 await settleScroll(page);
}
async function pixelEvidence(page,label,selector,artifactPaths){
 await scrollElementTo(page,selector,Math.min(400,page.viewportSize().height*.45));
 const planned=await page.evaluate(async selector=>{
  const failed=[];
  for(const side of[1,-1]){
   const s=await window.MWorld.stepTo({selector,index:0,kind:'peek',side,progress:.65,instant:true});
   if(s.plan?.available)return {available:true,side,snapshot:s};
   failed.push({side,reason:s.plan?.reason});
  }
  return {available:false,failed};
 },selector);
 if(!planned.available)return {available:false,selector,reason:'No safe production plan for this visible component',attempts:planned.failed};
 const input={selector,index:0,kind:'peek',side:planned.side,progress:.5,instant:true};
 let selectedProgress=.5,sampledNeutralOverlap=null;
 const initial=await page.evaluate(async({input,choosePartial})=>{
  let last=null,best=null;
  for(const progress of choosePartial?[.35,.4,.45,.5,.55,.6,.65,.7,.75,.8]:[.5]){
   const s=await window.MWorld.stepTo({...input,progress});last=s;if(!s.plan?.available)continue;
   const q=s.surfaces.find(r=>r.id===s.state.targetId),f=s.metrics.neutralFootprint;
   if(!q||!f)return {snapshot:s,progress,overlap:null};
   const n={left:s.state.x+f.left,right:s.state.x+f.right,top:s.state.y+f.top,bottom:s.state.y+f.bottom};
   const area=Math.max(1,(n.right-n.left)*(n.bottom-n.top));
   const overlap=Math.max(0,Math.min(n.right,q.right)-Math.max(n.left,q.left))*Math.max(0,Math.min(n.bottom,q.bottom)-Math.max(n.top,q.top))/area;
   const visible=n.right>8&&n.left<innerWidth-8&&n.bottom>8&&n.top<innerHeight-8;
   if(!choosePartial||(visible&&overlap>=.15&&overlap<=.85))return {snapshot:s,progress,overlap};
   if(visible&&(!best||Math.abs(overlap-.5)<Math.abs(best.overlap-.5)))best={progress,overlap};
  }
  if(best)return {snapshot:await window.MWorld.stepTo({...input,progress:best.progress}),...best};
  return {snapshot:last,progress:.5,overlap:null};
 },{input,choosePartial:!label.includes('-text')});
 selectedProgress=initial.progress;sampledNeutralOverlap=initial.overlap;
 if(!initial.snapshot?.plan?.available)return {available:false,selector,reason:'Plan no longer available',snapshot:initial.snapshot};
 if(!await page.evaluate(()=>typeof window.MWorld.setDepth==='function'))throw Error('Debug setDepth is required for frozen-pose pixel comparison');
 const frontState=await page.evaluate(()=>window.MWorld.setDepth(1));
 const frontFile=path.join(artifactDir,label+'-front.png'),behindFile=path.join(artifactDir,label+'-behind.png'),emptyFile=path.join(artifactDir,label+'-without-M.png');
 const front=await page.screenshot({path:frontFile,animations:'disabled'});
 const behindState=await page.evaluate(()=>window.MWorld.setDepth(-1));
 const behind=await page.screenshot({path:behindFile,animations:'disabled'});
 await page.evaluate(()=>window.MWorld.setActive(false,false));
 const empty=await page.screenshot({path:emptyFile,animations:'disabled'});
 artifactPaths.push(frontFile,behindFile,emptyFile);
 const pixels=await page.evaluate(async({front,behind,empty,snapshot})=>{
  async function decode(base64){const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const context=c.getContext('2d');context.drawImage(image,0,0);return {width:c.width,height:c.height,data:context.getImageData(0,0,c.width,c.height).data};}
  const f=await decode(front),b=await decode(behind),e=await decode(empty),sx=f.width/innerWidth,sy=f.height/innerHeight;
  const inside=(x,y,r,inset=0)=>x>=r.left+inset&&x<r.right-inset&&y>=r.top+inset&&y<r.bottom-inset;
  const names=['actor','card','cardBoundary','outsideCard','protected','protectedInterior'];
  const groups=Object.fromEntries(names.map(k=>[k,{pixels:0,frontBackChanged:0,frontEmptyChanged:0,behindEmptyChanged:0,maxFrontEmpty:0,maxBehindEmpty:0}]));
  const actor=snapshot.actor,card=snapshot.surfaces.find(r=>r.id===snapshot.state.targetId),visible={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
  for(let py=Math.max(0,Math.floor(actor.top*sy));py<Math.min(f.height,Math.ceil(actor.bottom*sy));py++)for(let px=Math.max(0,Math.floor(actor.left*sx));px<Math.min(f.width,Math.ceil(actor.right*sx));px++){
   const x=(px+.5)/sx,y=(py+.5)/sy,off=(py*f.width+px)*4;let fb=0,fe=0,be=0;
   for(let k=0;k<3;k++){fb=Math.max(fb,Math.abs(f.data[off+k]-b.data[off+k]));fe=Math.max(fe,Math.abs(f.data[off+k]-e.data[off+k]));be=Math.max(be,Math.abs(b.data[off+k]-e.data[off+k]));}
   const roundedInside=(r,inset=0)=>{
    if(!inside(x,y,r,inset))return false;
    const radius=Math.max(0,(r.radius||0)-inset),cx=Math.max(r.left+inset+radius,Math.min(x,r.right-inset-radius)),cy=Math.max(r.top+inset+radius,Math.min(y,r.bottom-inset-radius));
    return (x-cx)**2+(y-cy)**2<=radius**2;
   };
   const memberships=['actor',card&&roundedInside(card,1)?'card':'outsideCard'];
   if(card&&inside(x,y,card)&&!roundedInside(card,1))memberships.push('cardBoundary');
   if(snapshot.protectedRects.some(r=>inside(x,y,r)))memberships.push('protected');
   // Two CSS pixels exclude the rounded plane edge and raster antialiasing;
   // the full boundary counts remain in the separate protected group.
   if(snapshot.protectedRects.some(r=>inside(x,y,r,2)))memberships.push('protectedInterior');
   if(fe>=12){visible.left=Math.min(visible.left,x);visible.top=Math.min(visible.top,y);visible.right=Math.max(visible.right,x);visible.bottom=Math.max(visible.bottom,y);}
   for(const name of memberships){const g=groups[name];g.pixels++;g.frontBackChanged+=fb>=12;g.frontEmptyChanged+=fe>=12;g.behindEmptyChanged+=be>=12;g.maxFrontEmpty=Math.max(g.maxFrontEmpty,fe);g.maxBehindEmpty=Math.max(g.maxBehindEmpty,be);}
  }
  return {groups,dpr:[sx,sy],threshold:12,protectedInteriorInsetCSS:2,visibleFrontBounds:Number.isFinite(visible.left)?{...visible,width:visible.right-visible.left,height:visible.bottom-visible.top}:null};
 },{front:front.toString('base64'),behind:behind.toString('base64'),empty:empty.toString('base64'),snapshot:frontState});
 const actorShift=Math.hypot(frontState.actor.left-behindState.actor.left,frontState.actor.top-behindState.actor.top);
 await page.evaluate(()=>window.MWorld.setActive(true,false));
 return {available:true,selector,side:planned.side,progress:selectedProgress,sampledNeutralOverlap,actorShift,pixels,
  front:{state:frontState.state,actor:frontState.actor,occlusion:frontState.renderer.occlusion},
  behind:{state:behindState.state,actor:behindState.actor,occlusion:behindState.renderer.occlusion}};
}

async function exerciseLivePerch(page){
 const url=new URL(base);url.searchParams.set('m-debug','1');
 await page.goto(url.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
 await page.evaluate(()=>document.fonts.ready.then(()=>true));
 await scrollElementTo(page,'.about-tile',350);
 const start=await page.evaluate(()=>window.MWorld.playAction({selector:'.about-tile',index:0,kind:'perch'}));
 if(!start.plan?.available||start.plan.kind!=='perch')return {available:false,start,scope:'No replacement of an unavailable production perch with a debug pose.'};
 const observation=await page.evaluate(()=>new Promise(resolve=>{
  const start=performance.now(),samples=[];let atContact=null,scrollAt=null,lastSample=0,done=false;
  function tick(now){const s=window.MWorld.snapshot(),target=s.surfaces.find(r=>r.id===s.state.targetId),gap=target?s.actor.contact.y-target.top:null,t=(now-start)/1000;
   const touching=s.acting?.attached&&s.state.mode==='perch'&&s.state.phase==='hold'&&s.state.depth>.9&&gap!==null&&Math.abs(gap)<3;
   if(touching&&atContact===null)atContact=t;
   if(atContact!==null&&scrollAt===null&&touching&&t-atContact>.3){scrollBy({top:55,behavior:'instant'});scrollAt=t;}
   if(now-lastSample>40){samples.push({t,mode:s.state.mode,phase:s.state.phase,depth:s.state.depth,footGap:gap,x:s.state.x,y:s.state.y,targetId:s.state.targetId});lastSample=now;}
   if(scrollAt!==null&&t-scrollAt>1.0)done=true;
   if(!done&&t<22)requestAnimationFrame(tick);else resolve({samples,atContact,scrollAt,last:s,scope:'Actual startRoute, real animation clock and body foot contact; 55px page scroll during production perch hold.'});
  }requestAnimationFrame(tick);
 }));
 const after=observation.samples.filter(r=>observation.scrollAt!==null&&r.t>observation.scrollAt+.12&&r.mode==='perch'&&r.phase==='hold');
 const png=path.join(artifactDir,'desktop-live-perch.png');await page.screenshot({path:png});report.artifacts.push(png);
 return {available:true,startPlan:start.plan,...observation,afterScrollHoldSamples:after.length,maxAfterScrollFootGap:after.length?Math.max(...after.map(r=>Math.abs(r.footGap))):null};
}

async function observeAutonomous(page,name){
 const debugURL=new URL(base);debugURL.searchParams.set('m-debug','1');
 await page.goto(debugURL.href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.MWorld?.snapshot().ready,undefined,{timeout:90000});
 return page.evaluate(name=>new Promise(resolve=>{
  const start=performance.now(),samples=[],events=[];let lastSample=0,lastFrame=null,maxFrameStep=0,entryScroll=false,routeScroll=false,perchScroll=false;
  function tick(now){
   const s=window.MWorld.snapshot(),elapsed=now-start;
   if(lastFrame&&now-lastFrame.t<100)maxFrameStep=Math.max(maxFrameStep,Math.hypot(s.state.x-lastFrame.x,s.state.y-lastFrame.y));
   lastFrame={t:now,x:s.state.x,y:s.state.y};
   if(now-lastSample>=100){const target=s.surfaces.find(r=>r.id===s.state.targetId);samples.push({t:elapsed/1000,mode:s.state.mode,phase:s.state.phase,x:s.state.x,y:s.state.y,depth:s.state.depth,targetId:s.state.targetId,active:s.active,frozen:s.frozen,footGap:s.state.mode==='perch'&&s.state.phase==='hold'&&target?s.actor.contact.y-target.top:null});lastSample=now;}
   if(name==='mobile'&&!entryScroll&&elapsed>1800){const el=document.querySelector('.hero-visual');scrollTo({top:scrollY+el.getBoundingClientRect().top-360,behavior:'instant'});entryScroll=true;events.push({kind:'mobile-entry-scroll',t:elapsed/1000});}
   if(!routeScroll&&elapsed>2500&&['peek','perch','orbit'].includes(s.state.mode)&&s.state.phase==='approach'){events.push({kind:'scroll-midroute',t:elapsed/1000,before:{...s.state}});scrollBy({top:90,behavior:'instant'});routeScroll=true;}
   if(!perchScroll&&s.state.mode==='perch'&&s.state.phase==='hold'){events.push({kind:'scroll-perch',t:elapsed/1000,before:{...s.state}});scrollBy({top:55,behavior:'instant'});perchScroll=true;}
   if(elapsed<18000)requestAnimationFrame(tick);else resolve({samples,events,maxFrameStep,observedModes:[...new Set(samples.map(s=>s.mode))],observedPhases:[...new Set(samples.map(s=>s.phase))],scope:'Fresh unforced production director; no stepTo during this observation. Missing random actions are reported, not inferred.'});
  }
  requestAnimationFrame(tick);
 }),name);
}
let browser;
try{
 const {driver,source}=loadDriver();const executable=chromeExecutable();
 report.driver=source;report.executable=executable;
 browser=await driver.chromium.launch({headless:true,executablePath:executable,
  args:['--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
 report.browserVersion=browser.version();
 for(const [name,options]of[
  ['desktop',{viewport:{width:1280,height:900},deviceScaleFactor:2}],
  ['mobile',{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}],
 ]){
  if(!report.selectedProfiles.includes(name))continue;
  const context=await browser.newContext({...options,reducedMotion:'no-preference'});
  const result={name,options,emulatedMobile:name==='mobile',consoleErrors:[],pageErrors:[],httpErrors:[],failedRequests:[],resourceWarnings:[]};
  const page=await context.newPage();let modelChunkRequests=0;
  page.on('pageerror',error=>result.pageErrors.push(String(error.stack||error)));
  page.on('console',message=>{
   if(message.type()!=='error')return;
   const item={text:message.text(),location:message.location()};
   // Browser-owned favicon requests do not always appear on the page network
   // stream. Keep unattributed 404 notices visible; real HTTP failures below
   // and all ten material maps are still required independently.
   if(/Failed to load resource.*404/.test(item.text))result.resourceWarnings.push(item);
   else result.consoleErrors.push(item);
  });
  page.on('request',request=>{if(/\/assets\/m-v6-web\/part-\d+\.bin(?:\?|$)/.test(request.url()))modelChunkRequests++;});
  page.on('response',response=>{
   if(response.status()>=400&&!icon(response.url()))result.httpErrors.push({url:response.url(),status:response.status()});
  });
  page.on('requestfailed',request=>{
   if(request.failure()?.errorText!=='net::ERR_ABORTED')result.failedRequests.push({url:request.url(),error:request.failure()?.errorText});
  });
  await page.addInitScript(()=>{
   window.__mSmokeGL=[];const original=HTMLCanvasElement.prototype.getContext;const seen=new WeakSet();
   HTMLCanvasElement.prototype.getContext=function(type,...args){
    const gl=original.call(this,type,...args);
    if(gl&&/^webgl/.test(type)&&!seen.has(gl)){
     seen.add(gl);const row={canvas:this,gl,draws:0,clears:0,triangles:0};window.__mSmokeGL.push(row);
     for(const name of['drawElements','drawArrays']){const method=gl[name].bind(gl);gl[name]=(...a)=>{row.draws++;if(a[0]===gl.TRIANGLES)row.triangles+=(name==='drawArrays'?a[2]:a[1])/3;return method(...a);};}
     const clear=gl.clear.bind(gl);gl.clear=(...a)=>{row.clears++;return clear(...a);};
    }
    return gl;
   };
  });
  try{
   const debugURL=new URL(base);debugURL.searchParams.set('m-debug','1');await page.goto(debugURL.href,{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForFunction(()=>{
    const world=document.querySelector('.mascot-world-v9');
    return world?.dataset.model==='V6 GLB HQ'&&world.classList.contains('m-world-3d')&&world.querySelector('canvas');
   },undefined,{timeout:90000});
   await page.waitForTimeout(900);
   async function snapshot(){return page.evaluate(()=>{
    const world=document.querySelector('.mascot-world-v9'),canvas=world.querySelector('canvas'),rect=canvas.getBoundingClientRect(),creature=world.querySelector('.mascot-creature').getBoundingClientRect(),row=window.__mSmokeGL.find(item=>item.canvas===canvas),gl=row?.gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');
    return {dataset:{...world.dataset},svgHidden:!world.querySelector('svg')||getComputedStyle(world.querySelector('svg')).display==='none',
     canvas:{width:canvas.width,height:canvas.height,display:getComputedStyle(canvas).display,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}},
     creatureRect:{x:creature.x,y:creature.y,width:creature.width,height:creature.height},
     viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,touchPoints:navigator.maxTouchPoints},
     jsHeap:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit,scope:'Chrome JavaScript heap only; excludes GPU and system memory.'}:null,
     gpu:gl?{vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)}:null,
     debugAvailable:typeof window.MWorld?.snapshot==='function',debug:typeof window.MWorld?.snapshot==='function'?window.MWorld.snapshot():null};
   });}
   result.hero=await snapshot();
   check(name+': actual V6 and ten detail maps',result.hero.dataset.model==='V6 GLB HQ'&&Number(result.hero.dataset.detailMaps)>=10&&result.hero.svgHidden,result.hero.dataset);
   check(name+': visible high-density canvas',result.hero.canvas.width>=400&&result.hero.canvas.height>=400&&result.hero.canvas.rect.width>0&&result.hero.canvas.rect.height>0&&result.hero.canvas.display!=='none',result.hero.canvas);
   check(name+': intended viewport/touch context',result.hero.viewport.width===options.viewport.width&&(name!=='mobile'||result.hero.viewport.touchPoints>0),result.hero.viewport);
   const heroFile=path.join(artifactDir,'m-'+name+'-hero.png');await page.screenshot({path:heroFile,fullPage:false});report.artifacts.push(heroFile);
   result.performance=await page.evaluate(()=>new Promise(resolve=>{
    const row=window.__mSmokeGL.find(item=>item.canvas.classList.contains('m-world-canvas')),start=performance.now(),draws=row?.draws||0,clears=row?.clears||0,stamps=[];
    function frame(now){stamps.push(now);if(now-start<1500)return requestAnimationFrame(frame);const wallMs=now-start;
     resolve({wallMs,rafFPS:(stamps.length-1)*1000/(stamps.at(-1)-stamps[0]),approximateRenderFPS:row?(row.clears-clears)*1000/wallMs:null,drawCallsPerSecond:row?(row.draws-draws)*1000/wallMs:null,scope:'Warm headless Chrome cadence; not a physical-device performance benchmark.'});}
    requestAnimationFrame(frame);
   }));
   check(name+': live rendering measured',Number.isFinite(result.performance.rafFPS)&&result.performance.approximateRenderFPS>0,result.performance);
   if(name==='desktop'){
    await page.locator('a[href="#projects"]').first().click();
    await page.waitForURL(url=>url.hash==='#projects',{timeout:10000});
    check('Portfolio navigation remains clickable',new URL(page.url()).hash==='#projects');
   }else{const menu=page.locator('.mobile-menu-toggle');
    await menu.press('Enter');
    await page.waitForFunction(()=>document.activeElement?.closest('#primary-nav'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='false'&&document.activeElement===document.querySelector('.mobile-menu-toggle'));
    check('Mobile navigation supports keyboard focus and Escape',true);
    await menu.tap();await page.waitForFunction(()=>document.querySelector('.mobile-menu-toggle').getAttribute('aria-expanded')==='true');await page.locator('#primary-nav a[href="#projects"]').first().tap();await page.waitForURL(url=>url.hash==='#projects');check('Mobile navigation accepts actual touch events',new URL(page.url()).hash==='#projects');}
   await page.waitForTimeout(1100);result.projects=await snapshot();
   result.componentAlignment=await page.evaluate(()=>{
    const s=window.MWorld.snapshot(),rows=[];
    for(const element of document.querySelectorAll('#projects .card')){
     const b=element.getBoundingClientRect();if(b.bottom<0||b.top>innerHeight||!b.width)continue;
     const candidates=s.surfaces.filter(r=>Math.abs(r.width-b.width)<1&&Math.abs(r.height-b.height)<1);
     const error=candidates.length?Math.min(...candidates.map(r=>Math.max(Math.abs(r.top-b.top),Math.abs(r.left-b.left)))):Infinity;
     rows.push({top:b.top,left:b.left,error});
    }
    return {rows,maxError:rows.length?Math.max(...rows.map(r=>r.error)):null};
   });
   check(name+': occluders follow settled CSS card transitions',result.componentAlignment.rows.length>0&&result.componentAlignment.maxError<=1,result.componentAlignment);
   const projectsFile=path.join(artifactDir,'m-'+name+'-projects.png');await page.screenshot({path:projectsFile,fullPage:false});report.artifacts.push(projectsFile);
   result.overflow=await page.evaluate(()=>{
    const layer=document.querySelector('.mascot-world-v9'),old=layer.style.display,current=document.documentElement.scrollWidth-innerWidth;
    layer.style.display='none';const without=document.documentElement.scrollWidth-innerWidth;layer.style.display=old;
    return {currentOverflow:current,baselineOverflow:without,addedByM:current-without};
   });
   check(name+': M adds no horizontal overflow',result.overflow.addedByM<=2,result.overflow);
   const beforeChunks=modelChunkRequests;const toggle=page.locator('.m-world-toggle');
   if(name==='mobile')await toggle.tap();else await toggle.click();
   await page.waitForFunction(()=>document.querySelector('.mascot-world-v9').hidden);
   check(name+': real pause hides M',await toggle.getAttribute('aria-pressed')==='false');
   if(name==='mobile')await toggle.tap();else await toggle.click();
   await page.waitForFunction(()=>!document.querySelector('.mascot-world-v9').hidden);
   check(name+': real resume reuses loaded model',await toggle.getAttribute('aria-pressed')==='true'&&beforeChunks===modelChunkRequests,{beforeChunks,afterChunks:modelChunkRequests});
   result.modelChunkRequests=modelChunkRequests;
   result.resources=await page.evaluate(()=>{
    const resources=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/m-v6')).map(e=>({url:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize}));
    return {resources,encodedBytes:resources.reduce((s,e)=>s+e.encodedBodySize,0),observedTransferBytes:resources.reduce((s,e)=>s+e.transferSize,0),scope:'Same-origin observed resource timing before QA reload; encoded payload and transfer including headers are separate.'};
   });
   const d=result.hero.debug?.renderer;
   check(name+': original rig, full skinning and six clips preserved',d?.bones===31&&d.tailBones===10&&d.maxInfluences===14&&d.skinSets===4&&d.clips?.length===6&&!d.shaderErrors?.length,{bones:d?.bones,tailBones:d?.tailBones,maxInfluences:d?.maxInfluences,skinSets:d?.skinSets,clips:d?.clips,shaderErrors:d?.shaderErrors,render:d?.render,stats:result.hero.debug?.stats});
   result.autonomous=await observeAutonomous(page,name);
   check(name+': autonomous director stays finite and live',result.autonomous.samples.length>80&&result.autonomous.samples.every(s=>s.active&&!s.frozen&&[s.x,s.y,s.depth].every(Number.isFinite)),{observedModes:result.autonomous.observedModes,observedPhases:result.autonomous.observedPhases,events:result.autonomous.events,maxFrameStep:result.autonomous.maxFrameStep});
   if(name==='desktop'){result.livePerch=await exerciseLivePerch(page);const p=result.livePerch;check('Desktop production perch stays attached while scrolling',p.available&&p.atContact!==null&&p.scrollAt!==null&&p.afterScrollHoldSamples>=5&&p.maxAfterScrollFootGap<=3,p);}
   result.depthPixels=await pixelEvidence(page,name+'-depth','.hero-visual',report.artifacts);
   if(result.depthPixels.available){const p=result.depthPixels;
    check(name+': real GPU card occlusion changes actual pixels',p.actorShift<=.5&&p.pixels.groups.card.frontBackChanged>50&&p.pixels.groups.outsideCard.behindEmptyChanged>100&&p.pixels.groups.card.behindEmptyChanged<Math.max(5,p.pixels.groups.card.pixels*.001),p);
   }else check(name+': real GPU depth fixture available',false,result.depthPixels);
   if(name==='desktop'){
    result.textPixels=await pixelEvidence(page,name+'-text','.about-statement',report.artifacts);
    if(result.textPixels.available){const p=result.textPixels,g=p.pixels.groups;
     check('Desktop text shield preserves actual paragraph pixels',p.actorShift<=.5&&g.protectedInterior.pixels>500&&g.protectedInterior.frontEmptyChanged===0&&g.actor.frontEmptyChanged>100,p);
    }else check('Desktop text fixture available',false,result.textPixels);
   }
   result.qaTotalModelRequests=modelChunkRequests;
   check(name+': no JS or asset network failures',!result.consoleErrors.length&&!result.pageErrors.length&&!result.httpErrors.length&&!result.failedRequests.length,
    {consoleErrors:result.consoleErrors,pageErrors:result.pageErrors,httpErrors:result.httpErrors,failedRequests:result.failedRequests,resourceWarnings:result.resourceWarnings});
  }catch(error){result.error=String(error.stack||error);check(name+': smoke execution',false,{error:String(error.message||error)});}
  finally{report.contexts.push(result);await context.close();}
 }
 report.passed=report.checks.length>0&&report.checks.every(item=>item.passed);
}catch(error){report.error=String(error.stack||error);check('Browser launch/execution',false,{error:String(error.message||error)});}
finally{
 if(browser){try{await browser.close();}catch(error){report.browserCloseError=String(error);check('Browser closes cleanly',false,{error:String(error)});}}
 report.passed=!report.error&&report.checks.length>0&&report.checks.every(item=>item.passed);report.finishedAt=new Date().toISOString();
 writeFileSync(path.join(artifactDir,'smoke-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,browserVersion:report.browserVersion,artifactDir,failed:report.checks.filter(item=>!item.passed).map(item=>item.name)}));
 if(!report.passed)process.exitCode=1;
}