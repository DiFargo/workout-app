# Template clarity — 3.0.851 (prepared, not published)

## Scope and acceptance checklist

- [x] Replace the inconspicuous explanation with a separate bordered card:
  “Шаблон — не план клиента”, with an 18 px heading and 16 px body.
- [x] Explain that assignment creates a separate client copy, which can be
  personalized in the client's plan.
- [x] Use “Шаблоны программ”, “Создать шаблон”, “Создать общий шаблон”, and a
  visible “Общий шаблон” editor label on the actual trainer UI.
- [x] Preserve creation, editing, assignment, ownership, authentication, roles,
  and navigation behavior. This iteration changes presentation, not domain logic.
- [x] Verify the real component at 320 px and 402 px widths; inspect saved mobile
  screenshots of the library, creation sheet, and editor.
- [x] Pass scoped lint, build, artifact isolation, bundle budget, and focused tests.
- [ ] Publish Hosting to Staging and run the opt-in live template-purpose smoke.
- [ ] Rebuild for Production, publish Hosting, run live smoke, and observe release
  health according to the release procedure.

## Local evidence (2026-10-19)

- 52/52 focused tests passed: template-purpose React DOM, trainer navigation, and
  the live smoke runner's offline tests.
- Existing trainer workspace E2E: 2/2 passed across the selected browser projects.
- Existing trainer visual E2E: 2/2 passed. An additional mobile run after making
  screenshot attachments persistent also passed (1/1).
- Scoped ESLint and `git diff --check` passed.
- Fresh Staging and Production builds passed, including environment markers and
  bundle budgets. No development harness assets were included in release output.
- Screenshots are saved under `output/playwright/template-851/`:
  `trainer-program-library-v2.png`, `trainer-program-create-sheet-v2.png`, and
  `trainer-program-constructor-v2.png`.

The current `dist` marker is **Staging**, project `tren-85720-staging`, version
`3.0.851`. It must not be deployed to Production; build Production again first.

## Publication blocker

The user explicitly approved immediate Production publication. Multiple normal
escalation requests were rejected before execution because the automatic
permission-review service reported: “Selected model is at capacity.” This is a
review-service failure, not a finding that the deploy is unsafe or a lack of user
consent. No alternative path was used to bypass the approval check.

On 2026-10-19, after the user requested another attempt, the exact Staging
Hosting-only command was retried through the normal escalation path. The review
service returned the same capacity error before process creation. That retry
also made no cloud changes; further user consent is not the missing prerequisite.

Neither the attempted Staging Hosting deployment nor a Production deployment ran.
The last confirmed published version remains **3.0.850**. No live smoke or
post-release observation for 3.0.851 has been performed. Local fixture results are
not evidence of a live deployment or real-device Telegram verification.

## Resume after permission review is available

1. Verify the exact Staging artifact marker and deploy **Hosting only** to
   `tren-85720-staging`.
2. Run the existing owned-account live smoke with `--template-purpose`, expected
   version `3.0.851`; preserve its cleanup and secret-safe reporting.
3. Build a fresh Production artifact; verify project `tren-85720` and version
   `3.0.851`, then deploy **Hosting only**.
4. Repeat live smoke with explicit Production confirmation and complete release
   health observation. Record actual results before calling the release complete.

Do not redeploy Functions, Rules, Storage, IAM, or subscription ledger migrations
for this cosmetic iteration. Preserve the previous release's data and safeguards.
