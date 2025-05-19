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
});
