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
		var elm = this.select(".output").first();

		if (elm && elm.innerHTML) { elm.innerHTML = this.model.get("caluclatedOutPut"); }
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
		var value = 0,
			instruction,
			lastInstruction;

		for (var i = 0; i < this.instructions.length; i += 1) {
			lastInstruction = (i > 0) ? this.instructions[i - 1] : undefined;
			instruction = this.instructions[i];

			if (typeof(instruction) === "number") {
				if (lastInstruction) {
					value = this.executeOperator(lastInstruction, instruction, value); 
				} else {
					value = instruction;
				}
			} else if (typeof(instruction) === "string" && this.checkInstruction(instruction)) {

			} else {
				this.instructions.splice(i, 1);
			}
		}

		this.instructions = [];

		this.model.set("caluclatedOutPut", value);
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

	executeOperator: function(opStr, num, value) {
		switch(opStr) {
			case "+":
				return value += num;
			case "-":
				return value -= num;
			case "*":
				return value * num;
			case "/":
				return value / num;
			default:
				return value;
		}
	}
});