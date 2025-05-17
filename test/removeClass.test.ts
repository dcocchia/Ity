// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('SelectorObject.removeClass', function () {
  it('removes a class from the wrapped element', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="el"></div>');

    const div = document.getElementById('el');
    const selector = new window.Ity.SelectorObject([div]);

    selector.addClass('foo');
    assert(div.classList.contains('foo'), 'class should be added');

    selector.removeClass('foo');
    assert(!div.classList.contains('foo'), 'class should be removed');

    cleanup();
  });
});
