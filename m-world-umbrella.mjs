/** Removable umbrella for the original M rig. Inputs use container-local units.
 * The grip is a hard physical constraint; only the canopy and wind response
 * settle. All geometry/materials and update vectors are created once.
 */
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,finite(value,lo)));
const vectorValid=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z);
const ease=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
export const UMBRELLA_RIM_GAP_RATIO=.085;
export const UMBRELLA_SHAFT_OFFSET_RATIO=.36;

export function umbrellaDimensions(height=1){
 if(!Number.isFinite(height)||height<=0)throw new Error('Umbrella requires a positive character height');
 return Object.freeze({height,radius:height*.46,depth:height*.14,thickness:height*.009,
  shaftRadius:height*.009,handleRadius:height*.045,handleTube:height*.009,
  rimRadius:height*.0045});
}

/** Shared by the fabric surface, seams and clearance estimate. */
export function canopyHeightAt(radial,depth){
 return Math.max(0,finite(depth))*(1-Math.pow(clamp(radial,0,1),1.8));
}

/** Closed outer/inner lathe profile adds a real thin fabric edge. */
export function umbrellaCanopyProfile({radius,depth,thickness}){
 const steps=[0,.16,.34,.53,.70,.84,.94,1],profile=[];
 for(const radial of steps)profile.push({x:radius*radial,y:canopyHeightAt(radial,depth)});
 for(let i=steps.length-1;i>=0;i--){const radial=steps[i];profile.push({x:radius*radial,y:canopyHeightAt(radial,depth)-thickness});}
 return profile;
}

function spring(channel,target,dt,omega){
 const delta=channel.value-target,carry=channel.velocity+omega*delta,decay=Math.exp(-omega*dt);
 channel.value=target+(delta+carry*dt)*decay;
 channel.velocity=(channel.velocity-omega*carry*dt)*decay;
}

/** Reused numerical state. snapshot() alone allocates diagnostic copies. */
export function createUmbrellaState({height=1}={}){
 const d=umbrellaDimensions(height),grip={x:0,y:0,z:0},head={x:0,y:0,z:0};
 const crown={x:0,y:0,z:0},guide={x:0,y:0,z:0},shaftTop={x:0,y:0,z:0},neckEnd={x:0,y:0,z:0};
 const opening={value:0,velocity:0},roll={value:0,velocity:0},pitch={value:0,velocity:0};
 const cx={value:0,velocity:0},cy={value:0,velocity:0},cz={value:0,velocity:0};
 const result={grip,head,crown,guide,shaftTop,neckEnd,visible:false,anchoredToHand:false,openness:0,fold:.1,
  opacity:0,roll:0,pitch:0,gripErrorRatio:0,crownClearanceRatio:0,
  roofClearanceRatio:0,headCoverageMarginRatio:0,radiusRatio:.46,
  canopyDepthRatio:.14,thicknessRatio:.009,shaftRadiusRatio:.009,
  headTop:0,headTopProvided:false,rimClearanceRatio:0,headTopClearanceRatio:0,
  tiltMarginRatio:0,shaftSide:0,shaftOffsetRatio:0,shaftFaceOffsetRatio:0};
 let initialized=false,shaftSide=0;
 function sample({dt=0,target=false,grip:inputGrip,head:inputHead,headTop,frontLimit=0,
  windDrift=0,windForce=0,reducedMotion=false}={}){
  const step=clamp(dt,0,.06),valid=vectorValid(inputGrip)&&vectorValid(inputHead);
  if(valid){
   grip.x=inputGrip.x;grip.y=inputGrip.y;grip.z=inputGrip.z;
   head.x=inputHead.x;head.y=inputHead.y;head.z=inputHead.z;
  }
  if(!valid||reducedMotion){
   opening.value=opening.velocity=roll.value=roll.velocity=pitch.value=pitch.velocity=0;
   result.visible=false;result.anchoredToHand=false;result.openness=result.opacity=result.roll=result.pitch=0;result.fold=.1;
   initialized=false;return result;
  }
  const force=clamp(windForce,0,1),drift=clamp(windDrift,-1,1);
  // The highest actual posed head/ear vertex, not the Head bone origin, is
  // the clearance reference. Older callers retain a conservative fallback.
  const top=Number.isFinite(headTop)?headTop:head.y+height*.25;
  spring(roll,-drift*force*.10,step,9);
  spring(pitch,force*.018,step,9);
  result.roll=clamp(roll.value,-.10,.10);result.pitch=clamp(pitch.value,-.025,.025);
  // Full-radius tilt plus the folded fabric/rim thickness bounds the lowest
  // visible edge at any aperture. Small tracking reserve lets normal posed
  // head motion retain spring continuity without reaching the safety bound.
  const tiltMargin=d.radius*(Math.abs(Math.sin(result.roll))+Math.abs(Math.sin(result.pitch)))
   +1.45*(d.thickness+d.rimRadius);
  const minimumRim=top+height*UMBRELLA_RIM_GAP_RATIO+tiltMargin;
  const tx=head.x+drift*force*height*.035,ty=minimumRim+height*.025,tz=head.z+height*.045;
  if(!initialized){
   cx.value=tx;cy.value=ty;cz.value=tz;cx.velocity=cy.velocity=cz.velocity=0;
   // A first diagnostic/static draw can show a known state without advancing
   // time. Later weather changes always retain their opening/closing velocity.
   if(step===0)opening.value=target?1:0;
   initialized=true;
  }
  spring(opening,target?1:0,step,target?15:17);
  result.anchoredToHand=true;
  spring(cx,tx,step,14);spring(cy,ty,step,14);spring(cz,tz,step,14);
  crown.x=cx.value;crown.y=Math.max(cy.value,minimumRim);crown.z=cz.value;
  // Choose the paw's side once. It must not swap when that paw crosses the
  // head during an authored motion. The guide remains below the face, with
  // the main shaft outside its lateral silhouette and a neck overhead.
  if(!shaftSide)shaftSide=grip.x<head.x?-1:1;
  const shaftX=head.x+shaftSide*height*UMBRELLA_SHAFT_OFFSET_RATIO;
  const front=Math.max(finite(frontLimit,head.z),head.z+height*.23)+height*.025;
  guide.x=shaftX;guide.y=Math.min(grip.y+height*.07,head.y-height*.22);guide.z=front;
  shaftTop.x=shaftX;shaftTop.y=crown.y+d.depth*.30;shaftTop.z=front;
  neckEnd.x=crown.x;neckEnd.y=crown.y+d.depth-d.thickness;neckEnd.z=crown.z;
  result.openness=clamp(opening.value,0,1);result.fold=.10+.90*ease(result.openness);
  result.opacity=ease(result.openness);result.visible=result.openness>.006;
  result.headTop=top;result.headTopProvided=Number.isFinite(headTop);
  result.rimClearanceRatio=(crown.y-tiltMargin-top)/height;
  result.headTopClearanceRatio=result.rimClearanceRatio;
  result.tiltMarginRatio=tiltMargin/height;result.shaftSide=shaftSide;
  result.shaftOffsetRatio=(shaftX-head.x)/height;result.shaftFaceOffsetRatio=Math.abs(result.shaftOffsetRatio);
  result.crownClearanceRatio=(crown.y-head.y)/height;
  const dx=head.x-crown.x,dz=head.z-crown.z,radial=Math.hypot(dx,dz)/d.radius;
  const roof=crown.y+canopyHeightAt(radial,d.depth)-Math.abs(dx*Math.sin(result.roll))-Math.abs(dz*Math.sin(result.pitch));
  // This is an analytic head-centre estimate, not a claim of mesh collision QA.
  result.roofClearanceRatio=(roof-head.y)/height;
  result.headCoverageMarginRatio=(d.radius-Math.hypot(dx,dz)-height*.30)/height;
  return result;
 }
 function snapshot(){
  return {...result,grip:{...grip},head:{...head},crown:{...crown},guide:{...guide},shaftTop:{...shaftTop},neckEnd:{...neckEnd}};
 }
 return {sample,snapshot,dimensions:d};
}

export function createUmbrella(THREE,{height=1}={}){
 const state=createUmbrellaState({height}),d=state.dimensions;
 const object=new THREE.Group(),crown=new THREE.Group();
 object.name='M_Umbrella_Accessory';crown.name='M_Umbrella_Canopy';object.visible=false;
 const fabric=new THREE.MeshStandardMaterial({color:0x72b8d0,metalness:.04,roughness:.46,
  transparent:true,opacity:0,side:THREE.DoubleSide});
 const rimMaterial=new THREE.MeshStandardMaterial({color:0xb9e3ef,metalness:.12,roughness:.42,transparent:true,opacity:0});
 const metal=new THREE.MeshStandardMaterial({color:0x465d6e,metalness:.48,roughness:.32,transparent:true,opacity:0});
 const seamMaterial=new THREE.LineBasicMaterial({color:0xdaedf5,transparent:true,opacity:0,depthWrite:false});
 const profile=umbrellaCanopyProfile(d).map(p=>new THREE.Vector2(p.x,p.y));
 const canopy=new THREE.Mesh(new THREE.LatheGeometry(profile,32),fabric);canopy.name='M_Umbrella_Fabric';crown.add(canopy);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(d.radius,d.rimRadius,5,32),rimMaterial);rim.rotation.x=Math.PI/2;crown.add(rim);
 const ribs=[];
 for(let spoke=0;spoke<8;spoke++){
  const angle=spoke*Math.PI/4;
  for(let k=0;k<8;k++)for(const step of [k,k+1]){
   const radial=step/8,r=d.radius*radial;
   ribs.push(r*Math.cos(angle),canopyHeightAt(radial,d.depth)+height*.0025,r*Math.sin(angle));
  }
 }
 const ribGeometry=new THREE.BufferGeometry();ribGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ribs,3));
 crown.add(new THREE.LineSegments(ribGeometry,seamMaterial));
 const tip=new THREE.Mesh(new THREE.SphereGeometry(height*.011,8,6),metal);tip.position.y=d.depth+height*.005;crown.add(tip);
 const unitShaft=new THREE.CylinderGeometry(d.shaftRadius,d.shaftRadius,1,8);
 const lower=new THREE.Mesh(unitShaft,metal),shaft=new THREE.Mesh(unitShaft,metal),neck=new THREE.Mesh(unitShaft,metal);
 lower.name='M_Umbrella_GripGuide';shaft.name='M_Umbrella_Shaft';neck.name='M_Umbrella_Neck';
 const handle=new THREE.Mesh(new THREE.TorusGeometry(d.handleRadius,d.handleTube,6,16,Math.PI),metal);
 handle.rotation.z=Math.PI;handle.position.set(0,-height*.038,0);handle.name='M_Umbrella_Handle';
 object.add(crown,lower,shaft,neck,handle);
 const origin=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0);
 function segment(mesh,from,to,grip){
  a.set(from.x-grip.x,from.y-grip.y,from.z-grip.z);b.set(to.x-grip.x,to.y-grip.y,to.z-grip.z);
  direction.copy(b).sub(a);const length=direction.length();
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=Math.max(.0001,length);
  if(length>.00001)mesh.quaternion.setFromUnitVectors(axis,direction.multiplyScalar(1/length));
 }
 function update(input={}){
  const pose=state.sample(input);object.visible=pose.visible;
  object.position.set(pose.grip.x,pose.grip.y,pose.grip.z);
  crown.position.set(pose.crown.x-pose.grip.x,pose.crown.y-pose.grip.y,pose.crown.z-pose.grip.z);
  crown.rotation.set(pose.pitch,0,pose.roll);
  crown.scale.set(pose.fold,1+.45*(1-pose.fold),pose.fold);
  fabric.opacity=.97*pose.opacity;rimMaterial.opacity=.85*pose.opacity;
  seamMaterial.opacity=.22*pose.opacity;metal.opacity=pose.opacity;
  origin.copy(object.position);
  segment(lower,pose.grip,pose.guide,origin);segment(shaft,pose.guide,pose.shaftTop,origin);segment(neck,pose.shaftTop,pose.neckEnd,origin);
  return pose;
 }
 return {object,update,snapshot:state.snapshot,dimensions:d};
}
