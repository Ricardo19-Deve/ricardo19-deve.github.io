/** Native chat-layout regression. Real production companion/CSS; fixture replies, no provider calls. */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {homedir,tmpdir} from 'node:os';
const root=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
let chromium;for(const id of [process.env.PLAYWRIGHT_MODULE,'playwright-core','playwright',path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)){try{({chromium}=require(id));break;}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}}
if(!chromium)throw new Error('Provide Playwright through PLAYWRIGHT_MODULE.');
const executablePath=process.env.CHROME_BIN||[path.join(homedir(),'AppData/Local/Google/Chrome/Application/chrome.exe'),'/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if(!executablePath)throw new Error('Installed native Chrome is unavailable.');
const out=process.env.M_WORLD_CHAT_ARTIFACT_DIR||path.join(tmpdir(),'m-world-chat-layout');mkdirSync(out,{recursive:true});
const ordinary=('I live among the lights and quiet corners of this portfolio. I like following a new path, then finding a familiar lookout to remember what I discovered. My next adventure can wait while you read.\n\n').repeat(5).slice(0,700),unbroken='W'.repeat(700);
const report={checks:[],profiles:[],errors:[],blockedProviderRequests:0,scope:'Installed native Chrome, production companion module and portfolio styles/background, isolated from the 3D actor. Responses and completed story state are labelled UI fixtures. Tests do not advance a real character or contact a provider. Keyboard geometry is simulated through visualViewport events, not a physical OS keyboard.',passed:false};
const check=(name,passed,details)=>{report.checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});console.log(JSON.stringify({check:name,passed:Boolean(passed)}));};
const mount=`<script type="module">
import {createMCompanion} from './m-world-companion.mjs?chat-layout=27';
const keyboard=new URL(location.href).searchParams.has('keyboard');
if(keyboard){const viewport=new EventTarget();viewport.height=innerHeight;viewport.offsetTop=0;window.__chatKeyboardViewport=viewport;Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});}
const context={version:1,chapter:'small-light',beat:'complete',goal:'explore',discovery:'little-light',preference:'quiet-lookouts',recall:'returning',favoriteComponent:'project-epoxy'};
const journal=Array.from({length:12},(_,i)=>({id:i===0?'light-found':i===1?'lookout-found':'lookout-revisited',atMs:1000+i,visit:i+1,componentId:i===0?null:'project-epoxy',publicComponent:i===0?null:'project-epoxy'}));
window.__chatFixture={effects:[],companion:createMCompanion({endpoint:new URL('/api/m/respond',location.href).href,getContext:()=>({section:'projects',language:'en',component:'project-epoxy',character:context}),getCharacterStatus:()=>({...context,remember:true,storageAvailable:true,visits:12,journal,favorite:{stableId:'project-epoxy',publicId:'project-epoxy'}}),onGesture:name=>{window.__chatFixture.effects.push(name);return true;},onAffect:()=>true,onGame:()=>false})};
</script>`;
const html=readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[^>]*src=["']scroll-buddy\.js[^"']*["'][^>]*>\s*<\/script>/u,'').replace('</body>',mount+'</body>');
const requests=[];
const server=createServer(async(request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 if(url.pathname==='/__m_chat_layout__'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
 if(url.pathname==='/health'){response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({configured:true,contextualChat:{version:1},character:{version:1},director:{version:1,enabled:false}}));return;}
 if(url.pathname==='/api/m/respond'){
  let raw='';for await(const chunk of request)raw+=chunk;if(raw.length>8192){response.writeHead(413);response.end();return;}
  const body=JSON.parse(raw);requests.push(body);response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({reply:body.message.includes('unbroken')?unbroken:ordinary,expression:'neutral',gesture:'none',section:'none'}));return;
 }
 const candidate=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!candidate.startsWith(root+path.sep)||!existsSync(candidate)){response.writeHead(404);response.end();return;}
 try{const ext=path.extname(candidate),type={'.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'}[ext]||'application/octet-stream';response.writeHead(200,{'content-type':type});response.end(readFileSync(candidate));}catch{response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,executablePath});
async function geometry(page){return page.evaluate(()=>{
 const panel=document.querySelector('.m-companion'),body=document.querySelector('.m-companion-body'),log=document.querySelector('.m-companion-log'),form=document.querySelector('.m-companion-form'),input=form.querySelector('textarea'),send=form.querySelector('.m-companion-send'),last=log.querySelector('.assistant:last-child');
 const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},p=rect(panel),b=rect(body),l=rect(log),f=rect(form);
 const visible=Math.max(0,Math.min(b.bottom,l.bottom)-Math.max(b.top,l.top));
 const overflow=[panel,body,log,form,input,...log.children].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({class:el.className,client:el.clientWidth,scroll:el.scrollWidth}));
 const hits=el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===el;};
 return {panel:p,body:b,log:l,form:f,visibleLog:visible,overflow,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,bodyScroll:body.scrollTop,logScrollHeight:log.scrollHeight,lastLength:last?.textContent.length,lastText:last?.textContent,lastTop:last?.getBoundingClientRect().top,inputHit:hits(input),sendHit:hits(send),keyboard:panel.dataset.keyboardOpen,visibleHeight:window.visualViewport?.height||innerHeight};
 });}
try{
 for(const profile of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844},{name:'small-mobile',width:320,height:568},{name:'keyboard',width:390,height:844,keyboard:true}]){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:profile.width<700,hasTouch:profile.width<700});
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(/(^|\.)openai\.com$/.test(url.hostname)||url.hostname.endsWith('.workers.dev')){report.blockedProviderRequests++;return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push({profile:profile.name,error:String(error)}));
  await page.goto(base+'/__m_chat_layout__'+(profile.keyboard?'?keyboard=1':''));await page.waitForFunction(()=>window.__chatFixture);await page.evaluate(()=>document.fonts.ready);
  await page.getByRole('button',{name:'Talk to M',exact:true}).click();
  const input=page.locator('#m-companion-message');await input.fill('A full answer, please');await input.press('Enter');await page.waitForFunction(()=>document.querySelector('.m-companion-message.assistant')?.textContent.length===700);
  if(profile.keyboard)await page.evaluate(()=>{window.__chatKeyboardViewport.height=420;window.__chatKeyboardViewport.dispatchEvent(new Event('resize'));});
  const first=await geometry(page);
  check(profile.name+': full reply and readable message viewport',first.lastText===ordinary&&first.log.height>=150&&first.visibleLog>=120,first);
  check(profile.name+': composer and Send remain visible',first.inputHit&&first.sendHit&&first.form.bottom<=first.panel.bottom+1,first.form);
  check(profile.name+': new long reply starts at its beginning',first.lastTop>=first.log.top-1&&first.lastTop<first.log.top+28,{replyTop:first.lastTop,logTop:first.log.top});
  check(profile.name+': no horizontal overflow',!first.pageOverflow&&!first.overflow.length,first.overflow);
  check(profile.name+': panel fits the available viewport',first.panel.top>=-1&&first.panel.right<=profile.width+1&&first.panel.bottom<=first.visibleHeight+1,first.panel);
  await page.screenshot({path:path.join(out,profile.name+'-reply.png')});
  const before=requests.length;await input.fill('Draft line');await input.press('Shift+Enter');check(profile.name+': Shift+Enter edits without sending',await input.inputValue()==='Draft line\n'&&requests.length===before);
  await page.evaluate(()=>{for(const details of document.querySelectorAll('.m-companion details'))details.open=true;document.querySelector('.m-companion-body').scrollTop=10000;});
  await input.fill('Please return an unbroken answer');await input.press('Enter');await page.waitForFunction(()=>document.querySelector('.m-companion-message.assistant:last-child')?.textContent==='W'.repeat(700));
  const expanded=await geometry(page);
  check(profile.name+': expanded tools cannot collapse the response',expanded.log.height>=150&&expanded.visibleLog>=120&&expanded.bodyScroll===0,expanded);
  check(profile.name+': unbroken text wraps and retains all 700 characters',expanded.lastText===unbroken&&!expanded.overflow.length&&!expanded.pageOverflow,expanded.overflow);
  check(profile.name+': entire log viewport stays inside its scroller',expanded.visibleLog>=expanded.log.height-1,{visible:expanded.visibleLog,height:expanded.log.height});
  check(profile.name+': input stays usable with expanded tools',expanded.inputHit&&expanded.sendHit);
  await page.screenshot({path:path.join(out,profile.name+'-expanded.png')});
  if(profile.keyboard){await page.evaluate(()=>{window.__chatKeyboardViewport.height=innerHeight;window.__chatKeyboardViewport.dispatchEvent(new Event('resize'));});check(profile.name+': hiding keyboard restores normal placement',(await geometry(page)).keyboard==='false');}
  report.profiles.push({...profile,ordinary:first,expanded});await context.close();
 }
 check('all explicit fixture responses submitted once and no provider calls or script errors',requests.length===8&&report.blockedProviderRequests===0&&report.errors.length===0,{requests:requests.length,blocked:report.blockedProviderRequests,errors:report.errors});
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));report.passed=report.checks.every(row=>row.passed);writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(row=>!row.passed).map(row=>row.name),out}));}
if(!report.passed)process.exitCode=1;
