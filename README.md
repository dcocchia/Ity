# Ity [![npm version](https://badge.fury.io/js/ity.svg)](http://badge.fury.io/js/ity)
A miniscule, dependency free JavaScript MVC

## Why?
* Tiny footprint for mobile networks (~5kb minified)
* Extremely fast DOM query/selection engine. No need for jQuery! (for DOM selection)
* Mobile first - no legacy hackery for ie < 10.
* Great for spinning up small, mobile-specific apps

## Installation
```
npm install ity
```
## Basic Usage

```ts
const myApp = new Ity.Application();
const myModel = new Ity.Model();
const myView = new Ity.View({
  el: '.someElement',
  app: myApp,
  model: myModel,
  events: {
    '.btn': {
      click: 'onBtnClick',
      hover: 'onBtnHover',
    },
    '.fancyBtn': {
      click: 'onFancyBtnClick',
      focus: 'onFancyBtnFocus',
    },
  },

  initialize(options?: unknown) {
    this.model.on('change', this.render, this);
  },

  render() {
    this.select('.myContainer').html(this.model.get('someData'));
  },

  onBtnClick(evt: Event) {
    const output = this.select('#difWithId').find('.output');

    output.html('<div><p>Click!</p></div>');
  },

  // ... more click, hover, focus events from events hash
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
* Model.off(eventName?, callback?) - remove Model instance event listener(s)
* Model.sync(options) - sync data in internal data object. Optionally pass options hash for url, type, success, error
* Model.trigger(eventName, data) - trigger event by name on Model instance and optionally pass data

## View
* View.initialize(options) - called on instantiation of View instances, optional options hash can be passed
* View.getName() - return name attribute of view
* View.get(key) - return attribute of view by key String
* View.set(key, value) - set attribute of view to passed value
* View.on(eventName, callback) - listen to View instance events and call callback function
* View.off(eventName?, callback?) - remove View instance event listener(s)
* View.remove() - Remove internal el element and remove view from app
* View.trigger(eventName, data) - trigger event by name on View instance and optionally pass data
* View.select(DOMquery) - select DOM elements within set el object.

## Router
* Router.addRoute(pattern, handler) - register a URL pattern and callback. Dynamic segments prefixed with `:` become params.
* Router.navigate(path) - update the history state and dispatch the matching route.
* Router.start() - start listening for `popstate` events (called automatically on creation).
* Router.stop() - stop listening for URL changes.

```ts
const router = new Ity.Router();
router.addRoute('/users/:id', params => {
  console.log('Showing user', params.id);
});
router.navigate('/users/5');
```

## The Selection Engine and Selector object
Based on jQuery's DOM querying. Selection is done from within a View instance. 


```ts
const myView = new Ity.View({
  el: '.someDiv',
  render() {
    // view.select will default to interacting with only the el and its children
    this.select('.someChildofSomeDiv').html('<p>Hello, View!</p>');
  },
});

myView.select('<CSS Selector>').html(htmlContent);
```
### Chaining
```ts
const myView = new Ity.View({ el: '.parentDiv' });
myView
  .select('.myDiv')
  .append('<p>Hi!</p>')
  .parent()
  .find('.myOtherDiv')
  .remove();
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
```bash
cd your/directory/Ity
npm install
npm run build
```

This creates `dist/ity.js`, `dist/ity.min.js` and their source maps. You can verify
the minified build works by running:
```bash
npm run test:dist
```


## License
The MIT License (MIT)

Copyright (c) 2025 Dominic Cocchiarella

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
