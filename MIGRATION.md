# Ity Migration Guide

This guide covers upgrading older Ity applications to Ity 4.0.0.

Ity 3 keeps the original goal of a tiny dependency-free browser app library,
but the primary programming model is now reactive and platform-native. The V1
MVC classes still ship for compatibility, so migration can be incremental
instead of a rewrite. V3 adds keyed rendering, hydration-friendly updates,
scopes, runtime observation, and optional companion modules for queries, richer
forms, and React interop.

## Install

```bash
npm install ity@^4.0.0
```

```ts
import Ity, { signal, html, render } from "ity";
```

Browser builds remain available through `dist/ity.js` and `dist/ity.min.js`.
Companion modules are published as `ity/query`, `ity/forms`, and `ity/react`.
The first two remain runtime-dependency-free; `ity/react` expects `react` in
the consuming application.

## What Changed In 2.x

- Reactive primitives are now first-class: `signal`, `computed`, `effect`, `batch`, `untrack`, and `store`.
- DOM rendering is template-based through `html`, `render`, and `renderToString`.
- Dynamic template values are text-safe by default. HTML string parsing must be explicit through `unsafeHTML`.
- Components are native custom elements through `component()`.
- Routing is handled by `Router` and `route()`, with base-path support, route cleanup, same-origin link interception, and URLPattern fallback.
- Async UI state can use `resource`, `action`, `form`, and `formState`.
- App-scale flows can opt into `repeat`, `hydrate`, `createScope`,
  `observeRuntime`, `Router.resource`, `Router.action`, `ity/query`,
  `ity/forms`, and `ity/react`.
- V1 `Application`, `Model`, `Collection`, `View`, and `SelectorObject` remain available.

## V1 MVC To V2 Reactivity

Existing MVC code still works:

```ts
const model = new Ity.Model({ data: { count: 0 } });

const view = new Ity.View({
  el: "#app",
  model,
  initialize() {
    this.model.on("change", this.render, this);
  },
  render() {
    this.select(".count").text(this.model.get("count"));
  }
});
```

New code should prefer signals and templates:

```ts
const count = Ity.signal(0);

Ity.render(() => Ity.html`
  <button @click=${() => count.update((n) => n + 1)}>
    Count: ${count}
  </button>
`, "#app");
```

You can bridge old and new code because models and collections expose reactive `state` signals:

```ts
const model = new Ity.Model({ data: { name: "Ada" } });

Ity.render(() => Ity.html`
  <p>${model.state().name}</p>
`, "#app");
```

## State Migration

Use `signal` for scalar state:

```ts
const selectedId = Ity.signal<string | null>(null);
selectedId.set("42");
```

Use `store` for object state:

```ts
const state = Ity.store({ user: "Ada" });

state.user = "Grace";
state.role = "admin";
delete state.user;

const snapshot = state.$snapshot();
```

In 2.1+, `store` tracks structural changes. Effects and subscribers that read snapshots are notified when keys are added or deleted, not just when existing values change.

## New In 4.0

### Security hardening and explicit HTML sinks

Ity 4 tightens the default rendering contract:

- Template bindings now block inline handler attributes such as `onclick=${"..."}`
  and strip unsafe URL schemes from URL-bearing attrs and properties.
- HTML sinks such as `srcdoc`, `.innerHTML`, and `.outerHTML` require
  `unsafeHTML(...)` when you intentionally want trusted markup to be parsed.
- `SelectorObject` string insertion is now text-by-default. Legacy code that
  relied on `append("<div>...")` parsing HTML must switch to
  `append(Ity.unsafeHTML("<div>..."))`.

Examples:

```ts
Ity.html`<iframe srcdoc=${Ity.unsafeHTML(trustedMarkup)}></iframe>`;

view.select(".panel").html(Ity.unsafeHTML("<strong>Trusted</strong>"));
```

If your app already sanitizes user-generated rich text, keep doing that and
pass the sanitized output through `unsafeHTML(...)` at the final render
boundary.

## New In 3.0

### Keyed rendering and hydration

Use `repeat()` when DOM identity matters, and `hydrate()` when the page already
contains markup that should be activated instead of replaced:

```ts
Ity.render(() => Ity.html`
  <ul>
    ${Ity.repeat(tasks(), (task) => task.id, (task) => Ity.html`<li>${task.title}</li>`)}
  </ul>
`, "#app");

Ity.hydrate(() => Ity.html`
  <button @click=${handleClick}>Hydrated</button>
`, "#app");
```

### Scopes and runtime observation

Scopes are the v3 answer to lightweight dependency flow:

```ts
const scope = Ity.createScope({ name: "app" });
scope.provide("apiBase", "/api");
```

Use `observeRuntime()` to watch runtime activity while building tooling or
debugging larger screens:

```ts
const stop = Ity.observeRuntime((event) => {
  console.log(event.type, event.name);
});
```

### Companion modules

The core stays small. Larger app needs now live behind optional subpath imports:

```ts
import { createQueryClient, query, mutation } from "ity/query";
import { createFormKit } from "ity/forms";
import { wrapCustomElement } from "ity/react";
```

## Template Safety

V1 code often built HTML strings manually:

```ts
view.select(".user").html(`<strong>${name}</strong>`);
```

In V2, dynamic values are escaped unless you explicitly opt into HTML parsing:

```ts
Ity.html`<strong>${name}</strong>`;
```

Trusted HTML can still be rendered:

```ts
Ity.html`<article>${Ity.unsafeHTML(trustedHtml)}</article>`;
```

If your app accepts rich text from users, configure a sanitizer at the trust boundary:

```ts
const htmlPolicy = Ity.createConfig({
  sanitizeHTML(value) {
    return DOMPurify.sanitize(value);
  }
});

Ity.render(view, "#app", { config: htmlPolicy });
```

Per-call sanitizers override any scoped or global sanitizer:

```ts
Ity.unsafeHTML(value, { sanitize: customSanitize });
```

`Ity.configure({ sanitizeHTML })` still exists for process-wide setup, but
`createConfig()` is the better fit for multi-app pages, tests, and SSR.

Ity does not bundle a sanitizer because sanitizer policy is application-specific and many projects already standardize on one.

## Async Data

Use `resource` for loadable data:

```ts
const user = Ity.resource(async ({ signal }) => {
  const response = await fetch("/api/user", { signal });
  if (!response.ok) throw new Error("Failed to load user");
  return response.json();
});

Ity.render(() => Ity.html`
  ${user.loading() && "Loading..."}
  ${user.error() && Ity.html`<p role="alert">${user.error().message}</p>`}
  ${user.data() && Ity.html`<h1>${user.data().name}</h1>`}
`, "#app");
```

`refresh()` resolves with the latest available data even when the loader fails.
Use the `error` signal or `onError` callback for failures.

Use `action` for mutations:

```ts
const save = Ity.action(async (payload: { name: string }) => {
  const response = await fetch("/api/user", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Save failed");
  return response.json();
});

await save({ name: "Ada" });
```

Use `form` for progressive form handlers:

```ts
const signup = Ity.form(async (data) => {
  return fetch("/signup", {
    method: "POST",
    body: data
  });
}, { resetOnSuccess: true });

Ity.render(() => Ity.html`
  <form @submit=${signup.onSubmit}>
    <input name="email" type="email" required>
    <button ?disabled=${signup.pending()}>Join</button>
  </form>
`, "#app");
```

Use `formState` when the form needs field binding, validation, dirty tracking,
or named draft state:

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

const save = draft.submit(async (values) => {
  return fetch("/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(values)
  });
});

Ity.render(() => Ity.html`
  <form @submit=${save.handleSubmit}>
    <input bind=${draft.bind("title", { name: "taskTitle" })}>
    <select bind=${draft.bind("ownerId", { type: "select" })}></select>
  </form>
`, "#app");
```

`action.run()`, `action.with()`, `action.from()`, and `form.handleSubmit()`
remain the preferred direct DOM wiring helpers in 3.0.0.

## Router Migration

V2+ routing uses explicit route registration:

```ts
const router = new Ity.Router({ base: "/app" });

router.add("/users/:id", (params, ctx) => {
  const stop = Ity.render(() => Ity.html`
    <user-page user-id=${params.id}></user-page>
  `, "#app");

  return stop;
});
```

Route handlers may return a cleanup function. The cleanup runs before the next route, when the active route is removed, and when the router stops.

Links can now opt into router-managed navigation with `router.link()`:

```ts
Ity.html`<a bind=${router.link("/users/42")}>User 42</a>`;
```

Plain same-origin anchors inside the router base path are still intercepted at
the document level. `router.link()` is the better fit for templates, base-path
authoring, and shadow DOM.

## Components

Use `component()` for encapsulated UI:

```ts
Ity.component("user-card", {
  attrs: ["name"],
  shadow: true,
  setup(ctx) {
    const name = ctx.attr("name");

    ctx.effect((onCleanup) => {
      const controller = new AbortController();
      onCleanup(() => controller.abort());
    });

    return () => Ity.html`<h2>${name}</h2>`;
  }
});
```

Component render effects and `ctx.effect()` handlers are disposed when the element disconnects and restarted when it reconnects. This prevents stale subscriptions while preserving component state.

In 3.0.0, components can also declare structured props and consume scoped
services:

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

## Packaging Notes

Ity 3.0.0 publishes:

- ESM: `dist/ity.esm.mjs` and `dist/ity.esm.js`.
- CommonJS: `dist/ity.cjs.js`.
- Browser IIFE: `dist/ity.js`.
- Minified browser IIFE: `dist/ity.min.js`.
- Types: `dist/ity.d.ts`.
- Companion modules:
  - `ity/query`
  - `ity/forms`
  - `ity/react`

The package `exports` map supports ESM, CommonJS, browser-aware bundlers, and `ity/browser` for direct browser bundle consumers.

## Recommended Upgrade Path

1. Upgrade to Ity 3.0.0 and run the existing test suite without changing application code.
2. Replace manual HTML string rendering with `html` templates at active maintenance boundaries.
3. Introduce signals for new state and bridge old models through their `state` signals.
4. Move async screens to `resource`, submit handlers to `action`, and complex forms to `formState`.
5. Convert route links to `router.link()` where base paths or shadow DOM are involved.
6. Convert route entry points to return cleanup functions, especially if they mount renders, subscribe to signals, or start network work.
7. Adopt `repeat()`, `createScope()`, `ity/query`, or `ity/forms` only where the app genuinely needs them. The core APIs remain valid.
