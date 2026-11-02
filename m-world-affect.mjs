/** Small facial performances built only from the original V6 expression and HAT morphs. */
export const M_AFFECTS=Object.freeze(['neutral','focus','content','doubt','sleepy','delight']);
export const AFFECT_DURATIONS=Object.freeze({neutral:0,focus:4.8,content:4.8,doubt:4.4,sleepy:6.4,delight:4.8});
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const smooth=value=>{const t=clamp(value);return t*t*t*(t*(t*6-15)+10);};
const PROFILES=Object.freeze({
 focus:Object.freeze({weights:{happy:.03,curious:.72,surprised:.06},eyelids:{left:.12,right:.12}}),
 content:Object.freeze({weights:{happy:.58,curious:.04,surprised:0},eyelids:{left:.19,right:.19}}),
 doubt:Object.freeze({weights:{happy:0,curious:.48,surprised:.12},eyelids:{left:.07,right:.27}}),
 sleepy:Object.freeze({weights:{happy:.18,curious:0,surprised:0},eyelids:{left:.47,right:.45}}),
 delight:Object.freeze({weights:{happy:.70,curious:.06,surprised:.18},eyelids:{left:.09,right:.09}})
});

/** age is elapsed seconds; all channels start and end at the unchanged neutral face. */
export function sampleAffect({name,age=0,weight=1,reducedMotion=false}={}){
 const valid=M_AFFECTS.includes(name),duration=valid?AFFECT_DURATIONS[name]:0;
 const progress=duration?clamp(age/duration):0;
 const active=duration>0&&!reducedMotion&&Number.isFinite(age)&&age>0&&age<duration;
 const envelope=active?smooth(progress/.18)*(1-smooth((progress-.74)/.26))*clamp(weight):0;
 const profile=active?PROFILES[name]:null;
 const weights={happy:0,curious:0,surprised:0},eyelids={left:0,right:0};
 if(profile){
  for(const key of Object.keys(weights))weights[key]=profile.weights[key]*envelope;
  // Small, slow lid variation keeps the sleepy hold from becoming a frozen half blink.
  const breath=name==='sleepy'?1+.025*Math.sin(progress*Math.PI*4):1;
  for(const side of ['left','right'])eyelids[side]=clamp(profile.eyelids[side]*envelope*breath,0,.5);
 }
 return {name:valid?name:null,duration,progress,envelope,
  phase:!active?(valid&&duration>0&&age>=duration?'complete':'idle'):progress<.18?'anticipation':progress<.74?'hold':'recovery',
  weights,eyelids};
}