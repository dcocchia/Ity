# Operations Workbench Library Friction

This started as a running build log of rough edges that showed up while creating the deep V2 example. The original list below has now been addressed in Ity 2.2.0, and the notes are retained as a release checklist plus a record of what changed.

## Fixed In 2.2.0

* Browser examples now have a first-class runner via `npm run examples:serve`, plus an [Examples/index.html](../index.html) launcher.
* Router base-path authoring no longer needs manual `href` joining. `router.href(path)` and `router.link(path)` cover that directly.
* Sanitization policy no longer has to be process-global. `createConfig()` enables per-app and per-render HTML policy.
* Complex forms no longer have to be entirely application code. `formState()` now covers field binding, normalization, dirty/touched state, validation, reset, and validated submits.
* Components now accept structured props through `props` and `ctx.prop(name)`.
* Shadow DOM links can use `router.link(path)` directly instead of relying on document-level interception alone.
* Direct DOM event wiring no longer needs manual promise swallowing in app code. `action.run()`, `action.with()`, `action.from()`, and `form.handleSubmit()` cover that case.
* Form submits now synchronize current control values before validation, which closed the last major drift case exposed by the workbench.

## Residual Notes

* Large screens still rely on application discipline around state partitioning and render ownership. The single top-level `render()` approach works, but Ity does not try to add keyed reconciliation or component-local diffing.
* Rich form workflows are much better with `formState()`, but schema-driven forms, async field validation, and nested field-array helpers are still intentionally out of scope for the core.
