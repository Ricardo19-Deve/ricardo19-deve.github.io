/** Small facial performances built only from the original V6 expression and HAT morphs. */
export const M_AFFECTS=Object.freeze(['neutral','focus','content','doubt','sleepy','delight','anticipation','mischief','proud','calm']);
export const AFFECT_DURATIONS=Object.freeze({neutral:0,focus:4.8,content:4.8,doubt:4.4,sleepy:6.4,delight:4.8,anticipation:5.2,mischief:5.6,proud:5.8,calm:6.8});
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const smooth=value=>{const t=clamp(value);return t*t*t*(t*(t*6-15)+10);};
const PROFILES=Object.freeze({
 focus:Object.freeze({weights:{happy:.03,curious:.72,surprised:.06},eyelids:{left:.12,right:.12}}),
 content:Object.freeze({weights:{happy:.58,curious:.04,surprised:0},eyelids:{left:.19,right:.19}}),
 doubt:Object.freeze({weights:{happy:0,curious:.48,surprised:.12},eyelids:{left:.07,right:.27}}),
 sleepy:Object.freeze({weights:{happy:.18,curious:0,surprised:0},eyelids:{left:.47,right:.45}}),
 delight:Object.freeze({weights:{happy:.70,curious:.06,surprised:.18},eyelids:{left:.09,right:.09}})
});

// Authored beats use only the original happy/curious/surprised targets and HAT lids.
// Each tuple is [progress, happy, curious, surprised, left lid, right lid].
// Convex interpolation preserves the expression budget and the partial-lid bound.
const PERFORMANCES=Object.freeze({
 anticipation:[
  [0,0,0,0,0,0],
  [.18,.05,.40,.26,.025,.025],
  [.32,.10,.46,.38,.015,.015],
  [.52,.36,.34,.22,.035,.035],
  [.70,.52,.25,.10,.09,.09],
  [1,0,0,0,0,0]
 ],
 mischief:[
  [0,0,0,0,0,0],
  [.18,.23,.43,.03,.11,.18],
  [.36,.34,.34,.03,.05,.36],
  [.52,.53,.26,.02,.07,.31],
  [.70,.60,.15,.03,.16,.17],
  [1,0,0,0,0,0]
 ],
 proud:[
  [0,0,0,0,0,0],
  [.18,.33,.13,.02,.16,.16],
  [.42,.66,.13,.01,.13,.13],
  [.66,.59,.12,0,.22,.22],
  [.82,.37,.10,0,.23,.23],
  [1,0,0,0,0,0]
 ],
 calm:[
  [0,0,0,0,0,0],
  [.18,.20,.07,0,.17,.18],
  [.40,.26,.04,0,.31,.30],
  [.64,.23,.04,0,.26,.26],
  [.82,.19,.04,0,.28,.28],
  [1,0,0,0,0,0]
 ]
});

function samplePerformance(beats,progress){
 const next=beats.findIndex(beat=>beat[0]>=progress);
 const from=beats[Math.max(0,next-1)],to=beats[Math.max(0,next)];
 const blend=to[0]>from[0]?smooth((progress-from[0])/(to[0]-from[0])):0;
 const channels=from.slice(1).map((value,index)=>value+(to[index+1]-value)*blend);
 return {weights:{happy:channels[0],curious:channels[1],surprised:channels[2]},eyelids:{left:channels[3],right:channels[4]}};
}

/** age is elapsed seconds; all channels start and end at the unchanged neutral face. */
export function sampleAffect({name,age=0,weight=1,reducedMotion=false}={}){
 const valid=M_AFFECTS.includes(name),duration=valid?AFFECT_DURATIONS[name]:0;
 const progress=duration?clamp(age/duration):0;
 const active=duration>0&&!reducedMotion&&Number.isFinite(age)&&age>0&&age<duration;
 const envelope=active?smooth(progress/.18)*(1-smooth((progress-.74)/.26))*clamp(weight):0;
 const profile=active?(PROFILES[name]??samplePerformance(PERFORMANCES[name],progress)):null;
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
