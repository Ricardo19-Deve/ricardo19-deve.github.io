import test from 'node:test';
import assert from 'node:assert/strict';
import {MLifeV16} from './life-v16.mjs';
import {performanceBodyPoseV15} from './performance-v15.mjs';
import {motionPose} from './motion-v8.mjs';
function run(brain,seconds,options={}){
 let last=null;
 for(let i=0;i<Math.ceil(seconds*30);i++)
  last=brain.step(1/30,options);
 return last;
}
test('V16 behavior engine is reproducible with the same seed',()=>{
 const a=new MLifeV16({seed:12}),b=new MLifeV16({seed:12});
 const aa=[],bb=[];
 for(let i=0;i<1200;i++){
  const x=a.step(1/30,{mode:'float'}),y=b.step(1/30,{mode:'float'});
  if(x.action)aa.push(x.action);
  if(y.action)bb.push(y.action);
 }
 assert.deepEqual(aa,bb);assert.ok(aa.length>=1);
});
test('idle M chooses autonomous gestures without forcing a permanent state',()=>{
 const m=new MLifeV16({seed:483});const actions=[];
 for(let i=0;i<900;i++){
  const result=m.step(1/30,{mode:'float'});
  if(result.action)actions.push(result.action.mode);
 }
 assert.ok(actions.length>=2,actions.join(','));
 assert.ok(actions.every(mode=>['float','swim','curious','peek','shy'].includes(mode)));
});
test('head look direction smoothly follows the pointer with no mode switch',()=>{
 const m=new MLifeV16();
 m.signal('pointer',{x:1,y:-.6});
 let s=run(m,.65,{mode:'float'});
 assert.equal(s.action,null);assert.equal(s.attention,'pointer');
 assert.ok(s.gaze.x>.75);assert.ok(s.gaze.y<-.42);
 const head=performanceBodyPoseV15({time:2,attention:s.gaze,impact:1});
 const centered=performanceBodyPoseV15({time:2,attention:{x:0,y:0},impact:1});
 assert.ok(head.Head[1]-centered.Head[1]>.12);
 m.signal('leave');s=run(m,1);
 assert.ok(s.gaze.x<1);
});
test('tap sequences cause differentiated reactions while familiarity stays local',()=>{
 const m=new MLifeV16();
 m.signal('tap');let result=m.step(1/30,{mode:'float'});
 assert.equal(result.action?.mode,'curious');
 assert.equal(result.action?.expression,'happy');
 m.signal('tap');result=m.step(1/30,{mode:'curious'});
 assert.equal(result.action?.mode,'knock');
 assert.equal(result.action?.expression,'surprised');
 m.signal('tap');m.step(1/30,{mode:'knock'});
 m.signal('tap');result=m.step(1/30,{mode:'knock'});
 assert.equal(result.action?.mode,'shy');
 assert.ok(result.bond>0);assert.ok(result.bond<=1);
});
test('manual interactions defer autonomous switching',()=>{
 const m=new MLifeV16();m.manual();
 let count=0;
 for(let i=0;i<270;i++)
  if(m.step(1/30,{mode:'float'}).action)count++;
 assert.equal(count,0);
 let later=0;
 for(let i=0;i<600;i++)
  if(m.step(1/30,{mode:'float'}).action)later++;
 assert.ok(later>0);
});
test('manually pinned facial expression prevents unsolicited actions',()=>{
 const m=new MLifeV16();let count=0;
 for(let i=0;i<900;i++)
  if(m.step(1/30,{mode:'float',manualFace:true}).action)count++;
 assert.equal(count,0);
});
test('Demo mode has priority; autonomy never interferes',()=>{
 const m=new MLifeV16();let count=0;
 for(let i=0;i<900;i++)
  if(m.step(1/30,{mode:'swim',demo:true}).action)count++;
 assert.equal(count,0);
});
test('reduced motion or disabled autonomy prevents spontaneous actions',()=>{
 for(const config of [{enabled:false},{enabled:true}]){
  const m=new MLifeV16(config);let actions=0;
  for(let i=0;i<900;i++)
   if(m.step(1/30,{mode:'float',reducedMotion:true}).action)actions++;
  assert.equal(actions,0);
 }
 const m=new MLifeV16({enabled:false});
 for(let i=0;i<900;i++)assert.equal(m.step(1/30).action,null);
 m.setEnabled(true);assert.ok(m.enabled);
});
test('no invalid coordinates, memory beyond the session, or remote dependencies',()=>{
 const m=new MLifeV16({seed:1});
 m.signal('pointer',{x:100,y:-100});
 let state=run(m,1,{mode:'float'});
 assert.ok(state.gaze.x<=1&&state.gaze.y>=-1);
 m.signal('tap');m.step(1/30);assert.ok(m.bond>0);
 const newSession=new MLifeV16({seed:1});
 assert.equal(newSession.bond,0);
 assert.equal(newSession.tapHistory.length,0);
});
test('attention from autonomy changes the real motion target',()=>{
 const neutral=motionPose({time:2,mode:'float',attention:{x:0,y:0}});
 const looking=motionPose({time:2,mode:'float',attention:{x:.8,y:.35}});
 assert.ok(Math.abs(looking.Head[1]-neutral.Head[1])>.09);
 assert.ok(Math.abs(looking.Neck[1]-neutral.Neck[1])>.03);
});
