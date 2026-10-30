/**
 * M V16 · local behavior intelligence
 * Lightweight finite-state character director — no API calls, storage,
 * tracking, timers or networking. The browser calls step(dt) each frame.
 * Deterministic pseudo-randomness makes the same seed reproducible in tests.
 */
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:0));
const smooth=(x)=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
const LABELS=Object.freeze({
 resting:'Em descanso',exploring:'A explorar',watching:'A observar-te',
 welcoming:'Contente por te ver',startled:'Surpreendida',shy:'Um pouco tímida',
 playing:'Brincalhona',swimming:'A nadar',paused:'Em pausa'
});
export const M_LIFE_MOODS=LABELS;
export class MLifeV16 {
 constructor({seed=1481,enabled=true,personality='balanced'}={}){
  this.seed=(seed>>>0)||1481;
  this.enabled=Boolean(enabled);
  this.personality=personality;
  this.time=0;this.nextAction=5;this.nextGaze=1.5;
  this.lastActivity=-100;this.pointerTime=-100;
  this.manualUntil=0;this.pointer={x:0,y:0};this.pointerInside=false;
  this.target={x:0,y:0};this.gaze={x:0,y:0};
  this.mood='resting';this.actionCount=0;this.lastAction='float';
  this.tapHistory=[];this.bond=0;this.pending=null;this.actions=[];
 }
 random(){
  this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
  return this.seed/4294967296;
 }
 choose(items){
  const total=items.reduce((s,item)=>s+item[1],0);
  let r=this.random()*total;
  for(const [value,weight] of items){r-=weight;if(r<=0)return value;}
  return items.at(-1)[0];
 }
 setEnabled(value){
  this.enabled=Boolean(value);
  this.pending=null;
  if(!this.enabled)this.mood='paused';
  else {this.mood='resting';this.nextAction=this.time+2.8;}
  return this.enabled;
 }
 setPersonality(value){
  if(!['balanced','calm','playful'].includes(value))return false;
  this.personality=value;return true;
 }
 manual(){
  this.lastActivity=this.time;
  this.manualUntil=this.time+11;
  this.pending=null;
  this.nextAction=Math.max(this.nextAction,this.manualUntil+3);
 }
 signal(kind,payload={}){
  if(kind==='pointer'){
   this.pointerInside=true;
   this.pointer={x:clamp(payload.x,-1,1),y:clamp(payload.y,-1,1)};
   this.pointerTime=this.time;
   this.lastActivity=this.time;
   this.target={...this.pointer};
   // Pointer movement is attention, never a forced mode change.
  }else if(kind==='leave'){
   this.pointerInside=false;this.nextGaze=Math.min(this.nextGaze,this.time+1.1);
  }else if(kind==='tap'){
   this.lastActivity=this.time;
   this.manualUntil=this.time; // a new tap interrupts the manual inactivity lock
   this.tapHistory=this.tapHistory.filter(time=>this.time-time<4);
   this.tapHistory.push(this.time);
   this.bond=Math.min(1,this.bond+.09);
   // A double tap surprises; repeated quick taps make M hide playfully.
   const count=this.tapHistory.length;
   this.pending=count>=4?{mode:'shy',mood:'shy',expression:'curious'}:
     count>=2?{mode:'knock',mood:'startled',expression:'surprised'}:
     {mode:'curious',mood:'welcoming',expression:'happy'};
   this.nextAction=this.time+8;
  }else if(kind==='scroll'){
   const magnitude=clamp(Math.abs(payload.delta||0),0,1);
   if(magnitude>.18&&this.time-this.lastActivity>1.1){
    this.lastActivity=this.time;this.target.x=clamp((payload.delta||0)*.8,-1,1);
    this.target.y=-.3;this.nextGaze=this.time+2;
   }
  }
 }
 step(dt,{mode='float',demo=false,reducedMotion=false,manualFace=false}={}){
  dt=clamp(dt,0,.08);
  this.time+=dt;
  if(this.pointerInside&&this.time-this.pointerTime>3.7)this.pointerInside=false;
  const active=this.enabled&&!demo&&!reducedMotion;
  const gazeSpeed=1-Math.exp(-(this.pointerInside?5.2:1.7)*dt);
  if(!active){this.gaze.x+=(0-this.gaze.x)*gazeSpeed;this.gaze.y+=(0-this.gaze.y)*gazeSpeed;
   return this.snapshot(null);
  }
  if(this.pointerInside&&this.time-this.pointerTime<2.5){
   this.target={...this.pointer};
   if(this.mood!=='startled'&&this.mood!=='shy')this.mood='watching';
  }else if(this.time>=this.nextGaze){
   this.target={x:(this.random()-.5)*.95,y:(this.random()-.5)*.6};
   this.nextGaze=this.time+2.5+this.random()*3.3;
   if(this.mood==='watching')this.mood='exploring';
   if(mode==='float'&&this.time-this.lastActivity>5)this.mood='resting';
  }
  this.gaze.x+=(this.target.x-this.gaze.x)*gazeSpeed;
  this.gaze.y+=(this.target.y-this.gaze.y)*gazeSpeed;
  let action=null;
  if(this.pending&&!manualFace&&this.time>=this.manualUntil){
   action=this.pending;this.pending=null;
  }else if(this.time>=this.nextAction && this.time>=this.manualUntil &&
             (mode==='float'||mode==='swim') && !this.pointerInside && !manualFace){
   const energetic=this.personality==='playful';
   const quiet=this.personality==='calm';
   const next=this.choose([
    ['curious',quiet?4:3],['peek',quiet?2:3+this.bond],['swim',energetic?3+this.bond:1.4],
    ['shy',quiet?1.2:.6],['float',quiet?4:1.5]
   ].filter(([key])=>key!==this.lastAction));
   const mappings={
    curious:{mood:'exploring',expression:'curious'},
    peek:{mood:'playing',expression:'curious'},
    swim:{mood:'swimming',expression:'happy'},
    shy:{mood:'shy',expression:'curious'},
    float:{mood:'resting',expression:'neutral'}
   };
   action={mode:next,...mappings[next]};
   this.nextAction=this.time+(quiet?8:energetic?4.3:6)+this.random()*4;
  }
  if(action){
   this.lastAction=action.mode;this.mood=action.mood;
   this.actionCount++;
  }
  // A manually selected facial pose is always preserved.
  if(action&&manualFace)action={...action,expression:null};
  return this.snapshot(action);
 }
 snapshot(action){
  return {
   action,
   mood:this.mood,
   moodLabel:LABELS[this.mood]||LABELS.resting,
   gaze:{...this.gaze},
   bond:this.bond,
   active:this.enabled,
   attention:this.pointerInside?'pointer':'environment',
   actions:this.actionCount
  };
 }
}
