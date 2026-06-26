# Security Policy / 安全策略

## Reporting a vulnerability / 报告漏洞

If you believe you have found a security issue in VECTOR, please **do not**
open a public GitHub issue, post on social media, or share details in a
public chat. Instead:

1. Email a description (and ideally a proof-of-concept) to the maintainer
   listed in `package.json` `author` field. Use PGP if you can.
2. Allow up to **14 days** for an acknowledgement, and up to **90 days**
   for a coordinated disclosure window.
3. We will credit you in `CHANGELOG.md` once a fix is shipped, unless you
   request anonymity.

请**不要**在公开 issue / 社交媒体 / 群聊里直接披露。请通过 `package.json`
中 `author` 字段邮箱（条件允许请使用 PGP 加密）告知我们，承诺 14 天内
确认、90 天内协同披露。

---

## In scope / 漏洞范围

- The Express AI proxy (`server.ts`, `server/aiProxyAuth.ts`,
  `server/promptEnvelope.ts`).
- Cryptographic primitives in `services/securityService.ts`.
- Browser storage and migration logic in `hooks/useDiaryData.ts` and
  `services/diaryStorage.ts`, `services/diaryMigration.ts`.
- The default Dockerfile / docker-compose / nginx sample under `deploy/`.
- Markdown / attachment rendering surface (`components/viewerMarkdown.tsx`,
  `components/ViewerAttachmentPanel.tsx`, `components/PdfAttachmentViewer.tsx`).

## Out of scope / 不在范围

- Vulnerabilities in third-party services we proxy to (OpenRouter, Google
  Gemini) — please report to those providers directly.
- Issues that require physical access to an unlocked device.
- Self-XSS where the user is also the attacker (typing `javascript:` URLs
  in the address bar).
- DoS that requires sustained network amplification beyond a single user
  account.

---

## Hardening references / 加固参考

- `EVALUATION.md` §8 for the rolling threat-model summary.
- `ROADMAP.md` "Phase 1 — Public Beta Readiness" §1.1 for the security
  invariants we intend to keep green; `scripts/check-beta.sh` enforces
  them in CI.
- For dependency vulnerabilities: `npm audit --omit=dev` should be run
  before any release.

---

## Disclosure timeline / 披露时间线

| Day             | Action                                                 |
| --------------- | ------------------------------------------------------ |
| 0               | Vulnerability received; triage starts.                 |
| ≤ 14            | Acknowledged with severity assessment.                 |
| 14 – 90         | Patch developed, tested, and shipped (`CHANGELOG.md`). |
| 90 (or earlier) | Coordinated public disclosure.                         |

If you are an active user of a self-hosted instance, you may also receive
a notice through the same channel you used to report.
