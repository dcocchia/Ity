# Ity

A tiny dependency-free reactive app kernel for small browser apps, embeddable
widgets, progressive SPAs, and local-first browser applications.

Ity 3 keeps the original Ity goal: do useful client-side app work without a
framework stack, runtime dependencies, or a large bundle. The core stays
platform-native and explicit: signals, computed values, effects, tagged HTML
templates, DOM rendering, Web Components, and a modern router. V3 adds a small
set of app-scale primitives and optional companion modules without trying to
recreate React inside the core.

## Why Ity 3?

* Tiny runtime, no production dependencies in the core or companion modules.
* Fine-grained reactive state with `signal`, `computed`, `effect`, and `store`.
* Async UI primitives with `resource`, `action`, `form`, and `formState`.
* Safe-by-default DOM templates: dynamic values become text unless explicitly
  marked with `unsafeHTML`.
* Native Web Component support via `component()`.
* SPA routing with URLPattern support when available and a regex fallback when
  it is not.
* Keyed structural rendering with `repeat()`.
* Static and hydration-friendly output through `renderToString()` and
  `hydrate()`.
* Scoped dependency flow through `createScope()`, `ctx.provide()`, and
  `ctx.inject()`.
* Runtime observability through `observeRuntime()`.
* Optional View Transition integration for same-document route/render updates.
* Optional app-scale companion modules: `ity/query`, `ity/forms`, and
  `ity/react`.
* V1-compatible `Model`, `Collection`, `View`, `Application`, and
  `SelectorObject`.

## What's New In 3.0.0

Ity 3.0.0 expands the kernel without changing its native-first design:

* `repeat(items, key, render)` for keyed structural list rendering.
* `hydrate()` plus morph-based `render()` updates for progressive enhancement
  and SSR-style flows.
* `createScope()` and scope-aware components and routers.
* `observeRuntime()` for signals, resources, actions, and router activity.
* `Router.resource()` and `Router.action()` for route-scoped async work.
* Companion modules:
  * `ity/query` for cache-backed async queries and optimistic mutations.
  * `ity/forms` for nested form state, field arrays, explicit `form.sync()`,
    and richer submit controllers.
  * `ity/react` for wrapping Ity custom elements inside React trees.
* The deep
  [Examples/OperationsWorkbench/index.html](Examples/OperationsWorkbench/index.html)
  example now uses the v3 kernel and companion modules together.

## What's New In 3.0.2

Ity 3.0.2 is a performance-focused patch release with no intended API breaks:

* Core template rendering now caches compiled binding plans across reactive
  rerenders, which reduces repeated fragment scanning and binding lookup work.
* `resource()`, `action()`, and `ity/query` batch their internal state writes
  more aggressively, and query-level `gcTime` overrides now apply correctly.
* `formState()` and `ity/forms` reuse field handles, avoid stringify-based deep
  equality checks, and clone only the nested paths that actually changed.
* The Operations Workbench example no longer reloads the workspace when opening
  task detail routes and now reuses unchanged task identities and task-card
  action handlers to reduce list churn during mutations.
* `npm run perf:bench` now runs a jsdom benchmark harness against both focused
  kernel scenarios and the Operations Workbench example.

## Installation

```bash
npm install ity
```

```ts
import Ity, { signal, computed, html, render } from "ity";
import { createQueryClient, query } from "ity/query";
import { createFormKit } from "ity/forms";
```

The package ships ESM, CommonJS, browser IIFE, minified IIFE, source maps, and
TypeScript declarations.

`ity`, `ity/query`, and `ity/forms` have no runtime package dependencies.
`ity/react` is optional and expects `react` to already exist in the consuming
application.

## Examples

The repository includes small focused demos plus a deeper production-style app:

* [Examples/index.html](Examples/index.html)
* [Examples/Calculator/index.html](Examples/Calculator/index.html)
* [Examples/Collection/index.html](Examples/Collection/index.html)
* [Examples/Router/index.html](Examples/Router/index.html)
* [Examples/OperationsWorkbench/index.html](Examples/OperationsWorkbench/index.html): a local-first operations application that exercises `repeat`, scopes, runtime observation, `ity/query`, `ity/forms`, router resources/actions, `component()`, `unsafeHTML()`, and `renderToString()` together.

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

## V3 Bridges

### `repeat`

Use `repeat()` when list items need keyed identity:

```ts
const tasks = Ity.signal([
  { id: "a", title: "Draft launch brief" },
  { id: "b", title: "Ship release notes" }
]);

Ity.render(() => Ity.html`
  <ul>
    ${Ity.repeat(tasks(), (task) => task.id, (task) => Ity.html`
      <li>${task.title}</li>
    `)}
  </ul>
`, "#app");
```

### `hydrate`

`hydrate()` attaches bindings to existing markup instead of replacing it:

```ts
Ity.hydrate(() => Ity.html`
  <button @click=${() => console.log("ready")}>Hydrated</button>
`, "#app");
```

### `createScope` and `observeRuntime`

Scopes let components and routers share services without a framework-wide
context object. Runtime observation gives a lightweight event stream for
debugging and tooling.

```ts
const scope = Ity.createScope({ name: "app" });
scope.provide("apiBase", "/api");

const stop = Ity.observeRuntime((event) => {
  console.log(event.type, event.name);
});
```

### `ity/query`

Use `ity/query` when async data should be cached and invalidated:

```ts
import { createQueryClient, query, mutation } from "ity/query";

const client = createQueryClient();
const user = query(client, ["user", "42"], async () => {
  const response = await fetch("/api/users/42");
  return response.json();
});

const saveUser = mutation(client, async (payload) => {
  const response = await fetch("/api/users/42", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return response.json();
}, {
  invalidate: [["user", "42"]]
});
```

### `ity/forms`

`ity/forms` is the richer companion to core `formState()`. Use it when the form
needs nested paths, field arrays, or explicit syncing before structural
mutations:

```ts
import { createFormKit } from "ity/forms";

const draft = createFormKit({
  title: "",
  checklist: [{ label: "" }]
});

const checklist = draft.array("checklist");
```

### `ity/react`

Use `ity/react` when Ity custom elements need to live inside a React tree:

```ts
import { wrapCustomElement } from "ity/react";

const UserCard = wrapCustomElement("user-card", {
  events: {
    onChoose: "choose"
  }
});
```

`ity/react` is a bridge, not part of the dependency-free core. Consumers using
that entrypoint should already have `react` installed.

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

The repo targets Node 20+ and includes an `.nvmrc` pinned to the preferred
local runtime. Running `nvm use` before build or release keeps local tooling in
line with CI and avoids engine warnings.

```bash
nvm use
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
npm run perf:bench
npm run release:npm
```

The suite covers the v3 reactive runtime, companion modules, DOM templating,
components, router, platform fallbacks, workbench performance regressions, and
V1 compatibility.

Continuous integration runs coverage, distributable build verification,
dist-bundle tests, and `npm pack --dry-run` on Node 20 and Node 22.

## Migration

See [MIGRATION.md](./MIGRATION.md) for the full V1-to-v3 migration guide.

## Browser Support

Ity 3 is built on standard browser APIs:

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
