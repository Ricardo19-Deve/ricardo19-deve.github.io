/**
 * M Facial V6 runtime.
 * Keeps eye blink tracks independent from the body mixer and writes only
 * Expr_* slots on the body mesh, preserving animated shoulder correctives.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const EXPRESSIONS=Object.freeze({neutral:null,happy:'Expr_Happy',curious:'Expr_Curious',surprised:'Expr_Surprised'});
export const FACIAL_LABELS=Object.freeze({neutral:'Neutra',happy:'Feliz',curious:'Curiosa',surprised:'Surpreendida'});

function findBlinkClip(clips, side) {
 const prefix=side==='left'?'left':'right';
 return clips.find(c=>c.name.toLowerCase().replace(/[^a-z]/g,'').includes(prefix+'blink'))||null;
}
function blinkChannels(root,clip) {
 if(!clip)return [];
 const objects=[];
 root.traverse(o=>{if(o.morphTargetInfluences&&o.name)objects.push(o)});
 return clip.tracks.filter(track=>track.name.includes('.morphTargetInfluences')).map(track=>{
  const name=track.name.slice(0,track.name.indexOf('.morphTargetInfluences'));
  // Longest exact node match avoids ambiguities where mesh names contain dots.
  const mesh=objects.find(o=>o.name===name);
  if(!mesh)return null;
  const interpolant=track.createInterpolant();
  if(!track.values.length||track.values.length%track.times.length!==0)return null;
  const width=track.values.length/track.times.length;
  if(width!==mesh.morphTargetInfluences.length)return null;
  return {mesh,interpolant,width};
 }).filter(Boolean);
}
function peakTime(channels,clip) {
 if(!clip||!channels.length)return .52;
 // Find the first maximum of the "Closed" morph in the first blink.
 const channel=channels.find(({mesh})=>mesh.morphTargetDictionary?.Closed!==undefined)||channels[0];
 const idx=channel.mesh.morphTargetDictionary?.Closed??1;
 let best=-Infinity,bestTime=.52;
 const duration=Math.min(clip.duration,1.1);
 for(let i=0;i<=100;i++){
  const t=duration*i/100;
  const amount=channel.interpolant.evaluate(t)[idx]||0;
  if(amount>best+1e-5){best=amount;bestTime=t;}
 }
 return Math.max(.05,bestTime);
}
function makeBlink(root,clips,side) {
 const clip=findBlinkClip(clips,side),channels=blinkChannels(root,clip);
 return {clip,channels,peak:peakTime(channels,clip),started:-1,duration:900,manual:0};
}
export function createFacialV6(root,clips=[]) {
 const body=[];
 root.traverse(o=>{
  const names=o.morphTargetDictionary;
  if(!names||!o.morphTargetInfluences)return;
  for(const morph of Object.values(EXPRESSIONS)) {
   if(morph&&names[morph]!==undefined)body.push({mesh:o,index:names[morph],morph});
  }
 });
 const eyes={left:makeBlink(root,clips,'left'),right:makeBlink(root,clips,'right')};
 const availableExpressions=Object.fromEntries(Object.entries(EXPRESSIONS).map(([key,morph])=>
  [key,key==='neutral'||body.some(t=>t.morph===morph)]));
 let expression='neutral',blend={happy:0,curious:0,surprised:0},intensity=1.65,autoBlink=true,nextAutoBlink=0;
 function setExpression(key) {
  if(!Object.hasOwn(availableExpressions,key)||!availableExpressions[key])return false;
  expression=key;return true;
 }
 function setIntensity(value){intensity=clamp(Number(value)||1,1,2.5);return intensity;}
 function setAutoBlink(enabled){autoBlink=Boolean(enabled);nextAutoBlink=0;}
 function setBlink(side,amount) {
  if(!eyes[side]?.channels.length)return false;
  eyes[side].manual=clamp(Number(amount)||0);return true;
 }
 function blink(side,now=performance.now()) {
  if(!eyes[side]?.channels.length)return false;
  eyes[side].started=now;return true;
 }
 function applyEye(eye,now) {
  if(!eye.channels.length)return;
  let t=eye.peak*eye.manual;
  if(eye.started>=0){
   const elapsed=now-eye.started;
   if(elapsed>=eye.duration){eye.started=-1;}
   else {
    // Blink clip is 2 seconds long, but its visible close/open phase is
    // in the first second. Sample full visible motion once, never loop.
    t=(elapsed/eye.duration)*Math.min(eye.clip.duration,1.05);
   }
  }
  for(const {mesh,interpolant,width} of eye.channels) {
   const values=interpolant.evaluate(t);
   for(let i=0;i<width;i++)mesh.morphTargetInfluences[i]=values[i];
  }
 }
 function update(dt,now) {
  const k=1-Math.exp(-6*Math.max(0,dt));
  if(autoBlink && eyes.left.channels.length && eyes.right.channels.length) {
   if(!nextAutoBlink)nextAutoBlink=now+2400;
   if(now>=nextAutoBlink){blink('left',now);blink('right',now+45);nextAutoBlink=now+3400+700*(.5+.5*Math.sin(now*.0013));}
  }
  for(const key of ['happy','curious','surprised'])
   blend[key]+=(Number(expression===key)-blend[key])*k;
  // Body mixer may animate shoulder corrective morphs. Never overwrite those.
  for(const {mesh,index,morph} of body) {
   const key=morph.slice(5).toLowerCase();
   mesh.morphTargetInfluences[index]=blend[key]*intensity;
  }
  applyEye(eyes.left,now);applyEye(eyes.right,now);
 }
 function diagnostics() {
  return {
   expressions:Object.keys(availableExpressions).filter(k=>availableExpressions[k]),
   leftBlinkTracks:eyes.left.channels.length,rightBlinkTracks:eyes.right.channels.length,
   leftBlinkClip:eyes.left.clip?.name||null,rightBlinkClip:eyes.right.clip?.name||null,
   bodyMorphs:[...new Set(body.map(t=>t.morph))]
  };
 }
 return {setExpression,setBlink,setIntensity,setAutoBlink,blink,update,diagnostics,
  hasBlink:side=>Boolean(eyes[side]?.channels.length),
  hasExpression:key=>Boolean(availableExpressions[key]),
  get expression(){return expression;},get intensity(){return intensity;}};
}
