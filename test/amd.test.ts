// @ts-nocheck
export {};
declare var require: any;
declare const global: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('AMD export', function () {
  it('defines module when define.amd is present', function () {
    global.define = function (factory: any) { global._ityModule = factory(); };
    global.define.amd = true;
    const cleanup = setupDOM();
    assert.strictEqual(global._ityModule, global.window.Ity);
    cleanup();
    delete global.define;
    delete global._ityModule;
  });
});
