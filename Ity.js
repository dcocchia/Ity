

;(function(window) {

	var Ity = {
		version: "0.0.1"
	}

	var SelectorObject = Ity.SelectorObject = function(nodeList) {

		var selectorObject = Object.create(Array.prototype);

		selectorObject = Array.apply(selectorObject);

		for (var prop in SelectorObject.prototype){
            if (SelectorObject.prototype.hasOwnProperty(prop)){
                selectorObject[prop] = SelectorObject.prototype[prop];
            }
        }

        for ( var i = 0; i < nodeList.length; i++ ) {
			selectorObject[i] = nodeList[i];
		}

		//now we get an Array-like interface with custom prototype methods
        return selectorObject;

	}
		
	SelectorObject.prototype = {
		//TODO: use find function in other selector functions to allow selectors to be passed into those functions
		//ex myElm = view.select(".thing").first(".someOtherThing");
		//Or should I create a filter function and use that?
		find: function(selector) {
			var nodeList = [],
				thisNodeList, thisNode;

			for ( var i = 0; i < this.length; i++ ) {
				thisNodeList = this[i].querySelectorAll(selector);

				for ( var j = 0; j < thisNodeList.length; j++ ) {
					thisNode = thisNodeList[j];

					if (thisNode && nodeList.indexOf(thisNode) < 0) {
						nodeList.push(thisNode);
					}
				}

				j = 0;
			}

			return new SelectorObject(nodeList);
		},

		filter: function(selector) {
			var nodeList = [],
				thisNode;

			for (var i = 0; i < this.length; i++) {
				thisNode = this[i];

				if (thisNode.matches(selector)) {
					nodeList.push(thisNode);
				}
			}

			return new SelectorObject(nodeList);
		},

		first: function() {
			var nodeList = (this[0]) ? [this[0]] : [];
			
			return new SelectorObject(nodeList);
		},

		last: function() {
			var nodeList = (this[this.length - 1]) ? [this[this.length - 1]] : [];
			
			return new SelectorObject(nodeList);
		},

		parent: function() {
			var nodeList = [],
				thisNode;

			for ( var i = 0; i < this.length; i++ ) {
				thisNode = this[i].parentNode;

				if (nodeList.indexOf(thisNode) < 0) {
					nodeList.push(thisNode);
				}
			}

			return new SelectorObject(nodeList);
		},

		children: function() {
			var nodeList = [],
				thisNodeChildren,
				thisNode;

			for ( var i = 0; i < this.length; i++ ) {
				thisNodeChildren = this[i].children;

				for ( var j = 0; j < thisNodeChildren.length; j++ ) {
					thisNode = thisNodeChildren[j];

					if (thisNode && nodeList.indexOf(thisNode) < 0) {
						nodeList.push(thisNode);
					}
				}

				j = 0;
				
			}

			return new SelectorObject(nodeList);
		}
	}

	Ity.onDOMReady = function(fn, args, context) {
		args || (args = []);
		context || (context = this);

		func = function() {
			fn.apply(context, args);
		}

		if (document.readyState != 'loading'){
			func();
		} else {
			document.addEventListener('DOMContentLoaded', func);
		}
	}

	var Application = Ity.Application = function(opts) {
		this.views = [];
	}

	Application.prototype = {
		getView: function(id) {
			for (var view in this.views) {
				if (this.views[view].id === id) {
					return this.views[view];
				}
			}
		},

		addView: function(view) {
			if (view instanceof View) { this.views.push(view); }
		},

		removeView: function(id) {
			var thisView;

			for (var i = 0; i < this.views.length; i += 0) {
				thisView = this.views[i];
				if (thisView.id === id) {
					 this.views.splice(i, 1);
				}
			}
		},

		trigger: function(evtName, data) {
			var thisView;

			for (var i = 0; i < this.views.length; i += 1) {
				thisView = this.views[i];
				thisView.trigger(evtName, data);
			}
		}
	}

	var Model = Ity.Model = function(opts) {
		var options = opts || {};

		for (var option in options) {
			this[option] = options[option];
		}

		this.id || (this.id = "m" + Math.floor((Math.random() * 100000) + 1));
		this._events || (this._events = {});
		this.data || (this.data = {});
		this.url || (this.url = "");

		this._init(opts);
	}

	Model.prototype = {
		onDOMReady: Ity.onDOMReady, //just for easier access within View logic

		_init: function(opts) {
			this.initialize(opts);
		},

		_ajax: function(opts) {
			var model = this;
			var request = new XMLHttpRequest();

			opts || (opts = {});
			opts.url || (opts.url = this.url);
			opts.type || (opts.type = 'GET');
			opts.success || (opts.success = function(resp) { this.data = resp; });
			opts.error || (opts.error = function(){});

			request.open(opts.type, opts.url, true);

			request.onload = function() {
				if (request.status >= 200 && request.status < 400) {
					var resp = JSON.parse(request.responseText);
					opts.success.call(model, resp);
				} else {
					opts.error.call(model, request.status);
				}
			};

			request.onerror = function() {
				opts.error.call(this);
			};

			request.send();
		},

		initialize: function(options) {},

		get: function(attr) {
			if (this.data && this.data[attr]) { 
				return this.data[attr]; 
			} else if (!attr) {
				return this.data;
			}
		},

		set: function(attr, value) {

			if(typeof(attr) === "string") {
				this.data[attr] = value;
			} else if (typeof(attr) === "object") {
				this.data = attr;
			}
			
			this.trigger("change", this.data);
		},

		on: function(evtName, callback, context) {
			context || (context = this);
			this._events[evtName] = {
				callback: callback,
				ctx: context
			}
		},

		sync: function(opts) {
			this._ajax(opts);
		},

		trigger: function(evtName, data) {
			var evt = this._events[evtName];
			if (evt) {
				evt.callback.call(evt.ctx, data);
			}
		}

	}

	var View = Ity.View = function(opts) {
		var options = opts || {};

		for (var option in options) {
			this[option] = options[option];
		}

		this.id || (this.id = "v" + Math.floor((Math.random() * 100000) + 1));
		if (this.app) { this.app.addView(this); }
		this._events || (this._events = {});
		this.events || (this.events = {});

		Ity.onDOMReady(this._init, opts, this);

	}

	View.prototype = {

		_setElement: function(elSelector) {
			if (elSelector instanceof HTMLCollection) {
				this.el = elSelector;
			} else if (typeof(elSelector) === "string") {
				this.el = window.document.querySelectorAll(elSelector);
			}
	    },

	    _bindDOMEvents: function(evtObj) {
	    	var elmToBind;

	    	for (evtString in evtObj) {
	    		if (this.el) {

		    		if (this.el.length > 0 && this.el instanceof NodeList) {
		    			for (var i = 0; i < this.el.length; i += 1) {
		    				elmToBind = this.el[i].querySelectorAll(evtString);

		    				this._bindNodeElmsEvents(elmToBind, evtObj, evtString);
		    			}
		    		} else if (this.el instanceof HTMLElement){
		    			elmToBind = this.el.querySelectorAll(evtString);

		    			this._bindNodeElmsEvents(elmToBind, evtObj, evtString);
		    		}
		    	}
	    	}
	    },

	    _bindNodeElmsEvents: function(node, evtObj, evtString) {
	    	for (var idx = 0; idx < node.length; idx += 1) {

				for (var evt in evtObj[evtString]) {
					this._bindElmEvent(node[idx], evt, this[evtObj[evtString][evt]]);
				}
			}
	    },

	    _bindElmEvent: function(elm, DOMEvent, callback) {
	    	var self = this;

	    	elm.addEventListener(DOMEvent, function(e) {
	    		callback.call(self, e);
	    	});
	    },

	    _init: function(opts) {
	    	if (this.el) { this._setElement(this.el); }
	    	this._bindDOMEvents(this.events);

	    	this.initialize(opts);
	    },

	    initialize: function(opts) {},

		getName: function() {
			return this.name;
		},

		get: function(attr) {
			return this[attr];
		},

		set: function(attr, value) {
			this[attr] = value;
		},

		on: function(evtName, callback, context) {
			context || (context = this);
			this._events[evtName] = {
				callback: callback,
				ctx: context
			}
		},

		trigger: function(evtName, data) {
			var evt = this._events[evtName];
			if (evt) { evt.callback.call(evt.ctx, data); }
		},

		select: function( selector, ctx ) {
			//TODO: ctx as this.el[0] is too simplistic. What if multiple nodes? What if no nodes?
			var ctx = ctx || this.el[0],
				nodeList = ctx.querySelectorAll(selector);

			return new SelectorObject(nodeList);

		}
	}

	window.Ity = Ity;
})(window);