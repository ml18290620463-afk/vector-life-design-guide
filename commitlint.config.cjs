/**
 * Conventional Commits config — matches the style every existing
 * commit on this branch already follows (see `git log` for examples
 * like `feat(security): …` / `refactor(dashboard): …` / `docs: …`).
 *
 * Wired into the `commit-msg` git hook (see `.husky/commit-msg`) so
 * any local commit that doesn't follow the convention is rejected
 * before it reaches the remote.
 *
 * Extension over the @commitlint defaults:
 *   - `scope-empty: 0` — scope is OPTIONAL (we have docs / chore
 *     commits where adding a scope would be noise).
 *   - `header-max-length: 100` — the default 72 is too tight for the
 *     "feat(scope): one-sentence-with-detail" style we use; 100 fits
 *     all current commit subjects in the log.
 *   - `body-max-line-length: 0` — disabled. Long commit bodies are
 *     intentional documentation; cramming them into 100-char lines
 *     hurts readability when reviewed in `git log` / `gh pr view`.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [0, 'never'],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
    // Disable subject-case so we can keep mixed casing (e.g.
    // "W1.4 wire husky", "Sentry.metrics.distribution") that
    // matches our existing log style.
    'subject-case': [0],
  },
};
