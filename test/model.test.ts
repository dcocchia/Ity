// @ts-nocheck
export {};
declare var require: any;
declare const global: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Model basics', function () {
  it('set and get attributes', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    model.set('foo', 'bar');
    assert.equal(model.get('foo'), 'bar');
    model.set({baz: 1});
    assert.equal(model.get('baz'), 1);
    cleanup();
  });

  it('replaces all attributes when an object is passed', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    model.set('first', 'val');
    model.set({second: 2});
    assert.deepEqual(model.get(), {second: 2});
    cleanup();
  });

  it('unset and clear', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    model.set({a: 1, b: 2});
    model.unSet('a');
    assert.equal(model.get('a'), undefined);
    model.clear();
    assert.deepEqual(model.get(), {});
    cleanup();
  });

  it('unSet removes attributes set to undefined', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    model.set('x', undefined);
    model.unSet('x');
    assert.strictEqual('x' in model.get(), false);
    cleanup();
  });

  it('triggers change events', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    let changed = false;
    model.on('change', () => changed = true);
    model.set('x', 2);
    assert(changed);
    cleanup();
  });

  it('supports multiple listeners for same event', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    let a = false;
    let b = false;
    model.on('change', () => a = true);
    model.on('change', () => b = true);
    model.set('y', 3);
    assert(a && b);
    cleanup();
  });
  it('performs ajax sync via _ajax', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    function FakeXHR() {
      this.open = () => {};
      this.send = () => { this.status = 200; this.responseText = '{"a":1}'; this.onload(); };
    }
    const model = new window.Ity.Model({ url: '/foo' });
    global.XMLHttpRequest = function () { return new FakeXHR(); };
    model.sync({ success(resp){ this.data = resp; } });
    assert.deepEqual(model.get(), {a:1});
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('uses default success and error handlers', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    function FakeXHRSuccess() {
      this.open = () => {};
      this.send = () => { this.status = 200; this.responseText = '{"z":9}'; this.onload(); };
    }
    let model = new window.Ity.Model({ url: '/foo' });
    global.XMLHttpRequest = function () { return new FakeXHRSuccess(); };
    model.sync();
    assert.equal(model.get('z'), 9);
    function FakeXHRFail() {
      this.open = () => {};
      this.send = () => { this.onerror(); };
    }
    global.XMLHttpRequest = function () { return new FakeXHRFail(); };
    model = new window.Ity.Model({ url: '/foo' });
    model.sync(); // should invoke default error handler
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('off removes event listeners', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    let count = 0;
    function cb() { count++; }
    model.on('change', cb);
    model.trigger('change');
    assert.equal(count, 1);
    model.off('change', cb);
    model.trigger('change');
    assert.equal(count, 1);
    cleanup();
  });

  it('off with no arguments clears all listeners', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    let called = false;
    model.on('foo', () => called = true);
    model.on('bar', () => called = true);
    model.off();
    model.trigger('foo');
    model.trigger('bar');
    assert.strictEqual(called, false);
    cleanup();
  });

  it('off with event name only removes all callbacks', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    let called = false;
    function cb() { called = true; }
    model.on('foo', cb);
    model.on('foo', () => {});
    model.off('foo');
    model.trigger('foo');
    assert.strictEqual(called, false);
    cleanup();
  });

  it('_ajax error paths invoke error callback', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    let status: number | undefined = undefined;
    function FakeXHRFailStatus() {
      this.open = () => {};
      this.send = () => { this.status = 500; this.onload(); };
    }
    global.XMLHttpRequest = function () { return new (FakeXHRFailStatus as any)(); };
    const model = new window.Ity.Model({ url: '/foo' });
    model.sync({ error(s) { status = s; } });
    assert.strictEqual(status, 500);

    function FakeXHRError() {
      this.open = () => {};
      this.send = () => { this.onerror(); };
    }
    global.XMLHttpRequest = function () { return new (FakeXHRError as any)(); };
    status = undefined;
    model.sync({ error(s) { status = s ?? 0; } });
    assert.strictEqual(status, 0);

    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('get returns undefined when data missing', function () {
    const cleanup = setupDOM();
    const m = new window.Ity.Model();
    (m as any).data = undefined;
    assert.strictEqual(m.get('foo'), undefined);
    cleanup();
  });

  it('off with mismatched context does not remove listener', function () {
    const cleanup = setupDOM();
    const m = new window.Ity.Model();
    let count = 0;
    const ctx1 = {};
    const ctx2 = {};
    function cb() { count++; }
    m.on('e', cb, ctx1);
    m.off('e', cb, ctx2);
    m.trigger('e');
    assert.equal(count, 1);
    cleanup();
  });

  it('off on missing event is a no-op', function () {
    const cleanup = setupDOM();
    const m = new window.Ity.Model();
    m.off('missing', () => {});
    cleanup();
  });
});
