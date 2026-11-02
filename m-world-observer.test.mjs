import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldObserver} from './m-world-observer.mjs';
import {validateDirectorInput} from './m-world-director-protocol.mjs';
const record={id:'surface-1',kind:'project',title:'Public project',zone:'middle-center',actions:['peek','inspect']};
test('observer emits only a bounded public summary, without DOM, form, chat or geometry data',()=>{
 const observer=createWorldObserver({getComponents:()=>Array.from({length:12},(_,index)=>({...record,id:'surface-'+index,title:'  Public\nheading  '+'a'.repeat(90),actions:['peek','peek','navigate','inspect'],body:'PRIVATE',form:'SECRET',chat:'DRAFT',element:{value:'SECRET'},left:123}))});
 const snapshot=observer.capture({revision:'world-1',section:'projects',language:'en',event:'arrival',attentionId:'surface-2',recent:[{targetId:'surface-1',action:'peek',private:'SECRET'}]});
 assert.equal(validateDirectorInput({snapshot}),true);assert.equal(snapshot.targets.length,8);assert.equal(snapshot.targets[0].title.length,80);
 assert.deepEqual(snapshot.targets[0].actions,['peek','inspect']);assert.deepEqual(Object.keys(snapshot.targets[0]),['id','kind','title','actions','zone']);
 assert.deepEqual(snapshot.recent,[{targetId:'surface-1',action:'peek'}]);assert.equal(JSON.stringify(snapshot).includes('SECRET'),false);
});
test('observer rejects unknown component types and only retains offered feasible actions',()=>{
 const records=[record,{...record,id:'surface-1'}, {...record,id:'unknown',kind:'input'}, {...record,id:'invalid id'}, {...record,id:'bad-zone',zone:'left'}, {...record,id:'no-action',actions:['navigate']}];
 const observer=createWorldObserver({getComponents:()=>records});
 const snapshot=observer.capture({revision:'world-1',section:'unknown',event:'click-anywhere',language:'de',attentionId:'invisible',recent:[{targetId:null,action:'peek'},...Array.from({length:9},(_,n)=>({targetId:'old-'+n,action:'inspect'}))]});
 assert.equal(snapshot.targets.length,1);assert.equal(snapshot.attentionId,null);assert.equal(snapshot.section,'none');assert.equal(snapshot.event,'idle');assert.equal(snapshot.language,'en');assert.equal(snapshot.recent.length,6);assert.equal(snapshot.recent[0].targetId,'old-3');
 assert.equal(observer.capture({revision:'unsafe revision'}),null);observer.dispose();assert.equal(observer.capture({revision:'world-2'}),null);
});
test('observer tolerates unavailable component records and owns no DOM scanning',()=>{
 assert.equal(createWorldObserver({getComponents:()=>{throw new Error('Layout updating');}}).capture({revision:'world-1'}),null);
 assert.equal(createWorldObserver({getComponents:()=>null}).capture({revision:'world-1'}),null);
 assert.deepEqual(createWorldObserver().capture({revision:'world-1'}).targets,[]);
});