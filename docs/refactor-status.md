# Refactor Status

Last updated at app version `v.1.279`.

## Stable Now

- `src/App.jsx` is a thin `AppErrorBoundary` + `AppCore` wrapper.
- `src/main.jsx` is a thin React entrypoint with core CSS and service worker registration.
- `src/AppCore.jsx` is still large, but now acts mostly as a coordinator for state, route context and handler wiring.
- JS/JSX source modules are guarded against unreachable files and import cycles.
- CSS files are guarded so every CSS file under `src/styles` and `src/components` stays reachable from the core or approved lazy CSS entrypoints.
- Shared hooks live in `src/shared/hooks`.
- Main route, terminal route, nutrition route and E2E harness screens are lazy-loaded.
- Client, trainer and admin hub harnesses cover the main local visual smoke surfaces.
- `npm.cmd run verify` runs build, bundle budget, unit tests and critical lint.
- Empty CSS placeholder files were removed; `src/styles/index.css` remains the core app CSS entrypoint, with workout, nutrition, trainer and admin heavy stacks loaded lazily.

## Current Build Shape

From the latest verified build:

- main app JS chunk: about `473.20 KiB` raw, `131.82 KiB` gzip.
- main JS budget: `600 KiB` raw, `170 KiB` gzip.
- main CSS bundle: about `1658.33 KiB` raw, `169.45 KiB` gzip.
- CSS budget: `2100 KiB` raw, `270 KiB` gzip.
- CSS source files under `src`: 105 total in the latest `npm.cmd run report:css` pass.

The JS side has already received the biggest low-risk win. The next meaningful size problem is route-by-route CSS cleanup after stable screenshots, not more AppCore slicing.

## Do Not Do Next

- Do not keep splitting `AppCore.jsx` only to reduce line count.
- Do not delete legacy CSS by filename or intuition.
- Do not move Firebase, trainer or nutrition persistence while doing structure cleanup.
- Do not make visual redesign changes inside architecture cleanup commits.

## Best Next Steps

1. Keep `AppCore.jsx` stable unless a concrete product change touches a contained area.
2. Treat CSS as the next architecture track:
   - start with `npm.cmd run report:css`;
   - map large CSS files to screens/components;
   - keep route-specific CSS behind approved lazy entrypoints;
   - keep the current CSS budget green while reducing it gradually;
   - only remove classes after usage search and visual/e2e checks.
3. Consider lazy-loading trainer/client heavy data helpers only when their state and handlers can move with the route cleanly.
4. Run `npm.cmd run verify` after structural changes and `npm.cmd run test:e2e` after route/loading changes.

## Recent Verification

- `npm.cmd run test`: passed, `212` passed.
- `npm.cmd run build`: passed.
- `npm.cmd run check:bundle`: passed.
- `npm.cmd run report:css`: passed.
- `npm.cmd run test:e2e`: passed, `23` passed and `1` skipped.
