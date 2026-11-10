/** Real Chrome QA: diagnostic weather demos with original V6 mascot. */
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright-core');
const browserPath=process.env.CHROME_BIN||[
 '/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/opt/google/chrome/chrome',
 '/usr/bin/chromium','/usr/bin/chromium-browser'
].find(existsSync);
if(!browserPath||!existsSync(browserPath))throw Error('Chrome executable is required');
const base=process.env.BASE_URL||'http://127.0.0.1:4173/';
const folder=process.env.M_WORLD_ARTIFACT_DIR||'/tmp/m-world-v24';
mkdirSync(folder,{recursive:true});
let browser;const report=[];
const assert=(condition,message,detail={})=>{
 report.push({name:message,passed:Boolean(condition),detail});
 if(!condition)throw Error(message+': '+JSON.stringify(detail));
};
try{
 browser=await chromium.launch({headless:true,executablePath:browserPath});
 for(const mode of ['rain','wind','sun']){
  const context=await browser.newContext({
   viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,
   reducedMotion:'no-preference'
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('?m-debug=1&m-weather-demo='+mode,base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.MWorld?.snapshot()?.ready,{timeout:90000});
  await page.waitForTimeout(1500);
  const result=await page.evaluate(()=>{
   const status=document.querySelector('.m-weather-status'),sky=document.querySelector('.m-weather-sky');
   const credit=document.querySelector('#expertise .integration-credit');
   const snap=window.MWorld.snapshot();
   const link=credit?.querySelector('a[href="https://api.met.no/"]'),canvas=sky?.querySelector('canvas');
   return {mode:snap.weather.condition,ready:snap.ready,umbrella:snap.renderer?.weather?.umbrella,
    umbrellaFade:snap.renderer?.weather?.fade,radiusRatio:snap.renderer?.weather?.radiusRatio,
    anchoredToHand:snap.renderer?.weather?.anchoredToHand,
    gripErrorRatio:snap.renderer?.weather?.gripErrorRatio,
    crownClearanceRatio:snap.renderer?.weather?.crownClearanceRatio,
    canopyDepthRatio:snap.renderer?.weather?.canopyDepthRatio,
    shaftRadiusRatio:snap.renderer?.weather?.shaftRadiusRatio,
    frames:snap.stats?.frames,active:snap.active,frozen:snap.frozen,
    gesture:snap.state?.gesture?.name,characterIntent:snap.character?.performance?.intent,
    reduced:snap.preferences?.reducedMotion,
    statusAbsent:!status,creditText:credit?.textContent,skyActive:!sky.hidden,weatherSource:snap.weather.source,
    skyPointerEvents:getComputedStyle(sky).pointerEvents,canvasSize:[canvas?.width,canvas?.height],
    hasAttribution:Boolean(link),reducedMotion:snap.preferences?.reducedMotion,
    error:snap.error};
  });
  assert(result.ready&&result.error===null,'original 3D character loads in '+mode,result);
  assert(result.weatherSource.includes('DEMO'),'diagnostic weather stays marked simulated in model in '+mode,result);
  assert(result.statusAbsent,'no weather forecast badge overlays the portfolio in '+mode,result);
  assert(result.hasAttribution&&result.creditText.includes('MET Norway'),
   'MET Norway credit is linked in the Integrations section in '+mode,result);
  assert(result.skyPointerEvents==='none','weather sky never catches pointer input in '+mode,result);
  assert(Boolean(result.umbrella)===(mode==='rain'),'umbrella follows rain only in '+mode,result);
  if(mode==='rain'){
   assert(Math.abs(result.radiusRatio-.42)<.00001,'V69 canopy must scale to M height',result);
   assert(Math.abs(result.canopyDepthRatio-.20)<.00001,'V69 umbrella must have real dome depth',result);
   assert(result.shaftRadiusRatio>.015,'V69 pole must remain visibly thick',result);
   assert(result.anchoredToHand===true,'V68 umbrella grip must follow Hand.L',result);
   assert(Number.isFinite(result.gripErrorRatio)&&result.gripErrorRatio<.18,
    'V68 grip should stay near the animated paw',result);
   assert(Number.isFinite(result.crownClearanceRatio)&&result.crownClearanceRatio>-.06,
    'V68 umbrella crown must not collapse into the face',result);
  }
  assert(result.skyActive===(mode!=='sun'),'ambient layer matches conditions in '+mode,result);
  assert(result.canvasSize[0]>0,'weather canvas has valid pixel dimensions in '+mode,result);
  assert(errors.length===0,'no page JavaScript exceptions in '+mode,{errors});
  await page.screenshot({path:path.join(folder,'v67-weather-'+mode+'.png')});
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.goto(new URL('?m-debug=1&m-weather-demo=rain',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.MWorld?.snapshot()?.ready,{timeout:90000});
 const reduced=await page.evaluate(()=>{
  const s=window.MWorld.snapshot();
  return {weather:s.weather,umbrella:s.renderer?.weather?.umbrella,reduced:s.preferences.reducedMotion};
 });
 assert(reduced.reduced&&reduced.weather.active===false&&reduced.umbrella===false,
  'reduced-motion preference suppresses both particles and umbrella',reduced);
 await context.close();
}finally{
 if(browser)await browser.close();
 writeFileSync(path.join(folder,'v67-weather-browser-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({checks:report.length,passed:report.every(x=>x.passed),failed:report.filter(x=>!x.passed)}));
}
