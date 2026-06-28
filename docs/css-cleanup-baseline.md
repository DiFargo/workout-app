# CSS Cleanup Baseline

Goal: reduce CSS risk and weight route by route, never by blind deletion.

Current verified budget:

- Main JS budget: `600 KiB` raw, `170 KiB` gzip.
- Main CSS budget: `2100 KiB` raw, `270 KiB` gzip.
- Latest main CSS bundle: about `1658.33 KiB` raw, `169.45 KiB` gzip.
- Latest source CSS report: `105` files, about `3508.48 KiB` total source CSS.

## Screenshot Coverage

Covered by Playwright visual audits:

- Client main dashboard: `tests/e2e/client-primary-visual.spec.js`
- Client cabinet: `tests/e2e/client-primary-visual.spec.js`
- Client nutrition main, food search, calendar, diary and analysis modal: `tests/e2e/client-nutrition-visual.spec.js`
- Client workout cards, swipe, workout mode modal and workout history modal: `tests/e2e/client-workout-visual.spec.js`
- Trainer dashboard, clients, client card, messages and programs: `tests/e2e/trainer-visual.spec.js`
- Admin panel hub and denied state: `tests/e2e/admin-visual.spec.js`

Not covered deeply yet:

- Full admin users/client CRM internals.
- Full admin program editor internals.
- Live production-only auth and Firestore permission edge cases.

## Largest CSS Files From Latest Report

Start mapping here before any cleanup:

- `src/styles/client-primary-final-lock.css` - `266.69 KiB`
- `src/components/trainer/trainer-workspace.css` - `179.26 KiB`
- `src/styles/client-nutrition-grid-lock.css` - `170.85 KiB`
- `src/styles/client-render-target-lock.css` - `116.67 KiB`
- `src/styles/legacy-food-editor-tail.css` - `100.56 KiB`
- `src/styles/legacy-admin-client-dashboard-polish.css` - `97.12 KiB`
- `src/styles/legacy-desktop-cabinet-polish.css` - `93.17 KiB`
- `src/styles/legacy-client-workout-flow-late.css` - `87.59 KiB`
- `src/styles/client-visual-unity-final.css` - `84.29 KiB`
- `src/styles/legacy-profile-dashboard-telegram-late.css` - `83.79 KiB`

## Cleanup Order

1. Client primary screens.
   - Reason: main and cabinet now have direct screenshot coverage.
   - Candidate files: `client-primary-final-lock.css`, `client-render-target-lock.css`, `client-visual-unity-final.css`, `legacy-desktop-cabinet-polish.css`.

2. Client workouts.
   - Reason: workout cards and modals have visual coverage and fixed tap targets.
   - Candidate files: `client-workout-card-render.css`, `legacy-client-workout-flow-late.css`, workout-related blocks in broad legacy files.

3. Client nutrition.
   - Reason: densest route, already covered by modal screenshots.
   - Candidate files: `client-nutrition-grid-lock.css`, `legacy-food-editor-tail.css`, `nutrition.css`, `legacy-nutrition-late-layout.css`.

4. Trainer workspace.
   - Reason: dashboard, clients, messages and programs have coverage; the CSS is large but route-scoped.
   - Candidate file: `src/components/trainer/trainer-workspace.css`.

5. Admin hub only.
   - Reason: hub is covered; deep admin CRM internals need more harnessing first.
   - Candidate files: `adminPanelHub.css`, hub-specific rules inside admin lazy stack.

## Guardrails

- Run `npm.cmd run report:css` before and after cleanup.
- Search class usage with `rg` before removing selectors.
- Prefer moving route-specific CSS into existing lazy entrypoints over deleting uncertain legacy blocks.
- After each route cleanup, run the matching targeted visual spec first.
- Before committing, run `npm.cmd run verify`, `npm.cmd run test:e2e` and `npm.cmd run report:css`.
- Do not clean admin CRM internals until a deeper admin harness exists.
