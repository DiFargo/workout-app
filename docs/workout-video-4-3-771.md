# Workout video 4:3 — 3.0.771

## Requested behavior

- Full-width exercise media uses a stable 4:3 frame rather than a square.
- The glass fullscreen button exists only while the inline video is playing. It is removed from keyboard navigation on pause, end, and before playback.
- Preserve contained video, glass styling, playback/fullscreen handlers, workout data, and the scrollable content above the fixed dock.

## Verification

- Primary layout: iPhone 17 Pro logical viewport, 402 × 874; secondary checks at 320, 375, 768, and landscape 874 × 402.
- Focused Chromium tests cover geometry, play/pause/end, fullscreen open/close, keyboard operation, reduced motion, and safe-area/touch scrolling with six sets.
- WebKit scroll regression passed, including 402 × 874, 375 × 667, and 874 × 402. A repeated run timed out during browser teardown; an isolated rerun passed.
- Focused ESLint, production build, release bundle budget, and whitespace checks passed. Initial entry gzip remains 61.61 KiB.
- Scope: Hosting only; no database, access rules, Functions, or workout load changes.

Published to Firebase Hosting (`tren-85720`) and checked at 2026-09-10 20:22 UTC. HTML, service worker, and affected assets return 200; remote assets match the validated build. Protected media/card APIs still reject anonymous requests with 401. The isolated 402 × 874 production login check passed without runtime errors or horizontal overflow. No account or workout data was changed.

Evidence: `artifacts/deploy-3-0-771-readonly-smoke.json` and `artifacts/workout-production-login-771.png`.
