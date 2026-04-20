// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

function loadCalculatorExample(): any {
  const modulePath = '../Examples/Calculator/calculatorApp.js';
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
  return window.ItyExamples.createCalculatorApp;
}

describe('Calculator example', function() {
  it('renders a V2 signal-driven calculator and performs addition from clicks', function() {
    const cleanup = setupDOM('<!DOCTYPE html><div class="testBox"></div>');
    const createCalculatorApp = loadCalculatorExample();
    const app = createCalculatorApp(window.Ity, '.testBox');

    (document.querySelector('[data-calc-num="1"]') as HTMLElement).click();
    (document.querySelector('[data-calc-operator="+"]') as HTMLElement).click();
    (document.querySelector('[data-calc-num="2"]') as HTMLElement).click();
    (document.querySelector('.equalBtn') as HTMLElement).click();

    assert.strictEqual(app.output(), 3);
    assert.strictEqual(document.querySelector('.output')?.textContent, '3');
    assert.deepStrictEqual(app.instructions(), []);
    app.dispose();
    cleanup();
  });

  it('keeps the calculator logic reusable outside DOM events', function() {
    const cleanup = setupDOM('<!DOCTYPE html><div class="testBox"></div>');
    const createCalculatorApp = loadCalculatorExample();
    const app = createCalculatorApp(window.Ity, '.testBox');

    app.addInstruction(3);
    app.addInstruction('*');
    app.addInstruction(4);
    app.calculate();

    assert.strictEqual(app.output(), 12);
    assert.strictEqual(app.checkInstruction('/'), true);
    assert.strictEqual(app.checkInstruction('%'), false);
    assert.strictEqual(app.executeOperator('-', 10, 4), 6);
    app.dispose();
    cleanup();
  });
});
