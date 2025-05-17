// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('SelectorObject class manipulation', function () {
  it('adds a class to each element', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="el1"></div><div id="el2"></div>');
    const div1 = document.getElementById('el1');
    const div2 = document.getElementById('el2');
    const selector = new window.Ity.SelectorObject([div1, div2]);
    selector.addClass('foo');
    assert(div1.classList.contains('foo'));
    assert(div2.classList.contains('foo'));
    cleanup();
  });

  it('toggles and checks classes', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="el"></div>');
    const div = document.getElementById('el');
    const selector = new window.Ity.SelectorObject([div]);
    selector.toggleClass('bar');
    assert(selector.hasClass('bar'));
    selector.toggleClass('bar');
    assert(!selector.hasClass('bar'));
    cleanup();
  });
});
