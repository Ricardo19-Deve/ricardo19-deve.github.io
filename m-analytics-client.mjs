/** V29 privacy-conscious pageview pings; no IP, UA, referrer, cookies or chat.
 * A short-lived tab session counts once per calendar day; not unique people. */
import {PORTFOLIO_ANALYTICS_ENDPOINT} from './m-analytics-config.mjs?v=33';
const paths=new Set(['/','/salesforce-mobile.html','/revmend.html','/epoxy-platform.html']);
export function analyticsUrl(value){
 try{
  const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&u.pathname==='/api/visit'?u.href:null;
 }catch{return null;}
}
export function sessionToken({storage=globalThis.sessionStorage,cryptoImpl=globalThis.crypto}={}){
 const day=new Date().toISOString().slice(0,10),key='m-portfolio-anonymous-session-'+day;
 try{
  const prior=storage?.getItem(key);
  if(typeof prior==='string'&&/^[a-f0-9-]{36}$/iu.test(prior))return prior;
 }catch{}
 const token=cryptoImpl?.randomUUID?.();
 if(typeof token!=='string'||!/^[a-f0-9-]{36}$/iu.test(token))return null;
 try{storage?.setItem(key,token);}catch{}
 return token;
}
export async function recordPortfolioVisit({endpoint=PORTFOLIO_ANALYTICS_ENDPOINT,locationImpl=globalThis.location,navigatorImpl=globalThis.navigator,fetchImpl=globalThis.fetch,storage=globalThis.sessionStorage,cryptoImpl=globalThis.crypto}={}){
 const url=analyticsUrl(endpoint);
 if(!url||!locationImpl||locationImpl.protocol!=='https:'||locationImpl.hostname!=='ricardo19-deve.github.io'||!paths.has(locationImpl.pathname))return false;
 if(navigatorImpl?.doNotTrack==='1'||navigatorImpl?.globalPrivacyControl===true)return false;
 const session=sessionToken({storage,cryptoImpl});if(!session||typeof fetchImpl!=='function')return false;
 try{
  const response=await fetchImpl(url,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',keepalive:true,
   headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({path:locationImpl.pathname,session})});
  return Boolean(response.ok);
 }catch{return false;}
}
