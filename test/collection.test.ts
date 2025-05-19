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
});
