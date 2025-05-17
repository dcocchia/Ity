class ClassList {
  constructor(classes = []) {
    this.set = new Set(classes.filter(Boolean));
  }
  add(...cls) { cls.forEach(c => this.set.add(c)); }
  remove(...cls) { cls.forEach(c => this.set.delete(c)); }
  toggle(cls) { if (this.set.has(cls)) { this.set.delete(cls); return false; } else { this.set.add(cls); return true; } }
  contains(cls) { return this.set.has(cls); }
  toString() { return Array.from(this.set).join(' '); }
}

class Node {
  constructor() {
    this.parentElement = null;
  }
}

class Event {
  constructor(type) {
    this.type = type;
    this.bubbles = true;
    this.cancelBubble = false;
    this.target = null;
  }
  stopPropagation() {
    this.cancelBubble = true;
  }
}

class TextNode extends Node {
  constructor(text) {
    super();
    this.textContent = text;
  }
  get outerHTML() { return this.textContent; }
}

class Element extends Node {
  constructor(tagName) {
    super();
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.attributes = {};
    this.id = '';
    this.classList = new ClassList();
    this._listeners = Object.create(null);
  }
  get parentNode() {
    return this.parentElement;
  }
  get className() {
    return this.classList.toString();
  }
  set className(val) {
    this.classList = new ClassList((val || '').split(/\s+/));
  }
  get firstChild() {
    return this.children[0] || null;
  }
  get firstElementChild() {
    return this.children.find(c => c instanceof Element) || null;
  }
  get childNodes() {
    return this.children;
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }
  get previousSibling() {
    if (!this.parentElement) return null;
    const idx = this.parentElement.children.indexOf(this);
    return idx > 0 ? this.parentElement.children[idx - 1] : null;
  }
  get nextSibling() {
    if (!this.parentElement) return null;
    const idx = this.parentElement.children.indexOf(this);
    return idx >= 0 && idx < this.parentElement.children.length - 1 ? this.parentElement.children[idx + 1] : null;
  }
  insertAdjacentHTML(position, html) {
    const nodes = parseHTML(html);
    switch(position) {
      case 'beforebegin': {
        if (!this.parentElement) return;
        const parent = this.parentElement;
        const idx = parent.children.indexOf(this);
        parent.children.splice(idx, 0, ...nodes);
        nodes.forEach(n => n.parentElement = parent);
        break;
      }
      case 'afterend': {
        if (!this.parentElement) return;
        const parent = this.parentElement;
        const idx = parent.children.indexOf(this);
        parent.children.splice(idx + 1, 0, ...nodes);
        nodes.forEach(n => n.parentElement = parent);
        break;
      }
      case 'afterbegin': {
        this.children.unshift(...nodes);
        nodes.forEach(n => n.parentElement = this);
        break;
      }
      case 'beforeend': {
        this.children.push(...nodes);
        nodes.forEach(n => n.parentElement = this);
        break;
      }
    }
  }
  get innerHTML() {
    return this.children.map(c => c.outerHTML).join('');
  }
  set innerHTML(html) {
    this.children = [];
    const nodes = parseHTML(html);
    nodes.forEach(n => { n.parentElement = this; this.children.push(n); });
  }
  get outerHTML() {
    const attrs = [];
    if (this.id) attrs.push(`id="${this.id}"`);
    if (this.classList.set.size) attrs.push(`class="${this.classList.toString()}"`);
    for (const [k,v] of Object.entries(this.attributes)) {
      if (k === 'id' || k === 'class') continue;
      attrs.push(`${k}="${v}"`);
    }
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
    return `<${this.tagName}${attrStr}>${this.innerHTML}</${this.tagName}>`;
  }
  querySelectorAll(selector) {
    let results = [];
    for (const child of this.children) {
      if (child instanceof Element) {
        if (matchesSelector(child, selector)) {
          results.push(child);
        }
        results = results.concat(child.querySelectorAll(selector));
      }
    }
    return results;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  getElementById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      if (child instanceof Element) {
        const found = child.getElementById(id);
        if (found) return found;
      }
    }
    return null;
  }
  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }

  dispatchEvent(event) {
    event.target || (event.target = this);
    if (this._listeners[event.type]) {
      for (const handler of this._listeners[event.type].slice()) {
        handler.call(this, event);
      }
    }
    if (event.bubbles !== false && !event.cancelBubble && this.parentElement) {
      this.parentElement.dispatchEvent(event);
    }
  }
  matches(selector) {
    return matchesSelector(this, selector);
  }
}

function matchesSelector(el, selector) {
  if (selector.startsWith('#')) return el.id === selector.slice(1);
  if (selector.startsWith('.')) return el.classList.contains(selector.slice(1));
  if (selector.includes('.')) {
    const [tag, cls] = selector.split('.');
    return el.tagName === tag && el.classList.contains(cls);
  }
  return el.tagName === selector;
}

function parseHTML(html) {
  const root = new Element('fragment');
  const stack = [root];
  const regex = /<[^>]+>|[^<]+/g;
  let match;
  while ((match = regex.exec(html))) {
    const token = match[0];
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
    } else if (token.startsWith('<')) {
      const selfClosing = token.endsWith('/>');
      const inner = token.substring(1, token.length - (selfClosing ? 2 : 1)).trim();
      const parts = inner.split(/\s+/);
      const tag = parts.shift();
      const el = new Element(tag);
      const attrStr = parts.join(' ');
      const attrRegex = /(\w+)="([^"]*)"/g;
      let m;
      while ((m = attrRegex.exec(attrStr))) {
        const name = m[1];
        const value = m[2];
        el.attributes[name] = value;
        if (name === 'id') el.id = value;
        if (name === 'class') el.classList = new ClassList(value.split(/\s+/));
      }
      stack[stack.length-1].appendChild(el);
      if (!selfClosing) stack.push(el);
    } else {
      const text = token;
      if (text.trim()) {
        const tn = new TextNode(text);
        stack[stack.length-1].appendChild(tn);
      }
    }
  }
  return root.children;
}

function setOwner(node, doc) {
  if (node instanceof Element || node instanceof TextNode) {
    node.ownerDocument = doc;
  }
  if (node instanceof Element) {
    node.children.forEach(c => setOwner(c, doc));
  }
}

class Document extends Element {
  constructor(html) {
    super('document');
    this.children = [];
    const nodes = parseHTML(html);
    nodes.forEach(n => { n.parentElement = this; setOwner(n, this); this.children.push(n); });
  }
}

class JSDOM {
  constructor(html) {
    const document = new Document(html);
    this.window = {
      document,
      Node,
      Text: TextNode,
      Element,
      HTMLElement: Element,
      HTMLDocument: Document,
      NodeList: Array,
      Event
    };
    this.window.window = this.window;
  }
}

module.exports = { JSDOM };
