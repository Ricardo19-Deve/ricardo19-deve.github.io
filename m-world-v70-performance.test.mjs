import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readGLB} from './m-lab/swim-v3/threejs/glb-reader.js';
import {frameIntervalMs,isOffscreen,M_FRAME_INTERVALS} from './m-world-quality.mjs';

const here=new URL('.',import.meta.url);
const renderer=readFileSync(new URL('m-world-3d.mjs',here),'utf8');
const controller=readFileSync(new URL('scroll-buddy.js',here),'utf8');
const mobile=readFileSync(new URL('assets/m-v7-web/m-mobile.bin',here));
const mobileJson=JSON.parse(mobile.subarray(20,20+mobile.readUInt32LE(12)).toString('utf8').trim());

test('V70 phone model: same rig, clips and morphs; lighter body; four influences; compressed',()=>{
 assert.equal(mobile.subarray(0,4).toString(),'glTF');
 assert.equal(mobile.readUInt32LE(8),mobile.length);
 assert.equal(Number(renderer.match(/M_MOBILE_MODEL=Object\.freeze\(\{path:'\.\/assets\/m-v7-web\/m-mobile\.bin',size:(\d+)\}\)/)?.[1]),mobile.length,
  'The loader expects the exact size of the committed phone model.');
 assert.ok(mobileJson.extensionsRequired.includes('EXT_meshopt_compression'));
 assert.ok(mobileJson.extensionsRequired.includes('KHR_mesh_quantization'));
 assert.equal(mobileJson.skins[0].joints.length,31);
 assert.deepEqual(mobileJson.animations.map(a=>a.name),[
  'M_Swim_V4','M_LeftBlink_V4','M_RightBlink_V1','M_Expression_Happy_V1','M_Expression_Curious_V1','M_Expression_Surprised_V1']);
 const body=mobileJson.meshes.find(m=>m.name==='M_Body_BilateralEyes_V6').primitives[0];
 assert.ok(body.targets.length>=5,'Body morph targets (incl. the shoulder corrective) are kept');
 const triangles=mobileJson.accessors[body.indices].count/3;
 assert.ok(triangles>=110084*.25&&triangles<=110084*.4,'Body simplified to 25-40% of the original 110,084 triangles: '+triangles);
 for(const mesh of mobileJson.meshes)for(const primitive of mesh.primitives){
  assert.ok(Number.isInteger(primitive.attributes.JOINTS_0));
  assert.equal(primitive.attributes.JOINTS_1,undefined,'At most four influences per vertex on phones');
 }
 assert.equal(mobileJson.meshes.length,11,'Eyes, lids and lashes stay');
});

test('V70 loader: phones load the light model, desktop keeps the original 14-influence parts',()=>{
 assert.match(renderer,/PART_COUNT=19/);
 assert.match(renderer,/return matches\('\(max-width:720px\)'\)\?'mobile':'desktop';/);
 assert.match(renderer,/variant==='mobile'\?await downloadMobileGLB\(onProgress\):await downloadGLB\(onProgress\)/);
 assert.match(renderer,/gltfLoader\.setMeshoptDecoder\(MeshoptDecoder\)/);
 assert.match(renderer,/readGLB\(raw,\{meshopt:MeshoptDecoder\}\)/);
 assert.match(renderer,/variant==='mobile'\?skin\.maxUsed<=4&&skin\.sets===1:skin\.maxUsed===14&&skin\.sets===4/,
  'Desktop still refuses a four-influence fallback; only the phone model may use four.');
 assert.match(renderer,/modelVariant:variant/);
});

test('V70 phones cap the pixel ratio at 1.75x (1.5x when slow); desktop keeps 2-2.5x',()=>{
 assert.match(renderer,/ceiling=mobile\?Math\.min\(Math\.max\(window\.devicePixelRatio\|\|1,1\),1\.75\):Math\.max\(2,Math\.min\(window\.devicePixelRatio\|\|1,2\.5\)\)/);
 // 1.5x floor on phones keeps the 312px canvas above the 400px backing the real-render smoke requires.
 assert.match(renderer,/minRatio:1\.5,device:/);
});

test('V70 frame pacing: 60 fps cap, 30 when calm, 20 off screen, full rate while scrolling',()=>{
 assert.equal(frameIntervalMs(),1000/60);
 assert.equal(frameIntervalMs({sleeping:true}),1000/30);
 assert.equal(frameIntervalMs({resting:true}),1000/30);
 assert.equal(frameIntervalMs({resting:true,scrolling:true}),1000/60,'A perched M follows a scrolling card at full rate');
 assert.equal(frameIntervalMs({offscreen:true,sleeping:true}),1000/20);
 assert.ok(M_FRAME_INTERVALS.offscreen<=50,'Never slower than the controller step, so M\'s clock keeps time');
 assert.equal(isOffscreen({left:10,top:10,right:200,bottom:200},{width:390,height:844}),false);
 assert.equal(isOffscreen({left:-300,top:10,right:-1,bottom:200},{width:390,height:844}),true);
 assert.equal(isOffscreen({left:10,top:900,right:200,bottom:1100},{width:390,height:844}),true);
 assert.equal(isOffscreen(null,{width:390,height:844}),false);
 assert.match(controller,/if\(!reducedMotion&&lastFrame&&now-lastFrame<paceInterval\(now\)-2\)\{schedule\(\);return;\}/,
  'Reduced motion keeps its on-demand static frames');
});

test('V70 GLB reader decodes EXT_meshopt_compression views with the supplied decoder',()=>{
 // A minimal GLB: one VEC4 float accessor in a "compressed" view (the fake decoder writes known values).
 const json={asset:{version:'2.0'},buffers:[{byteLength:8}],
  bufferViews:[{buffer:0,byteLength:32,byteStride:16,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:0,byteLength:8,byteStride:16,count:2,mode:'ATTRIBUTES'}}}],
  accessors:[{bufferView:0,componentType:5126,count:2,type:'VEC4'}]};
 const text=Buffer.from(JSON.stringify(json));const jsonChunk=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)]);
 const bin=Buffer.alloc(8);
 const glb=Buffer.concat([Buffer.from([0x67,0x6c,0x54,0x46,2,0,0,0,0,0,0,0]),
  Buffer.from(new Uint32Array([jsonChunk.length,0x4e4f534a]).buffer),jsonChunk,Buffer.from(new Uint32Array([8,0x004e4942]).buffer),bin]);
 glb.writeUInt32LE(glb.length,8);
 const calls=[];
 const decoder={decodeGltfBuffer(target,count,size,source,mode,filter){
  calls.push({count,size,mode,filter,sourceLength:source.length});
  new Float32Array(target.buffer).set([.5,.25,.25,0,1,0,0,0]);
 }};
 const reader=readGLB(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.length),{meshopt:decoder});
 assert.deepEqual([...reader.accessor(0).array],[.5,.25,.25,0,1,0,0,0]);
 reader.accessor(0);
 assert.deepEqual(calls,[{count:2,size:16,mode:'ATTRIBUTES',filter:'NONE',sourceLength:8}],'Each view is decoded once');
 assert.throws(()=>readGLB(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.length)).accessor(0),/meshopt decoder is required/);
});
