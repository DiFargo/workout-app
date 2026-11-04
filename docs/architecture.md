# Architecture Notes

This project is a production React + Firebase fitness application. The current goal of the refactor is not to split files for the sake of splitting, but to keep the application easy to change without white screens or duplicated UI systems.

## Current Shape

- `src/App.jsx` is only the thin app wrapper: `AppErrorBoundary` + `AppCore`.
- `src/main.jsx` owns the runtime entrypoint: Telegram instance/bootstrap setup, awaited style loading, the dynamic App import, React root and service worker registration.
- `src/AppCore.jsx` is the coordinator. It may hold global state, assemble route context, and choose large app routes.
- `src/app` owns app-level routing, navigation contracts and bootstrap/runtime hooks.
- `src/features/client` owns client-facing feature UI and handlers.
- `src/features/trainer` owns trainer-facing feature UI and handlers.
- `src/components` owns reusable UI shells and legacy component surfaces.
- `src/shared/hooks` and `src/shared/ui` own truly shared React pieces.
- Do not add new shared hooks under `src/hooks`; keep them in `src/shared/hooks`.
- `src/domain` and `src/utils` are pure logic modules. They must not import React, components or feature layers.
- `src/styles/index.css` is the core application CSS entrypoint. Heavy route stacks may be lazy-loaded from the approved route/style entrypoints guarded by `tests/app-structure.test.mjs`.

## Layer Rules

- Do not put feature logic back into `App.jsx` or `main.jsx`.
- Do not import `src/features` from production components. The only current exception is the client E2E harness.
- Do not let `features/client` and `features/trainer` import each other directly.
- Feature layers may import from `src/app` only through navigation contracts: `appPages` and `appNavigation`.
- Do not import CSS directly from arbitrary components. CSS should be reachable from `src/styles/index.css` or from an approved lazy CSS entrypoint guarded by `tests/app-structure.test.mjs`.
- Do not leave unused JS/JSX source files in `src`. Source modules must stay reachable from `src/main.jsx`.
- Do not introduce JS/JSX import cycles.
- Do not move Firebase/security behavior unless the task explicitly requires it.
- Keep `AppCore.jsx` as a coordinator. A large file is acceptable if it is readable and route/context oriented.

## Verification

Fast local verification:

```powershell
npm.cmd run verify
```

`verify` selects the lightweight `release` profile in `scripts/verify.mjs`. With no extra options it runs only:

- production build
- static-entry, mandatory-boot and Firebase-core artifact budgets
- `git diff --check`

It does **not** run lint, unit tests, Rules tests, Functions syntax checks,
dependency audits or browser tests. A green lightweight check is not production
sign-off. For implementation, select the smallest relevant profile and focused
tests; for production sign-off use:

```powershell
npm.cmd run verify:full
```

`verify:full` runs full ESLint, unit tests, Firestore/Storage Rules emulator
tests, all declared Functions codebases' syntax checks, isolated staging and
fresh production builds, artifact budgets, root/Functions dependency audits,
diff whitespace checks and the configured Playwright suite.
`verify:core` runs that full profile without the complete Playwright suite;
React DOM unit tests still need Chromium. Neither command substitutes for
approved staging/production smoke results. See the authoritative
[release checklist](release-operations.md#release-procedure).

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
- modular CSS entrypoints and import graph
- source module reachability and import graph cycles
- shared hooks location
- AppCore coordinator boundaries
- client/trainer feature separation
- pure `domain` and `utils` layers
- route prop/dependency initialization order
- deployable harness exclusion and bounded static-entry/mandatory-boot graphs after `vite build`

When changing the structure, update these tests intentionally instead of working around them.

## Bundle Budget

`npm.cmd run verify` runs `scripts/check-build-budget.mjs` immediately after the production build.

Current gzip limits (each emitted file compressed separately with Node zlib):

- static entry closure, including its CSS and React: `100 KiB`;
- mandatory normal boot path: `640 KiB`;
- Firebase core, excluding optional App Check and Storage: `170 KiB`.

The mandatory boot union includes the entry and `src/App.jsx`,
their recursive **static** imports and emitted CSS. As of 3.0.852, trainer V2
styles load with trainer routes instead of blocking every login. Assets shared between roots
are counted once. Roots are selected by manifest source identity, not hashed
chunk names; a missing, ambiguous or disconnected root fails closed. Optional
route dynamic imports and App Check are not automatically included.

The [3.0.849 artifact baseline](../artifacts/comprehensive-audit-2026-10-18/boot-metrics.json)
was `569.42 KiB` for the deduplicated mandatory union, versus `71.34 KiB` for
the static entry alone. The `640 KiB` bound permits limited remediation growth,
not indefinite baseline inflation. Increasing App/static-dependency/CSS bytes
must fail this bound even after chunk renaming; an unused lazy admin route must
not inflate the normal boot subtotal. Tests live in
`tests/remediation-architecture.test.mjs` and `tests/production-bundle-boundaries.test.mjs`.

These are artifact-byte regression guards, not HTTP transfer measurements,
first-interactive timing or Core Web Vitals. The baseline has no cold network
waterfall; record one before changing startup sequencing or deferring mandatory
styles. No such runtime optimization is implied by this budget correction.

## Visual token ownership

The approved product palette remains [AGENTS.md](../AGENTS.md#ui-design-system):
canvas `#F2F2F7`, text `#1C1C1E`, accent `#3C6FAA`, success `#237A42`.
On 2026-10-30 the user explicitly reaffirmed the green-to-blue fill for primary
actions: `--ownset-action-gradient` in `src/styles/_variables.css` is canonical.
Use it for filled client, trainer, admin, auth and modal primary buttons, including
pressed/loading states. Text, chart, border and semantic colour tokens remain
colours. The OwnSet preview's historical layout does not replace current geometry.

The existing runtime cascade is not a second approved palette. `main.jsx` sets
`data-app-theme="warm-light"`; AppCore loads base `_variables.css`, Foundation,
Theme/Surface/Layout and client flow/visual modules, then
`AppCoreClientAppleTheme.css`. AppBootstrap also imports
`AppCoreClientIosTheme.module.css` and marks the root with its contract class.
The Apple/iOS files' `html:root[data-app-theme="warm-light"]` token selectors
override lower-specificity base aliases; equal-specificity declarations still
depend on emitted source order, and component-specific rules can override them.
Inspect computed styles on the actual shell rather than assuming one file
always wins every property.

Today those active overrides contain canvas `#f5f7f8`, text `#1c282e` and action
`#396ba6`; base aliases still contain older green values. This documented
implementation drift is not permission to restore purple, dark cards or a
different historical theme. The primary-action gradient is the explicit
user-approved exception above. Keep layout ownership in colocated CSS Modules
and preserve the current light surfaces; verify computed styles route by route.
