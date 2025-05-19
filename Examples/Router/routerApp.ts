declare function require(deps: string[], cb: (Ity: any) => void): void;

require(['../../../Ity'], (Ity: any) => {
  initRouter(Ity);
});

const initRouter = (Ity: any): void => {
  const app = new Ity.Application();
  const router = new Ity.Router();
  const view = new Ity.View({
    el: '#routerApp',
    app,
    model: new Ity.Model(),
    events: {
      '.homeLink': {
        click: 'goHome'
      },
      '.userLink': {
        click: 'goUser'
      }
    },

    initialize: function(this: any): void {
      router.addRoute('/', () => this.showHome());
      router.addRoute('/users/:id', (p: any) => this.showUser(p.id));
      this.model.on('change', this.render, this);
    },

    render: function(this: any): void {
      this.select('.content').html(this.model.get('page'));
    },

    goHome: function(this: any, e: Event): void {
      if (e && e.preventDefault) { e.preventDefault(); }
      router.navigate('/');
    },

    goUser: function(this: any, e: Event): void {
      if (e && e.preventDefault) { e.preventDefault(); }
      const id = (e.target as HTMLElement).getAttribute('data-calc-id');
      if (id !== null) {
        router.navigate('/users/' + id);
      }
    },

    showHome: function(this: any): void {
      this.model.set('page', 'Home');
    },

    showUser: function(this: any, id: string): void {
      this.model.set('page', 'User ' + id);
    }
  });
};

