declare function require(deps: string[], cb: (Ity: any) => void): void;

require(['../../../Ity'], (Ity: any) => {
  initialize(Ity);
});

const initialize = (Ity: any): void => {
  const myApp = new Ity.Application();
  const myModel = new Ity.Model();
  const calcView = new Ity.View({
    el: '.testBox',
    app: myApp,
    model: myModel,
    events: {
      '.numBtn': {
        click: 'onNumBtnClick'
      },
      '.operatorBtn': {
        click: 'onOpBtnClick'
      },
      '.equalBtn': {
        click: 'onEqualClick'
      }
    },

    initialize: function(this: any, options?: any): void {
      this.on('soundOff', () => {
        console.log(this.id + ': ', this.el);
      });

      this.instructions = [];

      this.model.on('change', this.render, this);
    },

    render: function(this: any): void {
      this.select('.output').html(this.model.get('calculatedOutPut'));
    },

    onNumBtnClick: function(this: any, e: Event): void {
      const button = e.currentTarget as HTMLElement;
      const value = button.getAttribute('data-calc-num');

      if (e && e.preventDefault) { e.preventDefault(); }

      if (value !== null) { this.addInstruction(parseFloat(value)); }
    },

    onOpBtnClick: function(this: any, e: Event): void {
      const button = e.currentTarget as HTMLElement;
      const operator = button.getAttribute('data-calc-operator');

      if (e && e.preventDefault) { e.preventDefault(); }

      if (operator !== null) { this.addInstruction(operator); }
    },

    onEqualClick: function(this: any, e: Event): void {
      if (e && e.preventDefault) { e.preventDefault(); }

      this.calculate();
    },

    addInstruction: function(this: any, instruction: number | string): void {
      if (typeof instruction === 'number' || (typeof instruction === 'string' && this.checkInstruction(instruction))) {
        this.instructions.push(instruction);
      }
    },

    calculate: function(this: any): void {
      let firstValue = 0,
        secondValue = 0,
        endValue = 0,
        currentOperator: string | undefined,
        instruction: number | string,
        lastInstruction: number | string | undefined,
        nextInstruction: number | string | undefined;

      for (let i = 0; i < this.instructions.length; i += 1) {
        lastInstruction = (i > 0) ? this.instructions[i - 1] : undefined;
        nextInstruction = (this.instructions[i + 1]) ? this.instructions[i + 1] : undefined;
        instruction = this.instructions[i];

        if (typeof instruction === 'number') {
          if (!currentOperator) {
            firstValue = parseFloat(firstValue.toString() + instruction);
          } else {
            secondValue = parseFloat(secondValue.toString() + instruction);
          }

          if (currentOperator && (!nextInstruction || this.checkInstruction(nextInstruction as string))) {
            endValue = this.executeOperator(currentOperator, firstValue, secondValue);
            currentOperator = undefined;

            if (nextInstruction) {
              firstValue = endValue;
              secondValue = 0;
            }
          }

        } else if (this.checkInstruction(instruction as string)) {
          currentOperator = instruction as string;
        } else {
          this.instructions.splice(i, 1);
        }
      }

      this.instructions = [];

      this.model.set('calculatedOutPut', endValue);
    },

    checkInstruction: function(this: any, instruction: string): boolean {
      switch (instruction) {
        case '+':
        case '-':
        case '*':
        case '/':
          return true;
        default:
          return false;
      }
    },

    executeOperator: function(this: any, opStr: string, firstValue: number, secondValue: number): number {
      switch (opStr) {
        case '+':
          return firstValue += secondValue;
        case '-':
          return firstValue -= secondValue;
        case '*':
          return firstValue * secondValue;
        case '/':
          return firstValue / secondValue;
        default:
          return firstValue;
      }
    }
  });
};


