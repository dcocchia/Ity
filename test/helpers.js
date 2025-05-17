let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  ({ JSDOM } = require('../simple-dom'));
}

exports.setupDOM = function(html = '<!DOCTYPE html><div id="root"></div>') {
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
  require('../Ity.js');
  return function cleanup() {
    global.window = prevWindow;
    global.document = prevDocument;
    global.NodeList = prevNodeList;
    global.HTMLElement = prevHTMLElement;
    global.HTMLDocument = prevHTMLDocument;
    // clear module cache
    delete require.cache[require.resolve('../Ity.js')];
  };
};
