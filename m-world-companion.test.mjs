import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantEndpoint,validateAssistantReply} from './m-world-companion.mjs';
test('assistant accepts only explicit HTTPS or local development endpoints, without embedded credentials',()=>{
 assert.equal(assistantEndpoint(''),null);
 assert.equal(assistantEndpoint('https://m.example.workers.dev/api/m/respond'),'https://m.example.workers.dev/api/m/respond');
 assert.equal(assistantEndpoint('http://127.0.0.1:4184/api/m/respond'),'http://127.0.0.1:4184/api/m/respond');
 for(const bad of ['http://example.com/api/m/respond','javascript:alert(1)','https://user:secret@example.com/api/m/respond','https://example.com/api/m/respond?key=secret','https://example.com/v1/responses'])assert.equal(assistantEndpoint(bad),null,bad);
});
test('assistant validates bounded gestures and section hints instead of interpreting arbitrary actions',()=>{
 const good={reply:'Hello!',expression:'happy',gesture:'wave',section:'projects'};
 assert.deepEqual(validateAssistantReply(good),good);
 for(const patch of [{gesture:'eval'},{section:'https://evil.example'},{reply:'x'.repeat(701)},{expression:'angry'},{command:'run'}])assert.equal(validateAssistantReply({...good,...patch}),null);
 assert.equal(validateAssistantReply(null),null);
});
