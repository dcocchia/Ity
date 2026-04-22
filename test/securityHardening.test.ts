// @ts-nocheck
export {};
declare var require: any;
declare function describe(desc: string, fn: () => void): void;
declare function it(desc: string, fn: () => any): void;
const assert = require('assert');
const { setupDOM } = require('./helpers');

describe('Security hardening', function () {
  it('blocks unsafe attributes and SSR serialization while preserving explicit unsafe HTML', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main>');
    const warnings: any[] = [];
    try {
      window.Ity.configure({
        onWarning(warning: any) {
          warnings.push(warning);
        }
      });

      window.Ity.render(window.Ity.html`
        <section>
          <a id="js-link" href=${'javascript:alert(1)'}>Bad</a>
          <a id="data-link" href=${'data:text/html,<script>alert(1)</script>'}>Bad data</a>
          <iframe id="data-frame" src=${'data:text/html,<script>alert(4)</script>'}></iframe>
          <img id="inline-image" src=${'data:image/png;base64,AA=='} alt="inline">
          <button id="inline-handler" onclick=${'alert(1)'} ?onfocus=${true}>Button</button>
          <iframe id="frame" srcdoc=${'<script>bad()</script><p>ok</p>'}></iframe>
        </section>
      `, '#root', { reactive: false });

      assert.strictEqual(document.getElementById('js-link')?.hasAttribute('href'), false);
      assert.strictEqual(document.getElementById('data-link')?.hasAttribute('href'), false);
      assert.strictEqual(document.getElementById('data-frame')?.hasAttribute('src'), false);
      assert.strictEqual(document.getElementById('inline-image')?.getAttribute('src'), 'data:image/png;base64,AA==');
      assert.strictEqual(document.getElementById('inline-handler')?.hasAttribute('onclick'), false);
      assert.strictEqual(document.getElementById('inline-handler')?.hasAttribute('onfocus'), false);
      assert.strictEqual(document.getElementById('frame')?.getAttribute('srcdoc'), '&lt;script&gt;bad()&lt;/script&gt;&lt;p&gt;ok&lt;/p&gt;');

      const markup = window.Ity.renderToString(window.Ity.html`
        <a href=${'javascript:alert(1)'} bind=${{
          onclick: 'alert(2)',
          href: 'data:text/html,<script>alert(3)</script>'
        }}>Blocked</a>
        <iframe srcdoc=${'<script>bad()</script>'}></iframe>
      `);

      assert.ok(!markup.includes('javascript:'));
      assert.ok(!markup.includes('onclick='));
      assert.ok(!markup.includes('data:text/html'));
      assert.ok(markup.includes('srcdoc="&amp;lt;script&amp;gt;bad()&amp;lt;/script&amp;gt;"'));
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-url'));
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-attr'));
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-html-sink'));
    } finally {
      window.Ity.configure({ onWarning: null });
      cleanup();
    }
  });

  it('hardens property bindings and SelectorObject string insertion', function () {
    const cleanup = setupDOM('<!DOCTYPE html><main id="root"></main><div id="target"></div>');
    const warnings: any[] = [];
    let propClicks = 0;
    try {
      window.Ity.configure({
        onWarning(warning: any) {
          warnings.push(warning);
        }
      });

      window.Ity.render(window.Ity.html`
        <section>
          <div id="plain-html" .innerHTML=${'<img id="blocked-img" src=x onerror=bad()>'}></div>
          <div id="trusted-html" .innerHTML=${window.Ity.unsafeHTML('<span id="trusted-markup">ok</span>')}></div>
          <a id="prop-link" .href=${'javascript:alert(1)'}>Link</a>
          <button id="bad-prop" .onclick=${'alert(1)'}>Bad prop</button>
          <button id="good-prop" .onclick=${() => propClicks += 1}>Good prop</button>
        </section>
      `, '#root', { reactive: false });

      const plain = document.getElementById('plain-html');
      assert.strictEqual(plain?.querySelector('#blocked-img'), null);
      assert.strictEqual(plain?.innerHTML, '&lt;img id="blocked-img" src=x onerror=bad()&gt;');
      assert.strictEqual(document.getElementById('trusted-markup')?.textContent, 'ok');
      assert.notStrictEqual(document.getElementById('prop-link')?.getAttribute('href'), 'javascript:alert(1)');
      assert.strictEqual(typeof (document.getElementById('bad-prop') as HTMLButtonElement).onclick, 'object');
      (document.getElementById('good-prop') as HTMLButtonElement).click();
      assert.strictEqual(propClicks, 1);

      const target = new window.Ity.SelectorObject([document.getElementById('target')]);
      target.append('<span id="escaped"></span>');
      assert.strictEqual(document.getElementById('escaped'), null);
      assert.strictEqual(target.first()[0].textContent, '<span id="escaped"></span>');

      target.html(window.Ity.unsafeHTML('<strong id="allowed">allowed</strong>'));
      target.attr('onclick', 'alert(1)');
      target.attr('href', 'javascript:alert(1)');
      target.attr('srcdoc', '<script>bad()</script>');

      assert.strictEqual(target.first()[0].querySelector('#allowed')?.textContent, 'allowed');
      assert.strictEqual(target.attr('onclick'), null);
      assert.strictEqual(target.attr('href'), null);
      assert.strictEqual(target.attr('srcdoc'), '&lt;script&gt;bad()&lt;/script&gt;');
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-prop'));
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-url'));
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-html-sink'));
      assert.ok(warnings.some((warning) => warning.code === 'unsafe-attr'));
    } finally {
      window.Ity.configure({ onWarning: null });
      cleanup();
    }
  });
});
