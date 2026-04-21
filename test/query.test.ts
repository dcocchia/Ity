// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;

const assert = require('assert');
const Ity = require(process.env.ITY_CORE_FILE || '../Ity');
const { createQueryClient, query, mutation } = require(process.env.ITY_QUERY_FILE || '../query');

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Query module', function () {
  it('dedupes in-flight requests by key across query instances', async function () {
    const client = createQueryClient();
    let loads = 0;
    const loader = async () => {
      loads += 1;
      await tick();
      return { ok: true };
    };

    const first = query(client, 'workspace', loader);
    const second = query(client, 'workspace', loader);

    await Promise.all([first.refresh(), second.refresh()]);

    assert.strictEqual(loads, 1);
    assert.deepStrictEqual(first.data(), { ok: true });
    assert.deepStrictEqual(second.data(), { ok: true });
    first.dispose();
    second.dispose();
  });

  it('invalidates and refreshes active queries', async function () {
    const client = createQueryClient();
    let version = 0;
    const current = query(client, 'settings', async () => ({ version: ++version }));

    await current.refresh();
    assert.strictEqual(current.data().version, 1);

    await client.invalidate('settings');
    await tick();

    assert.strictEqual(current.data().version, 2);
    current.dispose();
  });

  it('rolls back optimistic mutations on failure', async function () {
    const client = createQueryClient();
    client.setData('counter', 1);

    const save = mutation(client, async (shouldFail: boolean) => {
      if (shouldFail) throw new Error('boom');
      return 2;
    }, {
      optimistic(cache) {
        const previous = cache.getData('counter');
        cache.setData('counter', (previous as number) + 1);
        return () => cache.setData('counter', previous as number);
      }
    });

    await assert.rejects(() => save(true), /boom/);
    assert.strictEqual(client.getData('counter'), 1);
  });

  it('supports prefetch, dynamic keys, callbacks, and eager gc cleanup', async function () {
    const client = createQueryClient();
    const eagerClient = createQueryClient({ gcTime: 0 });
    const currentKey = Ity.signal('a');
    const successes: string[] = [];
    const failures: string[] = [];
    let loads = 0;

    await client.prefetch(['prefetch', 1], async () => ({ ok: true }));
    assert.deepStrictEqual(client.getData(['prefetch', 1]), { ok: true });
    assert.strictEqual(client.getStatus('missing-key'), 'missing');

    const current = query(eagerClient, () => ['task', currentKey()] as const, async ({ key }) => {
      loads += 1;
      const id = key[1];
      await tick();
      if (id === 'b') throw new Error('boom');
      return { id, load: loads };
    }, {
      keepPrevious: false,
      onSuccess(value: any) {
        successes.push(value.id);
      },
      onError(error: Error) {
        failures.push(error.message);
      }
    });

    await current.refresh();
    assert.strictEqual(current.data().id, 'a');
    assert.deepStrictEqual(successes, ['a']);

    currentKey.set('b');
    await tick();
    await tick();

    assert.strictEqual(current.status(), 'error');
    assert.strictEqual(current.data(), undefined);
    assert.deepStrictEqual(failures, ['boom']);

    const eager = query(eagerClient, ['ephemeral', 'task'], async () => ({ ok: true }));
    await eager.refresh();
    eager.dispose();
    assert.strictEqual(eagerClient.getStatus(['ephemeral', 'task']), 'missing');

    current.dispose();
    assert.strictEqual(eagerClient.getStatus(['task', 'b']), 'missing');
  });

  it('supports global invalidation, updater mutations, and timed cache release', async function () {
    const client = createQueryClient({ gcTime: 5 });
    let version = 0;
    const current = query(client, ['settings', { scope: 'all' }], async () => ({ version: ++version }), {
      staleTime: 0
    });

    await current.refresh();
    assert.strictEqual(current.stale(), false);

    client.setData(['settings', { scope: 'all' }], (previous: any) => ({ version: previous.version + 10 }));
    assert.strictEqual(current.data().version, 11);

    await client.invalidate();
    await tick();
    await tick();

    assert.strictEqual(current.data().version, 2);
    current.dispose();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(client.getStatus(['settings', { scope: 'all' }]), 'missing');
  });

  it('supports signal keys, result-level invalidation, and ignores stale refresh races', async function () {
    const client = createQueryClient();
    const keySignal = Ity.signal<QueryKey>('alpha');
    let resolveSlow: ((value: { key: string; version: number }) => void) | null = null;
    let version = 0;

    const current = query(client, keySignal, ({ key }) => {
      if (key === 'alpha') {
        return new Promise((resolve) => {
          resolveSlow = resolve;
        });
      }
      return { key: String(key), version: ++version };
    });

    const firstRefresh = current.refresh();
    keySignal.set('beta');
    await current.invalidate();
    resolveSlow?.({ key: 'alpha', version: 999 });
    await firstRefresh;
    await tick();

    assert.strictEqual(current.key(), 'beta');
    assert.strictEqual(current.data().key, 'beta');
    assert.strictEqual(current.data().version, 1);
    current.dispose();
    current.dispose();
  });

  it('garbage collects unobserved cache entries created by prefetch and setData', async function () {
    const client = createQueryClient({ gcTime: 5 });

    await client.prefetch(['prefetch', 'ephemeral'], async () => ({ ok: true }));
    client.setData(['manual', 'ephemeral'], { ok: true });

    assert.deepStrictEqual(client.getData(['prefetch', 'ephemeral']), { ok: true });
    assert.deepStrictEqual(client.getData(['manual', 'ephemeral']), { ok: true });

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(client.getStatus(['prefetch', 'ephemeral']), 'missing');
    assert.strictEqual(client.getStatus(['manual', 'ephemeral']), 'missing');
  });

  it('keeps structurally similar but non-json query keys distinct', function () {
    const client = createQueryClient();

    client.setData(['task', undefined], { key: 'undefined' });
    client.setData(['task'], { key: 'short' });
    client.setData(['metric', NaN], { key: 'nan' });
    client.setData(['metric', null], { key: 'null' });
    client.setData(['zero', -0], { key: 'negative-zero' });
    client.setData(['zero', 0], { key: 'zero' });

    assert.deepStrictEqual(client.getData(['task', undefined]), { key: 'undefined' });
    assert.deepStrictEqual(client.getData(['task']), { key: 'short' });
    assert.deepStrictEqual(client.getData(['metric', NaN]), { key: 'nan' });
    assert.deepStrictEqual(client.getData(['metric', null]), { key: 'null' });
    assert.deepStrictEqual(client.getData(['zero', -0]), { key: 'negative-zero' });
    assert.deepStrictEqual(client.getData(['zero', 0]), { key: 'zero' });
  });
});
