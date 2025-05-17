const { JSDOM } = require('jsdom');

exports.setupDOM = function(html = '<!DOCTYPE html><div id="root"></div>') {
  const dom = new JSDOM(html);
  const prevWindow = global.window;
  const prevDocument = global.document;
  global.window = dom.window;
  global.document = dom.window.document;
  require('../Ity.js');
  return function cleanup() {
    global.window = prevWindow;
    global.document = prevDocument;
    // clear module cache
    delete require.cache[require.resolve('../Ity.js')];
  };
};
