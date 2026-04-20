(function () {
  type CalculatorToken = number | '+' | '-' | '*' | '/';

  interface CalculatorApp {
    instructions: any;
    output: any;
    addInstruction(instruction: CalculatorToken): void;
    calculate(): void;
    checkInstruction(instruction: string): boolean;
    executeOperator(operator: string, firstValue: number, secondValue: number): number;
    dispose(): void;
  }

  const createCalculatorApp = (Ity: any, target: string | Element = '.testBox'): CalculatorApp => {
    const instructions = Ity.signal([] as CalculatorToken[]);
    const output = Ity.signal('');
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const operators: CalculatorToken[] = ['+', '-', '/', '*'];

    const checkInstruction = (instruction: string): boolean => {
      return instruction === '+' || instruction === '-' || instruction === '*' || instruction === '/';
    };

    const executeOperator = (operator: string, firstValue: number, secondValue: number): number => {
      switch (operator) {
        case '+':
          return firstValue + secondValue;
        case '-':
          return firstValue - secondValue;
        case '*':
          return firstValue * secondValue;
        case '/':
          return firstValue / secondValue;
        default:
          return firstValue;
      }
    };

    const addInstruction = (instruction: CalculatorToken): void => {
      if (typeof instruction === 'number' || checkInstruction(instruction)) {
        instructions.update((current: CalculatorToken[]) => [...current, instruction]);
      }
    };

    const calculate = (): void => {
      let firstValue = 0;
      let secondValue = 0;
      let endValue = 0;
      let currentOperator: string | undefined;
      const currentInstructions = instructions.peek();

      for (let i = 0; i < currentInstructions.length; i += 1) {
        const instruction = currentInstructions[i];
        const nextInstruction = currentInstructions[i + 1];

        if (typeof instruction === 'number') {
          if (!currentOperator) {
            firstValue = parseFloat(firstValue.toString() + instruction);
          } else {
            secondValue = parseFloat(secondValue.toString() + instruction);
          }

          if (currentOperator && (!nextInstruction || checkInstruction(nextInstruction as string))) {
            endValue = executeOperator(currentOperator, firstValue, secondValue);
            currentOperator = undefined;

            if (nextInstruction) {
              firstValue = endValue;
              secondValue = 0;
            }
          }
        } else if (checkInstruction(instruction)) {
          currentOperator = instruction;
        }
      }

      instructions.set([]);
      output.set(endValue);
    };

    const dispose = Ity.render(() => Ity.html`
      <div class="calculator">
        <div class="numberPad">
          ${numbers.map((num) => Ity.html`
            <button class="numBtn" data-calc-num=${num} @click=${() => addInstruction(num)}>
              ${num}
            </button>
          `)}
        </div>
        <div class="operatorPad">
          ${operators.map((operator) => Ity.html`
            <button
              class="operatorBtn"
              data-calc-operator=${operator}
              @click=${() => addInstruction(operator)}
            >
              ${operator}
            </button>
          `)}
          <button class="equalBtn" data-calc="=" @click=${calculate}>=</button>
        </div>
        <div class="output">${output}</div>
      </div>
    `, target);

    return {
      instructions,
      output,
      addInstruction,
      calculate,
      checkInstruction,
      executeOperator,
      dispose
    };
  };

  const browserWindow = (globalThis as any).window;
  if (browserWindow) {
    browserWindow.ItyExamples ||= {};
    browserWindow.ItyExamples.createCalculatorApp = createCalculatorApp;
  }

  const amdRequire = (globalThis as any).require;
  const amdDefine = (globalThis as any).define;
  if (browserWindow && typeof amdRequire === 'function' && typeof amdDefine === 'function' && amdDefine.amd) {
    amdRequire(['../../../Ity'], (Ity: any) => {
      createCalculatorApp(Ity);
    });
  }
})();
