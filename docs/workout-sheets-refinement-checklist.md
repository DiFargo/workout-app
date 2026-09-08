# Workout and feedback sheets — 3.0.696

- [x] Align calendar/history, mode picker, and feedback with the calm cabinet sheets.
- [x] Keep calendar status meanings, workout data, saving and account/navigation boundaries.
- [x] Replace structural emoji/letter icons with existing Lucide icons; retain saved feedback in details.
- [x] Verify 375×667, 320×568 and landscape; full titles and reachable controls.
- [x] Verify calendar edits, history details, mode preference and feedback attachments/retry.
- [x] Focused tests, lint, production build and artifact checks pass.
- [x] Publish Hosting and verify served files match the build.

Scope is presentation only; no Firebase, permissions, timers, workout save or nutrition logic changes.

Verification: 8 focused mobile UI scenarios passed, along with 10 date/mode unit
tests, scoped ESLint, production build, bundle budget, and Firebase artifact
assertion. Calendar geometry passed after allowing 60 seconds for its 42-cell,
three-viewport traversal. Windows test-server teardown was stopped only after
all cases had finished. UI callbacks run against local fixtures, not live user data.

Published 7 September 2026: https://tren-85720.web.app/?release=3.0.696.
Hosting returned HTTP 200; all 17 checked assets matched the local build by SHA-256.
