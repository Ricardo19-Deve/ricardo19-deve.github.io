/** Time-step independent animation smoothing. No Three.js dependency. */
export function smoothSpring(state,target,dt,frequency=7,damping=.92){
 const t=Math.max(0,Math.min(.075,Number.isFinite(dt)?dt:0));
 const w=Math.max(.2,Math.min(35,frequency));
 const ratio=Math.max(.5,Math.min(1.5,damping));
 // Substeps prevent instability on slow mobile frames. Deliberate mild follow-through.
 const steps=Math.max(1,Math.ceil(t/(1/120))),h=t/steps;
 for(let i=0;i<steps;i++){
  const acceleration=(target-state.value)*w*w-2*ratio*w*state.velocity;
  state.velocity+=acceleration*h;
  state.value+=state.velocity*h;
 }
 return state.value;
}
export function createSpring(initial=0){
 return {value:initial,velocity:0};
}
export function transitionFrequency(smoothness=.75){
 // More smoothness means softer, slower, less robotic motion.
 return 10.5-5.5*Math.max(0,Math.min(1,smoothness));
}
