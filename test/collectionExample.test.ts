// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

function loadCollectionExample(): any {
  const modulePath = '../Examples/Collection/collectionApp.js';
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return window.ItyExamples.createCollectionApp;
}

describe('Collection example', function () {
  it('renders initial items from a V2 signal array', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="collectionApp"></div>');
    const createCollectionApp = loadCollectionExample();
    const app = createCollectionApp(window.Ity, '#collectionApp');
    const names = Array.from(document.querySelectorAll('.itemName')).map((node: Element) => node.textContent);

    assert.deepStrictEqual(app.items().map((item: any) => item.name), ['Alice', 'Bob']);
    assert.deepStrictEqual(names, ['Alice', 'Bob']);
    app.dispose();
    cleanup();
  });

  it('adds and removes items through rendered V2 event handlers', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="collectionApp"></div>');
    const createCollectionApp = loadCollectionExample();
    const app = createCollectionApp(window.Ity, '#collectionApp');

    (document.querySelector('.addItem') as HTMLElement).click();
    assert.deepStrictEqual(app.items().map((item: any) => item.name), ['Alice', 'Bob', 'Item 3']);
    assert.strictEqual(document.querySelectorAll('li').length, 3);

    (document.querySelector('li[data-id="2"] .removeItem') as HTMLElement).click();
    assert.deepStrictEqual(app.items().map((item: any) => item.name), ['Alice', 'Item 3']);
    assert.deepStrictEqual(
      Array.from(document.querySelectorAll('.itemName')).map((node: Element) => node.textContent),
      ['Alice', 'Item 3']
    );
    app.dispose();
    cleanup();
  });
});
