# Operations Workbench

`Operations Workbench` is a full local-first Ity 3.0 example. It is
intentionally larger than the other demos and exercises the v3 surface as an
integrated application instead of isolated snippets.

## What It Shows

* `ity/query` for cached workspace loading and mutation wiring.
* `ity/forms` for nested task drafting, checklist field arrays, and explicit
  `form.sync()` before structural edits.
* `Router.resource()` and `Router.action()` patterns through route-driven task
  screens and mutations.
* `store()` for view state and persisted UI preferences.
* `Router` base-path handling plus `router.link()` across dashboard, task,
  notes, reports, and settings pages.
* `repeat()` for keyed task, note, checklist, and runtime-feed rendering.
* `createScope()` for router and repository injection into custom elements.
* `observeRuntime()` for the in-app kernel activity feed.
* `component()` props for reusable metric, task-card, and relative-time custom elements.
* `unsafeHTML()` plus `createConfig({ sanitizeHTML })` for bulletin and report preview rendering.
* `renderToString()` for a shareable status report view.

## Run It Locally

1. Install dependencies: `npm install`
2. Start the example server: `npm run examples:serve`
3. Open [../index.html](../index.html) or [index.html](./index.html)

The app persists its workspace to `localStorage` under `ity-operations-workbench`. Use the Settings page to reset or import data.

## Test It

Run the example coverage with the normal test suite:

```bash
npm test -- --runInBand
```

The dedicated example test file is [../../test/operationsWorkbenchExample.test.ts](../../test/operationsWorkbenchExample.test.ts).

## Files

* App source: [operationsWorkbenchApp.ts](./operationsWorkbenchApp.ts)
* Local runner: [index.html](./index.html)
* Library friction notes: [LIBRARY_FRICTION.md](./LIBRARY_FRICTION.md)
