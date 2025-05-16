# Ity [![npm version](https://badge.fury.io/js/ity.svg)](http://badge.fury.io/js/ity)
A miniscule, dependency free JavaScript MVC

## Why?
* Tiny footprint for mobile networks (~5kb minified)
* Extremely fast DOM query/selection engine. No need for jQuery! (for DOM selection)
* Mobile first - no legacy hackery for ie < 10.
* Great for spinning up small, mobile-specific apps

## To Do
* More useful event delegation. Currently, views must call _setElement() every time they render new DOM elements
* Currently no router for fancy SPA style urls


## Installation
```
npm install ity
```
## Basic Usage

```js
var myApp = new Ity.Application();
var myModel = new Ity.Model();
var myView = new Ity.View({
	el: '.someElement',
	app: myApp,
	model: myModel,
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
	},

	onBtnClick: function(evt) {
		var output = this.select("#difWithId").find(".output");

		output.html("<div><p>Click!</p></div>")
	}

	//... more click, hover, focus events from events hash 
});	

```
## App

* App.getView(id) - returns Ity.View instance by id
* App.addView(view) - add Ity.View instance to internal views array
* App.removeView(id) - remove Ity.View instance from internal views array by id
* App.trigger(evtName, data) -- trigger event by name on Application level. Optionally pass data

## Model
* Model.initialize(options) - called on instantiation of Model instances, optional options hash can be passed
* Model.get(someDataPoint) - get value from internal data object hash by key
* Model.set(someDataPoint, data) - set value of internal data object by key
* Model.unSet(someDataPoint) - clear out valye of interanl data objecy by key
* Model.clear() - clear entire internal data objecy
* Model.on(eventName, callback) - listen to Model instance events and call callback function
* Model.sync(options) - sync data in internal data object. Optionally pass options hash for url, type, success, error
* Model.trigger(eventName, data) - trigger event by name on Model instance and optionally pass data

## View
* View.initialize(options) - called on instantiation of View instances, optional options hash can be passed
* View.getName() - return name attribute of view
* View.get(key) - return attribute of view by key String
* View.set(key, value) - set attribute of view to passed value
* View.on(eventName, callback) - listen to View instance events and call callback function
* View.remove() - Remove internal el element and remove view from app
* View.trigger(eventName, data) - trigger event by name on View instance and optionally pass data
* View.select(DOMquery) - select DOM elements within set el object. 

## The Selection Engine and Selector object
Based on jQuery's DOM querying. Selection is done from within a View instance. 

```js
var myView new Ity.View({
	el: '.someDiv',
	render: function() {
		// view.select will default to interacting with only the el and it's children
		this.select('.someChildofSomeDiv').html('<p>Hello, View!</p>')
	}
});

view.select(<CSS Selector>).html(htmContent);
```

### Chaining
```js
myView = new Ity.view({ el: '.parentDiv'} );
myView.select('.myDiv').append('<p>Hi!</p>').parent().find('.myOtherDiv').remove();
```

### Selections
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
* addClass
* removeClass
* toggleClass
* hasClass

## Building locally
Once you have the repository cloned:
```js
cd your/directory/Ity
npm install
gulp compress
```

For now this will just create ity.min.js and ity.min.js.map in the /dist directory.


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
