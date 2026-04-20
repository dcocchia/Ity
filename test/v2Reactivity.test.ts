// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('V2 reactivity', function () {
  it('signals read, write, update and notify subscribers', function () {
    const cleanup = setupDOM();
    const count = window.Ity.signal(1);
    const seen: any[] = [];

    const unsubscribe = count.subscribe((value, previous) => {
      seen.push([value, previous]);
    });

    assert.equal(count(), 1);
    assert.equal(count.set(2), 2);
    assert.equal(count.update((n: number) => n + 3), 5);
    count.set(5);
    unsubscribe();
    count.set(6);

    assert.deepStrictEqual(seen, [[2, 1], [5, 2]]);
    assert.equal(count.peek(), 6);
    cleanup();
  });

  it('computed values are lazy, cached and reactive', function () {
    const cleanup = setupDOM();
    const count = window.Ity.signal(2);
    let runs = 0;
    const doubled = window.Ity.computed(() => {
      runs += 1;
      return count() * 2;
    });

    assert.equal(runs, 0);
    assert.equal(doubled(), 4);
    assert.equal(doubled(), 4);
    assert.equal(runs, 1);
    count.set(4);
    assert.equal(doubled(), 8);
    assert.equal(runs, 2);
    cleanup();
  });

  it('effects track dependencies, clean up and dispose', function () {
    const cleanup = setupDOM();
    const count = window.Ity.signal(1);
    const values: number[] = [];
    let cleanups = 0;

    const dispose = window.Ity.effect((onCleanup: any) => {
      onCleanup(() => {
        cleanups += 1;
      });
      values.push(count());
    });

    count.set(2);
    dispose();
    count.set(3);

    assert.deepStrictEqual(values, [1, 2]);
    assert.equal(cleanups, 2);
    cleanup();
  });

  it('batch coalesces effects and untrack avoids dependencies', function () {
    const cleanup = setupDOM();
    const a = window.Ity.signal(1);
    const b = window.Ity.signal(10);
    let runs = 0;
    let last = 0;

    window.Ity.effect(() => {
      runs += 1;
      last = a() + window.Ity.untrack(() => b());
    });

    window.Ity.batch(() => {
      a.set(2);
      a.set(3);
      b.set(20);
    });
    b.set(30);

    assert.equal(runs, 2);
    assert.equal(last, 23);
    cleanup();
  });

  it('stores expose reactive object properties, patching, snapshots and subscriptions', function () {
    const cleanup = setupDOM();
    const state = window.Ity.store({ name: 'Ada', count: 1 });
    const snapshots: any[] = [];

    const unsubscribe = state.$subscribe((value: any) => snapshots.push(value), { immediate: true });
    assert.equal(state.name, 'Ada');
    state.count = 2;
    state.$patch({ name: 'Grace' });
    state.$patch((current: any) => ({ count: current.count + 1 }));
    unsubscribe();
    state.count = 99;

    assert.deepStrictEqual(state.$snapshot(), { name: 'Grace', count: 99 });
    assert.deepStrictEqual(snapshots, [
      { name: 'Ada', count: 1 },
      { name: 'Ada', count: 2 },
      { name: 'Grace', count: 2 },
      { name: 'Grace', count: 3 },
    ]);
    cleanup();
  });

  it('detects signals and resolves MaybeSignal values', function () {
    const cleanup = setupDOM();
    const name = window.Ity.signal('Ity');
    assert.strictEqual(window.Ity.isSignal(name), true);
    assert.strictEqual(window.Ity.isSignal('Ity'), false);
    assert.strictEqual(window.Ity.resolveSignal(name), 'Ity');
    assert.strictEqual(window.Ity.resolveSignal('plain'), 'plain');
    cleanup();
  });
});
