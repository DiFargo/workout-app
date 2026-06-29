# Refactor Status

Last updated at app version `v.1.454`.

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
- Client nutrition weekday strip keeps both letters visible on narrow mobile screens with a dedicated CSS structure guard.
- Client nutrition header action labels use readable Russian text under structure and nutrition visual audits.
- Client nutrition weekday cells now lock label and marker centers to prevent mobile header drift.
- Client nutrition weekday cells now expose selected day and current-date state through `aria-pressed` and `aria-current`.
- Client nutrition calendar days now expose selected day and current-date state through `aria-pressed` and `aria-current`.
- Client cabinet nutrition week cells now expose readable day summaries and current-date state under the primary visual audit.
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
- Client food editor/search polish CSS is now owned by `nutrition-stack.css` instead of the core app stylesheet.
- Client nutrition week day buttons expose full-date accessible labels and selected state, and the nutrition visual audit guards them.
- Client cabinet Telegram management modal exposes dialog semantics and an accessible close control under the primary visual audit.
- Client cabinet Telegram management modal now uses the same contained dialog/backdrop shell as the other cabinet modals.
- Client cabinet nutrition goal picker exposes accessible goal labels and selected state under the primary visual audit.
- Client cabinet settings visual harness renders the real app-settings section and guards theme/Telegram accessibility attributes.
- Client cabinet trainer notification items expose task, status and due-date accessible labels under the primary visual audit.
- Client cabinet workout calendar date buttons expose selected and current-date accessibility state under the primary visual audit.
- Client cabinet measurements modal start action exposes an explicit accessible label under the primary visual audit.
- Client cabinet measurements modal value cards expose readable measurement labels under the primary visual audit.
- Client cabinet workout history expand and delete actions expose workout-specific accessible labels under the primary visual audit.
- Client cabinet progress photo upload inputs expose view-specific accessible labels under the primary visual audit.
- Client cabinet progress photo compare tabs expose selected `aria-pressed` state under the primary visual audit.
- Client cabinet progress photo compare selectors expose readable labels under the primary visual audit.
- Legacy trainer workspace bottom navigation exposes active-page `aria-current` state.
- Trainer transfer, program assignment, nutrition preset, workout status and overview modal selectors expose readable labels under the app structure audit.
- Modal dialogs now have a structure guard requiring `aria-modal` plus a readable `aria-label` or `aria-labelledby`.
- Client visual unity CSS exact duplicate product-editor blocks were removed under the client nutrition visual audit.
- Client render target CSS duplicate workout set-row block was removed; the remaining set-row owner is guarded by app structure tests.
- Admin client dashboard polish CSS no longer keeps empty media blocks, and small no-op trainer/cabinet duplicates were removed under visual guards.
- Client workout card render CSS no longer keeps repeated media-only card sizing blocks; root sizing locks remain guarded.
- Client food search final CSS no longer keeps the older duplicate compact product title-wrap media lock; the later product header lock remains guarded.
- Legacy nutrition header CSS now keeps one compact page padding owner instead of repeating the same mobile page padding across narrower breakpoints.
- Admin CRM CSS no longer keeps older duplicate client card grid breakpoints; the later workspace breakpoint owner remains guarded.
- Client food search final CSS now keeps one compact product meal-header width owner instead of repeating the same non-`:has()` mobile lock.
- Client food search final CSS now keeps one compact product title font-size owner instead of repeating the same non-`:has()` mobile lock.
- Nutrition calendar CSS now keeps final label color and footer sizing locks in the final calendar owner, guarded by app structure tests.
- Client food search final CSS now keeps product title typography in the stable-flow owner, guarded by app structure tests.
- Client food search final CSS now keeps product hero spacing and narrow mobile x-locks in their latest owners.
- Admin calendar reminders CSS now keeps fixed back-label visibility in one root owner, guarded by app structure tests.
- Legacy food search CSS now keeps hidden quick-action ownership in root rules instead of repeating the same hide rules inside narrow media blocks.
- Nutrition food-search bottom bar CSS now keeps the photo active transform in one root owner, guarded by app structure tests.
- Legacy food search calories CSS no longer repeats the early mobile first-column shift before the later closer-to-grid owner.
- Client workout set rows CSS now keeps the no-weight modal grid in one root owner, guarded by app structure tests.
- Legacy food search calories CSS now keeps compact dot sizing in the latest mobile owner, guarded by app structure tests.
- Profile dashboard CSS now keeps AI stat compact sizing in the latest compact owner, guarded by app structure tests.
- Desktop cabinet CSS now keeps trainer client overview two-column locks in the broad mobile owner, guarded by app structure tests.
- Legacy food editor CSS now keeps summary dot sizes in root owners, guarded by app structure tests.
- Nutrition calendar CSS now keeps compact grid gap and day-number size in the final compact owner, guarded by app structure tests.
- Nutrition late layout CSS now keeps repeated mobile no-op spacing and meal-card locks out of older owners, guarded by app structure tests.
- Nutrition late layout CSS now keeps the compact meal plus-button size in the lower-height owner instead of repeating it in the older compact block.
- Nutrition calories tail CSS now keeps narrow calorie number sizes in the later compact-height owner, guarded by app structure tests.
- Nutrition summary calories CSS now keeps compact gap and pixel sizing in later final owners, guarded by app structure tests.
- Nutrition late layout CSS now keeps the compact calories-card top offset in the final gap owner, guarded by app structure tests.
- Nutrition header CSS now keeps pixel-meter span sizing in the later compact owner, guarded by app structure tests.
- Nutrition header CSS now keeps calorie-row font sizes in later compact owners, guarded by app structure tests.
- Nutrition header CSS now keeps meal-title font sizes in later compact owners, guarded by app structure tests.
- Nutrition header CSS now keeps meal-kcal font sizes in later compact owners, guarded by app structure tests.
- Nutrition header CSS now keeps early narrow meal text sizes in later compact owners, guarded by app structure tests.
- Nutrition header CSS now keeps early narrow layout sizes in later compact owners, guarded by app structure tests.
- Nutrition header CSS now keeps reference narrow layout sizes in later compact owners, guarded by app structure tests.
- Client main CSS now keeps compact AI stat text rules in the later compact owner, guarded by app structure tests.
- Client nutrition grid CSS now keeps progress insight spacing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps bottom navigation sizing in the later owner, guarded by app structure tests.
- Client primary final CSS now keeps shared bottom/action bar sizing in the later mobile owner, guarded by app structure tests.
- Client primary final CSS now keeps food action bar fixed sizing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps main AI stats row sizing and text rules in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps profile AI hero sizing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps nutrition arrow and meta sizing in the root owner, guarded by app structure tests.
- Client primary final CSS now keeps primary page title typography in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps primary page title row spacing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps primary header action sizing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps client title row sizing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps client title action styling in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps workout start button fixed styling in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps header action layout in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps client page variables and background in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps product and editor food action bars in the unified owner, guarded by app structure tests.
- Client primary final CSS now keeps profile AI hero heading typography in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps food editor mobile header and sheet layout in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps workout stats layout in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps fixed photo action spacing in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps product flow title typography in the final owner, guarded by app structure tests.
- Client primary final CSS now keeps product flow header layout in the final owner, guarded by app structure tests.
- Trainer message filters expose selected `aria-pressed` state under trainer smoke and visual audits.
- Trainer message list items expose selected `aria-pressed` state under trainer smoke and visual audits.
- Trainer nutrition analytics period buttons expose selected `aria-pressed` state under trainer smoke.
- Trainer notification reminder periods and workout calendar dates expose selected `aria-pressed` state under trainer smoke.
- Admin trainer-calendar day, hour-reminder and reminder toggle controls expose selected `aria-pressed` state, and the calendar panel is clamped against mobile overflow under the admin visual audit.
- Trainer calendar reminder-before selectors expose readable labels under the app structure audit.
- First setup sex, activity and goal choices expose selected `aria-pressed` state under the client primary visual audit.
- Profile body metric sex choices expose selected `aria-pressed` state under the client primary visual audit.
- Profile body metric goal and activity selectors expose readable labels under the client primary visual audit.
- Production trainer admin user filters and client cards expose selected `aria-pressed` state under the app structure audit.
- Production trainer dashboard filters and client rows expose selected `aria-pressed` state under the app structure audit.
- Production trainer client workspace role toggle and tabs expose selected `aria-pressed` state under the app structure audit.
- Client workout warmup timer presets expose selected `aria-pressed` state under the app structure audit.
- Production trainer client training program cards expose selected `aria-pressed` state under the app structure audit.
- Trainer program assignment and nutrition preset selectors expose readable labels under the app structure audit.
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
- Measurement CSS is owned by `client-measurements-lazy.css` under the app structure audit.
- Client cabinet action cards expose explicit accessible labels under the app structure audit.
- First setup CSS is owned by `client-first-setup-lazy.css` under the app structure audit.
- Nutrition weekday labels are stable two-letter values from `buildNutritionWeekDates`.
- Workout flow CSS is owned by `client-workout-lazy.css` under workout visual audits.
- Core workout CSS is owned by `client-workout-lazy.css`, including standalone workout route loaders.
- Exercise weight-mode CSS is owned by trainer/admin internals style entrypoints.
- Workout readiness choices expose selected `aria-pressed` state under the workout visual audit.
- Workout mode picker choices expose selected `aria-pressed` state under the workout visual audit.
- Basic workout quiz selectors expose readable labels under the app structure audit.
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
- Trainer client progress photo comparison selectors expose readable labels under the app structure audit.
- Trainer nutrition diary day buttons expose selected `aria-pressed` state under trainer workspace and visual audits.
- Trainer progress chart periods and exercise progress filters expose selected `aria-pressed` state under trainer workspace and visual audits.
- Admin harness filter pills, client cards, workspace tabs and program cards expose selected `aria-pressed` state under the admin visual audit.
- Admin users CRM and programs overview internals are covered by the admin visual audit through DEV-only harness surfaces.

## Current Build Shape

From the latest verified build:

- main app JS chunk: about `472.18 KiB` raw, `131.41 KiB` gzip.
- main JS budget: `600 KiB` raw, `170 KiB` gzip.
- main CSS bundle: about `1171.90 KiB` raw, `116.77 KiB` gzip.
- CSS budget: `2100 KiB` raw, `270 KiB` gzip.
- CSS source files under `src`: 100 total in the latest `npm.cmd run report:css` pass, about `3461.92 KiB` total source CSS.

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

- `npm.cmd run test`: passed with `297` passed.
- `npm.cmd run build`: passed.
- `npm.cmd run check:bundle`: passed.
- `npm.cmd run report:css`: passed.
- `npm.cmd run test:e2e`: passed, `37` passed and `1` skipped.
