import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visualDepthMasks} from './m-world-occlusion.mjs';
import {createMicroMotion} from './m-world-micro-motion.mjs';
import {analyticsUrl,sessionToken,recordPortfolioVisit} from './m-analytics-client.mjs';
import worker,{visitBody,normalizePath,lisbonDay,constantTimeMatch} from './analytics/worker.mjs';

test('V29 behind-card M is occluded by the card rather than rectangular text cutouts',()=>{
 const card=[{left:0,top:0,width:200,height:180,radius:20}],text=[{left:30,top:40,width:100,height:30}];
 assert.deepEqual(visualDepthMasks({depth:-1,surfaces:card,protectedRects:text}),{surfaces:card,protectedRects:[]});
 assert.deepEqual(visualDepthMasks({depth:1,surfaces:card,protectedRects:text}),{surfaces:[],protectedRects:[]});
 assert.deepEqual(visualDepthMasks({depth:0,surfaces:card,protectedRects:text}),{surfaces:[],protectedRects:[]});
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(renderer,/visualDepthMasks\(\{depth,surfaces:frame.surfaces,protectedRects:frame.protectedRects\}\)/);
 assert.match(renderer,/updateBatch\(surfaceBatch,masks.surfaces/);
 assert.match(renderer,/updateBatch\(protectedBatch,masks.protectedRects/);
});

test('V29 micro-motion adds bounded quiet breathing, anticipation and settle',()=>{
 const m=createMicroMotion();let last;
 for(let k=0;k<50;k++)last=m.sample({dt:1/60,aboutToMove:true});
 assert.ok(Math.abs(last.lift)<.02&&Math.abs(last.pitch)<.03);
 for(let k=0;k<25;k++)m.sample({dt:1/60,vx:120});
 let foundSettle=false;
 for(let k=0;k<30;k++){const x=m.sample({dt:1/60,vx:0});foundSettle||=x.settle>0;}
 assert.ok(foundSettle);
});

test('V29 micro-motion neutralizes immediately for manual gestures and accessibility',()=>{
 const m=createMicroMotion();for(let k=0;k<30;k++)m.sample({dt:1/60,vx:150});
 const neutral=m.sample({dt:1/60,reducedMotion:true});
 assert.deepEqual(neutral,{lift:0,pitch:0,roll:0,scale:0,breath:0,anticipation:0,settle:0});
 assert.deepEqual(m.sample({dt:1/60,gestureActive:true}),neutral);
 for(const n of Object.values(m.sample({dt:NaN,vx:Infinity,vy:-Infinity})))assert.ok(Number.isFinite(n));
});

test('V29 only publicly supported paths may report pageviews',()=>{
 assert.equal(normalizePath('/'),'/');
 assert.equal(normalizePath('/revmend.html'),'/revmend.html');
 for(const p of ['/admin','/other','https://example.com','/../admin',null])assert.equal(normalizePath(p),null);
 assert.equal(visitBody({session:'00000000-0000-4000-8000-000000000000',path:'/'}).path,'/');
 for(const x of [{path:'/',session:'invalid'},{path:'/',session:'00000000-0000-4000-8000-000000000000',evil:1},null])assert.equal(visitBody(x),null);
});

test('V29 analytics timestamps follow Lisbon calendar days',()=>{
 assert.equal(lisbonDay(new Date('2026-06-04T23:30:00Z')),'2026-06-05');
 assert.equal(lisbonDay(new Date('2026-11-04T23:30:00Z')),'2026-11-04');
 assert.equal(constantTimeMatch('Bearer secret','Bearer secret'),true);
 assert.equal(constantTimeMatch('Bearer secret','Bearer other'),false);
});

test('V29 visit client validates a public endpoint and uses tab-only session storage',()=>{
 assert.equal(analyticsUrl('https://a.example.workers.dev/api/visit'),'https://a.example.workers.dev/api/visit');
 for(const x of ['', 'http://a.example/api/visit','https://a.example/admin','https://a.example/api/visit?token=bad','javascript:bad'])assert.equal(analyticsUrl(x),null);
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const token='00000000-0000-4000-8000-000000000000';
 assert.equal(sessionToken({storage,cryptoImpl:{randomUUID:()=>token}}),token);
 assert.equal(sessionToken({storage,cryptoImpl:{randomUUID:()=>assert.fail('reuse expected')}}),token);
 assert.equal(values.size,1);
});

test('V29 visitor analytics avoids DNT/GPC and never sends private context',async()=>{
 const endpoint='https://analytics.example.workers.dev/api/visit';
 const locationImpl={protocol:'https:',hostname:'ricardo19-deve.github.io',pathname:'/'};
 let sent=[];
 const f=async(url,init)=>{sent.push({url,init});return {ok:true};};
 const cryptoImpl={randomUUID:()=> '00000000-0000-4000-8000-000000000000'};
 const storage={getItem:()=>null,setItem:()=>{}};
 for(const navigatorImpl of [{doNotTrack:'1'},{globalPrivacyControl:true}]){
  assert.equal(await recordPortfolioVisit({endpoint,locationImpl,navigatorImpl,fetchImpl:f,cryptoImpl,storage}),false);
 }
 assert.equal(sent.length,0);
 assert.equal(await recordPortfolioVisit({endpoint,locationImpl,navigatorImpl:{doNotTrack:'0'},fetchImpl:f,cryptoImpl,storage}),true);
 const payload=JSON.parse(sent[0].init.body);
 assert.deepEqual(Object.keys(payload).sort(),['path','session']);
 assert.equal(sent[0].init.credentials,'omit');
 assert.equal(sent[0].init.referrerPolicy,'no-referrer');
});

test('V29 private analytics requires secret and keeps public ingestion origin-bound',async()=>{
 const req=(path,opts={})=>new Request('https://analytics.example'+path,opts);
 const env={PUBLIC_ORIGIN:'https://ricardo19-deve.github.io',ADMIN_TOKEN:'a-long-owner-only-secret',
  ANALYTICS_DB:{prepare(){return {bind(){return this;}}},async batch(){return [{results:[]},{results:[]}]}}};
 assert.equal((await worker.fetch(req('/api/summary'),env)).status,401);
 assert.equal((await worker.fetch(req('/api/summary',{headers:{Authorization:'Bearer wrong'}}),env)).status,401);
 const authorized=await worker.fetch(req('/api/summary',{headers:{Authorization:'Bearer a-long-owner-only-secret'}}),env);
 assert.equal(authorized.status,200);
 const sample=await authorized.json();
 assert.equal(sample.timezone,'Europe/Lisbon');
 assert.equal(sample.series.length,30);
 const denied=await worker.fetch(req('/api/visit',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env);
 assert.equal(denied.status,403);
 const allowed=await worker.fetch(req('/api/visit',{method:'POST',headers:{Origin:'https://ricardo19-deve.github.io'},body:JSON.stringify({path:'/',session:'00000000-0000-4000-8000-000000000000'})}),env);
 assert.equal(allowed.status,200);
 assert.equal((await worker.fetch(req('/health'),env)).status,200);
});

test('V29 private dashboard contains no access token and is search-blocked',async()=>{
 const response=await worker.fetch(new Request('https://analytics.example/admin'),{});
 const html=await response.text();
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/Chave privada/);
 assert.doesNotMatch(html,/ADMIN_TOKEN|a-long-owner-only-secret/);
 assert.match(response.headers.get('Content-Security-Policy'),/script-src 'self'/);
 const script=await worker.fetch(new Request('https://analytics.example/admin.js'),{});
 assert.equal(script.status,200);
 assert.match(await script.text(),/Bearer/);
});

test('V29 questions-only UI keeps M controls diagnostic-only',()=>{
 const ui=readFileSync(new URL('m-world-companion.mjs',import.meta.url),'utf8');
 assert.match(ui,/panel.dataset.mode='questions'/);
 assert.match(ui,/if\(diagnostics\)debugPanel.append\(debugHeader,actions/);
 assert.match(ui,/conversation.append\(intro,log,status,privacy\)/);
 assert.match(ui,/settingsPanel.append\(settingsHeader,settingsIntro/);
 assert.match(ui,/if\(diagnostics\)document.body.append\(toggle,privacyToggle,settingsPanel,debugToggle,debugPanel,panel\)/);
 assert.match(ui,/What has Ricardo built\?/);
 assert.match(ui,/How does Ricardo use AI\?/);
 assert.match(ui,/prompts.hidden=true/);
});
