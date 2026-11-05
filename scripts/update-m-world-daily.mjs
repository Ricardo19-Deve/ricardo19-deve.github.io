/**
 * M World V33 — one editorially selected, attributable discovery each day.
 * Runs in GitHub Actions, not in individual visitors' browsers.
 * No personal data, Wikipedia prose, secrets or AI calls are used or saved.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

export const CATEGORIES=Object.freeze(['science','nature','culture','exploration','history']);
const BLOCKED=/\b(war|bomb|killed|killing|murder|massacre|assassinat|terror|genocide|suicide|politic|president|election|riot|military|battle|shooting|disaster|dead|death)\b/iu;
const TOPICS=[
 ['science',/\b(science|scientist|space|astronom|planet|moon|solar|rocket|physics|chemistry|engineer|computer|internet|laboratory|satellite|telescope|mathemat|robot|invent|technology)\b/iu],
 ['nature',/\b(nature|wildlife|forest|flower|garden|ocean|sea|river|animal|bird|botan|species|conservation|mountain|earth|ecology|volcan)\b/iu],
 ['culture',/\b(art|artist|painting|music|composer|novel|poet|cinema|film|museum|theatre|architecture|literature|photograph|festival|sculpture)\b/iu],
 ['exploration',/\b(discover|explorer|expedition|voyage|journey|aircraft|aviation|flight|polar|map|navigation|travel)\b/iu]
];
const text=value=>typeof value==='string'?value.normalize('NFC').replace(/\s+/gu,' ').trim():'';
export function lisbonDate(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=type=>parts.find(p=>p.type===type)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
function wikiLink(value){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='en.wikipedia.org'||!url.pathname.startsWith('/wiki/')||url.search||url.hash||url.username||url.password)return null;
  return url.href;
 }catch{return null;}
}
function safeTitle(value){
 const title=text(value);
 if(title.length<4||title.length>110||/[<>{}\r\n\x00-\x1f]/u.test(title)||BLOCKED.test(title))return null;
 return title;
}
export function pickDiscovery(feed,date,sourceUrl){
 if(!feed||!Array.isArray(feed.selected)||feed.selected.length>300)return null;
 const candidates=[];
 for(const event of feed.selected){
  const year=Number(event?.year);
  if(!Number.isInteger(year)||year<0||year>new Date().getUTCFullYear()+1)continue;
  if(BLOCKED.test(text(event?.text).slice(0,400)))continue;
  for(const page of (Array.isArray(event?.pages)?event.pages:[]).slice(0,4)){
   const title=safeTitle(page?.normalizedtitle||page?.titles?.normalized||page?.title);
   const url=wikiLink(page?.content_urls?.desktop?.page);
   if(!title||!url)continue;
   const sample=(title+' '+text(page?.description)).slice(0,230);
   const topic=TOPICS.find(([,pattern])=>pattern.test(sample))?.[0]||'history';
   candidates.push({year,title,url,topic});
  }
 }
 candidates.sort((a,b)=>a.year-b.year||a.title.localeCompare(b.title,'en'));
 if(!candidates.length)return null;
 let state=2166136261;
 for(const c of date)state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
 const preferred=candidates.filter(x=>x.topic!=='history');
 const pool=preferred.length?preferred:candidates;
 const item=pool[state%pool.length];
 return {
  schema:1,date,source:'Wikipedia — On this day',sourceUrl,
  items:[{id:date+':'+item.year+':'+item.topic,year:item.year,title:item.title,url:item.url,topic:item.topic}]
 };
}
export async function fetchDailyDiscovery({at=new Date(),fetchImpl=fetch}={}){
 const date=lisbonDate(at),parts=date.split('-'),month=parts[1],day=parts[2];
 const sourceUrl='https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/'+month+'/'+day;
 const response=await fetchImpl(sourceUrl,{
  headers:{'User-Agent':'MWorldDailyDiscovery/1.0 (https://ricardo19-deve.github.io/; GitHub Actions only)','Accept':'application/json'},
  signal:AbortSignal.timeout(10000),redirect:'error'
 });
 if(!response?.ok)throw new Error('Wikimedia daily source unavailable: '+(response?.status||'network'));
 const payload=await response.json();
 const result=pickDiscovery(payload,date,sourceUrl);
 if(!result)throw new Error('No safe verifiable world discovery today');
 return result;
}
export async function runDaily({at=new Date(),fetchImpl=fetch,output='data/m-world-daily.json'}={}){
 const next=JSON.stringify(await fetchDailyDiscovery({at,fetchImpl}),null,2)+'\n';
 const file=resolve(output);
 let old='';try{old=await readFile(file,'utf8');}catch{}
 if(next===old)return {changed:false,file};
 await mkdir(dirname(file),{recursive:true});
 await writeFile(file,next,'utf8');
 return {changed:true,file};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runDaily().then(x=>console.log(x.changed?'Daily discovery updated':'Daily discovery unchanged'))
  .catch(error=>{console.error('Daily discovery safely skipped:',error?.message||'error');process.exitCode=1;});
}
