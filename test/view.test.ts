// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('View functionality', function () {
  it('set and get attributes', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const view = new window.Ity.View({ el: '#v' });
    view.set('name', 'test');
    assert.equal(view.get('name'), 'test');
    cleanup();
  });

  it('selects elements within context', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><span class="x"></span></div>');
    const view = new window.Ity.View({ el: '#v' });
    const spans = view.select('span');
    assert.equal(spans.length, 1);
    cleanup();
  });

  it('remove removes element from DOM', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const view = new window.Ity.View({ el: '#v' });
    view.remove();
    assert.strictEqual(document.getElementById('v'), null);
    cleanup();
  });
  it('binds events and supports _setElement', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><button class="b"></button><span id="src"></span></div>');
    let clicked = false;
    const view = new window.Ity.View({
      el: '#v',
      name: 'testView',
      events: {
        'button': { click: 'onClick' }
      },
      onClick: function () { clicked = true; }
    });
    view._setElement(document.querySelectorAll('#v'));
    view._setElement(new window.Ity.SelectorObject([document.getElementById('v')]));
    view.onClick({});
    assert(clicked);
    assert.equal(view.getName(), 'testView');
    view.select('span', view.select('#v'));
    view.remove();
    assert.strictEqual(document.getElementById('v'), null);
    cleanup();
  });
});
