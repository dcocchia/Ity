// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');
const { JSDOM } = require('jsdom');

// Tests to increase coverage for html insertion paths and onDOMReady

describe('Additional coverage for html and onDOMReady', function () {
  it('inserts HTML when not replacing and not SelectorObject', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="t"></div>');
    const target = new window.Ity.SelectorObject([document.getElementById('t')]);
    target.append('<span id="x"></span>');
    assert.strictEqual(document.querySelector('#t span#x')?.tagName, 'SPAN');
    cleanup();
  });

  it('inserts SelectorObject content correctly', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="t"></div><div class="one"></div><div class="two"></div>');
    const target = new window.Ity.SelectorObject([document.getElementById('t')]);
    const src = new window.Ity.SelectorObject([
      document.querySelector('.one'),
      document.querySelector('.two'),
    ]);
    target.append(src);
    const children = target.first()[0].children;
    assert.strictEqual(children.length, 2);
    assert(children[0].classList.contains('one'));
    assert(children[1].classList.contains('two'));
    cleanup();
  });

  it('waits for DOMContentLoaded when document is loading', function () {
    const dom = new JSDOM('<!DOCTYPE html><p></p>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.NodeList = dom.window.NodeList;
    global.HTMLElement = dom.window.HTMLElement;
    const ity = require('../../Ity.js');
    let ready = false;
    ity.onDOMReady(() => ready = true);
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    assert(ready);
    delete require.cache[require.resolve('../../Ity.js')];
    delete global.window;
    delete global.document;
    delete global.NodeList;
    delete global.HTMLElement;
  });
});
