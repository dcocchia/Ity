// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

// Copy of logic from the calculator example
function createCalcView(Ity: any): any {
  return new Ity.View({
    el: '.box',
    app: new Ity.Application(),
    model: new Ity.Model(),
    initialize: function() {
      this.instructions = [];
      this.model.on('change', this.render, this);
    },
    render: function() {
      this.select('.out').html(this.model.get('calculatedOutPut'));
    },
    addInstruction: function(instr: number | string): void {
      if (typeof instr === 'number' || (typeof instr === 'string' && this.checkInstruction(instr))) {
        this.instructions.push(instr);
      }
    },
    calculate: function(): void {
      let first = 0, second = 0, end = 0, op: string | undefined;
      for (let i = 0; i < this.instructions.length; i++) {
        const instr = this.instructions[i];
        const next = this.instructions[i + 1];
        if (typeof instr === 'number') {
          if (!op) {
            first = parseFloat(String(first) + instr);
          } else {
            second = parseFloat(String(second) + instr);
          }
          if (op && (!next || this.checkInstruction(next as string))) {
            end = this.executeOperator(op, first, second);
            op = undefined;
            if (next) { first = end; second = 0; }
          }
        } else if (this.checkInstruction(instr)) {
          op = instr;
        }
      }
      this.instructions = [];
      this.model.set('calculatedOutPut', end);
    },
    checkInstruction: function(inst: string): boolean {
      switch (inst) {
        case '+':
        case '-':
        case '*':
        case '/':
          return true;
        default:
          return false;
      }
    },
    executeOperator: function(opStr: string, a: number, b: number): number {
      switch (opStr) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        default: return a;
      }
    }
  });
}

describe('Calculator logic', function() {
  it('performs addition', function() {
    const cleanup = setupDOM('<!DOCTYPE html><div class="box"><div class="out"></div></div>');
    const view = createCalcView(window.Ity);
    view.addInstruction(1);
    view.addInstruction('+');
    view.addInstruction(2);
    view.calculate();
    assert.strictEqual(view.model.get('calculatedOutPut'), 3);
    cleanup();
  });

  it('handles multiplication', function() {
    const cleanup = setupDOM('<!DOCTYPE html><div class="box"><div class="out"></div></div>');
    const view = createCalcView(window.Ity);
    view.addInstruction(3);
    view.addInstruction('*');
    view.addInstruction(4);
    view.calculate();
    assert.strictEqual(view.model.get('calculatedOutPut'), 12);
    cleanup();
  });
});
