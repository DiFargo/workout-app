# MVP Release Operations

This document is the operational gate for a production release. It does not
replace product smoke testing or the security review.

## Release gate and CI

Use Node 22 and Java 21. Install dependencies with `npm ci` in the root,
`functions`, and `functions-telegram-auth`. Then prepare the browser runtimes
from the repository root:

```powershell
npx playwright install chromium webkit
```

On Linux use `--with-deps`. Chromium is also required by the unit regression
that exercises the real reminder settings component with React DOM. WebKit is
used by targeted browser compatibility checks.

Run the full gate from the repository root:

```powershell
npm run verify:full
```

It stops on the first failed check and returns a non-zero exit code. It covers:

- full ESLint;
- unit tests;
- Firestore and Storage Rules emulator tests in a local demo project;
- syntax parsing for every JavaScript file in all codebases declared by `firebase.json`;
- isolated staging build, then a fresh production build and bundle budget;
- root runtime/development and every declared Functions codebase's dependency audit;
- whitespace errors in the diff; and
- Playwright Chromium E2E.

`npm run verify:core` runs the same gate without the full Playwright E2E suite;
the React DOM unit regression still requires Chromium. It is useful during
implementation, not as a production sign-off.
`npm run verify` is deliberately lighter: production build, artifact budgets
(100 KiB static entry, 640 KiB deduplicated mandatory boot, 170 KiB Firebase core,
all gzip), and `git diff --check`. It does not include lint, unit, Rules,
Functions, dependency-audit or browser checks. Do not use it alone for release
approval. [Budget scope and the 3.0.849 baseline](architecture.md#bundle-budget)
describe what these byte limits do and do not measure.
`npm run report:css` is an informational report and is not a release gate.

GitHub Actions runs the core checks in `quality`, then Chromium E2E in a separate
job. Do not merge a release branch with either required check failing. The CI
workflow uses Node 22 and Java 21 so the Firestore emulator path is repeatable,
and installs Chromium before the unit tests on its clean runner.

## Release procedure

1. Freeze unrelated changes and confirm the target commit/version.
2. Run `npm run verify:full` from a clean worktree. It leaves a production artifact
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

The sign-off record must name the target artifact/version and retain passing
lint, unit, Rules, Functions syntax, staging/production artifact-isolation,
dependency-audit and browser results, plus approved live smoke results for
client, trainer and admin. Clearly label any unexecuted/blocked check; source
assertions or synthetic fixtures are not a substitute for that live result.
See the smoke checklist for the actual account/data actions being authorized.

Do not combine a rules migration, Functions migration, data backfill and large UI
change in one untested production deployment.

## Android version metadata (only for an authorized native build)

Web/Telegram publication is not an Android release. Native metadata is prepared
only when building Android; do not claim an APK/AAB was published from a web
version bump or Capacitor sync.

`node scripts/prepare-android-version.mjs` checks `android/app/build.gradle`
against `package.json` and fails on a mismatch. `--write` synchronizes the two
literal native fields before an authorized Android build. The established scheme
is `major * 100000 + minor * 1000 + patch`, with minor <=99, patch <=999 and
Android/Play's numeric upper bound enforced; prerelease strings are rejected.
The helper refuses to decrease the checked-in native code, but source metadata
does not prove the last distributed build. Before distribution, obtain that code
from the actual release record/console and run:

```powershell
node scripts/prepare-android-version.mjs --write --last-version-code=<verified-distributed-code>
```

The derived code must exceed that verified baseline. Do not substitute a guessed
code, or invent a native release to satisfy the guard. After building/signing,
inspect the APK/AAB's actual `versionName` and `versionCode`; match them to the
approved package and release record before upload. Android's
[versioning requirements](https://developer.android.com/studio/publish/versioning)
explain the distinction between these two fields.

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

The client starts reCAPTCHA Enterprise App Check asynchronously without blocking
React startup whenever `VITE_APP_CHECK_SITE_KEY` is set. Authenticated API
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

## Open authentication, restricted membership

People may register through email, Google or verified Telegram without an
invitation. A new self-service account has `accountRegistrationType: "open"`
and `accountAccessStatus: "awaiting_trainer"`. Authentication alone must not
unlock workouts, nutrition, measurements, private media or member APIs.

A trusted invitation acceptance or administrator trainer assignment activates
membership. Verify both the waiting screen and server/Rules denial before
activation; do not disable self-service providers as an invite-only workaround.

Telegram authentication uses the server-owned `telegramIdentities` registry.
Legacy client profile fields alone are not proof of identity. An affected
existing client can sign in using its existing credentials and reconnect
Telegram. If that is unavailable, a verified administrator can issue an explicit
one-time recovery link for the original client UID and independently checked
Telegram owner. Recovery codes expire after ten minutes and are stored hashed
in server-only `telegramLinkCodes`; never put them in client-readable profiles.

## Protected exercise media

Before deploying a build that removes public Hosting videos, run
`node scripts/sync-protected-exercise-videos.mjs --apply` with the release
operator's Firebase CLI session. The script verifies existing object hashes,
refuses overwrites and uploads local source videos to the private bucket.
Keep original local assets for DEV fixtures; deployment artifacts omit video
files. Validate the private bucket and runtime signBlob permission with
`node scripts/inspect-production-auth-compatibility.mjs`; it outputs only
aggregate health checks, never credentials.

All application video elements use `ProtectedExerciseVideo`. New uploaded
exercise-video records store `gs://` references; the authenticated access
endpoint verifies membership and allowed paths, removes permanent Firebase
download tokens, and returns a fifteen-minute inline signed URL. The service
worker deletes legacy video caches and does not cache protected media. Existing
downloaded bytes cannot be revoked, and signed URLs/watermarks are not DRM.

After publication, `node scripts/smoke-protected-video-production.mjs --run`
creates one isolated temporary client identity, checks the real waiting-screen
login, denied pending/private access and signed byte-range playback, then removes
the identity, profile and its rate-limit records. It sends no Telegram messages
and does not modify real users. Review its cleanup report in `artifacts/`.

## Participant notice and support-led data requests

The public operational notice is `/privacy.html` (`public/privacy.html`). Links
are available before Telegram/Google/email registration and from account
settings. This is not a claim of completed legal review: the responsible
operator, verified contact, response deadlines, category-specific retention and
provider terms still require confirmation. Do not invent those details or treat
access controls alone as a privacy policy. Obtain the appropriate review before
admitting participants whose information depends on the unresolved terms.

The current support path is participant → known trainer → administrator, using
the team's existing verified working channel. Unassigned/pre-registration users
must obtain that channel from the inviting trainer/team. No automated email,
export or deletion is triggered by opening the notice.

For each request, the administrator must:

1. Record a request reference and the requested action in the team's restricted
   support log. Verify the account holder through an existing authenticated or
   independently verified channel; never ask for a password, session token or
   Telegram login code. Do not place user records or identity documents in this
   repository, public artifacts or a shared chat.
2. Confirm scope: account/profile, training plans and history, nutrition and
   personal food/recipe records, weight/measurements, photos/avatar, messages,
   reminders/Telegram linkage, and local drafts or unsent queues. Distinguish
   third-party records, shared-library objects and operational security records
   from the participant's own content. Explain the planned outcome and timing;
   no fixed completion deadline is established by this runbook.
3. For a copy, gather only the verified participant's authorized records and
   owned files from Auth/Firestore/Storage through approved admin tooling. Review
   the output for unrelated clients, trainer-only materials, credentials, tokens
   and password hashes; none belong in a participant export. Deliver through an
   agreed private channel, confirm receipt, and record handling of the temporary
   export. Do not upload it to public Hosting or a public bucket. This is a
   manual process, not a claim that a comprehensive export endpoint exists.
4. Before deletion, offer a copy if requested, confirm consequences and scope
   with the participant, and check for outstanding writes/uploads on their
   devices. Use the existing admin-only full client deletion workflow; do not
   replace a failed protected deletion with partial browser-side deletion.
   Verify its result across Auth, the user's Firestore tree, owned Storage
   prefixes, Telegram identity/linkage and pending reminders/queues. Existing
   server cleanup/tombstone records can require restricted retention or retry;
   do not call the operation fully complete while cleanup remains pending.
5. Agree how the participant will clear local drafts/queues and account data on
   each device, after any requested synchronization/export. A server operation
   cannot certify erasure of offline devices, downloaded files, delivered
   Telegram messages or copies held by external AI providers. Explain those
   boundaries instead of promising instant universal deletion.
6. Check whether backups actually exist, their scope/access/expiry and any
   provider-held data relevant to the request. Record what remains, why, and the
   verified expiry or follow-up path; do not invent a retention period. Preserve
   an access-restricted deletion record so an approved restore does not silently
   reintroduce deleted accounts/data.
7. Confirm the completed and outstanding actions to the participant and record
   the operator, scope, result and required follow-up in the restricted log.
   Validate the procedure with one synthetic identity across Auth, Firestore,
   Storage and local queues before claiming operational acceptance. Opening a
   link or passing source tests is not that rehearsal.

## Backup and restore

Backup costs/provisioning are deferred: this change authorizes no new resource,
schedule, export, retention change or billable restore. The agreed planning
target is a daily recovery copy with 35-day retention, not monthly copies for a
year. Existing infrastructure state is unverified here; this is not proof that
backups are either enabled or absent. Record that limitation in beta sign-off.
Do not store backup exports in a public Hosting or app-upload bucket.

1. Inventory any existing Firestore/Auth/Storage backup configuration and name
   an operator. Estimate daily export/storage and recovery cost, scope and
   permissions before requesting a separate provisioning approval. Do not
   enable billing or create a bucket/project as part of a web release.
2. After separate approval, implement a daily full Firestore recovery export
   with an approved controlled job and a private restricted destination.
   Firebase documents the required billing,
   bucket and scheduling prerequisites in its
   [scheduled export guide](https://firebase.google.com/docs/firestore/solutions/schedule-export).
3. Configure and verify the approved 35-day daily-copy retention, lifecycle
   rules and budget alerts; do not add annual/monthly tiers without approval. Firestore
   exports are billed per document read and are not an instantaneous snapshot;
   account for both when choosing cadence. See the
   [Firestore export/import reference](https://firebase.google.com/docs/firestore/manage-data/export-import).
4. Plan protection of owned Storage files separately: Firestore exports do not
   include them. Inspect existing soft-delete/versioning settings and estimate
   cost before proposing changes. Object versioning alone
   does not protect against deletion of the whole bucket. See
   [Cloud Storage versioning](https://cloud.google.com/storage/docs/object-versioning)
   and [lifecycle management](https://cloud.google.com/storage/docs/lifecycle).
5. Plan Firebase Auth recovery on the same daily/35-day target in an encrypted
   restricted location, following the Firebase CLI
   [`auth:export` reference](https://firebase.google.com/docs/cli). Treat its
   password-hash configuration and export file as sensitive credentials.
6. Once a recovery copy and explicit test authority exist, rehearse a restore
   with synthetic accounts in an already approved isolated recovery environment,
   never production. If none exists, request approval rather than creating one.
   Verify Auth identity, client/trainer/admin boundaries, Firestore history and
   owned Storage files, plus suppression of previously deleted accounts and
   pending notifications. Record recovery-point age, measured RPO/RTO, operator,
   source copy, costs, cleanup and result. A planned daily job is not evidence
   of a successful restore or a promised 24-hour RPO.

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

After the 3.0.850 subscription-ledger cutover, **never restore the old accounting
handlers or delete/rebase the server-only ledger/config**. A generic known-good
tag is not sufficient: any corrective deployment must preserve generation-keyed
idempotency, the immutable cutover and the maintenance barrier. Use the phased
[3.0.850 migration record](AUDIT_REMEDIATION_3.0.850.md#safe-deployment-order),
pause writes when necessary, and verify balances/ledger compatibility before
resuming. Existing balances were preserved rather than historically recounted.

After every rollback, record the version, exact targets, operator, reason and
post-rollback smoke result.
