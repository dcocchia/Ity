// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('SelectorObject traversal', function () {
  it('finds and filters elements', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div class="a"><span class="b"></span><span class="c"></span></div>');
    const div = document.querySelector('div');
    const selector = new window.Ity.SelectorObject([div]);
    const found = selector.find('span');
    assert.equal(found.length, 2);
    const filtered = found.filter('.b');
    assert.equal(filtered.length, 1);
    assert(filtered[0].classList.contains('b'));
    cleanup();
  });

  it('first and last return expected elements', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div class="a"></div><div class="b"></div>');
    const selector = new window.Ity.SelectorObject(Array.from(document.querySelectorAll('div')));
    assert(selector.first()[0].classList.contains('a'));
    assert(selector.last()[0].classList.contains('b'));
    cleanup();
  });

  it('parent and children work correctly', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="p"><span></span><span class="x"></span></div>');
    const span = document.querySelector('span');
    const selector = new window.Ity.SelectorObject([span]);
    const parent = selector.parent();
    assert.equal(parent[0].id, 'p');
    const children = parent.children();
    assert.equal(children.length, 2);
    const filtered = parent.children('.x');
    assert.equal(filtered.length, 1);
    cleanup();
  });
});
