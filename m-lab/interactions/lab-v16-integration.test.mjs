import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const core=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];

test('lab browser module parses with all its static ES module imports removed',()=>{
 assert.ok(core,'Missing browser JS module');
 const withoutImports=core.replace(/^import .*;$/gm,'');
 assert.doesNotThrow(()=>new Function(withoutImports));
});

test('all JavaScript-referenced UI IDs are declared in the HTML',()=>{
 assert.ok(core);
 const ids=[...core.matchAll(/\$\('([a-zA-Z][a-zA-Z0-9]*)'\)/g)].map(x=>x[1]);
 const missing=[...new Set(ids)].filter(id=>!page.includes('id="'+id+'"'));
 assert.deepEqual(missing,[]);
});

test('M V16 local intelligence is wired into real motion and interaction events',()=>{
 assert.match(page,/M \/ INTERACTION LAB V16/);
 for(const snippet of [
  'new MLifeV16(', 'life.step(dt,','attention:lifeState.gaze',
  "life.signal('pointer'", "life.signal('tap')",
  'life.manual()', "id=\"autoLife\"", "id=\"lifePersonality\"",
  "id=\"lifeHello\"", "id=\"lifeMood\""
 ])assert.ok(page.includes(snippet),'Missing V16 integration: '+snippet);
});

test('manual face pin, demo and reduced motion override autonomous behavior',()=>{
 assert.match(page,/manualFace:faceManual/);
 assert.match(page,/demo:director\.demo/);
 assert.match(page,/reducedMotion:\$\('reduce'\)\.checked/);
 assert.match(page,/if\(!faceManual&&lifeState\.action\.expression\)/);
});

test('V16 brain module has no remote network or persistent user data primitives',()=>{
 const brain=readFileSync(new URL('./life-v16.mjs',import.meta.url),'utf8');
 for(const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage',
  'sessionStorage', 'navigator.sendBeacon', 'import('])
  assert.ok(!brain.includes(forbidden),'Unexpected browser capability: '+forbidden);
});
