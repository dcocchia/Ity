// @ts-nocheck
export {};
declare var require: any;
declare const global: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('CommonJS export', function () {
  it('returns Ity from require', function () {
    const cleanup = setupDOM();
    const ity = require('../../Ity.js');
    assert.strictEqual(ity, global.window.Ity);
    cleanup();
    delete require.cache[require.resolve('../../Ity.js')];
  });
});
