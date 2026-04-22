// @ts-nocheck
/*! @jest-environment node */
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');

describe('Node environment bootstrap', function () {
  it('loads without window and exports Ity', function () {
    const hadWindow = Object.prototype.hasOwnProperty.call(global, 'window');
    const prevWindow = global.window;
    if (hadWindow) {
      delete global.window;
    }
    const ity = require('../../Ity.js');
    const pkg = require('../../package.json');
    assert.strictEqual(typeof global.window, 'undefined');
    assert.ok(ity);
    assert.strictEqual(ity.version, pkg.version);
    const router = new ity.Router({ autoStart: false });
    (router as any).handleLinkClick({
      target: {
        closest() {
          return { target: '', hasAttribute: () => false, href: '/nowhere' };
        }
      }
    });
    if (hadWindow) {
      global.window = prevWindow;
    }
  });

});
