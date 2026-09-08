# Profile sheets refinement — 3.0.695

Scope: the body questionnaire, nutrition goals, and accounts/notifications sheets.

- [x] Calm iOS palette, normal system typography, consistent close controls.
- [x] Remove nested frames; use grouped settings rows and readable full-width selects.
- [x] Preserve existing form validation, saving, nutrition calculations, and account callbacks.
- [x] Verify three sheets at 375×667, 320×568, and 844×390 with no clipped controls.
- [x] Verify form edits, save retry, goal selection, calendar and notification controls.
- [x] Focused tests, JSX/CSS build and production artifact checks pass.
- [x] Publish Hosting and verify served assets match the build.

No authentication, Firebase rules, account identifiers, roles, or navigation changes.

Verification: 7 mobile UI scenarios and 3 focused save tests passed; scoped ESLint,
production build, artifact assertion, and bundle budget passed. The Windows test
server teardown was stopped after all seven test cases reported success.

Published 7 September 2026 to https://tren-85720.web.app/?release=3.0.695.
Production returned HTTP 200; all 13 checked assets matched the local build by
SHA-256, including the affected profile JavaScript/CSS. Hosting-only deployment.
