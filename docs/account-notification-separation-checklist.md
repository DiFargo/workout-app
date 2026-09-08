# Account connections and notification settings — 3.0.697

## Acceptance checklist

- [x] Cabinet actions open distinct sheets: account connections and notifications.
- [x] Connections retain email and Telegram management, including nested return navigation.
- [x] Notifications contain only the real Telegram reminder preference, with connected/disconnected states.
- [x] Saving reports pending, success and error; failure restores the previous value; signed-out requests do not mutate settings.
- [x] Scheduled workout and progress reminders honor current and legacy opt-outs; existing schedule and deduplication remain intact.
- [x] Mobile layout, focused logic tests, syntax, production build and bundle budget pass.
- [x] Publish Hosting and only the affected reminder scheduler; verify the production release.

No authentication, account-linking API, role, trainer/admin access, workout, nutrition or history behavior is removed. Existing private-message and in-app notification flows are unchanged. Automated test delivery uses local doubles only.

Verification: 22 focused Node tests passed; all 8 selected mobile UI cases passed (two test-only timeout/selector fixes were rerun). Layout checked at 375×667, 320×568 and 844×390; notification and connection screenshots reviewed. The known Windows Playwright server teardown hang was stopped after all cases completed. ESLint: zero errors, one pre-existing `Date.now` purity warning in the general harness. Functions syntax, production build, deployment artifact and 62.02 KiB initial-entry budget passed.

Published to [production](https://tren-85720.web.app/?release=3.0.697): Hosting and `telegramDailyWorkoutReminders` in `europe-west1` completed successfully. Production HTML returned 200; all 19 checked assets matched the local build by SHA-256. Invalid invitation returned 404 and the notifications preference route rejected read-only GET with 405, as expected. No user preferences were changed and no test notifications were sent.
