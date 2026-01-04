// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Coverage edge cases', function () {
  it('covers replace branches for html insertion', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="target"></div><div id="src"><span class="c"></span></div>');
    const target = new window.Ity.SelectorObject([document.getElementById('target')]);
    target._html('<span class="r"></span>', 'replace');
    assert.strictEqual(target.first()[0].innerHTML, '<span class="r"></span>');

    const src = new window.Ity.SelectorObject([document.getElementById('src')]);
    target._html(src, 'replace');
    assert.strictEqual(target.first()[0].querySelectorAll('.c').length, 1);
    cleanup();
  });

  it('uses addEventListener when DOM is still loading', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div></div>');
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, 'readyState');
    const originalAddEventListener = document.addEventListener.bind(document);
    let added = false;
    Object.defineProperty(document, 'readyState', {
      get: () => 'loading',
      configurable: true,
    });
    document.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject, options?: any) {
      if (type === 'DOMContentLoaded') added = true;
      return originalAddEventListener(type, listener, options);
    };
    window.Ity.onDOMReady(() => {});
    assert.strictEqual(added, true);
    if (originalDescriptor) {
      Object.defineProperty(document, 'readyState', originalDescriptor);
    } else {
      delete (document as any).readyState;
    }
    document.addEventListener = originalAddEventListener;
    cleanup();
  });

  it('covers model object-set and application getView path', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const model = new window.Ity.Model();
    model.set({ alpha: 1 });
    assert.deepStrictEqual(model.get(), { alpha: 1 });

    const app = new window.Ity.Application();
    const view = new window.Ity.View({ el: '#v', app });
    assert.strictEqual(app.getView(view.id), view);
    view.off('missing');
    cleanup();
  });

  it('covers selector, view, model, and collection branches', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="parent"><span class="child"></span></div><div id="container"><span class="x"></span></div><div id="v"></div>');
    const parent = document.getElementById('parent');
    const selector = new window.Ity.SelectorObject([parent, parent]);
    const found = selector.find('.child');
    assert.strictEqual(found.length, 1);

    const detached = document.createElement('div');
    const detachedSel = new window.Ity.SelectorObject([detached]);
    assert.strictEqual(detachedSel.parent().length, 0);
    detachedSel.remove();

    const classSel = new window.Ity.SelectorObject([document.getElementById('container')]);
    classSel.removeClass('missing');
    classSel.removeClass('bad value');
    classSel.toggleClass('bad value');

    const model = new window.Ity.Model();
    model.set(123 as any, 'value');
    model.unSet('missing');

    const view = new window.Ity.View({ el: '#v' });
    assert.throws(() => view._setElement(null), /el selector must/);
    view._delegateEvent('.x', 'click', () => {});
    const handler = () => {};
    const ctxA = {};
    const ctxB = {};
    view.on('evt', handler, ctxA);
    view.on('evt', handler, ctxB);
    view.off('evt', handler, ctxA);
    view.off('evt', handler, ctxB);

    const app = new window.Ity.Application();
    app.addView({} as any);
    const appView = new window.Ity.View({ el: '#v', app });
    app.removeView('missing');
    app.removeView(appView.id);

    const collection = new window.Ity.Collection();
    const m1 = new window.Ity.Model();
    collection.add(m1);
    assert.strictEqual(collection.get('missing'), undefined);
    cleanup();
  });
});
