/**
 * Session-local intent selection for M. The spatial planner remains authoritative
 * for every route, text exclusion and depth transition. No motion is changed here.
 */
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const validId=id=>typeof id==='string'&&id.length>0||typeof id==='number'&&Number.isFinite(id);
const COOLDOWN_MS=24000;
const MEMORY_LIMIT=24;
const hash=(value,seed)=>{
 let h=seed;
 for(const character of String(value))h=Math.imul(h^character.charCodeAt(0),16777619)>>>0;
 return h/4294967296;
};

export class MWorldBrain {
 constructor({seed=18421}={}){
  this._seed=(seed>>>0)||18421;
  this._now=0;this._section=null;this._quietUntil=0;this._recent=[];
  this._context={scrolling:false,reading:false,engaged:false,reducedMotion:false,hidden:false,active:true};
  this._chosen=null;this._reason='waiting';
 }
 _time(nowMs){
  if(Number.isFinite(nowMs))this._now=Math.max(this._now,nowMs,0);
  return this._now;
 }
 _blocked(){
  const c=this._context;
  if(!c.active)return 'inactive';
  if(c.hidden)return 'hidden';
  if(c.reducedMotion)return 'reduced-motion';
  if(c.reading)return 'reading';
  if(c.engaged)return 'engaged';
  if(c.scrolling)return 'scrolling';
  return this._now<this._quietUntil?'settling':null;
 }
 observe({nowMs,section=null,scrolling=false,reading=false,engaged=false,
  reducedMotion=false,hidden=false,active=true}={}){
  const now=this._time(nowMs);
  section=validId(section)?section:null;
  // A section change settles once; repeated observations never postpone it alone.
  if(section!==this._section){this._section=section;this._quietUntil=Math.max(this._quietUntil,now+1100);}
  this._context={scrolling:Boolean(scrolling),reading:Boolean(reading),engaged:Boolean(engaged),
   reducedMotion:Boolean(reducedMotion),hidden:Boolean(hidden),active:Boolean(active)};
  const pause=reading?6500:engaged?4000:scrolling?1400:hidden||!active||reducedMotion?1500:0;
  if(pause)this._quietUntil=Math.max(this._quietUntil,now+pause);
  return this.snapshot();
 }
 chooseTarget(candidates,{nowMs,actor={},viewport={}}={}){
  const now=this._time(nowMs),blocked=this._blocked();
  const finish=(id,reason)=>{this._chosen=id;this._reason=reason;return id;};
  if(blocked)return finish(null,blocked);
  const {width:w,height:h}=viewport;
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return finish(null,'invalid-viewport');
  const ax=Number.isFinite(actor.x)?actor.x:w*.5,ay=Number.isFinite(actor.y)?actor.y:h*.5;
  const diagonal=Math.hypot(w,h),seen=new Set();
  let best=null,bestScore=-Infinity,validCount=0;
  for(const r of Array.isArray(candidates)?candidates:[]){
   if(!r||!validId(r.id)||seen.has(r.id))continue;
   const {left,top,right,bottom}=r;
   if(![left,top,right,bottom].every(Number.isFinite)||right-left<30||bottom-top<30||
    (r.width!==undefined&&(!Number.isFinite(r.width)||r.width<=0))||
    (r.height!==undefined&&(!Number.isFinite(r.height)||r.height<=0)))continue;
   const visibleWidth=Math.max(0,Math.min(right,w)-Math.max(left,0));
   const visibleHeight=Math.max(0,Math.min(bottom,h)-Math.max(top,0));
   const visibleArea=visibleWidth*visibleHeight,share=visibleArea/((right-left)*(bottom-top));
   const protectedCoverage=r.protectedCoverage===undefined?0:
    Number.isFinite(r.protectedCoverage)?clamp(r.protectedCoverage,0,1):1;
   const availableArea=visibleArea*(1-protectedCoverage);
   if(visibleWidth<24||visibleHeight<24||share<.3||availableArea<1600||protectedCoverage>=.85)continue;
   seen.add(r.id);validCount++;
   const visit=this._recent.find(item=>item.id===r.id);
   if(visit&&now-visit.atMs<COOLDOWN_MS)continue;
   const x=(Math.max(left,0)+Math.min(right,w))*.5,y=(Math.max(top,0)+Math.min(bottom,h))*.5;
   const nearby=1-clamp(Math.hypot(x-ax,y-ay)/diagonal,0,1);
   const context=1-clamp(Math.abs(y-h*.48)/h,0,1);
   const novelty=visit?.count?Math.max(0,.8-visit.count*.16):1;
   // Seeded variation only resolves close ties. Geometry and attention win.
   const tie=hash(`${this._section}:${r.id}`,this._seed)*.008;
   const score=share*2.4+Math.sqrt(availableArea/(w*h))*1.5+nearby*1.2+
    context*.25+novelty*.8-protectedCoverage*1.6+tie;
   if(score>bestScore||(score===bestScore&&String(r.id)<String(best?.id))){bestScore=score;best={id:r.id,visited:Boolean(visit)};}
  }
  return best?finish(best.id,best.visited?'revisit-after-cooldown':'explore-visible-area'):
   finish(null,validCount?'visit-cooldown':'no-visible-candidate');
 }
 /** Record only a target accepted by the spatial planner; failed plans are not visits. */
 noteVisit(id,nowMs){
  const now=this._time(nowMs);
  if(!validId(id))return false;
  const previous=this._recent.find(item=>item.id===id);
  this._recent=this._recent.filter(item=>item.id!==id);
  this._recent.push({id,atMs:now,count:Math.min(999,(previous?.count||0)+1),section:this._section});
  if(this._recent.length>MEMORY_LIMIT)this._recent.shift();
  return true;
 }
 snapshot(){
  return {section:this._section,nowMs:this._now,quietUntil:this._quietUntil,
   spontaneousAllowed:!this._blocked(),chosenTarget:this._chosen,reason:this._reason,
   context:{...this._context},recentTargets:this._recent.map(item=>({...item}))};
 }
}
