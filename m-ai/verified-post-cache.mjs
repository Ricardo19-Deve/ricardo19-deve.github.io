/**
 * Strictly PUBLIC post cache for scheduled LinkedIn synchronization.
 * Durable Object is only reachable through the Worker binding, never a public
 * route. No raw LinkedIn data, tokens, visitor data or private posts stored.
 */
import {validatePublicActivity,LINKEDIN_PROFILE_URL} from './public-activity.mjs';

const TTL_MS=4*60*60*1000;
function validated(value){
 if(!value||!['ready','empty'].includes(value.status)||!Array.isArray(value.posts)||value.posts.length>8)return null;
 if((value.status==='ready'&&value.posts.length===0)||(value.status==='empty'&&value.posts.length!==0))return null;
 const posts=value.posts.map((p,i)=>({
  id:'cache-'+i,publishedAt:p.publishedAt,text:p.text,url:p.url,
  source:p.source,visibility:'public'
 }));
 const result=validatePublicActivity({version:1,owner:'Ricardo Pinheiro',
  profileUrl:LINKEDIN_PROFILE_URL,asOf:value.asOf||null,posts});
 return ['ready','empty'].includes(result.status)?result:null;
}
export class MVerifiedPosts {
 constructor(ctx){
  this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS verified_posts (id INTEGER PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL)');
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/read'&&request.method==='GET'){
   const row=this.sql.exec('SELECT payload,expires FROM verified_posts WHERE id=1').toArray()[0];
   if(!row||row.expires<Date.now())return Response.json({status:'expired',posts:[]});
   try{
    const item=validated(JSON.parse(row.payload));
    return Response.json(item||{status:'invalid',posts:[]});
   }catch{return Response.json({status:'invalid',posts:[]});}
  }
  if(path==='/replace'&&request.method==='POST'){
   const raw=await request.text();
   if(raw.length>15000)return Response.json({ok:false},{status:413});
   let item;
   try{item=validated(JSON.parse(raw));}catch{}
   if(!item)return Response.json({ok:false},{status:400});
   const expires=Date.now()+TTL_MS;
   this.sql.exec('INSERT INTO verified_posts (id,payload,expires) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires=excluded.expires',
    JSON.stringify(item),expires);
   return Response.json({ok:true});
  }
  return Response.json({error:'not_found'},{status:404});
 }
}
const stub=env=>env?.M_VERIFIED_POSTS?.get?.(env.M_VERIFIED_POSTS.idFromName('public-linkedin-only'))||null;
export async function readVerifiedPosts(env){
 try{
  const service=stub(env);if(!service)return null;
  const response=await service.fetch('https://internal-m/read');
  if(!response.ok)return null;
  return validated(await response.json());
 }catch{return null;}
}
export async function storeVerifiedPosts(env,value){
 const safe=validated(value);
 if(!safe)return false;
 try{
  const service=stub(env);if(!service)return false;
  const response=await service.fetch('https://internal-m/replace',
   {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(safe)});
  return response.ok;
 }catch{return false;}
}
