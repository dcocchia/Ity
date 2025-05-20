// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Collection', function () {
  it('add, get and remove models', function () {
    const cleanup = setupDOM();
    const c = new window.Ity.Collection();
    const m = new window.Ity.Model();
    c.add(m);
    assert.strictEqual(c.get(m.id), m);
    c.remove(m.id);
    assert.strictEqual(c.get(m.id), undefined);
    cleanup();
  });

  it('initializes with models array', function () {
    const cleanup = setupDOM();
    const m1 = new window.Ity.Model();
    const m2 = new window.Ity.Model();
    const c = new window.Ity.Collection([m1, m2]);
    assert.strictEqual(c.models.length, 2);
    assert.strictEqual(c.at(1), m2);
    cleanup();
  });

  it('triggers events on child models', function () {
    const cleanup = setupDOM();
    const c = new window.Ity.Collection();
    const m = new window.Ity.Model();
    c.add(m);
    let triggered = false;
    m.on('foo', () => triggered = true);
    c.trigger('foo');
    assert(triggered);
    cleanup();
  });

  it('supports filter, find, clear and toJSON', function () {
    const cleanup = setupDOM();
    const c = new window.Ity.Collection();
    const m1 = new window.Ity.Model();
    const m2 = new window.Ity.Model();
    m1.set('a', 1);
    m2.set('a', 2);
    c.add(m1);
    c.add(m2);
    assert.strictEqual(c.length, 2);
    assert.strictEqual(c.find(m => m.get('a') === 2), m2);
    assert.strictEqual(c.filter(m => m.get('a') > 0).length, 2);
    assert.deepStrictEqual(c.toJSON(), [{a:1}, {a:2}]);
    c.clear();
    assert.strictEqual(c.length, 0);
    cleanup();
  });

  it('fetch populates models via ajax', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    function FakeXHR() {
      this.open = () => {};
      this.send = () => { this.status = 200; this.responseText = '[{"x":1},{"x":2}]'; this.onload(); };
    }
    global.XMLHttpRequest = function () { return new FakeXHR(); };
    const c = new window.Ity.Collection([], window.Ity.Model);
    c.url = '/foo';
    c.fetch();
    assert.strictEqual(c.length, 2);
    assert.strictEqual(c.at(1).get('x'), 2);
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('uses default success and error handlers', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    function FakeXHRSuccess() {
      this.open = () => {};
      this.send = () => { this.status = 200; this.responseText = '[{"y":3}]'; this.onload(); };
    }
    let c = new window.Ity.Collection([], window.Ity.Model);
    c.url = '/foo';
    global.XMLHttpRequest = function () { return new FakeXHRSuccess(); };
    c.fetch();
    assert.strictEqual(c.length, 1);
    assert.strictEqual(c.at(0).get('y'), 3);

    function FakeXHRFail() { this.open = () => {}; this.send = () => { this.onerror(); }; }
    c = new window.Ity.Collection([], window.Ity.Model);
    c.url = '/foo';
    global.XMLHttpRequest = function () { return new FakeXHRFail(); };
    c.fetch();
    assert.strictEqual(c.length, 0);
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('internal _ajax defaults work', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    function FakeXHR() { this.open = () => {}; this.send = () => { this.status = 200; this.responseText = '[]'; this.onload(); }; }
    const c = new window.Ity.Collection([], window.Ity.Model);
    global.XMLHttpRequest = function () { return new FakeXHR(); };
    (c as any)._ajax();
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('find returns undefined when no models match', function () {
    const cleanup = setupDOM();
    const c = new window.Ity.Collection();
    const found = c.find(() => false);
    assert.strictEqual(found, undefined);
    cleanup();
  });

  it('_ajax error path invokes error callback', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    let status: number | undefined = undefined;
    function FakeXHRFailStatus() {
      this.open = () => {};
      this.send = () => { this.status = 404; this.onload(); };
    }
    const c = new window.Ity.Collection([], window.Ity.Model);
    c.url = '/foo';
    global.XMLHttpRequest = function () { return new (FakeXHRFailStatus as any)(); };
    c.fetch({ error(s) { status = s; } });
    assert.strictEqual(status, 404);

    function FakeXHRError() { this.open = () => {}; this.send = () => { this.onerror(); }; }
    global.XMLHttpRequest = function () { return new (FakeXHRError as any)(); };
    status = undefined;
    c.fetch({ error(s) { status = s ?? 0; } });
    assert.strictEqual(status, 0);

    global.XMLHttpRequest = originalXHR;
    cleanup();
  });
});
