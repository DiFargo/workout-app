# Release 3.0.795 — questionnaire and basic-plan library

## Acceptance checklist

- [x] Approved slider mockup implemented in the real seven-step questionnaire.
- [x] Keyboard and tap alternatives; 1–5 sessions per week; compact editable review.
- [x] Entire approved trainer library covered: 89 source records resolve to 70 distinct public exercises. Fourteen previously missing movements added; no trainer identity, assigned weights, client data or history exposed.
- [x] Fourteen additional shared videos copied and checked. The existing 39 videos remain unchanged (53 public video-backed movements total).
- [x] Compatible videos preferred in Gemini candidates and deterministic fallback. Non-video movements remain available; alternatives capped at two and respect home/gym equipment.
- [x] New generated programmes use three sets; previously assigned prescriptions are not migrated.
- [x] Optional “Всё тело · 3 + 3 + 1” format: 3 lower-body movements, 3 upper-body movements, core last; 7 exercises × 3 sets for 1–2 gym sessions of 60–90 minutes.
- [x] Visible default suggestion for women selecting general fitness, returning, gym, 1–2 sessions, 60–90 minutes and no limitations. A deliberate focus choice wins; other profiles are not automatically changed.
- [x] Scott-bench triceps extension remains distinct from preacher curl, per user clarification.
- [x] Hosting and `functions:aiBasicWorkoutPlan` deployed; live smoke checks complete (2026-09-16, endpoint `aiBasicWorkoutPlan-v22`).

## Source-media exceptions

Correction for 3.0.796, confirmed by the user: the original `IMG_7783` video was incorrectly classified as bilateral. The user replaced the trainer's “Жим ногами” video and requested that replacement in the public base as well. Use the freshly read trainer card as the source; do not move the old clip or rewrite programme identities, loads or history. “Разведения гантелей в стороны” points to hip abduction and resolves to lateral raises with a correct video. The seated/standing bent-over fly entries reuse one source clip, so the public video is attached to the generic bent-over fly; the seated variant remains a separate no-video movement. Trainer source records are untouched.

Unknown exact illustrations intentionally fall back to muscle information instead of a nonexistent or unrelated image.

## Verification

- 114 focused basic-workout unit tests passed.
- 32 security, exercise-card isolation and prescribed-set preservation tests passed.
- Chromium: questionnaire, generation/error gates, save behaviour, library search, keyboard sliders, 1-day plans and the 3+3+1 suggestion.
- WebKit: questionnaire, editing, short/landscape layouts and both slider scenarios.
- Primary viewport: 402 × 874 (iPhone 17 Pro); secondary checks: 320 × 568, 375 × 667, 844 × 390, 768 × 1024.
- Functions syntax, targeted ESLint (no errors; two existing hook warnings), production build, Firebase artifact validation and bundle budget passed.
- Media migration ledger: `artifacts/basic-library-795-publish/verified.json`; programme, trainer-card and history writes: zero.

The release changes only Hosting and the basic-plan generation endpoint. No Firestore/Storage rules or other functions are deployed. Authenticated production generation is not exercised on a real client's account by the smoke checks; business behaviour is tested in isolated fixtures.

Published files match the validated production build. The login screen renders at 402 × 874 with no runtime errors or horizontal overflow. Anonymous and invalid-token requests to the generation endpoint return 401; trainer/client media endpoints retain their authentication gates. Evidence: `artifacts/deploy-3-0-795-readonly-smoke.json`, `artifacts/deploy-3.0.795-gemini-smoke.json`, `artifacts/deploy-3.0.795-browser-smoke.json`.
