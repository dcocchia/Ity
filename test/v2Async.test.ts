// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');
const { JSDOM } = require('jsdom');

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
});
