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
  const dom = new JSDOM(html);
  const prevWindow = global.window;
  const prevDocument = global.document;
  const prevNodeList = global.NodeList;
  const prevHTMLElement = global.HTMLElement;
  const prevHTMLDocument = global.HTMLDocument;
  global.window = dom.window;
  global.document = dom.window.document;
  global.NodeList = dom.window.NodeList;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLDocument = dom.window.HTMLDocument;
  if (!global.window.HTMLElement.prototype.getAttribute) {
    global.window.HTMLElement.prototype.getAttribute = function(name: string): any {
      const attrs: any = (this as any).attributes || {};
      if (name in attrs) return attrs[name];
      if (name.startsWith('data-calc-')) {
        const alt = name.split('-').pop();
        return attrs[alt] !== undefined ? attrs[alt] : null;
      }
      return null;
    };
  }
  if (!global.window.HTMLElement.prototype._dispatchPatched) {
    const origDispatch = global.window.HTMLElement.prototype.dispatchEvent;
    global.window.HTMLElement.prototype.dispatchEvent = function(event: any): void {
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
  require('../../Ity.js');
  return function cleanup(): void {
    global.window = prevWindow;
    global.document = prevDocument;
    global.NodeList = prevNodeList;
    global.HTMLElement = prevHTMLElement;
    global.HTMLDocument = prevHTMLDocument;
    // clear module cache
    delete require.cache[require.resolve('../../Ity.js')];
  };
}
