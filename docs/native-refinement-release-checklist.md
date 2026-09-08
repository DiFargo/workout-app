# Native refinement release

Reference: [approved five-screen mockup](client-five-main-screens-native-refinement.html), calm-blue palette.

## Acceptance

- [x] Main five destinations follow the reference typography, spacing, grouped surfaces and compact tab bar, using real data.
- [x] Primary actions, calendars, weight chart and profile actions retain their actual handlers.
- [x] Workout, food, measurement, account and notification detail screens use the same palette and compact controls.
- [x] Empty, completed, draft, recovery and reschedule states remain available.
- [x] Mobile layout, safe-area CSS, keyboard focus and scroll reachability verified in browser tests.
- [x] Focused regression checks and production build pass.
- [x] Hosting-only release published to the existing Firebase project and verified.

No changes to Firebase rules, authentication contracts, roles, trainer-client access or stored data.

## Verification — 7 September 2026, release 3.0.680

- Full ESLint: no errors; existing React Compiler migration warnings remain. Generated Android build assets are excluded from source linting.
- Unit suite: 661 passed. Firestore emulator rules checks, Functions syntax, isolated staging build and production build passed.
- Initial entry: 62.02 KiB gzip against the 100 KiB budget. Production artifact target checked as `tren-85720`.
- 18 focused mobile E2E checks passed: five destinations at 320/375/421/768 px; summary navigation; weight validation and save feedback; food portion flow; calendar/analysis; reschedule; completed-program history; rest timer; voice search; basic workout save actions; sign-in/reset validation.
- Two additional current-UI smoke checks passed for admin navigation/denied access and trainer client/workout/nutrition navigation. Existing trainer cabinet and assignment-calendar isolation checks also passed.
- Physical iPhone/Android devices were not connected. Device safe areas are handled in CSS; viewport checks are browser-based.

## Production smoke

Authenticated existing client account `Test`, URL `https://tren-85720.web.app/?release=3.0.680`.
Confirmed all five destinations, preserved workout draft/program counts, nutrition search open/close, full calendar, latest weight, quick-weight sheet open/close and client schedule open/close. No production food, weight, schedule or workout records were changed by smoke testing. No browser error logs observed.
Trainer/admin smoke used isolated local fixtures; no production role switching or access mutation was performed.
Final Hosting upload completed successfully; the live cabinet displayed `v.3.0.680`. The final progress surface was reloaded and verified with no horizontal overflow at 421 px and a hidden scrollbar while retaining vertical scrolling.

## Known verification limitations / separate follow-up

The broad `npm run verify` gate is **not fully green**: its dependency audit reports pre-existing moderate advisories in `@xmldom/xmldom` (app dependency tree) and `qs` through `body-parser`/`express` (Functions). Dependency upgrades and a backend release are separate from this Hosting-only visual release.
The older admin visual and trainer broad smoke specs use obsolete selectors/copy (`.adminPanelHubPage`, `Обзор`). Current-UI protected-flow smoke is covered by `native-protected-smoke.spec.js`; the entire legacy E2E matrix was not asserted green.
Firebase CLI unexpectedly printed authentication tokens in its account-list JSON diagnostic. No tokens were copied into repository files or deployed assets. Avoid sharing the conversation and renew CLI authorization; no credential revocation was performed automatically.

## Design sources

UI/UX Pro Max informed contrast and touch-target checks; Emil Design Engineering informed restrained emphasis, consistent component geometry and reduced-motion behavior. No generated images or fake device status bar were added.
