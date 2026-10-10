# Workout bottom content and WebKit scrolling — 3.0.763

## Confirmed cause

Mobile WebKit did not include the exercise flex scroller's end padding when the
card itself fit inside the scroller, but extended behind its fixed rest/navigation
dock. At 390 × 844 the history ended at 744 px and the dock began at 700 px, while
`scrollHeight` equalled `clientHeight`. Setting `scrollTop` had no effect. Chromium
included the inset and could scroll, so a Chromium-only check missed the defect.

The exercise deck now uses block flow internally. It remains the same flex child
of the fullscreen shell, with the same fixed dock and safe-area inset. WebKit now
includes the bottom padding in its scroll range. No touch-event workaround or
change to modal locking was needed.

## Compact layout

Exercise-only variables reduce row spacing, history padding, tool spacing and the
column-header inset. The title has slightly smaller vertical margins. The video
adapts to viewport height and safe areas, keeping its existing larger size when
there is enough space. Video containment and fullscreen controls are preserved.
Confirmation circles remain 52 px and edit targets remain 44 px.

## Acceptance checklist

- [x] WebKit regression reproduced the unreachable history before the fix and
  passed afterward; portrait and landscape scrolling remain available.
- [x] Three sets and previous result fit without scrolling at 375 × 812,
  390 × 844 and 430 × 932 with 47 px top / 34 px bottom safe-area emulation.
- [x] Six-set fixture at 375 × 667 reaches its bottom through actual emulated
  touch gestures, rather than only direct `scrollTop` assignment.
- [x] Full workout-flow E2E passes: warmup, exercises, timer/modal actions,
  completion and saved result across phone/tablet/desktop sizes.
- [x] Focused JSX/test lint and whitespace checks pass.
- [x] Production build and bundle budget.
- [x] Hosting publication and verification of the exact built assets; HTTP 200,
  matching JavaScript/CSS hashes and no-cache service-worker headers.

The E2E CI browser install now includes WebKit for this regression. No production
runtime dependencies were added.

All prescription counts, weights, workout/history data, Firebase rules, roles and
navigation handlers are unchanged. A six-set fixture is limited to the existing
client E2E harness. Physical iPhone acceptance remains distinct from local WebKit
engine testing and Chromium touch/safe-area emulation.
