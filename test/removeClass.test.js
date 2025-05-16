const assert = require('assert');
const { JSDOM } = require('jsdom');

describe('SelectorObject.removeClass', function () {
  it('removes a class from the wrapped element', function () {
    const dom = new JSDOM('<!DOCTYPE html><div id="el"></div>');
    const prevWindow = global.window;
    const prevDocument = global.document;

    global.window = dom.window;
    global.document = dom.window.document;

    // require library after globals have been set
    require('../Ity.js');

    const div = document.getElementById('el');
    const selector = new window.Ity.SelectorObject([div]);

    selector.addClass('foo');
    assert(div.classList.contains('foo'), 'class should be added');

    selector.removeClass('foo');
    assert(!div.classList.contains('foo'), 'class should be removed');

    // restore globals
    global.window = prevWindow;
    global.document = prevDocument;
  });
});
