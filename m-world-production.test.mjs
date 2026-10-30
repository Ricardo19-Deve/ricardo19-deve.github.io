import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const here=new URL('.',import.meta.url);
const page=readFileSync(new URL('index.html',here),'utf8');
const script=readFileSync(new URL('scroll-buddy.js',here),'utf8');
const css=readFileSync(new URL('m-world.css',here),'utf8');
const world=readFileSync(new URL('m-world-spatial.mjs',here),'utf8');

test('homepage loads exactly one M World script as module',()=>{
 assert.match(page,/type="module" src="scroll-buddy\.js\?v=18"/);
 assert.match(page,/href="m-world\.css\?v=18"/);
 assert.equal((page.match(/src="scroll-buddy\.js/g)||[]).length,1);
});
test('M runtime and geometry helper parse as JavaScript',()=>{
 assert.doesNotThrow(()=>new Function(script.replace(/^import .*;$/gm,'')));
 assert.doesNotThrow(()=>new Function(world.replace(/^export /gm,'')));
});
test('M passes behind real cards, has perches, and tracks scrolling targets',()=>{
 for(const snippet of ["chooseTarget(","visibleTargets(","placeAround(","exclusionPolygon(","behavior==='perch'",'mode==="perch"','mode==="peek"','mode==="orbit"']){
  assert.ok(script.includes(snippet),'Missing M world behavior: '+snippet);
 }
 assert.ok(script.includes('travelTarget.getBoundingClientRect()'));
});
test('M cannot steal navigation or project card clicks',()=>{
 assert.match(css,/\.mascot-world-v9 \.mascot-creature\{\s*pointer-events:none!important/);
 assert.match(script,/interactiveTarget\(event\.target\)/);
 assert.match(script,/insideMascot\(event\.clientX,event\.clientY/);
});
test('M can be paused, resumed and follows reduced-motion preference',()=>{
 assert.match(script,/setActive\(enabled,persist=true\)/);
 assert.match(script,/localStorage\.setItem\('m-world-enabled'/);
 assert.match(script,/prefers-reduced-motion: reduce/);
 assert.match(css,/\.m-world-toggle:focus-visible/);
 assert.match(css,/\.mascot-world-v9\[hidden\]/);
});
test('existing portfolio content still includes all six section anchors and links',()=>{
 for(const id of ['about','experience','projects','expertise','certifications','contact'])
  assert.ok(page.includes('id="'+id+'"'),'Missing '+id);
 assert.ok(page.includes('Ricardo-Pinheiro-Public-CV.pdf'));
 assert.ok(page.includes('interactions.js'));
});
