import test from 'node:test';
import assert from 'node:assert/strict';
import { createDirectorSchema, directorRest, validateDirectorInput, validateDirectorReply } from './m-world-director-protocol.mjs';

const input = () => ({ snapshot: {
  revision: 'view-1', section: 'projects', language: 'en', event: 'arrival', attentionId: 'project-bloom',
  targets: [{ id: 'project-bloom', kind: 'project', title: 'Magnet Bloom', actions: ['peek', 'perch'], zone: 'middle-right' }],
  recent: [{ targetId: 'portrait-old', action: 'inspect' }]
} });
const reply = () => ({ snapshot: 'view-1', targetId: 'project-bloom', action: 'peek', gesture: 'playful', expression: 'happy' });

test('director protocol accepts only bounded public component snapshots and safe rest', () => {
  assert.equal(validateDirectorInput(input()), true);
  assert.equal(validateDirectorReply(reply(), input()), true);
  assert.equal(validateDirectorReply(reply(), input().snapshot), true);
  assert.equal(validateDirectorReply(directorRest(input()), input()), true);
  const empty = input(); empty.snapshot.targets = []; empty.snapshot.attentionId = null;
  assert.equal(validateDirectorInput(empty), true);
  assert.equal(validateDirectorReply(directorRest(empty), empty), true);
});

test('director protocol rejects DOM, private content, selectors, coordinates and unknown fields', () => {
  for (const change of [
    x => { x.message = 'private'; },
    x => { x.snapshot.form = 'private'; },
    x => { x.snapshot.targets[0].selector = '#target'; },
    x => { x.snapshot.targets[0].rect = { x: 0.1, y: 0.2 }; },
    x => { x.snapshot.targets[0].id = '#project'; },
    x => { x.snapshot.targets[0].title = 'x'.repeat(81); },
    x => { x.snapshot.targets[0].title = 'Line\nBreak'; },
    x => { x.snapshot.targets[0].kind = 'input'; },
    x => { x.snapshot.targets[0].zone = 'outside'; },
    x => { x.snapshot.targets[0].actions = ['navigate']; },
    x => { x.snapshot.targets[0].actions = ['peek', 'peek']; },
    x => { x.snapshot.attentionId = 'unknown'; },
    x => { x.snapshot.event = 'keypress'; },
    x => { x.snapshot.language = 'fr'; },
    x => { x.snapshot.revision = 'a'.repeat(65); },
    x => { x.snapshot.recent = Array(7).fill({ targetId: null, action: 'rest' }); },
    x => { x.snapshot.recent = [{ targetId: null, action: 'peek' }]; }
  ]) {
    const value = input(); change(value); assert.equal(validateDirectorInput(value), false, JSON.stringify(value));
  }
});

test('director target count and uniqueness are checked before any provider call', () => {
  const duplicate = input(); duplicate.snapshot.targets.push({ ...duplicate.snapshot.targets[0] });
  assert.equal(validateDirectorInput(duplicate), false);
  const many = input(); many.snapshot.targets = Array.from({ length: 9 }, (_, index) => ({ ...many.snapshot.targets[0], id: 'target-' + index })); many.snapshot.attentionId = null;
  assert.equal(validateDirectorInput(many), false);
  many.snapshot.targets.pop(); assert.equal(validateDirectorInput(many), true);
});

test('director replies reject stale snapshots, unknown targets, unoffered actions and extra fields', () => {
  for (const change of [
    x => { x.snapshot = 'old-view'; },
    x => { x.targetId = 'unknown'; },
    x => { x.action = 'orbit'; },
    x => { x.targetId = null; },
    x => { x.gesture = 'execute'; },
    x => { x.expression = 'angry'; },
    x => { x.url = 'https://example.invalid'; },
    x => { x.x = 0.5; }
  ]) {
    const value = reply(); change(value); assert.equal(validateDirectorReply(value, input()), false);
  }
});

test('all new animation gestures remain bounded director suggestions', () => {
  for (const gesture of ['none', 'wave', 'curious', 'surprised', 'shy', 'playful', 'wink', 'nod']) {
    assert.equal(validateDirectorReply({ ...reply(), gesture }, input()), true);
  }
});

test('strict director schema narrows revision, targets and actions to the current snapshot', () => {
  const schema = createDirectorSchema(input());
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ['snapshot', 'targetId', 'action', 'gesture', 'expression']);
  assert.deepEqual(schema.properties.snapshot.enum, ['view-1']);
  assert.deepEqual(schema.properties.targetId.enum, ['project-bloom', null]);
  assert.deepEqual(schema.properties.action.enum, ['peek', 'perch', 'rest']);
  assert.throws(() => createDirectorSchema({}), TypeError);
});