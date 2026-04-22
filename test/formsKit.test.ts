// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;

const assert = require('assert');
const { setupDOM } = require('./helpers');
const Ity = require(process.env.ITY_CORE_FILE || '../Ity');
const { createFormKit } = require(process.env.ITY_FORMS_FILE || '../forms');

function flush(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

describe('Forms module', function () {
  it('binds nested fields, validates asynchronously, and submits current values', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const form = createFormKit({
      task: {
        title: '',
        checklist: [{ label: 'First' }]
      }
    }, {
      validators: {
        'task.title': async (value: string) => {
          await flush();
          return value.trim() ? null : 'Required';
        }
      }
    });

    const submit = form.submit(async (values: any) => values);

    Ity.render(() => Ity.html`
      <form id="task-form" @submit=${submit.onSubmit}>
        <input id="title" bind=${form.bind('task.title')}>
      </form>
    `, '#root');

    const input = document.getElementById('title') as HTMLInputElement;
    input.value = 'Launch';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    input.dispatchEvent(new window.Event('blur', { bubbles: true }));
    await flush();
    await flush();

    assert.strictEqual(form.field('task.title').value(), 'Launch');
    assert.strictEqual(form.field('task.title').error(), null);

    const formElement = document.getElementById('task-form') as HTMLFormElement;
    const result = await submit.onSubmit({
      preventDefault() {},
      currentTarget: formElement,
      target: formElement
    } as any);
    assert.strictEqual(result.task.title, 'Launch');
    cleanup();
  });

  it('reads live control values on submit even before input/change events fire', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const form = createFormKit({
      task: {
        title: '',
        description: '',
        ownerId: 'ava',
        dueDate: ''
      }
    });

    const submit = form.submit(async (values: any) => values);

    Ity.render(() => Ity.html`
      <form id="task-form" @submit=${submit.onSubmit}>
        <input id="title" bind=${form.bind('task.title')}>
        <textarea id="description" bind=${form.bind('task.description', { type: 'textarea' })}></textarea>
        <select id="owner" bind=${form.bind('task.ownerId', { type: 'select' })}>
          <option value="ava">Ava</option>
          <option value="milo">Milo</option>
        </select>
        <input id="dueDate" type="date" bind=${form.bind('task.dueDate')}>
      </form>
    `, '#root');

    (document.getElementById('title') as HTMLInputElement).value = 'Launch review';
    (document.getElementById('description') as HTMLTextAreaElement).value = 'Walk through the freeze checklist.';
    (document.getElementById('owner') as HTMLSelectElement).value = 'milo';
    (document.getElementById('dueDate') as HTMLInputElement).value = '2026-04-24';

    const formElement = document.getElementById('task-form') as HTMLFormElement;
    const result = await submit.onSubmit({
      preventDefault() {},
      currentTarget: formElement,
      target: formElement
    } as any);

    assert.strictEqual(result.task.title, 'Launch review');
    assert.strictEqual(result.task.description, 'Walk through the freeze checklist.');
    assert.strictEqual(result.task.ownerId, 'milo');
    assert.strictEqual(result.task.dueDate, '2026-04-24');
    cleanup();
  });

  it('can sync live control state before structural array updates rerender the form', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const form = createFormKit({
      task: {
        title: '',
        checklist: [{ label: '' }]
      }
    });
    const checklist = form.array('task.checklist');

    Ity.render(() => Ity.html`
      <form id="task-form">
        <input id="title" bind=${form.bind('task.title')}>
        <div class="items">
          ${Ity.repeat(checklist.keys().map((key: string, index: number) => ({ key, index })), (item: any) => item.key, (item: any) => Ity.html`
            <input bind=${form.bind(`task.checklist.${item.index}.label`)}>
          `)}
        </div>
        <button id="add" type="button" @click=${(event: Event) => {
          form.sync(event);
          checklist.push({ label: '' });
        }}>Add</button>
      </form>
    `, '#root');

    const title = document.getElementById('title') as HTMLInputElement;
    title.value = 'Preserve me';
    (document.getElementById('add') as HTMLButtonElement).click();
    await flush();
    await flush();

    assert.strictEqual(form.field('task.title').value(), 'Preserve me');
    assert.strictEqual((document.getElementById('title') as HTMLInputElement).value, 'Preserve me');
    assert.strictEqual(document.querySelectorAll('.items input').length, 2);
    cleanup();
  });

  it('supports formatted bindings, option groups, patch/reset helpers, and field subscriptions', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const form = createFormKit({
      prefs: {
        code: 'abc',
        enabled: false,
        tags: [] as string[],
        plan: 'basic',
        owners: ['ava'] as string[],
        count: 1,
        note: ''
      }
    }, {
      validate(values: any) {
        if (values.prefs.count > 5) {
          return { 'prefs.count': 'Too high' };
        }
      }
    });
    const seen: Array<[string, string]> = [];
    const stop = form.field('prefs.code').value.subscribe((value: string, previous: string) => {
      seen.push([value, previous]);
    }, { immediate: true });

    Ity.render(() => Ity.html`
      <form id="prefs-form">
        <input id="code" bind=${form.bind('prefs.code', {
          name: 'promo',
          event: 'change',
          format: (value: string) => value.toUpperCase(),
          parse: (target: HTMLInputElement) => target.value.trim().toLowerCase()
        })}>
        <input id="enabled" type="checkbox" bind=${form.bind('prefs.enabled', { type: 'checkbox' })}>
        <input id="tag-alpha" type="checkbox" bind=${form.bind('prefs.tags', { type: 'checkbox', value: 'alpha' })}>
        <input id="tag-beta" type="checkbox" bind=${form.bind('prefs.tags', { type: 'checkbox', value: 'beta' })}>
        <input id="plan-basic" type="radio" bind=${form.bind('prefs.plan', { type: 'radio', value: 'basic' })}>
        <input id="plan-pro" type="radio" bind=${form.bind('prefs.plan', { type: 'radio', value: 'pro' })}>
        <select id="owners" multiple bind=${form.bind('prefs.owners', { type: 'select-multiple' })}>
          <option value="ava">Ava</option>
          <option value="milo">Milo</option>
          <option value="nina">Nina</option>
        </select>
        <input id="count" type="number" bind=${form.bind('prefs.count', { type: 'number' })}>
      </form>
    `, '#root');

    assert.strictEqual((document.getElementById('code') as HTMLInputElement).value, 'ABC');

    const code = document.getElementById('code') as HTMLInputElement;
    code.value = ' VIP ';
    code.dispatchEvent(new window.Event('change', { bubbles: true }));
    code.dispatchEvent(new window.Event('blur', { bubbles: true }));

    const enabled = document.getElementById('enabled') as HTMLInputElement;
    enabled.checked = true;
    enabled.dispatchEvent(new window.Event('change', { bubbles: true }));

    const tagAlpha = document.getElementById('tag-alpha') as HTMLInputElement;
    tagAlpha.checked = true;
    tagAlpha.dispatchEvent(new window.Event('change', { bubbles: true }));
    const tagBeta = document.getElementById('tag-beta') as HTMLInputElement;
    tagBeta.checked = true;
    tagBeta.dispatchEvent(new window.Event('change', { bubbles: true }));

    const planPro = document.getElementById('plan-pro') as HTMLInputElement;
    planPro.checked = true;
    planPro.dispatchEvent(new window.Event('change', { bubbles: true }));

    const owners = document.getElementById('owners') as HTMLSelectElement;
    Array.from(owners.options).forEach((option) => {
      option.selected = option.value === 'milo' || option.value === 'nina';
    });
    owners.dispatchEvent(new window.Event('change', { bubbles: true }));

    const count = document.getElementById('count') as HTMLInputElement;
    count.value = '6';
    count.dispatchEvent(new window.Event('input', { bubbles: true }));

    await flush();
    await form.validate();

    assert.strictEqual(form.field('prefs.code').value(), 'vip');
    assert.strictEqual(form.values().prefs.enabled, true);
    assert.deepStrictEqual(form.values().prefs.tags, ['alpha', 'beta']);
    assert.strictEqual(form.values().prefs.plan, 'pro');
    assert.deepStrictEqual(form.values().prefs.owners, ['milo', 'nina']);
    assert.strictEqual(form.values().prefs.count, 6);
    assert.strictEqual(form.errors()['prefs.count'], 'Too high');
    assert.ok(seen.some(([value]) => value === 'vip'));

    form.field('prefs.code').reset();
    assert.strictEqual(form.field('prefs.code').value(), 'abc');

    form.patch((current: any) => ({
      prefs: {
        ...current.prefs,
        note: 'patched'
      }
    }));
    form.markTouched(['prefs.plan']);
    assert.strictEqual(form.values().prefs.note, 'patched');
    assert.strictEqual(form.touched()['prefs.plan'], true);

    form.reset({
      prefs: {
        code: 'reset',
        enabled: false,
        tags: [],
        plan: 'basic',
        owners: ['ava'],
        count: 1,
        note: ''
      }
    });
    assert.strictEqual(form.values().prefs.code, 'reset');
    assert.deepStrictEqual(form.errors(), {});
    assert.deepStrictEqual(form.touched(), {});
    stop();
    cleanup();
  });

  it('syncs from child controls and supports submit controller reset helpers', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const form = createFormKit({
      prefs: {
        enabled: false,
        plan: 'basic',
        owners: ['ava'] as string[],
        count: 2,
        promo: 'abc'
      }
    });
    const submit = form.submit(async (values: any) => values, { resetOnSuccess: true });
    const seen: Array<[string, string]> = [];
    const stop = form.field('prefs.promo').value.subscribe((value: string, previous: string) => {
      seen.push([value, previous]);
    }, { immediate: true });

    Ity.render(() => Ity.html`
      <form id="sync-form">
        <input id="enabled-child" type="checkbox" bind=${form.bind('prefs.enabled', { type: 'checkbox' })}>
        <input id="plan-basic-child" type="radio" bind=${form.bind('prefs.plan', { type: 'radio', value: 'basic' })}>
        <input id="plan-pro-child" type="radio" bind=${form.bind('prefs.plan', { type: 'radio', value: 'pro' })}>
        <select id="owners-child" multiple bind=${form.bind('prefs.owners', { type: 'select-multiple' })}>
          <option value="ava">Ava</option>
          <option value="milo">Milo</option>
          <option value="nina">Nina</option>
        </select>
        <input id="count-child" type="number" bind=${form.bind('prefs.count', { type: 'number' })}>
        <input id="promo-child" bind=${form.bind('prefs.promo', { parse: (target: HTMLInputElement) => target.value.trim().toLowerCase() })}>
      </form>
    `, '#root');

    const enabled = document.getElementById('enabled-child') as HTMLInputElement;
    enabled.checked = true;
    const planPro = document.getElementById('plan-pro-child') as HTMLInputElement;
    planPro.checked = true;
    const owners = document.getElementById('owners-child') as HTMLSelectElement;
    Array.from(owners.options).forEach((option) => {
      option.selected = option.value === 'milo';
    });
    const count = document.getElementById('count-child') as HTMLInputElement;
    count.value = '';
    const promo = document.getElementById('promo-child') as HTMLInputElement;
    promo.value = ' ZED ';

    form.sync(promo);
    form.set('prefs.count', (previous: any) => (previous === undefined ? 0 : previous) + 2);

    const formElement = document.getElementById('sync-form') as HTMLFormElement;
    const result = await submit.onSubmit({
      preventDefault() {},
      currentTarget: formElement,
      target: formElement
    } as any);

    assert.strictEqual(result.prefs.enabled, true);
    assert.strictEqual(result.prefs.plan, 'pro');
    assert.deepStrictEqual(result.prefs.owners, ['milo']);
    assert.strictEqual(result.prefs.count, 2);
    assert.strictEqual(result.prefs.promo, 'zed');
    assert.deepStrictEqual(form.values(), {
      prefs: {
        enabled: false,
        plan: 'basic',
        owners: ['ava'],
        count: 2,
        promo: 'abc'
      }
    });
    assert.deepStrictEqual(seen[0], ['abc', 'abc']);

    submit.reset();
    form.sync(null);
    stop();
    cleanup();
  });

  it('exercises direct bind handlers across text, checkbox, radio, multi-select, and number inputs', async function () {
    const form = createFormKit({
      profile: {
        name: '',
        enabled: false,
        tags: [] as string[],
        plan: 'basic',
        owners: [] as string[],
        count: 1,
        promo: 'seed'
      }
    }, {
      validators: {
        'profile.name': (value: string) => value ? null : 'Required'
      }
    });

    const textBind = form.bind('profile.name');
    const enabledBind = form.bind('profile.enabled', { type: 'checkbox' });
    const tagAlphaBind = form.bind('profile.tags', { type: 'checkbox', value: 'alpha' });
    const tagBetaBind = form.bind('profile.tags', { type: 'checkbox', value: 'beta' });
    const planBind = form.bind('profile.plan', { type: 'radio', value: 'pro' });
    const ownersBind = form.bind('profile.owners', { type: 'select-multiple' });
    const countBind = form.bind('profile.count', { type: 'number' });
    const promoBind = form.bind('profile.promo', {
      event: 'change',
      name: 'promo-code',
      format: (value: string) => value.toUpperCase(),
      parse: (target: HTMLInputElement) => target.value.trim().toLowerCase()
    });

    (textBind['@input'] as Function)({ currentTarget: { value: 'Ada' } });
    await (textBind['@blur'] as Function)();
    (enabledBind['@change'] as Function)({ currentTarget: { checked: true } });
    (tagAlphaBind['@change'] as Function)({ currentTarget: { checked: true, value: 'alpha' } });
    (tagBetaBind['@change'] as Function)({ currentTarget: { checked: true, value: 'beta' } });
    (tagAlphaBind['@change'] as Function)({ currentTarget: { checked: false, value: 'alpha' } });
    (planBind['@change'] as Function)({ currentTarget: { checked: true, value: 'pro' } });
    (ownersBind['@change'] as Function)({
      currentTarget: {
        selectedOptions: [{ value: 'ava' }, { value: 'milo' }]
      }
    });
    (countBind['@input'] as Function)({ currentTarget: { value: '' } });
    (countBind['@input'] as Function)({ currentTarget: { value: '4' } });
    (promoBind['@change'] as Function)({ currentTarget: { value: ' VIP ' } });

    await flush();

    assert.strictEqual(form.values().profile.name, 'Ada');
    assert.strictEqual(form.values().profile.enabled, true);
    assert.deepStrictEqual(form.values().profile.tags, ['beta']);
    assert.strictEqual(form.values().profile.plan, 'pro');
    assert.deepStrictEqual(form.values().profile.owners, ['ava', 'milo']);
    assert.strictEqual(form.values().profile.count, 4);
    assert.strictEqual(form.values().profile.promo, 'vip');
    assert.strictEqual(form.errors()['profile.name'], undefined);
    assert.strictEqual((enabledBind['.checked'] as Function)(), true);
    assert.strictEqual((planBind['.checked'] as Function)(), true);
    assert.strictEqual((promoBind['.value'] as string), 'SEED');
  });

  it('covers root replacement, fallback cloning, validator errors, and array replacement helpers', async function () {
    const originalClone = (globalThis as any).structuredClone;
    delete (globalThis as any).structuredClone;
    try {
      const form = createFormKit({
        profile: null as any,
        checklist: [] as Array<{ label: string }>,
        count: 0,
        mode: '',
        name: ''
      }, {
        validators: {
          name: async (value: string) => {
            await flush();
            return value ? null : 'Async required';
          },
          mode: (value: string) => value ? null : 'Mode required'
        }
      });

      form.set('', {
        profile: { address: [{ city: 'Los Angeles' }] },
        checklist: [],
        count: 1,
        mode: '',
        name: ''
      });
      form.set('profile.address.0.city', 'Seattle');
      form.set('count', (previous: number) => previous + 1);
      form.patch(() => undefined);

      const checklist = form.array('checklist');
      checklist.replace([{ label: 'One' }, { label: 'Two' }]);

      const valid = await form.validate(['name', 'mode']);
      assert.strictEqual(valid, false);
      assert.strictEqual(form.errors().name, 'Async required');
      assert.strictEqual(form.errors().mode, 'Mode required');
      assert.strictEqual(form.values().profile.address[0].city, 'Seattle');
      assert.strictEqual(form.values().count, 2);
      assert.deepStrictEqual(checklist.items().map((item: any) => item.label), ['One', 'Two']);
      assert.strictEqual(checklist.keys().length, 2);

      form.sync({} as any);
      assert.strictEqual(form.field('count').dirty(), true);
      assert.strictEqual(form.field('mode').validating(), false);
      assert.strictEqual(typeof form.field('mode').bind(), 'object');
    } finally {
      (globalThis as any).structuredClone = originalClone;
    }
  });

  it('manages field arrays with stable keys and movement helpers', function () {
    const form = createFormKit({
      task: {
        checklist: [
          { label: 'First' },
          { label: 'Second' }
        ]
      }
    });

    const checklist = form.array('task.checklist');
    const originalKeys = checklist.keys().slice();

    checklist.insert(1, { label: 'Inserted' });
    checklist.move(2, 0);
    checklist.remove(1);
    checklist.insert(99, { label: 'Last' });
    checklist.move(-1, 0);
    checklist.move(0, 99);
    checklist.remove(99);

    assert.deepStrictEqual(checklist.items().map((item: any) => item.label), ['Inserted', 'Last', 'Second']);
    assert.strictEqual(checklist.keys().length, 3);
    assert.strictEqual(checklist.keys()[2], originalKeys[1]);
  });

  it('covers derived signals, fallback sync branches, and submit catch helpers', async function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const form = createFormKit({
      prefs: {
        enabled: false,
        tags: [] as string[],
        plan: '',
        count: 1,
        extra: null as any
      },
      name: ''
    }, {
      validators: {
        name: async () => {
          await flush();
          throw new Error('validator boom');
        },
        'prefs.plan': (value: string) => value ? null : 'Plan required'
      }
    });

    const nameBind = form.bind('name');
    const enabledBind = form.bind('prefs.enabled', { type: 'checkbox' });
    const tagAlphaBind = form.bind('prefs.tags', { type: 'checkbox', value: 'alpha' });
    const tagBetaBind = form.bind('prefs.tags', { type: 'checkbox', value: 'beta' });
    const planBasicBind = form.bind('prefs.plan', { type: 'radio', value: 'basic' });
    const planProBind = form.bind('prefs.plan', { type: 'radio', value: 'pro' });

    Ity.render(() => Ity.html`
      <form id="coverage-form">
        <input id="name-coverage" bind=${nameBind}>
        <input id="enabled-coverage" type="checkbox" bind=${enabledBind}>
        <input id="tag-alpha-coverage" type="checkbox" bind=${tagAlphaBind}>
        <input id="tag-beta-coverage" type="checkbox" bind=${tagBetaBind}>
        <input id="plan-basic-coverage" type="radio" bind=${planBasicBind}>
        <input id="plan-pro-coverage" type="radio" bind=${planProBind}>
      </form>
    `, '#root');

    const enabledChecked = enabledBind['.checked'] as any;
    const planProChecked = planProBind['.checked'] as any;
    const seenEnabled: Array<[boolean, boolean]> = [];
    const stopEnabled = enabledChecked.subscribe((value: boolean, previous: boolean) => {
      seenEnabled.push([value, previous]);
    }, { immediate: true });

    assert.strictEqual(enabledChecked.get(), false);
    assert.strictEqual(enabledChecked.peek(), false);
    assert.strictEqual(planProChecked(), false);
    assert.deepStrictEqual(form.initialValues().prefs.tags, []);
    assert.strictEqual(form.validating(), false);
    assert.strictEqual(form.valid(), true);

    const countField = form.field('prefs.count');
    assert.strictEqual(countField.value.get(), 1);
    countField.value.update((value: number) => value + 1);
    assert.strictEqual(countField.value.peek(), 2);

    form.set('prefs.extra.0.city', 'Paris');
    assert.strictEqual(form.values().prefs.extra[0].city, 'Paris');

    const nameInput = document.getElementById('name-coverage') as HTMLInputElement;
    nameInput.value = 'Launch';
    nameInput.dispatchEvent(new window.Event('blur', { bubbles: true }));
    await flush();
    await flush();

    (enabledBind['@change'] as Function)({ currentTarget: { checked: true } });
    await flush();
    assert.strictEqual(form.values().prefs.enabled, true);
    assert.strictEqual(enabledChecked(), true);

    (tagAlphaBind['@change'] as Function)({ currentTarget: { checked: true, value: 'alpha' } });
    (tagBetaBind['@change'] as Function)({ currentTarget: { checked: true, value: 'beta' } });
    (planProBind['@change'] as Function)({ currentTarget: { checked: true, value: 'pro' } });
    await flush();

    assert.deepStrictEqual(form.values().prefs.tags, ['alpha', 'beta']);
    assert.strictEqual(form.values().prefs.plan, 'pro');
    assert.strictEqual(planProChecked(), true);
    assert.ok(seenEnabled.some(([value]) => value === true));

    form.field('prefs.plan').set('');
    assert.strictEqual(await form.field('prefs.plan').validate(), false);
    assert.strictEqual(form.errors()['prefs.plan'], 'Plan required');

    const submit = form.submit(async () => {
      throw new Error('submit boom');
    });
    const formElement = document.getElementById('coverage-form') as HTMLFormElement;
    submit.handleSubmit({
      preventDefault() {},
      currentTarget: formElement,
      target: formElement
    } as any);
    await flush();
    await flush();

    stopEnabled();
    cleanup();
  });
});
