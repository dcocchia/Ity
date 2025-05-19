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
});
