declare function require(deps: string[], cb: (Ity: any) => void): void;

require(['../../../Ity'], (Ity: any) => {
  initCollection(Ity);
});

const initCollection = (Ity: any): void => {
  const app = new Ity.Application();
  const collection = new Ity.Collection([
    new Ity.Model({ data: { name: 'Alice' } }),
    new Ity.Model({ data: { name: 'Bob' } }),
  ]);

  const view = new Ity.View({
    el: '#collectionApp',
    app,
    events: {
      '.addItem': { click: 'addItem' }
    },
    initialize: function(this: any): void {
      this.collection = collection;
      this.render();
    },
    render: function(this: any): void {
      const html = this.collection.models
        .map((m: any) => `<li>${m.get('name')}</li>`) 
        .join('');
      this.select('ul').html(html);
    },
    addItem: function(this: any): void {
      const name = `Item ${this.collection.models.length + 1}`;
      this.collection.add(new Ity.Model({ data: { name } }));
      this.render();
    }
  });
};
