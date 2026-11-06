import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReply,createHandler,API_URL} from './core.mjs';
import {DMA_SNAPSHOT_URL,DMA_SNAPSHOT_DOMAIN} from './linkedin-live.mjs';

const url='https://www.linkedin.com/feed/update/urn:li:activity:7382430987654321000';
const verified={
 Date:'2026-11-05',ShareCommentary:'A new update about Salesforce and football.',
 ShareLink:url,Visibility:'Public'
};
const reply=text=>({reply:text,expression:'neutral',gesture:'none',section:'none'});
const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
const request=()=>new Request('https://local.test/api/m/respond',{method:'POST',
 headers:{origin:'https://ricardo19-deve.github.io','content-type':'application/json'},
 body:JSON.stringify({
  message:'Qual foi o último post no LinkedIn? Indica data, assunto e link.',
  history:[],context:{section:'home',language:'pt'}
 })});
const result=value=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{
 type:'output_text',text:JSON.stringify(value)
}]}]}),{status:200,headers:{'content-type':'application/json'}});

test('V47 exact verified public LinkedIn permalink can appear once as plain text',()=>{
 assert.equal(validateReply(reply('Publicado em 5 de novembro: Salesforce. '+url),'', [url]),true);
 assert.equal(validateReply(reply('Publicado em 5 de novembro: Salesforce. '+url)),false);
 assert.equal(validateReply(reply('Publicado em 5 de novembro: '+url+' '+url),'',[url]),false);
 assert.equal(validateReply(reply('Publicado: '+url+'?tracking=secret'),'',[url]),false);
 assert.equal(validateReply(reply('Publicado: https://evil.test/data'),'',[url]),false);
 assert.equal(validateReply(reply('Publicado: javascript:alert(1) '+url),'',[url]),false);
 assert.equal(validateReply(reply('Publicado: <img src=x> '+url),'',[url]),false);
});

test('V47 Ask M returns a verified link only with the authenticated public snapshot',async()=>{
 const calls=[];
 const handler=createHandler({env:{OPENAI_API_KEY:'mock-private-key',LINKEDIN_DMA_ACCESS_TOKEN:'owner-token'},
  quota,fetchImpl:async endpoint=>{
   calls.push(endpoint);
   if(endpoint.startsWith(DMA_SNAPSHOT_URL))
    return new Response(JSON.stringify({elements:[{snapshotDomain:DMA_SNAPSHOT_DOMAIN,snapshotData:[verified]}],
     paging:{links:[]}}),{headers:{'content-type':'application/json'}});
   if(endpoint===API_URL)return result(reply('5 de novembro de 2026 — Salesforce. '+url));
   throw Error('unexpected host');
  }});
 const response=await handler(request());
 assert.equal(response.status,200);
 assert.deepEqual((await response.json()).reply,'5 de novembro de 2026 — Salesforce. '+url);
 assert.equal(calls.filter(u=>u.startsWith(DMA_SNAPSHOT_URL)).length,1);
});

test('V47 fabricated link from the model is not accepted even when LinkedIn is connected',async()=>{
 const handler=createHandler({env:{OPENAI_API_KEY:'fake-openai',LINKEDIN_DMA_ACCESS_TOKEN:'fake-token'},quota,
 fetchImpl:async endpoint=>{
  if(endpoint.startsWith(DMA_SNAPSHOT_URL))
   return new Response(JSON.stringify({elements:[{snapshotDomain:DMA_SNAPSHOT_DOMAIN,snapshotData:[verified]}],
    paging:{links:[]}}),{headers:{'content-type':'application/json'}});
  if(endpoint===API_URL)return result(reply('Publicação: https://evil.test/fake'));
  throw Error('unexpected upstream');
 }});
 assert.equal((await handler(request())).status,502);
});

test('V47 no LinkedIn verified snapshot means links remain completely forbidden',async()=>{
 const handler=createHandler({env:{OPENAI_API_KEY:'fake-openai',LINKEDIN_DMA_ACCESS_TOKEN:'fake-token'},quota,
 fetchImpl:async endpoint=>{
  if(endpoint.startsWith(DMA_SNAPSHOT_URL))return new Response('',{status:404});
  if(endpoint===API_URL)return result(reply('O último post: '+url));
  throw Error('unexpected upstream');
 }});
 assert.equal((await handler(request())).status,502);
});
