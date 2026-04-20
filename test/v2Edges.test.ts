// @ts-nocheck
export {};
declare var require: any;
declare const global: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('V2 production edge cases', function () {
  it('supports immediate subscribers, custom equality and callable setters', function () {
    const cleanup = setupDOM();
    const values: any[] = [];
    const count = window.Ity.signal(1, { equals: (a: number, b: number) => Math.floor(a) === Math.floor(b) });
    const unsubscribe = count.subscribe((value: number, previous: number) => values.push([value, previous]), { immediate: true });

    count(1.5);
    count(2);
    unsubscribe();

    assert.deepStrictEqual(values, [[1, 1], [2, 1]]);
    assert.equal(count.get(), 2);
    cleanup();
  });

  it('supports computed subscriptions and disposal idempotence', function () {
    const cleanup = setupDOM();
    const count = window.Ity.signal(1);
    const parity = window.Ity.computed(() => count() % 2, { equals: Object.is });
    const seen: any[] = [];
    const unsubscribe = parity.subscribe((value: number, previous: number) => seen.push([value, previous]), { immediate: true });
    const dispose = window.Ity.effect(() => {
      parity();
    });

    count.set(3);
    count.set(4);
    unsubscribe();
    dispose();
    dispose();

    assert.deepStrictEqual(seen, [[1, 1], [0, 1]]);
    cleanup();
  });

  it('covers store proxy reflection and deletion behavior', function () {
    const cleanup = setupDOM();
    const state = window.Ity.store({ a: 1, b: 2 });
    const snapshots: any[] = [];
    const unsubscribe = state.$subscribe((value: any) => snapshots.push(value));

    assert.equal('a' in state, true);
    assert(Object.keys(state).includes('a'));
    assert.equal(Object.getOwnPropertyDescriptor(state, 'a').enumerable, true);
    state.a = 3;
    delete state.b;
    delete state.missing;
    unsubscribe();

    assert.deepStrictEqual(state.$snapshot(), { a: 3 });
    assert.deepStrictEqual(snapshots, [{ a: 3, b: 2 }]);
    cleanup();
  });

  it('covers event tuple bindings, null attributes and empty SelectorObject render targets', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    let clicked = 0;
    const listener = () => {
      clicked += 1;
    };

    window.Ity.render(window.Ity.html`
      <button @click=${[listener, { once: true }]} data-off=${null} aria-current=${true}>go</button>
    `, '#root', { reactive: false });

    const button = document.querySelector('button');
    button.click();
    button.click();
    assert.equal(clicked, 1);
    assert.equal(button.hasAttribute('data-off'), false);
    assert.equal(button.getAttribute('aria-current'), '');
    assert.throws(() => window.Ity.render(window.Ity.html`<p></p>`, new window.Ity.SelectorObject([])));
    cleanup();
  });

  it('covers replaceChildren fallback', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"><span>old</span></main>');
    const root = document.getElementById('root');
    const nativeReplace = root.replaceChildren;
    root.replaceChildren = undefined;

    window.Ity.render(window.Ity.html`<p>fallback</p>`, root, { reactive: false });

    assert.equal(root.textContent, 'fallback');
    root.replaceChildren = nativeReplace;
    cleanup();
  });

  it('covers SelectorObject V2 helpers and insertion branches', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main><div id="a"></div><div id="b"></div><span id="src">src</span></main>');
    const a = new window.Ity.SelectorObject([document.getElementById('a')]);
    const src = new window.Ity.SelectorObject([document.getElementById('src')]);
    let clicked = 0;
    const onClick = () => clicked += 1;

    assert.equal(a.toArray().length, 1);
    a.attr('role', 'button').attr('hidden', true).text('text').on('click', onClick);
    a[0].dispatchEvent(new window.Event('click'));
    a.off('click', onClick).empty();
    a.append(window.Ity.html`<em>template</em>`);
    a.prepend(document.createElement('strong'));
    a.before(src);
    a.after('<p id="after"></p>');
    a.attr('hidden', null);

    assert.equal(clicked, 1);
    assert.equal(a.attr('role'), 'button');
    assert.equal(a.text(), 'template');
    assert.equal(a[0].querySelector('em').textContent, 'template');
    assert.equal(document.getElementById('after').tagName, 'P');
    assert.equal(a[0].hasAttribute('hidden'), false);
    cleanup();
  });

  it('covers Model and Collection subscriptions, JSON parse failures and request bodies', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    const model = new window.Ity.Model({ url: '/model' });
    const collection = new window.Ity.Collection([], window.Ity.Model);
    let modelState: any = null;
    let collectionStateLength = -1;
    let modelError: any = null;
    let collectionError: any = null;
    const sentBodies: any[] = [];

    model.subscribe((value: any) => { modelState = value; });
    collection.subscribe((value: any[]) => { collectionStateLength = value.length; });
    model.set('x', 1);
    collection.add(new window.Ity.Model());
    assert.deepStrictEqual(modelState, { x: 1 });
    assert.equal(collectionStateLength, 1);
    assert.deepStrictEqual(model.toJSON(), { x: 1 });
    assert.equal(collection.map((m: any) => m.id).length, 1);

    function BadJSON() {
      this.open = () => {};
      this.send = (body: any) => {
        sentBodies.push(body);
        this.status = 200;
        this.responseText = '{bad';
        this.onload();
      };
    }
    global.XMLHttpRequest = function () { return new BadJSON(); };
    model.sync({ data: { a: 1 }, error(_status: number, err: any) { modelError = err; } });
    collection.fetch({ error(_status: number, err: any) { collectionError = err; } });

    assert(sentBodies.some((body) => typeof body === 'string' && body.includes('"a":1')));
    assert(modelError instanceof Error);
    assert(collectionError instanceof Error);
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('covers View renderWith replacement and missing handler validation', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><button class="b"></button></div>');
    const view = new window.Ity.View({ el: '#v' });
    view.renderWith(window.Ity.html`<p>one</p>`);
    view.renderWith(window.Ity.html`<p>two</p>`);
    assert.equal(document.querySelector('#v p').textContent, 'two');

    assert.throws(() => new window.Ity.View({
      el: '#v',
      events: { '.b': { click: 'missingHandler' } }
    }));
    cleanup();
  });

  it('covers router start idempotence, link ignores, native miss and URLPattern fallback', function () {
    const cleanup = setupDOM('<!DOCTYPE html><a id="external" data-ity-link href="https://example.com/x"></a><a id="download" data-ity-link href="/file" download></a>');
    const original = (window as any).URLPattern;
    (window as any).URLPattern = function URLPattern(input: any) {
      if (input.pathname === '/throw') throw new Error('unsupported pattern');
      this.exec = () => null;
    };

    const router = new window.Ity.Router({ autoStart: false });
    let fallback = false;
    router.add('/throw', () => { fallback = true; });
    router.add('/native-miss', () => { throw new Error('should not hit'); });
    router.start();
    router.start();
    router.navigate('/throw');
    document.getElementById('external').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    document.getElementById('download').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    assert.equal(fallback, true);
    router.stop();
    (window as any).URLPattern = original;
    cleanup();
  });
});
