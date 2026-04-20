// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Coverage Gaps', function () {
  it('Collection.trigger with no models', function () {
    const cleanup = setupDOM();
    const c = new window.Ity.Collection();
    // Should not throw and should complete coverage for the loop
    c.trigger('foo');
    assert.strictEqual(c.length, 0);
    cleanup();
  });

  it('Router with no matching route', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let hit = false;
    router.addRoute('/foo', () => { hit = true; });
    // Navigate to a route that doesn't exist
    router.navigate('/bar');
    assert.strictEqual(hit, false);
    cleanup();
  });
});
