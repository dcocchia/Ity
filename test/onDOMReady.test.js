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
});
