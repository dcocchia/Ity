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
});
