# VERSION MAP

## Overall Goal

Keep the active project version unambiguous. Historical snapshots should live
outside the app source tree so lint, tests, and builds only inspect the current
application.

## Current Version

- Name: `v1.1.0`
- Location: project root, this directory.
- Meaning: current product baseline; the version matches `package.json` and the in-product label.
- Use: active development version.

## Historical Snapshots

- `versions/V0-original/` was removed from the app tree because it duplicated
  the full project and polluted lint/test runs.
- Recover historical baselines from Git history or an external archive instead
  of placing full source snapshots under this project root.
