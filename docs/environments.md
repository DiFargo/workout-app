# Firebase Environments

Every mutable environment must have its own Firebase project. Local development,
staging, browser E2E and production must never share accounts or data.

## Environment selector

Set `VITE_FIREBASE_ENVIRONMENT` explicitly:

| Value | Firebase configuration requirement |
| --- | --- |
| `development` | All six `VITE_FIREBASE_*` values are required and cannot identify `tren-85720`. |
| `staging` | All six values are required and cannot identify `tren-85720`. |
| `e2e` | All six values are required and cannot identify `tren-85720`. Playwright supplies safe placeholders. |
| `production` | Use only in a production build. The production configuration may use the bundled production fallback, but deployments still need an explicit project target. |

The application fails closed when a non-production environment is missing a
Firebase value or tries to use the production project. Do not work around that
check by copying production credentials into `.env.local`.

## Deployment artifact safety

`npm run build:staging` and `npm run build:production` write a small, ignored
marker at `dist/.workout-release.json`. Firebase Hosting does not publish that
file, but its `predeploy` hook verifies that the artifact's environment and
Firebase project match the deploy target. `npm run build` is an alias for the
production build.

`.firebaserc` deliberately has no `default` project. Always name the actual
Firebase project with `--project`; aliases are only a convenience for local
CLI use and must never make a bare `firebase deploy` safe by accident.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_FIREBASE_ENVIRONMENT=development`.
3. Add all six web-app values from a dedicated development Firebase project.
4. Run `npm run dev`.

## Staging

1. Create a Firebase project that is separate from production, including Auth,
   Firestore, Storage, Functions and Hosting.
2. Copy `.env.example` to `.env.staging.local`, set
   `VITE_FIREBASE_ENVIRONMENT=staging`, and add the staging web-app values.
3. Copy `functions/.env.example` to
   `functions/.env.<your-staging-project-id>` and set the staging values,
   including `FIREBASE_WEB_API_KEY`. Keep `APP_CHECK_ENFORCED=false` during
   App Check monitoring.
4. Run `npm run build:staging`, then prove the artifact target before any
   Hosting deployment:

   ```powershell
   npm run check:firebase-artifact -- --environment=staging --project <your-staging-project-id>
   ```

5. Deploy only with an explicit project ID, for example:

   ```powershell
   firebase deploy --only hosting,functions,firestore:rules,storage --project <your-staging-project-id>
   ```

The Hosting predeploy hook repeats the artifact check. Do not reuse a staging
`dist` directory for production; run `npm run build:production` immediately
before a production Hosting deploy.

## GitHub PR preview

The PR Hosting workflow is deliberately disabled until
`STAGING_FIREBASE_PROJECT_ID` is configured as a GitHub repository variable. It
deploys to staging only, never to `tren-85720`.

Configure these staging secrets before enabling it:

- `FIREBASE_SERVICE_ACCOUNT_STAGING`
- `STAGING_VITE_FIREBASE_API_KEY`
- `STAGING_VITE_FIREBASE_AUTH_DOMAIN`
- `STAGING_VITE_FIREBASE_STORAGE_BUCKET`
- `STAGING_VITE_FIREBASE_MESSAGING_SENDER_ID`
- `STAGING_VITE_FIREBASE_APP_ID`

Configure these repository variables as well:

- `STAGING_FIREBASE_PROJECT_ID` — the exact staging Firebase project ID;
- `STAGING_VITE_APP_CHECK_SITE_KEY` — the public reCAPTCHA Enterprise site key
  after the staging web app is registered for App Check.

Keep the service account restricted to the staging project. A Hosting preview is
not isolated when its built client points to production Firebase.

## Functions parameters and secrets

Use one file per Firebase project, such as
`functions/.env.workout-staging`, copied from
[`functions/.env.example`](../functions/.env.example). These files are ignored
by git. Keep secrets in Firebase Secret Manager (`TELEGRAM_BOT_TOKEN`,
`OPENAI_API_KEY`, `ADMIN_BOOTSTRAP_SECRET`), not in this file.

At a minimum, staging must set its own `FIREBASE_WEB_API_KEY`; otherwise the
invite activation page fails closed rather than talking to production Identity
Toolkit. Set `WORKOUT_APP_URL`, `FIREBASE_STORAGE_BUCKET`,
`INVITE_LOGIN_EMAIL_DOMAIN` and `TELEGRAM_WEBHOOK_URL` whenever the default
project-derived values are not the desired staging values. Never copy a
production value into the staging parameter file: the Functions runtime rejects
known `tren-85720` URLs, bucket names, webhook URLs and web API key values
outside production.

## Production

Production deployment is a manual release decision. Use a clean, tagged commit,
run `npm run verify`, complete the smoke checklist, then build a fresh
production artifact and name the exact project:

```powershell
npm run build:production
npm run check:firebase-artifact -- --environment=production --project tren-85720
firebase deploy --only hosting,functions,firestore:rules,storage --project tren-85720
```

Use the smallest `--only` scope that matches the approved release. Never deploy
rules, functions or data migrations by accident with a Hosting-only fix.

## Safety rules

- Do not use production accounts for automated write tests.
- Keep Auth, Firestore, Storage and Functions in the same environment.
- Deploy rules and Functions to staging before testing features that write data.
- Never commit `.env.local`, `.env.staging.local` or other `*.local` files.
- Never commit `functions/.env` or `functions/.env.<project-id>` files.
- Rotate any secret accidentally placed in a client environment file or CI log.
