// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('V2 DOM templates and rendering', function () {
  it('renders text safely, reacts to signals and binds events', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const name = window.Ity.signal('Ada');
    const disabled = window.Ity.signal(false);
    const clicks = window.Ity.signal(0);

    const stop = window.Ity.render(() => window.Ity.html`
      <button
        class=${['btn', name()]}
        data-name=${name}
        ?disabled=${disabled}
        @click=${() => clicks.update((n: number) => n + 1)}
      >${name}</button>
    `, '#root');

    let button = document.querySelector('button') as HTMLButtonElement;
    assert.equal(button.textContent.trim(), 'Ada');
    assert.equal(button.getAttribute('data-name'), 'Ada');
    assert(button.classList.contains('btn'));
    assert(button.classList.contains('Ada'));
    assert.strictEqual(button.hasAttribute('disabled'), false);

    button.click();
    assert.equal(clicks(), 1);

    name.set('<b>Grace</b>');
    disabled.set(true);
    button = document.querySelector('button') as HTMLButtonElement;
    assert.equal(button.textContent.trim(), '<b>Grace</b>');
    assert.equal(button.querySelector('b'), null);
    assert.equal(button.getAttribute('data-name'), '<b>Grace</b>');
    assert.strictEqual(button.hasAttribute('disabled'), true);

    stop();
    cleanup();
  });

  it('supports properties, style objects, class objects, arrays and unsafe HTML', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const value = window.Ity.signal('hello');
    const fragmentNode = document.createElement('strong');
    fragmentNode.textContent = 'node';

    window.Ity.render(() => window.Ity.html`
      <section>
        <input .value=${value}>
        <p class=${{ active: true, hidden: false }} style=${{ color: 'red' }}>${[
          'safe ',
          fragmentNode.cloneNode(true),
          window.Ity.html`<em>${value}</em>`,
          window.Ity.unsafeHTML('<span id="raw">raw</span>')
        ]}</p>
      </section>
    `, '#root');

    const input = document.querySelector('input') as HTMLInputElement;
    const p = document.querySelector('p') as HTMLElement;
    assert.equal(input.value, 'hello');
    assert(p.classList.contains('active'));
    assert(!p.classList.contains('hidden'));
    assert.equal(p.style.color, 'red');
    assert.equal(p.querySelector('strong')?.textContent, 'node');
    assert.equal(p.querySelector('em')?.textContent, 'hello');
    assert.equal(p.querySelector('#raw')?.textContent, 'raw');

    value.set('updated');
    assert.equal((document.querySelector('input') as HTMLInputElement).value, 'updated');
    assert.equal(document.querySelector('em')?.textContent, 'updated');
    cleanup();
  });

  it('can render once without reactivity and render into a SelectorObject', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const count = window.Ity.signal(1);
    const target = new window.Ity.SelectorObject([document.getElementById('root')]);

    const stop = window.Ity.render(() => window.Ity.html`<span>${count}</span>`, target, { reactive: false });
    count.set(2);

    assert.equal(document.querySelector('span')?.textContent, '1');
    stop();
    cleanup();
  });

  it('uses view transitions when requested and available', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    let transitioned = false;
    (document as any).startViewTransition = (callback: any) => {
      transitioned = true;
      callback();
      return { finished: Promise.resolve() };
    };

    window.Ity.render(window.Ity.html`<p>Transitioned</p>`, '#root', { reactive: false, transition: true });

    assert.equal(transitioned, true);
    assert.equal(document.querySelector('p')?.textContent, 'Transitioned');
    delete (document as any).startViewTransition;
    cleanup();
  });

  it('renders templates to escaped strings for SSR and static output', function () {
    const cleanup = setupDOM();
    const title = window.Ity.signal('<Admin>');
    const out = window.Ity.renderToString(() => window.Ity.html`
      <section class=${['panel', 'active']} style=${{ backgroundColor: 'red' }}>
        <h1>${title}</h1>
        <input .value=${title} @input=${() => {}}>
        <button ?disabled=${true}>Save</button>
        ${window.Ity.unsafeHTML('<span>trusted</span>')}
      </section>
    `);

    assert(out.includes('class="panel active"'));
    assert(out.includes('style="background-color:red"'));
    assert(out.includes('&lt;Admin&gt;'));
    assert(out.includes('<button disabled>Save</button>'));
    assert(out.includes('<span>trusted</span>'));
    assert(!out.includes('@input'));
    assert(!out.includes('.value'));
    cleanup();
  });

  it('throws for missing render targets', function () {
    const cleanup = setupDOM();
    assert.throws(() => window.Ity.render(window.Ity.html`<p></p>`, '#missing'));
    cleanup();
  });
});
