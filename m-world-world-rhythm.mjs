/**
 * V32 passive, privacy-first world awareness for M.
 * Ambient context is derived from the current browser clock, visibility and
 * coarse online status only. No geolocation, cookies, IPs, weather calls,
 * sensor permissions, external services or visitor identifiers.
 * The existing remote director remains separately rate limited.
 */
const allowed=['night','morning','day','evening'];
export function senseWorldRhythm({date=new Date(),online=true}={}){
 const valid=date instanceof Date&&Number.isFinite(date.getTime());
 const h=valid?date.getHours():12;
 const phase=h<6||h>=23?'night':h<10?'morning':h<18?'day':'evening';
 const weekend=valid&&[0,6].includes(date.getDay());
 return {phase,weekend,online:online!==false,
  // These weights bias local choices, not a simulated medical sleep need.
  // Never override reading, accessibility or motion / privacy controls.
  restBias:phase==='night'?1.5:phase==='evening'?1.16:phase==='morning'?.87:.9,
  playBias:phase==='night'?.76:phase==='morning'?.96:weekend?1.12:1.05,
  curiosityBias:phase==='morning'?1.16:phase==='day'?1.1:1.0};
}
export function worldCandidateWeight(family,world){
 if(!world||typeof world!=='object'||!allowed.includes(world.phase))return 1;
 const key=['sleep','rest'].includes(family)?'restBias':
  ['ball','light','hop','goal-light'].includes(family)?'playBias':
  ['observe','think','inspect','peek','orbit'].includes(family)?'curiosityBias':null;
 if(!key)return 1;
 // Use only the whitelisted phase, not untrusted caller multipliers.
 const phase=world.phase;
 if(key==='restBias')return phase==='night'?1.5:phase==='evening'?1.16:phase==='morning'?.87:.9;
 if(key==='playBias')return phase==='night'?.76:phase==='morning'?.96:world.weekend===true?1.12:1.05;
 return phase==='morning'?1.16:phase==='day'?1.1:1;
}
