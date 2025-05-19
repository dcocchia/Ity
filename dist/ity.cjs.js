var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// Ity.ts
var exports_Ity = {};
__export(exports_Ity, {
  default: () => Ity_default
});
module.exports = __toCommonJS(exports_Ity);
var Ity = function(window2) {
  const Ity2 = { version: "1.0.0" };
  const regexps = {
    rclass: /[\t\r\n\f]/g,
    rnotwhite: /\S/,
    nospaces: /^\S*$/
  };

  class SelectorObject {
    isSelectorObject = true;
    nodes = [];
    constructor(nodeList = []) {
      this.nodes = Array.from(nodeList);
      this.nodes.forEach((n, i) => this[i] = n);
    }
    get length() {
      return this.nodes.length;
    }
    [Symbol.iterator]() {
      return this.nodes[Symbol.iterator]();
    }
    find(selector) {
      const nodeList = [];
      for (const node of this.nodes) {
        const list = node.querySelectorAll(selector);
        for (const thisNode of Array.from(list)) {
          const elm = thisNode;
          if (nodeList.indexOf(elm) < 0) {
            nodeList.push(elm);
          }
        }
      }
      return new SelectorObject(nodeList);
    }
    filter(selector) {
      const nodeList = [];
      for (const node of this.nodes) {
        if (node.matches(selector)) {
          nodeList.push(node);
        }
      }
      return new SelectorObject(nodeList);
    }
    first() {
      return new SelectorObject(this[0] ? [this[0]] : []);
    }
    last() {
      return new SelectorObject(this.length ? [this[this.length - 1]] : []);
    }
    parent() {
      const nodeList = [];
      for (const node of this.nodes) {
        const parent = node.parentElement;
        if (parent && nodeList.indexOf(parent) < 0) {
          nodeList.push(parent);
        }
      }
      return new SelectorObject(nodeList);
    }
    children(selector) {
      const nodeList = [];
      for (const node of this.nodes) {
        const children = Array.from(node.children);
        for (const child of children) {
          if (nodeList.indexOf(child) < 0 && (!selector || child.matches(selector))) {
            nodeList.push(child);
          }
        }
      }
      return new SelectorObject(nodeList);
    }
    remove() {
      for (const node of this.nodes) {
        if (node.parentElement) {
          node.parentElement.removeChild(node);
        }
      }
      return new SelectorObject([]);
    }
    addClass(...classes) {
      for (const node of this.nodes) {
        node.classList.add(...classes);
      }
      return this;
    }
    removeClass(value) {
      if (value && regexps.nospaces.test(value)) {
        for (const node of this.nodes) {
          if (node.classList.contains(value)) {
            node.classList.remove(value);
          }
        }
      }
      return this;
    }
    toggleClass(value) {
      if (value && regexps.nospaces.test(value)) {
        for (const node of this.nodes) {
          node.classList.toggle(value);
        }
      }
      return this;
    }
    hasClass(value) {
      if (!(value && regexps.nospaces.test(value)))
        return false;
      for (const node of this.nodes) {
        if (node.classList.contains(value)) {
          return true;
        }
      }
      return false;
    }
    before(content) {
      return this._html(content, "beforebegin");
    }
    after(content) {
      return this._html(content, "afterend");
    }
    append(content) {
      return this._html(content, "beforeend");
    }
    prepend(content) {
      return this._html(content, "afterbegin");
    }
    html(content) {
      return this._html(content, "replace");
    }
    _html(content, position) {
      const isSelectorObject = content.isSelectorObject === true;
      for (const node of this.nodes) {
        if (!isSelectorObject) {
          const html = content.outerHTML ?? String(content);
          if (position === "replace") {
            node.innerHTML = html;
          } else {
            node.insertAdjacentHTML(position, html);
          }
        } else {
          const htmls = Array.from(content).map((selNode) => selNode.outerHTML);
          if (position === "replace") {
            node.innerHTML = htmls.join("");
          } else {
            for (const html of htmls) {
              node.insertAdjacentHTML(position, html);
            }
          }
        }
      }
      return this;
    }
  }
  function onDOMReady(fn, args = [], context = Ity2) {
    const func = () => fn.apply(context, args);
    if (document.readyState !== "loading") {
      func();
    } else {
      document.addEventListener("DOMContentLoaded", func);
    }
  }

  class Model {
    id;
    data;
    url;
    _events;
    constructor(opts = {}) {
      Object.assign(this, opts);
      this.id || (this.id = `m${Math.floor(Math.random() * 1e5) + 1}`);
      this._events || (this._events = {});
      this.data || (this.data = {});
      this.url || (this.url = "");
      this._init(opts);
    }
    onDOMReady = onDOMReady;
    _init(opts) {
      this.initialize(opts);
    }
    _ajax(opts = {}) {
      const model = this;
      const request = new XMLHttpRequest;
      opts.url ||= this.url;
      opts.type ||= "GET";
      opts.success ||= function(resp) {
        this.data = resp;
      };
      opts.error ||= function() {};
      request.open(opts.type, opts.url, true);
      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          const resp = JSON.parse(request.responseText);
          opts.success.call(model, resp);
        } else {
          opts.error.call(model, request.status);
        }
      };
      request.onerror = function() {
        opts.error.call(model);
      };
      request.send();
    }
    initialize(options) {}
    get(attr) {
      if (!attr)
        return this.data;
      return this.data ? this.data[attr] : undefined;
    }
    set(attr, value) {
      if (typeof attr === "string") {
        this.data[attr] = value;
      } else if (typeof attr === "object") {
        this.data = attr;
      }
      this.trigger("change", this.data);
    }
    unSet(attr) {
      if (this.data && Object.prototype.hasOwnProperty.call(this.data, attr)) {
        delete this.data[attr];
        this.trigger("change", this.data);
      }
    }
    clear() {
      this.data = {};
      this.trigger("change", this.data);
    }
    on(evtName, callback, context = this) {
      (this._events[evtName] ||= []).push({ callback, ctx: context });
    }
    off(evtName, callback, context) {
      if (!evtName) {
        this._events = {};
        return;
      }
      const events = this._events[evtName];
      if (!events)
        return;
      if (!callback) {
        delete this._events[evtName];
        return;
      }
      for (let i = events.length - 1;i >= 0; i--) {
        const evt = events[i];
        if (evt.callback === callback && (context === undefined || evt.ctx === context)) {
          events.splice(i, 1);
        }
      }
      if (events.length === 0)
        delete this._events[evtName];
    }
    sync(opts) {
      this._ajax(opts);
    }
    trigger(evtName, data) {
      const evts = this._events[evtName];
      if (evts) {
        for (const evt of evts) {
          evt.callback.call(evt.ctx, data);
        }
      }
    }
  }

  class View {
    id;
    el;
    app;
    name;
    events;
    _events;
    constructor(opts = {}) {
      Object.assign(this, opts);
      this.id || (this.id = `v${Math.floor(Math.random() * 1e5) + 1}`);
      if (this.app)
        this.app.addView(this);
      this._events || (this._events = {});
      this.events || (this.events = {});
      onDOMReady(this._init, [opts], this);
    }
    _setElement(elSelector) {
      if (elSelector?.isSelectorObject) {
        this.el = elSelector;
      } else if (elSelector instanceof NodeList) {
        this.el = new SelectorObject(elSelector);
      } else if (typeof elSelector === "string") {
        this.el = new SelectorObject(window2.document.querySelectorAll(elSelector));
      } else if (elSelector instanceof HTMLElement) {
        this.el = new SelectorObject([elSelector]);
      } else {
        throw new Error("el selector must be of type String, NodeList, HTMLElement or Ity.SelectorObject");
      }
    }
    _bindDOMEvents(evtObj) {
      if (!this.el || !this.el.isSelectorObject)
        return;
      const captureEvents = ["focus", "blur"];
      for (const selector in evtObj) {
        for (const evt in evtObj[selector]) {
          const callback = this[evtObj[selector][evt]];
          const capture = captureEvents.includes(evt);
          this._delegateEvent(selector, evt, callback, capture);
        }
      }
    }
    _delegateEvent(selector, evtName, callback, capture = false) {
      for (const root of this.el) {
        root.addEventListener(evtName, (e) => {
          let node = e.target;
          while (node) {
            if (node.matches && node.matches(selector)) {
              callback.call(this, e);
              break;
            }
            if (node === root)
              break;
            node = node.parentElement;
          }
        }, capture);
      }
    }
    _init(opts) {
      if (this.el)
        this._setElement(this.el);
      this._bindDOMEvents(this.events);
      this.initialize(opts);
    }
    initialize(opts) {}
    getName() {
      return this.name;
    }
    get(attr) {
      return this[attr];
    }
    set(attr, value) {
      this[attr] = value;
    }
    on(evtName, callback, context = this) {
      (this._events[evtName] ||= []).push({ callback, ctx: context });
    }
    off(evtName, callback, context) {
      if (!evtName) {
        this._events = {};
        return;
      }
      const events = this._events[evtName];
      if (!events)
        return;
      if (!callback) {
        delete this._events[evtName];
        return;
      }
      for (let i = events.length - 1;i >= 0; i--) {
        const evt = events[i];
        if (evt.callback === callback && (context === undefined || evt.ctx === context)) {
          events.splice(i, 1);
        }
      }
      if (events.length === 0)
        delete this._events[evtName];
    }
    remove() {
      this.el.remove();
      if (this.app)
        this.app.removeView(this.id);
    }
    trigger(evtName, data) {
      const evts = this._events[evtName];
      if (evts) {
        for (const evt of evts) {
          evt.callback.call(evt.ctx, data);
        }
      }
    }
    select(selector, ctx = this.el) {
      if (ctx instanceof HTMLElement || ctx instanceof HTMLDocument) {
        return new SelectorObject(ctx.querySelectorAll(selector));
      } else if (ctx.isSelectorObject) {
        return ctx.find(selector);
      }
      throw new Error("Context passed to .select() must be an HTMLElement or an Ity.SelectorObject");
    }
  }

  class Application {
    views = [];
    getView(id) {
      for (const view of this.views) {
        if (view.id === id)
          return view;
      }
      return;
    }
    addView(view) {
      if (view instanceof View)
        this.views.push(view);
    }
    removeView(id) {
      for (let i = 0;i < this.views.length; i++) {
        if (this.views[i].id === id) {
          this.views.splice(i, 1);
        }
      }
    }
    trigger(evtName, data) {
      for (const view of this.views) {
        view.trigger(evtName, data);
      }
    }
  }

  class Collection {
    models = [];
    url;
    ModelClass;
    constructor(models = [], ModelClass = Model) {
      this.ModelClass = ModelClass;
      this.url = "";
      models.forEach((m) => this.add(m));
    }
    get(id) {
      for (const model of this.models) {
        if (model.id === id)
          return model;
      }
      return;
    }
    add(model) {
      if (model instanceof Model)
        this.models.push(model);
    }
    remove(id) {
      const model = typeof id === "string" ? this.get(id) : id;
      if (!model)
        return;
      const idx = this.models.indexOf(model);
      if (idx >= 0)
        this.models.splice(idx, 1);
    }
    at(index) {
      return this.models[index];
    }
    get length() {
      return this.models.length;
    }
    clear() {
      this.models = [];
    }
    find(predicate) {
      for (const m of this.models) {
        if (predicate(m))
          return m;
      }
      return;
    }
    filter(predicate) {
      const out = [];
      for (const m of this.models) {
        if (predicate(m))
          out.push(m);
      }
      return out;
    }
    toJSON() {
      return this.models.map((m) => m.get());
    }
    _ajax(opts = {}) {
      const col = this;
      const request = new XMLHttpRequest;
      opts.url ||= this.url;
      opts.type ||= "GET";
      opts.success ||= function() {};
      opts.error ||= function() {};
      request.open(opts.type, opts.url, true);
      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          const resp = JSON.parse(request.responseText);
          opts.success.call(col, resp);
        } else {
          opts.error.call(col, request.status);
        }
      };
      request.onerror = function() {
        opts.error.call(col);
      };
      request.send();
    }
    fetch(opts = {}) {
      opts.success ||= function(resp) {
        const ctor = opts.modelClass || this.ModelClass;
        this.clear();
        resp.forEach((d) => {
          const m = new ctor;
          m.set(d);
          this.add(m);
        });
      };
      this._ajax(opts);
    }
    trigger(evtName, data) {
      for (const model of this.models) {
        model.trigger(evtName, data);
      }
    }
  }

  class Router {
    routes = [];
    listener;
    started = false;
    constructor() {
      this.listener = this._checkUrl.bind(this);
      this.start();
    }
    addRoute(pattern, handler) {
      const keys = [];
      const re = new RegExp("^" + pattern.replace(/\/?$/, "").replace(/:[^/]+/g, (m) => {
        keys.push(m.slice(1));
        return "([^/]+)";
      }) + "/?$");
      this.routes.push({ re, keys, handler });
    }
    navigate(path) {
      window2.history.pushState(null, "", path);
      this._checkUrl();
    }
    start() {
      if (!this.started) {
        window2.addEventListener("popstate", this.listener);
        this.started = true;
      }
      this._checkUrl();
    }
    stop() {
      if (this.started) {
        window2.removeEventListener("popstate", this.listener);
        this.started = false;
      }
    }
    _checkUrl() {
      const path = window2.location.pathname.replace(/[?#].*$/, "").replace(/\/?$/, "");
      for (const route of this.routes) {
        const match = route.re.exec(path);
        if (match) {
          const params = {};
          route.keys.forEach((k, i) => params[k] = match[i + 1]);
          const collect = (str) => {
            str = str.replace(/^[?#]/, "");
            if (!str)
              return;
            const search = new URLSearchParams(str);
            search.forEach((v, k) => {
              params[k] = v;
            });
          };
          collect(window2.location.search);
          collect(window2.location.hash);
          route.handler(params);
          break;
        }
      }
    }
  }
  Ity2.SelectorObject = SelectorObject;
  Ity2.onDOMReady = onDOMReady;
  Ity2.Model = Model;
  Ity2.View = View;
  Ity2.Application = Application;
  Ity2.Collection = Collection;
  Ity2.Router = Router;
  if (typeof define === "function" && define.amd) {
    define(function() {
      if (typeof window2 !== "undefined")
        window2.Ity = Ity2;
      return Ity2;
    });
  } else if (typeof module_Ity === "object" && typeof module_Ity.exports !== "undefined") {
    module_Ity.exports = Ity2;
  }
  if (typeof window2 !== "undefined") {
    window2.Ity = Ity2;
  }
  return Ity2;
}(typeof window !== "undefined" ? window : {});
var Ity_default = Ity;

//# debugId=217BEB8C7F41B3B764756E2164756E21
//# sourceMappingURL=Ity.js.map
