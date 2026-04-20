(function () {
  interface RouterExampleApp {
    page: any;
    router: any;
    goHome(): void;
    goUser(id: string): void;
    showHome(): void;
    showUser(id: string): void;
    dispose(): void;
  }

  const createRouterApp = (Ity: any, target: string | Element = '#routerApp'): RouterExampleApp => {
    const page = Ity.signal('');
    const router = new Ity.Router({ autoStart: false, transition: true });

    const showHome = (): void => {
      page.set('Home');
    };

    const showUser = (id: string): void => {
      page.set(`User ${id}`);
    };

    const goHome = (): void => {
      router.navigate('/');
    };

    const goUser = (id: string): void => {
      router.navigate(`/users/${id}`);
    };

    router.add('/', showHome);
    router.add('/users/:id', (params: Record<string, string>) => showUser(params.id));

    const dispose = Ity.render(() => Ity.html`
      <nav>
        <button class="homeLink" @click=${goHome}>Home</button>
        <button class="userLink" data-calc-id="1" @click=${() => goUser('1')}>User 1</button>
        <button class="userLink" data-calc-id="2" @click=${() => goUser('2')}>User 2</button>
      </nav>
      <div class="content">${page}</div>
    `, target);

    router.start();

    return {
      page,
      router,
      goHome,
      goUser,
      showHome,
      showUser,
      dispose
    };
  };

  const browserWindow = (globalThis as any).window;
  if (browserWindow) {
    browserWindow.ItyExamples ||= {};
    browserWindow.ItyExamples.createRouterApp = createRouterApp;
  }

  const amdRequire = (globalThis as any).require;
  const amdDefine = (globalThis as any).define;
  if (browserWindow && typeof amdRequire === 'function' && typeof amdDefine === 'function' && amdDefine.amd) {
    amdRequire(['../../../Ity'], (Ity: any) => {
      createRouterApp(Ity);
    });
  }
})();
