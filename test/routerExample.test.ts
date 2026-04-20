// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

function loadRouterExample(): any {
  const modulePath = '../Examples/Router/routerApp.js';
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return window.ItyExamples.createRouterApp;
}

describe('Router example', function () {
  it('renders route content from a V2 page signal', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="routerApp"></div>');
    window.history.pushState(null, '', '/');
    const createRouterApp = loadRouterExample();
    const app = createRouterApp(window.Ity, '#routerApp');

    assert.strictEqual(app.page(), 'Home');
    assert.strictEqual(document.querySelector('.content')?.textContent, 'Home');

    app.router.stop();
    app.dispose();
    cleanup();
  });

  it('navigates to user routes from rendered V2 event handlers', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="routerApp"></div>');
    window.history.pushState(null, '', '/');
    const createRouterApp = loadRouterExample();
    const app = createRouterApp(window.Ity, '#routerApp');
    const userBtn = document.querySelector('.userLink[data-calc-id="2"]') as HTMLElement;

    userBtn.click();

    assert.strictEqual(app.page(), 'User 2');
    assert.strictEqual(document.querySelector('.content')?.textContent, 'User 2');
    app.router.stop();
    app.dispose();
    cleanup();
  });

  it('keeps route helpers callable for tests and demos', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="routerApp"></div>');
    window.history.pushState(null, '', '/');
    const createRouterApp = loadRouterExample();
    const app = createRouterApp(window.Ity, '#routerApp');

    app.goUser('5');
    assert.strictEqual(app.page(), 'User 5');
    app.goHome();
    assert.strictEqual(app.page(), 'Home');

    app.router.stop();
    app.dispose();
    cleanup();
  });
});
