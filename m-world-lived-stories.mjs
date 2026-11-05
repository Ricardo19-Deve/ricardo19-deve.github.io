/**
 * V34: experiences, not scripted lore. M makes a tiny themed three-beat
 * adventure only after each original-rig action genuinely completes.
 * A title and URL remain ephemeral in the verified V33 feed. Persistent
 * memory contains no personal data, visitor messages or external article text.
 */
import {validateWorldFeed,worldDay,WORLD_TOPICS} from './m-world-world-knowledge.mjs?v=41';

export const M_STORY_KEY='m-world-lived-stories-v34';
export const STORY_BEATS=Object.freeze(['notice','explore','reflect']);
const MAX_JOURNAL=10,MAX_STORAGE_BYTES=2800;
const ALLOWED={
 notice:Object.freeze(['observe','think','inspect']),
 explore:Object.freeze(['inspect','peek','orbit','light','ball','hop']),
 reflect:Object.freeze(['think','perch','rest','observe'])
};
const ymd=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/u.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'));
const safeTopic=value=>WORLD_TOPICS.includes(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const validEpisode=e=>exact(e,['date','topic','step'])&&ymd(e.date)&&safeTopic(e.topic)&&Number.isInteger(e.step)&&e.step>=0&&e.step<=3;
const validJournal=e=>exact(e,['date','topic'])&&ymd(e.date)&&safeTopic(e.topic);
const validRecord=value=>exact(value,['version','episode','journal'])&&value.version===1
 &&(value.episode===null||validEpisode(value.episode))
 &&Array.isArray(value.journal)&&value.journal.length<=MAX_JOURNAL
 &&value.journal.every(validJournal)
 &&new Set(value.journal.map(x=>x.date)).size===value.journal.length;
const blank=()=>({version:1,episode:null,journal:[]});
const topicLabel={science:'science',nature:'nature',culture:'art and culture',exploration:'exploration',history:'history'};
export function storyCandidateWeight(family,story){
 if(!story||!safeTopic(story.topic)||!STORY_BEATS.includes(story.phase))return 1;
 const choices=ALLOWED[story.phase];
 if(!choices.includes(family))return 1;
 // No action is guaranteed; this is a *bounded* motivation, underneath
 // page-readability, energy, active gestures and reduced-motion gates.
 return story.phase==='notice'?1.17:story.phase==='explore'?1.24:1.21;
}
export function livedStoryText({topic,step}={}){
 if(!safeTopic(topic)||!Number.isInteger(step)||step<0||step>3)return '';
 const subject=topicLabel[topic];
 return [
  'M discovered a '+subject+' story and is taking a moment to notice it.',
  'M observed a '+subject+' discovery and feels ready to explore.',
  'M explored her surroundings after the '+subject+' discovery. Next, a moment to reflect.',
  'M noticed, explored and reflected on a '+subject+' discovery through her own actions.'
 ][step];
}
export function createLivedWorldStories({storage,remember=true,now=()=>new Date()}={}){
 let enabled=remember===true,store=blank(),verified=null,available=false;
 try{storage??=globalThis.localStorage;}catch{storage=null;}
 if(enabled&&storage){
  try{
   const raw=storage.getItem(M_STORY_KEY);
   if(typeof raw==='string'&&raw.length<=MAX_STORAGE_BYTES){
    const parsed=JSON.parse(raw);
    if(validRecord(parsed))store=parsed;
   }
  }catch{}
 }
 const today=()=>{try{return worldDay(now());}catch{return null;}};
 function save(){
  available=false;
  if(!enabled||!storage)return false;
  try{
   const rawOld=storage.getItem(M_STORY_KEY);
   if(typeof rawOld==='string'){
    const old=JSON.parse(rawOld);
    if(Number.isInteger(old?.version)&&old.version>1)return false;
   }
   const raw=JSON.stringify(store);
   if(raw.length>MAX_STORAGE_BYTES)return false;
   storage.setItem(M_STORY_KEY,raw);
   available=storage.getItem(M_STORY_KEY)===raw;
  }catch{}
  return available;
 }
 function begin(knowledge){
  const item=knowledge?.discovery;
  const date=knowledge?.date;
  const validation=validateWorldFeed({
   schema:1,date,source:item?.source,sourceUrl:item?.sourceUrl,
   items:[item]
  },{date:today()});
  if(!validation)return false;
  verified=validation;
  const e=store.episode;
  if(!e||e.date!==date||e.topic!==item.topic)
   store.episode={date,topic:item.topic,step:0};
  // An already completed adventure stays completed after reloading.
  save();
  return true;
 }
 function record({family,success}={}){
  if(!verified||verified.date!==today()||success!==true)return null;
  const episode=store.episode;
  if(!validEpisode(episode)||episode.date!==verified.date||episode.topic!==verified.item.topic||episode.step>=3)return null;
  const phase=STORY_BEATS[episode.step];
  if(!ALLOWED[phase].includes(family))return null;
  const completedBeat=phase;
  episode.step++;
  const complete=episode.step===3;
  if(complete){
   // Exactly one truthful, date/topic-only record per completed adventure.
   store.journal=store.journal.filter(x=>x.date!==episode.date);
   store.journal.push({date:episode.date,topic:episode.topic});
   store.journal=store.journal.slice(-MAX_JOURNAL);
  }
  save();
  return {beat:completedBeat,complete,step:episode.step,topic:episode.topic};
 }
 function hint(){
  const episode=store.episode;
  if(!verified||verified.date!==today()||!episode||episode.date!==verified.date||episode.step>=3)return null;
  return {topic:episode.topic,phase:STORY_BEATS[episode.step]};
 }
 function snapshot(){
  const current=verified?.date===today()&&store.episode?.date===verified.date?store.episode:null;
  return {available:Boolean(verified&&verified.date===today()),remember:enabled,storageAvailable:available,
   phase:current?(STORY_BEATS[current.step]||'complete'):null,
   step:current?.step??0,topic:current?.topic||null,
   narrative:current?livedStoryText(current):'',
   // Only actual completed adventures, never hypothetical intentions.
   adventures:enabled?store.journal.map(x=>({...x})):[],
   completed:current?.step===3,localOnly:true};
 }
 function clear(){
  try{storage?.removeItem(M_STORY_KEY);}catch{}
  store=blank();available=false;
 }
 function setRemember(value){
  if(typeof value!=='boolean')return false;
  if(!value){enabled=false;clear();}
  else if(!enabled){enabled=true;store=blank();}
  // Keep the current public fact; start a new in-session arc without
  // re-importing any visitor data after consent was revoked.
  if(verified)store.episode={date:verified.date,topic:verified.item.topic,step:0};
  if(enabled)save();
  return true;
 }
 function reset(){
  clear();
  if(verified)store.episode={date:verified.date,topic:verified.item.topic,step:0};
 }
 return {begin,record,hint,snapshot,setRemember,reset};
}
