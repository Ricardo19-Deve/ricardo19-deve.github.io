/** V29 small authored movements on the original M stage, bounded by V6 framing.
 * Add intention and finishing beats, never a new rig/mesh or synthetic pose.
 */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:a));
export function createMicroMotion(){
 let phase=0,speed=0,lastMoving=false,settle=1,anticipation=0;
 function reset(){phase=0;speed=0;lastMoving=false;settle=1;anticipation=0;}
 function sample({dt=0,vx=0,vy=0,aboutToMove=false,calm=false,reducedMotion=false,gestureActive=false}={}){
  if(reducedMotion||gestureActive){reset();return {lift:0,pitch:0,roll:0,scale:0,breath:0,anticipation:0,settle:0};}
  const step=clamp(dt,0,.06),targetSpeed=Math.hypot(clamp(vx,-700,700),clamp(vy,-700,700));
  const blend=1-Math.pow(.5,step/.16);
  speed+=(targetSpeed-speed)*blend;
  const moving=targetSpeed>24;
  if(lastMoving&&!moving)settle=0;
  if(moving&&!lastMoving)anticipation=1;
  lastMoving=moving;
  anticipation=Math.max(0,anticipation-step*2.4);
  settle=Math.min(1,settle+step/0.7);
  phase+=step;
  // At rest, tiny asymmetric breathing is deliberate rather than constant bobbing.
  const idle=calm?0.45:clamp(1-speed/80,0,1);
  const breath=Math.sin(phase*2.4)*.0045*idle;
  const bounce=settle<1?Math.sin(settle*Math.PI*2)*Math.pow(1-settle,2)*.011:0;
  const intent=aboutToMove?.008:0;
  return {lift:clamp(breath+bounce,-.018,.018),pitch:clamp(-intent*2+anticipation*.012,-.025,.025),
   roll:clamp(breath*.7,-.008,.008),scale:clamp(breath*.35+bounce*.45,-.009,.009),
   breath,anticipation,settle:1-settle};
 }
 return {sample,reset,snapshot:()=>({speed,anticipation,settle:1-settle})};
}
