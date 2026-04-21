# Ity

A tiny dependency-free reactive app kernel for small browser apps, embeddable
widgets, and progressive SPAs.

Ity 2 keeps the original Ity goal: do useful client-side app work without a
framework stack, runtime dependencies, or a large bundle. The primary API is now
reactive and platform-native: signals, computed values, effects, tagged HTML
templates, Web Components, and a modern router. The original MVC classes are
still included as a compatibility layer.

## Why Ity 2?

* Tiny runtime, no production dependencies.
* Fine-grained reactive state with `signal`, `computed`, `effect`, and `store`.
* Async UI primitives with `resource`, `action`, and `form`.
* Safe-by-default DOM templates: dynamic values become text unless explicitly
  marked with `unsafeHTML`.
* Native Web Component support via `component()`.
* SPA routing with URLPattern support when available and a regex fallback when
  it is not.
* Static/SSR string output through `renderToString`.
* Optional View Transition integration for same-document route/render updates.
* V1-compatible `Model`, `Collection`, `View`, `Application`, and
  `SelectorObject`.

## What's New In 2.2.0

Ity 2.2.0 turns the V2 kernel into a more complete application layer:

* `formState()` for field binding, dirty/touched tracking, validation, reset,
  and validated submits.
* `createConfig()` plus scoped `render(..., { config })` and
  `renderToString(..., { config })` so HTML sanitization can be app-local instead
  of global-only.
* `action.run()`, `action.with()`, `action.from()`, and `form.handleSubmit()`
  for safer direct DOM event wiring.
* `component()` props with `ctx.prop(name)` so custom elements can consume rich
  structured inputs, not just attributes.
* `router.link(path)` as a full bindable link object with base-aware `href` and
  click handling that also works inside shadow DOM.
* Form submits now synchronize the current form controls before validation, so
  programmatic fills and restored browser values do not drift from form state.
* A first-class examples runner via `npm run examples:serve` and a new
  [Examples/index.html](Examples/index.html) launcher.

## Installation

```bash
npm install ity
```

```ts
import Ity, { signal, computed, html, render } from "ity";
```

The package ships ESM, CommonJS, browser IIFE, minified IIFE, source maps, and
TypeScript declarations.

## Examples

The repository includes small focused demos plus a deeper production-style app:

* [Examples/index.html](Examples/index.html)
* [Examples/Calculator/index.html](Examples/Calculator/index.html)
* [Examples/Collection/index.html](Examples/Collection/index.html)
* [Examples/Router/index.html](Examples/Router/index.html)
* [Examples/OperationsWorkbench/index.html](Examples/OperationsWorkbench/index.html): a local-first operations application that exercises `resource`, `action`, `formState`, `store`, `Router`, `component`, `unsafeHTML`, and `renderToString` together.

Run them locally with:

```bash
npm install
npm run examples:serve
```

## Quick Start

```ts
import { signal, computed, html, render } from "ity";

const count = signal(0);
const doubled = computed(() => count() * 2);

render(() => html`
  <button @click=${() => count.update((n) => n + 1)}>
    Count: ${count}
  </button>
  <p>Doubled: ${doubled}</p>
`, "#app");
```

When `count` changes, only the reactive render effect reruns. Dynamic text is
inserted as text, not parsed as HTML.

## Signals

Signals are callable values.

```ts
const name = Ity.signal("Ada");

name();               // "Ada"
name.set("Grace");    // "Grace"
name("Hedy");         // callable setter
name.update((v) => v.toUpperCase());
name.peek();          // read without dependency tracking
```

### `computed`

```ts
const first = Ity.signal("Ada");
const last = Ity.signal("Lovelace");
const full = Ity.computed(() => `${first()} ${last()}`);

full(); // "Ada Lovelace"
```

Computed values are lazy and cached. They invalidate when dependencies change.

### `effect`

```ts
const stop = Ity.effect((onCleanup) => {
  const controller = new AbortController();
  onCleanup(() => controller.abort());

  console.log("Current value", full());
});

stop();
```

### `batch` and `untrack`

```ts
Ity.batch(() => {
  first.set("Grace");
  last.set("Hopper");
});

const snapshot = Ity.untrack(() => full());
```

`batch` coalesces dependent effects. `untrack` reads without subscribing the
current computation.

### `store`

```ts
const state = Ity.store({ name: "Ada", count: 1 });

state.name; // reactive read
state.count = 2;
state.$patch({ name: "Grace" });
state.$snapshot(); // plain object

const unsubscribe = state.$subscribe((value) => {
  console.log(value);
}, { immediate: true });
```

`store` tracks object structure as well as values. Effects and subscribers that
read `$snapshot()` rerun when keys are added or deleted.

## Async UI

### `resource`

`resource()` models loadable async data.

```ts
const user = Ity.resource(async ({ signal, previous, refreshId }) => {
  const response = await fetch(`/api/user?refresh=${refreshId}`, { signal });
  if (!response.ok) throw new Error("Failed to load user");
  return response.json() as Promise<{ name: string }>;
}, {
  initialValue: undefined,
  keepPrevious: true,
  onError(error) {
    console.error(error);
  }
});

Ity.render(() => Ity.html`
  ${user.loading() && Ity.html`<p>Loading...</p>`}
  ${user.error() && Ity.html`<p role="alert">${user.error().message}</p>`}
  ${user.data() && Ity.html`<h1>${user.data().name}</h1>`}
  <button @click=${() => user.refresh()}>Refresh</button>
`, "#app");
```

Each refresh aborts the previous in-flight refresh. Stale completions are
ignored, failures are captured in `error` instead of being thrown from
`refresh()`, and `mutate(value)` can update local state optimistically.

### `action`

`action()` models async writes and other user-triggered effects.

```ts
const save = Ity.action(async (payload: { name: string }) => {
  const response = await fetch("/api/user", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Save failed");
  return response.json();
});

Ity.render(() => Ity.html`
  <button ?disabled=${save.pending()} @click=${() => save({ name: "Ada" })}>
    ${save.pending() ? "Saving..." : "Save"}
  </button>
`, "#app");
```

Actions expose `data`, `error`, `pending`, `pendingCount`, `status`,
`submit()`, `run()`, `with()`, `from()`, and `reset()`.

### `form`

`form()` wraps `action()` for native forms.

```ts
const signup = Ity.form(async (data) => {
  const response = await fetch("/signup", {
    method: "POST",
    body: data
  });
  if (!response.ok) throw new Error("Signup failed");
  return response.json();
}, { resetOnSuccess: true });

Ity.render(() => Ity.html`
  <form @submit=${signup.onSubmit}>
    <input name="email" type="email" required>
    <button ?disabled=${signup.pending()}>Join</button>
    ${signup.error() && Ity.html`<p role="alert">${signup.error().message}</p>`}
  </form>
`, "#app");
```

For direct DOM event wiring that should stay inside the controller error model,
prefer `signup.handleSubmit` over `signup.onSubmit`.

### `formState`

`formState()` adds field-level state on top of native forms.

```ts
const draft = Ity.formState({
  title: "",
  ownerId: "ava",
  urgent: false
}, {
  validators: {
    title(value) {
      return value.trim() ? null : "Title is required.";
    }
  }
});

const saveDraft = draft.submit(async (values) => {
  return fetch("/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values)
  });
});

Ity.render(() => Ity.html`
  <form @submit=${saveDraft.handleSubmit}>
    <input bind=${draft.bind("title", { name: "taskTitle" })}>
    <select bind=${draft.bind("ownerId", { type: "select" })}></select>
    <label>
      <input type="checkbox" bind=${draft.bind("urgent", { type: "checkbox" })}>
      Urgent
    </label>
    ${draft.errors.title && Ity.html`<p role="alert">${draft.errors.title}</p>`}
  </form>
`, "#app");
```

`formState()` exposes `values`, `initialValues`, `errors`, `touched`, `dirty`,
`valid`, `field(name)`, `bind(name)`, `set()`, `reset()`, `validate()`,
`markTouched()`, and `submit()`.

## HTML Templates

`html` creates a template result. Use `render` to mount it.

```ts
const title = Ity.signal("Dashboard");

Ity.render(() => Ity.html`
  <section class=${["panel", "primary"]}>
    <h1>${title}</h1>
    <input .value=${title}>
    <button ?disabled=${false} @click=${() => title.set("Updated")}>
      Rename
    </button>
  </section>
`, "#app");
```

Supported bindings:

* Text/content: `${value}`.
* Events: `@click=${handler}` or `@click=${[handler, options]}`.
* Properties: `.value=${value}`.
* Boolean attributes: `?disabled=${condition}`.
* Attributes: `href=${url}`, `class=${["a", "b"]}`, `class=${{ active: true }}`.
* Style objects: `style=${{ color: "red" }}`.
* Nested templates, DOM nodes, arrays, and signals.

### Unsafe HTML

Dynamic values are safe text by default. If you intentionally want to parse a
string as HTML, mark that boundary explicitly:

```ts
Ity.html`<article>${Ity.unsafeHTML(trustedHtmlString)}</article>`;
```

Only pass trusted content to `unsafeHTML`. If your application allows rich HTML
from a less trusted source, wire in your sanitizer:

```ts
const htmlPolicy = Ity.createConfig({
  sanitizeHTML(value) {
    return DOMPurify.sanitize(value);
  }
});

Ity.render(() => Ity.html`
  <article>${Ity.unsafeHTML(userProvidedHtml)}</article>
`, "#app", { config: htmlPolicy });
```

You can still sanitize one boundary without changing configuration:

```ts
Ity.unsafeHTML(markdownHtml, { sanitize: sanitizeMarkdownOutput });
```

`Ity.configure({ sanitizeHTML })` still exists for process-wide setup, but
`createConfig()` is the better fit for multi-app pages, tests, and SSR.

Ity does not bundle a sanitizer. Sanitization policy depends on the content
source and threat model, and most production apps already standardize that
choice separately.

### Render Options

```ts
const stop = Ity.render(view, "#app", {
  reactive: true,
  transition: true,
});

stop();
```

`transition: true` uses `document.startViewTransition()` when the browser
supports it and falls back to a normal render otherwise.

### Static and SSR Output

```ts
const markup = Ity.renderToString(() => Ity.html`
  <article>
    <h1>${title}</h1>
    ${Ity.unsafeHTML(trustedBodyHtml)}
  </article>
`);
```

`renderToString` escapes dynamic text and attributes, skips event/property
bindings that only make sense in the browser, preserves boolean attributes, and
keeps `unsafeHTML` explicit.

## Components

`component()` defines a custom element and renders it with Ity templates.

```ts
Ity.component("ity-counter", {
  attrs: ["label"],
  shadow: true,
  styles: `
    button {
      border: 0;
      border-radius: 999px;
      padding: 0.65rem 1rem;
    }
  `,
  setup(ctx) {
    const label = ctx.attr("label");
    const count = Ity.signal(0);

    return () => Ity.html`
      <button @click=${() => count.update((n) => n + 1)}>
        ${label}: ${count}
      </button>
    `;
  }
});
```

Component context:

* `ctx.host`: the custom element instance.
* `ctx.root`: the shadow root or host render root.
* `ctx.attr(name)`: a signal for an observed attribute.
* `ctx.prop(name)`: a signal for a declared component property.
* `ctx.emit(name, detail, options)`: dispatch a composed bubbling custom event.
* `ctx.effect(fn)`: an effect that is disposed on disconnect.
* `ctx.onConnected(fn)` and `ctx.onDisconnected(fn)`: lifecycle hooks.

Structured props are declared with `props`:

```ts
Ity.component("user-card", {
  props: ["user"],
  shadow: true,
  setup(ctx) {
    const user = ctx.prop<{ name: string }>("user");
    return () => Ity.html`<h2>${user()?.name || "Unknown"}</h2>`;
  }
});
```

If a tag has already been defined, `component()` returns the existing
constructor instead of throwing.

## Router

```ts
const router = new Ity.Router({ transition: true });

router.add("/users/:id", (params, ctx) => {
  console.log(params.id, ctx.query, ctx.hash);
});

router.add("/files/*", (params) => {
  console.log(params.wildcard);
});

router.navigate("/users/42?tab=profile#panel=activity");
```

The router:

* Uses native `URLPattern` when available.
* Falls back to a small internal matcher for `:param` and `*` segments.
* Parses query and hash params.
* Exposes `router.current` as a signal.
* Intercepts same-origin in-base links from the document and composes bindable
  links with `router.link(path)`.
* Honors `base` for matching, navigation, link interception, and Navigation API
  events.
* Intercepts same-origin Navigation API events when the API is available.
* Supports `navigate(path, { replace, transition })`.
* Supports `href(path)` and `link(path, attrs)` helpers for template authoring.
* Supports `start()` and `stop()`.
* Runs cleanup functions returned from route and `notFound` handlers.

`router.link()` is the preferred way to author links in templates and custom
elements:

```ts
const router = new Ity.Router({ base: "/app" });

Ity.html`<a bind=${router.link("/users/42")}>User 42</a>`;
```

Route cleanup is useful when a route mounts a render effect, starts a
subscription, or owns async work:

```ts
router.add("/dashboard", () => {
  const stop = Ity.render(() => Ity.html`<dashboard-page></dashboard-page>`, "#app");
  return stop;
});
```

For very small apps, use the convenience helper:

```ts
Ity.route("/settings", () => {
  Ity.render(Ity.html`<settings-page></settings-page>`, "#app");
});
```

## V1 Compatibility

The original MVC API remains available:

```ts
const app = new Ity.Application();
const model = new Ity.Model({ data: { message: "Hello" } });

const view = new Ity.View({
  el: "#app",
  app,
  model,
  events: {
    "button": { click: "onClick" }
  },
  initialize() {
    this.model.on("change", this.render, this);
  },
  render() {
    this.select(".message").html(this.model.get("message"));
  },
  onClick() {
    this.model.set("message", "Updated");
  }
});
```

Compatibility classes:

* `Application`: view registry and app-level event fan-out.
* `Model`: data object, `get`, `set`, `unSet`, `clear`, events, `sync`.
* `Collection`: model array, filtering, lookup, `fetch`, collection signal.
* `View`: scoped element, delegated DOM events, event emitter, `renderWith`.
* `SelectorObject`: jQuery-like scoped DOM traversal and mutation.

V1 models and collections also expose reactive `state` signals, so old and new
code can be migrated incrementally.

## SelectorObject

```ts
const view = new Ity.View({ el: ".parent" });

view
  .select(".item")
  .addClass("active")
  .attr("aria-current", true)
  .text("Selected")
  .parent()
  .find(".remove")
  .remove();
```

Supported methods include `find`, `filter`, `first`, `last`, `parent`,
`children`, `remove`, `before`, `after`, `append`, `prepend`, `html`,
`empty`, `attr`, `text`, `on`, `off`, `addClass`, `removeClass`,
`toggleClass`, `hasClass`, and `toArray`.

## Build

```bash
npm install
npm run build
```

This creates:

* `dist/ity.js`
* `dist/ity.min.js`
* `dist/ity.esm.js`
* `dist/ity.esm.mjs`
* `dist/ity.cjs.js`
* `dist/ity.d.ts`
* Source maps

## Test

```bash
npm test
npm run test:dist
npm run coverage
```

The suite covers the V2 reactive runtime, DOM templating, components, router,
platform fallbacks, and V1 compatibility.

Continuous integration runs coverage, distributable build verification,
dist-bundle tests, and `npm pack --dry-run` on Node 20 and Node 22.

## Migration

See [MIGRATION.md](./MIGRATION.md) for the full V1-to-V2 and 2.2.0 migration
guide.

## Browser Support

Ity 2 is built on standard browser APIs:

* Custom Elements and Shadow DOM for components.
* `URLPattern` when available, with an internal fallback.
* `document.startViewTransition()` when available, with normal rendering as the
  fallback.
* No dependency on the HTML Sanitizer API because it is not universally
  available. Ity keeps dynamic template values safe by using text nodes unless
  `unsafeHTML` is explicitly requested.

## License

The MIT License (MIT)

Copyright (c) 2026 Dominic Cocchiarella

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
