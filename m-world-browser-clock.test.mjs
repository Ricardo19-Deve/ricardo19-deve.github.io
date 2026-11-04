import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {observeBrowserClock} from './m-world-browser-clock.mjs';

// A small clock transport, not a product/controller simulation. In particular,
// Playwright stops its clock BEFORE rejecting a pause timestamp in the past.
function transport({pauseErrors=[],delay=0,cleanupError=false,drawError=false}={}){
 const window={},frames=[],samples=[],calls={pause:[],run:[],resume:0};
 let time=1000,hostTime=0,running=true,observations=0;
 const context=vm.createContext({window,Date:{now:()=>time},requestAnimationFrame:fn=>frames.push(fn)});
 const page={
  async evaluate(fn,arg){
   hostTime+=delay;if(running)time+=delay;
   const source=fn.toString();
   if(source.includes('Date.now()'))samples.push(time);
   if(source.includes('__mSmokeSkipDraw=true')&&drawError)throw new Error('Draw setup failed');
   if(!source.includes('__mSmokeSkipDraw')&&!source.includes('Date.now()'))observations++;
   const result=vm.runInContext('('+source+')',context)(arg);
   if(source.includes('__mSmokeSkipDraw=false')&&cleanupError)throw new Error('Draw cleanup failed');
   return result;
  },
  clock:{
   async pauseAt(date){
    calls.pause.push(date.getTime());running=false;
    const error=pauseErrors.shift();if(error)throw new Error(error);
    time=date.getTime();
   },
   async runFor(ms){calls.run.push(ms);time+=ms;const scheduled=frames.splice(0);for(const callback of scheduled)callback(time);},
   async resume(){calls.resume++;running=true;},
  },
 };
 return {page,window,calls,samples,now:()=>hostTime,get observations(){return observations;},get running(){return running;}};
}
const options=t=>({softwareClock:true,now:t.now});

test('native observations do not pause time or suppress drawing',async()=>{
 const t=transport();
 assert.equal(await observeBrowserClock(t.page,100,answer=>answer,42),42);
 assert.deepEqual(t.calls,{pause:[],run:[],resume:0});
 assert.equal(t.window.__mSmokeSkipDraw,undefined);
});

test('a pause transport race resamples the already stopped clock and cleans up',async()=>{
 const t=transport({pauseErrors:['clock.pauseAt: Error: Cannot fast-forward to the past\n    at ClockController.pauseAt'],delay:90});
 const result=await observeBrowserClock(t.page,100,()=>new Promise(resolve=>requestAnimationFrame(()=>resolve('observed'))),undefined,options(t));
 assert.equal(result,'observed');assert.equal(t.calls.pause.length,2);
 assert.equal(t.samples.length,2);assert.ok(t.calls.pause[1]>t.samples[1]);
 assert.equal(t.calls.run.at(-1),34);assert.equal(t.calls.resume,1);
 assert.equal(t.window.__mSmokeSkipDraw,false);assert.equal(t.running,true);
});

test('transport latency gets bounded headroom rather than an arbitrary long time jump',async()=>{
 const t=transport({delay:2000});
 assert.equal(await observeBrowserClock(t.page,100,()=>42,undefined,options(t)),42);
 assert.equal(t.calls.pause[0]-t.samples[0],1000);
});

test('three rejected past timestamps stop retries and still resume the paused clock',async()=>{
 const t=transport({pauseErrors:Array(3).fill('Cannot fast-forward to the past')});
 await assert.rejects(observeBrowserClock(t.page,100,()=>42,undefined,options(t)),/Cannot fast-forward to the past/);
 assert.equal(t.calls.pause.length,3);assert.equal(t.observations,0);
 assert.deepEqual(t.calls.run,[]);assert.equal(t.calls.resume,1);
 assert.equal(t.window.__mSmokeSkipDraw,false);assert.equal(t.running,true);
});

test('unrelated clock errors propagate immediately and restore state',async()=>{
 const t=transport({pauseErrors:['Target page has been closed']});
 await assert.rejects(observeBrowserClock(t.page,100,()=>42,undefined,options(t)),/Target page has been closed/);
 assert.equal(t.calls.pause.length,1);assert.equal(t.calls.resume,1);
 assert.equal(t.window.__mSmokeSkipDraw,false);
});

test('observation rejection restores drawing and resumes the clock',async()=>{
 const t=transport();
 await assert.rejects(observeBrowserClock(t.page,100,()=>Promise.reject(new Error('Observation failed')),undefined,options(t)),/Observation failed/);
 assert.equal(t.calls.resume,1);assert.equal(t.window.__mSmokeSkipDraw,false);
});

test('an observation that never settles is bounded without extending the motion budget',async()=>{
 const t=transport();
 await assert.rejects(observeBrowserClock(t.page,100,()=>new Promise(()=>{}),undefined,options(t)),/exceeded its 100ms budget/);
 assert.equal(t.calls.run.filter(ms=>ms===100).length,7);
 assert.equal(t.calls.resume,1);assert.equal(t.window.__mSmokeSkipDraw,false);
});

test('cleanup failure cannot leave the clock stopped',async()=>{
 const t=transport({cleanupError:true});
 await assert.rejects(observeBrowserClock(t.page,100,()=>42,undefined,options(t)),/Draw cleanup failed/);
 assert.equal(t.calls.resume,1);assert.equal(t.running,true);
});

test('draw setup failure does not try to resume an untouched clock',async()=>{
 const t=transport({drawError:true});
 await assert.rejects(observeBrowserClock(t.page,100,()=>42,undefined,options(t)),/Draw setup failed/);
 assert.equal(t.calls.pause.length,0);assert.equal(t.calls.resume,0);
 assert.equal(t.window.__mSmokeSkipDraw,false);
});
