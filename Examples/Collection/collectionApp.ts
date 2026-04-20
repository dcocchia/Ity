(function () {
  interface CollectionItem {
    id: number;
    name: string;
  }

  interface CollectionExampleApp {
    items: any;
    addItem(): void;
    removeItem(id: number): void;
    dispose(): void;
  }

  const createCollectionApp = (Ity: any, target: string | Element = '#collectionApp'): CollectionExampleApp => {
    const items = Ity.signal([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]);
    const nextId = Ity.signal(3);

    const addItem = (): void => {
      const id = nextId.peek();
      nextId.set(id + 1);
      items.update((current: CollectionItem[]) => [
        ...current,
        { id, name: `Item ${id}` }
      ]);
    };

    const removeItem = (id: number): void => {
      items.update((current: CollectionItem[]) => current.filter((item) => item.id !== id));
    };

    const dispose = Ity.render(() => Ity.html`
      <button class="addItem" @click=${addItem}>Add</button>
      <ul>
        ${items().map((item: CollectionItem) => Ity.html`
          <li data-id=${item.id}>
            <span class="itemName">${item.name}</span>
            <button class="removeItem" @click=${() => removeItem(item.id)}>Remove</button>
          </li>
        `)}
      </ul>
    `, target);

    return {
      items,
      addItem,
      removeItem,
      dispose
    };
  };

  const browserWindow = (globalThis as any).window;
  if (browserWindow) {
    browserWindow.ItyExamples ||= {};
    browserWindow.ItyExamples.createCollectionApp = createCollectionApp;
  }

  const amdRequire = (globalThis as any).require;
  const amdDefine = (globalThis as any).define;
  if (browserWindow && typeof amdRequire === 'function' && typeof amdDefine === 'function' && amdDefine.amd) {
    amdRequire(['../../../Ity'], (Ity: any) => {
      createCollectionApp(Ity);
    });
  }
})();
