# CSS Cleanup Baseline

Goal: reduce CSS risk and weight route by route, never by blind deletion.

Current verified budget:

- Main JS budget: `600 KiB` raw, `170 KiB` gzip.
- Main CSS budget: `2100 KiB` raw, `270 KiB` gzip.
- Latest main CSS bundle: about `1530.03 KiB` raw, `156.78 KiB` gzip.
- Latest source CSS report: `93` files, about `3506.44 KiB` total source CSS.

## Screenshot Coverage

Covered by Playwright visual audits:

- Client main dashboard: `tests/e2e/client-primary-visual.spec.js`
- Client cabinet, cabinet workout history modal, measurements modal, nutrition modal, workout calendar modal and progress photos modal: `tests/e2e/client-primary-visual.spec.js`
- Client nutrition main, food search, food results, product amount screen, product edit sheet, My Database, calendar, diary and analysis modal: `tests/e2e/client-nutrition-visual.spec.js`
- Client workout cards, swipe, workout mode modal, workout history modal and empty assigned plan state: `tests/e2e/client-workout-visual.spec.js`
- Trainer dashboard, clients, client card, messages and programs: `tests/e2e/trainer-visual.spec.js`
- Admin panel hub, denied state, admin users CRM harness and admin programs overview harness: `tests/e2e/admin-visual.spec.js`

Not covered deeply yet:

- Live production-only auth and Firestore permission edge cases.

## Largest CSS Files From Latest Report

Start mapping here before any cleanup:

- `src/styles/client-primary-final-lock.css` - `266.70 KiB`
- `src/components/trainer/trainer-workspace.css` - `179.26 KiB`
- `src/styles/client-nutrition-grid-lock.css` - `170.85 KiB`
- `src/styles/client-render-target-lock.css` - `116.67 KiB`
- `src/styles/legacy-food-editor-tail.css` - `100.56 KiB`
- `src/styles/legacy-admin-client-dashboard-polish.css` - `97.12 KiB`
- `src/styles/legacy-desktop-cabinet-polish.css` - `93.22 KiB`
- `src/styles/legacy-client-workout-flow-late.css` - `87.59 KiB`
- `src/styles/client-visual-unity-final.css` - `80.04 KiB`
- `src/styles/legacy-profile-dashboard-telegram-late.css` - `83.78 KiB`

## Cleanup Order

1. Client primary screens.
   - Reason: main and cabinet now have direct screenshot coverage.
   - Candidate files: `client-primary-final-lock.css`, `client-render-target-lock.css`, `client-visual-unity-final.css`, `legacy-desktop-cabinet-polish.css`.
   - Started in `v.1.282`: removed one-line core aliases `themes.css` and `client-main.css`; `index.css` now imports `theme.css` and `auth.css` directly.
   - Continued in `v.1.283`: removed core aggregators `layout.css` and `components.css`; `index.css` now imports their base component CSS directly.
   - Expanded in `v.1.288`: visual coverage now includes the cabinet workout history modal and its compact delete action.
   - Expanded in `v.1.289`: visual coverage now includes the cabinet measurements modal and its close/start actions.
   - Expanded in `v.1.290`: visual coverage now includes the cabinet nutrition modal, its goal picker, week navigation and save action.
   - Expanded in `v.1.291`: visual coverage now includes the cabinet workout calendar modal, history entry and edit controls.
   - Continued in `v.1.292`: removed four import-only legacy stack aggregator files by importing their child CSS directly from `index.css`.
   - Continued in `v.1.293`: removed remaining import-only light, nutrition and admin stack aggregators by importing their child CSS directly from the active entrypoints.
   - Expanded in `v.1.294`: visual coverage now includes the cabinet progress photos modal, upload steps and save action.
   - Expanded in `v.1.296`: visual coverage now includes cabinet settings, trainer notifications and Telegram management modals with close/action tap-target guards.

2. Client workouts.
   - Reason: workout cards and modals have visual coverage and fixed tap targets.
   - Candidate files: `client-workout-card-render.css`, `legacy-client-workout-flow-late.css`, workout-related blocks in broad legacy files.
   - Expanded in `v.1.286`: visual coverage now includes the empty assigned plan state before cleanup of workout empty-state CSS.
   - Continued in `v.1.287`: removed old global empty-state rules from legacy files; `client-workout-empty-state.css` is the scoped owner.

3. Client nutrition.
   - Reason: densest route, already covered by modal screenshots.
   - Candidate files: `client-nutrition-grid-lock.css`, `legacy-food-editor-tail.css`, `nutrition.css`, `legacy-nutrition-late-layout.css`.
   - Expanded in `v.1.284`: visual coverage now includes search results, product amount screen, product edit sheet and My Database.
   - Continued in `v.1.285`: removed an older duplicated product/edit action-bar block from `client-visual-unity-final.css`; later food search CSS owns those surfaces.
   - Fixed in `v.1.295`: nutrition week strip keeps readable weekday labels separated from day markers and is guarded by geometry checks in the nutrition visual audit.
   - Continued in `v.1.300`: food-search/product polish CSS moved from the core app entrypoint into `nutrition-stack.css`, under the existing nutrition visual audit.
   - Expanded in `v.1.301`: AI photo not-found modal has visual coverage and its CSS moved from core into `nutrition-stack.css`.
   - Expanded in `v.1.302`: nutrition create product/dish choice modal has visual coverage before broader food-flow CSS cleanup.
   - Expanded in `v.1.303`: custom dish editor, ingredient picker and ingredient confirmation have visual coverage before broader food-flow CSS cleanup.
   - Continued in `v.1.304`: broad nutrition flow CSS moved from the core app entrypoint into `nutrition-stack.css`, under expanded nutrition visual coverage.
   - Continued in `v.1.305`: nutrition orbit CSS moved from the core app entrypoint into `nutrition-stack.css`, under nutrition main visual coverage.
   - Fixed in `v.1.306`: nutrition weekday labels now use unambiguous two-letter labels and the visual audit guards marker sizes.
   - Continued in `v.1.307`: warm-light add-food/search cleanup CSS moved from the core app entrypoint into `nutrition-stack.css`, under nutrition visual coverage.

4. Trainer workspace.
   - Reason: dashboard, clients, messages and programs have coverage; the CSS is large but route-scoped.
   - Candidate file: `src/components/trainer/trainer-workspace.css`.
   - Started in `v.1.281`: removed the one-line `trainer.css` alias and imported `trainer-workspace.css` directly from `trainer-lazy.css`.

5. Admin hub and internals.
   - Reason: hub, users CRM and program overview surfaces have harness coverage.
   - Candidate files: `adminPanelHub.css`, admin CRM/program rules inside admin lazy stack.
   - Started in `v.1.280`: removed the one-line `admin.css` alias and imported `adminPanelHub.css` directly from `admin-lazy.css`.
   - Expanded in `v.1.297`: admin visual coverage now includes DEV-only users CRM and programs overview harness surfaces with tap-target and overflow checks.
   - Continued in `v.1.298`: admin internals CSS moved behind `admin-internals-lazy.css` so the production admin hub chunk stays lightweight.
   - Guarded in `v.1.299`: `tests/app-structure.test.mjs` now rejects heavy admin internals imports in the production admin hub CSS entrypoint.

## Guardrails

- Run `npm.cmd run report:css` before and after cleanup.
- Search class usage with `rg` before removing selectors.
- Prefer moving route-specific CSS into existing lazy entrypoints over deleting uncertain legacy blocks.
- After each route cleanup, run the matching targeted visual spec first.
- Before committing, run `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css`.
- Clean admin CRM internals only under the deeper admin harness and targeted admin visual audit.

## Completed Cleanup

- `v.1.280`: deleted `src/styles/admin.css`, which only re-exported `adminPanelHub.css`; `src/styles/admin-lazy.css` now imports `adminPanelHub.css` directly.
- Verification for `v.1.280`: `tests/app-structure.test.mjs`, `tests/e2e/admin-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.281`: deleted `src/styles/trainer.css`, which only re-exported `src/components/trainer/trainer-workspace.css`; `src/styles/trainer-lazy.css` now imports the trainer workspace CSS directly.
- Verification for `v.1.281`: `tests/app-structure.test.mjs`, `tests/e2e/trainer-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.282`: deleted `src/styles/themes.css` and `src/styles/client-main.css`, which only re-exported `theme.css` and `auth.css`; `src/styles/index.css` now imports those files directly.
- Verification for `v.1.282`: `tests/e2e/client-smoke.spec.js`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.283`: deleted `src/styles/layout.css` and `src/styles/components.css`, which only grouped base component imports; `src/styles/index.css` now imports their children directly.
- Verification for `v.1.283`: `tests/app-structure.test.mjs`, `tests/e2e/client-smoke.spec.js`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.284`: removed an obsolete product meal-button override from `client-visual-unity-final.css` after deeper nutrition visual coverage proved the later product CSS owns that state.
- Verification for `v.1.284`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.285`: removed the older duplicated product/edit action-bar block from `client-visual-unity-final.css`; `client-food-search-final.css` keeps the current product and edit-sheet action bar rules.
- Verification for `v.1.285`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.287`: removed duplicated global `.workoutProgramEmptyState` and `.workoutProgramEmptyIcon` rules from `legacy-history-ai-search-late.css` and `legacy-admin-program-editor-app49.css`; the scoped `client-workout-empty-state.css` now owns the client workout empty plan state.
- Verification for `v.1.287`: `tests/app-structure.test.mjs`, `tests/e2e/client-workout-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.289`: expanded the client primary visual audit to cover the cabinet measurements modal and fixed its close button to a stable 44px tap target.
- Verification for `v.1.289`: `tests/app-structure.test.mjs`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.290`: expanded the client primary visual audit to cover the cabinet nutrition modal, accepted string dates in AI nutrition schedule helpers and fixed modal nutrition controls to stable 44px tap targets.
- Verification for `v.1.290`: `tests/app-structure.test.mjs`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.291`: expanded the client primary visual audit to cover the cabinet workout calendar modal and fixed its close, month navigation, edit and save/cancel controls to stable 44px tap targets.
- Verification for `v.1.291`: `tests/app-structure.test.mjs`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.292`: deleted import-only aggregators `legacy-stack.css`, `legacy-stack-foundation.css`, `legacy-stack-workflows.css` and `legacy-stack-final-polish.css`; `index.css` now imports the same child CSS files directly in the same order.
- Verification for `v.1.292`: `tests/app-structure.test.mjs`, client primary/nutrition/workout visual specs and `npm.cmd run report:css` passed before full verification.
- `v.1.293`: deleted import-only aggregators `legacy-light-stack.css`, `legacy-nutrition-stack.css` and `legacy-admin-stack.css`; `index.css`, `nutrition-stack.css` and `trainer-lazy.css` now import the same child CSS files directly.
- Verification for `v.1.293`: `tests/app-structure.test.mjs`, client primary/nutrition, trainer and admin visual specs and `npm.cmd run report:css` passed before full verification.
- `v.1.294`: expanded the client primary visual audit to cover the cabinet progress photos modal, upload step labels and save action.
- Verification for `v.1.294`: `tests/app-structure.test.mjs`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.295`: fixed the nutrition week strip spacing so weekday labels no longer crowd the day markers on compact mobile headers.
- Verification for `v.1.295`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.296`: expanded the client primary visual audit to cover cabinet settings, trainer notifications and Telegram management modals, and fixed their compact close controls to stable 40px tap targets.
- Verification for `v.1.296`: `tests/app-structure.test.mjs`, `tests/e2e/client-primary-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.297`: expanded the admin visual audit to cover DEV-only admin users CRM and programs overview harness surfaces, including CRM filter/action/tab tap targets.
- Verification for `v.1.297`: `tests/app-structure.test.mjs`, `tests/e2e/admin-visual.spec.js` and `npm.cmd run report:css` passed before full verification.
- `v.1.298`: split admin internals CSS into `admin-internals-lazy.css` for the DEV-only harness; `admin-lazy.css` again keeps the production admin hub lightweight.
- Verification for `v.1.298`: `tests/app-structure.test.mjs`, `tests/e2e/admin-visual.spec.js`, `npm.cmd run build`, `npm.cmd run check:bundle` and `npm.cmd run report:css` passed before full verification.
- `v.1.299`: added a structural guard so heavy admin CRM/program CSS cannot drift back into the production `admin-lazy.css` entrypoint, and gave the mobile login smoke enough room to wait for the 15s auth bootstrap fallback.
- Verification for `v.1.299`: `tests/app-structure.test.mjs`, `tests/e2e/admin-visual.spec.js` and repeated mobile `tests/e2e/client-smoke.spec.js` passed before full verification.
- `v.1.300`: moved `client-food-search-final.css` from core `index.css` into the nutrition lazy stack and guarded the ownership in `tests/app-structure.test.mjs`.
- Verification for `v.1.300`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js`, `npm.cmd run build` and `npm.cmd run report:css` passed before full verification.
- `v.1.301`: added nutrition AI photo not-found modal visual coverage, moved `legacy-nutrition-photo-not-found.css` into the nutrition lazy stack and extended mobile auth smoke waits for cold auth bootstrap runs.
- Verification for `v.1.301`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js`, repeated mobile `tests/e2e/client-smoke.spec.js`, `npm.cmd run build` and `npm.cmd run report:css` passed before full verification.
- `v.1.302`: expanded nutrition visual coverage to the create product/dish choice modal and its bottom-bar entry point.
- Verification for `v.1.302`: `tests/e2e/client-nutrition-visual.spec.js`, `tests/app-structure.test.mjs`, `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css` passed.
- `v.1.303`: expanded nutrition visual coverage to the custom dish ingredient picker and ingredient confirmation flow.
- Verification for `v.1.303`: `tests/e2e/client-nutrition-visual.spec.js`, `tests/app-structure.test.mjs`, `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css` passed.
- `v.1.304`: moved `legacy-nutrition-flow.css` from core `index.css` into the nutrition lazy stack and guarded the ownership in `tests/app-structure.test.mjs`.
- Verification for `v.1.304`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js`, `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css` passed.
- `v.1.305`: moved `legacy-nutrition-orbit.css` from core `index.css` into the nutrition lazy stack and guarded the ownership in `tests/app-structure.test.mjs`.
- Verification for `v.1.305`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js`, `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css` passed.
- `v.1.306`: fixed the nutrition week strip by switching to two-letter weekday labels, reusing the shared calendar helper in the E2E harness and guarding marker sizes in `tests/e2e/client-nutrition-visual.spec.js`.
- Verification for `v.1.306`: `tests/nutrition-calendar.test.mjs`, `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js`, `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css` passed.
- `v.1.307`: moved `legacy-warm-light-add-food-search-cleanup.css` from core `index.css` into the nutrition lazy stack and guarded the ownership in `tests/app-structure.test.mjs`.
- Verification for `v.1.307`: `tests/app-structure.test.mjs`, `tests/e2e/client-nutrition-visual.spec.js`, `npm.cmd run build`, `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css` passed.
