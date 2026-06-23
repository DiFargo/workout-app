# Product Audit Backlog

Last updated at app version `v1005`.

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

## Done

1. Client workouts title now reads as `Индивидуальный план` in E2E text extraction.
2. Trainer clients, messages and programs screens now expose one primary `h1` in E2E checks.
3. Client bottom navigation has a stable `client-bottom-nav` test id and `clientBottomNav` class for future audits.

## P1: Next Product Fixes

1. Trainer mobile programs navigation needs clearer handling in audits and UX review.
   - Mobile bottom nav opens the extra menu before programs, while desktop navigates directly.
   - Expected result: behavior remains intentional, but labels and test helpers make this explicit.

2. Nutrition screen remains the densest client screen.
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

1. Improve trainer mobile programs navigation test helper/label clarity.
2. Do a manual nutrition visual pass before any CSS cleanup.
