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
  return {mesh,interpolant,width,times:track.times};
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

const BLINK_KNOTS=Object.freeze({Pre_Close:.02,Close_10:.1,Close_20:.2,Close_30:.3,Close_40:.4,Half_Closed:.5,Closed:1});
function closingControlPath(channels,clip){
 const channel=channels.find(c=>Object.keys(BLINK_KNOTS).every(name=>c.mesh.morphTargetDictionary?.[name]!==undefined));
 if(!channel||!clip)return null;
 const times=[...new Set([0,...channel.times])].filter(t=>Number.isFinite(t)&&t>=0&&t<=clip.duration).sort((a,b)=>a-b);
 const closed=channel.mesh.morphTargetDictionary.Closed;
 let peak=-Infinity,peakAt=-1;
 for(let i=0;i<times.length;i++){const value=channel.interpolant.evaluate(times[i])[closed];if(value>peak+1e-7){peak=value;peakAt=i;}}
 if(peak<.99||peakAt<1)return null;
 const path=[];
 for(let i=0;i<=peakAt;i++){
  const values=channel.interpolant.evaluate(times[i]);
  if([...values].some(v=>!Number.isFinite(v)||v< -1e-6||v>1.000001)||[...values].reduce((a,b)=>a+b,0)>1.00002)return null;
  let control=0;
  for(const [name,knot]of Object.entries(BLINK_KNOTS))control+=values[channel.mesh.morphTargetDictionary[name]]*knot;
  if(control< -1e-6||control>1.00002||(path.length&&control<path.at(-1).control-1e-6))return null;
  path.push({time:times[i],control:clamp(control)});
 }
 if(path[0].control>1e-6||path.at(-1).control<.99)return null;
 return path;
}
function timeForClosure(eye,amount){
 const value=clamp(amount);
 if(!eye.path)return eye.peak*value; // Preserve compatibility with generic/non-HAT clips.
 if(value===0)return 0;
 for(let i=1;i<eye.path.length;i++){
  const a=eye.path[i-1],b=eye.path[i];
  if(b.control>=value&&b.control>a.control)return a.time+(b.time-a.time)*(value-a.control)/(b.control-a.control);
 }
 return eye.path.at(-1).time;
}

function makeBlink(root,clips,side) {
 const clip=findBlinkClip(clips,side),channels=blinkChannels(root,clip);
 return {clip,channels,path:closingControlPath(channels,clip),peak:peakTime(channels,clip),started:-1,duration:Math.max(.001,clip?.duration??.9)*1000,manual:0};
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
 let expression='neutral',blend={happy:0,curious:0,surprised:0},intensity=1.65,autoBlink=true,nextAutoBlink=0,gestureBlink=null;
 let expressionBlend=null,restBlink=null;
 const restCurrent={left:0,right:0};
 function setExpressionBlend(value=null){
  if(value===null){expressionBlend=null;return true;}
  const keys=['happy','curious','surprised'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))return false;
  const next=Object.fromEntries(keys.map(key=>[key,Object.hasOwn(value,key)?value[key]:0]));
  if(Object.values(next).some(v=>!Number.isFinite(v)||v<0||v>1)||Object.values(next).reduce((a,b)=>a+b,0)>1+1e-8)return false;
  if(keys.some(key=>next[key]>0&&!availableExpressions[key]))return false;
  expressionBlend=next;return true;
 }
 /** A quiet HAT resting pose; blink clips and explicit wink ownership stay independent. */
 function setRestBlink(value=null){
  if(value===null){restBlink=null;return true;}
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['left','right'].includes(key))
   ||!['left','right'].every(side=>Number.isFinite(value[side])&&value[side]>=0&&value[side]<=.55&&
    (value[side]===0||eyes[side].path)))return false;
  restBlink={left:value.left,right:value.right};return true;
 }
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
 /** Temporary wink ownership. Existing manual sliders and auto preference survive. */
 function setGestureBlink(value=null){
  if(value===null){
   if(gestureBlink){gestureBlink=null;nextAutoBlink=0;}
   return true;
  }
  if(typeof value!=='object'||!['left','right'].every(side=>Number.isFinite(value[side])))return false;
  if(!['left','right'].every(side=>eyes[side].channels.length||value[side]===0))return false;
  // Cancel an automatic clip once, so release cannot resume halfway through it.
  if(!gestureBlink)for(const eye of Object.values(eyes))eye.started=-1;
  gestureBlink={left:clamp(value.left),right:clamp(value.right)};return true;
 }
 function blink(side,now=performance.now()) {
  if(!eyes[side]?.channels.length)return false;
  eyes[side].started=now;return true;
 }
 function applyEye(eye,now,side) {
  if(!eye.channels.length)return;
  let t=timeForClosure(eye,gestureBlink?gestureBlink[side]:eye.manual);
  if(!gestureBlink&&eye.started>=0){
   const elapsed=now-eye.started;
   if(elapsed>=eye.duration){eye.started=-1;}
   else {
    // Source seconds remain source seconds: no artificial 900 ms compression.
    t=Math.max(0,elapsed)/1000;
   }
  }
  // Preserve source timing whenever the original clip closes more than the
  // quiet rest pose. A rest pose supplies only a lower bound during reopening.
  if(!gestureBlink&&restCurrent[side]>1e-8&&eye.path){
   const channel=eye.channels.find(({mesh})=>Object.keys(BLINK_KNOTS).every(name=>mesh.morphTargetDictionary?.[name]!==undefined));
   const values=channel.interpolant.evaluate(t);
   const closure=Object.entries(BLINK_KNOTS).reduce((sum,[name,knot])=>sum+values[channel.mesh.morphTargetDictionary[name]]*knot,0);
   if(restCurrent[side]>closure)t=timeForClosure(eye,restCurrent[side]);
  }
  for(const {mesh,interpolant,width} of eye.channels) {
   const values=interpolant.evaluate(t);
   for(let i=0;i<width;i++)mesh.morphTargetInfluences[i]=values[i];
  }
 }
 function update(dt,now) {
  const k=1-Math.exp(-6*Math.max(0,dt));
  if(autoBlink && !gestureBlink && eyes.left.channels.length && eyes.right.channels.length) {
   if(!nextAutoBlink)nextAutoBlink=now+2400;
   if(now>=nextAutoBlink){blink('left',now);blink('right',now+45);nextAutoBlink=now+3400+700*(.5+.5*Math.sin(now*.0013));}
  }
  for(const key of ['happy','curious','surprised'])
   blend[key]+=((expressionBlend?expressionBlend[key]:Number(expression===key))-blend[key])*k;
  for(const side of ['left','right'])restCurrent[side]+=((restBlink?.[side]||0)-restCurrent[side])*(1-Math.exp(-8*Math.max(0,dt)));
  // Body mixer may animate shoulder corrective morphs. Never overwrite those.
  for(const {mesh,index,morph} of body) {
   const key=morph.slice(5).toLowerCase();
   mesh.morphTargetInfluences[index]=blend[key]*(expressionBlend?1:intensity);
  }
  applyEye(eyes.left,now,'left');applyEye(eyes.right,now,'right');
 }
 function observedClosure(eye){
  const channel=eye.channels.find(({mesh})=>Object.keys(BLINK_KNOTS).every(name=>mesh.morphTargetDictionary?.[name]!==undefined));
  if(!channel)return null;
  let closure=0;
  for(const [name,knot]of Object.entries(BLINK_KNOTS)){
   const weight=channel.mesh.morphTargetInfluences[channel.mesh.morphTargetDictionary[name]];
   if(!Number.isFinite(weight))return null;
   closure+=weight*knot;
  }
  return clamp(closure);
 }
 function observedExpressions(){
  return Object.fromEntries(['happy','curious','surprised'].map(key=>{
   const slots=body.filter(item=>item.morph===EXPRESSIONS[key]),values=slots.map(({mesh,index})=>mesh.morphTargetInfluences[index]);
   return [key,values.some(value=>!Number.isFinite(value))?null:values.length?values.reduce((a,b)=>a+b,0)/values.length:0];
  }));
 }
 function diagnostics() {
  return {
   expressions:Object.keys(availableExpressions).filter(k=>availableExpressions[k]),
   leftBlinkTracks:eyes.left.channels.length,rightBlinkTracks:eyes.right.channels.length,
   leftBlinkClip:eyes.left.clip?.name||null,rightBlinkClip:eyes.right.clip?.name||null,
   bodyMorphs:[...new Set(body.map(t=>t.morph))],
   intensity,extrapolatingExpressions:!expressionBlend&&intensity>1,gestureBlinkActive:Boolean(gestureBlink),
   expressionBlendActive:Boolean(expressionBlend),expressionWeights:observedExpressions(),
   expressionTarget:expressionBlend?{...expressionBlend}:Object.fromEntries(['happy','curious','surprised'].map(key=>[key,Number(expression===key)])),
   restBlinkActive:Boolean(restBlink),restBlinkTarget:restBlink?{...restBlink}:null,restBlinkCurrent:{...restCurrent},
   leftBlinkControl:eyes.left.path?'seven-key-hat':'generic',rightBlinkControl:eyes.right.path?'seven-key-hat':'generic',
   leftBlinkDurationMs:eyes.left.duration,rightBlinkDurationMs:eyes.right.duration,leftClosure:observedClosure(eyes.left),rightClosure:observedClosure(eyes.right)
  };
 }
 return {setExpression,setExpressionBlend,setBlink,setGestureBlink,setRestBlink,setIntensity,setAutoBlink,blink,update,diagnostics,
  hasBlink:side=>Boolean(eyes[side]?.channels.length),
  hasExpression:key=>Boolean(availableExpressions[key]),
  get expression(){return expression;},get intensity(){return intensity;}};
}
