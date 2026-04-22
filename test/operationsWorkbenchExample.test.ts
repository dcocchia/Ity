// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

function submit(form: Element): void {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

describe('Operations Workbench example', function () {
  it('boots from an index.html base path and sanitizes the operator bulletin', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/Examples/OperationsWorkbench/index.html');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/Examples/OperationsWorkbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-test-1',
      modules: loadWorkbenchModules(),
      latencyMs: 0,
      initialData: {
        meta: {
          name: 'Sanitizer Demo',
          version: 1,
          bulletinHtml: '<p><a href="javascript:alert(1)" onclick="alert(2)">Unsafe link</a></p><script>window.__bad = true</script>',
          updatedAt: new Date().toISOString()
        },
        people: [{ id: 'ava', name: 'Ava Reynolds', role: 'Lead', initials: 'AR' }],
        tasks: [],
        notes: [],
        activity: [],
        settings: { defaultOwnerId: 'ava', accent: 'sunrise', reportTitle: 'Report' }
      }
    });

    await waitForWorkspace(app);

    const bulletin = document.querySelector('.owbRichText') as HTMLElement;
    assert.strictEqual(app.router.current().path, '/index.html');
    assert.match(document.querySelector('.owbShellHeader h1')?.textContent || '', /Sanitizer Demo/);
    assert.ok(!/script/i.test(bulletin.innerHTML));
    assert.ok(!/onclick=/i.test(bulletin.innerHTML));
    assert.ok(!/javascript:/i.test(bulletin.innerHTML));

    app.dispose();
    cleanup();
  });

  it('navigates between header tabs through the bound router links', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-nav',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    const tasksLink = Array.from(document.querySelectorAll('.owbNavLink')).find((element) => element.textContent?.trim() === 'Tasks') as HTMLAnchorElement;
    assert.ok(tasksLink, 'expected Tasks nav link');
    tasksLink.click();
    await flush();

    assert.strictEqual(app.router.current().path, '/tasks');
    assert.match(document.querySelector('.owbSectionHeading h2')?.textContent || '', /Task board/i);

    const notesLink = Array.from(document.querySelectorAll('.owbNavLink')).find((element) => element.textContent?.trim() === 'Notes') as HTMLAnchorElement;
    assert.ok(notesLink, 'expected Notes nav link');
    notesLink.click();
    await flush();

    assert.strictEqual(app.router.current().path, '/notes');
    assert.match(document.querySelector('.owbSectionHeading h2')?.textContent || '', /Operational memory/i);

    app.dispose();
    cleanup();
  });

  it('limits view transitions to router navigation instead of background workspace updates', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    let app: any;
    try {
      let transitionCalls = 0;
      const skipped = () => Promise.reject(new DOMException('Transition was skipped', 'AbortError'));
      (document as any).startViewTransition = (callback: any) => {
        transitionCalls += 1;
        callback();
        return {
          ready: skipped(),
          finished: skipped()
        };
      };

      window.history.pushState(null, '', '/lab/workbench/');
      const createOperationsWorkbenchApp = loadWorkbenchExample();
      app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
        target: '#operationsWorkbenchApp',
        base: '/lab/workbench',
        storage: createStorage(),
        storageKey: 'ops-workbench-transitions',
        modules: loadWorkbenchModules(),
        latencyMs: 0
      });

      await waitForWorkspace(app);
      assert.strictEqual(transitionCalls, 0);

      const tasksLink = Array.from(document.querySelectorAll('.owbNavLink')).find((element) => element.textContent?.trim() === 'Tasks') as HTMLAnchorElement;
      tasksLink.click();
      await flush();

      assert.strictEqual(app.router.current().path, '/tasks');
      assert.strictEqual(transitionCalls, 1);
      assert.deepStrictEqual(rejections, []);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      delete (document as any).startViewTransition;
      if (app) app.dispose();
      cleanup();
    }
  });

  it('creates a new task and navigates straight into the detail route', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/tasks/new');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-test-2',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    (document.querySelector('input[name="title"]') as HTMLInputElement).value = 'Coordinate the launch dry run';
    (document.querySelector('textarea[name="description"]') as HTMLTextAreaElement).value = 'Walk the team through the final handoff and rollback decision tree.';
    (document.querySelector('select[name="ownerId"]') as HTMLSelectElement).value = 'milo';
    (document.querySelector('select[name="priority"]') as HTMLSelectElement).value = 'high';
    (document.querySelector('input[name="dueDate"]') as HTMLInputElement).value = '2026-04-24';
    (document.querySelector('input[name="tags"]') as HTMLInputElement).value = 'launch, rehearsal';
    (document.querySelector('input[name="checklist.0.label"]') as HTMLInputElement).value = 'Book the room';
    (document.querySelector('.owbInlineActions .owbGhostButton') as HTMLButtonElement).click();
    await flush();
    (document.querySelector('input[name="checklist.1.label"]') as HTMLInputElement).value = 'Confirm rollback captain';

    submit(document.querySelector('.owbForm') as Element);
    await flush();
    await flush();

    const createdTask = app.workspace.data().tasks.find((task: any) => task.title === 'Coordinate the launch dry run');
    assert.ok(createdTask, 'expected created task to exist');
    assert.strictEqual(app.router.current().path, `/tasks/${createdTask.id}`);
    assert.match(document.querySelector('.owbSectionHeading h2')?.textContent || '', /Coordinate the launch dry run/);
    assert.strictEqual(createdTask.checklist.length, 2);

    app.dispose();
    cleanup();
  });

  it('keeps task form focus stable across successive keystrokes', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/tasks/new');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-focus',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    let title = document.getElementById('taskTitle') as HTMLInputElement;
    title.focus();
    title.value = 'C';
    title.setSelectionRange(1, 1);
    title.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();

    title = document.getElementById('taskTitle') as HTMLInputElement;
    assert.strictEqual(document.activeElement, title);
    assert.strictEqual(title.value, 'C');
    assert.strictEqual(title.selectionStart, 1);

    title.value = 'Co';
    title.setSelectionRange(2, 2);
    title.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();

    title = document.getElementById('taskTitle') as HTMLInputElement;
    assert.strictEqual(document.activeElement, title);
    assert.strictEqual(title.value, 'Co');
    assert.strictEqual(title.selectionStart, 2);

    app.dispose();
    cleanup();
  });

  it('updates detail state through checklist toggles and status actions', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/tasks/task-flags');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-test-3',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    const secondChecklist = document.querySelectorAll('.owbChecklistItem input')[1] as HTMLInputElement;
    secondChecklist.click();
    await flush();
    await flush();

    let task = app.workspace.data().tasks.find((entry: any) => entry.id === 'task-flags');
    assert.strictEqual(task.checklist[1].done, true);

    (document.querySelector('.owbInlineActions .owbGhostButton') as HTMLElement).click();
    await flush();
    await flush();

    task = app.workspace.data().tasks.find((entry: any) => entry.id === 'task-flags');
    assert.strictEqual(task.status, 'blocked');
    assert.match(document.querySelector('.owbStatRow dd')?.textContent || '', /Blocked/);

    app.dispose();
    cleanup();
  });

  it('filters tasks, opens a component card route, and renders the string report preview', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/tasks');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: createStorage(),
      storageKey: 'ops-workbench-test-4',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    const search = document.querySelector('.owbFilterInput') as HTMLInputElement;
    search.value = 'briefing';
    search.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();

    const cards = Array.from(document.querySelectorAll('ity-workbench-task-card'));
    assert.strictEqual(cards.length, 1);

    const openButton = (cards[0] as any).shadowRoot.querySelector('.owbTaskCard__open') as HTMLElement;
    openButton.click();
    await flush();

    assert.strictEqual(app.router.current().path, '/tasks/task-briefing');

    app.router.navigate('/reports');
    await flush();

    assert.match(document.querySelector('.owbReportPreview')?.textContent || '', /Northstar Beta Release Report/);
    assert.match(document.querySelector('.owbReportPreview')?.textContent || '', /Roll out feature flags/);

    app.dispose();
    cleanup();
  });

  it('shows import validation errors, accepts valid imports, and can recover from corrupted stored data', async function () {
    const storage = createStorage();
    const cleanup = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/settings');
    const createOperationsWorkbenchApp = loadWorkbenchExample();
    const app = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage,
      storageKey: 'ops-workbench-test-5',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await waitForWorkspace(app);

    const importField = document.querySelector('textarea[name="importText"]') as HTMLTextAreaElement;
    importField.value = '{bad json';
    importField.dispatchEvent(new window.Event('input', { bubbles: true }));
    submit(importField.closest('form') as Element);
    await flush();
    await flush();

    assert.match(document.querySelector('.owbInlineError[role="alert"]')?.textContent || '', /Import JSON is invalid/);

    importField.value = JSON.stringify({
      meta: {
        name: 'Imported Workspace',
        version: 1,
        bulletinHtml: '<p>Imported bulletin</p>',
        updatedAt: new Date().toISOString()
      },
      people: [{ id: 'ava', name: 'Ava Reynolds', role: 'Lead', initials: 'AR' }],
      tasks: [],
      notes: [],
      activity: [],
      settings: { defaultOwnerId: 'ava', accent: 'ocean', reportTitle: 'Imported report' }
    });
    importField.dispatchEvent(new window.Event('input', { bubbles: true }));
    submit(importField.closest('form') as Element);
    await flush();
    await flush();

    assert.strictEqual(app.workspace.data().meta.name, 'Imported Workspace');
    app.dispose();
    cleanup();

    const brokenStorage = createStorage();
    brokenStorage.setItem('ops-workbench-broken', '{not json');
    const cleanupBroken = setupDOM('<!DOCTYPE html><div id="operationsWorkbenchApp"></div>');
    window.history.pushState(null, '', '/lab/workbench/');
    const brokenApp = createOperationsWorkbenchApp(loadWorkbenchRuntime(), {
      target: '#operationsWorkbenchApp',
      base: '/lab/workbench',
      storage: brokenStorage,
      storageKey: 'ops-workbench-broken',
      modules: loadWorkbenchModules(),
      latencyMs: 0
    });

    await flush();
    await flush();

    assert.match(document.body.textContent || '', /Workspace load failed/);

    (document.querySelector('.owbDangerButton') as HTMLElement).click();
    await flush();
    await flush();

    assert.ok(brokenApp.workspace.data(), 'expected reset to repopulate the workspace');
    assert.match(document.body.textContent || '', /Northstar Launch Control/);

    brokenApp.dispose();
    cleanupBroken();
  });

  it('keeps tab hover styling stationary so nav targets do not thrash under the pointer', function () {
    const html = fs.readFileSync(path.join(process.cwd(), 'Examples/OperationsWorkbench/index.html'), 'utf8');

    assert.ok(!/\.owbNavLink:hover,\s*\.owbNoteCard:hover\s*\{\s*transform:\s*translateY\(-1px\);/s.test(html));
    assert.ok(/\.owbNavLink:hover,\s*\.owbNavLink:focus-visible\s*\{[^}]*border-color:[^}]*\}/s.test(html));
    assert.ok(!/\.owbNavLink:hover,\s*\.owbNavLink:focus-visible\s*\{[^}]*transform:/s.test(html));
  });
});
