// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('SelectorObject HTML insertion', function () {
  it('supports append, prepend, before, after, html', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="a"></div><div id="b"></div>');
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    const selector = new window.Ity.SelectorObject([a]);
    selector.append('<span class="x"></span>');
    assert.equal(a.querySelectorAll('span.x').length, 1);
    selector.prepend('<span class="y"></span>');
    assert.equal(a.firstChild.className, 'y');
    selector.after('<p id="after"></p>');
    assert(b.previousSibling.id === 'after');
    selector.before('<p id="before"></p>');
    assert(a.previousSibling.id === 'before');
    selector.html('<div id="c"></div>');
    assert.equal(a.children.length, 1);
    assert.equal(a.firstElementChild.id, 'c');
    cleanup();
  });

  it('accepts SelectorObject as content', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="target"></div><div id="src"><span class="c"></span></div>');
    const target = new window.Ity.SelectorObject([document.getElementById('target')]);
    const src = new window.Ity.SelectorObject([document.getElementById('src')]);
    target.append(src);
    target.prepend(src);
    target.before(src);
    target.after(src);
    target.html(src);
    assert.equal(target.first()[0].id, 'target');
    cleanup();
  });

  it('html with multiple elements replaces correctly', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="target"></div><div class="one"></div><div class="two"></div>');
    const target = new window.Ity.SelectorObject([document.getElementById('target')]);
    const multi = new window.Ity.SelectorObject([
      document.querySelector('.one'),
      document.querySelector('.two'),
    ]);
    target.html(multi);
    const children = target.first()[0].children;
    assert.equal(children.length, 2);
    assert(children[0].classList.contains('one'));
    assert(children[1].classList.contains('two'));
    cleanup();
  });

  it('handles HTMLElement content', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="target"></div>');
    const target = new window.Ity.SelectorObject([
      document.getElementById('target')
    ]);
    const span = document.createElement('span');
    target.append(span);
    assert.strictEqual(
      target.first()[0].lastElementChild?.tagName,
      'SPAN'
    );
    const div = document.createElement('div');
    target.html('<p></p>');
    target.append(div);
    assert.strictEqual(
      target.first()[0].lastElementChild?.tagName,
      'DIV'
    );
    cleanup();
  });
});
