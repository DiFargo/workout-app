# Refactor Status

Last updated at app version `v995`.

## Stable Now

- `src/App.jsx` is a thin `AppErrorBoundary` + `AppCore` wrapper.
- `src/main.jsx` is a thin React entrypoint with one CSS entry: `src/styles/index.css`.
- `src/AppCore.jsx` is still large, but now acts mostly as a coordinator for state, route context and handler wiring.
- JS/JSX source modules are guarded against unreachable files and import cycles.
- CSS files are guarded so every CSS file under `src/styles` and `src/components` stays reachable from `src/styles/index.css`.
- Shared hooks live in `src/shared/hooks`.
- Main route, terminal route, nutrition route and E2E harness screens are lazy-loaded.
- `npm.cmd run verify` runs build, bundle budget, unit tests and critical lint.

## Current Build Shape

From the latest verified build:

- main app JS chunk: about `452.90 KiB` raw, `124.46 KiB` gzip.
- main JS budget: `600 KiB` raw, `170 KiB` gzip.
- CSS bundle: about `1.96 MB` raw.

The JS side has already received the biggest low-risk win. The next meaningful size problem is CSS, not more AppCore slicing.

## Do Not Do Next

- Do not keep splitting `AppCore.jsx` only to reduce line count.
- Do not delete legacy CSS by filename or intuition.
- Do not move Firebase, trainer or nutrition persistence while doing structure cleanup.
- Do not make visual redesign changes inside architecture cleanup commits.

## Best Next Steps

1. Keep `AppCore.jsx` stable unless a concrete product change touches a contained area.
2. Treat CSS as the next architecture track:
   - map large CSS files to screens/components;
   - identify route-specific CSS that can be imported by lazy route chunks;
   - only remove classes after usage search and visual/e2e checks.
3. Consider lazy-loading trainer/client heavy data helpers only when their state and handlers can move with the route cleanly.
4. Run `npm.cmd run verify` after structural changes and `npm.cmd run test:e2e` after route/loading changes.

## Recent Verification

- `npm.cmd run verify`: passed.
- `npm.cmd run test:e2e`: passed after the route lazy-loading changes.
