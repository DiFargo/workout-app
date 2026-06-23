# Architecture Notes

This project is a production React + Firebase fitness application. The current goal of the refactor is not to split files for the sake of splitting, but to keep the application easy to change without white screens or duplicated UI systems.

## Current Shape

- `src/App.jsx` is only the thin app wrapper: `AppErrorBoundary` + `AppCore`.
- `src/main.jsx` is only the runtime entrypoint: React root, `src/styles/index.css`, service worker registration.
- `src/AppCore.jsx` is the coordinator. It may hold global state, assemble route context, and choose large app routes.
- `src/app` owns app-level routing, navigation contracts and bootstrap/runtime hooks.
- `src/features/client` owns client-facing feature UI and handlers.
- `src/features/trainer` owns trainer-facing feature UI and handlers.
- `src/components` owns reusable UI shells and legacy component surfaces.
- `src/shared/hooks` and `src/shared/ui` own truly shared React pieces.
- Do not add new shared hooks under `src/hooks`; keep them in `src/shared/hooks`.
- `src/domain` and `src/utils` are pure logic modules. They must not import React, components or feature layers.
- `src/styles/index.css` is the only application CSS entrypoint.

## Layer Rules

- Do not put feature logic back into `App.jsx` or `main.jsx`.
- Do not import `src/features` from production components. The only current exception is the client E2E harness.
- Do not let `features/client` and `features/trainer` import each other directly.
- Feature layers may import from `src/app` only through navigation contracts: `appPages` and `appNavigation`.
- Do not import CSS directly from components. CSS should be reachable from `src/styles/index.css`.
- Do not leave unused JS/JSX source files in `src`. Source modules must stay reachable from `src/main.jsx`.
- Do not introduce JS/JSX import cycles.
- Do not move Firebase/security behavior unless the task explicitly requires it.
- Keep `AppCore.jsx` as a coordinator. A large file is acceptable if it is readable and route/context oriented.

## Verification

Fast local verification:

```powershell
npm.cmd run verify
```

This runs:

- production build
- main JS bundle budget check
- unit tests
- critical lint

Browser smoke tests:

```powershell
npm.cmd run test:e2e
```

Firestore rules tests:

```powershell
npm.cmd run test:rules
```

`test:rules` uses `firebase-tools` through `npx`, so it may need network access or a warm local npm cache.

## Structural Guards

The main architecture guards live in:

- `tests/app-structure.test.mjs`
- `tests/appcore-props-scope.test.mjs`
- `scripts/check-build-budget.mjs`

They protect:

- thin app entrypoints
- modular CSS entrypoint and import graph
- source module reachability and import graph cycles
- shared hooks location
- AppCore coordinator boundaries
- client/trainer feature separation
- pure `domain` and `utils` layers
- route prop/dependency initialization order
- main app JS chunk size after `vite build`

When changing the structure, update these tests intentionally instead of working around them.

## Bundle Budget

`npm.cmd run verify` runs `scripts/check-build-budget.mjs` immediately after the production build.

Current limits:

- main `dist/assets/index-*.js` raw size: `600 KiB`
- main `dist/assets/index-*.js` gzip size: `170 KiB`
- main `dist/assets/index-*.css` raw size: `2100 KiB`
- main `dist/assets/index-*.css` gzip size: `270 KiB`

These limits intentionally track the initial app JavaScript and CSS chunks only. Route chunks can grow independently when they belong to lazy-loaded screens.
