import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,API_URL} from './core.mjs';
import {DMA_SNAPSHOT_URL,DMA_SNAPSHOT_DOMAIN} from './linkedin-live.mjs';

const mockAI=()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({
 reply:'Não tenho ainda um post verificado para apresentar.',
 expression:'neutral',gesture:'none',section:'none'
})}]}]}),{status:200,headers:{'content-type':'application/json'}});
function input(){
 return new Request('https://site.local/api/m/respond',{
  method:'POST',
  headers:{origin:'https://ricardo19-deve.github.io','content-type':'application/json'},
  body:JSON.stringify({
   message:'Qual foi o último post do Ricardo no LinkedIn?',
   history:[],context:{section:'home',language:'pt'}
  })
 });
}
const quota={ready:true,async reserve(){return {allowed:true,token:'lease'};},async release(){}};
test('V46 unavailable member snapshot explains pending/expired/empty errors, never claims no posts exist',async()=>{
 for(const [kind,linkedInResponse,required]of [
  ['pending',()=>new Response('',{status:404}),/still being prepared after consent/],
  ['expired',()=>new Response('',{status:401}),/could not authorize access/],
  ['server',()=>new Response('',{status:503}),/could not be verified/],
  ['no-recognized',()=>new Response(JSON.stringify({
   elements:[{snapshotDomain:DMA_SNAPSHOT_DOMAIN,snapshotData:[]}],
   paging:{links:[]}
  }),{status:200}),/no entries met the public-post verification requirements/]
 ]){
  const calls=[];
  const fetchImpl=async(url,opts)=>{
   calls.push({url,opts});
   if(url.startsWith(DMA_SNAPSHOT_URL))return linkedInResponse();
   if(url===API_URL)return mockAI();
   throw Error('Unknown URL');
  };
  const handle=createHandler({env:{OPENAI_API_KEY:'fake-openai',LINKEDIN_DMA_ACCESS_TOKEN:'fake-private-token'},quota,fetchImpl});
  const res=await handle(input());
  assert.equal(res.status,200,kind);
  assert.equal(calls.length,2,kind);
  const metadata=JSON.parse(calls[1].opts.body);
  assert.match(metadata.input.at(-1).content,required,kind);
  assert.match(metadata.input.at(-1).content,/No verified public LinkedIn posts/);
  assert.doesNotMatch(JSON.stringify(metadata),/fake-private-token/,'token cannot reach model');
  assert.doesNotMatch(metadata.instructions,/The official LinkedIn MEMBER_SHARE_INFO snapshot is still being prepared/,'provider-specific status belongs to untrusted user evidence, never system instructions');
 }
});
test('V46 latest-post explanation from source does not influence unrelated project questions',async()=>{
 const urls=[];
 const handle=createHandler({env:{OPENAI_API_KEY:'fake-openai',LINKEDIN_DMA_ACCESS_TOKEN:'fake-private-token'},quota,
  fetchImpl:async url=>{
   urls.push(url);
   if(url===API_URL)return mockAI();
   throw Error('Unrelated questions must not call LinkedIn');
  }});
 const request=new Request('https://site.local/api/m/respond',{method:'POST',headers:{
  origin:'https://ricardo19-deve.github.io','content-type':'application/json'
 },body:JSON.stringify({message:'What skills does Ricardo use?',history:[],context:{section:'home',language:'en'}})});
 const res=await handle(request);
 assert.equal(res.status,200);
 assert.deepEqual(urls,[API_URL]);
});
