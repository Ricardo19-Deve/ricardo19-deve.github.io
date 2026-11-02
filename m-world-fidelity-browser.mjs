import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {homedir} from 'node:os';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const base=process.env.BASE_URL||'http://127.0.0.1:4183/';
const out=path.resolve(process.env.M_WORLD_ARTIFACT_DIR||'../work/M_Live_Fidelity_Validation/quality');mkdirSync(out,{recursive:true});
const report={url:base,scope:'Native Chrome render quality and performance, real original V6 actor. API requests blocked. Mobile is emulated, not a physical device.',checks:[],profiles:[],passed:false};
const check=(name,passed,details)=>report.checks.push({name,passed:Boolean(passed),details});
const profiles=[['desktop-dpr1',{viewport:{width:1280,height:900},deviceScaleFactor:1}],['desktop-dpr2.5',{viewport:{width:1280,height:900},deviceScaleFactor:2.5}],['mobile-dpr1',{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}],['mobile-dpr3',{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}]];
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe')});report.browser=browser.version();
try{
 for(const [name,options] of profiles){
  const context=await browser.newContext({...options,reducedMotion:'no-preference'}),errors=[],warnings=[];let apiRequests=0;
  await context.route(/api\.openai\.com|\/api\/m\/respond(?:[?#]|$)/,route=>{apiRequests++;return route.abort('blockedbyclient');});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning'&&/M 3D|shader|WebGL/.test(m.text()))warnings.push(m.text());});
  const url=new URL(base);url.searchParams.set('m-debug','1');await page.goto(url.href);await page.waitForFunction(()=>window.MWorld?.snapshot().ready&&window.MWorld.snapshot().stats.frames>30,undefined,{timeout:90000});
  const result=await page.evaluate(async()=>{
   const samples=[],cpu=[],start=performance.now(),first=MWorld.snapshot().stats.frames;let last=start;
   while(performance.now()-start<3000){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;cpu.push(MWorld.snapshot().stats.lastFrameMs);}
   const s=MWorld.snapshot(),canvas=document.querySelector('.m-world-canvas'),style=getComputedStyle(canvas),b=canvas.getBoundingClientRect();
   const sorted=a=>[...a].sort((x,y)=>x-y),q=(a,p)=>sorted(a)[Math.floor(a.length*p)];
   return {dpr:devicePixelRatio,renderer:s.renderer,stats:s.stats,actor:s.actor,canvas:{width:b.width,height:b.height,cssWidth:style.width,cssHeight:style.height,filter:style.filter},performance:{rafFPS:samples.length*1000/(performance.now()-start),renderFPS:(s.stats.frames-first)*1000/(performance.now()-start),frameP95:q(samples,.95),cpuP95:q(cpu,.95),heap:performance.memory?.usedJSHeapSize}};
  });
  const size=name.startsWith('mobile')?208:272,ratio=Math.max(2,Math.min(options.deviceScaleFactor,name.startsWith('mobile')?2:2.5));
  check(name+': supersampled facial detail within bounded framebuffer',result.renderer.viewportSize===size&&result.renderer.pixelRatio===ratio&&result.renderer.renderPixels.every(n=>n===size*ratio),{viewport:size,pixelRatio:result.renderer.pixelRatio,pixels:result.renderer.renderPixels});
  check(name+': original rig, detail maps and full skinning preserved',result.renderer.bones===31&&result.renderer.maxInfluences===14&&result.renderer.skinSets===4&&result.renderer.clips.length===6&&result.renderer.detailMaps===10&&!result.renderer.shaderErrors.length,{bones:result.renderer.bones,maxInfluences:result.renderer.maxInfluences,detailMaps:result.renderer.detailMaps,warnings});
  check(name+': native rendering remains live and finite',result.performance.renderFPS>0&&result.performance.cpuP95<50&&Number.isFinite(result.performance.frameP95),result.performance);
  check(name+': canvas CSS is unscaled and unfiltered',Math.abs(result.canvas.width-size)<.1&&Math.abs(result.canvas.height-size)<.1&&result.canvas.filter==='none',result.canvas);
  const screenshot=path.join(out,name+'.png');await page.screenshot({path:screenshot,scale:'css'});
  if(name==='desktop-dpr1'){
   await page.setViewportSize({width:700,height:900});await page.waitForFunction(()=>MWorld.snapshot().renderer.renderPixels[0]===416);await page.setViewportSize(options.viewport);await page.waitForFunction(()=>MWorld.snapshot().renderer.renderPixels[0]===544);check(name+': responsive resize restores the correct quality budget',true);
  }
  check(name+': no JavaScript errors or AI requests',!errors.length&&!apiRequests,{errors,apiRequests});
  report.profiles.push({name,...result,errors,warnings,apiRequests,screenshot});await context.close();
 }
}finally{await browser.close();}
report.passed=report.checks.every(c=>c.passed);writeFileSync(path.join(out,'quality-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),profiles:report.profiles.map(p=>({name:p.name,pixels:p.renderer.renderPixels,performance:p.performance})),out},null,2));if(!report.passed)process.exitCode=1;