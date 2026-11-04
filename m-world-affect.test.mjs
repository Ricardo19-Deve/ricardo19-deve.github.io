import test from 'node:test';
import assert from 'node:assert/strict';
import {M_AFFECTS,AFFECT_DURATIONS,sampleAffect} from './m-world-affect.mjs';

test('all original-morph performances remain finite, bounded and distinct through dense full cycles',()=>{
 const holds=[];
 for(const name of M_AFFECTS.filter(name=>name!=='neutral')){
  const duration=AFFECT_DURATIONS[name];
  assert.ok(duration>=4&&duration<=7);
  for(const weight of [.25,1,1000000]){
   let previous;
   for(let i=0;i<=2000;i++){
    const pose=sampleAffect({name,age:duration*i/2000,weight});
    const weights=Object.values(pose.weights),lids=Object.values(pose.eyelids),channels=[...weights,...lids];
    assert.ok(weights.every(v=>Number.isFinite(v)&&v>=0&&v<=1),`${name} expression bounds`);
    assert.ok(weights.reduce((a,b)=>a+b,0)<=1+1e-10,`${name} composition budget`);
    assert.ok(lids.every(v=>Number.isFinite(v)&&v>=0&&v<=.5),`${name} HAT bounds`);
    if(previous)assert.ok(channels.every((v,index)=>Math.abs(v-previous[index])<.006),`${name} continuous channels`);
    previous=channels;
   }
  }
  const hold=sampleAffect({name,age:duration*.45});
  assert.equal(hold.phase,'hold');assert.equal(hold.envelope,1);
  holds.push(JSON.stringify([hold.weights,hold.eyelids]));
 }
 assert.equal(new Set(holds).size,M_AFFECTS.length-1);
});

test('performances enter and leave the neutral face without position or velocity discontinuity',()=>{
 for(const name of M_AFFECTS){
  const duration=AFFECT_DURATIONS[name];
  for(const age of [-1,0,duration,duration+1]){
   const pose=sampleAffect({name,age});
   assert.deepEqual(pose.weights,{happy:0,curious:0,surprised:0});
   assert.deepEqual(pose.eyelids,{left:0,right:0});
  }
  if(!duration)continue;
  for(const age of [.0001,duration-.0001]){
   const pose=sampleAffect({name,age});
   assert.ok(Object.values(pose.weights).every(v=>v/.0001<.0001));
   assert.ok(Object.values(pose.eyelids).every(v=>v/.0001<.0001));
  }
 }
});

test('reduced motion, invalid inputs and zero intensity cannot activate any face layer',()=>{
 const options=[{}, {name:'not-an-affect',age:2}];
 for(const name of M_AFFECTS){
  const age=AFFECT_DURATIONS[name]*.45;
  options.push({name,age,reducedMotion:true});
  for(const weight of [0,-1,NaN,Infinity,-Infinity])options.push({name,age,weight});
  for(const invalidAge of [NaN,Infinity,-Infinity,'2',null])options.push({name,age:invalidAge});
 }
 for(const option of options){
  const pose=sampleAffect(option);assert.equal(pose.envelope,0);
  assert.ok(Number.isFinite(pose.duration)&&Number.isFinite(pose.progress));
  assert.ok(Object.values(pose.weights).every(v=>v===0));
  assert.ok(Object.values(pose.eyelids).every(v=>v===0));
 }
});

test('all performances support a bounded linear handover to the neutral face',()=>{
 for(const name of M_AFFECTS.filter(name=>name!=='neutral')){
  const duration=AFFECT_DURATIONS[name];
  for(const progress of [.12,.36,.55,.80,.95]){
   const full=sampleAffect({name,age:duration*progress});
   assert.deepEqual(sampleAffect({name,age:duration*progress,weight:5}),full);
   for(const weight of [.75,.5,.25,0]){
    const faded=sampleAffect({name,age:duration*progress,weight});
    assert.equal(faded.envelope,full.envelope*weight);
    for(const key of Object.keys(full.weights))assert.ok(Math.abs(faded.weights[key]-full.weights[key]*weight)<1e-15);
    for(const side of ['left','right'])assert.ok(Math.abs(faded.eyelids[side]-full.eyelids[side]*weight)<1e-15);
   }
  }
 }
});

test('doubt uses quiet asymmetry and sleepy remains a curved partial HAT closure',()=>{
 const doubt=sampleAffect({name:'doubt',age:2}),sleepy=sampleAffect({name:'sleepy',age:3});
 assert.ok(doubt.eyelids.right>doubt.eyelids.left+.15);
 assert.ok(sleepy.eyelids.left>.4&&sleepy.eyelids.left<.5);
 assert.ok(sleepy.eyelids.right>.4&&sleepy.eyelids.right<.5);
 assert.ok(sleepy.weights.happy>0&&sleepy.weights.surprised===0);
});

test('new performances evolve through distinct authored beats with the original channels',()=>{
 const at=(name,progress)=>sampleAffect({name,age:AFFECT_DURATIONS[name]*progress});
 const expectant=at('anticipation',.32),pleased=at('anticipation',.70);
 assert.ok(expectant.weights.curious>.4&&expectant.weights.surprised>.3);
 assert.ok(expectant.eyelids.left<.03&&expectant.eyelids.right<.03);
 assert.ok(pleased.weights.happy>expectant.weights.happy+.3);
 assert.ok(pleased.weights.surprised<expectant.weights.surprised-.2);
 const squint=at('mischief',.36),release=at('mischief',.70);
 assert.ok(squint.eyelids.right>squint.eyelids.left+.25);
 assert.ok(squint.weights.happy>.3&&squint.weights.curious>.3);
 assert.ok(Math.abs(release.eyelids.right-release.eyelids.left)<.02);
 assert.ok(release.weights.happy>squint.weights.happy+.2);
 const prideStart=at('proud',.18),pridePeak=at('proud',.42),prideSettle=at('proud',.66);
 assert.ok(pridePeak.weights.happy>prideStart.weights.happy+.3);
 assert.ok(prideSettle.weights.happy>.55&&prideSettle.weights.surprised===0);
 assert.ok(prideSettle.eyelids.left>pridePeak.eyelids.left+.08);
 const calmBreathe=at('calm',.40),calmSettle=at('calm',.64);
 assert.ok(calmBreathe.eyelids.left>.3&&calmBreathe.eyelids.left<.4);
 assert.ok(calmSettle.eyelids.left<calmBreathe.eyelids.left-.04);
 assert.ok(calmSettle.weights.happy>.2&&calmSettle.weights.happy<.3);
 assert.equal(calmSettle.weights.surprised,0);
 for(const name of ['anticipation','mischief','proud','calm']){
  const channels=pose=>[...Object.values(pose.weights),...Object.values(pose.eyelids)];
  assert.notDeepEqual(channels(at(name,.32)),channels(at(name,.64)),`${name} has temporal development`);
  for(const progress of [.18,.32,.36,.40,.42,.52,.64,.66,.70,.82]){
   const before=channels(at(name,progress-.00001)),center=channels(at(name,progress)),after=channels(at(name,progress+.00001));
   for(let i=0;i<center.length;i++)assert.ok(Math.abs((center[i]-before[i])-(after[i]-center[i]))<1e-7,`${name} has smooth beat joins`);
  }
 }
});

test('the five existing profiles keep their original channels and sleepy lid variation',()=>{
 const profiles={
  focus:{weights:{happy:.03,curious:.72,surprised:.06},eyelids:{left:.12,right:.12}},
  content:{weights:{happy:.58,curious:.04,surprised:0},eyelids:{left:.19,right:.19}},
  doubt:{weights:{happy:0,curious:.48,surprised:.12},eyelids:{left:.07,right:.27}},
  sleepy:{weights:{happy:.18,curious:0,surprised:0},eyelids:{left:.47,right:.45}},
  delight:{weights:{happy:.70,curious:.06,surprised:.18},eyelids:{left:.09,right:.09}}
 };
 const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
 for(const [name,profile] of Object.entries(profiles)){
  const duration=AFFECT_DURATIONS[name];
  for(let i=1;i<400;i++){
   const age=duration*i/400,progress=age/duration;
   const envelope=smooth(progress/.18)*(1-smooth((progress-.74)/.26));
   const pose=sampleAffect({name,age});
   assert.equal(pose.envelope,envelope);
   for(const key of Object.keys(profile.weights))assert.equal(pose.weights[key],profile.weights[key]*envelope);
   const breath=name==='sleepy'?1+.025*Math.sin(progress*Math.PI*4):1;
   for(const side of ['left','right'])assert.equal(pose.eyelids[side],profile.eyelids[side]*envelope*breath);
  }
 }
});

test('routine expressions develop thought, dozing and joy without new facial channels',()=>{
 const at=(name,progress)=>sampleAffect({name,age:AFFECT_DURATIONS[name]*progress});
 const question=at('pondering',.35),reconsider=at('pondering',.53),decision=at('pondering',.73);
 assert.ok(question.weights.curious>.55&&question.eyelids.right>question.eyelids.left+.2);
 assert.ok(reconsider.eyelids.left>reconsider.eyelids.right+.1,'a later thought shifts the subtle squint');
 assert.ok(decision.weights.happy>.35&&decision.weights.curious<question.weights.curious-.2);
 const doze=at('dozing',.34),waking=at('dozing',.76);
 assert.ok(doze.eyelids.left>.44&&doze.eyelids.right>.44);
 assert.ok(waking.eyelids.left<.22&&waking.weights.curious>0);
 const delight=at('joyful',.34),satisfied=at('joyful',.53);
 assert.ok(delight.weights.happy>.7&&delight.weights.surprised>.09);
 assert.ok(satisfied.weights.happy>.7&&satisfied.weights.surprised<.03);
 assert.ok(satisfied.eyelids.left>delight.eyelids.left+.14,'the smile settles through the original lid curve');
 for(const name of ['pondering','dozing','joyful']){
  assert.deepEqual(Object.keys(at(name,.4).weights),['happy','curious','surprised']);
  assert.deepEqual(Object.keys(at(name,.4).eyelids),['left','right']);
 }
});
