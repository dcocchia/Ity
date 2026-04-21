// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;

const assert = require('assert');
const { setupDOM } = require('./helpers');

let componentCounter = 0;

function flush(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

describe('V3 kernel', function () {
  it('reorders keyed repeat output without replacing existing nodes', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const items = window.Ity.signal([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' }
    ]);

    window.Ity.render(() => window.Ity.html`
      <ul>
        ${window.Ity.repeat(items, (item: any) => item.id, (item: any) => window.Ity.html`
          <li data-id=${item.id}>${item.label}</li>
        `)}
      </ul>
    `, '#root');

    const firstPass = Array.from(document.querySelectorAll('li')) as HTMLLIElement[];
    const alpha = firstPass[0];
    const beta = firstPass[1];

    items.set([
      { id: 'b', label: 'Beta' },
      { id: 'a', label: 'Alpha' }
    ]);
    await flush();

    const secondPass = Array.from(document.querySelectorAll('li')) as HTMLLIElement[];
    assert.strictEqual(secondPass[0], beta);
    assert.strictEqual(secondPass[1], alpha);
    assert.deepStrictEqual(secondPass.map((node) => node.textContent), ['Beta', 'Alpha']);
    cleanup();
  });

  it('hydrates existing markup in place and wires events', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    document.getElementById('root')!.innerHTML = window.Ity.renderToString(() => window.Ity.html`
      <button id="hydrate-button">Hydrate</button>
    `);
    const original = document.getElementById('hydrate-button');
    let clicks = 0;

    window.Ity.hydrate(() => window.Ity.html`
      <button id="hydrate-button" @click=${() => { clicks += 1; }}>Hydrate</button>
    `, '#root', { reactive: false });

    const hydrated = document.getElementById('hydrate-button');
    assert.strictEqual(hydrated, original);
    hydrated!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    assert.strictEqual(clicks, 1);
    cleanup();
  });

  it('provides and injects scoped services through components', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = `ity-scope-${++componentCounter}`;
    const appScope = window.Ity.createScope({ name: 'app' });
    appScope.provide('theme', 'ocean');

    window.Ity.component(tag, {
      shadow: true,
      setup(ctx: any) {
        const theme = ctx.inject('theme', 'fallback');
        return () => window.Ity.html`<p>${theme()}</p>`;
      }
    });

    const host = document.createElement(tag);
    window.Ity.render(host, '#root', {
      reactive: false,
      scope: appScope
    });
    await flush();

    assert.strictEqual((document.querySelector(tag) as HTMLElement).shadowRoot?.textContent?.trim(), 'ocean');
    cleanup();
  });

  it('updates injected scope values when services are provided or deleted after mount', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const tag = `ity-scope-live-${++componentCounter}`;
    const appScope = window.Ity.createScope({ name: 'live-app' });

    window.Ity.component(tag, {
      shadow: true,
      setup(ctx: any) {
        const theme = ctx.inject('theme', 'fallback');
        return () => window.Ity.html`<p>${theme()}</p>`;
      }
    });

    const host = document.createElement(tag);
    window.Ity.render(host, '#root', {
      reactive: false,
      scope: appScope
    });
    await flush();

    const shadow = (document.querySelector(tag) as HTMLElement).shadowRoot!;
    assert.strictEqual(shadow.textContent?.trim(), 'fallback');

    appScope.provide('theme', 'ocean');
    await flush();
    assert.strictEqual(shadow.textContent?.trim(), 'ocean');

    appScope.delete('theme');
    await flush();
    assert.strictEqual(shadow.textContent?.trim(), 'fallback');
    cleanup();
  });

  it('supports route-scoped resources and actions', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>', 'https://example.com/users/42');
    const scope = window.Ity.createScope({ name: 'router-app' });
    scope.provide('prefix', 'user');
    const router = new window.Ity.Router({ autoStart: false, scope, name: 'workbench' });
    router.add('/users/:id', () => undefined);
    const userResource = router.resource('/users/:id', async ({ params, scope }: any) => {
      return `${scope.get('prefix')}:${params.id}`;
    });
    const saveAction = router.action(async (context: any, suffix: string) => {
      return `${context.params.id}:${suffix}`;
    });

    router.start();
    await flush();
    await userResource.refresh();

    assert.strictEqual(userResource.data(), 'user:42');
    assert.strictEqual(await saveAction('saved'), '42:saved');
    cleanup();
  });

  it('emits runtime observation events for signals and actions', async function () {
    const cleanup = setupDOM();
    const events: any[] = [];
    const stop = window.Ity.observeRuntime((event: any) => {
      events.push(event.type);
    });
    const count = window.Ity.signal(0, { name: 'count' });
    const save = window.Ity.action(async (value: number) => value + 1, { name: 'save' });

    count.set(1);
    await save(2);

    stop();
    assert.ok(events.includes('signal:set'));
    assert.ok(events.includes('action:start'));
    assert.ok(events.includes('action:success'));
    cleanup();
  });

  it('does not recurse when runtime observers write to signals', function () {
    const cleanup = setupDOM();
    const source = window.Ity.signal(0, { name: 'source' });
    const feed = window.Ity.signal([] as string[], { name: 'feed' });
    const events: string[] = [];
    const stop = window.Ity.observeRuntime((event: any) => {
      events.push(event.type);
      feed.update((items: string[]) => items.concat(event.type));
    });

    source.set(1);

    stop();
    assert.deepStrictEqual(events, ['signal:set']);
    assert.deepStrictEqual(feed(), ['signal:set']);
    cleanup();
  });
});
