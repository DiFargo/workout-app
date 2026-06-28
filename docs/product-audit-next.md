# Product Audit Backlog

Last updated at app version `v.1.297`.

## Evidence

- `npm.cmd run build`: passed.
- `npm.cmd run check:bundle`: passed.
- `npm.cmd test`: passed with `212` passed.
- `npm.cmd run lint:critical`: passed.
- `npm.cmd run test:e2e`: passed with `27` passed and `1` skipped.
- `npx.cmd playwright test tests/e2e/admin-visual.spec.js`: passed with `4` passed.
- `npx.cmd playwright test tests/e2e/client-primary-visual.spec.js`: passed with `2` passed.
- `npx.cmd playwright test tests/e2e/client-nutrition-visual.spec.js --project=mobile-chromium`: passed.
- `npx.cmd playwright test tests/e2e/client-workout-visual.spec.js`: passed with `4` passed.
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
- client cabinet;
- cabinet workout history modal;
- cabinet measurements modal.
- cabinet nutrition modal.
- cabinet workout calendar modal.
- cabinet progress photos modal.
- cabinet settings modal.
- cabinet trainer notifications modal.
- cabinet Telegram management modal.

The admin visual audit now attaches screenshots for:

- admin panel hub;
- admin access denied state.
- admin users CRM harness;
- admin programs overview harness.

The nutrition visual audit now attaches screenshots for:

- nutrition main screen;
- food search;
- food search results;
- product amount screen;
- product edit sheet;
- My Database;
- calendar modal;
- diary modal;
- nutrition analysis modal.

The client workout visual audit now attaches screenshots for:

- workout plan cards;
- next workout card after swipe;
- workout mode modal;
- workout history modal;
- empty assigned plan state.

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
14. Nutrition product flow coverage now catches food search results, product amount/edit surfaces and My Database.
15. Nutrition product meal selector and edit close button now keep stable tap/click targets in the deeper visual audit.
16. Nutrition CSS cleanup removed an older duplicated product/edit action-bar block after the deeper visual audit covered both surfaces.
17. Client workout visual coverage now includes the empty assigned plan state for safer workout empty-state CSS cleanup.
18. Client workout empty-state CSS now has one scoped owner after old global legacy duplicates were removed.
19. Client cabinet workout history modal now has screenshot coverage, and its delete action keeps a stable 44px tap target.
20. Client cabinet measurements modal now has screenshot coverage, and its close action keeps a stable 44px tap target.
21. Client cabinet nutrition modal now has screenshot coverage, accepts string date keys in nutrition planning helpers, and keeps close/goal/week controls at stable 44px tap targets.
22. Client cabinet workout calendar modal now has screenshot coverage, and its close/month/edit/save controls keep stable 44px tap targets.
23. Core CSS cleanup removed four import-only legacy stack aggregators; `index.css` imports the same child files directly and the CSS graph guard was updated.
24. CSS cleanup removed the remaining import-only light, nutrition and admin stack aggregators from active style entrypoints.
25. Client cabinet progress photos modal now has screenshot coverage for the upload steps and save action.
26. Nutrition week strip now keeps weekday labels separated from day markers, with a visual audit geometry guard.
27. Client cabinet settings, trainer notifications and Telegram management modals now have screenshot coverage and stable close/action tap targets.
28. Admin users CRM and programs overview internals now have DEV-only harness screenshot coverage with tap-target and overflow checks.

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
   - Status: nutrition cleanup continues under deeper visual coverage; older duplicate product/edit action-bar CSS was removed without blind file deletion.
   - Status: workout cleanup has started under the empty-state visual guard; legacy global empty-state duplicates were removed.
   - Status: core legacy stack cleanup continued by removing import-only aggregators after client primary/nutrition/workout visual guards passed.
   - Status: light, nutrition and admin stack aggregators were also removed after client primary/nutrition, trainer and admin visual guards passed.

2. Add screenshot-based audit for key routes.
   - Current e2e confirms usability, not pixel quality.
   - Status: client main, client cabinet, cabinet workout history modal, cabinet measurements modal, cabinet nutrition modal, cabinet workout calendar modal, cabinet progress photos modal, cabinet settings modal, cabinet trainer notifications modal, cabinet Telegram management modal, client nutrition, client workouts, workout empty state, trainer workspace, admin hub, admin users CRM harness and admin programs overview harness screenshot artifacts are covered.

3. Consider route-specific CSS loading later.
   - Do this only when a route already owns enough UI and styles to move cleanly.
   - Status: started for admin hub/internals, trainer workspace and core covered screens; entrypoints now import CSS directly where aliases or stack aggregators were redundant.

## Recommended Order

1. Use `docs/production-smoke-checklist.md` for production smoke before and after deploy-risk changes.
2. Use `docs/css-cleanup-baseline.md` before route-by-route CSS cleanup.
3. Start CSS cleanup only from a route whose screenshots are already stable.
