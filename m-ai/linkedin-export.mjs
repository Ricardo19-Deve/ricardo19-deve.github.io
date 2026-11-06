/**
 * Local-only LinkedIn data-export adapter.
 *
 * Reads ONLY a CSV the owner explicitly downloaded from LinkedIn; no login,
 * scraping, automation or private account access. Draft output requires an
 * owner review before replacing the public data/m-public-activity.json.
 *
 * node m-ai/linkedin-export.mjs ~/Downloads/Shares.csv
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {LINKEDIN_PROFILE_URL,validatePublicActivity} from './public-activity.mjs';

const keys=(text)=>String(text||'').trim().toLowerCase().replace(/[\s_-]/gu,'');
const first=(item,choices)=>choices.map(k=>item[keys(k)]).find(x=>typeof x==='string'&&x.trim())||'';
export function parseCsv(raw){
 if(typeof raw!=='string'||raw.length>5_000_000)throw Error('CSV is missing or too large');
 const records=[],row=[];let part='',quoted=false;
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='"'){
   if(quoted&&raw[i+1]==='"'){part+='"';i++;}else quoted=!quoted;
  }else if(c===','&&!quoted){row.push(part);part='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   row.push(part);part='';
   if(row.some(x=>x.trim()))records.push([...row]);
   row.length=0;
   if(c==='\r'&&raw[i+1]==='\n')i++;
  }else part+=c;
 }
 if(quoted)throw Error('Unclosed CSV quote');
 row.push(part);if(row.some(x=>x.trim()))records.push([...row]);
 if(records.length<2)return [];
 const headers=records.shift().map(keys);
 return records.slice(0,5000).map(cells=>Object.fromEntries(headers.map((name,index)=>[name,cells[index]||''])));
}
function safeDate(value){
 const input=String(value||'').trim();
 const m=input.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/u);
 if(!m)return null;const d=new Date(m[1]+'T00:00:00Z');
 return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===m[1]?m[1]:null;
}
export function exportReview(raw,{today=new Date().toISOString().slice(0,10)}={}){
 const rows=parseCsv(raw),posts=[],errors=[],seen=new Set();
 for(const [index,row]of rows.entries()){
  const content=first(row,['ShareCommentary','Commentary','Content','Text','Post Text','Post','Share Text']);
  if(!content)continue;
  const publishedAt=safeDate(first(row,['Date','Created Date','CreatedDate','Created At','Published At','Post Date','Share Date']));
  const visibility=first(row,['Visibility','Audience','Privacy']).toLowerCase();
  const url=first(row,['Permalink','Post URL','Share URL','URL','Link'])||null;
  if(!publishedAt||publishedAt>today){errors.push({row:index+2,reason:'Date must be ISO YYYY-MM-DD'});continue;}
  if(content.length>1500){errors.push({row:index+2,reason:'Post too long for public feed; shorten after review'});continue;}
  const id=createHash('sha256').update(publishedAt+'\n'+content).digest('hex').slice(0,20);
  if(seen.has(id))continue;seen.add(id);
  const isPublic=visibility==='public'||visibility==='everyone';
  posts.push({id,publishedAt,text:content,url,visibility:isPublic?'public':'review',
   source:'member-export'});
 }
 posts.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 const result={version:1,owner:'Ricardo Pinheiro',profileUrl:LINKEDIN_PROFILE_URL,
  asOf:today,posts:posts.slice(0,48)};
 // Validation must happen after the owner confirms visibility and any links.
 const valid=validatePublicActivity(result);
 return {draft:result,requiresReview:result.posts.some(p=>p.visibility!=='public')||valid.status==='invalid',
  errors,rows:rows.length,selected:result.posts.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const input=process.argv[2];
 if(!input){process.stderr.write('Usage: node m-ai/linkedin-export.mjs /path/to/Shares.csv\n');process.exitCode=2;}
 else{
  try{
   const review=exportReview(readFileSync(resolve(input),'utf8'));
   const dest=resolve('data/m-public-activity.review.json');
   writeFileSync(dest,JSON.stringify(review.draft,null,2)+'\n',{flag:'w',mode:0o600});
   process.stdout.write('Local review draft: '+dest+'\n'+review.selected+' selected entries; '+review.errors.length+' skipped.\nREVIEW text, dates, URLs and audience before publishing. Rows marked review must NOT be published.\n');
  }catch(e){process.stderr.write('Import failed: '+e.message+'\n');process.exitCode=1;}
 }
}
