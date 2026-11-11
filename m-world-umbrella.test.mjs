import test from 'node:test';
import assert from 'node:assert/strict';
import {umbrellaDimensions,canopyHeightAt,umbrellaCanopyProfile,createUmbrellaState} from './m-world-umbrella.mjs';

const grip={x:.20,y:-.27,z:.09},head={x:0,y:.20,z:.08};
const defaults={grip,head,headTop:.45,frontLimit:.30,target:true,windDrift:-.8,windForce:.7};
const settle=(engine,seconds=3,rate=60,input=defaults)=>{let result;for(let i=0;i<seconds*rate;i++)result=engine.sample({...input,dt:1/rate});return result;};
const approx=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,a+' differs from '+b);

test('umbrella is proportioned to M and the canopy has a real closed thin shell',()=>{
 const d=umbrellaDimensions(2),profile=umbrellaCanopyProfile(d);
 approx(d.radius/2,.46);approx(d.depth/2,.14);approx(d.thickness/2,.009);approx(d.shaftRadius/2,.009);
 assert.equal(profile.length,16);assert.equal(profile[0].x,0);approx(profile[0].y,d.depth);
 assert.equal(profile[7].x,d.radius);assert.equal(profile[7].y,0);assert.equal(profile[8].x,d.radius);approx(profile[8].y,-d.thickness);
 for(let i=0;i<8;i++){const outer=profile[i],inner=profile[15-i];approx(outer.x,inner.x);approx(outer.y-inner.y,d.thickness);}
 assert.equal(canopyHeightAt(1,d.depth),0);assert.equal(canopyHeightAt(NaN,d.depth),d.depth);
 assert.throws(()=>umbrellaDimensions(0));assert.throws(()=>umbrellaDimensions(Infinity));
});

test('the grip is exact during motion while the canopy covers and follows the head',()=>{
 const model=createUmbrellaState(),first=model.sample({...defaults,dt:0});
 assert.deepEqual(first.grip,grip);assert.equal(first.openness,1);
 for(let frame=0;frame<180;frame++){
  const position={x:grip.x+Math.sin(frame*.1)*.12,y:grip.y+Math.cos(frame*.1)*.1,z:grip.z-.12};
  const state=model.sample({...defaults,grip:position,dt:1/60});
  assert.deepEqual(state.grip,position,'no pushed-forward or lagging paw anchor');
  assert.equal(state.gripErrorRatio,0);assert.ok(state.headCoverageMarginRatio>.08);
  assert.ok(state.crownClearanceRatio>.335);
  assert.ok(state.rimClearanceRatio>=.085);
  assert.ok(state.roofClearanceRatio>.45);
 }
});

test('either paw keeps the main shaft outside the face and retains its initial side',()=>{
 for(const side of [-1,1]){
  const model=createUmbrellaState(),input={...defaults,grip:{...grip,x:side*.20}};
  const state=settle(model,3,60,input);
  assert.ok(state.guide.y<=head.y-.22);
  assert.ok(state.guide.z>.30&&state.shaftTop.z>.30);
  approx(state.guide.x-head.x,side*.36);approx(state.shaftTop.x,state.guide.x);
  assert.equal(state.shaftSide,side);
  approx(state.shaftFaceOffsetRatio,.36);
  assert.ok(Math.abs(state.shaftTop.x-head.x)>.30,'vertical shaft stays out of the facial corridor');
  assert.ok(state.neckEnd.y>state.shaftTop.y,'neck returns overhead to support the canopy centre');
  assert.equal(state.neckEnd.z,state.crown.z);assert.deepEqual(state.grip,input.grip);
  model.sample({...input,grip:{...grip,x:-side*.24},dt:1/60});
  assert.equal(state.shaftSide,side,'crossing the head never flips the shaft to the other side');
  approx(state.guide.x-head.x,side*.36);
 }
});

test('actual posed head tops in either local direction set the rim height with a conservative fallback',()=>{
 for(const headTop of [-.35,.45,1.15]){
  const state=settle(createUmbrellaState(),3,60,{...defaults,headTop});
  assert.equal(state.headTop,headTop);assert.equal(state.headTopProvided,true);
  assert.ok(state.crown.y>=headTop+.085+state.tiltMarginRatio);
  assert.ok(state.rimClearanceRatio>=.085);
  assert.equal(state.headTopClearanceRatio,state.rimClearanceRatio);
 }
 for(const headTop of [undefined,NaN,Infinity]){
  const state=settle(createUmbrellaState(),3,60,{...defaults,headTop});
  assert.equal(state.headTopProvided,false);approx(state.headTop,head.y+.25);
  assert.ok(state.rimClearanceRatio>=.085);
 }
 const model=createUmbrellaState();settle(model);
 const jumped=model.sample({...defaults,headTop:.8,dt:1/60});
 assert.ok(jumped.crown.y>=.8+.085+jumped.tiltMarginRatio,'an abrupt new mesh bound prioritizes physical separation');
});

test('tilted fabric and the complete rim remain above the actual ears through folding',()=>{
 const model=createUmbrellaState(),d=model.dimensions,profile=umbrellaCanopyProfile(d);
 model.sample({...defaults,dt:0});
 for(let frame=0;frame<100;frame++){
  const state=model.sample({...defaults,target:frame<40,windDrift:frame<50?-1:1,windForce:1,dt:1/60});
  const ys=1+.45*(1-state.fold),sr=Math.sin(state.roll),cr=Math.cos(state.roll),sp=Math.sin(state.pitch),cp=Math.cos(state.pitch);
  // Independent XYZ-rotation projection of the actual shell/rim samples.
  const worldY=(x,y,z)=>state.crown.y+cp*(sr*x+cr*y)-sp*z;
  for(let angle=0;angle<64;angle++){
   const theta=angle*Math.PI/32,c=Math.cos(theta),s=Math.sin(theta);
   for(const point of profile){
    const y=worldY(point.x*c*state.fold,point.y*ys,point.x*s*state.fold);
    assert.ok(y>=defaults.headTop+.085,'fabric must clear the highest actual ear vertex');
   }
   for(let cross=0;cross<12;cross++){
    const phi=cross*Math.PI/6,r=d.radius+d.rimRadius*Math.cos(phi);
    const y=worldY(r*c*state.fold,d.rimRadius*Math.sin(phi)*ys,r*s*state.fold);
    assert.ok(y>=defaults.headTop+.085,'the rim tube also needs a visible gap');
   }
  }
 }
});

test('canopy opens geometrically, folds before disappearing, and reverses without reset',()=>{
 const model=createUmbrellaState();model.sample({...defaults,target:false,dt:0});
 let pose=model.sample({...defaults,dt:1/60});assert.ok(pose.openness>0&&pose.openness<.1);assert.ok(pose.fold>.1&&pose.fold<.12);
 pose=settle(model,1);assert.ok(pose.openness>.99&&pose.fold>.99);
 const open=pose.openness;pose=model.sample({...defaults,target:false,dt:1/60});assert.ok(pose.openness<open&&pose.openness>.9);
 for(let i=0;i<12;i++)pose=model.sample({...defaults,target:false,dt:1/60});
 const closing=pose.openness;assert.ok(closing>.05&&closing<.4);assert.equal(pose.visible,true);assert.ok(pose.fold<.4);
 pose=model.sample({...defaults,target:true,dt:1/60});assert.ok(Math.abs(pose.openness-closing)<.05,'reversal keeps current aperture and velocity');
 pose=settle(model,2,60,{...defaults,target:false});assert.equal(pose.visible,false);assert.ok(pose.openness<.0001);
});

test('wind retargeting is continuous and bounded instead of shaking the physical grip',()=>{
 const model=createUmbrellaState();let pose=settle(model);
 const before=pose.roll;pose=model.sample({...defaults,windDrift:1,windForce:1,dt:1/60});
 assert.ok(Math.abs(pose.roll-before)<.002);assert.deepEqual(pose.grip,grip);
 for(let i=0;i<180;i++)pose=model.sample({...defaults,windDrift:i%50<25?-1:1,windForce:1,dt:1/60});
 assert.ok(Math.abs(pose.roll)<=.10);assert.ok(Math.abs(pose.pitch)<=.025);assert.ok(pose.headCoverageMarginRatio>0);
});

test('opening, wind and canopy follow are consistent at 30,60 and120Hz',()=>{
 function run(rate){const model=createUmbrellaState();model.sample({...defaults,target:false,dt:0});return settle(model,1,rate);}
 const reference=run(60);
 for(const rate of [30,120]){const sample=run(rate);approx(sample.openness,reference.openness,1e-10);approx(sample.roll,reference.roll,1e-10);approx(sample.pitch,reference.pitch,1e-10);approx(sample.crown.x,reference.crown.x,1e-10);}
});

test('continuous posed head motion preserves roof and side-shaft continuity at 30,60 and120Hz',()=>{
 function run(rate){
  const model=createUmbrellaState();model.sample({...defaults,dt:0});
  let previousY=model.snapshot().crown.y,previousX=model.snapshot().guide.x;
  for(let frame=1;frame<=rate*2;frame++){
   const t=frame/rate,x=.02*Math.sin(Math.PI*t/2),headTop=defaults.headTop+.025*Math.sin(Math.PI*t);
   const state=model.sample({...defaults,head:{...head,x},headTop,grip:{...grip,x:grip.x+x},dt:1/rate});
   assert.ok(Math.abs(state.crown.y-previousY)<.009,'normal head motion never jumps the canopy');
   assert.ok(Math.abs(state.guide.x-previousX)<.002,'side shaft follows a continuous head path');
   assert.ok(state.rimClearanceRatio>=.085);approx(state.guide.x-x,.36);
   previousY=state.crown.y;previousX=state.guide.x;
  }
  return model.snapshot();
 }
 const reference=run(60);
 for(const rate of [30,120]){const sample=run(rate);approx(sample.crown.y,reference.crown.y,.0007);approx(sample.guide.x,reference.guide.x);}
});

test('reduced motion and invalid anchors cannot leave a stale visible accessory or NaNs',()=>{
 for(const input of [{reducedMotion:true},{grip:{x:NaN,y:0,z:0}},{head:null}]){
  const model=createUmbrellaState();settle(model);const sample=model.sample({...defaults,...input,dt:1/60});
  assert.equal(sample.visible,false);assert.equal(sample.openness,0);assert.equal(sample.roll,0);assert.equal(sample.pitch,0);
 }
 const model=createUmbrellaState();const state=model.sample({...defaults,dt:NaN,windDrift:Infinity,windForce:NaN,frontLimit:Infinity});
 for(const value of [state.roll,state.pitch,state.fold,state.crown.x,state.crown.y,state.crown.z,state.shaftTop.z])assert.ok(Number.isFinite(value));
});

test('sample vectors are reused and snapshot copies cannot mutate the next frame',()=>{
 const model=createUmbrellaState(),first=model.sample({...defaults,dt:0}),gripRef=first.grip,crownRef=first.crown;
 const next=model.sample({...defaults,dt:.02});assert.equal(next,first);assert.equal(next.grip,gripRef);assert.equal(next.crown,crownRef);
 const snapshot=model.snapshot();snapshot.grip.x=999;snapshot.crown.y=999;
 assert.notEqual(model.snapshot().grip.x,999);assert.notEqual(model.snapshot().crown.y,999);
});
