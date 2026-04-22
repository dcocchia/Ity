// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;

const assert = require('assert');
const { setupDOM } = require('./helpers');

function loadWorkbenchExample(): any {
  const modulePath = '../Examples/OperationsWorkbench/operationsWorkbenchApp.js';
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return window.ItyExamples.createOperationsWorkbenchApp;
}

function createStorage(): any {
  loadWorkbenchExample();
  return window.ItyExamples.createMemoryStorage();
}

function loadWorkbenchRuntime(): any {
  return require(process.env.ITY_CORE_FILE || '../Ity');
}

function loadWorkbenchModules(): any {
  return {
    ...require(process.env.ITY_QUERY_FILE || '../query'),
    ...require(process.env.ITY_FORMS_FILE || '../forms')
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

async function waitForWorkspace(app: any): Promise<void> {
  const maybePromise = typeof app.workspace.promise === 'function'
    ? app.workspace.promise()
    : app.workspace.promise;
  if (maybePromise) await maybePromise;
  await flush();
}

describe('V3 performance regressions', function () {
  it('caches compiled template bindings across reactive rerenders', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const count = window.Ity.signal(0);
    const originalCreateTreeWalker = document.createTreeWalker.bind(document);
    const originalQuerySelector = window.DocumentFragment.prototype.querySelector;
    let treeWalkerCalls = 0;
    let fragmentQueryCalls = 0;

    document.createTreeWalker = function (...args: any[]): any {
      treeWalkerCalls += 1;
      return originalCreateTreeWalker(...args);
    } as typeof document.createTreeWalker;
    window.DocumentFragment.prototype.querySelector = function (selector: string): Element | null {
      if (String(selector).includes('data-ity-bind-')) {
        fragmentQueryCalls += 1;
      }
      return originalQuerySelector.call(this, selector);
    };

    try {
      const stop = window.Ity.render(() => window.Ity.html`
        <div class=${count() % 2 === 0 ? 'even' : 'odd'} data-count=${String(count())}>
          ${count()}
        </div>
      `, '#root');

      await flush();
      count.set(1);
      await flush();
      count.set(2);
      await flush();

      assert.strictEqual(treeWalkerCalls, 2);
      assert.strictEqual(fragmentQueryCalls, 2);
      stop();
    } finally {
      document.createTreeWalker = originalCreateTreeWalker;
      window.DocumentFragment.prototype.querySelector = originalQuerySelector;
      cleanup();
    }
  });

  it('returns stable formState field handles for repeated access', function () {
    const cleanup = setupDOM();
    const state = window.Ity.formState({
      title: 'Release'
    });

    const first = state.field('title');
    const second = state.field('title');

    assert.strictEqual(first, second);
    cleanup();
  });

  it('does not reload the workspace when entering a task detail route from the loaded task board', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/tasks');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-perf-loads',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    let loads = 0;
    const originalLoad = app.repository.loadWorkspace.bind(app.repository);
    app.repository.loadWorkspace = (...args: any[]) => {
      loads += 1;
      return originalLoad(...args);
    };

    app.router.navigate('/tasks/task-flags');
    await flush();

    assert.strictEqual(app.router.current().path, '/tasks/task-flags');
    assert.strictEqual(loads, 0);

    app.dispose();
    cleanup();
  });

  it('reuses task card action handlers across parent rerenders', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/tasks');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-perf-handlers',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    const card = document.querySelector('ity-workbench-task-card') as any;
    assert.ok(card);
    const firstHandler = card.onAdvance;

    app.ui.noticeMessage = 'Benchmark notice';
    app.ui.noticeToken = app.ui.noticeToken + 1;
    await flush();

    assert.strictEqual(card.onAdvance, firstHandler);

    app.dispose();
    cleanup();
  });
});
