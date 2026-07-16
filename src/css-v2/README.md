# CSS V2 preview

- Production CSS stays in `src/styles/` and is served at `/`.
- CSS V2 rules belong only in this directory and are served at `/cssV2`.
- The app logic, Firebase data and authenticated session are shared by both URLs.
- During the staged rewrite, scope new rules with `html[data-css-variant="v2"]`.
- Do not edit `src/styles/`, JSX, Firebase code or user flows while working on CSS V2.
- Do not use broad `!important` overrides. Recreate each screen with scoped V2 selectors.

The current stylesheet remains as a compatibility base until every screen has a V2 counterpart. Once the visual comparison is complete, the CSS entrypoint can switch to V2 only without changing application code.
