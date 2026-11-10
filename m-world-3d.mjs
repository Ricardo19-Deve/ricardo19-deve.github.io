/** M World: original V6, bounded framing and actual WebGL depth occlusion. */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {readGLB} from './m-lab/swim-v3/threejs/glb-reader.js';
import {preserveFullSkinning} from './m-lab/swim-v3/threejs/full-skinning.js';
import {createFacialV6} from './m-lab/interactions/facial-v6.mjs?blink=v66';
import {createMotionV8,motionPose,canonicalBoneName} from './m-lab/interactions/motion-v8.mjs?rig=v66';
import {performanceStagePoseV15} from './m-lab/interactions/performance-v15.mjs?v16';
import {M_GESTURES,GESTURE_DURATIONS,sampleGesture,createGestureLayer} from './m-world-acting.mjs?v=66';
import {createSecondaryPoseCompositor} from './m-world-pose-compositor.mjs?v=66';
import {weatherActorPose} from './m-world-weather-actor.mjs?v=66&sky=67';
import {createAttentionDirector,createContextBlink,createFacialTargetMixer} from './m-world-attention.mjs?v=66';
import {createPresenceDynamics} from './m-world-dynamics.mjs?v=66';
import {createFacialContinuity} from './m-world-face-continuity.mjs?v=66';
import {visualDepthMasks,visualDepthSide} from './m-world-occlusion.mjs?v=66';
import {createMicroMotion} from './m-world-micro-motion.mjs?v=66';
import {sampleEmbodiedRest} from './m-world-rest-pose.mjs?v=66';
import {createLivingPerformance} from './m-world-living-performance.mjs?v=66';
import {createSurfaceContact} from './m-world-surface-contact.mjs?v=66';
import {createMotionContinuity} from './m-world-motion-continuity.mjs?v=66';
import {createEmotionalBody} from './m-world-emotional-body.mjs?v=66';
import {createPoseHandoff} from './m-world-pose-handoff.mjs?v=66';
import {createLifeBridges} from './m-world-life-bridges.mjs?v=66';
import {createSpontaneousPlay} from './m-world-spontaneous-play.mjs?v=66';
import {createBetweenBeats} from './m-world-between-beats.mjs?v=66';
import {createIntentCrossfade} from './m-world-intent-crossfade.mjs?v=66';
import {createRenderQualityGovernor} from './m-world-quality.mjs?v=66';
import {advanceLocomotion,sampleLocomotionPose} from './m-world-locomotion.mjs?v=66';
import {M_AFFECTS,AFFECT_DURATIONS,sampleAffect} from './m-world-affect.mjs?v=66';

const PART_COUNT=19;
const EXPECTED_SIZE=16899868;
const num=(n,low,high)=>Math.min(high,Math.max(low,Number.isFinite(n)?n:0));
async function downloadGLB(onProgress=()=>{}){
 const buffers=new Array(PART_COUNT);
 let bytes=0;
 // Limit concurrent fetches to avoid monopolizing mobile connections.
 const counters={next:0};
 async function worker(){
  while(counters.next<PART_COUNT){
   const index=counters.next++;
   const path='./assets/m-v6-web/part-'+String(index).padStart(2,'0')+'.bin';
   const response=await fetch(path,{cache:'force-cache',credentials:'omit'});
   if(!response.ok)throw new Error('Falta o segmento '+index+' do GLB: '+response.status);
   const piece=new Uint8Array(await response.arrayBuffer());
   if(!piece.byteLength)throw new Error('Segmento vazio: '+index);
   buffers[index]=piece;bytes+=piece.byteLength;
   onProgress(Math.floor(bytes/EXPECTED_SIZE*100));
  }
 }
 await Promise.all(Array.from({length:Math.min(4,PART_COUNT)},worker));
 if(bytes!==EXPECTED_SIZE)throw new Error('GLB incompleto: '+bytes+' / '+EXPECTED_SIZE);
 const data=new Uint8Array(EXPECTED_SIZE);let offset=0;
 for(const part of buffers){data.set(part,offset);offset+=part.byteLength;}
 if(new DataView(data.buffer).getUint32(0,true)!==0x46546c67)
  throw new Error('Modelo V6 não reconhecido');
 return data.buffer;
}

export const M_CANVAS_SIZES=Object.freeze({desktop:272,mobile:208});
const WORLD_SPAN=3.2;
const expressionFor=(mood,mode)=>{
 if(['neutral','happy','curious','surprised'].includes(mood))return mood;
 if(mood==='excited')return 'happy';
 if(mode==='peek'||mode==='curious')return 'curious';
 if(['play','orbit','surf','swim'].includes(mode))return 'happy';
 return 'neutral';
};
const motionFor=mode=>({peek:'peek',perch:'float',orbit:'swim',surf:'swim',dash:'swim',play:'follow',spin:'swim',curl:'shy',shy:'shy',curious:'curious',float:'float',glide:'swim',swim:'swim',rest:'float'}[mode]||'float');
export function normalizeActorRect(rect){
 if(!rect)return null;
 const left=Number(rect.left??rect.x),top=Number(rect.top??rect.y),width=Number(rect.width??rect.size),height=Number(rect.height??rect.size);
 return [left,top,width,height].every(Number.isFinite)&&width>0&&height>0?{left,top,width,height}:null;
}
export function viewportPointToNDC(x,y,actor){
 const a=normalizeActorRect(actor);if(!a)throw new Error('Invalid actor viewport');
 return {x:2*(x-a.left)/a.width-1,y:1-2*(y-a.top)/a.height};
}
export function overlappingViewportRect(rect,actor,protectedRegion=false){
 const a=normalizeActorRect(actor);if(!a||!rect)return null;
 const left=Number(rect.left),top=Number(rect.top),width=Number(rect.width??(rect.right-left)),height=Number(rect.height??(rect.bottom-top));
 if(![left,top,width,height].every(Number.isFinite)||width<=0||height<=0||left>=a.left+a.width||top>=a.top+a.height||left+width<=a.left||top+height<=a.top)return null;
 return {left,top,width,height,radius:protectedRegion===true?0:num(Number(rect.radius)||0,0,Math.min(width,height)/2)};
}
export function appendRoundedRectTriangles(rect,out=[],perimeter=[]){
 const l=rect.left,t=rect.top,r=l+rect.width,b=t+rect.height,rad=num(rect.radius||0,0,Math.min(rect.width,rect.height)/2);
 if(rad<.01){out.push(l,t,r,t,r,b,l,t,r,b,l,b);return out;}
 perimeter.length=0;
 for(let corner=0;corner<4;corner++){
  const cx=corner<2?r-rad:l+rad,cy=corner===0||corner===3?t+rad:b-rad,start=-Math.PI/2+corner*Math.PI/2;
  for(let k=0;k<=6;k++){const angle=start+k*Math.PI/12;perimeter.push(cx+rad*Math.cos(angle),cy+rad*Math.sin(angle));}
 }
 const cx=(l+r)/2,cy=(t+b)/2,count=perimeter.length/2;
 for(let k=0;k<count;k++){const next=(k+1)%count;out.push(cx,cy,perimeter[k*2],perimeter[k*2+1],perimeter[next*2],perimeter[next*2+1]);}
 return out;
}
export function depthLayerPlacement(depth,halfDepth,margin=.12){
 const h=Math.max(.01,Number(halfDepth)||0),gap=Math.max(.01,Number(margin)||0),travel=h+gap;
 return {bodyZ:num(Number(depth),-1,1)*travel,surfaceZ:0,protectedZ:2*h+2*gap,travel};
}
/** Fit correlated pose points, never corners synthesized from different poses. */
export function projectedPoseBounds(points,{center={x:0,y:0,z:0},angles={x:[-.12,0,.12],y:[-.24,0,.24],z:[-.12,0,.12]},scaleLimit=1.03,paddingRatio=.025}={}){
 if(!points?.length||points.length%3||points.some(v=>!Number.isFinite(v)))throw new Error('Invalid pose point cloud');
 const min={x:Infinity,y:Infinity,z:Infinity},max={x:-Infinity,y:-Infinity,z:-Infinity};
 for(const rx of angles.x)for(const ry of angles.y)for(const rz of angles.z){
  const sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
  for(let i=0;i<points.length;i+=3){
   const a=points[i]-center.x,b=points[i+1]-center.y,c=points[i+2]-center.z;
   // Three's XYZ Euler quaternion applies the Z, Y, then X rotations.
   const x0=cz*a-sz*b,y0=sz*a+cz*b,x1=cy*x0+sy*c,z1=-sy*x0+cy*c;
   const x=x1*scaleLimit,y=(cx*y0-sx*z1)*scaleLimit,z=(sx*y0+cx*z1)*scaleLimit;
   min.x=Math.min(min.x,x);max.x=Math.max(max.x,x);min.y=Math.min(min.y,y);max.y=Math.max(max.y,y);min.z=Math.min(min.z,z);max.z=Math.max(max.z,z);
  }
 }
 const pad=Math.max(max.x-min.x,max.y-min.y,max.z-min.z)*paddingRatio;
 for(const key of ['x','y','z']){min[key]-=pad;max[key]+=pad;}
 return {min,max};
}
function localRectFromNDC(bounds,size){
 const left=(bounds.minX+1)*size/2,top=(1-bounds.maxY)*size/2,right=(bounds.maxX+1)*size/2,bottom=(1-bounds.minY)*size/2;
 return {left,top,right,bottom,width:right-left,height:bottom-top};
}
export function fitCharacterFrame(bounds,size,worldSpan=WORLD_SPAN,marginRatio=.07){
 const width=bounds.max.x-bounds.min.x,height=bounds.max.y-bounds.min.y;
 if(!Number.isFinite(width+height)||width<=0||height<=0)throw new Error('Invalid animated model bounds');
 const scale=worldSpan*(1-2*marginRatio)/Math.max(width,height),cx=(bounds.min.x+bounds.max.x)/2,cy=(bounds.min.y+bounds.max.y)/2;
 const footprint={left:size/2+(bounds.min.x-cx)*scale/worldSpan*size,top:size/2-(bounds.max.y-cy)*scale/worldSpan*size,right:size/2+(bounds.max.x-cx)*scale/worldSpan*size,bottom:size/2-(bounds.min.y-cy)*scale/worldSpan*size};
 footprint.width=footprint.right-footprint.left;footprint.height=footprint.bottom-footprint.top;
 return {scale,footprint,center:{x:cx,y:cy,z:(bounds.min.z+bounds.max.z)/2}};
}

export async function mountMWorld3D(host,{onProgress=()=>{},onReady=()=>{}}={}){
 if(!window.WebGLRenderingContext)throw new Error('WebGL unavailable');
 const raw=await downloadGLB(onProgress),rawInfo=readGLB(raw);
 const gltf=await new GLTFLoader().parseAsync(raw,'');
 const source=gltf.scene,ownedTextures=new Set();
 source.traverse(object=>{
  if(!object.isMesh)return;
  object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
  for(const material of Array.isArray(object.material)?object.material:[object.material])
   for(const value of Object.values(material))if(value?.isTexture)ownedTextures.add(value);
 });
 const skin=preserveFullSkinning(gltf,rawInfo);
 const body=skin.meshes.find(m=>m.morphTargetDictionary?.Shoulder_Propulsion_Corrective!==undefined);
 if(!body||body.skeleton.bones.length!==31||new Set(body.skeleton.bones).size!==31||skin.maxUsed!==14||skin.sets!==4)
  throw new Error('M requires the original 31-bone, 14-influence skin; four-influence fallback is not allowed.');
 const canvas=document.createElement('canvas');canvas.className='m-world-canvas';canvas.setAttribute('aria-hidden','true');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,depth:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1;
 const shaderErrors=[];renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
  const text=[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n');
  shaderErrors.push(text);throw new Error('M skinning/depth shader compilation failed: '+text);
 };
 let viewportSize=0,pixelRatio=0,disposed=false,environmentTarget=null,clock=0,swimWeight=0,depth=1,spatialFrame=null,frameFit=null;
 const presence=createPresenceDynamics(),qualityGovernor=createRenderQualityGovernor(),microMotion=createMicroMotion(),livingPerformance=createLivingPerformance({seed:Math.floor(Math.random()*4294967295)}),surfaceContact=createSurfaceContact(),motionContinuity=createMotionContinuity(),emotionalBody=createEmotionalBody({seed:Math.floor(Math.random()*4294967295)}),lifeBridges=createLifeBridges(),spontaneousPlay=createSpontaneousPlay({seed:Math.floor(Math.random()*4294967295)}),betweenBeats=createBetweenBeats({seed:Math.floor(Math.random()*4294967295)}),intentCrossfade=createIntentCrossfade();
  // One total budget and one continuous handoff for all secondary joint targets.
  const attentionDirector=createAttentionDirector({seed:0x66a11}),contextBlink=createContextBlink({seed:0x66b11}),facialTargetMixer=createFacialTargetMixer();
  const presentation={},secondaryTargets=Array.from({length:8},()=>({pose:null,weight:1}));
  let lastAttention=attentionDirector.sample(),lastBlink=contextBlink.sample(),facialBlendRejected=0;
  const stageHandoff=createPoseHandoff({halfLife:.25,limit:1.7});
 let lastContact=surfaceContact.sample(),lastContinuity=motionContinuity.sample(),lastEmotional=emotionalBody.sample({reducedMotion:true}),lastBridge=lifeBridges.sample({reducedMotion:true}),lastPlay=spontaneousPlay.sample({reducedMotion:true}),lastAmbient=betweenBeats.sample({reducedMotion:true}),lastTransition=intentCrossfade.sample({reducedMotion:true});
 let lastRestPose=sampleEmbodiedRest();
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-WORLD_SPAN/2,WORLD_SPAN/2,WORLD_SPAN/2,-WORLD_SPAN/2,.03,100);
 camera.position.set(0,0,8);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const depthRoot=new THREE.Group(),stage=new THREE.Group(),container=new THREE.Group();scene.add(depthRoot);depthRoot.add(stage);stage.add(container);container.add(source);
 const maskGroup=new THREE.Group();maskGroup.renderOrder=-1000;scene.add(maskGroup);
 const depthMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide,toneMapped:false});
 const depthSupported=Boolean(renderer.getContext().getContextAttributes()?.depth)&&renderer.getContext().getParameter(renderer.getContext().DEPTH_BITS)>0;
 const projected=new THREE.Vector3(),footPoint=new THREE.Vector3();
 function makeBatch(order){
  const geometry=new THREE.BufferGeometry(),mesh=new THREE.Mesh(geometry,depthMaterial);mesh.renderOrder=order;mesh.frustumCulled=false;mesh.visible=false;maskGroup.add(mesh);
  return {mesh,capacity:0,points:[],perimeter:[],rectCount:0,vertices:0};
 }
 const surfaceBatch=makeBatch(-1000),protectedBatch=makeBatch(-999);
 // Fine facial details need supersampling even on DPR-1 desktop displays.
 // Keep the existing upper bounds: 680px desktop, 416px mobile.
 function syncResolution(){
  const mobile=window.matchMedia('(max-width:720px)').matches,nextSize=mobile?M_CANVAS_SIZES.mobile:M_CANVAS_SIZES.desktop;
  const ceiling=Math.max(2,Math.min(window.devicePixelRatio||1,mobile?2:2.5));
  // Change resolution only after sustained frame pacing evidence.
  const nextRatio=qualityGovernor.configure({maxRatio:ceiling,minRatio:mobile?1.5:1.75,device:mobile?'mobile':'desktop'});
  if(viewportSize===nextSize&&pixelRatio===nextRatio)return;
  viewportSize=nextSize;pixelRatio=nextRatio;renderer.setPixelRatio(pixelRatio);renderer.setSize(viewportSize,viewportSize,false);
 }
 syncResolution();window.addEventListener('resize',syncResolution,{passive:true});
 function dispose(){
  if(disposed)return;disposed=true;window.removeEventListener('resize',syncResolution);
  const geometries=new Set(),materials=new Set([depthMaterial]);
  scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
  for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)ownedTextures.add(value);material.dispose();}
  for(const geometry of geometries)geometry.dispose();for(const texture of ownedTextures)texture.dispose();
  environmentTarget?.dispose();renderer.dispose();canvas.remove();
 }
 try{
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
  environmentTarget=pmrem.fromScene(room,.04);scene.environment=environmentTarget.texture;scene.environmentIntensity=.5;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff6ff,0x71718e,.75));
  const key=new THREE.DirectionalLight(0xfff7f9,2);key.position.set(-4,7,9);scene.add(key);
  const rim=new THREE.DirectionalLight(0xab9bff,.65);rim.position.set(5,3,-5);scene.add(rim);
 // Keep detail visible on high-density displays; mipmaps remain enabled
 // to avoid shimmering while M moves across the portfolio.
 const maxAnisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 source.traverse(o=>{
  if(!o.isMesh)return;
  for(const material of Array.isArray(o.material)?o.material:(o.material?[o.material]:[])){
   for(const name of ['map','normalMap','roughnessMap','metalnessMap','aoMap']){
    const texture=material[name];
    if(!texture)continue;
    texture.anisotropy=maxAnisotropy;
    texture.magFilter=THREE.LinearFilter;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.needsUpdate=true;
   }
  }
 });
 // The earlier lightweight GLB compressed several normal maps and the
 // important face/body colour textures too aggressively. Restore source-
 // quality maps as separate, cacheable assets while keeping the proven V6 rig.
 const details=[
  [0,'jpg',false],[1,'jpg',true],[2,'jpg',false],
  [3,'webp',false],[4,'png',true],[6,'png',true],
  [8,'webp',false],[9,'png',true],[11,'webp',false],[12,'png',true]
 ];
 const textures=new Map();
 const loader=new THREE.TextureLoader();
 const results=await Promise.allSettled(details.map(async([id,ext,srgb])=>{
  const tex=await loader.loadAsync('./assets/m-v6-detail/m-original-'+id+'.'+ext);
  tex.flipY=false;
  tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
  tex.anisotropy=maxAnisotropy;
  tex.magFilter=THREE.LinearFilter;
  tex.minFilter=THREE.LinearMipmapLinearFilter;
  tex.needsUpdate=true;
  textures.set(id,tex);ownedTextures.add(tex);
 }));
 const replacements=[
  [/^Material_0/,{map:1,normalMap:0,roughnessMap:2,metalnessMap:2}],
  [/^M_L_UnifiedSkin_/,{map:4,normalMap:3}],
  [/^M_L_OriginalEyeColor_/,{map:6}],
  [/^M_L_lower_/,{map:9,normalMap:8}],
  [/^M_L_upper_/,{map:12,normalMap:11}],
  [/^M_R_UnifiedSkin_/,{normalMap:3}],
  [/^M_R_lower_/,{normalMap:8}],
  [/^M_R_upper_/,{normalMap:11}]
 ];
 let detailSlots=0;
 source.traverse(object=>{
  if(!object.isMesh)return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  for(const material of materials){
   if(!material)continue;
   const replacement=replacements.find(([regex])=>regex.test(material.name||''));
   if(!replacement)continue;
   for(const [slot,id] of Object.entries(replacement[1])){
    const tex=textures.get(id);
    if(!tex)continue;
    const previous=material[slot];
    // Preserve the approved disabled right socket normal; never revive a stale bake.
    if(slot==='normalMap'&&/^M_R_UnifiedSkin_/.test(material.name||'')&&(!previous||(material.normalScale?.x===0&&material.normalScale?.y===0)))continue;
    if(previous){
     tex.wrapS=previous.wrapS;tex.wrapT=previous.wrapT;
     tex.offset.copy(previous.offset);tex.repeat.copy(previous.repeat);
     tex.center.copy(previous.center);tex.rotation=previous.rotation;
     tex.channel=previous.channel;
    }
    material[slot]=tex;
    detailSlots++;
   }
   material.needsUpdate=true;
  }
 });
 const detailMaps=textures.size;
 if(detailMaps<details.length)console.warn('[M 3D] Some high-detail maps unavailable:',results.filter(x=>x.status==='rejected').length);
 if(detailSlots<9)console.warn('[M 3D] Unexpected material map names: only',detailSlots,'slots restored');

  const clips=gltf.animations||[],mixer=new THREE.AnimationMixer(source),swim=clips.find(c=>c.name==='M_Swim_V4'),action=swim?mixer.clipAction(swim):null;
  if(!action)throw new Error('The preserved M_Swim_V4 clip is missing.');
  const motion=createMotionV8(source,THREE),facial=createFacialV6(source,clips),facialContinuity=createFacialContinuity();
  if(motion.tailDiagnostics.connected!==10)throw new Error('The ten original tail bones are required.');
  facial.setIntensity(1);facial.setAutoBlink(false);
  const bones=new Map();source.traverse(o=>{if(o.isBone)bones.set(canonicalBoneName(o.name),o);});
  const rest=new Map([...bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
  const gestureLayer=createGestureLayer(bones,THREE),locomotionLayer=createGestureLayer(bones,THREE),secondaryLayer=createGestureLayer(bones,THREE),secondaryPose=createSecondaryPoseCompositor([...bones.keys()]);let lastGesture=sampleGesture(),lastAffect=sampleAffect();
 let lastLiving= livingPerformance.sample({reducedMotion:true});
  function updateWorld(){scene.updateMatrixWorld(true);for(const mesh of skin.meshes)mesh.skeleton.update();}
  updateWorld();
  const restBox=new THREE.Box3().setFromObject(source),envelope=restBox.clone(),frameSamples=[],posePoints=[];
  const sourceOrigin=source.position.clone(),characterHeight=restBox.getSize(new THREE.Vector3()).y;
  const boundsRecord=box=>({min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray()});
  const feet=[bones.get('Foot.L'),bones.get('Foot.R')].filter(Boolean);
  const rawFoot=new THREE.Vector3();for(const foot of feet)rawFoot.add(foot.getWorldPosition(new THREE.Vector3()));if(feet.length)rawFoot.multiplyScalar(1/feet.length);else rawFoot.set(restBox.getCenter(new THREE.Vector3()).x,restBox.min.y,0);
  const soleGap=Math.max(0,rawFoot.y-restBox.min.y);
  const samplePoint=new THREE.Vector3(),sampleEuler=new THREE.Euler(),sampleRotation=new THREE.Quaternion();
  function includePose(tag){
   updateWorld();const poseBox=new THREE.Box3().makeEmpty();
   for(const mesh of skin.meshes){const n=mesh.geometry.attributes.position.count,limit=mesh===body?1600:180,step=Math.max(1,Math.ceil(n/limit));
    for(let index=0;index<n;index+=step){
     mesh.getVertexPosition(index,samplePoint).applyMatrix4(mesh.matrixWorld);
     envelope.expandByPoint(samplePoint);poseBox.expandByPoint(samplePoint);posePoints.push(samplePoint.x,samplePoint.y,samplePoint.z);
    }
   }
   frameSamples.push({...tag,...boundsRecord(poseBox)});
  }
  function sample(time,{mode='float',expression='neutral',swimWeight=0,energy=.35,tailEnergy=.25,emotionAge=9,gesture=null,locomotion=null,affect=null,secondary=null,tailPhase,tailMood}={}){
   const acting=sampleGesture(gesture||{});if(acting.envelope>0)expression=acting.expression;
   mixer.stopAllAction();for(const [name,bone]of bones)bone.quaternion.copy(rest.get(name));
   action.reset().setEffectiveWeight(swimWeight).play();action.paused=true;action.time=time;mixer.update(0);
   source.position.copy(sourceOrigin);source.position.y+=acting.lift*characterHeight;
   if(energy>0){
    const poses=motionPose({time,modeAge:3,emotionAge,mode,expression,energy,tailEnergy,tailReactivity:1.5,tailFlow:.83,performanceImpact:1,swimWeight,tailPhase,tailMood});
    for(const [name,angles]of Object.entries(poses)){const bone=bones.get(name);if(!bone)continue;sampleEuler.set(...angles,'XYZ');sampleRotation.setFromEuler(sampleEuler);bone.quaternion.multiply(sampleRotation);}
   }
   for(const [name,angles]of Object.entries(sampleLocomotionPose(locomotion||{}))){const bone=bones.get(name);if(!bone)continue;sampleEuler.set(...angles,'XYZ');sampleRotation.setFromEuler(sampleEuler);bone.quaternion.multiply(sampleRotation);}
   for(const [name,angles]of Object.entries(acting.pose)){const bone=bones.get(name);if(!bone)continue;sampleEuler.set(...angles,'XYZ');sampleRotation.setFromEuler(sampleEuler);bone.quaternion.multiply(sampleRotation);}
   if(secondary)for(const [name,angles]of Object.entries(secondary)){const bone=bones.get(name);if(!bone)continue;sampleEuler.set(...angles,'XYZ');sampleRotation.setFromEuler(sampleEuler);bone.quaternion.multiply(sampleRotation);}
   const feeling=sampleAffect({...affect,reducedMotion:Boolean(acting.name)});
   facial.setExpressionBlend(feeling.envelope>0?feeling.weights:null);facial.setRestBlink(feeling.envelope>0?feeling.eyelids:null);
   facial.setGestureBlink(acting.blink);facial.setExpression(expression);facial.update(2,0);includePose({time,mode,expression,swimWeight,energy,...(gesture?{gesture:gesture.name,gestureAge:gesture.age,gestureSide:gesture.side}:{}),...(feeling.envelope>0?{affect:feeling.name}:{})});
  }
  // Sample supported production states. Idle has no Swim clip, and a moving
  // character uses at most .8 Swim weight; unrelated poses are never stacked
  // on an impossible 100% Swim merely to calculate the camera.
  sample(0,{energy:0});
  for(let k=0;k<=24;k++)sample(k*swim.duration/24,{mode:'swim',swimWeight:.8,energy:.84,tailEnergy:.94});
  for(const [mode,expression,moving]of [['float','happy',false],['curious','curious',false],['peek','curious',true],['shy','neutral',false],['follow','happy',true]])
   for(const t of [.6,2.2,4.7])sample(t,{mode,expression,swimWeight:moving?.8:0,energy:moving?.84:.35,tailEnergy:moving?.94:.25});
  sample(2.2,{expression:'surprised',emotionAge:.25});
  // Fit real gesture silhouettes over supported idle and decaying-travel
  // bases. A shared pose point cloud retains correlation, rather than adding
  // independent per-joint maxima that would needlessly shrink the actor.
  const gestureTimes=[.08,.16,.25,.33,.42,.50,.59,.67,.76,.86,.94];
  for(const name of M_GESTURES)for(const side of [-1,1])for(const progress of gestureTimes){
   const gesture={name,side,age:progress*GESTURE_DURATIONS[name]};
   sample(2.2,{gesture});
   sample(2.2,{mode:'swim',swimWeight:.8,energy:.84,tailEnergy:.94,gesture});
  }
  // Fit correlated, physically generated turn/arrival poses rather than independent joint maxima.
  for(const sign of [-1,1]){
   let travel={x:0,y:0,vx:0,vy:0};
   for(let frame=0;frame<100;frame++){
    travel=advanceLocomotion(travel,frame<45?{x:sign*180,y:0}:{x:sign*120,y:-120},1/60);
    if([12,32,58,78].includes(frame))sample(frame/60,{mode:'swim',swimWeight:.8,energy:.84,tailEnergy:.94,locomotion:travel});
   }
  }
  // These original-morph combinations add no joint pose or exaggerated targets.
  for(const name of M_AFFECTS)if(AFFECT_DURATIONS[name])sample(2.2,{affect:{name,age:AFFECT_DURATIONS[name]*.45}});
  // Fit actual correlated V66 secondary targets together with contextual tail
  // poses. These are sampled performances, never independent bone extremes.
  const fitPresence=createPresenceDynamics(),fitLiving=createLivingPerformance({seed:66}),fitEmotion=createEmotionalBody({seed:66}),fitSecondary=createSecondaryPoseCompositor([...bones.keys()]);
  for(const intent of ['observe','play','recover']){
   const physical={intent,energy:.82,arousal:intent==='play'?.75:.24,valence:.65,focus:intent==='observe'?.9:.3};
   for(let frame=0;frame<120;frame++){
    const attention={x:.8,y:.25},d=fitPresence.sample({dt:1/60,attention,performance:physical});
    const living=fitLiving.sample({dt:1/60,attention,mode:'float',phase:'hold'}),emotion=fitEmotion.sample({dt:1/60,emotion:intent==='play'?'happy':'curious',energy:.82});
    const secondary=fitSecondary.sample({dt:1/60,layers:[{pose:living.pose,weight:.65},{pose:emotion.pose,weight:.65}]});
    if(frame===59||frame===119)sample(frame/60,{mode:intent==='play'?'follow':'float',expression:intent==='play'?'happy':'curious',energy:d.energy,tailEnergy:d.tailEnergy,tailPhase:d.tailPhase,tailMood:d.tailMood,secondary});
   }
  }
  facial.setGestureBlink(null);facial.setExpressionBlend(null);facial.setRestBlink(null);
  mixer.stopAllAction();motion.reset();source.position.copy(sourceOrigin);facial.setExpression('neutral');facial.setBlink('left',0);facial.setBlink('right',0);facial.update(2,0);facial.setAutoBlink(false);updateWorld();
  const center=envelope.getCenter(new THREE.Vector3()),projectedBounds=projectedPoseBounds(posePoints,{center});
  const framed=new THREE.Box3(new THREE.Vector3(projectedBounds.min.x,projectedBounds.min.y,projectedBounds.min.z),new THREE.Vector3(projectedBounds.max.x,projectedBounds.max.y,projectedBounds.max.z));
  posePoints.length=0;
  // Reserve the actual bounded stage translation in world units as well.
  const provisionalFit=fitCharacterFrame(framed,viewportSize);
  framed.min.x-=.025/provisionalFit.scale;framed.max.x+=.025/provisionalFit.scale;
  framed.min.y-=.06/provisionalFit.scale;framed.max.y+=.06/provisionalFit.scale;
  frameFit=fitCharacterFrame(framed,viewportSize);
  source.position.sub(center);container.scale.setScalar(frameFit.scale);
  const neutralSourcePosition=source.position.clone();
   // A removable, hand-held umbrella. It does not modify M's original
   // GLB, skeleton, morphs or animations. The handle's local origin is at
   // Hand.L, and its canopy clears the head rather than sitting on it.
   const umbrella=new THREE.Group(),umbrellaRadius=characterHeight*.42;
   const umbrellaCrown=new THREE.Group();
   const canopyMaterial=new THREE.MeshStandardMaterial({
    color:0x7bbdd8,metalness:.07,roughness:.42,transparent:true,
    opacity:.94,side:THREE.DoubleSide
   });
   // Shallow canopy: wide coverage with a low arch, not a helmet.
   const canopyDepth=characterHeight*.24;
   const canopyProfile=[
    new THREE.Vector2(0,canopyDepth),
    new THREE.Vector2(umbrellaRadius*.22,canopyDepth*.95),
    new THREE.Vector2(umbrellaRadius*.48,canopyDepth*.78),
    new THREE.Vector2(umbrellaRadius*.73,canopyDepth*.50),
    new THREE.Vector2(umbrellaRadius*.92,canopyDepth*.20),
    new THREE.Vector2(umbrellaRadius,0)
   ];
   const canopy=new THREE.Mesh(new THREE.LatheGeometry(canopyProfile,32),canopyMaterial);
   umbrellaCrown.add(canopy);
   const rimMaterial=new THREE.MeshStandardMaterial({
    color:0xc6eaf6,metalness:.14,roughness:.4,transparent:true,opacity:.72
   });
   const canopyRim=new THREE.Mesh(
    new THREE.TorusGeometry(umbrellaRadius*.99,umbrellaRadius*.014,5,32),rimMaterial
   );
   canopyRim.rotation.x=Math.PI/2;umbrellaCrown.add(canopyRim);
   // Eight barely visible canopy seams distinguish an umbrella from a hat.
   const ribs=[];
   for(let spoke=0;spoke<8;spoke++){
    const angle=spoke*Math.PI/4;
    for(let k=0;k<8;k++)for(const step of [k,k+1]){
     const radial=step/8,rr=umbrellaRadius*radial;
     ribs.push(rr*Math.cos(angle),
      canopyDepth*(1-Math.pow(radial,1.7))+characterHeight*.003,
      rr*Math.sin(angle));
    }
   }
   const ribGeometry=new THREE.BufferGeometry();
   ribGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ribs,3));
   const ribLines=new THREE.LineSegments(ribGeometry,new THREE.LineBasicMaterial({
    color:0xe0f4fb,transparent:true,opacity:.20,depthWrite:false
   }));
   umbrellaCrown.add(ribLines);
   // A central tip and dark shaft complete the umbrella silhouette.
   const topTip=new THREE.Mesh(
    new THREE.SphereGeometry(umbrellaRadius*.033,8,6),
    new THREE.MeshStandardMaterial({color:0xcbe4f2,metalness:.48,roughness:.34})
   );
   topTip.position.y=canopyDepth+characterHeight*.008;
   umbrellaCrown.add(topTip);
   const metal=new THREE.MeshStandardMaterial({color:0x617e98,metalness:.44,roughness:.31});
   // A unit cylinder stretches from the paw/handle to the canopy rim.
   const stem=new THREE.Mesh(
    new THREE.CylinderGeometry(umbrellaRadius*.043,umbrellaRadius*.043,1,10),metal
   );
   const handle=new THREE.Mesh(
    new THREE.TorusGeometry(umbrellaRadius*.12,umbrellaRadius*.023,6,14,Math.PI),metal
   );
   handle.position.set(0,-characterHeight*.042,0);handle.rotation.z=Math.PI;
   umbrella.add(umbrellaCrown,stem,handle);
   umbrella.rotation.set(.06,0,-.12);
   const canopyOffsetX=-characterHeight*.23,canopyOffsetZ=characterHeight*.06;
   const gripStart=new THREE.Vector3(0,0,0),stemDirection=new THREE.Vector3();
   const shaftAxis=new THREE.Vector3(0,1,0);
   function setUmbrellaCrownHeight(crownY){
    umbrellaCrown.position.set(canopyOffsetX,crownY,canopyOffsetZ);
    stemDirection.copy(umbrellaCrown.position).sub(gripStart);
    stem.position.copy(umbrellaCrown.position).add(gripStart).multiplyScalar(.5);
    stem.scale.y=stemDirection.length();
    stem.quaternion.setFromUnitVectors(shaftAxis,stemDirection.normalize());
   }
   setUmbrellaCrownHeight(characterHeight*.82);
   const umbrellaHand=bones.get('Hand.R')||bones.get('Hand.L')||null,umbrellaHead=bones.get('Head')||null;
   const handWorld=new THREE.Vector3(),handLocal=new THREE.Vector3();
   const headWorld=new THREE.Vector3(),headLocal=new THREE.Vector3();
   let umbrellaAnchored=false,umbrellaGripError=0,umbrellaCrownClearance=0;
   umbrella.position.set(-characterHeight*.20,characterHeight*.18,characterHeight*.12);
   container.add(umbrella);umbrella.visible=false;
   let umbrellaFade=0;
  depthRoot.position.x=-frameFit.center.x*frameFit.scale;depthRoot.position.y=-frameFit.center.y*frameFit.scale;updateWorld();
  const halfDepth=Math.max(Math.abs(framed.min.z),Math.abs(framed.max.z))*frameFit.scale,depthPlan=depthLayerPlacement(1,halfDepth);
  depthRoot.position.z=depthPlan.bodyZ;
  // A separate, stable neutral rectangle is used only to choose the intro
  // position. Route planning continues to use the full animated footprint.
  const neutralNDC={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const x of [restBox.min.x,restBox.max.x])for(const y of [restBox.min.y,restBox.max.y])for(const z of [restBox.min.z,restBox.max.z]){
   samplePoint.set((x-center.x)*frameFit.scale+depthRoot.position.x,(y-center.y)*frameFit.scale+depthRoot.position.y,(z-center.z)*frameFit.scale+depthRoot.position.z).project(camera);
   neutralNDC.minX=Math.min(neutralNDC.minX,samplePoint.x);neutralNDC.maxX=Math.max(neutralNDC.maxX,samplePoint.x);
   neutralNDC.minY=Math.min(neutralNDC.minY,samplePoint.y);neutralNDC.maxY=Math.max(neutralNDC.maxY,samplePoint.y);
  }
  const contact={x:viewportSize/2,y:viewportSize*.8};
  function updateContact(){
   updateWorld();footPoint.set(0,0,0);
   for(const foot of feet)footPoint.add(foot.getWorldPosition(projected));
   if(feet.length)footPoint.multiplyScalar(1/feet.length);
   else footPoint.set((rawFoot.x-center.x)*frameFit.scale,(rawFoot.y-center.y)*frameFit.scale,depthRoot.position.z);
   footPoint.y-=soleGap*frameFit.scale;footPoint.project(camera);
   contact.x=(footPoint.x+1)*viewportSize/2;contact.y=(1-footPoint.y)*viewportSize/2;
  }
  function updateBatch(batch,rectangles,actor,z,protectedRegion=false){
   batch.points.length=0;batch.rectCount=0;
   if(depthSupported&&actor)for(const input of rectangles||[]){
    // Text/control regions protect their full bounds. A solid two-triangle
    // quad also avoids raster pinholes at a rounded fan's central junction.
    const rect=overlappingViewportRect(input,actor,protectedRegion);if(!rect)continue;
    appendRoundedRectTriangles(rect,batch.points,batch.perimeter);batch.rectCount++;
   }
   const count=batch.points.length/2;batch.vertices=count;batch.mesh.visible=count>0;
   if(!count){batch.mesh.geometry.setDrawRange(0,0);return;}
   if(count>batch.capacity){
    batch.capacity=2**Math.ceil(Math.log2(Math.max(32,count)));
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(batch.capacity*3),3).setUsage(THREE.DynamicDrawUsage));
    batch.mesh.geometry.dispose();batch.mesh.geometry=geometry;
   }
   const attribute=batch.mesh.geometry.getAttribute('position'),array=attribute.array,clipZ=projected.set(0,0,z).project(camera).z;
   for(let i=0;i<count;i++){
    const ndc=viewportPointToNDC(batch.points[i*2],batch.points[i*2+1],actor);
    projected.set(ndc.x,ndc.y,clipZ).unproject(camera);array[i*3]=projected.x;array[i*3+1]=projected.y;array[i*3+2]=projected.z;
   }
   attribute.needsUpdate=true;batch.mesh.geometry.setDrawRange(0,count);
  }
  function setSpatialFrame(frame={}){
   spatialFrame=frame;const actor=normalizeActorRect(frame.actor);depth=num(Number(frame.depth??1),-1,1);
   // Prevent tail/paws penetrating the visible card plane during a depth transition.
   // Keep horizontal movement continuous; only Z uses a discrete visual layer.
   const visualSide=visualDepthSide(depth);
   const placement=depthLayerPlacement(visualSide,halfDepth);depthRoot.position.z=placement.bodyZ;
   const masks=visualDepthMasks({depth,surfaces:frame.surfaces,protectedRects:frame.protectedRects});
    updateBatch(surfaceBatch,masks.surfaces,actor,placement.surfaceZ);
    updateBatch(protectedBatch,masks.protectedRects,actor,placement.protectedZ,true);
   return {depthSupported,visualSide,surfaceRects:surfaceBatch.rectCount,protectedRects:protectedBatch.rectCount};
  }
  function getMetrics(){
   // The frame is fitted once in world units; local CSS metrics simply scale.
   const fit=fitCharacterFrame(framed,viewportSize);updateContact();
   return {size:viewportSize,footprint:{...fit.footprint},neutralFootprint:localRectFromNDC(neutralNDC,viewportSize),contact:{...contact},depthSupported};
  }
  function getInteractionPoint(name='Hand.L'){
   const bone=bones.get(name);if(!bone||!['Hand.L','Hand.R'].includes(name))return null;
   updateWorld();bone.getWorldPosition(projected).project(camera);
   return {x:(projected.x+1)*viewportSize/2,y:(1-projected.y)*viewportSize/2};
  }
  function getDiagnostics(){
   return {bones:31,rigBones:31,tailBones:motion.tailDiagnostics.connected,maxInfluences:skin.maxUsed,skinSets:skin.sets,
    clips:clips.map(c=>c.name),detailMaps:textures.size,detailSlots,viewportSize,pixelRatio,renderPixels:[canvas.width,canvas.height],
    environment:{type:'PMREM RoomEnvironment',intensity:scene.environmentIntensity,toneMapping:'AgX'},
     quality:qualityGovernor.snapshot(),presence:presence.snapshot(),facialContinuity:facialContinuity.snapshot(),microMotion:microMotion.snapshot(),livingPerformance:{...livingPerformance.snapshot(),mode:lastLiving.mode,idle:lastLiving.idle,reaction:lastLiving.reaction},restPose:{...lastRestPose},contact:{...surfaceContact.snapshot(),supported:lastContact.supported},continuity:{...motionContinuity.snapshot(),mode:lastContinuity.mode},emotionalBody:{...emotionalBody.snapshot(),mood:lastEmotional.mood},characterPerformance:{...presentation},attention:{...lastAttention,attention:{...lastAttention.attention}},contextBlink:{...lastBlink,blink:lastBlink.blink?{...lastBlink.blink}:null},secondaryPose:secondaryPose.snapshot(),facialBlendRejected,handoff:{stage:stageHandoff.snapshot(),secondary:secondaryPose.snapshot()},lifeBridge:lifeBridges.snapshot(),spontaneousPlay:spontaneousPlay.snapshot(),betweenBeats:betweenBeats.snapshot(),intentCrossfade:intentCrossfade.snapshot(),
    framing:{rest:boundsRecord(restBox),envelope:boundsRecord(envelope),framed:boundsRecord(framed),scale:frameFit.scale,samples:frameSamples},
    occlusion:{supported:depthSupported,depth,visualSide:visualDepthSide(depth),worldZ:depthRoot.position.z,surfaceZ:0,protectedZ:depthPlan.protectedZ,surfaceRects:surfaceBatch.rectCount,protectedRects:protectedBatch.rectCount,maskDrawCalls:Number(surfaceBatch.mesh.visible)+Number(protectedBatch.mesh.visible)},
    render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,lines:renderer.info.render.lines,programs:renderer.info.programs.length,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries},
     weather:{umbrella:umbrella.visible,fade:umbrellaFade,radiusRatio:umbrellaRadius/characterHeight,
      canopyDepthRatio:canopyDepth/characterHeight,shaftRadiusRatio:umbrellaRadius*.043/characterHeight,
     anchoredToHand:umbrellaAnchored,gripErrorRatio:umbrellaGripError/characterHeight,
     crownClearanceRatio:umbrellaCrownClearance/characterHeight},
    swimWeight,expression:facial.expression,gesture:{name:lastGesture.name,age:lastGesture.progress*lastGesture.duration,phase:lastGesture.phase,envelope:lastGesture.envelope,lift:lastGesture.lift,contact:lastGesture.contact},affect:{name:lastAffect.name,phase:lastAffect.phase,envelope:lastAffect.envelope,weights:facial.diagnostics().expressionWeights},facialIntensity:facial.intensity,blink:facial.diagnostics(),shaderErrors:[...shaderErrors]};
  }
  function render(){
   if(disposed)return;renderer.render(scene,camera);updateContact();
   if(shaderErrors.length||renderer.info.programs.some(p=>p.diagnostics?.runnable===false))throw new Error('M shader contract failed.');
  }
  action.reset().play();action.setEffectiveWeight(0);action.paused=false;
  const update=(dt,state={})=>{
   if(disposed)return;dt=num(dt,0,.06);clock+=dt;
   const activity=typeof state.activity==='string'?state.activity:state.activity?.name||state.activity?.mode||state.mode||'float';
   const calm=['sleep','think'].includes(state.gesture?.name)||['perch','perched','rest','settle'].includes(activity)||['perch','rest'].includes(state.mode),reduced=Boolean(state.reducedMotion);
   const vx=Number(state.vx??state.velocity?.x)||0,vy=Number(state.vy??state.velocity?.y)||0;
   Object.assign(presentation,state.performance||{});
   // Manual performances have presentation priority, without creating experiences.
   if(state.gesture?.name==='sleep')presentation.intent='sleep';
   const physical=state.performance?presentation:null;
   lastAttention=attentionDirector.sample({dt,target:state.attention||state.gaze,targetId:state.attentionId,performance:physical,gestureActive:Boolean(state.gesture),reducedMotion:reduced});
   const dynamics=presence.sample({dt,vx,vy,attention:lastAttention.attention,nearCard:state.nearCard,calm,reducedMotion:reduced,performance:physical});
    const micro=microMotion.sample({dt,vx,vy,aboutToMove:state.phase==='approach'&&Math.hypot(vx,vy)<8,calm,reducedMotion:reduced,gestureActive:Boolean(state.gesture)});
   const target=reduced||calm?0:.8*dynamics.moving;swimWeight+=(target-swimWeight)*(1-Math.exp(-6*dt));if(swimWeight<1e-5)swimWeight=0;
   const mode=motionFor(state.mode||activity);
   lastGesture=sampleGesture({...state.gesture,reducedMotion:reduced});
   lastRestPose=sampleEmbodiedRest({...state.gesture,reducedMotion:reduced});
   lastAffect=sampleAffect({...state.affect,reducedMotion:reduced||Boolean(lastGesture.name)});
   lastLiving=livingPerformance.sample({dt,vx,vy,attention:dynamics.attention,
    phase:state.phase||'hold',mode:state.gesture?.name==='sleep'?'sleep':activity,
    gestureActive:Boolean(lastGesture.name)||Boolean(state.gesture),
    reducedMotion:reduced,reading:Boolean(state.reading),reaction:state.lifeMoment});
   // An actual card contact comes only from the screen-space route's verified
   // attachment. The overlay must never pretend the character has landed.
   lastContact=surfaceContact.sample({dt,attached:state.surfaceContact===true,
    mode:state.mode,phase:state.phase,reducedMotion:reduced,
    gestureActive:Boolean(lastGesture.name)||Boolean(state.gesture),
    reading:Boolean(state.reading),velocity:{x:vx,y:vy}});
   lastContinuity=motionContinuity.sample({dt,vx,vy,
    turn:state.locomotion?.turn||0,phase:state.phase,mode:activity,
    attached:lastContact.supported,reducedMotion:reduced,
    gestureActive:Boolean(lastGesture.name)||Boolean(state.gesture),
    reading:Boolean(state.reading)});
   // V40: one continuous physical mood, derived from the EXISTING facial
   // affect and character energy, not from chat messages or timers.
   lastEmotional=emotionalBody.sample({dt,affect:lastAffect,emotion:state.emotion,
    energy:state.characterEnergy,reading:Boolean(state.reading),
    reducedMotion:reduced,gestureActive:Boolean(lastGesture.name)||Boolean(state.gesture),
    sleeping:state.gesture?.name==='sleep',supported:lastContact.supported});
   lastBridge=lifeBridges.sample({dt,mode:activity,gesture:state.gesture,phase:state.phase,
    vx,vy,turn:state.locomotion?.turn,attention:dynamics.attention,
    emotion:state.emotion,affect:lastAffect,characterEnergy:state.characterEnergy,
    attached:lastContact.supported,reading:Boolean(state.reading),reducedMotion:reduced});
   // V50: authored micro-adventures between genuine actions; never override
   // sleep, the gesture director, actual card contact or reduced motion.
   lastPlay=spontaneousPlay.sample({dt,mode:activity,phase:state.phase||'hold',
    gesture:state.gesture,energy:state.characterEnergy,
    speed:Math.hypot(vx,vy),attached:lastContact.supported,
    attention:dynamics.attention,turn:state.locomotion?.turn||0,
    reading:Boolean(state.reading),reducedMotion:reduced,
    affectActive:lastAffect.envelope>.04});
   // V54: even between major actions M stays quietly attentive, without
   // interrupting authored gestures, play, resting or verified card contact.
   lastAmbient=betweenBeats.sample({dt,mode:activity,phase:state.phase||'hold',
    energy:state.characterEnergy,speed:Math.hypot(vx,vy),
    attention:dynamics.attention,turn:state.locomotion?.turn||0,
    gesture:state.gesture,attached:lastContact.supported,
    reading:Boolean(state.reading),miniActive:lastPlay.active,
    affectActive:lastAffect.envelope>.04,reducedMotion:reduced});
   // V55: the face, eyes, neck and tail must hand off between PLAY and
   // OBSERVE as one intention. The original V41 bone springs then preserve
   // velocity across interruptions, sleep and the next authored gesture.
   lastTransition=intentCrossfade.sample({dt,playState:lastPlay,ambientState:lastAmbient,
    gestureActive:Boolean(state.gesture)||Boolean(lastGesture.name),
    resting:calm||lastContact.supported||Boolean(state.reading),
    priorityAffect:lastAffect.envelope>.04,reducedMotion:reduced});
   lastPlay={...lastPlay,pose:lastTransition.playPose,stage:lastTransition.playStage};
   lastAmbient={...lastAmbient,pose:lastTransition.ambientPose};
   // Compose existing sources before filtering: their sum, not each individual
   // layer, stays within the original joints' secondary movement budget.
   secondaryTargets[0].pose=lastLiving.pose;secondaryTargets[1].pose=lastContact.pose;
   secondaryTargets[2].pose=lastContinuity.pose;secondaryTargets[3].pose=lastEmotional.pose;
   secondaryTargets[4].pose=lastBridge.pose;secondaryTargets[5].pose=lastPlay.pose;secondaryTargets[6].pose=lastAmbient.pose;
   const weatherMotion=weatherActorPose(state.weather,{reducedMotion:reduced,
     reading:Boolean(state.reading||physical?.reading),resting:calm||lastContact.supported,
     gesture:Boolean(state.gesture)||Boolean(lastGesture.name),
     sleeping:state.gesture?.name==='sleep'||physical?.intent==='sleep'});
    const quiet=physical?.reading||physical?.blocked;
   secondaryTargets[0].weight=quiet?.35:.65;secondaryTargets[1].weight=1;
   secondaryTargets[2].weight=1;secondaryTargets[3].weight=.65;secondaryTargets[4].weight=.6;
   secondaryTargets[5].weight=quiet?0:physical?.intent==='play'?1:.45;secondaryTargets[6].weight=quiet?.2:.55;
    secondaryTargets[7].pose=weatherMotion.pose;secondaryTargets[7].weight=.7;
   const combinedSecondary=secondaryPose.sample({dt,layers:secondaryTargets,reducedMotion:reduced});
   const expression=lastGesture.envelope>0?expressionFor(state.gesture?.expression??lastGesture.expression,state.mode||activity):expressionFor(state.emotion??state.mood,state.mode||activity);
   secondaryLayer.prepare();gestureLayer.prepare();locomotionLayer.prepare();motion.prepare();action.setEffectiveWeight(swimWeight);mixer.update(dt);
   motion.update(dt,{mode,expression,attention:dynamics.attention,energy:dynamics.energy,clipActive:swimWeight>1e-4,
    tailEnergy:dynamics.tailEnergy,tailReactivity:dynamics.tailReactivity,tailFlow:dynamics.tailFlow,tailPhase:dynamics.tailPhase,tailMood:dynamics.tailMood,
    performanceImpact:dynamics.performanceImpact,swimWeight,bodyMotion:dynamics.bodyMotion});
   locomotionLayer.apply(sampleLocomotionPose(state.locomotion||{},{reducedMotion:reduced}));
   gestureLayer.apply(lastGesture.pose);
   secondaryLayer.apply(combinedSecondary);
   source.position.copy(neutralSourcePosition);source.position.y+=lastGesture.lift*characterHeight;
   lastBlink=contextBlink.sample({dt,performance:physical,attention:lastAttention,gestureActive:Boolean(state.gesture)||Boolean(lastGesture.name),reducedMotion:reduced});
   facial.setGestureBlink(reduced?{left:0,right:0}:lastGesture.blink||lastBlink.blink,{relativeToRest:!reduced&&!lastGesture.blink});
   const microFace=!reduced&&!state.gesture&&lastAffect.envelope<.04?lastTransition.face:null;
   const facePriority=Boolean(lastGesture.name)||state.expressionPriority===true;
   const faceTarget=facialTargetMixer.sample({performance:physical,microFace,affect:lastAffect,gestureActive:facePriority,reducedMotion:reduced});
   const fade=facialContinuity.sample({dt,weights:faceTarget?.weights,eyelids:faceTarget?.eyelids,reducedMotion:reduced,gestureActive:facePriority});
   if(!facial.setExpressionBlend(fade?.weights||null)){facialBlendRejected++;facial.setExpressionBlend(null);}
   facial.setRestBlink(fade?.eyelids||null);
   facial.setExpression(expression);facial.update(reduced?2:dt,performance.now());
   const extra=performanceStagePoseV15({time:clock,mode,expression,impact:reduced?0:calm?.07:.4,reducedMotion:reduced});
   // V32: real lie-down + wake-up of the existing 31-bone M, with the
   // original curled limbs, eyelids, tail and breathing gesture intact.
   stage.rotation.x=num(extra.rx+micro.pitch,-.12,.12)+lastRestPose.rotationX+lastLiving.stage.rx+lastContact.stage.rx+lastContinuity.stage.rx+lastEmotional.stage.rx+lastBridge.stage.rx;
   stage.rotation.y=num(extra.ry,-.17,.17)+num(dynamics.bodyMotion.rotation.y*.2,-.05,.05)+dynamics.stageYaw+lastLiving.stage.ry+lastContact.stage.ry+lastContinuity.stage.ry+lastEmotional.stage.ry+lastBridge.stage.ry;
   stage.rotation.z=num(extra.rz+micro.roll,-.12,.12)+lastRestPose.rotationZ+lastLiving.stage.rz+lastContact.stage.rz+lastContinuity.stage.rz+lastEmotional.stage.rz+lastBridge.stage.rz;
   stage.position.x=num(extra.x*.22+lastRestPose.positionX+lastLiving.stage.x+lastContact.stage.x+lastContinuity.stage.x+lastEmotional.stage.x+lastBridge.stage.x,-.08,.08);
   stage.position.y=num(extra.y*.25+micro.lift+lastRestPose.positionY+lastLiving.stage.y+lastContact.stage.y+lastContinuity.stage.y+lastEmotional.stage.y+lastBridge.stage.y,-.17,.06);
   stage.scale.setScalar((1+num(extra.scale+micro.scale,-.03,.03)+lastLiving.stage.scale+lastContact.stage.scale+lastContinuity.stage.scale+lastEmotional.stage.scale+lastBridge.stage.scale)*lastRestPose.scale);
   // V50 stage punctuation is tiny, additive and goes through V41's final
   // stage handoff (never changes the real route, collision, X or depth).
   stage.rotation.x+=lastPlay.stage.rx;stage.rotation.y+=lastPlay.stage.ry;
   stage.rotation.z+=lastPlay.stage.rz+weatherMotion.stageRoll;stage.position.y+=lastPlay.stage.y;
   stage.scale.multiplyScalar(1+lastPlay.stage.scale);
   // The expressive stage had instant mode/expression targets even when its
   // bones were spring-filtered. Filter the FINAL stage position/rotation/scale
   // as one continuous pose (including V32 lying down and waking up).
   const stagePose=stageHandoff.sample({
    rotation:[stage.rotation.x,stage.rotation.y,stage.rotation.z],
    placement:[stage.position.x,stage.position.y,stage.scale.x-1]
   },dt,{immediate:reduced});
   const rotation=stagePose.rotation||[0,0,0],placement=stagePose.placement||[0,0,0];
   stage.rotation.set(...rotation);stage.position.x=placement[0];stage.position.y=placement[1];stage.scale.setScalar(1+placement[2]);
    const umbrellaTarget=weatherMotion.umbrella?1:0;
    if(dt===0)umbrellaFade=umbrellaTarget; // First static draw shows known rain.
    else umbrellaFade+=(umbrellaTarget-umbrellaFade)*(1-Math.exp(-6*dt));
    umbrella.visible=umbrellaFade>.035;
    canopyMaterial.opacity=.94*umbrellaFade;
    rimMaterial.opacity=.72*umbrellaFade;
    ribLines.material.opacity=.20*umbrellaFade;
    if(umbrella.visible&&umbrellaHand){
     // Follow the live posed left paw in container-local coordinates.
     // No IK constraints or changes to original bone transforms.
     umbrellaHand.getWorldPosition(handWorld);
     handLocal.copy(handWorld);container.worldToLocal(handLocal);
     // Keep the stem in front of the silhouette instead of disappearing
     // behind M's face, while still following the paw's screen position.
     handLocal.z=Math.max(handLocal.z+characterHeight*.08,
      restBox.max.z-center.z+characterHeight*.14);
     if(!umbrellaAnchored||dt===0){umbrella.position.copy(handLocal);umbrellaAnchored=true;}
     else umbrella.position.lerp(handLocal,1-Math.exp(-12*dt));
     umbrellaGripError=umbrella.position.distanceTo(handLocal);
     let crownY=characterHeight*.82;
     if(umbrellaHead){
      umbrellaHead.getWorldPosition(headWorld);
      headLocal.copy(headWorld);container.worldToLocal(headLocal);
      // The canopy rim clears the head even when she looks around.
      // Clamp shaft extension to avoid oversized swings while swimming.
      crownY=Math.min(characterHeight*.95,Math.max(characterHeight*.74,
       headLocal.y-umbrella.position.y+characterHeight*.18));
      umbrellaCrownClearance=umbrella.position.y+crownY-headLocal.y;
     }
     setUmbrellaCrownHeight(crownY);
    }
    const umbrellaRoll=-.12+weatherMotion.umbrellaTilt;
    umbrella.rotation.z+=(umbrellaRoll-umbrella.rotation.z)*(1-Math.exp(-3*dt));
   if(!reduced&&dt>0&&qualityGovernor.observe(dt*1000))syncResolution();
   render();
  };
  host.prepend(canvas);render();
  const metrics=getMetrics();onReady({...getDiagnostics(),footprint:metrics.footprint,contact:metrics.contact});
  return {canvas,update,render,setSpatialFrame,getMetrics,getInteractionPoint,getDiagnostics,dispose,ready:true,
   diagnostics:{bones:motion.tailDiagnostics.connected,rigBones:31,maxInfluences:skin.maxUsed,skinSets:skin.sets,clips:clips.map(c=>c.name),detailMaps:textures.size,detailSlots,viewportSize,pixelRatio,depthSupported}};
 }catch(error){dispose();throw error;}
}
