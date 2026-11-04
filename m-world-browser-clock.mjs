// Test harness only: native observations keep the browser's real RAF clock.
export async function observeBrowserClock(page,limitMs,evaluator,arg,{softwareClock=false,now=Date.now}={}){
 if(!softwareClock)return page.evaluate(evaluator,arg);
 let pauseAttempted=false,paused=false;
 try{
  await page.evaluate(()=>{window.__mSmokeSkipDraw=true;});
  for(let attempt=0;attempt<3;attempt++){
   const sampledAt=now(),browserNow=await page.evaluate(()=>Date.now());
   if(!Number.isFinite(browserNow))throw new Error('Invalid browser clock sample');
   const roundTrip=Math.max(0,now()-sampledAt);
   const lead=Math.min(1000,Math.max(50*2**attempt,roundTrip*3+25));
   pauseAttempted=true;
   try{
    await page.clock.pauseAt(new Date(browserNow+lead));paused=true;break;
   }catch(error){
    // pauseAt pauses before checking the timestamp. A transport race therefore
    // leaves a stopped clock that can be freshly sampled on the next attempt.
    const reason=String(error?.message||error).split('\n')[0];
    if(!['Cannot fast-forward to the past','Error: Cannot fast-forward to the past','clock.pauseAt: Error: Cannot fast-forward to the past'].includes(reason)||attempt===2)throw error;
   }
  }
  let settled=false,result,failure,failed=false;
  const pending=page.evaluate(evaluator,arg).then(value=>{settled=true;result=value;},error=>{settled=true;failed=true;failure=error;});
  for(let elapsed=0;!settled&&elapsed<=limitMs+500;elapsed+=100)await page.clock.runFor(100);
  if(!settled)throw new Error('Browser clock observation exceeded its '+limitMs+'ms budget');
  await pending;if(failed)throw failure;return result;
 }finally{
  try{
   await page.evaluate(()=>{window.__mSmokeSkipDraw=false;});
   if(paused)await page.clock.runFor(34);
  }finally{
   // Even a rejected pauseAt may already have stopped Playwright's clock.
   if(pauseAttempted)await page.clock.resume();
  }
 }
}
