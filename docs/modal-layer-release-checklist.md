# Modal consistency — 3.0.704

Scope: background scroll locking, shared moderate backdrop, floating workout mode picker. No data, authentication, role, navigation or food-editor layout changes.

## Acceptance

- [x] Nutrition meal, calendar, plan, diary and food search block background wheel/touch scrolling.
- [x] Long modal content remains scrollable; background positions and original overflow styles restore after closing.
- [x] Nested dialogs retain the lock until the last dialog closes, without compounding backdrop blur.
- [x] Client, trainer and admin modal backdrops share a 4 px blur and neutral 28% scrim.
- [x] Workout mode has one close action, floating rounded corners and mobile-safe gutters; choices and remember setting still work.
- [x] Focused mobile UI, client/trainer/admin smoke checks and syntax checks pass.
- [x] Production build, bundle budget and deployment artifact validation pass.
- [x] Firebase Hosting publication and live release smoke check pass.

## Verification evidence

- 32 mobile tests passed across modal layer, food screens, voice review, profile sheets and workout sheets (320–844 px, portrait/landscape).
- Three current-interface navigation smoke checks passed; trainer calendar and nutrition editor also verified the shared lock and backdrop.
- Existing trainer confirmed day/exercise deletion and admin CRM/program tests passed.
- Three older broad smoke tests stop at stale selectors before the changed modal flows: removed dashboard version badge, replaced admin hub classes, and obsolete trainer tab name. Current-interface checks above cover the corresponding navigation without reverting the UI.
- ESLint: no errors; 16 existing hook warnings in unrelated logic. New shared guard and focused tests are clean.
- Production build and Firebase artifact validation passed. Initial gzip: 62.03 KiB / 100 KiB budget.
- Visual screenshots inspected for meal, nutrition plan and workout mode.
- Firebase Hosting 3.0.704 published successfully. Live HTML returned HTTP 200; all 19 checked assets match the validated build. Invalid-invitation and notification-route safety checks passed (404 / 405).
