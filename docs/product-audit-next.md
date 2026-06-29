# Product Audit Backlog

Last updated at app version `v.1.412`.

## Evidence

- `npm.cmd run build`: passed.
- `npm.cmd run check:bundle`: passed.
- `npm.cmd test`: passed with `212` passed.
- `npm.cmd run lint:critical`: passed.
- `npm.cmd run test:e2e`: passed with `35` passed and `1` skipped.
- `npx.cmd playwright test tests/e2e/client-nutrition-visual.spec.js --project=mobile-chromium`: passed with `3` passed.
- `npx.cmd playwright test tests/e2e/client-primary-visual.spec.js --project=mobile-chromium`: passed.
- `npx.cmd playwright test tests/e2e/admin-visual.spec.js`: passed with `4` passed.
- `npx.cmd playwright test tests/e2e/client-ai-coach-visual.spec.js`: passed with `2` passed.
- `npx.cmd playwright test tests/e2e/client-primary-visual.spec.js`: passed with `2` passed.
- `npx.cmd playwright test tests/e2e/client-nutrition-visual.spec.js --project=mobile-chromium`: passed.
- `npx.cmd playwright test tests/e2e/client-workout-visual.spec.js`: passed with `6` passed.
- `npx.cmd playwright test tests/e2e/trainer-visual.spec.js`: passed with `2` passed.
- Harness audit covered mobile and desktop variants for:
  - client main;
  - client workouts;
  - client nutrition;
  - client cabinet;
  - trainer dashboard;
  - trainer clients;
  - trainer messages;
  - trainer programs.

No horizontal overflow was detected in the harness audit for the checked screens.

The client primary visual audit now attaches screenshots for:

- client main dashboard;
- client cabinet;
- cabinet workout history modal;
- cabinet measurements modal.
- cabinet nutrition modal.
- cabinet workout calendar modal.
- cabinet progress photos modal.
- cabinet settings modal.
- cabinet trainer notifications modal.
- cabinet Telegram management modal.

The cabinet nutrition modal audit also guards readable day labels and today/current-date semantics for its weekly nutrition calendar.
The cabinet Telegram modal audit also guards the contained dialog shell and backdrop semantics.
The cabinet measurements modal audit also guards readable labels for the latest measurement value cards.
The cabinet progress photos modal audit also guards readable labels for the comparison photo-session selectors.
The cabinet settings modal audit also guards readable labels for the profile goal and activity selectors.

The admin visual audit now attaches screenshots for:

- admin panel hub;
- admin access denied state.
- admin users CRM harness;
- admin programs overview harness.

The nutrition visual audit now attaches screenshots for:

- nutrition main screen;
- food search;
- food search results;
- product amount screen;
- product edit sheet;
- My Database;
- calendar modal;
- diary modal;
- nutrition analysis modal.
- AI photo not-found modal.
- create product/dish choice modal.
- custom dish editor, ingredient picker and ingredient confirm modal.

The nutrition visual audit also guards the weekday strip labels, readable Russian action labels, marker geometry, selected day state, calendar selected day state and today/current-date semantics.

The client workout visual audit now attaches screenshots for:

- workout plan cards;
- next workout card after swipe;
- workout mode modal;
- workout history modal;
- empty assigned plan state.
- workout draft restore dialog.
- workout readiness dialog.
- post-workout feedback dialog.

The client AI Coach visual audit now attaches screenshots for:

- AI Coach overview;
- AI nutrition onboarding;
- generated AI nutrition plan with adapted-day state.

The trainer visual audit now attaches screenshots for:

- trainer dashboard;
- trainer clients;
- trainer client card;
- trainer messages;
- trainer programs.

## P0

No current P0 runtime blocker is known after the `v1003` E2E stabilization.

## Done

1. Client workouts title now reads as `Индивидуальный план` in E2E text extraction.
2. Trainer clients, messages and programs screens now expose one primary `h1` in E2E checks.
3. Client bottom navigation has a stable `client-bottom-nav` test id and `clientBottomNav` class for future audits.
4. Trainer mobile navigation uses stable semantic test ids for the More drawer and Programs entry.
5. Trainer workspace has a screenshot-based visual audit for dashboard, clients, messages and programs.
6. Trainer compact action buttons, message filters and mobile route header buttons keep stable 40px tap targets.
7. Client workout plan cards and workout modals have screenshot coverage and stable 40px tap targets for compact controls.
8. Client main dashboard and cabinet have screenshot coverage with bottom navigation and card spacing checks.
9. Admin panel hub has DEV-only harness coverage, screenshot coverage and a stable 40px back target.
10. Admin lazy CSS cleanup started by removing the redundant `admin.css` alias file.
11. Trainer lazy CSS cleanup continued by removing the redundant `trainer.css` alias file.
12. Core CSS entrypoint cleanup removed redundant `themes.css` and `client-main.css` alias files.
13. Core CSS entrypoint cleanup removed redundant `layout.css` and `components.css` grouping files.
14. Nutrition product flow coverage now catches food search results, product amount/edit surfaces and My Database.
15. Nutrition product meal selector and edit close button now keep stable tap/click targets in the deeper visual audit.
16. Nutrition CSS cleanup removed an older duplicated product/edit action-bar block after the deeper visual audit covered both surfaces.
17. Client workout visual coverage now includes the empty assigned plan state for safer workout empty-state CSS cleanup.
18. Client workout empty-state CSS now has one scoped owner after old global legacy duplicates were removed.
19. Client cabinet workout history modal now has screenshot coverage, and its delete action keeps a stable 44px tap target.
20. Client cabinet measurements modal now has screenshot coverage, and its close action keeps a stable 44px tap target.
21. Client cabinet nutrition modal now has screenshot coverage, accepts string date keys in nutrition planning helpers, and keeps close/goal/week controls at stable 44px tap targets.
22. Client cabinet workout calendar modal now has screenshot coverage, and its close/month/edit/save controls keep stable 44px tap targets.
23. Core CSS cleanup removed four import-only legacy stack aggregators; `index.css` imports the same child files directly and the CSS graph guard was updated.
24. CSS cleanup removed the remaining import-only light, nutrition and admin stack aggregators from active style entrypoints.
25. Client cabinet progress photos modal now has screenshot coverage for the upload steps and save action.
26. Nutrition week strip now keeps weekday labels separated from day markers, with a visual audit geometry guard.
27. Client cabinet settings, trainer notifications and Telegram management modals now have screenshot coverage and stable close/action tap targets.
28. Admin users CRM and programs overview internals now have DEV-only harness screenshot coverage with tap-target and overflow checks.
29. Admin internals CSS now loads through `admin-internals-lazy.css`, keeping the production admin hub CSS chunk lightweight while preserving harness coverage.
30. Admin hub CSS split is guarded structurally so heavy CRM/program imports stay out of the production admin entrypoint.
31. Mobile login smoke now waits past the auth bootstrap fallback window, reducing false failures when Firebase auth is slow to resolve.
32. Nutrition food-search/product polish CSS now loads from the nutrition lazy stack instead of the core app stylesheet.
33. Nutrition AI photo not-found modal now has screenshot coverage and lazy-owned CSS.
34. Mobile login smoke now allows slow cold auth bootstrap runs that can take about 31 seconds in Playwright mobile.
35. Nutrition create product/dish choice modal now has screenshot coverage and tap-target checks.
36. Nutrition custom dish ingredient flow now has screenshot coverage from dish editor through ingredient confirmation.
37. Nutrition flow CSS now loads from the nutrition lazy stack instead of the core app stylesheet.
38. Nutrition orbit CSS now loads from the nutrition lazy stack instead of the core app stylesheet.
39. Nutrition week strip now uses unambiguous two-letter weekday labels and keeps marker sizes guarded in the visual audit.
40. Nutrition warm-light add-food/search cleanup CSS now loads from the nutrition lazy stack instead of the core app stylesheet.
41. Dark-green nutrition food-flow CSS now loads from the nutrition lazy stack instead of the core app stylesheet.
42. Client workout visual audit now waits for the harness bottom navigation before clicking, reducing cold-start timeout flakes.
43. Client harness, nutrition visual and primary visual audits now wait for client bottom navigation before route clicks.
44. Trainer workspace and trainer visual audits now wait for trainer navigation controls before route clicks.
45. Client workout flow late CSS now loads from the workout lazy stack instead of the core app stylesheet.
46. Client workout run polish and exercise notes CSS now load from the workout lazy stack instead of the core app stylesheet.
47. Client workout navigation/close and set-row CSS now load from the workout lazy stack instead of the core app stylesheet.
48. Client AI Coach now has harness visual coverage for overview, AI nutrition onboarding and generated plan states before deeper mixed AI CSS cleanup.
49. AI nutrition training-day buttons now keep stable mobile tap targets in the AI Coach onboarding state.
50. AI Coach route CSS now loads through `ai-coach-lazy.css` instead of the core app stylesheet, with structural guards covering the lazy import.
51. Nutrition AI plan and AI photo process CSS now load through `nutrition-ai-plan-lazy.css` in the nutrition lazy stack instead of the core app stylesheet.
52. Workout draft/readiness/post-workout dialogs now have visual coverage and lazy-owned CSS in the client workout stack.
53. Nutrition food icon editor and training-day calorie highlight CSS now load through `nutrition-food-icon-lazy.css` in the nutrition lazy stack.
54. The former mixed AI/nutrition/workout stylesheet was retired; its remaining core profile/first-setup rules now live in `legacy-profile-first-setup-core.css`.
55. Nutrition week day buttons now expose full-date accessible labels and selected state, guarded by the nutrition visual audit.
56. Cabinet Telegram management modal now exposes dialog semantics and an accessible close control, guarded by the primary visual audit.
57. Cabinet nutrition goal picker now exposes accessible goal labels and selected state, guarded by the primary visual audit.
58. Cabinet settings harness now renders the real app-settings section, and theme/Telegram controls expose accessible action labels and selected state.
59. Cabinet trainer notification items now expose task, status and due-date accessible labels, guarded by the primary visual audit.
60. Cabinet workout calendar date buttons now expose selected and current-date accessibility state, guarded by the primary visual audit.
61. Cabinet measurements modal start action now exposes an explicit accessible label, guarded by the primary visual audit.
62. Cabinet workout history expand and delete actions now expose workout-specific accessible labels, guarded by the primary visual audit.
63. Cabinet progress photo upload inputs now expose view-specific accessible labels, guarded by the primary visual audit.
64. Legacy trainer workspace bottom navigation now exposes active-page state with `aria-current`.
65. Trainer message filters now expose selected state with `aria-pressed`, guarded by trainer smoke and visual audits.
66. Trainer nutrition analytics period buttons now expose selected state with `aria-pressed`, guarded by trainer smoke.
67. Workout readiness choices now expose selected state with `aria-pressed`, guarded by the workout visual audit.
68. Workout mode picker choices now expose selected state with `aria-pressed`, guarded by the workout visual audit.
69. Nutrition portion selector choices now expose selected state with `aria-pressed`, guarded by the nutrition visual audit.
70. Nutrition food-search bottom bar tabs now expose selected state with `aria-pressed`, guarded by the nutrition visual audit.
71. Nutrition meal picker choices now expose expanded and selected state, guarded by the nutrition visual audit.
72. Nutrition product icon presets now expose selected state with `aria-pressed`, guarded by the nutrition visual audit.
73. Nutrition product portion unit toggle now exposes selected state with `aria-pressed`, guarded by the nutrition visual audit.
74. Trainer client card tabs now expose selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
75. Trainer workout library tab now exposes selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
76. AI Coach nutrition onboarding training-day and goal choices now expose selected state with `aria-pressed`, guarded by the AI Coach visual audit.
77. AI Coach feature cards now expose selected state with `aria-pressed`, guarded by the AI Coach visual audit.
78. Trainer workout day selector now exposes selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
79. Trainer client photo view tabs now expose selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
80. Trainer nutrition diary day buttons now expose selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
81. Client nutrition weekday strip now keeps compact equal mobile cells and bounded markers, guarded by the nutrition visual audit.
82. Trainer progress chart periods and exercise progress filters now expose selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
83. Admin harness filter pills, client cards, workspace tabs and program cards now expose selected state with `aria-pressed`, guarded by the admin visual audit.
84. Client cabinet progress photo compare tabs now expose selected state with `aria-pressed`, guarded by the primary visual audit.
85. Trainer message list items now expose selected state with `aria-pressed`, guarded by trainer workspace and visual audits.
86. Trainer notification reminder periods and workout calendar dates now expose selected state with `aria-pressed`, guarded by the trainer workspace audit.
87. Admin trainer-calendar day, hour-reminder and reminder toggle controls now expose selected state with `aria-pressed`, with the mobile calendar panel clamped against horizontal overflow under the admin visual audit.
88. First setup sex, activity and goal choices now expose selected state with `aria-pressed`, guarded by the client primary visual audit.
89. Profile body metric sex choices now expose selected state with `aria-pressed`, guarded by the client primary visual audit.
90. Production trainer admin user filters and client cards now expose selected state with `aria-pressed`, guarded by the app structure audit.
91. Client nutrition weekday labels now render as unambiguous uppercase two-letter abbreviations, guarded by the nutrition visual audit.
92. Production trainer dashboard filters and client rows now expose selected state with `aria-pressed`, guarded by the app structure audit.
93. Production trainer client workspace role toggle and tabs now expose selected state with `aria-pressed`, guarded by the app structure audit.
94. Client workout warmup timer presets now expose selected state with `aria-pressed`, guarded by the app structure audit.
95. Production trainer client training program cards now expose selected state with `aria-pressed`, guarded by the app structure audit.
96. Client workout next card now exposes current step state with `aria-current`, guarded by the app structure audit.
97. Legacy trainer dashboard client tabs now expose selected state with `aria-pressed`, guarded by the app structure audit.
98. Legacy trainer admin history bulk selection now exposes selected state and labeled workout checkboxes, guarded by the app structure audit.
99. Production trainer program overview cards now expose selected state with `aria-pressed`, guarded by the app structure audit.
100. Trainer mobile overflow navigation items now expose current-page state with `aria-current`, guarded by the app structure audit.
101. Trainer workouts page active program tab now exposes selected state with `aria-pressed`, guarded by the app structure audit.
102. Legacy trainer/admin action buttons now declare `type="button"` explicitly, guarded by the app structure audit.
103. Admin and access-denied navigation buttons now declare `type="button"` explicitly, guarded by the app structure audit.
104. All production JSX buttons now declare `type` explicitly, guarded by the app structure audit.
105. Client icon-only back, close and refresh actions now expose accessible labels, guarded by the app structure audit.
106. Profile legacy CSS is now owned by a client profile style entrypoint, guarded by the app structure audit.
107. Additional profile/cabinet legacy CSS is now owned by the client profile style entrypoint, guarded by the app structure audit.
108. Measurement legacy CSS is now owned by a dedicated client measurements style entrypoint, guarded by the app structure audit.
109. Client cabinet action cards now expose explicit accessible labels, guarded by the app structure audit.
110. First setup CSS is now owned by a dedicated client first-setup style entrypoint, guarded by the app structure audit.
111. Nutrition weekday strip now receives stable two-letter labels from the calendar model, guarded by unit and visual audits.
112. Workout flow CSS is now owned by the client workout lazy entrypoint, guarded by workout visual audits.
113. Exercise weight-mode CSS is now owned by trainer/admin internals style entrypoints, guarded by structure and trainer/admin visual audits.
114. Core workout CSS is now owned by the client workout lazy entrypoint, with standalone workout routes loading that entrypoint.
115. Food editor/search polish CSS is now owned by the nutrition stack, guarded by nutrition visual audits.
116. Nutrition header search, calendar and weekday action labels are now guarded as readable Russian text by structure and nutrition visual audits.
117. Basic workout quiz goal, experience and weekly workout selectors now expose readable labels under the app structure audit.
118. Trainer progress photo comparison selectors now expose readable labels under the app structure audit.
119. Trainer program assignment and nutrition preset selectors now expose readable labels under the app structure audit.
120. Trainer calendar reminder-before selectors now expose readable labels under the app structure audit.
121. Client nutrition weekday strip now preserves both letters of Russian day abbreviations on narrow mobile screens.
122. Trainer transfer, program, nutrition preset, workout status and overview modal selectors now expose readable labels.
123. Trainer, workout and first-setup modal dialogs now expose readable dialog names under the app structure audit.
124. Client visual unity CSS no longer keeps exact duplicate product-editor blocks from the older `v.1.100` cascade.
125. Client render target CSS no longer keeps the duplicate workout set-row `v127` block; the later `v126` owner remains guarded.
126. Admin, trainer and cabinet CSS cleanup removed empty media blocks and no-op duplicate layout rules under existing visual coverage.
127. Client workout card render CSS no longer keeps repeated media-only card sizing blocks; the root card locks remain guarded.
128. Client food search final CSS no longer keeps the older duplicate compact product title-wrap media lock; the later product header lock remains guarded.
129. Legacy nutrition header CSS now keeps one compact page padding owner instead of repeating the same mobile page padding across narrower breakpoints.
130. Admin CRM CSS no longer keeps older duplicate client card grid breakpoints; the later workspace breakpoint owner remains guarded.
131. Client food search final CSS now keeps one compact product meal-header width owner instead of repeating the same non-`:has()` mobile lock.
132. Client food search final CSS now keeps one compact product title font-size owner instead of repeating the same non-`:has()` mobile lock.
133. Nutrition calendar CSS now keeps final label color and footer sizing locks in the final calendar owner instead of repeating stale early values.
134. Client food search final CSS now keeps product title typography in the stable-flow owner instead of repeating stale early header locks.
135. Client food search final CSS now keeps product hero spacing and narrow mobile x-locks in their latest owners.
136. Admin calendar reminders CSS now keeps fixed back-label visibility in one root owner instead of repeating it in desktop media.
137. Legacy food search CSS now keeps hidden quick-action ownership in root rules instead of repeating the same hide rules inside narrow media blocks.
138. Nutrition food-search bottom bar CSS now keeps the photo active transform in one root owner instead of repeating it in narrow media.

## P1: Next Product Fixes

Done in `v.1.250`.

1. Nutrition screen remains the densest client screen.
   - Harness sees many buttons in the nutrition view.
   - Result: added a mobile visual Playwright audit for grouping, tap targets and modal entry points.
   - Result: fixed undersized diary modal controls and nutrition analysis modal close control to stable mobile tap targets.

## P2: Later Technical Cleanup

Started in `v.1.250`.

1. CSS bundle is still the largest structural debt.
   - Keep cleanup route-by-route, not by deleting legacy files blindly.
   - Start with nutrition or trainer screens only after screenshots/manual checks.
   - Status: nutrition cleanup continues under deeper visual coverage; older duplicate product/edit action-bar CSS was removed without blind file deletion.
   - Status: food-search/product polish CSS moved behind the nutrition lazy entrypoint after the nutrition visual audit covered those surfaces.
   - Status: AI photo not-found modal CSS moved behind the nutrition lazy entrypoint after adding modal screenshot coverage.
   - Status: broad nutrition flow CSS moved behind the nutrition lazy entrypoint after food search, create, photo fallback and custom dish screenshots were added.
   - Status: nutrition orbit CSS moved behind the nutrition lazy entrypoint after the nutrition visual audit guarded the main orbit screen.
   - Status: nutrition weekday labels now use `Пн`, `Вт`, `Ср`, `Чт`, `Пт`, `Сб`, `Вс` with marker-size guards in the visual audit.
   - Status: nutrition weekday cells now keep labels and markers centered in the visual audit.
   - Status: warm-light add-food/search cleanup CSS moved behind the nutrition lazy entrypoint under the existing nutrition visual audit.
   - Status: dark-green nutrition food-flow CSS moved behind the nutrition lazy entrypoint with structural guards preserving readable dark nutrition overrides.
   - Status: workout cleanup has started under the empty-state visual guard; legacy global empty-state duplicates were removed.
   - Status: client workout flow late CSS moved behind the workout lazy entrypoint after workout visual guards were stable.
   - Status: client workout run polish and exercise notes CSS moved behind the workout lazy entrypoint under the same guards.
   - Status: client workout navigation/close and set-row CSS moved behind the workout lazy entrypoint under the same guards.
   - Status: workout draft/readiness/post-workout dialog CSS moved behind the workout lazy entrypoint after adding dialog visual coverage.
   - Status: client AI Coach has visual coverage for overview and AI nutrition plan states, and its route-specific CSS is now behind `ai-coach-lazy.css`.
   - Status: nutrition AI plan/photo-process CSS is now behind `nutrition-ai-plan-lazy.css` in the nutrition lazy stack.
   - Status: nutrition food icon editor CSS is now behind `nutrition-food-icon-lazy.css` in the nutrition lazy stack.
   - Status: core legacy stack cleanup continued by removing import-only aggregators after client primary/nutrition/workout visual guards passed.
   - Status: light, nutrition and admin stack aggregators were also removed after client primary/nutrition, trainer and admin visual guards passed.

2. Add screenshot-based audit for key routes.
   - Current e2e confirms usability, not pixel quality.
   - Status: client main, client cabinet, cabinet workout history modal, cabinet measurements modal, cabinet nutrition modal, cabinet workout calendar modal, cabinet progress photos modal, cabinet settings modal, cabinet trainer notifications modal, cabinet Telegram management modal, client nutrition, client workouts, workout empty state, client AI Coach overview, AI nutrition onboarding, generated AI nutrition plan, trainer workspace, admin hub, admin users CRM harness and admin programs overview harness screenshot artifacts are covered.

3. Consider route-specific CSS loading later.
   - Do this only when a route already owns enough UI and styles to move cleanly.
   - Status: started for admin hub/internals, trainer workspace and core covered screens; entrypoints now import CSS directly where aliases or stack aggregators were redundant, with admin internals isolated from the production hub chunk.

## Recommended Order

1. Use `docs/production-smoke-checklist.md` for production smoke before and after deploy-risk changes.
2. Use `docs/css-cleanup-baseline.md` before route-by-route CSS cleanup.
3. Start CSS cleanup only from a route whose screenshots are already stable.
