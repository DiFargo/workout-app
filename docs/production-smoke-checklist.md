# Production Smoke Checklist

Use this checklist for production URL checks before deploy decisions and immediately after deploys that touch routing, auth, Firebase sync, service worker, CSS, trainer flows or admin access.

Do not commit real passwords or private account credentials. Test account credentials must stay outside git.

## Setup

- URL: `https://tren-85720.web.app/`
- Open with a cache-busting query when checking a fresh release, for example `?verify=<timestamp>`.
- Confirm the visible app version matches the expected release version.
- If version is stale, hard refresh once and check that `/sw.js` and `/index.html` are not stuck on old cache.
- When App Check is enabled for the environment, confirm a protected `/api/...`
  action succeeds without a 401 and review the environment's App Check metrics.

## Client Smoke

Role: assigned client with an active trainer program.

Required checks:

- Login succeeds and no runtime error appears.
- Main dashboard opens and bottom navigation is visible.
- Workouts route opens the next unfinished workout.
- Workout cards do not flicker, overlap the bottom navigation or clip the start button.
- Start a workout far enough to verify exercise content, video area, previous data and bottom controls.
- Finish or cancel only when the test data can be safely changed.
- Nutrition route opens.
- Food search opens and closes.
- Add a simple known food only when test data changes are acceptable.
- Nutrition calendar opens and contains a full month grid.
- Measurement wizard/profile measurements open and latest saved values are visible.
- Cabinet opens and does not hide content behind bottom navigation.

Pass criteria:

- No white screen.
- No console runtime error.
- No horizontal overflow on mobile width.
- Version badge is current.
- Client progress remains consistent after refresh.

## Trainer Smoke

Role: trainer with at least one assigned client.

Required checks:

- Login succeeds and trainer dashboard opens.
- Only assigned clients are visible.
- Client card opens.
- Assigned program count and completed count match the client view.
- Workout schedule/status tab opens.
- Program editor opens and closes without losing data.
- Nutrition tab opens and shows client nutrition state.
- Messages modal opens, can draft a message and closes safely.
- Notifications/calendar tab opens and reminder controls remain usable.

Pass criteria:

- Trainer does not see unrelated users.
- Client/trainer workout totals match for the assigned program.
- No localStorage quota error.
- No console runtime error.

## Admin Smoke

Role: admin account with admin claim.

Required checks:

- Admin panel entry is visible only for admin.
- Admin hub opens.
- Clients and roles card opens the admin users area.
- Programs card opens program management.
- Trainer CRM card opens the trainer/admin CRM area.
- Denied state is shown for non-admin access attempts.
- Back to main works from the hub and denied state.

Pass criteria:

- Admin-only access is preserved.
- Non-admin users cannot reach admin functions.
- Admin navigation does not white-screen.

## After Smoke

Record:

- Date and exact URL/query used.
- App version shown in the UI.
- Client account label, trainer account label and admin account label.
- Any changed test data.
- Pass/fail for client, trainer and admin.
- Bugs found, with screenshots when visual.
- Error-reporting collector status and any release-version errors during the observation window.
- App Check status (`monitoring` or `enforced`) and any rejected request count.
- Backup/export job status (or the approved maintenance exception).
