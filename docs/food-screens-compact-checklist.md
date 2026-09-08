# Compact food screens — 3.0.698

## Acceptance checklist

- [x] Product detail is compact: meal selector, name/source, weight/portion, macros and edit action remain available.
- [x] Product creation, editing and dish creation share compact, labeled fields; no forced keyboard on opening.
- [x] Name/icon, all macros, portion unit/amount, dish weight, ingredients and description are retained.
- [x] Fixed/anchored headers and bottom actions retain safe-area CSS; one content scroll area; no doubled bottom inset.
- [x] Mobile/landscape layout, 44 px targets, data editing, portion calculations and ingredient workflows checked.
- [x] Focused tests, lint, build and bundle budget pass.
- [x] Publish Hosting only and verify production assets.

## Verification

- Four Playwright scenarios passed at 375×667, 320×568 and 844×390; reviewed rendered screenshots of all four screens. Physical iPhone keyboard/safe-area behavior was not device-tested.
- Nine focused nutrition model, presentation, totals and portion tests passed; changed JSX and test lint passed.
- Production build and Firebase artifact validation passed; initial entry gzip is 62.02 KiB / 100 KiB.
- Hosting release completed; production returned HTTP 200 and all 19 checked assets matched the local build, including nutrition JavaScript and CSS. Read-only invalid-invitation and notification-route smoke checks passed.
- No Functions deployment or user-data mutation was performed.

Scope: presentation and local UI fixtures only. Authentication, Firebase handlers, food persistence, nutrition calculations, search providers, user roles, navigation destinations and workout/history functionality remain unchanged.

## Follow-up: more comfortable spacing — 3.0.699 published

- [x] Increase card padding and section gaps moderately on product detail, creation and editing; retain their grouping and all controls. Keep the published new-dish layout unchanged, as explicitly requested.
- [x] Check the mobile/landscape workflows and review updated screenshots; build the final source.
- [x] Confirm publication choice and report the resulting delivery state accurately.

The four focused Playwright scenarios passed after limiting spacing changes to products. Reviewed all four screenshots, including the unchanged new-dish layout. Changed JSX lint, production build, bundle budget and Firebase artifact validation passed. After the user approved publication, Hosting-only deployment completed. Production returned HTTP 200 and all 19 checked assets matched the validated build; the read-only route smoke checks passed. No Functions deployment or user-data mutation was performed.

## Follow-up: weight / portion selector — 3.0.700 published

- [x] Align the two segment labels and use a consistent chevron.
- [x] Show portions inline without covering the amount field; remove duplicate weight text and retain all portion choices.
- [x] Verify selection, macro calculation, keyboard dismissal and mobile layout; build the final source.
- [x] Resolve publication choice and record delivery state.

Two focused Playwright scenarios passed, covering three viewport sizes, Escape dismissal, focus return, selection and live macros. The exact-weight and three named-size options retain one weight hint each. Reviewed the 375px rendered screenshot. Two portion-domain tests, lint, build, bundle budget and artifact validation passed. Following explicit approval, Hosting-only publication completed; HTTP 200 and 19 matching production assets verified. Other product blocks and the new-dish editor were not changed in this follow-up.

## Follow-up: meal selection header — 3.0.701 published

- [x] Remove the separator below this product header only; retain its fixed positioning and safe area.
- [x] Center the chosen meal with the same icon as its menu option and a consistent chevron.
- [x] Verify all four meal choices, keyboard dismissal/focus and mobile layouts; build the final source.
- [x] Publish Hosting after explicit approval and verify production assets.

The focused product workflow passed at 375×667, 320×568 and 844×390, including all four meal choices, matching icons, centered selection, Escape dismissal, focus return, portions and live macros. Reviewed the closed/open 375px screenshots. JSX/test lint, diff validation, production build and bundle budget passed. Following explicit approval, Hosting-only deployment completed; HTTP 200 and all 19 asset hashes matched the validated build. Read-only route smoke checks passed. The shared header, new-dish editor, data persistence and protected flows were not changed.

## Follow-up: portion dropdown alignment — 3.0.702 published

- [x] Show options directly below the Portion segment at its exact width, without a full-width lower strip or overlap of the amount field.
- [x] Remove the repeated generic Portion label; center the weight and retain meaningful size names and all choices.
- [x] Verify mobile alignment, selection, focus, calculation and reduced-motion behavior; build the final source.
- [x] Publish Hosting as requested and verify the served assets.

Two focused Playwright scenarios passed, covering exact segment/menu alignment at 375×667, 320×568 and 844×390, single-weight and named-size options, selection, focus return and live macros. Reviewed screenshots of the single and three-option menus. The brief reveal has a reduced-motion override, and tests ran with reduced motion enabled. Lint, diff validation, production build and bundle budget passed. Hosting-only deployment completed; HTTP 200, 19 matching asset hashes and the read-only route smoke checks passed. No shared headers, new-dish editor, domain calculations or protected flows were changed.

## Follow-up: matching add-food meal selector — 3.0.703 published

- [x] Reuse the approved product selector styles in Add food / My products, including the chosen icon, centered copy, chevron and dropdown options.
- [x] Remove only this header's bottom separator; keep all choices, close/toggle/Escape dismissal and selection persistence.
- [x] Verify narrow/landscape sheets and the search-to-product flow, review screenshots, lint and build.
- [x] Publish Hosting as requested and verify the served assets.

The focused add-food scenario passed at 375×667, 320×568 and 844×390: all four choices, matching icons, exact visual-style parity with the product selector, menu containment, toggle/Escape dismissal and persistence through product/back/My products. The existing product workflow also passed. Reviewed both closed/open mobile screenshots. Lint, diff validation, production build, bundle budget and artifact validation passed. Hosting-only publication completed; HTTP 200, 19 matching production asset hashes and read-only route checks passed. The product selector, portion selector, new-dish editor and protected domain/data flows were not modified.
