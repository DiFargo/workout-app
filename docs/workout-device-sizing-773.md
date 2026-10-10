# Workout device sizing — 3.0.773

## Scope

One shared product appearance, not separate Android and iOS themes. The common
font stack now prefers the operating system font. Workout warm-up, exercise and
finish screens use relative text sizes, responsive gutters and content-driven
control heights. Other destinations retain their existing layout.

The iPhone 17 Pro logical viewport, 402 × 874, remains the primary reference.
Compact Android compatibility is checked at 360 × 800; 320 × 720 and landscape
874 × 402 are additional layout checks. These are browser emulations, not tests
on physical phones or native keyboards.

## Acceptance checklist

- [x] Keep the calm iOS appearance and the existing order of controls.
- [x] Use the system font without an OS-detection branch or blanket scaling.
- [x] Keep the workout scroller clear of the dock at default and 200% root text size.
- [x] Measure the dock with ResizeObserver, including wrapped navigation and rest timer.
- [x] Keep edit, exercise tools, rest controls and close targets at least 48 CSS px;
  the circular set confirmation stays 52 CSS px. These are web design choices,
  not a direct conversion from native pt/dp recommendations.
- [x] Preserve exact weight/repetition selection when wheel rows grow with text.
- [x] Preserve sequential set confirmation, video 4:3 framing and full original video.
- [x] Keep the finish comment reachable after the available viewport shrinks.
- [x] Leave questionnaire emoji, authentication, roles, assignment data and history unchanged.

## Verification

Focused browser tests cover Chromium mobile contexts, WebKit reflow, touch
scrolling with synthetic safe-area insets, set editing, navigation, and video
controls/cropping. Source checks include targeted ESLint, the production build,
bundle budget and whitespace checks. The normal-font previous-action label is
also checked against accidental single-letter wrapping.

Windows WebKit layout tests do not establish iPhone video-codec compatibility.
Native iOS/Android text scaling and on-device keyboard behavior should still be
checked on physical devices before making platform-specific exceptions.

Deployment is Firebase Hosting only; no Functions, rules or database migration
is part of this release. Read-only production smoke checks are recorded in
the versioned files under `artifacts/` after publishing.
