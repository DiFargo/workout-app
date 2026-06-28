# Product Audit Backlog

Last updated at app version `v.1.283`.

## Evidence

- `npm.cmd run build`: passed.
- `npm.cmd run check:bundle`: passed.
- `npm.cmd test`: passed with `212` passed.
- `npm.cmd run lint:critical`: passed.
- `npm.cmd run test:e2e`: passed with `23` passed and `1` skipped.
- `npx.cmd playwright test tests/e2e/admin-visual.spec.js`: passed with `2` passed.
- `npx.cmd playwright test tests/e2e/client-primary-visual.spec.js`: passed with `2` passed.
- `npx.cmd playwright test tests/e2e/client-nutrition-visual.spec.js --project=mobile-chromium`: passed.
- `npx.cmd playwright test tests/e2e/client-workout-visual.spec.js`: passed with `2` passed.
- `npx.cmd playwright test tests/e2e/trainer-visual.spec.js`: passed with `2` passed.
- Harness audit covered mobile and desktop variants for:
  - client main;
  - client workouts;
  - client nutrition;
  - client cabinet;
  - trainer dashboard;
  - trainer clients;
  - trainer messages;
  - trainer programs.

No horizontal overflow was detected in the harness audit for the checked screens.

The client primary visual audit now attaches screenshots for:

- client main dashboard;
- client cabinet.

The admin visual audit now attaches screenshots for:

- admin panel hub;
- admin access denied state.

The nutrition visual audit now attaches screenshots for:

- nutrition main screen;
- food search;
- calendar modal;
- diary modal;
- nutrition analysis modal.

The client workout visual audit now attaches screenshots for:

- workout plan cards;
- next workout card after swipe;
- workout mode modal;
- workout history modal.

The trainer visual audit now attaches screenshots for:

- trainer dashboard;
- trainer clients;
- trainer client card;
- trainer messages;
- trainer programs.

## P0

No current P0 runtime blocker is known after the `v1003` E2E stabilization.

## Done

1. Client workouts title now reads as `Индивидуальный план` in E2E text extraction.
2. Trainer clients, messages and programs screens now expose one primary `h1` in E2E checks.
3. Client bottom navigation has a stable `client-bottom-nav` test id and `clientBottomNav` class for future audits.
4. Trainer mobile navigation uses stable semantic test ids for the More drawer and Programs entry.
5. Trainer workspace has a screenshot-based visual audit for dashboard, clients, messages and programs.
6. Trainer compact action buttons, message filters and mobile route header buttons keep stable 40px tap targets.
7. Client workout plan cards and workout modals have screenshot coverage and stable 40px tap targets for compact controls.
8. Client main dashboard and cabinet have screenshot coverage with bottom navigation and card spacing checks.
9. Admin panel hub has DEV-only harness coverage, screenshot coverage and a stable 40px back target.
10. Admin lazy CSS cleanup started by removing the redundant `admin.css` alias file.
11. Trainer lazy CSS cleanup continued by removing the redundant `trainer.css` alias file.
12. Core CSS entrypoint cleanup removed redundant `themes.css` and `client-main.css` alias files.
13. Core CSS entrypoint cleanup removed redundant `layout.css` and `components.css` grouping files.

## P1: Next Product Fixes

Done in `v.1.250`.

1. Nutrition screen remains the densest client screen.
   - Harness sees many buttons in the nutrition view.
   - Result: added a mobile visual Playwright audit for grouping, tap targets and modal entry points.
   - Result: fixed undersized diary modal controls and nutrition analysis modal close control to stable mobile tap targets.

## P2: Later Technical Cleanup

Started in `v.1.250`.

1. CSS bundle is still the largest structural debt.
   - Keep cleanup route-by-route, not by deleting legacy files blindly.
   - Start with nutrition or trainer screens only after screenshots/manual checks.
   - Status: no blind CSS deletion was done in this pass.

2. Add screenshot-based audit for key routes.
   - Current e2e confirms usability, not pixel quality.
   - Status: client main, client cabinet, client nutrition, client workouts, trainer workspace and admin hub screenshot artifacts are covered.

3. Consider route-specific CSS loading later.
   - Do this only when a route already owns enough UI and styles to move cleanly.
   - Status: started for admin hub, trainer workspace and core covered screens; entrypoints now import CSS directly where aliases were redundant.

## Recommended Order

1. Use `docs/production-smoke-checklist.md` for production smoke before and after deploy-risk changes.
2. Use `docs/css-cleanup-baseline.md` before route-by-route CSS cleanup.
3. Start CSS cleanup only from a route whose screenshots are already stable.
