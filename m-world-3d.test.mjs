import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const base=new URL('./',import.meta.url);
const modelParts=Array.from({length:19},(_,i)=>new URL('assets/m-v6-web/part-'+String(i).padStart(2,'0')+'.bin',base));
const fullModel=Buffer.concat(modelParts.map(p=>readFileSync(p)));

test('the real original Blender V6 GLB is hosted in 19 ordered binary chunks',()=>{
 assert.equal(modelParts.length,19);
 assert.equal(fullModel.byteLength,16899868);
 assert.equal(fullModel.toString('ascii',0,4),'glTF');
 assert.equal(fullModel.readUInt32LE(4),2);
 assert.equal(fullModel.readUInt32LE(8),fullModel.byteLength);
 assert.equal(statSync(modelParts[0]).size,900000);
 assert.equal(statSync(modelParts[18]).size,699868);
});
test('optimized V6 retains its real animations, skin, facial morph targets and ten tail bones',()=>{
 const jsonLength=fullModel.readUInt32LE(12);
 const data=JSON.parse(fullModel.subarray(20,20+jsonLength).toString('utf8'));
 assert.equal(data.animations.length,6);
 assert.ok(data.animations.some(a=>a.name==='M_Swim_V4'));
 assert.ok(data.animations.some(a=>a.name==='M_LeftBlink_V4'));
 assert.ok(data.animations.some(a=>a.name==='M_Expression_Happy_V1'));
 assert.equal(data.skins.length,1);
 assert.equal(data.meshes.length,11);
 assert.ok(data.meshes[0].primitives[0].targets.length>=5);
 const names=data.nodes.map(n=>n.name||'');
 for(let i=1;i<=10;i++)assert.ok(names.includes('Tail.'+String(i).padStart(2,'0')),'tail joint '+i);
});
test('V6 texture buffer views remain in bounds after web optimization',()=>{
 const len=fullModel.readUInt32LE(12),start=20+len;
 const binLength=fullModel.readUInt32LE(start);
 const j=JSON.parse(fullModel.subarray(20,20+len).toString('utf8'));
 assert.equal(j.images.length,19);
 assert.equal(j.buffers[0].byteLength,binLength);
 for(const view of j.bufferViews)
  assert.ok((view.byteOffset||0)+view.byteLength<=binLength);
 for(const image of j.images)
  assert.ok(['image/png','image/jpeg'].includes(image.mimeType));
});
test('main portfolio loads V6 canvas rather than deliberately replacing it with SVG',()=>{
 const main=readFileSync(new URL('scroll-buddy.js',base),'utf8');
 const three=readFileSync(new URL('m-world-3d.mjs',base),'utf8');
 const css=readFileSync(new URL('m-world.css',base),'utf8');
 assert.match(main,/loadRealMascot\(\)/);
 assert.match(main,/import\('\.\/m-world-3d\.mjs\?v=20'\)/);
 assert.match(main,/if\(m3d\)m3d\.update\(dt/);
 assert.match(css,/\.m-world-3d \.mascot-creature svg/);
 assert.match(three,/mountMWorld3D/);
 assert.match(three,/preserveFullSkinning/);
 assert.match(three,/createFacialV6/);
 assert.match(three,/createMotionV8/);
 assert.match(three,/PART_COUNT=19/);
 assert.doesNotThrow(()=>new Function(three.replace(/^import .*;$/gm,'').replace(/^export /gm,'')));
});

test('high fidelity facial and body maps are hosted from original V6 textures',()=>{
 const assets=[0,1,2,3,4,6,8,9,11,12];
 for(const id of assets){
  const ext=[3,8,11].includes(id)?'webp':[0,1,2].includes(id)?'jpg':'png';
  const file=new URL('assets/m-v6-detail/m-original-'+id+'.'+ext,base);
  const raw=readFileSync(file);
  assert.ok(raw.byteLength>12000,id+' detail map missing or corrupt');
  if(ext==='png')assert.equal(raw.subarray(1,4).toString(),'PNG');
  if(ext==='jpg')assert.equal(raw[0],0xff);
 }
 const renderer=readFileSync(new URL('m-world-3d.mjs',base),'utf8');
 assert.ok(renderer.includes('tex.flipY=false'));
 assert.ok(renderer.includes('detailMaps'));
 assert.ok(renderer.includes('renderer.setPixelRatio(pixelRatio)'));
});
