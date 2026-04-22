# Operations Workbench Library Friction

This started as a running build log of rough edges that showed up while creating
the deep example application. The original v2 list has now been addressed
through Ity 3.0.0, and the notes remain as a release checklist plus a record of
what changed.

## Fixed In 3.0.0

* Browser examples now have a first-class runner via `npm run examples:serve`, plus an [Examples/index.html](../index.html) launcher.
* Router base-path authoring no longer needs manual `href` joining. `router.href(path)` and `router.link(path)` cover that directly.
* Sanitization policy no longer has to be process-global. `createConfig()` enables per-app and per-render HTML policy.
* Complex forms no longer have to be entirely application code. `formState()` now covers field binding, normalization, dirty/touched state, validation, reset, and validated submits.
* Components now accept structured props through `props` and `ctx.prop(name)`.
* Shadow DOM links can use `router.link(path)` directly instead of relying on document-level interception alone.
* Direct DOM event wiring no longer needs manual promise swallowing in app code. `action.run()`, `action.with()`, `action.from()`, and `form.handleSubmit()` cover that case.
* Form submits now synchronize current control values before validation, which closed the last major drift case exposed by the workbench.
* Large list rendering no longer depends on whole-subtree replacement. `repeat()` provides keyed structural rendering.
* Router-driven async work no longer has to be handwritten on top of generic signals. `Router.resource()` and `Router.action()` cover that path directly.
* Complex nested forms and structural field-array edits no longer require one-off app code. `ity/forms` adds nested paths, field arrays, and explicit `form.sync()`.
* App-scale async caching and optimistic invalidation no longer require custom repository glue. `ity/query` covers that layer.
* The runtime can now be observed directly with `observeRuntime()`, which made the workbench activity feed possible without private instrumentation.
* The companion modules now share the same core runtime instance in built output and dist tests, which closed a subtle split-runtime integration bug.

## Residual Notes

* Large screens still rely on application discipline around state partitioning and render ownership. Ity now has better keyed structure and scopes, but it still does not try to become a virtual-DOM framework.
* `ity/forms` is a much better answer for rich forms than raw core state, but schema-driven forms and deep validation ecosystems remain intentionally outside the core package.
* `ity/query` is intentionally smaller than a full data framework. It covers cache, invalidation, optimistic mutation, and dedupe, but not a full server-state platform.
