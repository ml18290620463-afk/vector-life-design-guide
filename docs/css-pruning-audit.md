# Phase 1 CSS audit

`index.css`: 314,248 → 278,501 bytes (−35,747 bytes, −11.38%).
137 obsolete selector branches associated with the former onboarding were removed.

Method: parse CSS with PostCSS; check onboarding class names against tracked runtime
TypeScript/JavaScript sources, excluding tests and stories. Remove only branches whose
legacy onboarding classes have no runtime consumers. Preserve other selectors in mixed
lists and all ambiguous `:is`, `:where`, `:not`, `:has` branches. Shared MasterLock and
entry styling remains. This is a conservative source audit, not a claim that every
remaining selector is live. New onboarding owns its scoped stylesheet.

## Next module boundaries

| Target module        | Candidates                                          | Dependency to resolve first                     |
| -------------------- | --------------------------------------------------- | ----------------------------------------------- |
| Now                  | editor, tags, draft attachments                     | shared input and dialog tokens                  |
| Avatar               | chat, memory library, model settings                | mobile shell overrides and dialog primitives    |
| Past                 | archive cards, filters, timeline                    | shared record cards                             |
| Future               | guiding stars, action plans                         | shared action card variants                     |
| Mobile shell         | navigation, viewport/safe-area rules                | desktop/mobile selector precedence              |
| Entry and MasterLock | unlock, recovery, cover                             | shared onboarding ancestry and pseudo selectors |
| Shared foundation    | color/type/spacing tokens, inputs, buttons, dialogs | retain one ordered global entry point           |

Move one boundary at a time with screenshot and keyboard-flow regression. Remaining
legacy onboarding pseudo-selector branches need manual ancestry review before removal.
Avoid deleting selectors solely because a literal class search misses a dynamic class.
