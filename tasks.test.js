'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { TaskStore } = require('../src/taskStore');
const { Scheduler } = require('../src/scheduler');
const { createApp } = require('../src/app');

let server, base, scheduler;
const executed = []; // records every task the fake executor "ran"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inMs = (ms) => new Date(Date.now() + ms).toISOString();
const api = (path, opts = {}) =>
  fetch(base + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json' },
  });
const post = (body) => api('/tasks', { method: 'POST', body: JSON.stringify(body) });

before(async () => {
  const store = new TaskStore();
  // Fake executor + fast tick so tests finish in milliseconds instead of seconds.
  scheduler = new Scheduler({ store, executor: async (t) => executed.push(t.taskId), intervalMs: 50 });
  scheduler.start();
  server = createApp(store).listen(0); // port 0 = random free port
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});

after(() => {
  scheduler.stop();
  server.close();
});

test('creates a task and returns taskId, status, message', async () => {
  const res = await post({ taskName: 'Report', executeAt: inMs(60000), payload: { a: 1 } });
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.match(body.taskId, /^task_\d+$/);
  assert.strictEqual(body.status, 'scheduled');
  assert.strictEqual(body.message, 'Task scheduled successfully');
});

test('rejects invalid input with 400 and lists every problem', async () => {
  const cases = [
    {},
    { taskName: '', executeAt: inMs(5000) },
    { taskName: 'x', executeAt: 'tomorrow' },
    { taskName: 'x', executeAt: '2026-10-15T15:00:00' }, // no timezone
    { taskName: 'x', executeAt: '2026-02-30T10:00:00Z' }, // impossible date
    { taskName: 'x', executeAt: '2020-01-01T00:00:00Z' }, // in the past
    { taskName: 'x', executeAt: inMs(5000), payload: 'nope' },
  ];
  for (const c of cases) {
    const res = await post(c);
    assert.strictEqual(res.status, 400, JSON.stringify(c));
  }
  const bad = await api('/tasks', { method: 'POST', body: '{not json' });
  assert.strictEqual(bad.status, 400);
});

test('executes a task automatically, exactly once, and marks it completed', async () => {
  const { taskId } = await (await post({ taskName: 'Auto', executeAt: inMs(300) })).json();
  await sleep(700);
  assert.strictEqual(executed.filter((id) => id === taskId).length, 1);
  const { tasks } = await (await api('/tasks')).json();
  const t = tasks.find((x) => x.taskId === taskId);
  assert.strictEqual(t.status, 'completed');
  assert.ok(t.executedAt);
});

test('cancelled task never executes; cancelling again gives 409; unknown id gives 404', async () => {
  const { taskId } = await (await post({ taskName: 'Cancel me', executeAt: inMs(300) })).json();
  const del = await api(`/tasks/${taskId}`, { method: 'DELETE' });
  assert.strictEqual(del.status, 200);
  assert.strictEqual((await del.json()).status, 'cancelled');

  await sleep(700);
  assert.ok(!executed.includes(taskId), 'cancelled task must not run');

  assert.strictEqual((await api(`/tasks/${taskId}`, { method: 'DELETE' })).status, 409);
  assert.strictEqual((await api('/tasks/task_999999', { method: 'DELETE' })).status, 404);
});

test('cannot cancel a completed task', async () => {
  const { taskId } = await (await post({ taskName: 'Done', executeAt: inMs(200) })).json();
  await sleep(600);
  assert.strictEqual((await api(`/tasks/${taskId}`, { method: 'DELETE' })).status, 409);
});

test('GET /tasks supports ?status filter and rejects bad filters', async () => {
  const ok = await (await api('/tasks?status=cancelled')).json();
  assert.ok(ok.tasks.every((t) => t.status === 'cancelled'));
  assert.strictEqual((await api('/tasks?status=banana')).status, 400);
});
