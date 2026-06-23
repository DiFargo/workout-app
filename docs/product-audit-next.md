# Product Audit Backlog

Last updated at app version `v1004`.

## Evidence

- `npm.cmd run verify`: passed.
- `npm.cmd run test:e2e`: passed with `11` passed and `1` skipped after serializing E2E workers.
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

## P0

No current P0 runtime blocker is known after the `v1003` E2E stabilization.

## P1: Next Product Fixes

1. Client workouts header reads as `Индивидуальныйплан` in text extraction.
   - Check whether the visual heading lacks spacing or only uses tight nested markup.
   - Expected result: title reads naturally as `Индивидуальный план` and still fits on mobile.

2. Trainer pages expose duplicate top headings.
   - Seen on clients, messages and programs where the audit reads headings like `Клиенты`, `Клиенты`.
   - Expected result: one primary `h1` per screen, secondary section titles use lower hierarchy.

3. Trainer mobile programs navigation needs clearer handling in audits and UX review.
   - Mobile bottom nav opens the extra menu before programs, while desktop navigates directly.
   - Expected result: behavior remains intentional, but labels and test helpers make this explicit.

4. Client navigation should have a stable shared selector for visual audits.
   - Current harness works through test ids, but bottom nav class is not captured by the generic audit selector.
   - Expected result: easier future checks for nav height, spacing and safe-area behavior.

5. Nutrition screen remains the densest client screen.
   - Harness sees many buttons in the nutrition view.
   - Expected result: visually confirm button grouping, tap targets and modal entry points on mobile.

## P2: Later Technical Cleanup

1. CSS bundle is still the largest structural debt.
   - Keep cleanup route-by-route, not by deleting legacy files blindly.
   - Start with nutrition or trainer screens only after screenshots/manual checks.

2. Add screenshot-based audit for key routes.
   - Current e2e confirms usability, not pixel quality.
   - Add visual artifacts only after deciding the exact reference screens.

3. Consider route-specific CSS loading later.
   - Do this only when a route already owns enough UI and styles to move cleanly.

## Recommended Order

1. Fix the client workout title spacing.
2. Normalize trainer heading hierarchy.
3. Improve trainer mobile programs navigation test helper/label clarity.
4. Add stable nav selectors for future visual audits.
5. Do a manual nutrition visual pass before any CSS cleanup.
