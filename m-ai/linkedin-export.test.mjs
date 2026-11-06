import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,exportReview} from './linkedin-export.mjs';
import {validatePublicActivity} from './public-activity.mjs';

test('V43 LinkedIn owner export parses quoted line breaks and escaped double quotes',()=>{
 const csv='Date,ShareCommentary,Visibility,Permalink\n'+
  '2026-11-03,"I wrote about ""systems""\nand leadership",Public,https://www.linkedin.com/posts/ricardoappinheiro_systems-activity-7380000012345678900-ABc\n';
 const rows=parseCsv(csv);
 assert.equal(rows.length,1);
 assert.equal(rows[0].sharecommentary,'I wrote about "systems"\nand leadership');
 const data=exportReview(csv,{today:'2026-11-06'});
 assert.equal(data.draft.posts.length,1);
 assert.equal(data.draft.posts[0].visibility,'public');
 assert.equal(data.requiresReview,false);
 assert.equal(validatePublicActivity(data.draft).status,'ready');
});

test('V43 unknown visibility never automatically becomes public',()=>{
 const csv='Date,Content\n2026-11-04,"An owner-only note that requires review"\n';
 const data=exportReview(csv,{today:'2026-11-06'});
 assert.equal(data.draft.posts[0].visibility,'review');
 assert.equal(data.requiresReview,true);
 assert.equal(validatePublicActivity(data.draft).status,'invalid');
});

test('V43 no LinkedIn account access, only explicit CSV columns',()=>{
 const rows=exportReview('Date,Content,Email,Password,Visibility\n2026-11-04,Public discussion,secret@example.com,supersecret,Public\n',{today:'2026-11-06'});
 const exported=JSON.stringify(rows.draft);
 assert.ok(!exported.includes('secret@example.com'));
 assert.ok(!exported.includes('supersecret'));
 assert.equal(rows.draft.posts.length,1);
});
