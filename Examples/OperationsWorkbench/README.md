# Operations Workbench

`Operations Workbench` is a full local-first Ity 2.2 example. It is intentionally larger than the other demos and exercises the V2 surface as an integrated application instead of isolated snippets.

## What It Shows

* `resource()` for cancellable async workspace loading from local storage.
* `action()` for task status changes, checklist toggles, deletes, and resets.
* `formState()` for task, note, settings, and import flows.
* `store()` for view state and persisted UI preferences.
* `Router` base-path handling plus `router.link()` across dashboard, task, notes, reports, and settings pages.
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
