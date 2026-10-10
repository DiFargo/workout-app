# Release 3.0.797 — explicit slider defaults

## Acceptance checklist

- [x] Every fresh quiz slider has a real selected answer matching its initially displayed option: general fitness, beginner, gym, one session per week, 30 minutes.
- [x] Next is enabled without manipulating the slider; selected labels, accessibility values and review answers agree.
- [x] Valid saved answers take precedence. Quick-workout preferences do not leak into the long-plan questionnaire. Existing plans are not rewritten.
- [x] Restrictions and medical status are not assumed absent. The restriction step still requires explicit input.
- [x] Existing emphasis defaults, deliberate choices and the compatible 3+3+1 suggestion remain unchanged.
- [x] 23 focused unit tests and 12 Chromium/WebKit UI tests passed, including untouched defaults, editing, review, saving, small/landscape screens and keyboard navigation.
- [x] Primary visual check at 402 × 874; targeted lint, production build, bundle budget and artifact validation passed.

Runtime scope is limited to questionnaire draft defaults. Firebase data, functions, rules, roles, navigation and media are unchanged. Only Hosting is published.

Published and smoke-checked on 2026-09-16: the production assets match the verified build, login renders at 402 × 874 without runtime errors/overflow, and anonymous/invalid-token API requests remain rejected. Evidence: `artifacts/deploy-3-0-797-readonly-smoke.json`, `artifacts/deploy-3.0.797-gemini-smoke.json`, `artifacts/deploy-3.0.797-browser-smoke.json`. No authenticated production generation or client-data writes were performed.
