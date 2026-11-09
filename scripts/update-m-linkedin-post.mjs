/**
 * Owner-confirmed personal LinkedIn publications. No scraping, credentials,
 * profile access, or new LinkedIn OAuth permissions.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validatePublicActivity,LINKEDIN_PROFILE_URL} from '../m-ai/public-activity.mjs';
const FEED=new URL('../data/m-public-activity.json',import.meta.url);
const PATH=/^\/(?:feed\/update\/urn:li:(?:activity|ugcPost|share):\d+\/?|posts\/[a-z0-9_%\-]+)$/iu;
const textSafe=v=>typeof v==='string'&&v.trim().length>=12&&v.length<=1500&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v);
const dateSafe=(v,today)=>{if(!/^\d{4}-\d{2}-\d{2}$/u.test(v||''))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===v&&v<=today;};
function permalink(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||!['linkedin.com','www.linkedin.com','pt.linkedin.com'].includes(u.hostname))return null;
  if(!PATH.test(u.pathname))return null;
  if(u.pathname.startsWith('/posts/')&&!/(?:^|[-_])activity[-_]\d{10,}/iu.test(u.pathname))return null;
  return 'https://www.linkedin.com'+u.pathname;
 }catch{return null;}
}
export function addVerifiedPost(feed,values,{now=new Date(),actor='Ricardo19-Deve'}={}){
 if(String(actor).toLowerCase()!=='ricardo19-deve')throw Error('Only repository owner can verify public posts');
 if(values.audience!=='PUBLIC_CONFIRMED')throw Error('Confirm that THIS post is visible to Anyone');
 const today=now.toISOString().slice(0,10),url=permalink(values.url);
 if(!url)throw Error('Use the exact LinkedIn post permalink without tracking parameters');
 if(!dateSafe(values.publishedAt,today))throw Error('Invalid or future publication date');
 if(!textSafe(values.summary))throw Error('Provide 12 to 1500 characters of owner-reviewed public text');
 if(feed?.version!==1||feed?.owner!=='Ricardo Pinheiro'||feed?.profileUrl!==LINKEDIN_PROFILE_URL||!Array.isArray(feed.posts))throw Error('Existing feed is invalid');
 const postId=url.match(/(?:activity[-_:]|(?:activity|ugcPost|share):)(\d+)/iu)?.[1];
 if(!postId)throw Error('Missing post identifier');
 const post={id:'owner-reviewed-'+postId,publishedAt:values.publishedAt,text:values.summary.trim(),url,visibility:'public',source:'owner-curated'};
 const posts=[...feed.posts.filter(p=>p.url!==url),post].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 if(posts.length>48)posts.length=48;
 const result={version:1,owner:feed.owner,profileUrl:feed.profileUrl,asOf:today,posts};
 if(validatePublicActivity(result).status!=='ready')throw Error('Feed safety validation failed');
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  const data=JSON.parse(readFileSync(FEED,'utf8'));
  const next=addVerifiedPost(data,{url:process.env.M_POST_URL,publishedAt:process.env.M_POST_DATE,summary:process.env.M_POST_SUMMARY,audience:process.env.M_POST_AUDIENCE},{actor:process.env.GITHUB_ACTOR});
  writeFileSync(FEED,JSON.stringify(next,null,2)+'\n','utf8');
  process.stdout.write('Verified public post added to the M knowledge feed.\n');
 }catch(error){process.stderr.write('Post rejected: '+error.message+'\n');process.exitCode=1;}
}
