/** A cached, bounded forecast context for the existing local creature systems.
 * The controller creates it only when its existing MET forecast changes.
 * No clock, polling, visitor data, new action executor or remembered fact.
 */
import {weatherVisual} from './m-world-weather.mjs?v=66&sky=67';
const conditions=new Set(['clear','partly-cloudy','cloudy','rain','snow']);
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
const near=(a,b)=>Math.abs(a-b)<1e-10;
const neutral=Object.freeze({version:1,condition:'unknown',rain:0,wind:0,comfort:0,
 effortMultiplier:1,arousalOffset:0,focusOffset:0,valenceOffset:0});

/** A forecast may motivate a performance, never establish completed shelter/rest. */
export function weatherBehaviorProfile(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.status!=='ready'
  ||!conditions.has(raw.condition)||!finite(raw.windKmh,0,288)
  ||!finite(raw.precipitation,0,100)||!finite(raw.cloud,0,1))return null;
 const visual=weatherVisual(raw),rain=clamp(visual.rain/.88),snow=clamp(visual.snow/.8),wind=visual.wind;
 const comfort=clamp(1-.42*rain-.30*snow-.48*wind-.04*visual.cloud);
 return Object.freeze({version:1,condition:raw.condition,rain,wind,comfort,
  effortMultiplier:1+.12*wind,
  arousalOffset:.035*rain+.055*wind,focusOffset:.05*rain+.06*wind,
  valenceOffset:.035*comfort-.015*rain-.01*wind});
}
function valid(profile){
 return profile!==null&&typeof profile==='object'&&!Array.isArray(profile)
  &&profile.version===1&&conditions.has(profile.condition)
  &&finite(profile.rain,0,1)&&finite(profile.wind,0,1)&&finite(profile.comfort,0,1)
  &&finite(profile.effortMultiplier,1,1.12)&&finite(profile.arousalOffset,0,.09+1e-12)
  &&finite(profile.focusOffset,0,.11+1e-12)&&finite(profile.valenceOffset,-.025-1e-12,.035+1e-12)
  &&near(profile.effortMultiplier,1+.12*profile.wind)
  &&near(profile.arousalOffset,.035*profile.rain+.055*profile.wind)
  &&near(profile.focusOffset,.05*profile.rain+.06*profile.wind)
  &&near(profile.valenceOffset,.035*profile.comfort-.015*profile.rain-.01*profile.wind);
}
/** Invalid/absent context is exactly neutral. Never drain energy at rest. */
export function weatherEffortMultiplier(profile){return valid(profile)?profile.effortMultiplier:1;}
/** Cached result is reused, including the shared neutral fallback. The existing
 * character-state owner decides when to apply offsets (not sleep/manual/input).
 */
export function weatherPresentation(profile){return valid(profile)?profile:neutral;}
/** Mild context under the existing action safety, ownership, need and cooldown
 * gates. Goals, sleep and achievements are never manufactured or reprioritized.
 */
export function weatherCandidateWeight(family,profile){
 if(!valid(profile)||typeof family!=='string'||family==='sleep'||family==='achievement'||family.startsWith('goal-'))return 1;
 const {rain,wind,comfort}=profile,shelter=clamp(.70*rain+.55*wind);
 switch(family){
  case 'perch':return 1+.16*shelter;
  case 'rest':return 1+.12*shelter;
  case 'observe':return 1+.10*shelter;
  case 'think':return 1+.08*shelter;
  case 'inspect':return 1+.03*comfort-.025*shelter;
  case 'peek':return 1-.05*rain-.08*wind+.025*comfort;
  case 'orbit':case 'light':case 'ball':case 'hop':return clamp(1-.12*rain-.16*wind+.05*comfort,.72,1.05);
  default:return 1;
 }
}
