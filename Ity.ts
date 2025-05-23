// Ity.ts 1.0.0
// (c) 2025 Dominic Cocchiarella
// Converted to TypeScript
declare var define: any;
declare var module: any;

const Ity: any = (function (window: any) {
  const Ity: any = { version: "1.0.0" };

  const regexps = {
    rclass: /[\t\r\n\f]/g,
    rnotwhite: /\S/,
    nospaces: /^\S*$/
  } as const;

  class SelectorObject {
    [index: number]: HTMLElement;
    public readonly isSelectorObject = true;
    private nodes: HTMLElement[] = [];

    constructor(nodeList: ArrayLike<HTMLElement> = []) {
      this.nodes = Array.from(nodeList as HTMLElement[]);
      this.nodes.forEach((n, i) => ((this as any)[i] = n));
    }

    get length(): number {
      return this.nodes.length;
    }

    [Symbol.iterator](): Iterator<HTMLElement> {
      return this.nodes[Symbol.iterator]();
    }

    find(selector: string): SelectorObject {
      const nodeList: HTMLElement[] = [];
      for (const node of this.nodes) {
        const list = node.querySelectorAll(selector);
        for (const thisNode of Array.from(list)) {
          const elm = thisNode as HTMLElement;
          if (nodeList.indexOf(elm) < 0) {
            nodeList.push(elm);
          }
        }
      }
      return new SelectorObject(nodeList);
    }

    filter(selector: string): SelectorObject {
      const nodeList: HTMLElement[] = [];
      for (const node of this.nodes) {
        if (node.matches(selector)) {
          nodeList.push(node);
        }
      }
      return new SelectorObject(nodeList);
    }

    first(): SelectorObject {
      return new SelectorObject(this[0] ? [this[0]] : []);
    }

    last(): SelectorObject {
      return new SelectorObject(this.length ? [this[this.length - 1]] : []);
    }

    parent(): SelectorObject {
      const nodeList: HTMLElement[] = [];
      for (const node of this.nodes) {
        const parent = node.parentElement;
        if (parent && nodeList.indexOf(parent) < 0) {
          nodeList.push(parent);
        }
      }
      return new SelectorObject(nodeList);
    }

    children(selector?: string): SelectorObject {
      const nodeList: HTMLElement[] = [];
      for (const node of this.nodes) {
        const children = Array.from(node.children) as HTMLElement[];
        for (const child of children) {
          if (nodeList.indexOf(child) < 0 && (!selector || child.matches(selector))) {
            nodeList.push(child);
          }
        }
      }
      return new SelectorObject(nodeList);
    }

    remove(): SelectorObject {
      for (const node of this.nodes) {
        if (node.parentElement) {
          node.parentElement.removeChild(node);
        }
      }
      return new SelectorObject([]);
    }

    addClass(...classes: string[]): this {
      for (const node of this.nodes) {
        node.classList.add(...classes);
      }
      return this;
    }

    removeClass(value: string): this {
      if (value && regexps.nospaces.test(value)) {
        for (const node of this.nodes) {
          if (node.classList.contains(value)) {
            node.classList.remove(value);
          }
        }
      }
      return this;
    }

    toggleClass(value: string): this {
      if (value && regexps.nospaces.test(value)) {
        for (const node of this.nodes) {
          node.classList.toggle(value);
        }
      }
      return this;
    }

    hasClass(value: string): boolean {
      if (!(value && regexps.nospaces.test(value))) return false;
      for (const node of this.nodes) {
        if (node.classList.contains(value)) {
          return true;
        }
      }
      return false;
    }

    before(content: string | SelectorObject | HTMLElement): this {
      return this._html(content, 'beforebegin');
    }

    after(content: string | SelectorObject | HTMLElement): this {
      return this._html(content, 'afterend');
    }

    append(content: string | SelectorObject | HTMLElement): this {
      return this._html(content, 'beforeend');
    }

    prepend(content: string | SelectorObject | HTMLElement): this {
      return this._html(content, 'afterbegin');
    }

    html(content: string | SelectorObject | HTMLElement): this {
      return this._html(content, 'replace');
    }

    private _html(content: string | SelectorObject | HTMLElement, position: InsertPosition | 'replace'): this {
      const isSelectorObject = (content as any).isSelectorObject === true;
      for (const node of this.nodes) {
        if (!isSelectorObject) {
          const html = (content as HTMLElement).outerHTML ?? String(content);
          if (position === 'replace') {
            node.innerHTML = html;
          } else {
            node.insertAdjacentHTML(position as InsertPosition, html);
          }
        } else {
          const htmls = Array.from(content as SelectorObject).map((selNode) => selNode.outerHTML);
          if (position === 'replace') {
            node.innerHTML = htmls.join('');
          } else {
            for (const html of htmls) {
              node.insertAdjacentHTML(position as InsertPosition, html);
            }
          }
        }
      }
      return this;
    }
  }
  function onDOMReady(fn: (...args: any[]) => void, args: unknown[] = [], context: any = Ity): void {
    const func = () => fn.apply(context, args);
    if (document.readyState !== 'loading') {
      func();
    } else {
      document.addEventListener('DOMContentLoaded', func);
    }
  }

  interface EventRecord { callback: (data?: unknown) => void; ctx: any; }

  class Model<T extends Record<string, unknown> = Record<string, unknown>> {
    public id!: string;
    public data!: T;
    public url!: string;
    private _events!: Record<string, EventRecord[]>;

    constructor(opts: Partial<Model<T>> = {}) {
      Object.assign(this, opts);
      this.id || (this.id = `m${Math.floor(Math.random() * 100000) + 1}`);
      this._events || (this._events = {});
      this.data || (this.data = {} as T);
      this.url || (this.url = "");
      this._init(opts);
    }

    onDOMReady = onDOMReady;

    protected _init(opts?: Partial<Model<T>>): void {
      this.initialize(opts);
    }

    protected _ajax(opts: {
      url?: string;
      type?: string;
      success?: (resp: any) => void;
      error?: (status?: number) => void;
    } = {}): void {
      const model = this;
      const request = new XMLHttpRequest();
      opts.url ||= this.url;
      opts.type ||= 'GET';
      opts.success ||= function (this: Model<T>, resp: any) { this.data = resp; };
      opts.error ||= function () {};
      request.open(opts.type!, opts.url!, true);
      request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
          const resp = JSON.parse(request.responseText);
          opts.success!.call(model, resp);
        } else {
          opts.error!.call(model, request.status);
        }
      };
      request.onerror = function () {
        opts.error!.call(model);
      };
      request.send();
    }

    initialize(options?: Partial<Model<T>>): void {}

    get(attr?: keyof T): any {
      if (!attr) return this.data;
      return this.data ? (this.data as any)[attr as string] : undefined;
    }

    set(attr: keyof T | Partial<T>, value?: any): void {
      if (typeof attr === "string") {
        (this.data as any)[attr] = value;
      } else if (typeof attr === "object") {
        this.data = attr as T;
      }
      this.trigger("change", this.data);
    }

    unSet(attr: keyof T): void {
      if (this.data && Object.prototype.hasOwnProperty.call(this.data, attr)) {
        delete (this.data as any)[attr];
        this.trigger("change", this.data);
      }
    }

    clear(): void {
      this.data = {} as T;
      this.trigger("change", this.data);
    }

    on(evtName: string, callback: (data?: unknown) => void, context: any = this): void {
      (this._events[evtName] ||= []).push({ callback, ctx: context });
    }

    off(evtName?: string, callback?: (data?: unknown) => void, context?: any): void {
      if (!evtName) {
        this._events = {};
        return;
      }
      const events = this._events[evtName];
      if (!events) return;
      if (!callback) {
        delete this._events[evtName];
        return;
      }
      for (let i = events.length - 1; i >= 0; i--) {
        const evt = events[i];
        if (evt.callback === callback && (context === undefined || evt.ctx === context)) {
          events.splice(i, 1);
        }
      }
      if (events.length === 0) delete this._events[evtName];
    }

    sync(opts?: Parameters<Model<T>["_ajax"]>[0]): void {
      this._ajax(opts);
    }

    trigger(evtName: string, data?: unknown): void {
      const evts = this._events[evtName];
      if (evts) {
        for (const evt of evts) {
          evt.callback.call(evt.ctx, data);
        }
      }
    }
  }
  interface ViewEvents { [selector: string]: Record<string, string>; }
  interface ViewOptions {
    el?: string | SelectorObject | NodeList | HTMLElement;
    app?: Application;
    name?: string;
    events?: ViewEvents;
  }

  class View {
    public id!: string;
    public el!: SelectorObject;
    public app?: Application;
    public name?: string;
    public events!: ViewEvents;
    private _events!: Record<string, EventRecord[]>;

    constructor(opts: ViewOptions = {}) {
      Object.assign(this, opts);
      this.id || (this.id = `v${Math.floor(Math.random() * 100000) + 1}`);
      if (this.app) this.app.addView(this);
      this._events || (this._events = {});
      this.events || (this.events = {});
      onDOMReady(this._init, [opts], this);
    }

    private _setElement(elSelector: ViewOptions["el"]): void {
      if ((elSelector as SelectorObject)?.isSelectorObject) {
        this.el = elSelector as SelectorObject;
      } else if (elSelector instanceof NodeList) {
        this.el = new SelectorObject(elSelector as any);
      } else if (typeof elSelector === "string") {
        this.el = new SelectorObject(window.document.querySelectorAll(elSelector));
      } else if (elSelector instanceof HTMLElement) {
        this.el = new SelectorObject([elSelector]);
      } else {
        throw new Error("el selector must be of type String, NodeList, HTMLElement or Ity.SelectorObject");
      }
    }

    private _bindDOMEvents(evtObj: ViewEvents): void {
      if (!this.el || !this.el.isSelectorObject) return;
      const captureEvents = ["focus", "blur"];
      for (const selector in evtObj) {
        for (const evt in evtObj[selector]) {
          const callback = (this as any)[evtObj[selector][evt]];
          const capture = captureEvents.includes(evt);
          this._delegateEvent(selector, evt, callback, capture);
        }
      }
    }

    private _delegateEvent(selector: string, evtName: string, callback: (e: Event) => void, capture = false): void {
      for (const root of this.el) {
        root.addEventListener(evtName, (e: Event) => {
          let node: HTMLElement | null = e.target as HTMLElement;
          while (node) {
            if ((node as any).matches && (node as any).matches(selector)) {
              callback.call(this, e);
              break;
            }
            if (node === root) break;
            node = node.parentElement;
          }
        }, capture);
      }
    }

    private _init(opts: ViewOptions): void {
      if (this.el) this._setElement(this.el);
      this._bindDOMEvents(this.events);
      this.initialize(opts);
    }

    initialize(opts?: ViewOptions): void {}

    getName(): string | undefined {
      return this.name;
    }

    get(attr: keyof this): any {
      return (this as any)[attr];
    }

    set(attr: keyof this, value: any): void {
      (this as any)[attr] = value;
    }

    on(evtName: string, callback: (data?: unknown) => void, context: any = this): void {
      (this._events[evtName] ||= []).push({ callback, ctx: context });
    }

    off(evtName?: string, callback?: (data?: unknown) => void, context?: any): void {
      if (!evtName) {
        this._events = {};
        return;
      }
      const events = this._events[evtName];
      if (!events) return;
      if (!callback) {
        delete this._events[evtName];
        return;
      }
      for (let i = events.length - 1; i >= 0; i--) {
        const evt = events[i];
        if (evt.callback === callback && (context === undefined || evt.ctx === context)) {
          events.splice(i, 1);
        }
      }
      if (events.length === 0) delete this._events[evtName];
    }

    remove(): void {
      this.el.remove();
      if (this.app) this.app.removeView(this.id);
    }

    trigger(evtName: string, data?: unknown): void {
      const evts = this._events[evtName];
      if (evts) {
        for (const evt of evts) {
          evt.callback.call(evt.ctx, data);
        }
      }
    }

    select(selector: string, ctx: HTMLElement | HTMLDocument | SelectorObject = this.el): SelectorObject {
      if (ctx instanceof HTMLElement || ctx instanceof HTMLDocument) {
        return new SelectorObject(ctx.querySelectorAll(selector));
      } else if ((ctx as any).isSelectorObject) {
        return (ctx as SelectorObject).find(selector);
      }
      throw new Error('Context passed to .select() must be an HTMLElement or an Ity.SelectorObject');
    }
  }

  class Application {
    public views: View[] = [];

    getView(id: string): View | undefined {
      for (const view of this.views) {
        if (view.id === id) return view;
      }
      return undefined;
    }

    addView(view: View): void {
      if (view instanceof View) this.views.push(view);
    }

    removeView(id: string): void {
      for (let i = 0; i < this.views.length; i++) {
        if (this.views[i].id === id) {
          this.views.splice(i, 1);
        }
      }
    }

    trigger(evtName: string, data?: unknown): void {
      for (const view of this.views) {
        view.trigger(evtName, data);
      }
    }
  }

  class Collection<M extends Model = Model> {
    public models: M[] = [];
    public url!: string;
    private ModelClass: new () => M;

    constructor(models: M[] = [], ModelClass: new () => M = Model as any) {
      this.ModelClass = ModelClass;
      this.url = "";
      models.forEach((m) => this.add(m));
    }

    get(id: string): M | undefined {
      for (const model of this.models) {
        if (model.id === id) return model;
      }
      return undefined;
    }

    add(model: M): void {
      if (model instanceof Model) this.models.push(model);
    }

    remove(id: string | M): void {
      const model = typeof id === 'string' ? this.get(id) : id;
      if (!model) return;
      const idx = this.models.indexOf(model as M);
      if (idx >= 0) this.models.splice(idx, 1);
    }

    at(index: number): M | undefined {
      return this.models[index];
    }

    get length(): number {
      return this.models.length;
    }

    clear(): void {
      this.models = [];
    }

    find(predicate: (m: M) => boolean): M | undefined {
      for (const m of this.models) {
        if (predicate(m)) return m;
      }
      return undefined;
    }

    filter(predicate: (m: M) => boolean): M[] {
      const out: M[] = [];
      for (const m of this.models) {
        if (predicate(m)) out.push(m);
      }
      return out;
    }

    toJSON(): any[] {
      return this.models.map((m) => m.get());
    }

    protected _ajax(opts: {
      url?: string;
      type?: string;
      success?: (resp: any) => void;
      error?: (status?: number) => void;
    } = {}): void {
      const col = this;
      const request = new XMLHttpRequest();
      opts.url ||= this.url;
      opts.type ||= 'GET';
      opts.success ||= function () {};
      opts.error ||= function () {};
      request.open(opts.type!, opts.url!, true);
      request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
          const resp = JSON.parse(request.responseText);
          opts.success!.call(col, resp);
        } else {
          opts.error!.call(col, request.status);
        }
      };
      request.onerror = function () {
        opts.error!.call(col);
      };
      request.send();
    }

    fetch(opts: Parameters<Collection<M>["_ajax"]>[0] & { modelClass?: new () => M } = {}): void {
      opts.success ||= function (this: Collection<M>, resp: any[]) {
        const ctor = (opts.modelClass || this.ModelClass) as new () => M;
        this.clear();
        resp.forEach((d) => {
          const m = new ctor();
          (m as any).set(d);
          this.add(m);
        });
      };
      this._ajax(opts);
    }

    trigger(evtName: string, data?: unknown): void {
      for (const model of this.models) {
        model.trigger(evtName, data);
      }
    }
  }

  interface Route {
    re: RegExp;
    keys: string[];
    handler: (params: Record<string, string>) => void;
  }

  class Router {
    private routes: Route[] = [];
    private listener: () => void;
    private started = false;

    constructor() {
      this.listener = this._checkUrl.bind(this);
      this.start();
    }

    addRoute(pattern: string, handler: Route["handler"]): void {
      const keys: string[] = [];
      const re = new RegExp(
        "^" +
          pattern
            .replace(/\/?$/, "")
            .replace(/:[^/]+/g, (m) => {
              keys.push(m.slice(1));
              return "([^/]+)";
            }) +
          "/?$"
      );
      this.routes.push({ re, keys, handler });
    }

    navigate(path: string): void {
      window.history.pushState(null, "", path);
      this._checkUrl();
    }

    start(): void {
      if (!this.started) {
        window.addEventListener("popstate", this.listener);
        this.started = true;
      }
      this._checkUrl();
    }

    stop(): void {
      if (this.started) {
        window.removeEventListener("popstate", this.listener);
        this.started = false;
      }
    }

    private _checkUrl(): void {
      const path = window.location.pathname.replace(/[?#].*$/, "").replace(/\/?$/, "");
      for (const route of this.routes) {
        const match = route.re.exec(path);
        if (match) {
          const params: Record<string, string> = {};
          route.keys.forEach((k, i) => (params[k] = match[i + 1]));
          const collect = (str: string): void => {
            str = str.replace(/^[?#]/, "");
          if (!str) return;
          const search = new URLSearchParams(str);
          search.forEach((v, k) => {
            params[k] = v;
          });
          };
          collect(window.location.search);
          collect(window.location.hash);
          route.handler(params);
          break;
        }
      }
    }
  }

  Ity.SelectorObject = SelectorObject;
  Ity.onDOMReady = onDOMReady;
  Ity.Model = Model;
  Ity.View = View;
  Ity.Application = Application;
  Ity.Collection = Collection;
  Ity.Router = Router;

  if (typeof define === 'function' && (define as any).amd) {
    (define as any)(function () {
      if (typeof window !== 'undefined') (window as any).Ity = Ity;
      return Ity;
    });
  } else if (typeof module === 'object' && typeof module.exports !== 'undefined') {
    module.exports = Ity;
  }
  if (typeof window !== 'undefined') {
    (window as any).Ity = Ity;
  }
  return Ity;
})(typeof window !== 'undefined' ? window : {} as any);

export default Ity;
