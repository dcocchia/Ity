// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Ity.onDOMReady', function () {
  it('invokes callback once DOM is ready', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div></div>');
    let ready = false;
    window.Ity.onDOMReady(() => ready = true);
    assert(ready);
    cleanup();
  });

  it('waits for DOMContentLoaded when loading', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div></div>');
    Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
    let ready = false;
    window.Ity.onDOMReady(() => ready = true);
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    assert(ready);
    cleanup();
  });
});
