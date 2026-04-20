// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('V2 router', function () {
  it('matches routes with params, query and hash context', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router({ autoStart: false });
    let params: any = null;
    let context: any = null;

    router.add('/v2/:id', (p: any, c: any) => {
      params = p;
      context = c;
    });
    router.start();
    router.navigate('/v2/42?tab=info#panel=details');

    assert.deepStrictEqual(params, { id: '42', tab: 'info', panel: 'details' });
    assert.equal(context.path, '/v2/42');
    assert.deepStrictEqual(context.query, { tab: 'info' });
    assert.deepStrictEqual(context.hash, { panel: 'details' });
    assert.strictEqual(router.current().params.id, '42');
    router.stop();
    cleanup();
  });

  it('supports notFound, removeRoute and replace navigation', function () {
    const cleanup = setupDOM();
    let missing = '';
    let hit = false;
    const router = new window.Ity.Router({
      autoStart: false,
      notFound(_params: any, context: any) {
        missing = context.path;
      }
    });

    router.add('/exists', () => {
      hit = true;
    });
    router.navigate('/exists', { replace: true });
    assert.equal(hit, true);

    router.removeRoute('/exists');
    router.navigate('/gone', { replace: true });
    assert.equal(missing, '/gone');
    assert.strictEqual(router.current(), null);
    cleanup();
  });

  it('delegates same-origin link clicks', function () {
    const cleanup = setupDOM('<!DOCTYPE html><a data-ity-link href="/clicked">Click</a>');
    const router = new window.Ity.Router({ autoStart: false });
    let hit = false;
    router.add('/clicked', () => {
      hit = true;
    });
    router.start();

    const anchor = document.querySelector('a');
    anchor.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    assert.equal(hit, true);
    router.stop();
    cleanup();
  });

  it('supports wildcard routes and the convenience route helper', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router({ autoStart: false });
    let wildcard = '';

    router.add('/files/*', (params: any) => {
      wildcard = params.wildcard;
    });
    router.navigate('/files/a/b/c');
    assert.equal(wildcard, 'a/b/c');

    let helperHit = false;
    window.history.pushState(null, '', '/helper');
    const defaultRouter = window.Ity.route('/helper', () => {
      helperHit = true;
    });
    assert.equal(helperHit, true);
    defaultRouter.stop();
    cleanup();
  });

  it('applies base paths to matching, navigation, links and notFound', function () {
    const cleanup = setupDOM(`
      <!DOCTYPE html>
      <a id="inside" data-ity-link href="/app/users/7?tab=info#panel=main">User</a>
      <a id="outside" data-ity-link href="/outside">Outside</a>
    `);
    const router = new window.Ity.Router({
      autoStart: false,
      base: '/app',
      notFound(_params: any, context: any) {
        router.missing = context.path;
      }
    });
    let context: any = null;

    router.add('/users/:id', (_params: any, ctx: any) => {
      context = ctx;
    });
    router.start();
    router.navigate('/users/42?tab=profile');
    assert.strictEqual(window.location.pathname, '/app/users/42');
    assert.strictEqual(context.path, '/users/42');
    assert.strictEqual(context.params.id, '42');

    document.getElementById('inside').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.strictEqual(window.location.pathname, '/app/users/7');
    assert.strictEqual(context.params.panel, 'main');

    const outsideClick = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    document.getElementById('outside').dispatchEvent(outsideClick);
    assert.strictEqual(outsideClick.defaultPrevented, false);

    router.navigate('/app');
    assert.strictEqual(router.missing, '/');

    router.navigate('/app/missing');
    assert.strictEqual(router.missing, '/missing');
    window.history.pushState(null, '', '/outside');
    assert.strictEqual(router.check(), null);
    router.stop();
    cleanup();
  });

  it('runs route cleanup on transitions, route removal and stop', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router({ autoStart: false });
    const events: string[] = [];

    router.add('/one', () => {
      events.push('one');
      return () => events.push('cleanup-one');
    });
    router.add('/two', () => {
      events.push('two');
      return () => events.push('cleanup-two');
    });

    router.navigate('/one');
    router.navigate('/two');
    router.removeRoute('/two');
    router.navigate('/one');
    router.stop();

    assert.deepStrictEqual(events, [
      'one',
      'cleanup-one',
      'two',
      'cleanup-two',
      'one',
      'cleanup-one'
    ]);
    cleanup();
  });

  it('uses native URLPattern when available', function () {
    const cleanup = setupDOM();
    const original = (window as any).URLPattern;
    let constructed = false;
    (window as any).URLPattern = function URLPattern(input: any) {
      constructed = input.pathname === '/native/:id';
      this.exec = (href: string) => href.includes('/native/7')
        ? { pathname: { groups: { id: '7' } } }
        : null;
    };

    const router = new window.Ity.Router({ autoStart: false });
    let id = '';
    router.add('/native/:id', (params: any) => {
      id = params.id;
    });
    router.navigate('/native/7');

    assert.equal(constructed, true);
    assert.equal(id, '7');
    (window as any).URLPattern = original;
    cleanup();
  });

  it('progressively integrates with the Navigation API when available', function () {
    const cleanup = setupDOM();
    const listeners: Record<string, Function> = {};
    const originalNavigation = (window as any).navigation;
    Object.defineProperty(window, 'navigation', {
      configurable: true,
      value: {
        addEventListener(type: string, listener: Function) {
          listeners[type] = listener;
        },
        removeEventListener(type: string, listener: Function) {
          if (listeners[type] === listener) delete listeners[type];
        }
      }
    });

    const router = new window.Ity.Router({ autoStart: false });
    let hit = false;
    router.add('/nav-api', () => {
      hit = true;
    });
    router.start();

    listeners.navigate({
      canIntercept: true,
      destination: { url: `${window.location.origin}/nav-api` },
      intercept({ handler }: any) {
        window.history.pushState(null, '', '/nav-api');
        handler();
      }
    });

    assert.equal(hit, true);
    router.stop();
    assert.strictEqual(listeners.navigate, undefined);

    const baseRouter = new window.Ity.Router({ autoStart: false, base: '/app' });
    let outsideIntercepted = false;
    baseRouter.start();
    listeners.navigate({
      canIntercept: true,
      destination: { url: `${window.location.origin}/outside` },
      intercept() {
        outsideIntercepted = true;
      }
    });
    assert.strictEqual(outsideIntercepted, false);
    baseRouter.stop();

    Object.defineProperty(window, 'navigation', { configurable: true, value: originalNavigation });
    cleanup();
  });

  it('runs notFound cleanup when the route changes or the router stops', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main></main>', 'https://example.com/missing');
    let cleaned = 0;
    const router = new window.Ity.Router({
      autoStart: false,
      notFound() {
        return () => {
          cleaned += 1;
        };
      }
    });

    router.add('/found', () => undefined);
    router.check();
    assert.strictEqual(cleaned, 0);
    router.navigate('/found');
    assert.strictEqual(cleaned, 1);
    router.navigate('/missing-again');
    router.stop();
    assert.strictEqual(cleaned, 2);
    cleanup();
  });
});
