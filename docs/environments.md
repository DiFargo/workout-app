# Firebase Environments

The application supports separate Firebase projects without source-code edits.
Production remains the default fallback until a staging project is connected.

## Local development

1. Create `.env.local` from `.env.example`.
2. Fill it with a dedicated development Firebase web-app configuration.
3. Run `npm run dev` only when interactive local testing is needed.

## Staging

1. Create a separate Firebase project in Firebase Console.
2. Copy `.env.example` to `.env.staging.local` and fill in the staging web-app values.
3. Add a Firebase CLI alias with `firebase use --add` and name it `staging`.
4. Build with `npm run build:staging`.
5. Deploy explicitly with `firebase deploy --project staging` after all checks pass.

## Production

`npm run build` and `npm run build:production` keep the existing production
configuration when no production environment variables are supplied. Production
deploys must always name the target explicitly:

```powershell
firebase deploy --only hosting --project tren-85720
```

## Safety rules

- Do not use production test accounts for automated write tests.
- Keep Auth, Firestore, Storage and Functions in the same environment.
- Deploy rules and Functions to staging before testing features that write data.
- Never commit `.env.local`, `.env.staging.local` or other `*.local` files.
- A Hosting preview is not isolated if it still points at the production Firebase project.
