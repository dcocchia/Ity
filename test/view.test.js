const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('View functionality', function () {
  it('set and get attributes', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const view = new window.Ity.View({ el: '#v' });
    view.set('name', 'test');
    assert.equal(view.get('name'), 'test');
    cleanup();
  });

  it('selects elements within context', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"><span class="x"></span></div>');
    const view = new window.Ity.View({ el: '#v' });
    const spans = view.select('span');
    assert.equal(spans.length, 1);
    cleanup();
  });

  it('remove removes element from DOM', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="v"></div>');
    const view = new window.Ity.View({ el: '#v' });
    view.remove();
    assert.strictEqual(document.getElementById('v'), null);
    cleanup();
  });
});
