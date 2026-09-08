# Trainer style comparison — 3.0.708

- Existing interface: https://tren-85720.web.app/
- Temporary comparison interface: https://tren-85720.web.app/v2
- `/v2/` and nested `/v2/...` paths opt in; `/v20` and `/cssV2` do not.
- Both URLs use the same authentication, roles, assigned clients and Firebase data.
- The variant is selected from the URL on startup, not from shared local storage.
- No trainer business logic, access checks or persistence handlers changed.

## Implementation

`src/app/cssVariant.js` loads the scoped V2 CSS only for its URL. Existing CSS
Modules retain their original rules; appended selectors require the V2 marker.
The program constructor has semantic data attributes for stable styling.
The final choice can be promoted later without maintaining duplicate components.

## Verification

- ESLint: no errors; 36 existing warnings.
- Unit tests: 680 passed.
- Firestore Rules emulator: 30 passed.
- Functions syntax, isolated staging build, production build and bundle budget passed.
- Both production dependency audits report zero vulnerabilities after targeted
  updates to xmldom and the Functions qs override. Functions are not deployed.
- Dedicated browser checks cover both URLs at 320px and 1366px: reload, main
  navigation, client tabs, actions sheet, cabinet, program library, constructor,
  day navigation, editable controls and horizontal overflow.
- The harness intentionally uses no-op persistence callbacks for the program
  manager. These browser checks do not claim end-to-end Firebase writes.

## Existing broad-suite limitation

The full legacy browser suite is not green. Its run was stopped after failures
on the original `/` route, including obsolete `.adminPanelHubPage` selectors,
client dashboard copy and trainer card navigation expectations. Its results are
not reported as a successful full release gate. Logs remain in
`artifacts/trainer-v2-full-e2e.log` and `artifacts/trainer-v2-release-gate.log`.
The comparison release is limited to presentation and is checked separately.

## Deployment

Target: Firebase Hosting only, project `tren-85720`. The production artifact
marker is verified before upload. Firestore Rules, Functions and stored data
are outside this deployment.

## Responsive refinement — 3.0.708

Acceptance checklist:
- [x] V2 matches the client shell widths, 20px phone gutters (16px at 320px), sticky headers and 70px bottom navigation including the default safe-area space.
- [x] Single vertical scroll owner; last cards remain above navigation.
- [x] Client cards use one phone column, two tablet columns, and desktop table columns; long names wrap without overlapping statistics.
- [x] Program cards, search, cabinet and sync sheet use compact calm-blue surfaces.
- [x] Original URL and all existing data/actions remain available; no persistence or access changes.
- [x] 680 unit tests pass; ESLint has zero errors and 36 existing warnings.
- [x] Focused browser coverage: 16 checks pass across 320, 375, 430, 600, 768, 1024 and 1366px plus short landscape. Eight duplicate project cases are intentionally skipped. The final 1024px case hit Chromium ERR_NO_BUFFER_SPACE before app load and passed in an isolated rerun.
- [x] Production build, bundle budget and production artifact validation pass.

The adaptive harness adds long names, enough clients to scroll, and a sync preview;
it is test-only and does not add demo users to Firebase. Constructor styles no
longer require local `!important` overrides; existing source-contract tests pass.
