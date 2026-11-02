import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, Script } from 'node:vm';

// Exercise the real private controller function without a browser, renderer,
// network, or a copied implementation. Its two effect callbacks are observed.
const controller = readFileSync(new URL('./scroll-buddy.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const start = controller.indexOf('function updateDirectorActivity(now){');
const end = controller.indexOf('\n function updateDirector(', start);
assert.ok(start >= 0 && end > start, 'The controller activity function must remain available for regression coverage');
const activityScript = new Script('(' + controller.slice(start, end).trim() + ')', { filename: 'scroll-buddy.js:updateDirectorActivity' });
const copy = value => JSON.parse(JSON.stringify(value));

function fixture({ route = null, completedRouteId = null, blocked = {}, started = 1000 } = {}) {
  const calls = { queued: [], remembered: [] };
  const decision = { snapshot: 'scene-7', targetId: 'surface-project', action: 'peek', gesture: 'wink', expression: 'happy', routeId: 41, started };
  const context = createContext({
    directorActivity: copy(decision),
    directorCompletedRouteId: completedRouteId,
    directorLastExecution: { ...copy(decision), at: 9, status: 'travelling' },
    state: { clock: 12, emotionUntil: Infinity },
    route,
    directorBlocked: () => ({ ...blocked }),
    queueIntent(intent) { calls.queued.push(copy(intent)); return true; },
    rememberDirector(value) { calls.remembered.push(copy(value)); }
  });
  const update = activityScript.runInContext(context);
  return { context, calls, decision, update };
}

test('an invalidated body route never claims arrival or queues its follow-up gesture', () => {
  const f = fixture();
  f.update(2000);
  assert.deepEqual(f.calls, { queued: [], remembered: [] });
  assert.equal(f.context.directorActivity, null);
  assert.equal(f.context.directorLastExecution.status, 'cancelled');
  assert.equal(f.context.directorLastExecution.targetId, 'surface-project');
});

test('a completion marker from another body route cannot finish the current AI action', () => {
  const f = fixture({ completedRouteId: 40 });
  f.update(2000);
  assert.deepEqual(f.calls, { queued: [], remembered: [] });
  assert.equal(f.context.directorLastExecution.status, 'cancelled');
});

test('a genuinely completed route records one actual interaction and queues one bounded follow-up', () => {
  const f = fixture({ completedRouteId: 41 });
  f.update(2000);
  assert.deepEqual(f.calls.remembered, [f.decision]);
  assert.equal(f.calls.queued.length, 1);
  assert.deepEqual(f.calls.queued[0], { name: 'wink', source: 'director', expression: 'happy', queuedAt: 12 });
  assert.equal(f.context.directorActivity, null);
  f.update(2016);
  assert.equal(f.calls.remembered.length, 1);
  assert.equal(f.calls.queued.length, 1);
});

for (const activity of ['typing', 'scrolling']) {
  test('actual route completion while the visitor is ' + activity + ' records the visit without starting a gesture', () => {
    const f = fixture({ completedRouteId: 41, blocked: { [activity]: true } });
    f.update(2000);
    assert.deepEqual(f.calls.remembered, [f.decision]);
    assert.deepEqual(f.calls.queued, []);
    assert.equal(f.context.directorActivity, null);
  });
}

test('a replaced route cancels its previous AI ownership instead of inheriting another action', () => {
  const replacement = { directorRouteId: 42, element: 'replacement-fixture' };
  const f = fixture({ route: replacement, completedRouteId: 41 });
  f.update(2000);
  assert.deepEqual(f.calls, { queued: [], remembered: [] });
  assert.equal(f.context.directorLastExecution.status, 'cancelled');
  assert.equal(f.context.directorActivity, null);
  assert.equal(f.context.route, replacement);
});

test('an expired action cannot claim completion or produce a late gesture', () => {
  const f = fixture({ route: { directorRouteId: 41 }, started: 1000 });
  f.update(36_001);
  assert.deepEqual(f.calls, { queued: [], remembered: [] });
  assert.equal(f.context.directorLastExecution.status, 'cancelled');
  assert.equal(f.context.directorActivity, null);
});

test('an action still travelling keeps ownership and emits no premature execution', () => {
  const f = fixture({ route: { directorRouteId: 41 } });
  f.update(2000);
  assert.deepEqual(f.calls, { queued: [], remembered: [] });
  assert.equal(f.context.directorActivity.routeId, 41);
  assert.equal(f.context.directorLastExecution.status, 'travelling');
});