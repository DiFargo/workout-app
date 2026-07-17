# MVP Execution Plan v2

## Product objective

Workout App is a trainer-client operating system. The MVP succeeds when a trainer
can invite a client, assign and adjust a program, receive useful feedback, and see
the client's workouts, nutrition and measurements without data leakage or manual
recovery steps.

## Working rules

1. Work in one bounded package at a time.
2. Define acceptance criteria before editing.
3. Reuse existing architecture and UI owners.
4. Run fast checks after each implementation slice.
5. Run the complete release gate once per package, not after every CSS tweak.
6. Deploy only a verified package to an explicitly named Firebase project.
7. Increment the version once when a package is complete.

## Package 0: stable engineering baseline

Acceptance criteria:

- Full ESLint passes without warnings.
- Unit, Firestore Rules and Playwright tests pass.
- Client and trainer mobile tap targets pass visual E2E checks.
- Root and Functions production dependency audits report zero vulnerabilities.
- Firebase configuration can be selected through `VITE_FIREBASE_*` variables.
- Staging and production build/deploy instructions are documented.
- Bundle and CSS budgets pass.

## Package 1: privacy and authorization

Priority: release blocker.

- Replace public login-alias reads with a server-side login resolution endpoint.
- Verify every trainer query and write is restricted to assigned clients.
- Add negative Rules tests for unrelated trainer/client/admin accounts.
- Remove all cross-account local cache fallbacks and test A -> logout -> B.
- Separate staging data from production data before write-heavy E2E tests.
- Add rate limits and App Check to exposed callable/HTTP endpoints where practical.

## Package 2: startup reliability and observability

Priority: release blocker for mobile beta.

- Show the application after profile and active program are available.
- Load history, nutrition, measurements and Telegram independently.
- Replace the global minimum splash delay with per-card loading states.
- Add bounded timeouts, retry actions and useful offline states.
- Add remote error reporting with role, route, version and environment context.
- Track login-to-interactive, route-open and Firebase failure metrics.

## Package 3: trainer-client core loop

Priority: MVP core.

- Trainer invite -> client activation -> first setup works without refresh.
- Trainer assigns a program and schedule; client receives the same version.
- Client completes a workout and sends readiness, difficulty and a comment.
- Trainer sees one actionable signal, responds, and marks it handled.
- Program edits preserve history and never duplicate assignments.
- Dashboard and client card use the same status rules and counts.

## Package 4: data quality and bounded history

- Reject or flag impossible measurement and workout-duration values.
- Paginate workout history and trainer activity feeds.
- Define one canonical schema for workout, nutrition and measurement timestamps.
- Add migration/version markers for stored documents.
- Provide recovery UI for failed offline writes.

## Package 5: mobile beta hardening

- Test Android Chrome and iPhone Safari on real devices.
- Cover keyboard, safe-area, back navigation, install/update and offline recovery.
- Optimize large video and measurement assets.
- Freeze non-critical visual redesigns during the beta window.
- Run the production smoke checklist with separate trainer and client accounts.

## Deferred until after MVP

- New AI surfaces that do not improve the trainer-client loop.
- Broad CSS rewrites without route-by-route visual parity evidence.
- Additional analytics cards without a clear trainer action.
- New basic-program variants beyond the validated starter flow.

## Release gate

Run from the repository root:

```powershell
npm run lint
npm run build
npm run check:bundle
npm run report:css
npm test
npm run test:rules
npm run test:e2e
npm audit --omit=dev
Push-Location functions
npm audit --omit=dev
node --check index.js
Pop-Location
git diff --check
```

Release only when the package acceptance criteria and this gate are both green.
