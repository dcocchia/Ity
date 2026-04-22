// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;

const assert = require('assert');
const React = require('react');
const ReactDOMClient = require('react-dom/client');
const ReactDOM = require('react-dom');
const { setupDOM } = require('./helpers');
const Ity = require(process.env.ITY_CORE_FILE || '../Ity');
const { wrapCustomElement } = require(process.env.ITY_REACT_FILE || '../react');

let tagCounter = 0;

function flush(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

describe('React interop', function () {
  it('wraps Ity custom elements with prop and custom-event support', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = `ity-react-bridge-${++tagCounter}`;
    Ity.component(tag, {
      shadow: true,
      props: ['user'],
      setup(ctx: any) {
        const user = ctx.prop('user');
        return () => Ity.html`
          <button @click=${() => ctx.emit('choose', { id: user()?.id })}>
            ${user()?.name || 'Unknown'}
          </button>
        `;
      }
    });

    const Wrapped = wrapCustomElement(tag, {
      events: {
        onChoose: 'choose'
      }
    });
    const root = ReactDOMClient.createRoot(document.getElementById('root'));
    const seen: string[] = [];

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {
        user: { id: 'u1', name: 'Ada' },
        onChoose: (event: CustomEvent) => seen.push(event.detail.id)
      }));
    });
    await flush();

    const host = document.querySelector(tag) as HTMLElement;
    const button = host.shadowRoot?.querySelector('button') as HTMLButtonElement;
    assert.strictEqual(button.textContent.trim(), 'Ada');

    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    assert.deepStrictEqual(seen, ['u1']);

    root.unmount();
    cleanup();
  });

  it('updates props, forwards refs, and cleans up generic event handlers across rerenders', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = `ity-react-bridge-${++tagCounter}`;
    Ity.component(tag, {
      shadow: true,
      props: ['user', 'payload'],
      setup(ctx: any) {
        const user = ctx.prop('user');
        const payload = ctx.prop('payload');
        return () => Ity.html`
          <button title=${payload()?.title || ''} @click=${() => ctx.emit('activate', { id: user()?.id })}>
            ${user()?.name || 'Unknown'}
          </button>
        `;
      }
    });

    const Wrapped = wrapCustomElement(tag);
    const root = ReactDOMClient.createRoot(document.getElementById('root'));
    const objectRef = React.createRef<HTMLElement>();
    let functionRefHost: HTMLElement | null = null;
    const first: string[] = [];
    const second: string[] = [];

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {
        ref: (node: HTMLElement | null) => {
          functionRefHost = node;
          objectRef.current = node;
        },
        user: { id: 'u1', name: 'Ada' },
        payload: { title: 'first-title' },
        'data-state': 'ready',
        onActivate: (event: CustomEvent) => first.push(event.detail.id)
      }));
    });
    await flush();

    let host = document.querySelector(tag) as HTMLElement;
    let button = host.shadowRoot?.querySelector('button') as HTMLButtonElement;
    assert.strictEqual(host.getAttribute('data-state'), 'ready');
    assert.strictEqual(button.getAttribute('title'), 'first-title');
    assert.strictEqual(objectRef.current, host);
    assert.strictEqual(functionRefHost, host);

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {
        ref: objectRef,
        user: { id: 'u2', name: 'Grace' },
        payload: { title: 'second-title' },
        'data-state': 'done',
        onActivate: (event: CustomEvent) => second.push(event.detail.id)
      }));
    });
    await flush();

    host = document.querySelector(tag) as HTMLElement;
    button = host.shadowRoot?.querySelector('button') as HTMLButtonElement;
    assert.strictEqual(host.getAttribute('data-state'), 'done');
    assert.strictEqual(button.textContent.trim(), 'Grace');
    assert.strictEqual(button.getAttribute('title'), 'second-title');

    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
    assert.deepStrictEqual(first, []);
    assert.deepStrictEqual(second, ['u2']);

    root.unmount();
    cleanup();
  });

  it('toggles boolean host attributes without serializing false values', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = `ity-react-bridge-${++tagCounter}`;
    Ity.component(tag, {
      shadow: true,
      props: ['open'],
      setup(ctx: any) {
        const open = ctx.prop('open');
        return () => Ity.html`<p>${open() ? 'open' : 'closed'}</p>`;
      }
    });

    const Wrapped = wrapCustomElement(tag);
    const root = ReactDOMClient.createRoot(document.getElementById('root'));

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {
        open: false
      }));
    });
    await flush();

    const host = document.querySelector(tag) as HTMLElement & { open?: boolean };
    assert.strictEqual(host.getAttribute('open'), null);
    assert.strictEqual(host.open, false);
    assert.strictEqual(host.shadowRoot?.textContent?.trim(), 'closed');

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {
        open: true
      }));
    });
    await flush();

    assert.strictEqual(host.getAttribute('open'), '');
    assert.strictEqual(host.open, true);
    assert.strictEqual(host.shadowRoot?.textContent?.trim(), 'open');

    root.unmount();
    cleanup();
  });

  it('clears removed non-primitive props on rerender', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = `ity-react-bridge-${++tagCounter}`;
    Ity.component(tag, {
      shadow: true,
      props: ['payload'],
      setup(ctx: any) {
        const payload = ctx.prop('payload');
        return () => Ity.html`<p>${payload()?.label || 'none'}</p>`;
      }
    });

    const Wrapped = wrapCustomElement(tag);
    const root = ReactDOMClient.createRoot(document.getElementById('root'));

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {
        payload: { label: 'present' }
      }));
    });
    await flush();

    const host = document.querySelector(tag) as HTMLElement & { payload?: { label: string } };
    assert.deepStrictEqual(host.payload, { label: 'present' });
    assert.strictEqual(host.shadowRoot?.textContent?.trim(), 'present');

    ReactDOM.flushSync(() => {
      root.render(React.createElement(Wrapped, {}));
    });
    await flush();

    assert.strictEqual(host.payload, undefined);
    assert.strictEqual(host.shadowRoot?.textContent?.trim(), 'none');

    root.unmount();
    cleanup();
  });
});
