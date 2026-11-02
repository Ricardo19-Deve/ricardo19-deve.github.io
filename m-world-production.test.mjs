import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const here=new URL('.',import.meta.url);
const page=readFileSync(new URL('index.html',here),'utf8');
const canonicalHTML=page.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')
 .replace(/(scroll-buddy\.js|m-world\.css|styles\.css|interactions\.js)(?:\?v=\d+)?/g,(_,name)=>name+'?v=*');

test('M integration preserves the complete portfolio content, links, navigation and design markup',()=>{
 assert.equal(createHash('sha256').update(canonicalHTML).digest('hex'),
  'efbb8fa05161026e2cb3ba5934ed6dcdd41c576d125439ef035d5db50927980d');
});

const bytes=Buffer.concat(Array.from({length:19},(_,i)=>
 readFileSync(new URL('assets/m-v6-web/part-'+String(i).padStart(2,'0')+'.bin',here))));
const document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8').trim());

test('the public actor remains the verified original V6 geometry/rig/animation asset',()=>{
 assert.equal(bytes.subarray(0,4).toString(),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.length,16899868);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),
  'a7eb2004bc4f2b3dd33393a3fd655bb3b821c35ddc6a2ae053c3a9b0dbd69b29');
 assert.equal(document.skins[0].joints.length,31);
 assert.deepEqual(document.animations.map(a=>a.name),[
  'M_Swim_V4','M_LeftBlink_V4','M_RightBlink_V1',
  'M_Expression_Happy_V1','M_Expression_Curious_V1','M_Expression_Surprised_V1'
 ]);
});

test('the intentionally disabled right socket normal and full body influences remain intact',()=>{
 const material=document.materials.find(m=>m.name==='M_R_UnifiedSkin_PBR_Source_V5_V6');
 assert.ok(material);
 assert.equal(material.normalTexture.scale,0);
 const node=document.nodes.find(n=>n.name==='M_BODY_EyeModule_V4');
 const primitive=document.meshes[node.mesh].primitives[0];
 for(let i=0;i<4;i++){
  assert.ok(Number.isInteger(primitive.attributes['JOINTS_'+i]));
  assert.ok(Number.isInteger(primitive.attributes['WEIGHTS_'+i]));
 }
 assert.ok(document.extras.M_facial_layers_v1);
});
test('the M entry point and every first-party runtime import share one cache revision',()=>{
 const revision=page.match(/scroll-buddy\.js\?v=(\d+)/)?.[1];
 assert.ok(revision,'The entry point needs an explicit cache revision.');
 assert.ok(page.includes('m-world.css?v='+revision+'"'),'The M stylesheet must advance with the runtime.');
 const imports=new Set();
 for(const file of ['scroll-buddy.js','m-world-3d.mjs','m-world-companion.mjs','m-world-spatial.mjs','m-world-action-policy.mjs','m-world-acting.mjs','m-world-brain.mjs','m-world-observer.mjs','m-world-director.mjs','m-world-director-protocol.mjs','m-world-locomotion.mjs','m-world-affect.mjs','m-world-context.mjs','m-world-scenes.mjs','m-world-memory.mjs']){
  const source=readFileSync(new URL(file,here),'utf8');
  for(const match of source.matchAll(/(['"])\.\/(m-world-[a-z0-9-]+\.mjs)([^'"]*)\1/g)){
   assert.equal(match[3],'?v='+revision,file+' imports a stale or unversioned '+match[2]);
   imports.add(match[2]);
  }
 }
 for(const file of ['m-world-3d.mjs','m-world-companion.mjs','m-world-spatial.mjs','m-world-action-policy.mjs','m-world-acting.mjs','m-world-brain.mjs','m-world-config.mjs','m-world-observer.mjs','m-world-director.mjs','m-world-director-protocol.mjs','m-world-locomotion.mjs','m-world-affect.mjs','m-world-context.mjs','m-world-scenes.mjs','m-world-memory.mjs'])
  assert.ok(imports.has(file),'Missing verified import: '+file);
});