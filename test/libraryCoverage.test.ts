// @ts-nocheck
export {};
declare var require: any;
declare const global: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Library coverage expansion', function () {
  it('exercises subscriber loops, computed subscriber notifications and cleanup reruns', function () {
    const cleanup = setupDOM();
    const count = window.Ity.signal(1);
    const computedValue = window.Ity.computed(() => count() * 10);
    const signalEvents: any[] = [];
    const computedEvents: any[] = [];
    let cleanupRuns = 0;

    count.subscribe((value: number, previous: number) => signalEvents.push([value, previous]));
    computedValue.subscribe((value: number, previous: number) => computedEvents.push([value, previous]));
    assert.strictEqual(computedValue.get(), 10);
    assert.strictEqual(computedValue.peek(), 10);

    const dispose = window.Ity.effect((onCleanup: any) => {
      onCleanup(() => {
        cleanupRuns += 1;
      });
      computedValue();
    });

    count((value: number) => value + 1);
    count.set(2);
    count.set(3);
    computedValue.subscribe(() => {}, { immediate: true })();
    dispose();

    assert.deepStrictEqual(signalEvents, [[2, 1], [3, 2]]);
    assert.deepStrictEqual(computedEvents, [[20, 10], [30, 20]]);
    assert(cleanupRuns >= 2);
    cleanup();
  });

  it('covers store first-subscription skip and direct render target branches', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const state = window.Ity.store({ count: 1 });
    let calls = 0;
    const unsubscribe = state.$subscribe(() => {
      calls += 1;
    });
    state.count = 2;
    unsubscribe();

    const selectorTarget = new window.Ity.SelectorObject([document.getElementById('root')]);
    const dispose = window.Ity.render(() => window.Ity.html`<span>${state.count}</span>`, selectorTarget);
    assert.strictEqual(document.querySelector('span')?.textContent, '2');
    assert.throws(() => window.Ity.render(window.Ity.html`<p></p>`, new window.Ity.SelectorObject([])));

    const root = document.getElementById('root');
    const nativeReplace = root.replaceChildren;
    root.replaceChildren = undefined;
    window.Ity.render(window.Ity.html`<b>fallback</b>`, root, { reactive: false });
    root.replaceChildren = nativeReplace;

    (document as any).startViewTransition = (update: Function) => update();
    window.Ity.render(window.Ity.html`<i>transition</i>`, root, { reactive: false, transition: true });
    delete (document as any).startViewTransition;

    assert.strictEqual(calls, 1);
    assert.strictEqual(root.textContent, 'transition');
    dispose();
    cleanup();
  });

  it('renders direct values into document fragments and covers value normalization branches', function () {
    const cleanup = setupDOM();
    const fragment = document.createDocumentFragment();
    const strong = document.createElement('strong');
    strong.textContent = 'node';
    const direct = window.Ity.signal(window.Ity.html`
      ${[
        null,
        undefined,
        false,
        'safe',
        window.Ity.html`<em>template</em>`,
        window.Ity.unsafeHTML('<span>raw</span>'),
        strong,
        42
      ]}
    `);

    const dispose = window.Ity.render(direct, fragment);

    assert(fragment.textContent.includes('safe'));
    assert.strictEqual(fragment.querySelector('em')?.textContent, 'template');
    assert.strictEqual(fragment.querySelector('span')?.textContent, 'raw');
    assert.strictEqual(fragment.querySelector('strong')?.textContent, 'node');
    assert(fragment.textContent.includes('42'));
    dispose();
    cleanup();
  });

  it('applies every DOM binding kind in a direct non-reactive render', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    let clicked = 0;

    window.Ity.render(window.Ity.html`
      <input
        @click=${() => { clicked += 1; }}
        @focus=${[() => { clicked += 10; }, { once: true }]}
        .value=${'prop-value'}
        ?checked=${true}
        ?disabled=${false}
        data-remove=${undefined}
        data-true=${true}
        class=${{ active: true, inactive: false }}
        style=${{ borderTopColor: 'red' }}
      >
      <p class=${['one', null, 'two']} data-false=${false}>text</p>
    `, '#root', { reactive: false });

    const input = document.querySelector('input') as HTMLInputElement;
    const paragraph = document.querySelector('p') as HTMLElement;
    input.click();
    input.dispatchEvent(new window.Event('focus'));
    input.dispatchEvent(new window.Event('focus'));

    assert.strictEqual(clicked, 11);
    assert.strictEqual(input.value, 'prop-value');
    assert.strictEqual(input.hasAttribute('checked'), true);
    assert.strictEqual(input.hasAttribute('disabled'), false);
    assert.strictEqual(input.hasAttribute('data-remove'), false);
    assert.strictEqual(input.getAttribute('data-true'), '');
    assert.strictEqual(input.className, 'active');
    assert.strictEqual(input.style.borderTopColor, 'red');
    assert.strictEqual(paragraph.className, 'one two');
    assert.strictEqual(paragraph.hasAttribute('data-false'), false);
    cleanup();
  });

  it('serializes all renderToString branches including nodes and skipped bindings', function () {
    const cleanup = setupDOM();
    const div = document.createElement('div');
    div.textContent = 'outer';
    const textNode = document.createTextNode('<text>');
    const markup = window.Ity.renderToString([
      null,
      false,
      ['nested'],
      window.Ity.html`
        <a
          href=${'"/path?x=<y>'}
          class=${{ on: true, off: false }}
          style=${{ backgroundColor: 'blue', marginTop: '1px' }}
          ?hidden=${false}
          .value=${'ignored'}
          @click=${() => {}}
        >${'link&text'}</a>
      `,
      div,
      textNode,
      window.Ity.unsafeHTML('<b>trusted</b>')
    ]);

    assert(markup.includes('nested'));
    assert(markup.includes('href="&quot;/path?x=&lt;y&gt;"'));
    assert(markup.includes('class="on"'));
    assert(markup.includes('background-color:blue;margin-top:1px'));
    assert(!markup.includes('hidden'));
    assert(!markup.includes('ignored'));
    assert(!markup.includes('@click'));
    assert(markup.includes('link&amp;text'));
    assert(markup.includes('<div>outer</div>'));
    assert(markup.includes('&lt;text&gt;'));
    assert(markup.includes('<b>trusted</b>'));
    cleanup();
  });

  it('serializes boolean and true attributes plus non-element text nodes', function () {
    const cleanup = setupDOM();
    const textNode = document.createTextNode('ampersand & text');
    const markup = window.Ity.renderToString(window.Ity.html`
      <option selected=${true} ?disabled=${true} title=${"Tom's \"quote\""}>${textNode}</option>
    `);

    assert(markup.includes('selected=""'));
    assert(markup.includes('disabled'));
    assert(markup.includes('Tom&#39;s &quot;quote&quot;'));
    assert(markup.includes('ampersand &amp; text'));
    cleanup();
  });

  it('serializes function views and empty values', function () {
    const cleanup = setupDOM();
    assert.strictEqual(window.Ity.renderToString(() => null), '');
    assert.strictEqual(window.Ity.renderToString(() => window.Ity.html`<p>${'x'}</p>`), '<p>x</p>');
    cleanup();
  });

  it('covers selector insertion branches for selector, template, node and string content', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main><div id="target"></div><p id="source">source</p></main>');
    const target = new window.Ity.SelectorObject([document.getElementById('target')]);
    const source = new window.Ity.SelectorObject([document.getElementById('source')]);
    const node = document.createElement('section');
    node.textContent = 'node';

    target.html(source);
    assert.strictEqual(target[0].querySelector('#source')?.textContent, 'source');
    target.after(source);
    assert.strictEqual(document.querySelectorAll('#source').length >= 2, true);
    target.html(window.Ity.html`<em>template</em>`);
    assert.strictEqual(target[0].querySelector('em')?.textContent, 'template');
    target.before(window.Ity.html`<aside>template before</aside>`);
    assert.strictEqual(document.querySelector('aside')?.textContent, 'template before');
    target.html(node);
    assert.strictEqual(target[0].querySelector('section')?.textContent, 'node');
    target.after(document.createElement('footer'));
    target.after('<small>string</small>');
    assert.strictEqual(document.querySelector('small')?.textContent, 'string');
    cleanup();
  });

  it('covers router guard branches and global URLPattern fallback', function () {
    const cleanup = setupDOM('<!DOCTYPE html><button id="plain"></button><a id="blank" data-ity-link href="/blank" target="_blank"></a>');
    const originalWindowPattern = (window as any).URLPattern;
    const originalGlobalPattern = (globalThis as any).URLPattern;
    (window as any).URLPattern = undefined;
    (globalThis as any).URLPattern = function URLPattern(input: any) {
      this.input = input;
      this.exec = (href: string) => href.includes('/global/9')
        ? { pathname: { groups: { id: '9' } } }
        : null;
    };

    const router = new window.Ity.Router({ autoStart: false });
    let id = '';
    router.add('/global/:id', (params: any) => {
      id = params.id;
    });
    router.start();
    router.start();
    router.navigate('/global/9');
    document.getElementById('plain').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    document.getElementById('blank').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    (router as any).handleNavigationEvent(null);
    (router as any).handleNavigationEvent({ canIntercept: false });
    (router as any).handleNavigationEvent({
      canIntercept: true,
      destination: { url: 'https://example.com/outside' },
      intercept() {
        throw new Error('external navigation should not be intercepted');
      }
    });

    assert.strictEqual(id, '9');
    router.stop();
    router.stop();
    (window as any).URLPattern = originalWindowPattern;
    (globalThis as any).URLPattern = originalGlobalPattern;
    cleanup();
  });

  it('covers router notFound context and same-origin Navigation API interception', function () {
    const cleanup = setupDOM();
    const router = new window.Ity.Router({
      autoStart: false,
      notFound(_params: any, context: any) {
        router.lastMissing = context;
      }
    });

    router.start();
    router.navigate('/missing?x=1#y=2');
    assert.strictEqual(router.lastMissing.path, '/missing');
    assert.deepStrictEqual(router.lastMissing.query, { x: '1' });
    assert.deepStrictEqual(router.lastMissing.hash, { y: '2' });

    let intercepted = false;
    (router as any).handleNavigationEvent({
      canIntercept: true,
      destination: { url: `${window.location.origin}/missing?x=3` },
      intercept({ handler }: any) {
        intercepted = true;
        window.history.pushState(null, '', '/missing?x=3');
        handler();
      }
    });

    assert.strictEqual(intercepted, true);
    assert.deepStrictEqual(router.lastMissing.query, { x: '3' });
    router.stop();
    cleanup();
  });

  it('covers fallback route root, wildcard and same-origin link click paths', function () {
    const cleanup = setupDOM('<!DOCTYPE html><a data-ity-link href="/clicked/abc?ok=1#hash=2">Click</a>');
    const originalPattern = (window as any).URLPattern;
    (window as any).URLPattern = undefined;
    const router = new window.Ity.Router({ autoStart: false });
    let rootHit = false;
    let wildcard = '';

    router.add('', () => {
      rootHit = true;
    });
    router.add('/clicked/*', (params: any) => {
      wildcard = params.wildcard;
    });
    router.start();
    router.navigate('/');
    (document.querySelector('a') as HTMLElement).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    assert.strictEqual(rootHit, true);
    assert.strictEqual(wildcard, 'abc');
    router.stop();
    (window as any).URLPattern = originalPattern;
    cleanup();
  });

  it('covers AJAX empty responses, status errors and user fetch success callbacks', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    const queue: any[] = [];
    const model = new window.Ity.Model({ url: '/model' });
    const collection = new window.Ity.Collection([], window.Ity.Model);
    let modelDefault: any = 'unset';
    let statusError = 0;
    let userSuccessCalled = false;

    function FakeXHR() {
      const next = queue.shift();
      this.open = () => {};
      this.send = () => {
        this.status = next.status;
        this.responseText = next.responseText;
        this.onload();
      };
    }

    global.XMLHttpRequest = function () { return new FakeXHR(); };
    queue.push({ status: 200, responseText: '' });
    model.sync();
    modelDefault = model.get();

    queue.push({ status: 500, responseText: '' });
    model.sync({ error(status: number) { statusError = status; } });

    queue.push({ status: 200, responseText: '[{"name":"A"}]' });
    collection.fetch({ success() { userSuccessCalled = true; } });

    assert.strictEqual(modelDefault, null);
    assert.strictEqual(statusError, 500);
    assert.strictEqual(collection.length, 1);
    assert.strictEqual(userSuccessCalled, true);
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('covers AJAX parse errors and collection status errors directly', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    const queue: any[] = [];
    const model = new window.Ity.Model({ url: '/model' });
    const collection = new window.Ity.Collection([], window.Ity.Model);
    let modelParseError: any = null;
    let collectionStatus = 0;

    function FakeXHR() {
      const next = queue.shift();
      this.open = () => {};
      this.send = () => {
        this.status = next.status;
        this.responseText = next.responseText;
        this.onload();
      };
    }

    global.XMLHttpRequest = function () { return new FakeXHR(); };
    queue.push({ status: 200, responseText: '{bad' });
    model.sync({ error(_status: number, err: any) { modelParseError = err; } });
    queue.push({ status: 500, responseText: '' });
    collection.fetch({ error(status: number) { collectionStatus = status; } });

    assert(modelParseError instanceof Error);
    assert.strictEqual(collectionStatus, 500);
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('covers view element input branches and Evented trigger delivery', function () {
    const cleanup = setupDOM('<!DOCTYPE html><section id="root"><button class="b"></button></section>');
    const root = document.getElementById('root');
    const fromNodeList = new window.Ity.View({ el: document.querySelectorAll('#root') });
    const fromElement = new window.Ity.View({ el: root });
    const fromSelector = new window.Ity.View({ el: new window.Ity.SelectorObject([root]) });
    let clicked = 0;
    let missed = 0;
    const eventView = new window.Ity.View({
      el: '#root',
      events: {
        '.b': { click: 'onClick' },
        '.never': { click: 'onMiss' }
      },
      onClick() {
        clicked += 1;
      },
      onMiss() {
        missed += 1;
      }
    });
    let delivered = 0;

    fromSelector.on('custom', () => {
      delivered += 1;
    });
    fromSelector.trigger('custom');
    (document.querySelector('.b') as HTMLElement).click();
    root.click();
    assert.throws(
      () => new window.Ity.View({ el: '#root', events: { '.b': { click: 'missingHandler' } } }),
      /View event handler not found/
    );
    assert.throws(() => new window.Ity.View({ el: 1 as any }));
    fromNodeList.remove();

    assert.strictEqual(fromElement.el[0], root);
    assert.strictEqual(fromSelector.el[0], root);
    assert.strictEqual(delivered, 1);
    assert.strictEqual(clicked, 1);
    assert.strictEqual(missed, 0);
    eventView.remove();
    cleanup();
  });

  it('defers onDOMReady callbacks while the document is loading', function () {
    const cleanup = setupDOM();
    let readyState = 'loading';
    let calls = 0;
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get() {
        return readyState;
      }
    });

    window.Ity.onDOMReady(() => {
      calls += 1;
    });

    assert.strictEqual(calls, 0);
    readyState = 'complete';
    document.dispatchEvent(new window.Event('DOMContentLoaded'));
    assert.strictEqual(calls, 1);
    cleanup();
  });

  it('covers component support errors and object shadow initialization', function () {
    const cleanup = setupDOM();
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'customElements');
    const originalCustomElements = window.customElements;
    Object.defineProperty(window, 'customElements', { configurable: true, get: () => undefined });
    assert.throws(() => window.Ity.component('ity-no-support', () => window.Ity.html`<p></p>`));
    Object.defineProperty(
      window,
      'customElements',
      originalDescriptor || { configurable: true, get: () => originalCustomElements }
    );
    const originalHTMLElementDescriptor = Object.getOwnPropertyDescriptor(window, 'HTMLElement');
    const originalHTMLElement = window.HTMLElement;
    Object.defineProperty(window, 'HTMLElement', { configurable: true, get: () => undefined });
    assert.throws(() => window.Ity.component('ity-no-HTMLElement-support', () => window.Ity.html`<p></p>`));
    Object.defineProperty(
      window,
      'HTMLElement',
      originalHTMLElementDescriptor || { configurable: true, get: () => originalHTMLElement }
    );

    const tag = 'ity-object-shadow-a';
    const firstDefinition = window.Ity.component(tag, {
      shadow: { mode: 'open', delegatesFocus: false },
      styles: 'p { color: red; }',
      setup() {
        return window.Ity.html`<p>shadow</p>`;
      }
    });
    const secondDefinition = window.Ity.component(tag, () => window.Ity.html`<p>again</p>`);
    const el = document.createElement(tag);
    document.body.appendChild(el);
    const lightTag = 'ity-light-coverage-a';
    window.Ity.component(lightTag, () => window.Ity.html`<span>light</span>`, { shadow: false });
    const light = document.createElement(lightTag);
    document.body.appendChild(light);
    const lifecycle: string[] = [];
    const lifecycleTag = 'ity-lifecycle-coverage-a';
    window.Ity.component(lifecycleTag, {
      attrs: ['mode'],
      shadow: 'closed',
      setup(ctx: any) {
        ctx.onConnected(() => lifecycle.push('connected'));
        ctx.onDisconnected(() => lifecycle.push('disconnected'));
        ctx.effect((onCleanup: any) => {
          ctx.attr('mode')();
          onCleanup(() => lifecycle.push('effect-cleanup'));
        });
      }
    });
    const lifecycleElement = document.createElement(lifecycleTag);
    lifecycleElement.setAttribute('mode', 'one');
    document.body.appendChild(lifecycleElement);
    (lifecycleElement as any).connectedCallback();
    lifecycleElement.setAttribute('mode', 'two');
    lifecycleElement.remove();
    const noSetupTag = 'ity-no-setup-coverage-a';
    window.Ity.component(noSetupTag, { shadow: false });
    document.body.appendChild(document.createElement(noSetupTag));
    const defaultShadowTag = 'ity-default-shadow-coverage-a';
    window.Ity.component(defaultShadowTag, () => window.Ity.html`<strong>default</strong>`);
    const defaultShadow = document.createElement(defaultShadowTag);
    document.body.appendChild(defaultShadow);
    assert.strictEqual(firstDefinition, secondDefinition);
    assert.strictEqual(el.shadowRoot.querySelector('p')?.textContent, 'shadow');
    assert.strictEqual(el.shadowRoot.querySelector('style')?.textContent.includes('color'), true);
    assert.strictEqual(light.querySelector('span')?.textContent, 'light');
    assert.strictEqual(defaultShadow.shadowRoot.querySelector('strong')?.textContent, 'default');
    assert(lifecycle.includes('connected'));
    assert(lifecycle.includes('disconnected'));
    assert(lifecycle.includes('effect-cleanup'));
    cleanup();
  });

  it('covers remaining legacy and router fallback branches directly', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><button class="b"></button></div>');
    const originalPattern = (window as any).URLPattern;
    (window as any).URLPattern = function URLPattern() {
      throw new Error('native unavailable');
    };
    const model = new window.Ity.Model();
    const router = new window.Ity.Router({ autoStart: false });
    let userId = '';
    model.set('name', 'Ada');
    router.add('/people/:id', (params: any) => {
      userId = params.id;
    });
    router.navigate('/people/12');

    assert.strictEqual(model.get('name'), 'Ada');
    assert.strictEqual(userId, '12');
    router.stop();
    (window as any).URLPattern = originalPattern;
    cleanup();
  });

  it('covers collection fetch parse errors', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    let parseError: any = null;
    function BadJSON() {
      this.open = () => {};
      this.send = () => {
        this.status = 200;
        this.responseText = '[bad';
        this.onload();
      };
    }
    global.XMLHttpRequest = function () { return new BadJSON(); };
    const collection = new window.Ity.Collection([], window.Ity.Model);
    collection.fetch({ error(_status: number, err: any) { parseError = err; } });
    assert(parseError instanceof Error);
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });

  it('covers additional public fallback branches across rendering, models, views and routers', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"><section id="child"></section><a id="external" data-ity-link href="https://example.com/out"></a></main>');

    const plain = window.Ity.signal(1);
    assert.strictEqual(plain(), 1);
    let immediate = 0;
    plain.subscribe((value: number) => {
      immediate = value;
    }, { immediate: true })();
    window.Ity.batch(() => {
      plain.set(2);
    });
    assert.strictEqual(immediate, 1);

    const source = window.Ity.signal(0);
    const lazy = window.Ity.computed(() => source());
    assert.strictEqual(lazy(), 0);
    source.set(1);
    source.set(2);
    assert.strictEqual(lazy(), 2);

    const doubleDispose = window.Ity.effect(() => {});
    doubleDispose();
    doubleDispose();
    const scheduled = window.Ity.signal(0);
    const disposeScheduled = window.Ity.effect(() => {
      scheduled();
    });
    window.Ity.batch(() => {
      scheduled.set(1);
      disposeScheduled();
    });
    const shared = window.Ity.signal(0);
    let disposeQueued: any;
    const disposeFirst = window.Ity.effect(() => {
      shared();
      if (shared.peek() === 1 && disposeQueued) disposeQueued();
    });
    disposeQueued = window.Ity.effect(() => {
      shared();
    });
    window.Ity.batch(() => {
      shared.set(1);
    });
    disposeFirst();

    const state = window.Ity.store({ a: 1 });
    state.$patch(() => {});
    state.$patch({ b: 2 });
    assert.strictEqual(state.b, 2);
    const bDescriptor = Object.getOwnPropertyDescriptor(state, 'b');
    assert.strictEqual(bDescriptor.enumerable, true);
    assert.strictEqual(bDescriptor.configurable, true);
    assert.strictEqual(typeof Object.getOwnPropertyDescriptor(state, '$patch').value, 'function');
    assert.strictEqual(Object.getOwnPropertyDescriptor(state, 'missing'), undefined);
    assert.strictEqual('missing' in state, false);
    delete state.b;
    assert.strictEqual('b' in state, false);
    delete state.missing;

    const root = document.getElementById('root');
    assert.throws(() => window.Ity.render(window.Ity.html`<p></p>`, '#missing-target'), /Render target not found/);
    assert.throws(() => window.Ity.render(window.Ity.html`<p></p>`, undefined as any));
    window.Ity.render({ isTemplateResult: true, strings: [], values: ['loose'] } as any, root, { reactive: false });
    assert.strictEqual(root.textContent, 'loose');
    assert.strictEqual(window.Ity.renderToString({ isTemplateResult: true, strings: [], values: ['text'] } as any), 'text');
    assert.strictEqual(window.Ity.renderToString(document.createTextNode('')), '');
    assert(window.Ity.renderToString(window.Ity.html`<p ?hidden=${0} class=${['a', null, 'b']}></p>`).includes('class="a b"'));

    const emptySelection = new window.Ity.SelectorObject([]);
    assert.strictEqual(emptySelection.attr('missing'), null);
    assert.strictEqual(emptySelection.html(), '');
    const selector = new window.Ity.SelectorObject([root]);
    selector.html('string replace');
    assert.strictEqual(root.innerHTML, 'string replace');
    selector.html('<span>html getter</span>');
    assert.strictEqual(selector.html(), '<span>html getter</span>');
    selector.html(undefined as any);
    assert.strictEqual(root.innerHTML, 'undefined');
    selector.attr('data-name', 'value');
    assert.strictEqual(selector.attr('data-name'), 'value');
    selector.attr('data-flag', true);
    assert.strictEqual(root.getAttribute('data-flag'), '');
    selector.attr('data-flag', null);
    assert.strictEqual(root.hasAttribute('data-flag'), false);
    selector.text('text setter');
    assert.strictEqual(root.textContent, 'text setter');
    (selector as any).extra = true;
    (selector as any).reindex();
    assert.strictEqual((selector as any).extra, true);
    const blank = document.createElement('span');
    root.appendChild(blank);
    assert.strictEqual(new window.Ity.SelectorObject([blank]).text(), '');

    const model = new window.Ity.Model({ data: { exists: true } });
    (model as any).data = null;
    assert.strictEqual(model.get('missing'), undefined);
    (model as any).state.set(null);
    model.set('fromNull', 1);
    model.unSet('missing');
    assert.strictEqual(model.get('fromNull'), 1);
    model.unSet('fromNull');
    assert.strictEqual(model.get('fromNull'), undefined);
    const eventContext = { called: 0 };
    function eventHandler(this: any) {
      this.called += 1;
    }
    model.off('absent', eventHandler);
    model.on('evented', eventHandler, eventContext);
    model.off('evented', eventHandler, eventContext);
    model.trigger('evented');
    model.on('clearByName', eventHandler, eventContext);
    model.off('clearByName');
    model.on('clearAll', eventHandler, eventContext);
    model.off();
    assert.strictEqual(eventContext.called, 0);

    const originalXHR = global.XMLHttpRequest;
    const requests: any[] = [];
    const queue: any[] = [];
    function BranchXHR() {
      const next = queue.shift();
      this.open = () => {};
      this.send = (data: any) => {
        requests.push(data);
        this.status = next.status;
        this.responseText = next.responseText;
        this.onload();
      };
    }
    global.XMLHttpRequest = function () { return new BranchXHR(); };
    queue.push({ status: 200, responseText: '{"saved":true}' });
    model.sync({ data: { saved: true } });
    const collection = new window.Ity.Collection([], window.Ity.Model);
    collection.add({} as any);
    queue.push({ status: 200, responseText: '' });
    (collection as any)._ajax({});
    queue.push({ status: 200, responseText: '' });
    collection.fetch({ data: { page: 1 } });
    const childModel = new window.Ity.Model();
    let childEvent = 0;
    childModel.on('child', () => {
      childEvent += 1;
    });
    collection.add(childModel);
    collection.trigger('child');
    assert.deepStrictEqual(requests, [JSON.stringify({ saved: true }), undefined, JSON.stringify({ page: 1 })]);
    assert.strictEqual(collection.length, 1);
    assert.strictEqual(childEvent, 1);
    global.XMLHttpRequest = originalXHR;

    const app = new window.Ity.Application();
    const unbound = new window.Ity.View();
    (unbound as any)._bindDOMEvents({ '.x': { click: 'missing' } });
    const lateBound = new window.Ity.View();
    (lateBound as any)._init({ el: '#root' });
    const managed = new window.Ity.View({ app, el: '#root' });
    managed.renderWith(window.Ity.html`<button class="managed">managed</button>`, { reactive: false });
    managed.renderWith(window.Ity.html`<button class="managed">managed again</button>`, { reactive: false });
    assert.strictEqual(app.getView(managed.id), managed);
    assert.strictEqual(managed.select('.managed').length, 1);
    assert.strictEqual(managed.select('.managed', document).length, 1);
    assert.strictEqual(managed.select('.managed', root).length, 1);
    assert.throws(() => managed.select('.managed', {} as any), /Context passed/);
    managed.remove();
    assert.strictEqual(app.getView(managed.id), undefined);

    const navigationCalls: string[] = [];
    (window as any).navigation = {
      addEventListener(type: string) {
        navigationCalls.push(`add:${type}`);
      },
      removeEventListener(type: string) {
        navigationCalls.push(`remove:${type}`);
      }
    };
    const autoRouter = new window.Ity.Router();
    autoRouter.navigate('/replace-target', { replace: true, transition: false });
    autoRouter.stop();
    assert(navigationCalls.includes('add:navigate'));
    assert(navigationCalls.includes('remove:navigate'));
    delete (window as any).navigation;

    const router = new window.Ity.Router({ autoStart: false });
    router.start();
    (router as any).handleLinkClick({ target: null });
    const external = document.createElement('a');
    external.setAttribute('data-ity-link', '');
    external.href = 'https://example.com/out';
    document.body.appendChild(external);
    external.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    (router as any).handleNavigationEvent({ canIntercept: true, destination: {}, intercept() {} });
    router.stop();

    const originalPattern = (window as any).URLPattern;
    let nativeMissHit = false;
    (window as any).URLPattern = function URLPattern() {
      this.exec = () => null;
    };
    const nativeMissRouter = new window.Ity.Router({ autoStart: false });
    nativeMissRouter.add('/native/:id', () => {
      nativeMissHit = true;
    });
    nativeMissRouter.navigate('/native/1');
    assert.strictEqual(nativeMissHit, false);
    (window as any).URLPattern = undefined;
    let plainHit = false;
    const plainRouter = new window.Ity.Router({ autoStart: false });
    plainRouter.add('plain', () => {
      plainHit = true;
    });
    plainRouter.navigate('/plain');
    assert.strictEqual(plainHit, true);
    (window as any).URLPattern = originalPattern;

    cleanup();
  });

});
