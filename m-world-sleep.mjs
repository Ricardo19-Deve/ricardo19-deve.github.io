/**
 * V71 — a natural nap for the original V6 rig.
 *
 * Replaces the V32 "lie on the side" nap, where the whole stage tipped about
 * 76° as one rigid block. M now winds down, curls up and sleeps the way a
 * small animal does, then wakes with a stretch:
 *
 *  winding-down  slower, a full stretch with a backward arch, two heavy blinks
 *  settling      head drops, spine and knees curl, arms fold under the chin,
 *                the tail tucks under the body and curls up by the paws, eyes close
 *  sleeping      slow chest breathing (about 14 breaths a minute, from the
 *                real age in seconds), one deeper sigh, an ear twitch and a
 *                tail-tip flick
 *  waking        lids part with a blink, head lifts, arms stretch out, the tail
 *                unwraps and everything returns to the awake pose
 *
 * Pure function of age: every channel starts and ends at zero with zero
 * slope, so the gesture handoff and the stage never pop. Angles are additive
 * local Euler offsets (same contract as m-world-acting); the stage values are
 * applied by the renderer on top of the posed rig.
 */
export const SLEEP_DURATION=21;
/** Phase boundaries as fractions of the nap. */
export const SLEEP_TIMELINE=Object.freeze({windDown:.20,settle:.34,sleep:.80});
export const SLEEP_BREATHS_PER_MINUTE=14;
/** The stage only rolls gently towards the resting side; the curl is in the rig. */
export const SLEEP_STAGE_ROLL=.26;
export const SLEEP_STAGE_SCALE=.93;
// V72: the root drops the tail (Z), the rest bends it forward and across under
// the body (X and Y together), so the tip curls up beside the folded paws.
// The V71 profile (outer half curling back on Z) drew a hoop away from the body.
export const SLEEP_TAIL_WRAP=Object.freeze([
 [0,0,-.34],[0,0,-.30],[-.22,-.11,0],[-.23,-.11,0],[-.24,-.12,0],
 [-.24,-.12,0],[-.24,-.12,0],[-.25,-.13,0],[-.25,-.13,0],[-.24,-.12,0]
].map(Object.freeze));

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
const smooth=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
const rise=(p,a,b)=>smooth((p-a)/(b-a));
const window=(p,a,b,c,d)=>rise(p,a,b)*(1-rise(p,c,d));
const pulse=(p,a,b,c)=>window(p,a,b,b,c);

export function sleepPhase(p){
 const {windDown,settle,sleep}=SLEEP_TIMELINE;
 return p<=0?'awake':p<windDown?'winding-down':p<settle?'settling':p<sleep?'sleeping':p<1?'waking':'awake';
}

/**
 * age in seconds. Returns {phase, pose, blink:{left,right}, curl, breath, stage}
 * or null outside the nap. pose angles are within ±.9 rad per axis.
 */
export function sampleSleep({age=0,duration=SLEEP_DURATION,side=1}={}){
 if(!Number.isFinite(age)||!Number.isFinite(duration)||duration<=0||age<=0||age>=duration)return null;
 const p=clamp(age/duration),s=side<0?-1:1,pose={};
 const add=(bone,x=0,y=0,z=0)=>{
  const prev=pose[bone]||[0,0,0];
  pose[bone]=[prev[0]+x,prev[1]+y,prev[2]+z].map(v=>clamp(v,-.9,.9));
 };

 // Winding down: a big stretch, then the body softens.
 const stretch=pulse(p,.02,.085,.17);
 const soften=window(p,.10,.20,.86,.99);
 // Settling and the curl itself; parents lead, extremities follow.
 const curl=window(p,.15,.32,.80,.97);
 const tuck=window(p,.18,.34,.79,.95);
 const headRest=window(p,.20,.36,.78,.93);
 const tailWrap=i=>window(p,.17+i*.006,.36+i*.006,.80+i*.005,.985);
 // Waking: lift, stretch out, settle back to awake.
 const wakeLift=pulse(p,.80,.88,.98);
 const wakeStretch=pulse(p,.84,.91,.99);

 // Breathing from real seconds, faded in and out with the sleeping hold.
 const sleepHold=window(p,.30,.38,.78,.88);
 const period=60/SLEEP_BREATHS_PER_MINUTE;
 const sigh=pulse(p,.52,.57,.64);
 const breath=sleepHold*(Math.sin(age/period*Math.PI*2)*(1+.9*sigh)+.6*sigh);
 const earTwitch=pulse(p,.46,.475,.495)-.6*pulse(p,.475,.49,.51);
 const tipFlick=pulse(p,.63,.65,.68);

 // Spine: arch back while stretching, then curl forward into a ball.
 add('Body',-.06*stretch+.20*curl+.012*breath,0,s*.05*curl);
 add('Chest',-.11*stretch+.24*curl+.035*breath,s*.03*soften,-s*.06*tuck);
 add('Neck',-.06*stretch+.16*curl-.05*wakeLift,0,s*.04*headRest);
 add('Head',-.16*stretch+.20*curl+.07*headRest-.12*wakeLift+.012*breath,s*.10*headRest,s*(.30*headRest-.06*wakeLift));

 for(const [suffix,sign]of [['L',1],['R',-1]]){
  // Arms go up for the stretch, then fold in under the chin; out again on waking.
  // Shoulders stay under .25 rad (the original skin deforms beyond that).
  add('Arm.'+suffix,-.20*stretch+.12*tuck-.08*wakeStretch+.01*breath,0,sign*(-.10*stretch+.10*tuck+.18*wakeStretch));
  add('Forearm.'+suffix,sign*(.06*stretch+.26*tuck-.12*wakeStretch),0,-sign*(.24*tuck-.10*wakeStretch));
  add('Hand.'+suffix,sign*.10*tuck,0,-sign*.12*tuck);
  // Knees draw up towards the chest.
  add('Leg.'+suffix,.07*stretch+.38*curl-.08*wakeStretch,0,sign*.05*curl);
  add('Foot.'+suffix,-.06*stretch-.20*curl+.05*wakeStretch);
  // Ears relax and fold back while asleep; one gives a small twitch.
  add('Ear.'+suffix,-.10*stretch+.22*soften*curl-.08*wakeLift,0,-sign*.08*curl);
  add('EarTip.'+suffix,.09*curl);
 }
 add('Ear.'+(s>0?'L':'R'),-.10*earTwitch,0,s*.06*earTwitch);

 // The tail drops, then tucks under the curled body (base first, tip last).
 // The per-bone profile was tuned against renders of the original rig on both
 // sides (V72): the drop and the forward bend are the same on both sides, the
 // sideways bend (Y) follows the side M curls towards so the tail tucks under
 // her instead of sticking out on the open side.
 for(let i=1;i<=10;i++){
  const wrap=tailWrap(i-1),flick=i>=8?tipFlick*(i-7)/3:0;
  const [x,y,z]=SLEEP_TAIL_WRAP[i-1];
  add('Tail.'+String(i).padStart(2,'0'),x*wrap+.006*breath,s*y*wrap,z*wrap+.12*flick+.02*stretch);
 }

 // Eyelids: two heavy blinks while winding down, closed through the nap,
 // a sleepy blink while waking.
 const heavy=.72*pulse(p,.07,.095,.125)+.86*pulse(p,.135,.16,.19);
 const close=window(p,.17,.27,.82,.93);
 const wakeBlink=.7*pulse(p,.90,.915,.94);
 const left=clamp(Math.max(heavy,close)+wakeBlink*(1-close));
 const right=clamp(Math.max(heavy*.94,window(p,.175,.275,.825,.935))+wakeBlink*(1-close));

 // Stage: a gentle roll towards the resting side and a soft settle, with a
 // barely visible rise of the body on each breath.
 const settle=window(p,.16,.34,.80,.98);
 const stage={
  rotationZ:s*SLEEP_STAGE_ROLL*settle,
  rotationX:.06*settle,
  positionX:s*.012*settle,
  positionY:-.05*settle+.0025*breath,
  scale:1-(1-SLEEP_STAGE_SCALE)*settle
 };
 return {phase:sleepPhase(p),progress:p,pose,blink:{left,right},curl,breath,stage,weight:settle};
}
