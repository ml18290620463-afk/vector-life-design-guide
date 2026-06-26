# End-to-end testing conventions

> Last updated: Phase 4 §W4.1.

## Selector hierarchy (in order of preference)

1. **`data-testid`** — Stable, explicit, immune to copy / i18n /
   re-styling. **Always reach for this first.**
2. **`getByRole(...)` with `name` regex** — Acceptable when the
   button is genuinely accessible by name (proper ARIA / native
   label) and the name is stable across locales. Use a regex with
   the Chinese AND English variant when the label depends on
   `language`.
3. **`getByText(...)`** — Reserved for assertions on user-facing
   copy that's intentionally part of what we're checking
   (e.g. confirming a localised heading renders), NOT for clicking.
4. **`getByPlaceholder(...)`** — DEPRECATED for new tests. Always
   add a `data-testid` to the input instead.
5. **CSS selectors (`page.locator('button[title="…"]')`)** —
   STRICTLY DEPRECATED. They couple the test to internal styling
   and break on any class refactor.

## Adding a new testid

- Naming convention: kebab-case, namespaced by feature.
  - `cover-initialize`, `cover-version-terminal`
  - `onboarding-next`, `onboarding-password`, `onboarding-star-musk`
  - `dashboard-new-entry`, `dashboard-open-archive`
  - `editor-title`, `editor-content`, `editor-save`
  - `viewer-back`
  - `entry-card-${id}` (per-row)
  - `command-palette`, `command-palette-input`,
    `argon2id-toggle`, `morning-star-loading`,
    `morning-star-streaming-preview`
- `CyberButton` (and other polymorphic primitives) propagate
  `data-testid` through every render branch — always pass it as a
  prop instead of inserting a wrapper element.
- For lists, append the row id (`entry-card-${entry.id}`); always
  pull stability from the data, not from the index.

## When to back-fill a testid

- **Always** when migrating an existing e2e selector off CSS /
  placeholder / role-name.
- **Often** when adding a new interactive surface (toggle, button,
  input).
- **Rarely** for purely decorative containers — those should be
  selected via their interactive child instead.

## Why this matters

The pre-Phase 4 e2e suite leaned heavily on
`getByRole('button', { name: /曲速引擎|warp/i })` patterns. Every
copy edit risked a green build flipping red. Worse, the Chinese
i18n strings made the tests opaque to non-Chinese readers. Switching
to testids:

- Stops i18n / styling churn from breaking specs.
- Makes the `e2e/` suite scannable: every testid maps 1:1 to a
  feature-namespaced source location.
- Lets us add `data-testid` to internal mocks (cmdk, share-card,
  Argon2id toggle) with zero runtime cost — `data-*` attributes
  are stripped from the production HTML by the browser's
  rendering path and only surface in the DOM tree, not in user
  experience.

The migration was kicked off in `feat(e2e): W4.1 add data-testid
attributes …` — see git log for the full rollout.
