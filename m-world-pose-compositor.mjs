/** V66: one bounded, velocity-continuous target for existing secondary poses.
 * Primary clips, authored gestures, route coordinates and rig are not owned here.
 * Fixed buffers/outputs are reused; no bones or scene objects are created.
 */
const finite=(v,f=0)=>Number.isFinite(v)?v:f;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v)));
export function secondaryPoseLimit(name){
 if(name==='Head')return .28;
 if(name==='Neck')return .14;
 if(/^(?:Shoulder|Clavicle|UpperArm)/.test(name))return .085;
 if(/^(?:Forearm|LowerArm|Hand)/.test(name))return .11;
 if(/^(?:Thigh|UpperLeg|Calf|LowerLeg|Foot)/.test(name))return .12;
 if(/^Tail\.\d\d$/.test(name))return .035+clamp(Number(name.slice(-2)),1,10)*.0035;
 if(/^Ear/.test(name))return .15;
 if(/^(?:Spine|Chest|Hips|Pelvis)/.test(name))return .13;
 return .08;
}
export function createSecondaryPoseCompositor(boneNames=[],{halfLife=.14}={}){
 const names=[...new Set(boneNames)].filter(n=>typeof n==='string'),indices=new Map(names.map((n,i)=>[n,i])),pose={};
 const target=new Float64Array(names.length*3),position=new Float64Array(target.length),velocity=new Float64Array(target.length);
 const limits=names.map(secondaryPoseLimit),omega=1.67834699001666/clamp(halfLife,.04,.6);
 for(const name of names)pose[name]=[0,0,0];
 let frames=0,limited=0,peak=0;
 function reset(){target.fill(0);position.fill(0);velocity.fill(0);for(const name of names)pose[name].fill(0);peak=0;}
 function sample({dt=0,layers=[],reducedMotion=false}={}){
  frames++;if(reducedMotion){reset();return pose;}
  target.fill(0);const step=clamp(dt,0,.06),decay=Math.exp(-omega*step);peak=0;
  for(const layer of layers){
   const weight=clamp(finite(layer?.weight,1),0,1),source=layer?.pose;if(!source||weight===0)continue;
   for(const name in source){
    const index=indices.get(name),value=source[name];
    if(index===undefined||!Array.isArray(value)||value.length!==3)continue;
    for(let axis=0;axis<3;axis++)target[index*3+axis]+=clamp(value[axis],-.9,.9)*weight;
   }
  }
  for(let index=0;index<names.length;index++){
   const offset=index*3,budget=limits[index],norm=Math.hypot(target[offset],target[offset+1],target[offset+2]);
   if(norm>budget)limited++;
   // Smooth radial saturation retains direction without axis clipping corners.
   const targetGain=1/Math.sqrt(1+(norm/budget)**2);
   for(let axis=0;axis<3;axis++){
    const i=offset+axis,t=target[i]*targetGain,delta=position[i]-t,carry=velocity[i]+omega*delta;
    position[i]=t+(delta+carry*step)*decay;
    velocity[i]=(velocity[i]-omega*carry*step)*decay;
   }
   const length=Math.hypot(position[offset],position[offset+1],position[offset+2]);
   // A retargeted spring can overshoot from previous momentum. Keep the final
   // combined joint vector inside its budget, rather than limiting each layer.
   const gain=length>budget?budget/length:1,out=pose[names[index]];
   for(let axis=0;axis<3;axis++)out[axis]=position[offset+axis]*gain;
   peak=Math.max(peak,Math.hypot(...out));
  }
  return pose;
 }
 return {sample,reset,snapshot:()=>({bones:names.length,frames,limited,peak,bufferValues:target.length*3})};
}
