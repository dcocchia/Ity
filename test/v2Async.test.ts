// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');
const { JSDOM } = require('jsdom');

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

describe('V2 async primitives', function () {
  it('resource loads immediately, refreshes, mutates and tracks status', async function () {
    const cleanup = setupDOM();
    let calls = 0;
    const seen: any[] = [];
    const users = window.Ity.resource(async ({ previous, signal, refreshId }: any) => {
      assert.strictEqual(signal.aborted, false);
      calls += 1;
      return { id: refreshId, previous: previous?.id ?? null };
    }, {
      onSuccess(value: any) {
        seen.push(value);
      }
    });

    assert.strictEqual(users.loading(), true);
    assert.strictEqual(users.status(), 'loading');
    await users.promise;
    assert.deepStrictEqual(users.data(), { id: 1, previous: null });
    assert.strictEqual(users.status(), 'success');

    await users.refresh();
    assert.deepStrictEqual(users.data(), { id: 2, previous: 1 });
    users.mutate({ id: 99, previous: 2 });
    assert.deepStrictEqual(users.data(), { id: 99, previous: 2 });
    assert.strictEqual(users.status(), 'success');
    assert.strictEqual(calls, 2);
    assert.deepStrictEqual(seen, [
      { id: 1, previous: null },
      { id: 2, previous: 1 }
    ]);
    cleanup();
  });

  it('resource handles errors, stale refreshes and aborts without corrupting state', async function () {
    const cleanup = setupDOM();
    const resolvers: Function[] = [];
    const api = window.Ity.resource(({ signal }: any) => new Promise((resolve, reject) => {
      resolvers.push((value: any, fail = false) => {
        if (fail) reject(value);
        else if (signal.aborted) reject(new DOMException('aborted', 'AbortError'));
        else resolve(value);
      });
    }), { immediate: false, initialValue: 'initial' });

    const first = api.refresh();
    const second = api.refresh();
    await Promise.resolve();
    resolvers[0]('stale');
    resolvers[1]('fresh');
    await Promise.all([first, second]);
    assert.strictEqual(api.data(), 'fresh');

    const failing = api.refresh();
    await Promise.resolve();
    resolvers[2](new Error('nope'), true);
    await failing;
    assert.strictEqual(api.status(), 'error');
    assert.strictEqual(api.error().message, 'nope');
    assert.strictEqual(api.data(), 'fresh');

    const aborting = api.refresh();
    await Promise.resolve();
    api.abort();
    resolvers[3]('ignored');
    await aborting;
    assert.strictEqual(api.status(), 'success');
    assert.strictEqual(api.loading(), false);
    assert.strictEqual(api.data(), 'fresh');
    cleanup();
  });

  it('resource clears stale data when requested and ignores stale optimistic work', async function () {
    const cleanup = setupDOM();
    const resolvers: Function[] = [];
    const api = window.Ity.resource(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }), { immediate: false, initialValue: 'initial', keepPrevious: false });

    const first = api.refresh();
    await Promise.resolve();
    assert.strictEqual(api.data(), undefined);

    const second = api.refresh();
    await Promise.resolve();
    resolvers[0]('stale');
    resolvers[1]('fresh');
    await Promise.all([first, second]);
    assert.strictEqual(api.data(), 'fresh');

    api.abort();
    assert.strictEqual(api.status(), 'success');

    const third = api.refresh();
    await Promise.resolve();
    api.mutate('optimistic');
    resolvers[2]('late');
    await third;
    assert.strictEqual(api.data(), 'optimistic');
    assert.strictEqual(api.promise, null);
    cleanup();
  });

  it('action tracks pending state, latest data, errors and reset', async function () {
    const cleanup = setupDOM();
    let failed = false;
    const save = window.Ity.action(async (name: string) => {
      if (name === 'bad') throw new Error('bad name');
      return name.toUpperCase();
    }, {
      onError() {
        failed = true;
      }
    });

    assert.strictEqual(save.status(), 'idle');
    const result = await save('ada');
    assert.strictEqual(result, 'ADA');
    assert.strictEqual(save.data(), 'ADA');
    assert.strictEqual(save.status(), 'success');

    await assert.rejects(() => save.submit('bad'), /bad name/);
    assert.strictEqual(failed, true);
    assert.strictEqual(save.status(), 'error');
    assert.strictEqual(save.pending(), false);

    save.reset();
    assert.strictEqual(save.data(), undefined);
    assert.strictEqual(save.error(), null);
    assert.strictEqual(save.status(), 'idle');
    cleanup();
  });

  it('action reset ignores stale completions from in-flight work', async function () {
    const cleanup = setupDOM();
    let resolve: (value: string) => void = () => {};
    let successes = 0;
    const save = window.Ity.action(() => new Promise<string>((done) => {
      resolve = done;
    }), {
      onSuccess() {
        successes += 1;
      }
    });

    const pending = save();
    await Promise.resolve();
    assert.strictEqual(save.pending(), true);
    save.reset();
    assert.strictEqual(save.pending(), false);
    assert.strictEqual(save.status(), 'idle');

    resolve('late');
    assert.strictEqual(await pending, 'late');
    assert.strictEqual(save.data(), undefined);
    assert.strictEqual(save.status(), 'idle');
    assert.strictEqual(successes, 0);
    cleanup();
  });

  it('action tracks pending count across concurrent submissions', async function () {
    const cleanup = setupDOM();
    const resolvers: Function[] = [];
    const save = window.Ity.action(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));

    const first = save();
    const second = save();
    await Promise.resolve();
    assert.strictEqual(save.pending(), true);
    assert.strictEqual(save.pendingCount(), 2);

    resolvers[0]('one');
    assert.strictEqual(await first, 'one');
    assert.strictEqual(save.pendingCount(), 1);
    assert.strictEqual(save.status(), 'loading');

    resolvers[1]('two');
    assert.strictEqual(await second, 'two');
    assert.strictEqual(save.pending(), false);
    assert.strictEqual(save.status(), 'success');
    assert.strictEqual(save.data(), 'two');
    cleanup();
  });

  it('action exposes run, with and from helpers for DOM event usage', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const calls: string[] = [];
    const save = window.Ity.action(async (value: string) => {
      calls.push(value);
      if (value === 'bad') throw new Error('nope');
      return value.toUpperCase();
    });

    window.Ity.render(() => window.Ity.html`
      <button id="with" @click=${save.with('ada')}>With</button>
      <button id="from" @click=${save.from((event: any) => [event.currentTarget.dataset.value])} data-value="grace">From</button>
      <button id="run" @click=${() => save.run('bad')}>Run</button>
    `, '#root');

    (document.getElementById('with') as HTMLElement).click();
    (document.getElementById('from') as HTMLElement).click();
    (document.getElementById('run') as HTMLElement).click();
    await flush();

    assert.deepStrictEqual(calls, ['ada', 'grace', 'bad']);
    assert.strictEqual(save.data(), 'GRACE');
    assert.strictEqual(save.error().message, 'nope');
    cleanup();
  });

  it('form creates FormData from submit events and can reset successful forms', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><form id="f"><input name="name"><button id="submit">Save</button></form>');
    const form = document.getElementById('f') as HTMLFormElement;
    form.elements.name.value = 'Ada';
    const submit = window.Ity.form(async (data: FormData) => data.get('name'), { resetOnSuccess: true });
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'currentTarget', { configurable: true, value: form });

    const result = await submit.onSubmit(event);
    assert.strictEqual(result, 'Ada');
    assert.strictEqual(submit.data(), 'Ada');
    assert.strictEqual(form.elements.name.value, '');

    form.elements.name.value = 'Grace';
    const buttonEvent = new window.Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(buttonEvent, 'target', { configurable: true, value: document.getElementById('submit') });
    assert.strictEqual(await submit.onSubmit(buttonEvent), 'Grace');
    submit.reset();
    assert.strictEqual(submit.data(), undefined);
    assert.strictEqual(submit.status(), 'idle');

    await assert.rejects(() => submit.onSubmit(new window.Event('submit')), /form event target/);
    cleanup();
  });

  it('form handleSubmit swallows rejections while preserving controller error state', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><form id="f"><input name="name" value="Ada"></form>');
    const submit = window.Ity.form(async () => {
      throw new Error('bad submit');
    });
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'currentTarget', { configurable: true, value: document.getElementById('f') });

    submit.handleSubmit(event);
    await flush();

    assert.strictEqual(submit.status(), 'error');
    assert.strictEqual(submit.error().message, 'bad submit');
    cleanup();
  });

  it('form supports form elements from another DOM realm', async function () {
    const cleanup = setupDOM();
    const dom = new JSDOM('<!DOCTYPE html><form id="f"><input name="name" value="Ada"><button id="submit">Save</button></form>');
    const form = dom.window.document.getElementById('f') as HTMLFormElement;
    const button = dom.window.document.getElementById('submit');
    const submit = window.Ity.form(async (data: FormData) => data.get('name'));
    const event = new dom.window.Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { configurable: true, value: button });

    assert.strictEqual(await submit.onSubmit(event), 'Ada');
    dom.window.close();
    cleanup();
  });

  it('form reports missing FormData support clearly', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><form id="f"><input name="name" value="Ada"></form>');
    const originalWindowFormData = window.FormData;
    const hadGlobalFormData = Object.prototype.hasOwnProperty.call(global, 'FormData');
    const originalGlobalFormData = global.FormData;
    const submit = window.Ity.form(async (data: FormData) => data.get('name'));
    const event = new window.Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'currentTarget', { configurable: true, value: document.getElementById('f') });
    Object.defineProperty(window, 'FormData', { configurable: true, value: undefined });
    Object.defineProperty(global, 'FormData', { configurable: true, value: undefined });

    try {
      await assert.rejects(() => submit.onSubmit(event), /FormData support/);
    } finally {
      Object.defineProperty(window, 'FormData', { configurable: true, value: originalWindowFormData });
      if (hadGlobalFormData) {
        Object.defineProperty(global, 'FormData', { configurable: true, value: originalGlobalFormData });
      } else {
        delete global.FormData;
      }
      cleanup();
    }
  });

  it('formState binds fields, tracks dirty/touched/errors, and submits validated snapshots', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const state = window.Ity.formState({
      title: '',
      owner: 'ava',
      related: [] as string[],
      urgent: false
    }, {
      validators: {
        title(value: string) {
          return value.trim() ? null : 'Title is required.';
        }
      }
    });
    const submit = state.submit(async (values: any) => values, { resetOnSuccess: true });

    window.Ity.render(() => window.Ity.html`
      <form id="task-form" @submit=${submit.handleSubmit}>
        <input id="title" bind=${state.bind('title', { name: 'taskTitle' })}>
        <select id="owner" bind=${state.bind('owner', { type: 'select' })}>
          <option value="ava">Ava</option>
          <option value="milo">Milo</option>
        </select>
        <label>
          <input id="urgent" type="checkbox" bind=${state.bind('urgent', { type: 'checkbox' })}>
          Urgent
        </label>
        <label>
          <input class="related" type="checkbox" bind=${state.bind('related', { type: 'checkbox', value: 'task-1' })}>
          Task 1
        </label>
        <label>
          <input class="related" type="checkbox" bind=${state.bind('related', { type: 'checkbox', value: 'task-2' })}>
          Task 2
        </label>
        <button id="submit">Save</button>
      </form>
    `, '#root');

    submit.handleSubmit(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    assert.strictEqual((document.getElementById('title') as HTMLInputElement).name, 'taskTitle');
    assert.strictEqual(state.touched.title, true);
    assert.strictEqual(state.errors.title, 'Title is required.');

    const title = document.getElementById('title') as HTMLInputElement;
    title.value = 'Launch dry run';
    title.dispatchEvent(new window.Event('input', { bubbles: true }));
    title.dispatchEvent(new window.Event('blur', { bubbles: true }));
    (document.getElementById('owner') as HTMLSelectElement).value = 'milo';
    document.getElementById('owner')?.dispatchEvent(new window.Event('change', { bubbles: true }));
    (document.getElementById('urgent') as HTMLInputElement).click();
    (document.querySelectorAll('.related')[0] as HTMLInputElement).click();
    (document.querySelectorAll('.related')[1] as HTMLInputElement).click();
    await flush();

    assert.strictEqual(state.values.title, 'Launch dry run');
    assert.strictEqual(state.values.owner, 'milo');
    assert.strictEqual(state.values.urgent, true);
    assert.deepStrictEqual(state.values.related, ['task-1', 'task-2']);
    assert.strictEqual(state.dirty(), true);
    assert.strictEqual(state.errors.title, undefined);

    (document.querySelectorAll('.related')[0] as HTMLInputElement).click();
    await flush();
    assert.deepStrictEqual(state.values.related, ['task-2']);
    (document.querySelectorAll('.related')[0] as HTMLInputElement).click();
    await flush();

    const form = document.getElementById('task-form') as HTMLFormElement;
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    assert.deepStrictEqual(submit.data(), {
      title: 'Launch dry run',
      owner: 'milo',
      related: ['task-1', 'task-2'],
      urgent: true
    });
    assert.strictEqual(state.dirty(), false);
    assert.strictEqual((document.getElementById('title') as HTMLInputElement).value, '');
    cleanup();
  });

  it('formState synchronizes current form control values on submit', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const state = window.Ity.formState({
      title: '',
      owner: 'ava',
      urgent: false
    });
    const submit = state.submit(async (values: any) => values);

    window.Ity.render(() => window.Ity.html`
      <form id="sync-form" @submit=${submit.handleSubmit}>
        <input id="sync-title" bind=${state.bind('title', { name: 'taskTitle' })}>
        <select id="sync-owner" bind=${state.bind('owner', { type: 'select' })}>
          <option value="ava">Ava</option>
          <option value="milo">Milo</option>
        </select>
        <input id="sync-urgent" type="checkbox" bind=${state.bind('urgent', { type: 'checkbox' })}>
      </form>
    `, '#root');

    (document.getElementById('sync-title') as HTMLInputElement).value = 'Programmatic submit';
    (document.getElementById('sync-owner') as HTMLSelectElement).value = 'milo';
    (document.getElementById('sync-urgent') as HTMLInputElement).checked = true;
    (document.getElementById('sync-form') as HTMLFormElement).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    assert.deepStrictEqual(submit.data(), {
      title: 'Programmatic submit',
      owner: 'milo',
      urgent: true
    });
    cleanup();
  });

  it('formState exposes field helpers, validation state, and specialized bindings', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const state = window.Ity.formState({
      count: 1,
      mode: 'ship',
      tags: ['a'] as string[],
      custom: ''
    }, {
      validate(values: any) {
        return values.count < 0 ? { count: 'Count must be positive.' } : undefined;
      }
    });
    const countField = state.field('count');
    const observed: any[] = [];
    const stop = countField.value.subscribe((current: any, previous: any) => {
      observed.push([previous, current]);
    }, { immediate: true });
    const submit = state.submit(async (values: any) => values);

    window.Ity.render(() => window.Ity.html`
      <form id="special-form" @submit=${submit.handleSubmit}>
        <input id="count" bind=${countField.bind({ type: 'number', name: 'qty' })}>
        <label><input class="mode" type="radio" bind=${state.bind('mode', { type: 'radio', value: 'ship' })}> Ship</label>
        <label><input class="mode" type="radio" bind=${state.bind('mode', { type: 'radio', value: 'hold' })}> Hold</label>
        <select id="tags" multiple bind=${state.bind('tags', { type: 'select-multiple' })}>
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
        <input id="custom" bind=${state.bind('custom', { parse: (target: any) => target.value.toUpperCase() })}>
      </form>
    `, '#root');

    assert.strictEqual(countField.value.get(), 1);
    assert.strictEqual(countField.value.peek(), 1);
    assert.deepStrictEqual(observed, [[1, 1]]);
    countField.value.update((value: number) => value + 1);
    assert.strictEqual(countField.value(), 2);
    assert.deepStrictEqual(observed, [[1, 1], [1, 2]]);

    (document.getElementById('count') as HTMLInputElement).value = '7';
    (document.querySelectorAll('.mode')[1] as HTMLInputElement).click();
    const tagSelect = document.getElementById('tags') as HTMLSelectElement;
    tagSelect.options[0].selected = true;
    tagSelect.options[1].selected = true;
    tagSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.strictEqual(countField.dirty(), true);

    countField.reset();
    assert.strictEqual(countField.value(), 1);
    assert.strictEqual(state.validate(), true);
    state.set((current: any) => ({ count: current.count + 2 }));
    assert.strictEqual(state.values.count, 3);

    (document.getElementById('count') as HTMLInputElement).value = '9';
    (document.getElementById('custom') as HTMLInputElement).value = 'parsed later';
    (document.getElementById('special-form') as HTMLFormElement).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    assert.deepStrictEqual(submit.data(), {
      count: 9,
      mode: 'hold',
      tags: ['a', 'b'],
      custom: 'PARSED LATER'
    });
    assert.strictEqual(state.valid(), true);
    assert.strictEqual(countField.error(), null);
    assert.strictEqual(countField.touched(), true);
    submit.reset();
    assert.strictEqual(submit.data(), undefined);
    assert.strictEqual(state.values.count, 1);
    stop();
    cleanup();
  });
});
