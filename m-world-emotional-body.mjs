/**
 * M World V40 — emotion is expressed through the ORIGINAL V6 body.
 *
 * The existing autonomous director/character decides feelings; this layer
 * interprets those feelings with restrained, smoothly transitioning head,
 * chest, arms, ears and ten connected tail bones. This is not a new gesture
 * scheduler, not a re-trained AI, not a second face controller, and it has
 * no DOM/network/storage/visitor data.
 *
 * Only existing verified affect state and energy influence the pose.
 */
export const EMOTIONAL_STATES=Object.freeze([
 'neutral','happy','curious','surprised','shy','focus','content','doubt',
 'sleepy','delight','anticipation','mischief','proud','calm',
 'pondering','dozing','joyful'
]);
const clamp=(n,a,b,fallback=0)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:fallback));
const ease=(v)=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const half=(current,target,seconds,halfLife)=>current+(target-current)*(1-Math.pow(.5,seconds/halfLife));
const silent=()=>({active:false,mood:'neutral',intensity:0,energy:0,
 pose:{},stage:{x:0,y:0,rx:0,ry:0,rz:0,scale:0}});
const target=Object.freeze({
 neutral:[0,0,0,0,0],
 happy:[.45,.48,.05,.0,.1],
 curious:[.1,.4,.85,.0,.15],
 surprised:[.15,.75,.55,.0,.7],
 shy:[-.15,.08,.24,.7,.25],
 focus:[0,.22,.8,.05,.1],
 content:[.43,.12,.25,.05,0],
 doubt:[-.38,.26,.65,.48,.42],
 sleepy:[.08,-.8,.04,.6,0],
 delight:[.86,.8,.38,.0,.42],
 anticipation:[.26,.65,.83,.0,.3],
 mischief:[.48,.59,.7,.05,.44],
 proud:[.78,.45,.22,.0,.0],
 calm:[.25,-.44,.1,.18,0],
 pondering:[0,-.1,.72,.35,.1],
 dozing:[.06,-.86,.0,.8,0],
 joyful:[.9,.9,.35,.0,.25]
});
// Numeric profile: [valence (-1..1), arousal (-1..1),
// curiosity (0..1), withdrawal (0..1), surprise (0..1)].
const zero=()=>[0,0,0,0,0];
const safeSeed=seed=>(Number.isFinite(seed)?Math.trunc(seed)>>>0:745117)||745117;
export function createEmotionalBody({seed=745117}={}){
 const sign=(safeSeed(seed)&1)?1:-1;
 let channels=zero(),seconds=0,mood='neutral',active=false,transitions=0,frames=0;
 function reset(){channels=zero();seconds=0;mood='neutral';active=false;}
 function sample({dt=0,affect=null,emotion='neutral',energy=.65,
  reducedMotion=false,gestureActive=false,sleeping=false,
  supported=false,reading=false}={}){
  if(reducedMotion||gestureActive||sleeping||supported){
   reset();return silent();
  }
  const step=clamp(dt,0,.06);
  if(step===0)return silent();
  seconds+=step;frames++;
  // The authoritative animated face's envelope tells us how strongly M is
  // feeling an affect. When no affect is active, use only a *faint* mood cue.
  const affectName=affect?.name;
  const strong=EMOTIONAL_STATES.includes(affectName)&&
    affectName!=='neutral'&&Number.isFinite(affect?.envelope)?
    clamp(affect.envelope,0,1):0;
  const faceName=EMOTIONAL_STATES.includes(emotion)?emotion:'neutral';
  const chosen=strong>.03?affectName:faceName;
  const energyLevel=clamp(energy,0,1,.65);
  const relativeIntensity=strong>.03?strong*.9:
   faceName==='neutral'?.0:.22;
  const readability=reading?.38:1;
  // No exaggerated happy bounce when the creature has low energy; physical
  // tiredness creates a lower, slower posture instead.
  const excitement=clamp((energyLevel-.18)/.82,0,1);
  const resting=chosen==='sleepy'||chosen==='dozing'||chosen==='calm';
  const desired=(target[chosen]||target.neutral).map((v,i)=>{
   let adjusted=v*relativeIntensity*readability;
   if(i===1&&v>0)adjusted*=.35+.65*excitement;
   if(i===1&&resting)adjusted*=1.0;
   return adjusted;
  });
  // Use different rise and fade speeds. This creates an emotional transition,
  // instead of instantly snapping to a new preset on every status update.
  const up=chosen==='surprised'?.18:chosen==='delight'?.26:.43;
  for(let i=0;i<channels.length;i++)
   channels[i]=half(channels[i],desired[i],step,
    Math.abs(desired[i])>Math.abs(channels[i])?up:.72);
  if(chosen!==mood&&relativeIntensity>.03){mood=chosen;transitions++;}
  else if(relativeIntensity===0&&channels.every(c=>Math.abs(c)<.0007))mood='neutral';
  const [valence,arousal,curiosity,withdrawal,surprise]=channels;
  const intensity=Math.max(...channels.map(Math.abs));
  active=intensity>.0008;
  if(!active)return silent();

  // The new posture does NOT write directly into expression morphs. It lets
  // the existing face remain authoritative while the body supports the mood.
  const nose=clamp(-arousal*.048+withdrawal*.065-surprise*.021,-.08,.08);
  const headYaw=clamp(curiosity*.027*sign+surprise*.017*sign,-.055,.055);
  const sideTilt=clamp(curiosity*.043*sign+withdrawal*.031*sign,-.055,.055);
  const chest=clamp(arousal*.028-withdrawal*.026,-.048,.048);
  const arms=clamp(withdrawal*.046-arousal*.017,-.07,.07);
  const ear=clamp(curiosity*.032+surprise*.046-arousal*.018,-.05,.07);
  const tailBase=clamp(valence*.025+arousal*.018-withdrawal*.016,-.045,.045);
  const pose={
   Head:[nose,headYaw,sideTilt],
   Neck:[nose*.5,headYaw*.4,sideTilt*.35],
   Chest:[chest,0,-sideTilt*.13],
   Body:[chest*.36,0,-sideTilt*.09],
   'Arm.L':[arms,0,-withdrawal*.023],
   'Arm.R':[arms*.83,0,withdrawal*.025],
   'Forearm.L':[withdrawal*.035,0,-withdrawal*.04],
   'Forearm.R':[withdrawal*.035,0,withdrawal*.04],
   'Ear.L':[-ear*.82,0,ear*.65],
   'Ear.R':[-ear*.63,0,-ear*.48],
   'EarTip.L':[ear*.32,0,-ear*.17],
   'EarTip.R':[ear*.26,0,ear*.18]
  };
  for(let i=1;i<=10;i++){
   const follow=i/10;
   pose['Tail.'+String(i).padStart(2,'0')]=[
    clamp(-withdrawal*.002*follow,-.01,.01),
    0,
    clamp(sign*(tailBase*(.48+.52*follow)+
      curiosity*.003*(1-follow)),-.047,.047)
   ];
  }
  const stage={
   x:0, // Page route and V38 card contact own all horizontal translation.
   y:clamp(arousal*.0045-withdrawal*.0055,-.012,.012),
   rx:clamp(-arousal*.01+withdrawal*.009,-.016,.016),
   ry:0,
   rz:clamp(sideTilt*.20,-.014,.014),
   scale:clamp(arousal*.003-withdrawal*.004,-.009,.009)
  };
  return {active,mood,intensity,energy:energyLevel,pose,stage,
   channels:{valence,arousal,curiosity,withdrawal,surprise}};
 }
 function snapshot(){
  return {mood,active,intensity:Math.max(...channels.map(Math.abs)),
   transitions,frames,channels:[...channels]};
 }
 return {sample,reset,snapshot};
}
