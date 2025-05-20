// @ts-nocheck
export {};
declare var require: any;
declare const global: any;

let JSDOM: any;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  ({ JSDOM } = require('../../simple-dom'));
}

export function setupDOM(html: string = '<!DOCTYPE html><div id="root"></div>') {
  const usingJest = !!process.env.JEST_WORKER_ID;
  let dom: any;
  let prevWindow: any;
  let prevDocument: any;
  let prevNodeList: any;
  let prevHTMLElement: any;
  let prevHTMLDocument: any;

  if (usingJest && global.document && global.window) {
    prevWindow = global.window;
    prevDocument = global.document;
    // Use the existing jsdom instance provided by Jest and overwrite its HTML
    global.document.open();
    global.document.write(html);
    global.document.close();
  } else {
    dom = new JSDOM(html);
    prevWindow = global.window;
    prevDocument = global.document;
    prevNodeList = global.NodeList;
    prevHTMLElement = global.HTMLElement;
    prevHTMLDocument = global.HTMLDocument;
    global.window = dom.window;
    global.document = dom.window.document;
    global.NodeList = dom.window.NodeList;
    global.HTMLElement = dom.window.HTMLElement;
    global.HTMLDocument = dom.window.HTMLDocument;
  }

  // jsdom starts with readyState 'loading' and never fires DOMContentLoaded
  // synchronously. Force a ready state of complete and dispatch the event so
  // onDOMReady callbacks execute immediately in tests.
  if (global.document.readyState === 'loading') {
    Object.defineProperty(global.document, 'readyState', { value: 'complete' });
    const evt = new global.window.Event('DOMContentLoaded');
    global.document.dispatchEvent(evt);
  }

  if (!usingJest && !global.window.addEventListener) {
    const listeners: Record<string, Function[]> = {};
    global.window.addEventListener = function (type: string, handler: Function) {
      (listeners[type] ||= []).push(handler);
    };
    global.window.removeEventListener = function (type: string, handler: Function) {
      const arr = listeners[type];
      if (!arr) return;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    };
    global.window.dispatchEvent = function (evt: { type: string }) {
      const arr = listeners[evt.type] || [];
      arr.slice().forEach((fn) => fn.call(global.window, evt));
    };
  }
  if (!usingJest && !global.window.history) {
    global.window.history = {
      stack: ["/"],
      pushState: function (_s: any, _t: any, path: string) {
        this.stack.push(path);
        const url = new URL(path, "http://ity.local");
        global.window.location.pathname = url.pathname;
        global.window.location.search = url.search;
        global.window.location.hash = url.hash;
      },
    } as any;
  }
  if (!usingJest && !global.window.location) {
    global.window.location = { pathname: "/", search: "", hash: "" } as any;
  }
  if (!usingJest && !global.window.HTMLElement.prototype.getAttribute) {
    global.window.HTMLElement.prototype.getAttribute = function (name: string): any {
      const attrs: any = (this as any).attributes || {};
      if (name in attrs) return attrs[name];
      if (name.startsWith('data-calc-')) {
        const alt = name.split('-').pop();
        return attrs[alt] !== undefined ? attrs[alt] : null;
      }
      return null;
    };
  }
  if (!usingJest && !global.window.HTMLElement.prototype._dispatchPatched) {
    const origDispatch = global.window.HTMLElement.prototype.dispatchEvent;
    
    global.window.HTMLElement.prototype.dispatchEvent = function (event: any): void {
      event.target || (event.target = this);
      if ((this as any)._listeners && (this as any)._listeners[event.type]) {
        for (const handler of (this as any)._listeners[event.type].slice()) {
          event.currentTarget = this;
          handler.call(this, event);
        }
      }
      if (event.bubbles !== false && !event.cancelBubble && (this as any).parentElement) {
        (this as any).parentElement.dispatchEvent(event);
      }
    };
    global.window.HTMLElement.prototype._dispatchPatched = true;
  }
  const ityPath = process.env.ITY_FILE || '../../Ity.js';
  require(ityPath);
  return function cleanup(): void {
    if (usingJest && global.document && global.window) {
      global.document.documentElement.innerHTML = '';
      global.window = prevWindow;
      global.document = prevDocument;
    } else {
      global.window = prevWindow;
      global.document = prevDocument;
      global.NodeList = prevNodeList;
      global.HTMLElement = prevHTMLElement;
      global.HTMLDocument = prevHTMLDocument;
    }
    // clear module cache
    delete require.cache[require.resolve(ityPath)];
  };
}
