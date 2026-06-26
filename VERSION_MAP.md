# VERSION MAP

## Overall Goal

Keep two project versions side by side so future changes can compare, copy, or branch from either one without overwriting the other.

## V0

- Name: `V0-original`
- Location: `versions/V0-original/`
- Meaning: original GitHub repository snapshot cloned from `https://github.com/ml18290620463-afk/vector-life-design-guide.git`
- Use: reference baseline before the latest local mobile/Now-module changes.

## V1

- Name: `V1-current`
- Location: project root, this directory.
- Meaning: current local working version with the latest mobile Now-module changes.
- Use: active development version.

## Rule

- Do not edit `versions/V0-original/` unless explicitly creating a new V0 patch.
- Continue feature work in the project root as V1, or create a separate new version from either V0 or V1 when needed.
