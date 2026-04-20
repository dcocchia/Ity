/**
 * @jest-environment node
 */
const assert = require('assert');
const path = require('path');

describe('No-DOM public fallbacks', function () {
  it('runs no-window and no-document branches without a browser global', function () {
    const windowDescriptor = Object.getOwnPropertyDescriptor(global, 'window');
    const documentDescriptor = Object.getOwnPropertyDescriptor(global, 'document');
    Object.defineProperty(global, 'window', { configurable: true, value: undefined });
    Object.defineProperty(global, 'document', { configurable: true, value: undefined });
    const ityPath = process.env.ITY_FILE
      ? path.resolve(__dirname, '../build/test', process.env.ITY_FILE)
      : path.resolve(__dirname, '../Ity.js');
    delete require.cache[require.resolve(ityPath)];
    const ity = require(ityPath);
    let ready = 0;

    try {
      ity.onDOMReady(() => {
        ready += 1;
      });
      assert.strictEqual(ready, 1);

      Object.defineProperty(global, 'document', {
        configurable: true,
        value: { readyState: 'complete' }
      });
      ity.onDOMReady(() => {
        ready += 1;
      });
      assert.strictEqual(ready, 2);
      Object.defineProperty(global, 'document', { configurable: true, value: undefined });

      const router = new ity.Router({ autoStart: false });
      assert.strictEqual(router.check(), null);
      router.navigate('/nowhere');
      router.start();
      router.stop();
      assert.throws(() => ity.render(ity.html`<p></p>`, '#root'), /Ity DOM rendering requires a document/);
      assert.throws(() => ity.component('ity-no-window-fallback', () => ity.html`<p></p>`), /Custom Elements support/);
    } finally {
      if (windowDescriptor) Object.defineProperty(global, 'window', windowDescriptor);
      else delete global.window;
      if (documentDescriptor) Object.defineProperty(global, 'document', documentDescriptor);
      else delete global.document;
    }
  });
});
