// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('V2 components', function () {
  it('defines reactive custom elements with attributes, styles and events', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = 'ity-v2-card-a';

    window.Ity.component(tag, {
      attrs: ['label'],
      shadow: true,
      styles: 'button { color: rgb(1, 2, 3); }',
      setup(ctx: any) {
        const label = ctx.attr('label');
        return () => window.Ity.html`
          <button @click=${() => ctx.emit('picked', { label: label() })}>${label}</button>
        `;
      }
    });

    const el = document.createElement(tag);
    let detail: any = null;
    el.setAttribute('label', 'One');
    el.addEventListener('picked', (event: any) => {
      detail = event.detail;
    });
    document.getElementById('root').appendChild(el);

    assert.equal(el.shadowRoot.querySelector('style').textContent.includes('button'), true);
    assert.equal(el.shadowRoot.querySelector('button').textContent.trim(), 'One');

    el.setAttribute('label', 'Two');
    assert.equal(el.shadowRoot.querySelector('button').textContent.trim(), 'Two');
    el.shadowRoot.querySelector('button').click();
    assert.deepStrictEqual(detail, { label: 'Two' });

    cleanup();
  });

  it('supports light DOM components and lifecycle cleanup', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = 'ity-v2-light-a';
    let connected = 0;
    let disconnected = 0;
    const count = window.Ity.signal(1);

    window.Ity.component(tag, (ctx: any) => {
      ctx.onConnected(() => {
        connected += 1;
      });
      ctx.onDisconnected(() => {
        disconnected += 1;
      });
      ctx.effect(() => {
        ctx.host.setAttribute('data-count', String(count()));
      });
      return () => window.Ity.html`<span>${count}</span>`;
    }, { shadow: false });

    const el = document.createElement(tag);
    document.getElementById('root').appendChild(el);
    assert.equal(connected, 1);
    assert.equal(el.querySelector('span').textContent, '1');
    assert.equal(el.getAttribute('data-count'), '1');

    count.set(2);
    assert.equal(el.querySelector('span').textContent, '2');
    assert.equal(el.getAttribute('data-count'), '2');

    el.remove();
    count.set(3);
    assert.equal(disconnected, 1);
    assert.equal(el.getAttribute('data-count'), '2');
    cleanup();
  });

  it('restarts render effects and context effects when reconnected', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = 'ity-v2-reconnect-a';
    const count = window.Ity.signal(1);
    let effectRuns = 0;
    let cleanups = 0;
    let connected = 0;
    let disconnected = 0;

    window.Ity.component(tag, (ctx: any) => {
      ctx.onConnected(() => {
        connected += 1;
      });
      ctx.onDisconnected(() => {
        disconnected += 1;
      });
      ctx.effect((onCleanup: any) => {
        effectRuns += 1;
        ctx.host.setAttribute('data-count', String(count()));
        onCleanup(() => {
          cleanups += 1;
        });
      });
      return () => window.Ity.html`<span>${count}</span>`;
    }, { shadow: false });

    const root = document.getElementById('root');
    const el = document.createElement(tag);
    root.appendChild(el);
    assert.strictEqual(el.querySelector('span').textContent, '1');
    assert.strictEqual(el.getAttribute('data-count'), '1');

    el.remove();
    count.set(2);
    assert.strictEqual(el.querySelector('span').textContent, '1');
    assert.strictEqual(el.getAttribute('data-count'), '1');

    root.appendChild(el);
    assert.strictEqual(el.querySelector('span').textContent, '2');
    assert.strictEqual(el.getAttribute('data-count'), '2');
    count.set(3);
    assert.strictEqual(el.querySelector('span').textContent, '3');
    assert.strictEqual(el.getAttribute('data-count'), '3');

    assert.strictEqual(connected, 2);
    assert.strictEqual(disconnected, 1);
    assert(cleanups >= 1);
    assert(effectRuns >= 3);
    cleanup();
  });

  it('supports registering and disposing context effects after connection', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = 'ity-v2-late-effect-a';
    const count = window.Ity.signal(1);
    let ctxRef: any = null;
    let runs = 0;

    window.Ity.component(tag, (ctx: any) => {
      ctxRef = ctx;
      return () => window.Ity.html`<span>${count}</span>`;
    }, { shadow: false });

    const el = document.createElement(tag);
    document.getElementById('root').appendChild(el);
    const stop = ctxRef.effect(() => {
      runs += 1;
      ctxRef.host.setAttribute('data-late', String(count()));
    });

    assert.strictEqual(runs, 1);
    count.set(2);
    assert.strictEqual(runs, 2);
    assert.strictEqual(el.getAttribute('data-late'), '2');
    stop();
    count.set(3);
    assert.strictEqual(runs, 2);
    assert.strictEqual(el.getAttribute('data-late'), '2');
    cleanup();
  });

  it('returns an existing definition instead of redefining a tag', function () {
    const cleanup = setupDOM();
    const tag = 'ity-v2-existing-a';
    const first = window.Ity.component(tag, () => window.Ity.html`<p>one</p>`);
    const second = window.Ity.component(tag, () => window.Ity.html`<p>two</p>`);
    assert.strictEqual(first, second);
    cleanup();
  });

  it('supports declared property signals for structured component inputs', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = 'ity-v2-props-a';

    window.Ity.component(tag, {
      props: ['task'],
      shadow: true,
      setup(ctx: any) {
        const taskValue = ctx.prop('task');
        return () => window.Ity.html`<p>${taskValue().title} · ${taskValue().status}</p>`;
      }
    });

    const el: any = document.createElement(tag);
    el.task = { title: 'Launch dry run', status: 'planned' };
    document.getElementById('root').appendChild(el);

    assert.deepStrictEqual(el.task, { title: 'Launch dry run', status: 'planned' });
    assert.strictEqual(el.shadowRoot?.textContent?.trim(), 'Launch dry run · planned');

    el.task = { title: 'Launch dry run', status: 'active' };
    assert.deepStrictEqual(el.task, { title: 'Launch dry run', status: 'active' });
    assert.strictEqual(el.shadowRoot?.textContent?.trim(), 'Launch dry run · active');
    cleanup();
  });
});
