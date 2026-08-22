# MVP Release Operations

This document is the operational gate for a production release. It does not
replace product smoke testing or the security review.

## Release gate and CI

Run the full gate from the repository root:

```powershell
npm run verify
```

It stops on the first failed check and returns a non-zero exit code. It covers:

- full ESLint;
- unit tests;
- Firestore Rules emulator tests;
- syntax parsing for every Firebase Functions JavaScript file;
- isolated staging build, then a fresh production build and bundle budget;
- root and Functions production dependency audits;
- whitespace errors in the diff; and
- Playwright Chromium E2E.

`npm run verify:core` runs the same gate without Playwright when a browser is not
available. It is useful during implementation, not as a production sign-off.
`npm run report:css` is an informational report and is not a release gate.

GitHub Actions runs the core checks in `quality`, then Chromium E2E in a separate
job. Do not merge a release branch with either required check failing. The CI
workflow uses Node 22 and Java 21 so the Firestore emulator path is repeatable.

## Release procedure

1. Freeze unrelated changes and confirm the target commit/version.
2. Run `npm run verify` from a clean worktree. It leaves a production artifact
   in `dist` after first proving the staging build is isolated.
3. Build a fresh staging artifact with that environment's values, then deploy
   to its exact project ID:

   ```powershell
   npm run build:staging
   npm run check:firebase-artifact -- --environment=staging --project <your-staging-project-id>
   firebase deploy --only hosting,functions,firestore:rules,storage --project <your-staging-project-id>
   ```

   The Hosting predeploy hook repeats the marker check. Do not deploy a staging
   `dist` directory to production.
4. Run the client, trainer and admin smoke scenarios in
   [production-smoke-checklist.md](production-smoke-checklist.md) against
   staging; use separate test accounts for each role.
5. Check the operational dashboards and error collector for new failures.
6. Get an explicit production deploy approval, then rebuild and deploy the
   minimum required Firebase targets with the exact production target:

   ```powershell
   npm run build:production
   npm run check:firebase-artifact -- --environment=production --project tren-85720
   firebase deploy --only hosting,functions,firestore:rules,storage --project tren-85720
   ```

   Use the smallest approved `--only` scope. A Functions- or Rules-only change
   does not need a Hosting artifact, but it still must name `--project`.
7. Repeat the smoke checklist against production, record the release version,
   timestamp, deployer and test-account labels, and watch errors/quotas for at
   least 30 minutes.

Do not combine a rules migration, Functions migration, data backfill and large UI
change in one untested production deployment.

## Client error reporting

`src/utils/errorReporting.js` reports uncaught window errors, rejected promises
and React error-boundary failures only when `VITE_ERROR_REPORTING_ENDPOINT` is
set. Without it, the implementation is a safe network no-op.

The payload is deliberately compact: timestamp, route without query parameters,
build version, environment, source/feature/role and a redacted error name/message.
It does not deliberately serialize a stack trace, Firebase token, user ID,
workout, nutrition, measurement or request body; the message applies common
email/token redaction and the collector must not be treated as an approved PII
channel. It rate-limits itself to ten reports per minute per browser page.

Before setting the endpoint:

1. Use an HTTPS collector (or a same-origin endpoint) owned by the team.
2. Configure the collector to accept JSON without client cookies, rate-limit it,
   reject oversized bodies and retain data for a documented limited period.
3. Alert on a sustained rise in `react.error-boundary`, `window.error` or
   `window.unhandledrejection` events by release version.
4. Keep the endpoint blank in local development until a non-production collector
   exists.

Application errors are only one signal. Also create budget/quota and failure-rate
alerts for Cloud Functions, Firestore, Hosting, Storage and the AI provider.

## App Check rollout

The client already initializes reCAPTCHA Enterprise App Check before the React
application loads whenever `VITE_APP_CHECK_SITE_KEY` is set. Authenticated API
calls add `X-Firebase-AppCheck`; custom HTTP Functions verify that header, and
callable Functions use the same `APP_CHECK_ENFORCED` parameter. The value is
opt-in so a missing external App Check registration cannot lock users out.

For a new web integration, Firebase recommends the reCAPTCHA Enterprise
provider. Follow the official
[web setup guide](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
and review metrics in monitoring mode first.

1. Register the staging web app with reCAPTCHA Enterprise in Firebase App Check.
2. Set its public site key as `VITE_APP_CHECK_SITE_KEY`, deploy to staging, and
   keep `functions/.env.<staging-project-id>` at `APP_CHECK_ENFORCED=false`.
3. Confirm valid-token traffic for real mobile browsers and the client, trainer
   and admin smoke accounts. Check that protected `/api/...` calls do not return
   401 and investigate any rejected requests.
4. Set `APP_CHECK_ENFORCED=true` for staging only, redeploy the affected
   Functions, and repeat the smoke test. Roll it back to `false` if the client
   cannot obtain tokens.
5. Repeat registration and monitoring for production, deploy the token-producing
   client first, then enable enforcement product by product with a rollback owner.

Never set `VITE_APP_CHECK_DEBUG_TOKEN` in a production build; the build rejects
it. Firebase App Check protects supported Firebase services and callable
Functions; this application additionally verifies custom HTTP requests server
side. See the [custom-resource verification guide](https://firebase.google.com/docs/app-check/custom-resource-backend).

## Invite-only authentication

Firestore Rules and the client can deny access to application data, but cannot
stop an enabled Firebase Authentication provider from first creating an Auth
identity. Before an invite-only MVP launch, make one deliberate console-level
choice for every environment:

- disable any self-service provider (for example Google) that the product does
  not intend to offer; or
- upgrade to Firebase Authentication with Identity Platform and deploy a
  `beforeUserCreated` blocking function that allows only the invite identities
  issued by this application.

Firebase documents that blocking functions run before the Auth user is saved,
but require the Identity Platform upgrade. See the
[official blocking-functions guide](https://firebase.google.com/docs/auth/extend-with-blocking-functions).
Do not treat a client-side sign-out after a rejected profile lookup as an
invite-only access-control boundary.

## Backup and restore

Backups are an infrastructure responsibility and must be configured before beta.
Do not store backup exports in a public Hosting or app-upload bucket.

1. Enable billing/Blaze for the production project, create a dedicated private
   Cloud Storage backup bucket, and grant only the required Firestore export
   service account access.
2. Schedule a daily full Firestore export with Cloud Scheduler/Cloud Functions
   or an equivalent controlled job. Firebase documents the required billing,
   bucket and scheduling prerequisites in its
   [scheduled export guide](https://firebase.google.com/docs/firestore/solutions/schedule-export).
3. Set retention deliberately (for example, daily exports for 35 days and a
   monthly export for 12 months), lifecycle rules and budget alerts. Firestore
   exports are billed per document read and are not an instantaneous snapshot;
   account for both when choosing cadence. See the
   [Firestore export/import reference](https://firebase.google.com/docs/firestore/manage-data/export-import).
4. Protect the Firebase Storage bucket separately. Enable Cloud Storage soft
   delete and/or object versioning plus lifecycle rules; object versioning alone
   does not protect against deletion of the whole bucket. See
   [Cloud Storage versioning](https://cloud.google.com/storage/docs/object-versioning)
   and [lifecycle management](https://cloud.google.com/storage/docs/lifecycle).
5. Export Firebase Auth users to an encrypted restricted location on the same
   cadence, following the Firebase CLI
   [`auth:export` reference](https://firebase.google.com/docs/cli). Treat its
   password-hash configuration and export file as sensitive credentials.
6. Perform a documented restore rehearsal in a separate recovery project before
   MVP. Verify a sampled client, trainer, admin role, Firestore document and
   Storage object. Record RPO/RTO, operator, source export and result.

Never import a backup into production as the first recovery step. First freeze
writes, preserve current evidence, choose the restore point, rehearse in an
isolated project, and obtain an explicit approval.

## Rollback

For a frontend incident, use Firebase Hosting release history to roll back to a
known-good version, then verify the version and the client smoke flow. Firebase
documents this in [Hosting release management](https://firebase.google.com/docs/hosting/manage-hosting-resources).

For a Functions or Rules incident, redeploy the known-good tagged commit with the
smallest explicit `--only` scope after checking compatibility with the current
data. A Hosting rollback does not roll back Functions, Rules, secrets or data.
After every rollback, record the version, exact targets, operator, reason and
post-rollback smoke result.
