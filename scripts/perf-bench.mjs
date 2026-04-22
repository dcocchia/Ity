import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { setupDOM } = require('../build/test/helpers.js');
const Ity = require('../build/Ity.js');
const queryMod = require('../build/query.js');
const formsMod = require('../build/forms.js');
const workbenchModulePath = path.resolve('./build/Examples/OperationsWorkbench/operationsWorkbenchApp.js');
let workbenchEnvironmentCleanup = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function flush() {
  await Promise.resolve();
  await sleep(0);
  await Promise.resolve();
}

async function measure(name, fn, runs = 3) {
  const samples = [];
  await fn();
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    await fn();
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  const average = samples.reduce((total, value) => total + value, 0) / samples.length;
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`${name}\tmedian=${median.toFixed(2)}ms\tavg=${average.toFixed(2)}ms\truns=${samples.map((value) => value.toFixed(2)).join(',')}`);
}

async function measureInteraction(name, setup, interact, runs = 3) {
  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const context = await setup();
    const started = performance.now();
    await interact(context.app);
    await flush();
    samples.push(performance.now() - started);
    await context.dispose();
  }
  samples.sort((left, right) => left - right);
  const average = samples.reduce((total, value) => total + value, 0) / samples.length;
  const median = samples[Math.floor(samples.length / 2)];
  console.log(`${name}\tmedian=${median.toFixed(2)}ms\tavg=${average.toFixed(2)}ms\truns=${samples.map((value) => value.toFixed(2)).join(',')}`);
}

function makeTasks(count) {
  const statuses = ['planned', 'active', 'blocked', 'done'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const owners = ['ava', 'milo', 'nina', 'joel'];
  const now = new Date('2026-04-22T12:00:00.000Z').toISOString();

  const dueDate = (offset) => {
    const date = new Date('2026-04-22T12:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  return Array.from({ length: count }, (_, index) => ({
    id: `task-${index}`,
    title: index === count - 1 ? `Needle task ${index}` : `Task ${index}`,
    description: index === count - 1 ? 'Search target benchmark needle' : `Description ${index}`,
    status: statuses[index % statuses.length],
    priority: priorities[index % priorities.length],
    ownerId: owners[index % owners.length],
    dueDate: dueDate((index % 12) - 4),
    tags: [`tag-${index % 8}`, `group-${index % 5}`],
    checklist: [
      { id: `check-${index}-0`, label: 'First', done: index % 2 === 0 },
      { id: `check-${index}-1`, label: 'Second', done: false }
    ],
    createdAt: now,
    updatedAt: now,
    lastStatusAt: now
  }));
}

function makeNotes(taskCount, count) {
  const now = new Date('2026-04-22T12:00:00.000Z').toISOString();
  return Array.from({ length: count }, (_, index) => ({
    id: `note-${index}`,
    title: `Note ${index}`,
    body: `Body ${index}`,
    relatedTaskIds: [`task-${index % taskCount}`],
    createdAt: now,
    updatedAt: now
  }));
}

function makeWorkspace(taskCount = 500, noteCount = 120) {
  const now = new Date('2026-04-22T12:00:00.000Z').toISOString();
  return {
    meta: {
      name: 'Benchmark Workbench',
      version: 1,
      bulletinHtml: '<p>Benchmark bulletin</p>',
      updatedAt: now
    },
    people: [
      { id: 'ava', name: 'Ava Reynolds', role: 'Release Manager', initials: 'AR' },
      { id: 'milo', name: 'Milo Chen', role: 'Platform Lead', initials: 'MC' },
      { id: 'nina', name: 'Nina Patel', role: 'QA Lead', initials: 'NP' },
      { id: 'joel', name: 'Joel Kim', role: 'Support Ops', initials: 'JK' }
    ],
    tasks: makeTasks(taskCount),
    notes: makeNotes(taskCount, noteCount),
    activity: Array.from({ length: 20 }, (_, index) => ({
      id: `activity-${index}`,
      kind: 'benchmark',
      message: `Activity ${index}`,
      createdAt: now
    })),
    settings: {
      defaultOwnerId: 'ava',
      accent: 'sunrise',
      reportTitle: 'Benchmark Report'
    }
  };
}

async function benchSignalFanout() {
  const count = Ity.signal(0);
  let sink = 0;
  const stops = [];

  for (let index = 0; index < 1000; index += 1) {
    const value = Ity.computed(() => count() + index);
    stops.push(Ity.effect(() => {
      sink += value();
    }));
  }

  count.set(1);
  await flush();
  stops.forEach((stop) => stop());
  if (sink === -1) console.log('');
}

async function benchRepeatUpdate(itemsCount) {
  const cleanup = setupDOM('<!DOCTYPE html><div id="root"></div>');
  const items = Ity.signal(Array.from({ length: itemsCount }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`
  })));
  const stop = Ity.render(() => Ity.html`
    <ul>
      ${Ity.repeat(items, (item) => item.id, (item) => Ity.html`<li data-id=${item.id}>${item.label}</li>`)}
    </ul>
  `, '#root');

  await flush();
  items.update((current) => {
    const next = current.slice();
    const middle = Math.floor(itemsCount / 2);
    next[middle] = { ...next[middle], label: 'Updated' };
    return next;
  });
  await flush();

  stop();
  await flush();
  cleanup();
}

async function benchRepeatReverse(itemsCount) {
  const cleanup = setupDOM('<!DOCTYPE html><div id="root"></div>');
  const items = Ity.signal(Array.from({ length: itemsCount }, (_, index) => ({
    id: `item-${index}`,
    label: `Item ${index}`
  })));
  const stop = Ity.render(() => Ity.html`
    <ul>
      ${Ity.repeat(items, (item) => item.id, (item) => Ity.html`<li data-id=${item.id}>${item.label}</li>`)}
    </ul>
  `, '#root');

  await flush();
  items.update((current) => current.slice().reverse());
  await flush();

  stop();
  await flush();
  cleanup();
}

async function loadWorkbenchApp() {
  if (!workbenchEnvironmentCleanup) {
    workbenchEnvironmentCleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>', 'https://example.com/lab/workbench/tasks');
    delete require.cache[workbenchModulePath];
    require(workbenchModulePath);
  } else {
    document.body.innerHTML = '<div id="operationsWorkbenchApp"></div>';
    window.history.replaceState(null, '', '/lab/workbench/tasks');
  }

  const createOperationsWorkbenchApp = window.ItyExamples.createOperationsWorkbenchApp;
  const app = createOperationsWorkbenchApp(Ity, {
    target: '#operationsWorkbenchApp',
    base: '/lab/workbench',
    storage: window.ItyExamples.createMemoryStorage(),
    storageKey: `bench-${Math.random().toString(36).slice(2)}`,
    modules: { ...queryMod, ...formsMod },
    latencyMs: 0,
    initialData: makeWorkspace(500, 120)
  });

  const maybePromise = typeof app.workspace.promise === 'function'
    ? app.workspace.promise()
    : app.workspace.promise;
  if (maybePromise) await maybePromise;
  await flush();

  return {
    app,
    async dispose() {
      app.dispose();
      await flush();
      document.body.innerHTML = '';
    }
  };
}

async function benchWorkbenchBoot() {
  const { dispose } = await loadWorkbenchApp();
  await dispose();
}

async function benchWorkbenchFilterNarrow() {
  const { app, dispose } = await loadWorkbenchApp();
  app.ui.taskQuery = 'needle';
  await flush();
  await dispose();
}

async function benchWorkbenchFilterWiden() {
  const { app, dispose } = await loadWorkbenchApp();
  app.ui.taskQuery = 'needle';
  await flush();
  app.ui.taskQuery = '';
  await flush();
  await dispose();
}

async function benchWorkbenchCycleTask() {
  const { app, dispose } = await loadWorkbenchApp();
  await app.actions.cycleTask('task-1');
  await flush();
  await dispose();
}

async function main() {
  try {
    console.log('Ity performance benchmark');
    await measure('signal fanout 1k', benchSignalFanout);
    await measure('repeat update 1k', () => benchRepeatUpdate(1000));
    await measure('repeat reverse 1k', () => benchRepeatReverse(1000));
    await measure('workbench boot 500 tasks', benchWorkbenchBoot);
    await measureInteraction('workbench filter narrow 500 tasks', loadWorkbenchApp, async (app) => {
      app.ui.taskQuery = 'needle';
    });
    await measureInteraction('workbench filter widen 500 tasks', loadWorkbenchApp, async (app) => {
      app.ui.taskQuery = 'needle';
      await flush();
      app.ui.taskQuery = '';
    });
    await measureInteraction('workbench cycle task 500 tasks', loadWorkbenchApp, async (app) => {
      await app.actions.cycleTask('task-1');
    });
  } finally {
    if (workbenchEnvironmentCleanup) {
      workbenchEnvironmentCleanup();
      workbenchEnvironmentCleanup = null;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
