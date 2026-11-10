/**
 * V65: a small, deterministic sense of continuity for M's autonomous life.
 * Called only AFTER an authentic completed action; never from untrusted text.
 * It gently shapes the next choice, but cannot bypass collision, user-input,
 * reduced-motion, reading, target availability, or energy safety gates.
 */
const clamp=(value,lo=0,hi=1)=>Math.min(hi,Math.max(lo,Number.isFinite(value)?value:0));
const mode=family=>{
 if(['light','ball','hop','peek','goal-light'].includes(family))return 'play';
 if(['inspect','orbit','goal-lookout'].includes(family))return 'explore';
 if(['rest','sleep','perch'].includes(family))return 'recover';
 if(['observe','think','achievement'].includes(family))return 'reflect';
 return 'other';
};
const matrix=Object.freeze({
 play:{play:.68,explore:.92,recover:1.27,reflect:1.17,other:1},
 explore:{play:1.10,explore:.77,recover:1.12,reflect:1.24,other:1},
 recover:{play:1.05,explore:1.25,recover:.77,reflect:1.12,other:1},
 reflect:{play:1.13,explore:1.23,recover:1.05,reflect:.78,other:1}
});
export function behaviorContinuityWeight(previous,family,{at=0,energy=.7,reading=false}={}){
 if(!previous||typeof previous!=='object'||reading)return 1;
 if(!Number.isFinite(at)||!Number.isFinite(previous.at)||at<previous.at)return 1;
 if(!Number.isFinite(energy))return 1;
 const elapsed=at-previous.at;
 if(elapsed>=90_000)return 1;
 const source=mode(previous.family),destination=mode(family);
 if(source==='other'||destination==='other')return 1;
 // Slowly release the previous action's influence. At most ±27%, avoiding
 // abrupt forced scene choices and preserving current physical needs.
 let target=matrix[source]?.[destination]??1;
 const level=clamp(energy);
 if(level<.35){
  // Exhaustion continues to outrank exploration after a previous rest.
  if(destination==='play')target=Math.min(target,.72);
  if(destination==='recover')target=Math.max(target,1.18);
 }
 const fade=1-clamp(elapsed/90_000);
 return Math.round((1+(target-1)*fade)*1_000_000)/1_000_000;
}

export function behaviorPhase(family){return mode(family);}
