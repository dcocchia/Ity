const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Model basics', function () {
  it('set and get attributes', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    model.set('foo', 'bar');
    assert.equal(model.get('foo'), 'bar');
    model.set({baz: 1});
    assert.equal(model.get('baz'), 1);
    cleanup();
  });

  it('unset and clear', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    model.set({a: 1, b: 2});
    model.unSet('a');
    assert.equal(model.get('a'), undefined);
    model.clear();
    assert.deepEqual(model.get(), {});
    cleanup();
  });

  it('triggers change events', function () {
    const cleanup = setupDOM();
    const model = new window.Ity.Model();
    let changed = false;
    model.on('change', () => changed = true);
    model.set('x', 2);
    assert(changed);
    cleanup();
  });
  it('performs ajax sync via _ajax', function () {
    const cleanup = setupDOM();
    const originalXHR = global.XMLHttpRequest;
    function FakeXHR() {
      this.open = () => {};
      this.send = () => { this.status = 200; this.responseText = '{"a":1}'; this.onload(); };
    }
    const model = new window.Ity.Model({ url: '/foo' });
    global.XMLHttpRequest = function () { return new FakeXHR(); };
    model.sync({ success(resp){ this.data = resp; } });
    assert.deepEqual(model.get(), {a:1});
    global.XMLHttpRequest = originalXHR;
    cleanup();
  });
});
