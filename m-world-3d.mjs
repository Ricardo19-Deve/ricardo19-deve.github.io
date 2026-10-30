/**
 * M World V18 · Actual Blender V6 model in the public portfolio.
 * Reassembles the optimized, losslessly preserved GLB binary from individual
 * static GitHub Pages chunks. No external model, invented mesh or server API.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readGLB} from './m-lab/swim-v3/threejs/glb-reader.js';
import {preserveFullSkinning} from './m-lab/swim-v3/threejs/full-skinning.js';
import {createFacialV6} from './m-lab/interactions/facial-v6.mjs';
import {createMotionV8} from './m-lab/interactions/motion-v8.mjs?rig=v16';
import {performanceStagePoseV15} from './m-lab/interactions/performance-v15.mjs?v16';

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
const expressionFor=(mood,mode)=>{
 if(mode==='peek'||mode==='curious')return 'curious';
 if(mode==='play'||mode==='orbit'||mode==='surf'||mode==='swim')return 'happy';
 if(mood==='excited'||mood==='happy')return 'happy';
 if(mood==='curious'||mood==='peek')return 'curious';
 if(mood==='surprised')return 'surprised';
 return 'neutral';
};
const motionFor=(mode)=>({
 peek:'peek',perch:'float',orbit:'swim',surf:'swim',dash:'swim',
 play:'follow',spin:'swim',curl:'shy',shy:'shy',curious:'curious',
 float:'float',glide:'swim',swim:'swim',rest:'float'
}[mode]||'float');

export async function mountMWorld3D(host,{onProgress=()=>{},onReady=()=>{}}={}){
 if(!window.WebGLRenderingContext)throw new Error('WebGL indisponível');
 const raw=await downloadGLB(onProgress);
 const gltf=await new Promise((resolve,reject)=>
  new GLTFLoader().parse(raw,'',resolve,reject));
 const source=gltf.scene;
 const rawInfo=readGLB(raw);
 let skin={};
 try {skin=preserveFullSkinning(gltf,rawInfo);}
 catch(error){console.warn('[M 3D] Full skinning fallback:',error);}
 const canvas=document.createElement('canvas');
 canvas.className='m-world-canvas';
 canvas.setAttribute('aria-hidden','true');
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);
 // Render a genuinely sharp 3D portrait, not a tiny 180px texture stretched
 // by browser compositing. DPR is capped by device class to protect mobile.
 let viewportSize=0,pixelRatio=0;
 const syncResolution=()=>{
  const mobile=window.matchMedia('(max-width:720px)').matches;
  const nextSize=mobile?232:272;
  const nextRatio=Math.min(window.devicePixelRatio||1,mobile?2:2.5);
  if(viewportSize===nextSize&&pixelRatio===nextRatio)return;
  viewportSize=nextSize;pixelRatio=nextRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(viewportSize,viewportSize,false);
 };
 syncResolution();
 window.addEventListener('resize',syncResolution,{passive:true});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=0.98;
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xfff6ff,0x71718e,1.55));
 const key=new THREE.DirectionalLight(0xfff7f9,2.2);key.position.set(-4,7,9);scene.add(key);
 const rim=new THREE.DirectionalLight(0xab9bff,.8);rim.position.set(5,3,-5);scene.add(rim);
 const camera=new THREE.PerspectiveCamera(31,1,.03,100);
 camera.position.set(0,.05,3.35);camera.lookAt(0,0,0);
 const stage=new THREE.Group();scene.add(stage);
 const container=new THREE.Group();stage.add(container);container.add(source);
 source.updateMatrixWorld(true);
 const bbox=new THREE.Box3().setFromObject(source);
 const center=bbox.getCenter(new THREE.Vector3()),size=bbox.getSize(new THREE.Vector3());
 source.position.sub(center);
 const modelScale=2.22/Math.max(size.x,size.y,size.z);
 container.scale.setScalar(modelScale);
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
  textures.set(id,tex);
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
 const clips=gltf.animations||[];
 const mixer=new THREE.AnimationMixer(source);
 const swim=clips.find(c=>c.name==='M_Swim_V4');
 const action=swim?mixer.clipAction(swim):null;
 if(action){action.play();action.setEffectiveWeight(.48);}
 const motion=createMotionV8(source,THREE);
 const facial=createFacialV6(source,clips);
 facial.setIntensity(1.65);
 if(motion.tailDiagnostics.connected!==10)console.warn('[M 3D] Tail bones:',motion.tailDiagnostics);
 let clock=0;
 host.prepend(canvas);
 onReady({bones:motion.tailDiagnostics.connected,clips:clips.length,skinSets:skin.sets||0,detailMaps,detailSlots,
  renderPixels:[renderer.domElement.width,renderer.domElement.height],
  viewportSize,pixelRatio});
 let disposed=false;
 const update=(dt,state={})=>{
  if(disposed)return;
  dt=num(dt,0,.06);clock+=dt;
  const mode=motionFor(state.mode||'float');
  const expression=expressionFor(state.emotion||state.mood||'neutral',state.mode||'float');
  motion.prepare();
  mixer.update(dt);
  motion.update(dt,{
   mode,expression,energy:.84,clipActive:Boolean(action),tailEnergy:.94,
   tailReactivity:1.75,tailFlow:.83,performanceImpact:1.15,
   swimWeight:action?.getEffectiveWeight()||0,
   bodyMotion:{rotation:{y:num((state.vx||0)*.001,-.4,.4),
    z:num((state.vy||0)*.001,-.4,.4)},velocity:{
     x:num((state.vx||0)*.002,-.5,.5),y:num((state.vy||0)*.002,-.5,.5)}}
  });
  facial.setExpression(expression);
  facial.update(dt,performance.now());
  const extra=performanceStagePoseV15({time:clock,mode,expression,impact:.48,
   reducedMotion:state.reducedMotion||false});
  stage.rotation.z=num(extra.rz,-.14,.14);
  stage.rotation.y=num(extra.ry,-.2,.2)+num((state.vx||0)*.00035,-.11,.11);
  stage.rotation.x=num(extra.rx,-.15,.15);
  stage.position.y=extra.y*.35;
  stage.position.x=extra.x*.3;
  stage.scale.setScalar(1+num(extra.scale,-.07,.07));
  renderer.render(scene,camera);
 };
 const dispose=()=>{
  if(disposed)return;disposed=true;
  window.removeEventListener('resize',syncResolution);
  renderer.dispose();
  for(const tex of textures.values())tex.dispose();
  scene.traverse(o=>{
   if(o.geometry?.dispose)o.geometry.dispose();
   for(const material of Array.isArray(o.material)?o.material:(o.material?[o.material]:[]))material.dispose();
  });
  canvas.remove();
 };
 return {canvas,update,dispose,diagnostics:{bones:motion.tailDiagnostics.connected,
  clips:clips.map(c=>c.name),skinSets:skin.sets||0,detailMaps,detailSlots,viewportSize,pixelRatio},ready:true};
}
