import puppeteer from 'puppeteer-core';
import {existsSync,mkdirSync} from 'node:fs';

const executable=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']
 .find(p=>existsSync(p))||process.env.CHROME_BIN;
if(!executable)throw new Error('No headless Chrome available on runner');
const browser=await puppeteer.launch({headless:true,executablePath:executable,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader',
  '--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
const errors=[],badRequests=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('404 (File not found)'))errors.push(msg.text());});
page.on('requestfailed',req=>badRequests.push(req.url()+' '+req.failure()?.errorText));
const url='http://127.0.0.1:4173/';
try {
 await page.setViewport({width:1280,height:820,deviceScaleFactor:2});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForFunction(()=>document.querySelector('.mascot-world-v9.m-world-3d canvas'),{
  timeout:90000,polling:350
 });
 await new Promise(resolve=>setTimeout(resolve,900));
 const diagnostic=await page.evaluate(()=>{
  const world=document.querySelector('.mascot-world-v9'),canvas=world.querySelector('canvas');
  return {model:world.dataset.model,ready:world.classList.contains('m-world-3d'),\n   detailMaps:Number(world.dataset.detailMaps||0),depth:world.dataset.depth,
   width:canvas.width,height:canvas.height,display:getComputedStyle(canvas).display,
   svgHidden:getComputedStyle(world.querySelector('svg')).display==='none',
   toggleVisible:Boolean(document.querySelector('.m-world-toggle'))};
 });
 console.log('M 3D in-browser diagnostic',JSON.stringify(diagnostic));
 if(!diagnostic.ready||diagnostic.model!=='V6 GLB HQ'||!diagnostic.svgHidden||diagnostic.width<500||diagnostic.detailMaps<9)
  throw new Error('The real Blender V6 did not replace the old SVG');
 mkdirSync('/tmp/m-world-smoke',{recursive:true});
 await page.screenshot({path:'/tmp/m-world-smoke/m-desktop.png',fullPage:false});
 await page.click('a[href="#projects"]');
 await new Promise(resolve=>setTimeout(resolve,400));
 if(!page.url().includes('#projects'))throw new Error('The main portfolio links were blocked');
 await page.setViewport({width:390,height:780,deviceScaleFactor:2});
 await new Promise(resolve=>setTimeout(resolve,1000));
 await page.screenshot({path:'/tmp/m-world-smoke/m-mobile.png',fullPage:false});
 const mobile=await page.evaluate(()=>{
  const layer=document.querySelector('.mascot-world-v9');
  const currentOverflow=document.documentElement.scrollWidth-window.innerWidth;
  layer.style.display='none';
  const baselineOverflow=document.documentElement.scrollWidth-window.innerWidth;
  layer.style.display='';
  const culprits=[...document.querySelectorAll('body *')].filter(el=>{
   const r=el.getBoundingClientRect();
   return r.right>window.innerWidth+20 && getComputedStyle(el).position!=='fixed';
  }).slice(0,8).map(el=>({tag:el.tagName,selector:el.className?.baseVal||el.className||el.id,right:Math.round(el.getBoundingClientRect().right)}));
  return {currentOverflow,baselineOverflow,
   addedByM:currentOverflow-baselineOverflow,culprits,
   pauseButton:document.querySelector('.m-world-toggle')?.getBoundingClientRect().width};
 });
 console.log('Mobile diagnostic',JSON.stringify(mobile));
 if(mobile.addedByM>2)throw new Error('M World introduced extra horizontal overflow');
 if(errors.length||badRequests.length){
  console.error('Browser errors:',errors,'Failed network:',badRequests);
  throw new Error('Browser console or request failures');
 }
 console.log('M V6 passed desktop+mobile smoke checks');
} catch(error){
 console.error('M World browser smoke failed:',error);
 console.error('Page errors:',errors.slice(0,20));
 console.error('Request failures:',badRequests.slice(0,20));
 throw error;
} finally {await browser.close();}
