# Ity
A miniscule, depedency free JavaScript MVC

## Installation
```
npm install Ity
```
## Basic Usage

```js
var myApp = new Ity.Application();
var myModel = new Ity.Model();
var myView = new Ity.View({
	el: '.someElement',
	app: myApp,
	model: myModel.
	events: {
		".btn" : {
			"click": "onBtnClick",
			"hover": "onBtnHover"
		},
		".fancyBtn" : {
			"click": "onFancyBtnClick",
			"focus": "onFancyBtnFocus"
		}
	},

	initialize: function(options) {
		this.model.on("change", this.render, this);
	},

	render: function() {
		this.select(".myContainer").html(this.model.get("someData"));
	}
});	

```

##The Selection Engine and Selector object
Based on jQuery's DOM querying

```js
	Ity.select(<CSS Selector>).html(htmContent);
```

###Chaining
```js
Ity.select(".myDiv").append('<p>Hi!</p>').parent().find('.myOtherDiv').remove();
```

###Selections
* find
* filter
* first
* last
* parent
* children
* remove
* before
* after
* append
* prepend
* html


## License
The MIT License (MIT)

Copyright (c) 2015 Dominic Cocchiarella

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
