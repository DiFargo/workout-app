# Assignment calendar isolation — 3.0.761

## Confirmed defect

The trainer editor passed the profile's complete calendar to `buildPlannedWorkoutSlots`.
Its positional OR match could select an older assignment's day 1 before the new
assignment's exact workout ID. A new eight-day program consequently displayed
four missed workouts from old August/September dates, despite its own future dates.

The shared schedule builder now scopes calendar entries to the requested workouts
before normalization. Exact IDs take priority; positional fallback is limited to
legacy entries without an ID. Calendar synchronization uses the same raw scope,
so saving edits cannot copy unrelated dates/statuses into a new assignment.
No production program, schedule document, or completed history was rewritten.

## Data discrepancy investigation (read-only)

For the user-specified test client, multiple assignments coexist. The September 10
09:17 assignment has three 110 kg sets on its first leg-press exercise. The latest
09:31 assignment has one 110 kg set on day 1 and three 110 kg sets on day 5; this
matches its source template, «Новая программа 2». All three template representations
(blocks, months, flat workouts) agree. The other template, «Программа», has three sets.
No 220 kg prescription or entered weight was present in the inspected assignments.

At the time of 3.0.761, the reported phone value was unconfirmed and a fresh phone
screenshot was requested. The follow-up below resolves that investigation; a local
resumed workout was only a hypothesis, not a confirmed cause.

## Verification

- New regression failed before the fix with exactly four missed slots; passes after.
- Eight-day editor E2E: all planned, three sets at 110 kg remain unchanged.
- All unit tests passed, including real missed dates, immutable completions,
  assigned program identity, and prescription-count preservation.
- Firestore emulator: basic completion/calendar transaction and assigned editor
  save/reload/concurrency/revoked-access tests passed.
- Focused ESLint, production build, bundle budget and `git diff --check` passed.
- Deployment scope: Firebase Hosting only; rules/functions/data are unchanged.

## Follow-up — 3.0.762

The new phone screenshot identifies the client as **Tes**, not **Test**. Exact-name,
read-only Firestore queries confirmed these are two distinct accounts:

- **Test**: September 10 assignments described above, with 110 kg prescriptions.
- **Tes**: assignment from August 25, first-day leg press is one set at 220 kg;
  day 5 is three sets at 220 kg. These values already exist in the saved assignment.

For Tes, the eight scheduled dates are August 26, August 29, September 2, September 5,
September 9, September 12, September 16, and September 19. On September 10 the first
five are legitimately missed. No account data or assignments were merged, transferred,
rewritten, or deleted during investigation.

The home status had a separate display bug: it described a missed workout using the
suggested future move (September 21), instead of the original planned date (August 26).
The status-date selector now uses the original date for missed slots, while retaining
the shifted date for non-missed slots. Schedule calculations and workout loads are unchanged.

### Acceptance checks

- [x] Regression reproduced September 21 before the fix and August 26 after it.
- [x] Tes's five genuinely missed slots remain five; upcoming dates remain unchanged.
- [x] All 23 focused profile/schedule tests pass.
- [x] Focused lint passes.
- [x] Home status and existing day-summary E2E pass; the new status is checked at
  375 × 812 and 812 × 375 with its primary action enabled and no horizontal overflow.
- [x] Phone/account discrepancy is resolved through read-only evidence, without data writes.
- [x] Production build, bundle budget and whitespace checks pass. Hosting 3.0.762
  was published; HTTP checks and asset hashes match the validated build, and the
  service worker retains its no-cache headers. No rules/functions were deployed.
