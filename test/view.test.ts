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

  it('handles events for dynamically added elements', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><div class="c"></div></div>');
    let clicked = false;
    const view = new window.Ity.View({
      el: '#v',
      events: { '.btn': { click: 'onClick' } },
      onClick: function () { clicked = true; }
    });
    const container = document.querySelector('.c');
    container.innerHTML = '<button class="btn"></button>';
    const btn = container.querySelector('button');
    btn.dispatchEvent(new window.Event('click'));
    assert(clicked);
    cleanup();
  });

  it('supports multiple event listeners', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const view = new window.Ity.View({ el: '#v' });
    let a = false; let b = false;
    view.on('foo', () => a = true);
    view.on('foo', () => b = true);
    view.trigger('foo');
    assert(a && b);
    cleanup();
  });

  it('off removes view event listeners', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const view = new window.Ity.View({ el: '#v' });
    let called = false;
    function cb() { called = true; }
    view.on('bar', cb);
    view.off('bar', cb);
    view.trigger('bar');
    assert.strictEqual(called, false);
    cleanup();
  });

  it('delegates focus events using capture', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><input id="i"></div>');
    let focused = false;
    const view = new window.Ity.View({
      el: '#v',
      events: { '#i': { focus: 'onFocus' } },
      onFocus: function () { focused = true; }
    });
    const inp = document.getElementById('i');
    inp.dispatchEvent(new window.Event('focus'));
    assert(focused);
    cleanup();
  });
});
