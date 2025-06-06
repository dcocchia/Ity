// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Router', function () {
  it('navigates to a route', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let hit = false;
    router.addRoute('/foo', () => { hit = true; });
    router.navigate('/foo');
    assert(hit);
    cleanup();
  });

  it('passes params from route', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let param: string | undefined;
    router.addRoute('/users/:id', (p) => { param = p.id; });
    router.navigate('/users/42');
    assert.equal(param, '42');
    cleanup();
  });

  it('start and stop listening to popstate', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let count = 0;
    router.addRoute('/bar', () => { count++; });
    router.navigate('/bar');
    assert.equal(count, 1);
    router.stop();
    window.history.pushState(null, '', '/bar');
    window.dispatchEvent(new window.Event('popstate'));
    assert.equal(count, 1);
    router.start();
    window.history.pushState(null, '', '/bar');
    window.dispatchEvent(new window.Event('popstate'));
    assert.equal(count, 3);
    cleanup();
  });

  it('avoids duplicate listeners on repeated start', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let count = 0;
    router.addRoute('/dup', () => { count++; });
    router.start();
    router.start();
    window.history.pushState(null, '', '/dup');
    window.dispatchEvent(new window.Event('popstate'));
    assert.equal(count, 1);
    cleanup();
  });

  it('parses query and hash parameters', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let params: any;
    router.addRoute('/users/:id', (p) => { params = p; });
    router.navigate('/users/7?foo=bar#baz=qux');
    assert.deepStrictEqual(params, { id: '7', foo: 'bar', baz: 'qux' });
    cleanup();
  });

  it('parses query and hash without path params', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router();
    let params: any;
    router.addRoute('/test', p => { params = p; });
    router.navigate('/test?x=1#y=2');
    assert.deepStrictEqual(params, { x: '1', y: '2' });
    cleanup();
  });
});
