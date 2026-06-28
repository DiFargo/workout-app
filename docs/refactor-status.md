# Refactor Status

Last updated at app version `v.1.295`.

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
- Admin lazy CSS no longer uses the redundant `admin.css` alias; `adminPanelHub.css` is imported directly.
- Trainer lazy CSS no longer uses the redundant `trainer.css` alias; `trainer-workspace.css` is imported directly.
- Core CSS no longer uses the redundant `themes.css` and `client-main.css` aliases; `theme.css` and `auth.css` are imported directly.
- Core CSS no longer uses the redundant `layout.css` and `components.css` grouping aliases; their child files are imported directly.
- Core CSS no longer uses import-only `legacy-stack.css`, `legacy-stack-foundation.css`, `legacy-stack-workflows.css` and `legacy-stack-final-polish.css`; `index.css` imports their child files directly in the same order.
- Active CSS entrypoints no longer use import-only `legacy-light-stack.css`, `legacy-nutrition-stack.css` and `legacy-admin-stack.css`; their child imports are inlined into `index.css`, `nutrition-stack.css` and `trainer-lazy.css`.
- Client nutrition visual coverage now includes search results, product amount/edit surfaces and My Database before deeper CSS cleanup.
- Client nutrition CSS cleanup removed an older duplicated product/edit action-bar block; later food search CSS owns those product surfaces.
- Client workout visual coverage now includes the empty assigned plan state before workout empty-state CSS cleanup.
- Client workout empty-state styling now has one scoped owner in `client-workout-empty-state.css`; old global legacy duplicates were removed.
- Client cabinet workout history modal is covered by the primary visual audit, including its compact delete action.
- Client cabinet measurements modal is covered by the primary visual audit, including its close/start actions.
- Client cabinet nutrition modal is covered by the primary visual audit, including its close, goal picker, save and week navigation actions.
- Client cabinet workout calendar modal is covered by the primary visual audit, including its close, month navigation, history entry and edit actions.
- Client cabinet progress photos modal is covered by the primary visual audit, including its upload steps and save action.
- Client nutrition visual audit now checks weekday strip geometry so labels cannot crowd day markers.

## Current Build Shape

From the latest verified build:

- main app JS chunk: about `473.20 KiB` raw, `131.82 KiB` gzip.
- main JS budget: `600 KiB` raw, `170 KiB` gzip.
- main CSS bundle: about `1658.33 KiB` raw, `169.45 KiB` gzip.
- CSS budget: `2100 KiB` raw, `270 KiB` gzip.
- CSS source files under `src`: 92 total in the latest `npm.cmd run report:css` pass, about `3503.89 KiB` total source CSS.

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
- `npm.cmd run test:e2e`: passed, `25` passed and `1` skipped.
