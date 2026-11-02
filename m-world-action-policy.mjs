/** Explicit gestures outrank autonomous life; staging never changes position or depth. */
export const isExplicitGesture=intent=>Boolean(intent&&intent.source!=='life');
export const gesturePriority=intent=>!intent?-1:intent.source==='life'?0:intent.source==='director'?1:2;
export function selectGestureIntent(current,incoming,playing=null){
 if(gesturePriority(incoming)<Math.max(gesturePriority(current),gesturePriority(playing)))return current;
 return incoming;
}
export function gestureIntentExpired(intent,clock){return Boolean(intent&&!isExplicitGesture(intent)&&clock-intent.queuedAt>30);}
export function gestureReady({state,actor,viewport,escaping=false}){
 return state.phase==='hold'&&actor.left>=0&&actor.right<=viewport.width&&actor.top>=0&&actor.bottom<=viewport.height&&state.depth>.95&&Math.hypot(state.vx,state.vy)<3&&!escaping;
}
const coveredArea=(actor,masks)=>{
 const clipped=masks.map(r=>({left:Math.max(actor.left,r.left),right:Math.min(actor.right,r.right),top:Math.max(actor.top,r.top),bottom:Math.min(actor.bottom,r.bottom)})).filter(r=>r.right>r.left&&r.bottom>r.top);
 const xs=[...new Set(clipped.flatMap(r=>[r.left,r.right]))].sort((a,b)=>a-b);let covered=0;
 for(let i=1;i<xs.length;i++){
  const middle=(xs[i-1]+xs[i])/2,intervals=clipped.filter(r=>r.left<middle&&r.right>middle).map(r=>[r.top,r.bottom]).sort((a,b)=>a[0]-b[0]);
  let length=0,lo=0,hi=0;
  for(const [a,b]of intervals){if(a>hi){length+=hi-lo;lo=a;hi=b;}else hi=Math.max(hi,b);}
  covered+=(xs[i]-xs[i-1])*(length+hi-lo);
 }
 return covered;
};
const intersects=(a,b,pad=2)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
export function gestureViewportFits(metrics,viewport){
 const f=metrics?.footprint;return Boolean(f&&Number.isFinite(viewport?.width)&&Number.isFinite(viewport?.height)&&viewport.width>=f.width+16&&viewport.height>=f.height+16);
}
/** Find a visible acting place and the closest genuine depth gate, including an external fallback. */
export function planGestureStage({position,metrics,viewport,surfaces=[],protectedRects=[]}){
 if(!gestureViewportFits(metrics,viewport))return null;
 const f=metrics.footprint,n=metrics.neutralFootprint?.width>0&&metrics.neutralFootprint?.height>0?metrics.neutralFootprint:f,v=viewport,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const limits={left:8-f.left,right:v.width-f.right-8,top:8-f.top,bottom:v.height-f.bottom-8};
 const constrain=p=>({x:clamp(p.x,limits.left,limits.right),y:clamp(p.y,limits.top,limits.bottom)});
 const bounds=(p,footprint=f)=>({left:p.x+footprint.left,right:p.x+footprint.right,top:p.y+footprint.top,bottom:p.y+footprint.bottom});
 // The animation envelope must fit the viewport. Visibility belongs to the
 // neutral body: narrow spaces above chat can fit M even when a tail or ear
 // envelope overlaps the protected header and remains masked there.
 const masks=[...protectedRects,{left:0,top:0,right:v.width,bottom:(v.headerBottom||0)+4}];
 const origin={x:position.x,y:position.y},candidates=[constrain(origin)];
 for(let y=limits.top;y<=limits.bottom;y+=16)for(let x=limits.left;x<=limits.right;x+=16)candidates.push({x,y});
 candidates.push({x:limits.right,y:limits.bottom},{x:limits.left,y:limits.bottom});
 // Include exact safe edges so a narrow responsive gap cannot fall between
 // grid rows. These candidates retain the nearest coordinate on the other axis.
 for(const r of masks)for(const footprint of [n,f])for(const p of [
  {x:r.left-footprint.right-4,y:origin.y},{x:r.right-footprint.left+4,y:origin.y},
  {x:origin.x,y:r.top-footprint.bottom-4},{x:origin.x,y:r.bottom-footprint.top+4}
 ])candidates.push(constrain(p));
 const rows=candidates.map(p=>({p,body:coveredArea(bounds(p,n),masks),envelope:coveredArea(bounds(p),masks),distance:Math.hypot(p.x-origin.x,p.y-origin.y)}));
 const bodyMinimum=Math.min(...rows.map(r=>r.body));
 let safe=rows.filter(r=>r.body<=bodyMinimum+1e-8);
 const envelopeMinimum=Math.min(...safe.map(r=>r.envelope));
 safe=safe.filter(r=>r.envelope<=envelopeMinimum+f.width*f.height*.10);
 safe.sort((a,b)=>a.distance-b.distance||a.envelope-b.envelope||a.p.y-b.p.y||a.p.x-b.p.x);
 const target=safe[0].p;
 // Depth changes remain owned by resolveDepth and the actual moving footprint.
 // Prefer nearby on-screen clearance to an unnecessary trip across the page.
 const left=Math.min(0,...surfaces.map(r=>r.left))-f.right-16,right=Math.max(v.width,...surfaces.map(r=>r.right))-f.left+16;
 const gates=[origin,...candidates,{x:left,y:constrain(origin).y},{x:right,y:constrain(origin).y}];
 const clear=p=>!surfaces.some(r=>intersects(bounds(p),r,8));
 const ranked=gates.filter(clear).map(p=>({p,score:Math.hypot(p.x-origin.x,p.y-origin.y)+Math.hypot(p.x-target.x,p.y-target.y)*.1})).sort((a,b)=>a.score-b.score);
 const escape=position.depthTarget<0||position.depth<.95,a=bounds(origin);
 return {target,egress:ranked[0].p,escape,reentry:escape||a.left<0||a.right>v.width||a.top<0||a.bottom>v.height};
}
