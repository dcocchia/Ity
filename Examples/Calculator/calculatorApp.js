require(['../../Ity'], function (Ity) {
	initialize(Ity);
});

var initialize = function(Ity) {
	var myApp = new Ity.Application();
	var myModel = new Ity.Model();
	var calcView = new Ity.View({
		el: ".testBox",
		app: myApp,
		model: myModel,
		events: {
			".numBtn" : {
				"click": "onNumBtnClick"
			},
			".operatorBtn" : {
				"click": "onOpBtnClick"
			},
			".equalBtn" : {
				"click": "onEqualClick"
			}
		},

		initialize: function(options) {
			this.on("soundOff", function(){
				console.log(this.id + ": ", this.el);
			});

			this.instructions = [];

			this.model.on("change", this.render, this);
		},

		render: function() {
			this.select(".output").html(this.model.get("calculatedOutPut"));
		},

		onNumBtnClick: function(e) {
			var button = e.currentTarget,
				value = button.getAttribute("data-calc-num");

			if (e && e.preventDefault) { e.preventDefault(); }

			if (value !== undefined) { this.addInstruction(parseFloat(value)); }

		},

		onOpBtnClick: function(e) {
			var button = e.currentTarget,
				operator = button.getAttribute("data-calc-operator");

			if (e && e.preventDefault) { e.preventDefault(); }

			if (operator !== undefined) { this.addInstruction(operator); }
		},

		onEqualClick: function(e) {
			if (e && e.preventDefault) { e.preventDefault(); }

			this.calculate();
		},

		addInstruction: function(instruction) {
			if (typeof(instruction) === "number" || (typeof(instruction) === "string" && this.checkInstruction(instruction))) {
				this.instructions.push(instruction);
			}
		},

		calculate: function() {
			var firstValue = 0,
				secondValue = 0,
				endValue = 0,
				currentOperator, instruction, lastInstruction, nextInstruction;

			for (var i = 0; i < this.instructions.length; i += 1) {
				lastInstruction = (i > 0) ? this.instructions[i - 1] : undefined;
				nextInstruction = (this.instructions[i + 1]) ? this.instructions[i + 1] : undefined;
				instruction = this.instructions[i];

				if (typeof(instruction) === "number") {
					if (!currentOperator) {
						firstValue = parseFloat(firstValue.toString() + instruction);
					} else {
						secondValue = parseFloat(secondValue.toString() + instruction);
					}

					if (currentOperator && (!nextInstruction || this.checkInstruction(nextInstruction)) ) {
						endValue = this.executeOperator(currentOperator, firstValue, secondValue);
						currentOperator = undefined;

						if (nextInstruction) {
							firstValue = endValue;
							secondValue = 0;
						}
					}

				} else if (this.checkInstruction(instruction)) {
					currentOperator = instruction;
				} else {
					this.instructions.splice(i, 1);
				}
			}

			this.instructions = [];

			this.model.set("calculatedOutPut", endValue);
		},

		checkInstruction: function(instruction) {
			switch(instruction) {
				case "+":
					return true;
				case "-":
					return true;
				case "*":
					return true;
				case "/":
					return true;
				default:
					return false;
			}
		},

		executeOperator: function(opStr, firstValue, secondValue) {
			switch(opStr) {
				case "+":
					return firstValue += secondValue;
				case "-":
					return firstValue -= secondValue;
				case "*":
					return firstValue * secondValue;
				case "/":
					return firstValue / secondValue;
				default:
					return firstValue;
			}
		}
	});
}