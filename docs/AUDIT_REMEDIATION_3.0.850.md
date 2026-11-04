# Audit remediation — 3.0.850

## Кратко для владельца приложения

Версия **3.0.850 опубликована в Production**. Серверные и браузерные проверки прошли; заключительное наблюдение длилось более 30 минут. В доступных серверных журналах ERROR+ записей не найдено. Квотные сигналы остались без данных, а один финальный запрос мониторинга был ограничен по частоте — это не выдано за подтверждение отсутствия всех ошибок или достаточности квот. Ниже сохранены доказательства и границы каждой проверки.

- В тренерской библиотеке и окне создания явно указано: это **общий шаблон**. При назначении создаётся персональная копия, которую можно скорректировать под клиента.
- Исправлены подтверждённые ошибки из аудита: доступ и привязки, повторное списание занятий, изоляция клиентов, архив/календарь, редактирование программ, черновики, камера и синхронизация питания.
- Если тренера сняли, открытый сеанс клиента возвращается в ожидание назначения. История и данные сохраняются.
- Фото прогресса загружаются с проверкой доступа; постоянные публичные токены всех 24 существующих версий отозваны. Ранее скачанные копии отозвать невозможно.
- Текущие остатки занятий сохранены без пересчёта. В старой истории есть 15 записей без учётной метки: это не означает автоматически ошибку баланса и не даёт основания незаметно его менять.
- Резервные копии пока **только описаны в инструкции**, как было согласовано. Перед расширением пилота нужно определить ответственного за данные и рабочий контакт, сроки хранения, настроить мониторинг/оповещения и поэтапно проверить App Check в реальном Telegram. Эти пункты не выданы за выполненные.

Scope: recommendations from [the 18 October audit](APP_COMPREHENSIVE_AUDIT_2026-10-18.md), for a closed pilot of up to 100 clients. Existing unrelated working-tree changes are preserved. This record separates implementation, automated checks, deployment and operational work; none substitutes for the others.

## Acceptance checklist

- [x] Preserve client/trainer/admin roles, current assignment isolation, Firebase, Telegram, history, nutrition, measurements and navigation.
- [x] Implement bounded fixes for the confirmed audit findings and test the negative paths.
- [x] When a trainer is removed, restrict the client again without deleting history/data; stop retained media/recognition in the open session.
- [x] Passing release checks: lint, all unit tests, Rules/Storage emulator, Functions syntax, isolated builds, complete boot budget, dependency audits and browser scenarios (segmented corrective browser runs are disclosed below).
- [x] Staging deployment and live synthetic-account smoke.
- [x] Production phased migration, deployment, live smoke and >30-minute release observation, with the explicitly incomplete quota/429 monitoring signals recorded below.
- [x] Prepare backup/restore instructions only; do not provision paid backup/PITR resources.

## Implementation map

| Audit items | Change | Focused evidence |
| --- | --- | --- |
| SEC01 | Member admission before every basic AI plan provider branch | `remediation-security.test.mjs` |
| SEC02 | Generation-keyed, server-only subscription usage ledger; immutable cutover; retry-safe create/delete; client accounting markers blocked | `remediation-subscription-ledger`, `subscription-usage-sessions`, `remediation-ledger-migration`, actual-wrapper and Rules tests |
| SEC03 | Deletion verifies current UID ownership, including retry journals from older releases | `remediation-security.test.mjs` |
| SEC04–05 | Disconnect replaces destination map; outgoing messages require canonical ownership; delayed avatar refresh cannot restore an old binding | `remediation-security`, `telegram-avatar-deletion-race` |
| SEC06 | Private Storage paths, authenticated bounded blobs, auth-generation cleanup, token-removing finalize trigger and legacy-token migration | `private-progress-photo*`, `remediation-private-photo-protection`, `remediation-photo-migration` |
| SEC07–08 | Transactional current-assignment check for notification writes; current assignment required for private trainer notes; separate delete contract | `remediation-security`, Rules emulator |
| SEC09 | Server credential exchange returns only a custom token; no public alias→email resolution; bounded provider calls, principal/peer/global rate budgets | `login-alias-auth*`, `login-resolution`, actual-wrapper tests |
| TR01–02 | Consistent grouped-exercise ID remapping; scoped archive/restore identity and calendar restoration | `remediation-trainer.test.mjs` |
| TR03–05 | Fresh transactional calendar checks, no stale Telegram username fallback, paginated history exports with honest partial status | `remediation-trainer`, PDF/runtime tests |
| TR06–08 | Lossless structured admin program editor, honest clipboard/manual fallback, visible role-promotion failure | `remediation-admin.test.mjs` |
| TR09–10 | Archive filtering separated from active state; no success event after a failed subscription save | `remediation-trainer.test.mjs` |
| TR11–12 | Dormant legacy delete/transfer guards narrowed; no legacy UI enabled | `remediation-trainer.test.mjs`; legacy transfer remains client-side and is not a new supported server migration API |
| TR13–14 | Auth-epoch guards and session-separated caches; explicit unchecked-by-default resume for legacy frozen subscriptions | `remediation-trainer.test.mjs` and loader tests |
| CL01–06 | Photo AI auth/reset scope, late camera cleanup, comment draft restore/restart, offline history merge, personal-food deletion, per-view photo reads | `remediation-client*`, `remediation-photo-ai-reset`, async media tests |
| CLR01–03 | Visible-session nutrition refresh and returned-merge application; document-size guard retaining local pending edits; actual React timer/draft tests | Client and nutrition regression tests; 90-day synthetic JSON fixture is not an exact Firestore wire-size measurement |
| ARCH01–04 | Coordinator remains within its boundary; truthful gate docs; deduplicated mandatory-boot budget; history memo unaffected by clock ticks | `app-structure`, `remediation-architecture`, `remediation-workout-memo` |
| ARCH05–07 | Android metadata guard for a future native build; documented token ownership; public participant notice and support export/deletion runbook | `remediation-architecture`, `remediation-privacy` |
| VTA01–02, UX03 | 44px subscription action, truthful empty journal, clear account creation vs invitation entry | Admin/client DOM and browser checks |

## Safe deployment order

1. Pass the full local gate and build the exact staging artifact.
2. Publish hardened Rules first. A server-only `serverConfig/subscriptionAccounting.paused` flag temporarily blocks history and subscription SDK writes; local workout drafts remain intact.
3. Pause accounting and stop operator balance/history operations. Deploy the retry-enabled ledger handlers and the remaining tested Functions while the maintenance flag remains set; the new handlers retry until a ready, unpaused baseline exists.
4. Verify both ledger Functions are ACTIVE, their latest Ready revisions receive all traffic, and the deployed timeouts match. Allow at least that timeout after replacement for old in-flight requests, then obtain two stable projected observations. This is evidence of stability, not proof of a globally empty event queue, a database-wide lock or a backup.
5. Record a fixed server-clock cutover and preserve the existing balances. Never recompute manual balances from history or move the cutover on a retry. Resume only against the unchanged baseline and verified deployment; never redeploy the old accounting handlers after this point.
6. Add restricted Hosting-origin CORS before publishing authenticated-photo UI. Deploy Hosting and verify synthetic clients/trainers/admins.
7. Revoke permanent tokens only under `progress-photos/`, including older generations, with metadata preconditions and post-write verification. Do not delete images or overwrite unrelated metadata/CORS.
8. Repeat verified phases for Production, run isolated live smoke and observe error/quota signals. Retain exact results below `artifacts/remediation-3.0.850/`.

Operator commands are dry-run/read-only by default:

```powershell
node scripts/audit-remediation-preflight.mjs --project=tren-85720
node scripts/migrate-subscription-ledger.mjs --project=tren-85720
node scripts/migrate-private-progress-photos.mjs --project=tren-85720
```

Mutating phases additionally require `--apply --confirm-project=<exact project>` and their phase-specific acknowledgments. Review the scripts before execution. No backup/billing/IAM provisioning is hidden in them.

### Existing cycles without exact start times

Read-only preflight found three Production subscriptions whose cycle IDs are date-only legacy values, with no authoritative exact cycle-start record. The one-time `--accept-initial-cycle-baseline` option registers those exact current IDs in server-only config. It uses the cutover as **ledger activation**, not an invented historical start, and does not write a start date to client profiles. Pre-cutover records do not increment the preserved balance. A new renewal must generate a new cycle ID and a real boundary; never reuse one of these baseline IDs.

### Private-photo caveat

Revoking a bearer token invalidates that URL, not bytes already downloaded or copied. The authenticated renderer clears owned object URLs on auth changes, but cannot recall a screenshot or a file saved by a legitimate previous viewer. The finalize trigger is asynchronous; the application never requests a permanent download URL for a progress photo.

## Operational items deliberately not claimed complete

- Daily backup / 35-day retention / isolated restore are documented only, per the user's explicit no-new-expense decision. No paid backup or PITR setup is performed.
- App Check remains in monitoring/opt-in mode until real Telegram/browser token evidence exists. Do not enable enforcement blindly and lock users out.
- The public participant notice does not invent the legal operator, verified contact or retention commitments. Those require operator confirmation before a broader launch.
- An external error collector, billing/quota alerts and service headroom need actual configured destinations and operational ownership. A no-data metric is not a verified zero.
- No Android APK/AAB distribution or real-device Telegram certification is implied by a web release. The native version helper runs only for an authorized native build.
- Dormant legacy transfer remains disabled in current UI; its guard is not a durable server-side migration journal.

## Additional trainer clarification

The program library and creation dialog now explicitly describe a **general template**, not an individual prescription. Assignment creates a personal copy: working weights can be adjusted before assignment and further edits belong in the client's plan. Existing template creation, copying, editing, assignment and exercise-library actions are preserved.

## Verification evidence

- Final unit run including all release-operation and entry-measurement guards: **1,668 passed**, zero failed/skipped (`final-unit-release.log`); full lint, local documentation-link/anchor and whitespace checks passed (`final-lint-release.log`).
- The complete browser run initially returned 14 failures: date-dependent harness fixtures, outdated text/archived-filter expectations and one auth helper layout issue. Those were corrected without removing assertions; focused reruns cover every failed case. The aggregate is 627 passing non-skipped cases and 165 intentional viewport skips, not a claim that the initial monolithic command exited successfully (`browser-gate.log`, `browser-corrected.log`, focused trainer/client results).
- Firestore/Storage emulator: **59 passed**. Functions syntax, isolated staging/Production builds, complete boot budgets and root/all Functions dependency audits passed; dependency audits reported no advisories.
- Final Production artifact: entry 71.51 KiB gzip, mandatory boot 578.21 KiB / 640 KiB, Firebase core 159.55 KiB / 170 KiB, no E2E harness assets.
- A separate read-only published-entry lab baseline captured three fresh Chromium contexts and one same-context reload at 402×874. Cold median auth-entry readiness was 2,325.77 ms (range 2,106.33–3,693.09 ms), FCP 872 ms and observed LCP 2,276 ms; the single reload reached readiness in 1,652.89 ms with 42 resources served from cache. There were no page/guard errors. The test used an unthrottled desktop with service workers and external SDKs blocked; it is **not** field CWV, actual Telegram/iPhone performance or authenticated member cold boot. Resource bytes and gzip build budgets are different measurements (`production-entry-fa91155bcc821ce675f4f5e0.json`).
- Staging: real client/trainer/admin, alias custom-token login, usage create/delete and live removal-of-trainer checks passed (9/9), with owned test data removed.
- Staging photos: the first live attempt exposed missing service-agent cross-service Rules permission; the next exposed Firebase SDK bounded `getBlob()` dropping MIME. The narrow Staging-only permission repair and signature-validated MIME repair were applied and tested. The final live run passed upload/save/private metadata/reload/decoded blobs/exact-origin CORS/anonymous 403 for three images, with full cleanup (`staging-photo-live-pass.json`). Earlier failure evidence is retained.
- Read-only IAM/ACL inventory found no public principal grants in either default bucket/project or in all 24 existing Production photo versions (`private-photo-exposure.json`). Permanent bearer-token access is a separate migration obligation; this check does not prove its revocation.

## Production execution record

- Target: `tren-85720`, web/Telegram version **3.0.850**. Hardened Firestore/Storage Rules, all tested `functions:default`, then the exact Production Hosting artifact were deployed. `functions-telegram-auth` was not part of this release. Live `/sw.js` and index matched the artifact at **20:00:28 UTC, 18 October 2026**.
- The first Functions attempt stopped before source upload because GCS service-agent publication permission was missing. Automatic review refused the IAM repair until the human explicitly approved it. The subsequent narrow grant added only `roles/pubsub.publisher` (verified sole permission `pubsub.topics.publish`) for the exact existing GCS service agent; a full etag-protected policy readback verified preservation of other bindings (`production-storage-publisher-iam.json`, 32 → 33 bindings). The next Functions deployment completed.
- Accounting pause started at **19:48:42 UTC**, and was removed at **19:58:45 UTC** after deployment verification and stable baseline/resume observations. Both ledger handlers were ACTIVE, latest Ready revisions had 100% traffic, and both reported a 60-second timeout. The first baseline observation was more than 90 seconds after the latest Ready transition. This is bounded drain evidence, not proof of an empty external event queue.
- Fixed cutover: **2026-10-18T19:57:47.034Z**. The same fingerprint was observed before baseline and resume; all three legacy initial cycle IDs were registered. User documents, history and balances were not rewritten by migration. Existing balances are **preserved, not independently certified**; 15 unmarked historical records remain a separate reconciliation decision, not a hidden backfill.
- Real deployed mobile client/trainer/admin, alias login, ledger charge/refund and same-session removal-of-trainer smoke: **9/9 passed**, cleanup verified (`live-smoke-tren-85720-9577fb6a5292b1b1425a110f.json`).
- Real private-photo flow: three UI uploads → persisted private references → finalizer metadata → full reload with three decoded authenticated blobs → exact-origin CORS → anonymous 403 ×3; full owned-account/data cleanup verified (`production-photo-live-pass.json`).
- Protected video: **7/7 passed**, including unauthenticated/pending denial, bounded signed URL, 64-byte range playback, rejection outside the video scope, no legacy public Hosting video and unsigned Storage denial; cleanup verified (`protected-video-release-tren-85720-16d9b8c21ee7d3ed1047ca9a.json`).
- Public privacy notice, versioned service worker and Hosting security headers were verified live (`production-public-resources.jsonl`). The notice deliberately retains the unresolved operator/contact/retention caveats rather than inventing legal commitments.
- Only after authenticated photo acceptance, all **24 existing photo versions** had their permanent token metadata revoked and private cache policy verified. Inventory was complete; no skipped token-bearing objects, conflicts, unknown outcomes or verification failures. Independent readback found the same 24 versions, all private, **zero token keys** (`production-photo-token-migration.json`, `production-photo-readback.json`). Images were not downloaded or deleted by migration.
- Post-release observation covered **20:00:28–20:31:01 UTC** (more than 30 minutes), with intermediate observations retained. The final ERROR+ query completed with no matching entries. All four quota/429 metrics returned HTTP 200 with `no_data`, which does **not** prove zero failures or quota headroom; metric visibility can lag. The separate structured quota/429 log query was rate-limited in the final observation (also once earlier); the 15- and 20-minute queries had completed with no matching entries. This is an **observer query limitation**, not evidence of an application 429 and not a successful final quota-log check. The health script returned exit 2 to preserve that distinction (`production-health-final-30m.json`; intermediate `production-health-initial`, `-mid`, `-15m`, `-20m` records are retained). No API, quota or IAM changes were made to bypass it.

Firestore/Storage Rules are reviewed and tested controls, not a guarantee of security. Re-review the rules and operational settings before expanding the pilot.
