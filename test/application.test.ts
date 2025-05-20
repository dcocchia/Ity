// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Application', function () {
  it('add, get and remove views', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const app = new window.Ity.Application();
    const view = new window.Ity.View({ el: '#v', app });
    assert.strictEqual(app.getView(view.id), view);
    app.removeView(view.id);
    assert.strictEqual(app.getView(view.id), undefined);
    cleanup();
  });

  it('getView finds the correct view among multiple', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v1"></div><div id="v2"></div>');
    const app = new window.Ity.Application();
    new window.Ity.View({ el: '#v1', app });
    const view2 = new window.Ity.View({ el: '#v2', app });
    assert.strictEqual(app.getView(view2.id), view2);
    cleanup();
  });

  it('triggers events on child views', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const app = new window.Ity.Application();
    const view = new window.Ity.View({ el: '#v', app });
    let triggered = false;
    view.on('foo', () => triggered = true);
    app.trigger('foo');
    assert(triggered);
    cleanup();
  });

  it('returns undefined for missing view', function () {
    const cleanup = setupDOM();
    const app = new window.Ity.Application();
    assert.strictEqual(app.getView('missing'), undefined);
    cleanup();
  });
});
