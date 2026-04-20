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

  it('returns an existing definition instead of redefining a tag', function () {
    const cleanup = setupDOM();
    const tag = 'ity-v2-existing-a';
    const first = window.Ity.component(tag, () => window.Ity.html`<p>one</p>`);
    const second = window.Ity.component(tag, () => window.Ity.html`<p>two</p>`);
    assert.strictEqual(first, second);
    cleanup();
  });
});
