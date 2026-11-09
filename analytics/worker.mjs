/**
 * V29 private portfolio analytics. No cookies, IP addresses, User-Agents, referrers
 * or visitor payloads are saved. No vendor scripts. D1 stores only daily totals,
 * page totals and 35 days of short-lived session hashes. The admin API is gated
 * with an owner-only Wrangler secret, never a public frontend token.
 */
import {adminHtml,adminScript} from './admin-page.mjs';

const PATHS=new Set(['/','/salesforce-mobile.html','/revmend.html','/epoxy-platform.html']);
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const j=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...extra}});
const failure=(code,status=400)=>j({error:code},status);
export const normalizePath=raw=>typeof raw==='string'&&PATHS.has(raw)?raw:null;
export function lisbonDay(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=type=>parts.find(p=>p.type===type)?.value;
 return [get('year'),get('month'),get('day')].join('-');
}
export const visitBody=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='path,session'&&normalizePath(value.path)&&typeof value.session==='string'&&/^[a-f0-9-]{36}$/iu.test(value.session)?{path:value.path,session:value.session}:null;
export function constantTimeMatch(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 // Hash inputs to a uniform fixed width, then compare every character.
 let difference=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return difference===0;
}
const allowedOrigin=env=>env?.PUBLIC_ORIGIN||'https://ricardo19-deve.github.io';
const cors=origin=>({'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'7200','Vary':'Origin'});
async function capture(request,env){
 const origin=request.headers.get('Origin');
 if(origin!==allowedOrigin(env))return failure('origin-not-allowed',403);
 const headers=cors(origin);
 if(!env?.ANALYTICS_DB)return failure('database-not-configured',503);
 if(Number(request.headers.get('Content-Length')||0)>1024)return failure('body-too-large',413);
 let payload;
 try{
  const raw=await request.text();if(raw.length>1024)return failure('body-too-large',413);
  payload=visitBody(JSON.parse(raw));
 }catch{return failure('invalid-json');}
 if(!payload)return failure('invalid-visit');
 const day=lisbonDay();
 const hashBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(day+':'+payload.session));
 const hash=Array.from(new Uint8Array(hashBytes),n=>n.toString(16).padStart(2,'0')).join('');
 // D1 batch runs sequentially in a transaction; its second query derives the
 // *actual* number of distinct session hashes. Two tabs cannot double count.
 await env.ANALYTICS_DB.batch([
  env.ANALYTICS_DB.prepare('INSERT OR IGNORE INTO daily_sessions(day, session_hash) VALUES (?,?)').bind(day,hash),
  env.ANALYTICS_DB.prepare(`INSERT INTO daily_totals(day, pageviews, sessions)
   VALUES (?,1,(SELECT COUNT(*) FROM daily_sessions WHERE day=?))
   ON CONFLICT(day) DO UPDATE SET
    pageviews=daily_totals.pageviews+1,
    sessions=(SELECT COUNT(*) FROM daily_sessions WHERE day=?)`).bind(day,day,day),
  env.ANALYTICS_DB.prepare(`INSERT INTO daily_pages(day,path,pageviews) VALUES (?,?,1)
    ON CONFLICT(day,path) DO UPDATE SET pageviews=daily_pages.pageviews+1`).bind(day,payload.path)
 ]);
 return j({ok:true},200,headers);
}
async function summary(request,env){
 if(!env?.ADMIN_TOKEN||!env?.ANALYTICS_DB)return failure('private-analytics-not-configured',503);
 const bearer=request.headers.get('Authorization')||'';
 if(!constantTimeMatch(bearer,'Bearer '+env.ADMIN_TOKEN))return failure('unauthorized',401);
 const url=new URL(request.url),days=Math.max(1,Math.min(90,Number.parseInt(url.searchParams.get('days')||'30',10)||30));
 const today=lisbonDay(),startDate=new Date(Date.now()-(days+2)*86400000).toISOString().slice(0,10);
 const [totals,pages]=await env.ANALYTICS_DB.batch([
  env.ANALYTICS_DB.prepare('SELECT day, pageviews, sessions FROM daily_totals WHERE day>=? ORDER BY day ASC').bind(startDate),
  env.ANALYTICS_DB.prepare('SELECT path, SUM(pageviews) AS pageviews FROM daily_pages WHERE day>=? GROUP BY path ORDER BY pageviews DESC').bind(startDate)
 ]);
 // All dates from the last N Lisbon calendar days, with explicit zeroes.
 const dates=[];const dayFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'});
 const partsFor=d=>{const p=Object.fromEntries(dayFormat.formatToParts(d).filter(v=>['year','month','day'].includes(v.type)).map(v=>[v.type,v.value]));return p.year+'-'+p.month+'-'+p.day;};
 const current=new Date();for(let k=days-1;k>=0;k--)dates.push(partsFor(new Date(current.getTime()-k*86400000)));
 const map=new Map((totals.results||[]).map(r=>[r.day,r]));
 const series=dates.map(day=>({day,pageviews:Number(map.get(day)?.pageviews)||0,sessions:Number(map.get(day)?.sessions)||0}));
 const sum=metric=>series.reduce((n,row)=>n+row[metric],0);
 return j({timezone:'Europe/Lisbon',asOf:today,days,series,
  totals:{pageviews:sum('pageviews'),sessions:sum('sessions')},
  pages:(pages.results||[]).filter(row=>PATHS.has(row.path)).map(row=>({path:row.path,pageviews:Number(row.pageviews)||0}))});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/visit'&&request.method==='OPTIONS'){
   const origin=request.headers.get('Origin');
   return origin===allowedOrigin(env)?new Response(null,{status:204,headers:cors(origin)}):failure('origin-not-allowed',403);
  }
  try{
   if(path==='/api/visit'&&request.method==='POST')return await capture(request,env);
   if(path==='/api/summary'&&request.method==='GET')return await summary(request,env);
   if(path==='/admin'&&request.method==='GET'){
    return new Response(adminHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'"}});
   }
   if(path==='/admin.js'&&request.method==='GET')
    return new Response(adminScript,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   if(path==='/health'&&request.method==='GET')return j({service:'portfolio-analytics',ready:Boolean(env?.ANALYTICS_DB&&env?.ADMIN_TOKEN)});
   return failure('not-found',404);
  }catch(error){
   console.error('analytics-handler-failed',error?.name||'Error');
   return failure('temporary-error',503);
  }
 },
 async scheduled(_event,env){
  // Reuse the existing analytics Cron to refresh verified-public LinkedIn
  // posts via a private Service Binding, without adding a sixth Cron Trigger.
  const cleanup=async()=>{
   if(!env?.ANALYTICS_DB)return;
   const cutoff=new Date(Date.now()-35*86400000).toISOString().slice(0,10);
   await env.ANALYTICS_DB.prepare('DELETE FROM daily_sessions WHERE day<?').bind(cutoff).run();
  };
  const refresh=async()=>{
   if(typeof env?.M_LINKEDIN_SYNC?.refresh!=='function')return;
   const result=await env.M_LINKEDIN_SYNC.refresh();
   if(!result?.stored&&result?.state!=='not-configured')
    console.warn('m-linkedin-sync-not-updated',String(result?.state||'unknown').slice(0,40));
  };
  const outcomes=await Promise.allSettled([cleanup(),refresh()]);
  // A LinkedIn outage never prevents analytics cleanup, or vice versa.
  if(outcomes[0].status==='rejected')console.warn('analytics-cleanup-failed',outcomes[0].reason?.name||'Error');
  if(outcomes[1].status==='rejected')console.warn('m-linkedin-sync-failed',outcomes[1].reason?.name||'Error');
 }
};
