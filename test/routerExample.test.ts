// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

// Logic from the router example
function createRouterView(Ity: any): any {
  const router = new Ity.Router();
  const view = new Ity.View({
    el: '#routerApp',
    app: new Ity.Application(),
    model: new Ity.Model(),
    events: {
      '.homeLink': { click: 'goHome' },
      '.userLink': { click: 'goUser' }
    },
    initialize: function() {
      router.addRoute('/', () => this.showHome());
      router.addRoute('/users/:id', p => this.showUser(p.id));
      this.model.on('change', this.render, this);
    },
    render: function() {
      this.select('.content').html(this.model.get('page'));
    },
    goHome: function(e: Event) {
      if (e && e.preventDefault) e.preventDefault();
      router.navigate('/');
    },
    goUser: function(e: Event) {
      if (e && e.preventDefault) e.preventDefault();
      const id = (e.target as HTMLElement).getAttribute('data-calc-id');
      if (id !== null) router.navigate('/users/' + id);
    },
    showHome: function() {
      this.model.set('page', 'Home');
    },
    showUser: function(id: string) {
      this.model.set('page', 'User ' + id);
    }
  });
  return { view, router };
}

describe('Router example logic', function () {
  it('navigates home on click', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="routerApp"><button class="homeLink"></button><button class="userLink" data-calc-id="1"></button><div class="content"></div></div>');
    const { view } = createRouterView(window.Ity);
    const btn = document.querySelector('.homeLink') as HTMLElement;
    btn.dispatchEvent(new window.Event('click'));
    assert.strictEqual(view.model.get('page'), 'Home');
    cleanup();
  });

  it('navigates to user route', function () {
    const cleanup = setupDOM('<!DOCTYPE html><div id="routerApp"><button class="homeLink"></button><button class="userLink" data-calc-id="5"></button><div class="content"></div></div>');
    const { view } = createRouterView(window.Ity);
    const btn = document.querySelector('.userLink') as HTMLElement;
    btn.dispatchEvent(new window.Event('click'));
    assert.strictEqual(view.model.get('page'), 'User 5');
    cleanup();
  });
});
