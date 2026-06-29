# Refactor Status

Last updated at app version `v.1.370`.

## Stable Now

- `src/App.jsx` is a thin `AppErrorBoundary` + `AppCore` wrapper.
- `src/main.jsx` is a thin React entrypoint with core CSS and service worker registration.
- `src/AppCore.jsx` is still large, but now acts mostly as a coordinator for state, route context and handler wiring.
- JS/JSX source modules are guarded against unreachable files and import cycles.
- CSS files are guarded so every CSS file under `src/styles` and `src/components` stays reachable from the core or approved lazy CSS entrypoints.
- Shared hooks live in `src/shared/hooks`.
- Main route, terminal route, nutrition route and E2E harness screens are lazy-loaded.
- Client, trainer, admin hub and admin internals harnesses cover the main local visual smoke surfaces.
- `npm.cmd run verify` runs build, bundle budget, unit tests and critical lint.
- Empty CSS placeholder files were removed; `src/styles/index.css` remains the core app CSS entrypoint, with workout, nutrition, trainer and admin heavy stacks loaded lazily.
- Admin lazy CSS no longer uses the redundant `admin.css` alias; `adminPanelHub.css` is imported directly.
- Admin internals CSS for DEV-only visual coverage is isolated in `admin-internals-lazy.css`, keeping the production admin hub chunk lightweight.
- Admin hub and admin internals CSS entrypoints are now structurally guarded against accidental heavy import drift.
- Mobile client smoke waits long enough for slow cold auth bootstrap runs observed in Playwright mobile.
- Client smoke tests wait past the auth bootstrap fallback window, matching the app's signed-out loading behavior on slower mobile runs.
- Client workout visual audit waits for the harness bottom navigation before clicking, reducing cold-start timeout flakes.
- Client workout flow late CSS is owned by `client-workout-lazy.css` instead of the core app stylesheet.
- Client workout run polish and exercise notes CSS are owned by `client-workout-lazy.css` instead of the core app stylesheet.
- Client workout navigation/close and set-row CSS are owned by `client-workout-lazy.css` instead of the core app stylesheet.
- Client workout draft restore, readiness and post-workout feedback dialog CSS are owned by `client-workout-lazy.css` instead of the core app stylesheet.
- Client harness, nutrition visual and primary visual audits also wait for bottom navigation before route clicks.
- Trainer workspace and trainer visual audits wait for trainer navigation controls before route clicks.
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
- Client cabinet settings, trainer notifications and Telegram management modals are covered by the primary visual audit, including close/action tap targets.
- Client nutrition visual audit now checks weekday strip geometry and marker sizes so labels cannot crowd day markers.
- Client nutrition weekday strip keeps compact equal mobile cells and bounded markers under the nutrition visual audit.
- Client nutrition week labels now use unambiguous two-letter Russian weekdays.
- Client nutrition week labels now render as uppercase two-letter abbreviations so the mobile header cannot collapse to ambiguous one-letter days.
- Client nutrition weekday cells now lock label and marker centers to prevent mobile header drift.
- Client nutrition food-search/product polish CSS is now owned by `nutrition-stack.css` instead of the core app stylesheet.
- Client nutrition AI photo not-found modal is covered by the nutrition visual audit, and its CSS is owned by `nutrition-stack.css`.
- Client nutrition create product/dish choice modal is covered by the nutrition visual audit.
- Client nutrition custom dish editor, ingredient picker and ingredient confirmation are covered by the nutrition visual audit.
- Client AI Coach overview, AI nutrition onboarding and generated plan states are covered by the client AI Coach visual audit.
- Client AI Coach route CSS is owned by `ai-coach-lazy.css` instead of the core app stylesheet.
- Client nutrition AI plan and AI photo process CSS are owned by `nutrition-ai-plan-lazy.css` inside the nutrition lazy stack.
- Client nutrition food icon editor and training-day calorie highlight CSS are owned by `nutrition-food-icon-lazy.css` inside the nutrition lazy stack.
- Remaining profile body metrics and first setup core rules are owned by `legacy-profile-first-setup-core.css`; the old mixed AI/nutrition/workout stylesheet name is no longer imported.
- Client nutrition flow CSS is now owned by `nutrition-stack.css` instead of the core app stylesheet.
- Client nutrition orbit CSS is now owned by `nutrition-stack.css` instead of the core app stylesheet.
- Client nutrition warm-light add-food/search cleanup CSS is now owned by `nutrition-stack.css` instead of the core app stylesheet.
- Client nutrition dark-green food-flow CSS is now owned by `nutrition-stack.css` instead of the core app stylesheet.
- Client nutrition week day buttons expose full-date accessible labels and selected state, and the nutrition visual audit guards them.
- Client cabinet Telegram management modal exposes dialog semantics and an accessible close control under the primary visual audit.
- Client cabinet nutrition goal picker exposes accessible goal labels and selected state under the primary visual audit.
- Client cabinet settings visual harness renders the real app-settings section and guards theme/Telegram accessibility attributes.
- Client cabinet trainer notification items expose task, status and due-date accessible labels under the primary visual audit.
- Client cabinet workout calendar date buttons expose selected and current-date accessibility state under the primary visual audit.
- Client cabinet measurements modal start action exposes an explicit accessible label under the primary visual audit.
- Client cabinet workout history expand and delete actions expose workout-specific accessible labels under the primary visual audit.
- Client cabinet progress photo upload inputs expose view-specific accessible labels under the primary visual audit.
- Client cabinet progress photo compare tabs expose selected `aria-pressed` state under the primary visual audit.
- Legacy trainer workspace bottom navigation exposes active-page `aria-current` state.
- Trainer message filters expose selected `aria-pressed` state under trainer smoke and visual audits.
- Trainer message list items expose selected `aria-pressed` state under trainer smoke and visual audits.
- Trainer nutrition analytics period buttons expose selected `aria-pressed` state under trainer smoke.
- Trainer notification reminder periods and workout calendar dates expose selected `aria-pressed` state under trainer smoke.
- Admin trainer-calendar day, hour-reminder and reminder toggle controls expose selected `aria-pressed` state, and the calendar panel is clamped against mobile overflow under the admin visual audit.
- First setup sex, activity and goal choices expose selected `aria-pressed` state under the client primary visual audit.
- Profile body metric sex choices expose selected `aria-pressed` state under the client primary visual audit.
- Production trainer admin user filters and client cards expose selected `aria-pressed` state under the app structure audit.
- Production trainer dashboard filters and client rows expose selected `aria-pressed` state under the app structure audit.
- Production trainer client workspace role toggle and tabs expose selected `aria-pressed` state under the app structure audit.
- Client workout warmup timer presets expose selected `aria-pressed` state under the app structure audit.
- Production trainer client training program cards expose selected `aria-pressed` state under the app structure audit.
- Client workout next card exposes current step state with `aria-current` under the app structure audit.
- Legacy trainer dashboard client tabs expose selected `aria-pressed` state under the app structure audit.
- Legacy trainer admin history bulk selection exposes selected state and labeled workout checkboxes under the app structure audit.
- Production trainer program overview cards expose selected `aria-pressed` state under the app structure audit.
- Trainer mobile overflow navigation items expose current-page `aria-current` state under the app structure audit.
- Trainer workouts page active program tab exposes selected `aria-pressed` state under the app structure audit.
- Legacy trainer/admin action buttons declare explicit `type="button"` under the app structure audit.
- Admin and access-denied navigation buttons declare explicit `type="button"` under the app structure audit.
- All production JSX buttons declare explicit `type` under the app structure audit.
- Client icon-only back, close and refresh actions expose accessible labels under the app structure audit.
- Profile legacy CSS is owned by `client-profile-lazy.css` under the app structure audit.
- Additional profile/cabinet CSS is owned by `client-profile-lazy.css` under the app structure audit.
- Workout readiness choices expose selected `aria-pressed` state under the workout visual audit.
- Workout mode picker choices expose selected `aria-pressed` state under the workout visual audit.
- Nutrition portion selector choices expose selected `aria-pressed` state under the nutrition visual audit.
- Nutrition food-search bottom bar tabs expose selected `aria-pressed` state under the nutrition visual audit.
- Nutrition meal picker choices expose expanded and selected state under the nutrition visual audit.
- Nutrition product icon presets expose selected `aria-pressed` state under the nutrition visual audit.
- Nutrition product portion unit toggle exposes selected `aria-pressed` state under the nutrition visual audit.
- Trainer client card tabs expose selected `aria-pressed` state under trainer workspace and visual audits.
- Trainer workout library tab exposes selected `aria-pressed` state under trainer workspace and visual audits.
- AI Coach nutrition onboarding training-day and goal choices expose selected `aria-pressed` state under the AI Coach visual audit.
- AI Coach feature cards expose selected `aria-pressed` state under the AI Coach visual audit.
- Trainer workout day selector exposes selected `aria-pressed` state under trainer workspace and visual audits.
- Trainer client photo view tabs expose selected `aria-pressed` state under trainer workspace and visual audits.
- Trainer nutrition diary day buttons expose selected `aria-pressed` state under trainer workspace and visual audits.
- Trainer progress chart periods and exercise progress filters expose selected `aria-pressed` state under trainer workspace and visual audits.
- Admin harness filter pills, client cards, workspace tabs and program cards expose selected `aria-pressed` state under the admin visual audit.
- Admin users CRM and programs overview internals are covered by the admin visual audit through DEV-only harness surfaces.

## Current Build Shape

From the latest verified build:

- main app JS chunk: about `470.82 KiB` raw, `131.11 KiB` gzip.
- main JS budget: `600 KiB` raw, `170 KiB` gzip.
- main CSS bundle: about `1337.88 KiB` raw, `134.35 KiB` gzip.
- CSS budget: `2100 KiB` raw, `270 KiB` gzip.
- CSS source files under `src`: 98 total in the latest `npm.cmd run report:css` pass, about `3507.66 KiB` total source CSS.

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

- `npm.cmd run test`: passed, `227` passed.
- `npm.cmd run build`: passed.
- `npm.cmd run check:bundle`: passed.
- `npm.cmd run report:css`: passed.
- `npm.cmd run test:e2e`: passed, `37` passed and `1` skipped.
