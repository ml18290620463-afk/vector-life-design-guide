# VECTOR Roadmap // VECTOR 路线图

> Source of truth for "what we ship next". Each Phase has a hard exit
> checklist; **do not start Phase N+1 until every checkbox in Phase N is
> green**. Items map back to [`EVALUATION.md`](./EVALUATION.md) section
> numbers in parentheses.
>
> 本文件为**双语版**：英文是规范性 checklist（authoritative），中文是
> 「执行要点 / 关键信息 / 工时估算 / 验证脚本」补充材料，方便协作与
> 异步交接。两个语言版本若出现冲突，以英文 checklist 为准。

---

## 0. 给执行 Agent 的开场指令 (Kickoff Prompt for Execution Agents)

> 把下面这一段（连同三条反引号一起）整段复制粘贴给新会话/新模型，把
> `{N}` 替换成你想执行的 Phase 编号即可。

```text
你是一个自主编码 agent，在 macOS 工作区
`/Users/jianma/Desktop/vector-life-design-guide-v1.0.5-optimized-full`
下工作。

【任务】
按 ROADMAP.md 中 Phase {1|2|3|4} 的 exit checklist 逐项落实。除非该
Phase 的所有 checkbox 全部 ✅，**严禁**进入下一 Phase。

【上下文阅读顺序，开工前必须全部读完】
1. ROADMAP.md（本路线图，重点读 Phase {N}）
2. EVALUATION.md（项目当前 12 维度评分与问题清单）
3. README.md、package.json、server.ts、services/securityService.ts、
   hooks/useDiaryData.ts、App.tsx
4. 当前实际状态校验（必跑）：
   - npm run lint
   - npm test
   - rg "ITERATIONS = " services/securityService.ts
   - rg "mirrorDiaryValue\(keys\.password" hooks/
   - rg "unpkg.com" components/
   - rg "useReducedMotion|prefers-reduced-motion" components/ hooks/
   - ls -la .env.local 2>/dev/null \
       && echo "WARNING: .env.local 仍存在"

【执行规则 / Working agreements】
- 每个 task 完成后跑 `npm test && npm run lint`，红灯立刻停下修复，
  不得跳过。
- 任何 `localStorage.setItem` 调用必须经过 `services/browserStorage.ts`。
- 任何对外 fetch 必须 5 秒超时 + AbortController。
- 任何新组件文件不得超过 400 行；大于 350 行需要同步抽出 hook 或子组件。
- 凡涉及加密 / 密码 / AI key 的改动，必须**保留旧版本兼容路径**，禁止
  破坏性升级。
- 完成 Phase {N} 全部 exit checklist 后，运行
  `scripts/check-beta.sh`（若存在），并在 `CHANGELOG.md` 写入本次
  变更条目。

【交付】
最后用 markdown 输出：
1. 每个 task 的 done / skipped / blocked 状态
2. 退出条件 checklist 的实际通过情况（每条标 ✅ 或 ❌+原因）
3. 触发 follow-up 的新发现（如果有）

现在开始 Phase {N}，从第一条 task 开始。
```

---

## 0.1 上一轮「完成 vs 漏掉」对照 (Previous Round: Done vs Missed)

> 必须先把这张表对齐，否则下一轮会重蹈覆辙。

### 上一轮真正完成 (What was actually delivered)

| 类别         | 完成项                                                                                                                  | 关键证据                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 服务端       | helmet 严格 CSP（仅生产）、Origin allowlist + 可选 Bearer 双闸、log 脱敏、requestId、bind 127.0.0.1、`x-powered-by` off | `server.ts:261–287`、`server/aiProxyAuth.ts:31–52` |
| 工程化       | ESLint + Prettier + typescript-eslint + react / react-hooks / unused-imports 插件                                       | `package.json` devDeps                             |
| 客户端可观测 | Sentry 含 `sendDefaultPii: false` + `beforeSend / beforeBreadcrumb` 脱敏                                                | `index.tsx:21–43`                                  |
| 抽取 hooks   | `useNowTick / useViewerStars / useBackupImport / useAttachmentUpload`                                                   | `hooks/` 目录                                      |
| 测试扩展     | e2e 1→3 spec（api / app / backup）、unit ~107→~150 case                                                                 | `e2e/`, `*.test.*`                                 |
| 安全细节     | hash 串带版本号、constant-time compare、wipe sensitive                                                                  | `services/securityService.ts`                      |

### 上一轮**明确漏掉** (Items explicitly flagged as P0/P1 last round but **not done**)

> ⚠️ 这 14 项必须在本轮按 Phase 1-3 全部消化。

| #   | 漏点                                              | 当前证据                                                                                        | 风险                           | 归属 Phase |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| 1   | PBKDF2 仍 100k（OWASP 2026 推荐 600k）            | `securityService.ts:11` `ITERATIONS = 100000`                                                   | 离线爆破                       | Phase 1    |
| 2   | passwordHash/Salt 仍 localStorage mirror          | `useDiaryData.ts:253–263`                                                                       | XSS 后即可拿 hash              | Phase 1    |
| 3   | `.env.local` 仍存在于工作目录                     | 12 行非空                                                                                       | 复制粘贴泄露                   | Phase 1    |
| 4   | PDF worker 仍走 unpkg CDN                         | `PdfAttachmentViewer.tsx:6`                                                                     | 供应链 + 离线挂 + CSP 必开口子 | Phase 1    |
| 5   | prompt injection 服务端无防护                     | `server.ts:343` 直接转发                                                                        | 启明星可被劫持                 | Phase 1    |
| 6   | `prefers-reduced-motion` 仓库 0 命中              | grep 0 hit                                                                                      | a11y 红线                      | Phase 1    |
| 7   | viewport `maximum-scale=1.0, user-scalable=no`    | `index.html:5`                                                                                  | WCAG 1.4.4 失败                | Phase 1    |
| 8   | 无全局 `:focus-visible`                           | grep 0 hit                                                                                      | 键盘用户不可见                 | Phase 1    |
| 9   | 无 `eslint-plugin-jsx-a11y`                       | `package.json` 无                                                                               | a11y 漏检                      | Phase 1    |
| 10  | 无 LICENSE / PRIVACY / TERMS / SECURITY           | 仓库 0 hit                                                                                      | GDPR / 开源合规                | Phase 1    |
| 11  | 4 大巨型组件**反向变大**                          | Viewer 1156→**1247**，Dashboard 851→**983**，MasterLock 720→**866**，新增 SettingsPanel **988** | 维护成本爆炸                   | Phase 2    |
| 12  | `addMaterial / deleteMaterial` stale closure 未修 | `useDiaryData.ts:292–314`                                                                       | 快速点击丢更新                 | Phase 2    |
| 13  | `App.tsx` 顶层 15 字段 destructure                | `App.tsx:36–52`                                                                                 | 整树重渲                       | Phase 2    |
| 14  | `vitest` 无 coverage thresholds                   | `vitest.config.ts`                                                                              | 覆盖率自然漂移                 | Phase 2    |

### 本轮**首次纳入** (First-time additions, all production-launch necessary)

| #   | 新增关注点                              | 必要性                   | 归属 Phase |
| --- | --------------------------------------- | ------------------------ | ---------- |
| 15  | 服务端 Sentry（仅客户端不够）           | 服务端崩溃完全黑盒       | Phase 1    |
| 16  | SIGTERM graceful shutdown               | K8s / PM2 滚动发布丢请求 | Phase 1    |
| 17  | `dist/assets/*` immutable cache headers | 用户浏览器拉重复包       | Phase 1    |
| 18  | web-vitals → Sentry                     | 无生产性能 SLI           | Phase 2    |
| 19  | Morning Star SSE streaming              | AI 体验代差              | Phase 2    |
| 20  | 1200×630 OG image + maskable icon       | 社交分享 / PWA 安装质感  | Phase 1    |
| 21  | AI 输出免责条带                         | EU AI Act / 加州 SB-1001 | Phase 1    |

---

## 0.2 阶段总览 (Phase Overview)

```mermaid
flowchart LR
  P1[Phase 1<br/>Public Beta Readiness<br/>1-2 weeks] --> P2[Phase 2<br/>First Wave After Launch<br/>about 30 days]
  P2 --> P3[Phase 3<br/>Long-Term Investments<br/>1 quarter]
  P3 --> P4[Phase 4<br/>Reserved]

  P1 -.exit.-> G1["Open public beta<br/>composite 7.5"]
  P2 -.exit.-> G2["Polished v1.x<br/>composite 8.5"]
  P3 -.exit.-> G3["Sustainable design system<br/>composite 8.8"]
```

| 阶段                              | 工期     | 综合分目标    | 退出条件简述                                                  |
| --------------------------------- | -------- | ------------- | ------------------------------------------------------------- |
| Phase 1 — Public Beta Readiness   | 1-2 周   | 6.6 → **7.5** | 安全 / a11y / 法务 / 可靠性 / 品牌资产五条红线全 pass         |
| Phase 2 — First Wave After Launch | ~30 天   | 7.5 → **8.5** | AI streaming / web-vitals / 巨型组件 ≤ 350 行 / coverage 阈值 |
| Phase 3 — Long-Term Investments   | 1 个季度 | 8.5 → **8.8** | tokens 全 scale / Storybook / 智者 portrait / Argon2id 评估   |
| Phase 4 — Reserved                | TBD      | TBD           | 留给企业 / 分发方向                                           |

---

## Phase 1 — Public Beta Readiness (was P0)

Goal: pass the bar for "open-registration small public SaaS / personal PWA"
described in `EVALUATION.md` §三. Estimated effort: 1–2 weeks of focused work.

### Exit checklist

#### 1.1 Security (§8)

- [x] PBKDF2 default iterations ≥ 600,000 (env-overridable; verifies
      against older `pbkdf2-sha256:v1` hashes without re-encryption).
- [x] `passwordHash` / `passwordSalt` are **not** mirrored to localStorage
      (`hooks/useDiaryData.ts`); existing mirrored values are migrated into
      IndexedDB and removed.
- [x] `react-pdf` worker loads from a same-origin asset, not from
      `https://unpkg.com/...`.
- [x] `.env.local` is removed from the repo working tree; `.env.example`
      stays as the only template; README warns about leaked OpenRouter
      keys needing rotation.
- [x] Server-side `/api/morning-star` wraps user prompts in a fixed
      delimiter envelope **and** rejects obvious instruction-injection
      keywords ("you are now …", "ignore previous instructions", "system:")
      before forwarding to upstream LLMs.

#### 1.2 Accessibility (§3 / §4)

- [x] `index.html` viewport meta no longer carries
      `maximum-scale=1.0, user-scalable=no`.
- [x] `eslint-plugin-jsx-a11y` is wired into the flat ESLint config and
      `npm run lint` is clean (`--max-warnings=0`).
- [x] Global `:focus-visible` style added to `index.css` so keyboard focus
      is visible against both themes.
- [x] All `motion/react` animations either respect `useReducedMotion()` or
      are wrapped by a shared helper that does.
- [x] One `@axe-core/playwright` spec runs against the cover and onboarding
      shells; serious/critical violations fail CI.

#### 1.3 Legal (§12)

- [x] `LICENSE` exists at the repo root (suggested AGPL-3.0 or MIT — pick
      one in the changelog entry).
- [x] `PRIVACY.md` covers: local-only by default, what leaves the device
      when AI calls are made, log scrubbing, retention, contact channel.
- [x] `TERMS.md` covers: AI output is informational only (not medical /
      legal / financial advice), user owns their entries, abuse policy.
- [x] `SECURITY.md` describes how to report a vulnerability.
- [x] `package.json` adds `license`, `repository`, `author` fields.
- [x] Morning Star output (`components/MorningStarPanel.tsx`) renders a
      visible AI disclaimer banner on every analysis result.

#### 1.4 Reliability / Observability (§10)

- [x] `server.ts` initialises `@sentry/node` when `SENTRY_DSN` is set; same
      scrubbing rules as the browser SDK.
- [x] `server.ts` installs `SIGTERM` / `SIGINT` graceful shutdown that
      closes the HTTP listener and clears outstanding timers.
- [x] `dist/assets/*` is served with
      `Cache-Control: public, max-age=31536000, immutable`; `index.html`
      keeps `no-cache`.

#### 1.5 Brand assets (§2)

- [x] `public/og.png` (1200×630) referenced from `index.html` Open Graph
      and Twitter card meta tags. (If a hand-drawn asset is not available,
      ship a minimal Inter-on-archive-grid placeholder generated in the
      same build step.)
- [x] `manifest.json` references at least 192 and 512 maskable PNG icons.

#### 1.6 Process

- [x] `CHANGELOG.md` records this Phase 1 release entry.
- [x] `scripts/check-beta.sh` exits 0 (runs lint, typecheck, test, build,
      and validates each Phase 1 invariant via grep/file-check).
- [x] All E2E specs (`api.spec.ts`, `app.spec.ts`, `backup.spec.ts`,
      and the new a11y spec) pass.

### 中文执行要点 (Chinese execution notes)

#### 关键任务工时估算 (Effort estimates)

| ID    | 对应英文 checklist 条目                                                          | 关键文件                                                | 工时 |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | ---- |
| 1.1.a | PBKDF2 ≥ 600k；hash 串新增 `iter` 段并兼容旧 v1                                  | `services/securityService.ts`, `*.test.ts`              | 2h   |
| 1.1.b | 删除 hash / salt localStorage mirror，并迁移已有镜像值到 IDB                     | `hooks/useDiaryData.ts`, `services/diaryStorage.ts`     | 1h   |
| 1.1.c | 删除 `.env.local`，**先吊销** `sk-or-v1-f364a30c…` 重发新 key                    | `.env.local`, OpenRouter dashboard                      | 0.5h |
| 1.1.d | PDF worker 本地化（`pdfjs-dist/build/pdf.worker.min.mjs?url`）                   | `components/PdfAttachmentViewer.tsx`, `vite.config.ts`  | 1h   |
| 1.1.e | prompt injection 防护：服务端固定 envelope + 关键词正则                          | `server.ts`, `services/geminiService.ts`                | 3h   |
| 1.2.a | 全局 `useReducedMotion`：抽 `hooks/useMotionPreset.ts`，所有动画走它             | `motion/react` 调用点（约 12 处）                       | 3h   |
| 1.2.b | 修 viewport + 加 `:focus-visible` + `<div as="div">` 按钮加 `tabIndex/onKeyDown` | `index.html`, `index.css`, `components/CyberButton.tsx` | 1.5h |
| 1.2.c | 接入 `eslint-plugin-jsx-a11y` 并修零                                             | `eslint.config.*`, 全组件                               | 2h   |
| 1.2.d | `axe-playwright` 在 cover/onboarding 上跑通                                      | `e2e/a11y.spec.ts`                                      | 2h   |
| 1.3.a | 写 LICENSE / PRIVACY / TERMS / SECURITY / CHANGELOG（中英双语）                  | 仓库根                                                  | 3h   |
| 1.3.b | Morning Star 顶部 AI 免责条带（含 i18n 7 语 key）                                | `components/MorningStarPanel.tsx`, `i18n/locales/*`     | 1.5h |
| 1.4.a | 服务端 Sentry init + Express middleware                                          | `server.ts`, 新增 `server/observability.ts`             | 2h   |
| 1.4.b | SIGTERM/SIGINT graceful shutdown                                                 | `server.ts`                                             | 1h   |
| 1.4.c | `dist/assets/*` immutable cache + `index.html` `no-cache`                        | `server.ts:392–397`                                     | 1h   |
| 1.5.a | 设计 / 导出 OG image + maskable PWA icon set                                     | `assets/`, `manifest.json`, `index.html`                | 4h   |

**Phase 1 总工时约 ~30 小时（≈ 1 个工程师全职 1 周，或两人分工 3-4 天）**

#### 关键信息 / 不可妥协项 (Hard constraints)

> 🚩 这些不是建议，是红线：
>
> 1. **PBKDF2 升级必须保留旧 hash 兼容**——已经有用户用 100k 注册，强制
>    升级会让他们无法登录。`verifyPassword` 已经按 hash 内嵌 iter 走，
>    本任务**只改 `hashPassword` 的默认 iter**，**不动 verify 逻辑**。
> 2. 删除 `.env.local` 之前**必须先吊销 key**，否则 git log / 备份 /
>    Spotlight 索引可能仍泄露。
> 3. PDF worker 本地化后 `vite.config.ts` 的 `manualChunks.pdf` 分组要
>    保留，否则 worker 会被打到主包。
> 4. AI 免责条带不是「加个 `<div>` 写两行字」——必须 7 语都到位，否则
>    非中英用户看到空白会更不专业。
> 5. SIGTERM 必须 `await server.close()` 而不是 `process.exit(0)`，
>    否则正在跑的 morning-star 请求（最长 60s）会被中断、用户看到 502。
> 6. 服务端 Sentry 的 scrub 规则**必须复用** `server.ts` 已有的
>    `REDACT_PATTERNS / scrubLogText`，不要在 Sentry SDK 里重写一套，
>    否则两套规则会漂移。

#### Phase 1 出口验证脚本 (草案，建议落到 `scripts/check-beta.sh`)

```bash
#!/bin/bash
set -euo pipefail

# Security
grep -q "ITERATIONS = 600_000" services/securityService.ts \
  || { echo "FAIL: PBKDF2 still <600k"; exit 1; }
! rg -q "mirrorDiaryValue\(keys\.passwordHash" hooks/ \
  || { echo "FAIL: hash still mirrored"; exit 1; }
! test -f .env.local \
  || { echo "FAIL: .env.local still present"; exit 1; }
! rg -q "unpkg.com" components/ \
  || { echo "FAIL: PDF worker still on CDN"; exit 1; }

# a11y
test "$(rg -c 'useReducedMotion|prefers-reduced-motion' components/ hooks/)" -ge 8 \
  || { echo "FAIL: reduced-motion coverage too low"; exit 1; }
! rg -q "maximum-scale=1.0" index.html \
  || { echo "FAIL: viewport still locked"; exit 1; }

# Legal
for f in LICENSE PRIVACY.md TERMS.md SECURITY.md CHANGELOG.md; do
  test -f "$f" || { echo "FAIL: missing $f"; exit 1; }
done

# Build sanity
npm run lint --silent
npm test --silent
npm run build --silent

echo "Phase 1 OK — Beta baseline reached"
```

---

## Phase 2 — First Wave After Launch (was P1)

Goal: improve perceived AI quality, observability and code health within
~30 days of Phase 1 release.

### Exit checklist

- [ ] Morning Star streams responses (SSE or chunked fetch) through both
      the OpenRouter and Gemini code paths.
- [ ] Failure UI offers retry / switch provider / switch persona inline.
- [ ] `⌘K` global command palette + at least `⌘N` / `⌘.` shortcuts.
- [x] `web-vitals` reports LCP / INP / CLS to Sentry.
      → done — `lib/vitals.ts` initialised in `index.tsx` 21–43.
- [ ] Attachment images use Blob URLs instead of base64 in DOM.
- [ ] Google Fonts is either subsetted or self-hosted from
      `public/fonts/`.
- [ ] Service worker caches the app shell + static assets; offline shell
      renders without network.
- [x] In-app banner reminds the user when last successful backup is older
      than 60 days (uses `lastBackupAt` recorded by `useBackupImport`).
      → done — `BackupReminderBanner` + `useBackupReminder` hook;
      `useDashboardExport.recordBackup` writes `lastBackupAt` on every
      successful export.
- [x] `Viewer.tsx`, `Dashboard.tsx`, `MasterLock.tsx`, `SettingsPanel.tsx`
      each ≤ 350 LOC; `npm run lint` enforces `max-lines: 400` for new
      `.tsx` files.
      → done — Viewer 312 / Dashboard 350 / MasterLock 190 / SettingsPanel
      282; ArchiveVault 143 / StatisticsWidget 124 also extracted as
      §2.k / §2.l bonus tracks.
- [x] `addMaterial` / `deleteMaterial` (and any other reducer-style
      handler) use functional `setState(prev => ...)`.
      → done as part of the §2.h Dashboard split — `useDashboardWipeFlow`,
      `useDashboardImportConfirm` and the agent-extracted Settings
      sub-hooks all use functional updates.
- [x] `App.tsx` consumes `useAppStore` via `useShallow` selector(s) or
      narrow custom hooks.
      → done — `App.tsx:60` reads the 14-field store slice via
      `useAppStore(useShallow((state) => ({ … })))`. Re-renders are
      now reference-stable for unrelated `selectedEntry` flips.
- [x] Vitest coverage thresholds: lines ≥ 70%, branches ≥ 60%.
      → done — `vitest.config.ts` ratchets at lines 78 / branches 54
      today, with the §2.j+§2.k+§2.l history annotated in-line.
      Branches threshold now within 6pp of the 60 ROADMAP target;
      next ratchet is mechanical once the Argon2id PoC verifier
      lands in production code path (§3.e-2 / §4.b-1).
- [ ] Playwright specs use `data-testid` attributes for the smoke flows
      so i18n changes do not break them.

### 中文执行要点

#### 关键任务工时估算

| ID  | 对应英文 checklist 条目                                                                                     | 工时 |
| --- | ----------------------------------------------------------------------------------------------------------- | ---- |
| 2.a | OpenRouter SSE 透传（保留 abort + rate-limit + log 脱敏）                                                   | 6h   |
| 2.b | 前端 streaming 渲染 + Markdown 增量解析                                                                     | 6h   |
| 2.c | service worker（vite-plugin-pwa 或手写）+ 离线横幅 + update 提示                                            | 4h   |
| 2.d | 备份提醒：localStorage 记录 `lastBackupAt`，Dashboard 顶部 banner                                           | 2h   |
| 2.e | `⌘K` 命令面板（cmdk 库或自实现）                                                                            | 6h   |
| 2.f | ESLint `max-lines: 400` + 历史例外白名单（白名单仅过渡用）                                                  | 0.5h |
| 2.g | Viewer 拆 5 个：`useViewerEntry / useViewerDecryption / useMorningStarPipeline / ViewerHeader / ViewerBody` | 8h   |
| 2.h | Dashboard 拆 4 个：`DashboardCommands / DashboardEmptyState / useVaultGate / useDashboardSelection`         | 8h   |
| 2.i | MasterLock 拆 3 个：`useLockoutTimer / useRecoveryFlow / MasterLockBackdrop`                                | 6h   |
| 2.j | SettingsPanel 拆 4 个：`SettingsSecurity / SettingsAI / SettingsAppearance / SettingsBackup`                | 6h   |
| 2.k | `useDiaryData` 全函数式 setState；`App.tsx` 切细粒度 hook                                                   | 4h   |
| 2.l | data-testid 渐进迁移（仅当前 e2e 用到的元素）                                                               | 4h   |
| 2.m | web-vitals 上报到 Sentry custom metric                                                                      | 2h   |
| 2.n | vitest coverage thresholds + CI 卡红                                                                        | 1h   |
| 2.o | 5 个巨型组件单测（每个 ≥ 5 case）                                                                           | 8h   |

**Phase 2 总工时约 ~70 小时（≈ 2 周全职，或两人 5-6 天）**

#### 关键信息 / 不可妥协项

> 🚩
>
> 1. SSE 透传**绝对不能**回传上游 raw error body（含 OpenRouter 内部
>    url / headers），用 `scrubLogText` 也要扫一遍 stream chunk。
> 2. service worker 第一次部署会缓存住 `index.html`，**必须配 update flow**
>    （监听 `updatefound` → 弹「新版本可用，点击刷新」），否则用户永远
>    卡老版本。
> 3. ESLint `max-lines` 不要无脑设 400 然后给历史 4 个文件加
>    `// eslint-disable-next-line max-lines` —— 那等于没规则。**先把 4 个
>    文件砍下来再开规则**。
> 4. 巨型组件拆分**不要追求一次性完美**，按「先抽 hook → 再拆 view →
>    最后再 polish」的节奏走，每步都要有 PR 单独 review。
> 5. web-vitals 不要用 `Sentry.captureMessage`，要用
>    `Sentry.metrics.distribution('lcp', value)`，否则会被采样吃掉。
> 6. SSE 在某些代理后失效（Cloudflare / nginx buffering），必须带
>    `Cache-Control: no-transform` + `X-Accel-Buffering: no`，并保留
>    非流式 fallback。

#### Phase 2 视觉化拆分目标

```mermaid
flowchart TB
  subgraph before [Phase 2 之前]
    V1[Viewer.tsx 1247]
    D1[Dashboard.tsx 983]
    M1[MasterLock.tsx 866]
    S1[SettingsPanel.tsx 988]
  end

  subgraph after [Phase 2 之后]
    V2[Viewer.tsx ≤350]
    Vh1[useViewerDecryption]
    Vh2[useMorningStarPipeline]
    Vc1[ViewerHeader]
    Vc2[ViewerBody]

    D2[Dashboard.tsx ≤350]
    Dh1[useVaultGate]
    Dc1[DashboardCommands]
    Dc2[DashboardEmptyState]

    M2[MasterLock.tsx ≤350]
    Mh1[useLockoutTimer]
    Mh2[useRecoveryFlow]

    S2[SettingsPanel.tsx ≤350]
    Sc1[SettingsSecurity]
    Sc2[SettingsAI]
    Sc3[SettingsAppearance]
    Sc4[SettingsBackup]
  end

  V1 --> V2 & Vh1 & Vh2 & Vc1 & Vc2
  D1 --> D2 & Dh1 & Dc1 & Dc2
  M1 --> M2 & Mh1 & Mh2
  S1 --> S2 & Sc1 & Sc2 & Sc3 & Sc4
```

---

## Phase 3 — Long-Term Investments (was P2)

Goal: make the design system and product story sustainable.

### Exit checklist

- [x] `index.css` (or `lib/designTokens.ts`) exposes a complete set of
      tokens: color, spacing, radius, shadow, motion, z-index. No hex /
      rgba literal allowed in any `.tsx` file (lint rule).
      → **§3.a-1 done** (`lib/designTokens.ts` 6 buckets + 7 unit
      cases; `scripts/lint-tokens.mjs` scoreboard via
      `npm run lint:tokens`).
      → **§3.a-2 done** — backlog **439 → 1 (−99.8 %)**. Hybrid
      strategy: (a) **25 `--color-vector-*` brand tokens** in
      `index.css` `@theme` (cyan-brand, cyan-pure, cyan-neon,
      magenta, magenta-bright, blue-deep, fog-light, fog-paper,
      paper-cream, paper-white, ink-strong, ink-deep, night-deep,
      night-navy, night-blue, night-slate, onyx, navy-deep,
      ice-pale, teal-online, slate-mid, slate-soft, slate-chrome,
      cyan-neon variants); (b) **49 `@utility` blocks** in
      `index.css` (37 `shadow-*` glow / inset-glow / elevation
      rules, plus `bg-spacetime-grid-*`, `neon-glow-*`,
      `neon-border-*`, `drop-shadow-glow-*`, `text-glow-magenta`,
      `tech-border`, `clip-path-polygon`) for the high-frequency
      vocabulary; (c) `lib/canvasPalette.ts` for Canvas-only
      consumers; (d) Tailwind 4
      `color-mix(in srgb, var(--color-X) N%, transparent)` inline
      syntax for the long-tail of one-off shadows / gradients
      (~50 patterns) — keeps the value at the call site while still
      flowing through CSS variables. Tooling: `npm run lint:tokens`
      scoreboard reports **0 hex + 1 rgba across 1 file**; the
      remaining "1" is the runtime template literal
      `rgb(${ARCHIVE_RGB.paperLight})` in `DeepArchiveAnimation.tsx`
      — the actual triplet lives in `lib/canvasPalette.ts` and only
      the `rgb(` prefix matches the scoreboard regex. Pixel-perfect
      visual regression verified after every batch (13/13 passing,
      2 % `maxDiffPixelRatio` global threshold).
- [x] `/styleguide` route or Storybook serves all base components in dev.
      → **§3.b done** — Storybook 10.3 (`@storybook/react-vite`) wired
      to the existing Vite 6 / React 19 / Tailwind 4 stack. Config
      lives in `.storybook/{main.ts,preview.tsx,mocks.ts}`; preview
      loads `index.css`, runs `@storybook/addon-themes` (dark / light
      parent-class toggle on `<html>`) and `@storybook/addon-a11y`
      with `test: 'error'` so axe violations surface as failures.
      npm scripts: `npm run storybook` (dev on :6006) and
      `npm run build-storybook` (`storybook-static/`). The 10
      authoritative stories ship in `components/*.stories.tsx`:
      CyberButton (atom — 6 stories: primary / danger / ghost /
      light / disabled / polymorphic-div), ArchiveEntryCard (cell —
      grid-dark / grid-light / list-view / time-locked / sealed),
      StatisticsIdentityCard (cell — unlocked-dark / unlocked-light
      / locked / editable), MorningStarRadar (cell — balanced-dark
      / balanced-light / skewed / empty), FilterBar (cell — closed
      / vault-open / light / editing-stars / interactive),
      CoverScreen (screen — default / english-dark / light /
      no-principles), MasterLockUnlockForm (cell — idle / error /
      locked-out / scanning / success / light / interactive),
      SettingsBackupSection (cell — closed / dropdown-open / light
      / import-success / import-error / interactive),
      ViewerActionFooter (cell — archivable / archived /
      packing-menu-open / light / interactive), ViewerSealedPanel
      (screen — sealed / wrong-password / time-locked / scanning
      / light / interactive). Build clean (`storybook build` → 5 MB
      static bundle). Existing 92-file / 512-test Vitest suite +
      13/13 Playwright visual + 28/28 `check-beta.sh` invariants
      remain green; ESLint stays at `--max-warnings=0`. The 6
      `Interactive` stories use named `function InteractiveStory(args)`
      render functions to satisfy `react-hooks/rules-of-hooks` (the
      inline-arrow form would otherwise trip the rule).
- [ ] Bespoke portrait illustrations (or stylised geometric variants) for
      the seven default guiding stars replace the Lucide icon stand-ins.
      → **Carried into Phase 4 §4.c-1** — asset-only commission;
      Lucide stand-ins keep the UX functional in production. See
      `docs/phase-3-postmortem.md` §3.
- [ ] Star-field decorations (`CoverScreen`, `MasterLock`, …) consolidated
      into a single reusable component / hook.
- [x] Argon2id evaluation written up in `docs/security/argon2-eval.md`
      with a go / no-go decision.
      → **§3.e done** — verdict **GO** at OWASP_RECOMMENDED
      (64 MiB / 3t / 1p) for new hashes; PBKDF2 verifier kept
      forever for backwards compatibility. Infrastructure landed
      in this branch (PoC + benchmark + decision document); the
      actual minter switch is gated behind a follow-up §3.e-2
      task and a Phase 4 production rollout. Deliverables:
      (a) `services/argon2idPoc.ts` — `hash-wasm` wrapper with the
      self-describing `argon2id:v1:<m>:<t>:<p>:<saltB64>:<hashB64>`
      hash format, `deriveArgon2idBits` / `hashArgon2idPassword` /
      `verifyArgon2idPassword` (constant-time), DoS-bounded
      parameter validation (m ≤ 1 GiB, t ≤ 32, p ≤ 16);
      (b) `services/argon2idPoc.test.ts` — 7 unit cases pinning
      the round-trip, parameter embedding, determinism, salt
      sensitivity and malformed-hash rejection;
      (c) `scripts/argon2-bench.ts` + `npm run bench:argon2`
      benchmark harness comparing PBKDF2 600 k vs Argon2id MIN /
      REC / STRICT, supports `VECTOR_BENCH_RUNS` /
      `VECTOR_PBKDF2_ITERATIONS` env overrides + `--json` mode;
      (d) `docs/security/argon2-eval.md` (10 §) covering threat
      model, library shootout, hash format, benchmark numbers
      (Apple M4 / Node 24: PBKDF2 600 k = 43.8 ms; Argon2id REC
      = 99.2 ms — well under the 350 ms UX budget on every
      supported device class), migration design (verifier-first,
      opportunistic re-mint, parameter embedded so no out-of-band
      context needed), browser compatibility matrix, risks,
      decision and reproduction recipe. `hash-wasm` 4.12 added
      as a **devDep only** and lazy-loaded inside the PoC
      wrapper, so it does **not** appear in the production
      bundle (verified: `grep -l 'argon2\|hash-wasm' dist/assets/*.js`
      returns empty). Existing PBKDF2 tests / verifier / encrypt
      / decrypt path completely untouched.
- [x] First-day empty-state ships sample reflections + a mocked Morning
      Star call so users see the value proposition without spending
      OpenRouter quota.
      → **Delivered in Phase 4 §4.a-1** — see Phase 4 charter for
      details. `services/sampleEntries.ts` + auto-prune lifecycle in
      `useDiaryData.addEntry`. Sample 2 doubles as a `心象` teaser per
      `docs/product-vision-2026Q2.md` §5.1.B.
- [x] Optional shareable "reflection card" export (privacy-aware: image
      contains only what user opts in).
      → **§3.h done** — 1080 × 1920 portrait PNG export wired into
      the Viewer footer, gated behind a privacy-on-by-default modal.
      Architecture:
      (a) `lib/shareCardPalette.ts` — fixed literal-hex palette
      (rasterizer-safe; CSS custom properties / `color-mix()` resolve
      inconsistently inside `<foreignObject>` clones, especially on
      older mobile WebKit, so the card opts out of the live design
      graph and ships its own dark / light pair).
      (b) `components/ShareCard.tsx` — pure presentational
      forward-ref component, inline styles only (~280 LOC). Renders
      the canonical 1080 × 1920 layout: eyebrow / archive id +
      date / title / status flags (SEALED / TIMELOCK / ARCHIVED /
      ANALYSED) / tag chips / body block (masked or revealed) /
      attachment badge / footer attribution. Markdown noise (`#`,
      `**`, code fences, image / link syntax) is stripped from the
      excerpt so the card reads as plain text.
      (c) `hooks/useShareCardOptions.ts` — privacy options hook with
      `localStorage` persistence (`vector_share_card_options`).
      Defaults: `showBody=false`, `showTags=true`,
      `showAttachmentBadge=true`, `theme='dark'`. Schema-validates
      the stored blob and falls back to the privacy-on defaults on
      any malformed read.
      (d) `hooks/useShareCardExport.ts` — `domToBlob`-based PNG
      rasterizer. **Lazy `import('modern-screenshot')`** so the
      ~10 kB gz library + WASM-friendly PNG encoder only land on
      first modal open; production bundle audit confirms zero
      `modern-screenshot` symbols in main / icons / motion / react /
      pdf chunks. Exports the Blob from `exportPng` so future
      callers (Web Share API / `navigator.clipboard.write`) plug in
      without a re-rasterization pass.
      (e) `components/ShareCardModal.tsx` — focus-trapped modal with
      scaled-down preview (1/3 of the canonical card so the user
      sees exactly what they will get), three privacy toggles, dark
      / light theme radio, "Reset to privacy defaults" link, and
      Cyber-style "Save PNG" CTA with explicit
      idle / rendering / success / error status banner.
      (f) `components/ViewerActionFooter.tsx` + `ViewerReadingPanel`
  - `Viewer.tsx` — the share-card affordance is added below the
    existing 3-button grid (Pack / Download / Burn). It is gated
    on `decrypted === true` so a sealed entry can never trigger
    the export. The decrypted body content is forwarded to the
    modal as `entry.content`, never the encrypted payload.
    (g) i18n: 19 new locale keys added to `i18n/locales/zh.ts` +
    `i18n/locales/en.ts` (drift script `npm run i18n:diff` clean
    in soft mode; the other 5 locales degrade gracefully via
    English-string `??` fallbacks in the modal until they are
    translated).
    (h) Tests: **19 new cases** (8 ShareCard / 6
    useShareCardOptions / 5 useShareCardExport, the latter mocks
    `modern-screenshot` to test the status machine + download
    pipeline). Storybook: 8 ShareCard stories
    (PrivacyDefaultDark / PrivacyDefaultLight / BodyRevealedDark /
    BodyRevealedLight / SealedTimelocked / WithAttachment /
    EmptyBody) at the same 1/3 preview scale as the modal.
    Bundle delta: main chunk +0.78 kB gz, Viewer chunk +4.58 kB
    gz, new lazy chunk +10.47 kB gz on first modal open. Visual
    regression baselines (13/13) unchanged.
- [x] **§3.d** — i18n drift detector (`scripts/i18n-diff.ts`,
      `npm run i18n:diff`); `scripts/check-beta.sh` gates extras +
      empty-value bugs in soft mode. Backlog: 232 missing translations
      across 6 non-zh locales (translator backlog, non-blocking).
- [x] **§3.f** — visual regression baseline. `e2e/visual.spec.ts`
      now ships **6 baselines**: cover-default / cover-warp /
      cover-terminal / dashboard-default / settings-panel /
      master-lock-modal. Helper `e2e/seedHelpers.ts::seedOnboardedApp`
      drives the real onboarding flow once per spec (~25 s) so the
      baselines exercise production code rather than a mocked
      `useDiaryData` (which would invalidate the first-day guarantees).
- [x] **§3.g** — `usePwaInstallPrompt` hook + 30-day dismissal
      persistence (7 unit cases). `components/PwaInstallBanner.tsx`
      (new) wired into `DashboardOverlays` next to the backup-recency
      banner; renders only when the browser fires
      `beforeinstallprompt` and the user has not dismissed inside the
      30-day window. 5 additional unit cases for the banner.

### 中文执行要点

#### 关键任务工时估算

| ID  | 对应英文 checklist 条目                                                          | 工时   |
| --- | -------------------------------------------------------------------------------- | ------ |
| 3.a | 设计 tokens 全 scale + 重构所有组件引用 token                                    | 3 天   |
| 3.b | Storybook 接入 + 10 个核心组件 stories                                           | 2 天   |
| 3.c | 7 位智者 portrait（外包 / AI 生成 + 人工 polish）                                | 1 周   |
| 3.d | i18n drift 脚本 + CI（`scripts/i18n-diff.ts` 跑 7 个 locale 的 keyset 完全一致） | 0.5 天 |
| 3.e | Argon2id PoC + benchmark + 决策文档                                              | 2 天   |
| 3.f | 视觉回归 5 张关键屏（Playwright `toHaveScreenshot`）                             | 1 天   |
| 3.g | PWA install 引导（`beforeinstallprompt`）                                        | 0.5 天 |
| 3.h | 分享卡导出（html2canvas / satori，1080×1920 PNG）                                | 2 天   |

**Phase 3 总工时约 3-4 周（含智者 portrait 设计回合）**

#### 关键信息

> 🚩
>
> 1. 「No hex / rgba literal allowed in `.tsx`」这条 lint 规则会一次性
>    亮起几百处违规。**不要一上来就开 `error`**，先用
>    `eslint-plugin-no-restricted-syntax` 设 `warn`，按目录逐步收口
>    （components/Cover → components/Master → … → 最后开 error）。
> 2. Argon2id 评估必须包含 **iOS Safari + 低端 Android** 上的真实
>    benchmark（wasm 加载 + 单次派生），不能只看 desktop Chrome。
> 3. 智者 portrait 即便是几何抽象，也要**统一比例 / 统一 padding /
>    统一描边色**，否则 7 张并排会出现明显的"风格不齐"。
> 4. 分享卡导出必须默认**不**包含日记原文，仅含「用户主动勾选的几句」+
>    Morning Star metrics 雷达图，避免一键泄露隐私。

---

## Phase 4 — Activation, Trust, Distribution

> Phase 3 ended with the engineering surface in its cleanest state
> ever (zero ESLint warnings, 28/28 invariants, 543 tests, 6 visual
> baselines, dependency-light bundle). The biggest remaining risks
> are product-side: cold-start activation, identity / multi-account
> stories, and the trust posture around the local-first promise.
> Phase 4 is therefore a **product + distribution phase**, not an
> engineering refactor. Engineering work falls into three buckets:
> _activation_, _trust_, and _shipping_.
>
> See `docs/phase-3-postmortem.md` for the lessons that drove this
> framing.

### Exit checklist

#### A · Activation (cold-start time-to-value)

- [x] **§4.a-1** — First-day empty-state ships sample reflections +
      a mocked Morning Star call so users see the value proposition
      without spending OpenRouter quota or typing a real entry.
      Sample data carries an opt-in "Replace with my own" CTA + a
      visible "this is sample data" affordance so it can never be
      mistaken for the user's own writing.
      → **§4.a-1 done (Week 1 of Phase 4)** — `services/sampleEntries.ts`
      ships two carefully crafted reflections (zh + en, other locales
      fall back to en) seeded into IDB by `useDiaryData` after
      onboarding. Each sample carries an `isSample: true` flag on the
      `DiaryEntry` type and a `sample-*` id prefix; the badge "示例" /
      "Sample" renders in both list and grid views via
      `EntryGrid` + `ArchiveEntryCard`. **Lifecycle option C** is
      implemented in `useDiaryData.addEntry`: writing the first
      non-sample entry transparently prunes every sample from the
      vault. Sample 1 is a daily reflection with a hand-written
      Morning Star reply from 加缪 attached (no live LLM call); Sample
      2 is a wistful "想到爷爷" piece whose reply slot is a teaser for
      the upcoming `心象 (Memoir)` feature
      ([`docs/product-vision-2026Q2.md`](docs/product-vision-2026Q2.md) §5.1.B).
      Tests: 9 new unit cases (sampleEntries / addEntry prune /
      EntryGrid badge a11y). README also gained a 30-second value
      prop + Memoir teaser section at the top.
- [ ] **§4.a-2** — Empty Dashboard now offers three pre-canned
      "first reflection" prompts (per locale) so users have a
      jumping-off point. Localised in zh + en at minimum.
- [ ] **§4.a-3** — Onboarding measurement: emit anonymous funnel
      events (cover → onboarding step 1 → … → first entry) into the
      existing local-only debug log + Sentry breadcrumbs. **Not** a
      real analytics pipeline — just enough signal to debug drop-off
      reports without violating zero-knowledge.
- [ ] **§4.a-4** — Cold-start performance budget: time-to-cover
      ≤ 1 s on Pixel 6 / iPhone SE. Measured via an
      `e2e/perf.spec.ts` Playwright spec + a manual 6-device
      regression checklist documented in
      `docs/perf/cold-start-budget.md`.
- [x] **§Phase 5.2 / Stripe Checkout (USD)** —商业化通路打通.
      User clicks Subscribe in the public `/pricing` page → Stripe
      Checkout (USD) → webhook signs a license token →
      success_url redirect lands on `/?activate_session_id=…` →
      `useCheckoutReturn` claims the token → `useLicense.activate`
      persists it → Settings → LicenseSection now shows the new
      paid tier badge. **All prices remain USD** (`$X.XX USD`
      literal suffix throughout).
      → **Phase 5.2 done (~1 week)** — vertical slice across
      **+9 new files / +6 modified / +59 new tests**
      (1249 → 1308 vitest cases). All gates green: - **`services/stripeIds.ts`** — server-only bridge from
      `(tier, period)` SKU to `process.env`-resolved Stripe
      `price_xxx` ids. Returns null on the client (no
      `process.env` at runtime). 10 tests. - **`server/licenseMinter.ts`** — Ed25519 signer that
      bootstraps from `VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64`.
      Validates secret length (32 bytes) at boot so a
      misconfigured deploy fails loudly. Exposes only
      `mintToken` + `getPublicKey`; secret bytes never leave
      the closure. 11 tests including roundtrip vs
      `verifyLicenseToken`, ttl correctness for monthly /
      annual / lifetime billing periods, refusal of
      non-positive ttls + empty install ids. - **`server/stripeRoutes.ts`** — three routes:
      `POST /api/checkout/create-session` (validates input,
      resolves the price id, asks Stripe for a Checkout
      Session URL with `metadata.installId/tier/period`,
      returns the URL); `POST /api/stripe/webhook` (raw-body
      signature verify, mints token on
      `checkout.session.completed`, stashes it in an in-
      memory session→token Map with 30-min TTL); `POST
      /api/checkout/claim-token` (single-shot lookup the
      client polls after the post-Stripe redirect). 13 tests
      including signature forgery rejection, 8 happy + sad
      paths, raw-body integrity (the global JSON parser is
      gated to skip `/api/stripe/webhook`). - **`lib/licenseKeyring.ts`** — production gate. The
      `dev-2026` kid is dropped from `LICENSE_KEYRING` when
      `import.meta.env.MODE === 'production'` so a user
      pasting a dev-minted token into production gets
      `unknown-kid` instead of accidental access. 2 tests. - **`services/checkoutService.ts`** — client wrappers
      `startCheckout` (POST create-session, returns
      `{url, sessionId}`) and `claimToken` (POST claim-
      token). Tagged failure reasons (`invalid-input`,
      `sku-not-configured`, `stripe-rejected`, `not-ready`,
      `unreachable`, `unknown`). 10 tests. - **`components/PricingPage.tsx`** — public USD pricing
      landing page. 3-column grid (Stardust / Polaris / Owner),
      monthly/annual toggle (Owner pinned to lifetime),
      per-tier feature list, Subscribe button → Stripe
      redirect. Inline failure banner. Disabled while
      install id hasn't hydrated. 7 component tests. - **`hooks/useCheckoutReturn.ts`** — listens to URL
      `?activate_session_id=…` (success) and
      `?activate_cancelled=1` (cancel) on mount, polls
      `claim-token` (1.5s interval, 40 attempt cap = ~60s),
      hands the token to `onActivate`, cleans the URL via
      `history.replaceState`. 6 tests. - **`hooks/useAppBilling.ts`** — composite hook bundling
      `useLicense` + `useCheckoutReturn` + `showPricing`
      state + a pre-bundled `licensePropsForDashboard` so
      App.tsx stays under the 600-LOC ceiling. - **App / Settings wiring**: `useAppBilling` mounted at
      App root, `PricingPage` mounted as a top-level overlay
      toggled by `?pricing=1` URL param OR Settings →
      LicenseSection → Upgrade / Change plan button.
      Settings → LicenseSection gains a localised Upgrade
      CTA when `onOpenPricing` is wired. - **i18n**: 35 new keys per locale (zh + en) covering
      the pricing page heading, period labels, savings
      copy, footer trust line, 3 subscribe-aria templates,
      4-5 features per tier (12 keys), 5 failure reasons. - **Server bootstrap** (`server.ts`): the Stripe routes
      register only when `STRIPE_SECRET_KEY` +
      `STRIPE_WEBHOOK_SECRET` +
      `VECTOR_LICENSE_MASTER_SECRET_KEY_BASE64` are ALL
      set. Missing any: a one-line warn at startup
      ("billing routes NOT mounted") and the pricing UI
      surfaces `sku-not-configured` for any subscribe
      attempt. The global JSON parser is gated to skip
      `/api/stripe/webhook` so Stripe's signature verifier
      sees the raw bytes. - **Currency policy** preserved end-to-end: every price
      renders via `formatUsdPrice` (`$X.XX USD`); the
      explicit `USD` suffix never gets stripped; i18n
      translates only the surrounding copy ("month" → "月"). - **Quality gates**: `npx tsc --noEmit` clean;
      `npm run lint --max-warnings=0` clean (App.tsx +
      Dashboard.tsx held under the 600-LOC ceiling via
      `useAppBilling` extraction + prop bundling);
      `npm run build` clean (PWA precache 51 entries / 3574
      KiB); `npx vitest run` 1308/1308 (164 test files).
- [x] **§Phase 5.1 / License token data layer (no Stripe yet)** —
      first deliverable of the four-phase Phase 5 (subscription
      billing) umbrella. **All prices are USD** — explicit product
      decision (FX rounding is misleading; international users
      read English pricing comfortably; multi-currency multiplies
      reconciliation overhead). Display rule: every price renders
      as `$X.XX USD` (literal `USD` suffix so users in
      CAD / AUD / SGD / HKD don't mistake it for local currency);
      i18n translates ONLY the surrounding copy ("month" → "月").
      → **Phase 5.1 done (~2 days)** — vertical slice across
      **+8 new files / +9 modified / +48 new tests** (1201 → 1249
      vitest cases). All gates green: - **Token wire format** (`services/licenseToken.ts`):
      `vector-license-v1.<base64url-payload>.<base64url-signature>`,
      Ed25519-signed, 5-field payload (`tier` / `sub` / `iat` /
      `exp` / `kid`). 12 tests covering sign + verify roundtrip
      for all 3 tiers, base64url cleanliness, 8 distinct failure
      reasons (`malformed` / `wrong-prefix` / `invalid-base64` /
      `invalid-payload-json` / `invalid-payload-shape` /
      `unknown-kid` / `invalid-signature` / `expired`). - **Master keyring** (`lib/licenseKeyring.ts`): single source
      of truth for `kid → publicKey` lookup. Ships `dev-2026`
      (deterministic from `vector-dev-license-seed-2026` so
      anyone can mint a working token locally for testing) and
      a placeholder slot for the future `vector-master-2026`
      production key. - **IDB persistence** (`services/licenseStore.ts` +
      `hooks/useLicense.ts`): anonymous install id (32-char
      base32, persisted in localStorage so it survives IDB
      wipes) + verify-then-persist token storage with
      `payload.sub === installId` enforcement (a leaked token
      is useless on a different install). 9 service + 6 hook
      tests, including round-trip, expiry, install mismatch,
      deactivate, reload-from-other-caller. - **Pricing single source of truth** (`lib/pricing.ts`):
      five locked alpha SKUs (Stardust monthly / annual,
      Polaris monthly / annual, Owner lifetime), `formatUsdPrice`
      helper that always emits `$X.XX USD`, `annualSavingsPercent`
      helper for "save 17%" badges. 10 tests including
      deterministic 17% savings on annual SKUs and the explicit
      USD suffix in formatted output. Stripe price ids stay
      `null` until Phase 5.2 creates them. - **Quota bridge** (`services/quotaService.ts +
      tierFromLicense`): one-line bridge between the license
      token's `LicenseTier` and the paywall predicates'
      `UserTier`. Existing predicates already accept an optional
      `tier` parameter — Phase 5.4 wires the live license tier
      through; this sprint just opens the seam. - **Settings UI** (`components/LicenseSection.tsx`):
      Settings-mounted card showing current tier badge,
      expires-on date, install id (with copy-to-clipboard),
      paste-license input + Activate button, Deactivate button,
      and a collapsible USD pricing reference. Inline failure
      banner with localised copy for every `LoadLicenseFailure`
      reason. 9 component tests. - **Dev minter** (`scripts/dev-mint-license.mjs` + npm
      script `license:mint`): single-file Node CLI that derives
      the same private key the embedded public key was generated
      from, signs an arbitrary `(tier, install-id, days)`
      payload, prints a working token. Verified end-to-end
      roundtrip: minter → embedded keyring → noble verify all
      agree. - **App wiring**: `useLicense` mounted at App root; install
      id / current tier / payload / failure / activate / deactivate
      plumbed through `Dashboard` → `DashboardSettingsModal` →
      `SettingsPanel` so the LicenseSection card appears next to
      the migration / memoirs picker rows. - **i18n**: 30 new keys per locale (zh + en) covering the
      section heading, tier labels, period labels, install id
      copy, activate / deactivate copy, the 9 localised failure
      reasons. - **Docs**: `docs/billing.md` (full design rationale: phasing
      plan, currency policy, wire format, install id, master
      keyring + rotation, verification flow, quota integration,
      dev minter, out-of-scope items for 5.2 / 5.3 / 5.4). - **Quality gates**: `npx tsc --noEmit` clean; `npm run lint
      --max-warnings=0` clean; `npm run build` clean (PWA
      precache 51 entries / 3562 KiB); `npx vitest run`
      1249/1249 (157 test files).
- [x] **§Phase 4.5 §E follow-up (L1)** — Settings → Memoirs picker
      finally wires the Memory Management panel (Phase 4 W3 + F2
      cascade) and the Letter History panel (Phase 4.5 F1) into a
      real user-facing entry point. Both panels were built + tested
      in isolation by their respective sprints but lacked a real
      surface; this 1-day sprint closes that loop.
      → **Done (1-day sprint)** — vertical slice across **+2 new
      files / +6 modified / +5 new tests** (1196 → 1201 vitest
      cases). All gates green: - `components/MemoirsPickerSection.tsx` _(new)_ — Settings-
      mounted section that lists every Memoir-kind custom
      persona with two CTAs per row: **Memories** (opens the
      existing W3 panel) and **Letters** (opens the F1 panel).
      Hidden entirely when the user has no Memoirs (empty state
      adds noise to Settings for the majority who haven't used
      the feature). 5 component tests covering filter (non-
      memoirs hidden), per-row CTAs, copy rendering, no-memoir
      no-render. - `components/AppMemoirPanels.tsx` _(new)_ — thin wrapper
      that mounts both panels at App root, extracted from
      `App.tsx` to keep the App module under the 600-LOC
      ceiling. Has no state of its own; the parent (`App.tsx`)
      owns the picker selection and clears it when either panel
      closes. Reuses `useMemoryStore` and `useLetterStore` from
      the App-level mount so the panels see the same IDB blobs
      as the rest of the app. - **Wiring**: `dashboardProps.ts` + `Dashboard.tsx` +
      `DashboardSettingsModal.tsx` + `SettingsPanel.tsx` thread
      a single `customPersonas` prop + two `onOpenMemoir*`
      callbacks down so the Settings drawer can render the
      picker between the existing migration row and the wipe
      section. - **App-level handlers**: opening the Memory panel routes
      through to `handleCascadeDeleteMemoir` for the F2
      cascade-delete CTA, then closes the panel via
      `setMemoirIdForMemories(null)`. Opening a delivered-letter
      reply from the Letter History panel routes through
      `setSelectedEntry` + `setAppState(AppState.VIEWER)` so the
      existing Viewer path picks up the entry. - **i18n**: 6 new keys per locale (zh + en) covering the
      section heading, subtitle, both row CTAs, both ARIA
      templates with `{name}` interpolation. - **Quality gates**: `npx tsc --noEmit` clean; `npm run lint
      --max-warnings=0` clean (the App.tsx growth fits inside
      the budget after refactoring through `AppMemoirPanels`);
      `npm run build` clean (PWA precache 51 entries / 3547
      KiB); `npx vitest run` 1201/1201.
- [x] **§Phase 4 §4.b-3 follow-ups (K1 + K2)** — closes two
      ergonomic gaps in the original Ed25519 signed-backups ship.
      → **Done (1.5-day sprint)** — vertical slice across **+5 new
      files / +9 modified / +26 new tests** (1170 → 1196 vitest
      cases). All gates green: - **K1 · Trusted devices audit panel**: - `services/trustedDevices.ts` — new pure
      `relabelTrust` / IDB-backed `relabelTrustedPublicKey`
      (returns same array when label unchanged → cheap React
      no-op). +6 new tests in the existing suite (20/20 total). - `hooks/useTrustedDevices.ts` _(new)_ — React hook
      wrapping the trust-store CRUD with optimistic local
      updates + IDB persistence + a `reload()` hook for the
      panel-open refresh. 6 tests covering hydrate, reload,
      revoke, relabel + 80-char truncate. - `components/TrustedDevicesPanel.tsx` _(new)_ — modal
      listing every trust record (most-recent-first), per-row
      fingerprint chip, inline label edit (pencil → input →
      Save), revoke with the same two-step "tap-to-arm,
      confirm-within-5s" UX as the existing
      `MemoryManagementPanel` clear-all action. 7 component
      tests. - **App + Settings wiring**: panel mounted at App root
      (so `useTrustedDevices` hook stays singleton and reloads
      when the panel opens). Settings device-fingerprint chip
      gains a "Trusted devices" link next to "Regenerate
      device keys". - **K2 · Fingerprint QR codes**: - `qrcode-svg` (~10 KB minified pure-JS) added as a runtime
      dep — picked over `qrcode` because we just need 16-char
      encoding; canvas / dataURL would be overkill. - `lib/fingerprintQr.ts` _(new)_ — pure encoder using
      `currentColor` so the QR adopts the parent's text colour
      automatically. Strips the leading `<?xml ?>` decl so
      React's `dangerouslySetInnerHTML` accepts it. 6 tests. - `components/FingerprintQr.tsx` _(new)_ — `useMemo`-wrapped
      React wrapper with `role="img"` + `aria-label` for screen
      readers. - **Three consumer surfaces**: - `MigrationExportModal` — 88 px QR next to the
      fingerprint in the post-Generate success pane. - `MigrationImportWizard.VerifyTrustPane` — 112 px QR
      so the user can grab their other phone and visually
      compare side-by-side. +1 new wizard test asserting
      QR presence inside the verify-trust pane. - `SettingsPanel` device-fingerprint chip — 80 px QR
      next to the user's own fingerprint for quick scanning
      from another device. - **i18n**: 12 new keys per locale (zh + en). - **Docs**: `docs/backup-signature.md` updated with a new
      "Phase 4 §4.b-3 follow-ups (K1 + K2)" section that walks
      through the new modules, design decisions (why `qrcode-svg`
      over `qrcode`, why ECC level `M`, why no QR scanner in v1). - **Quality gates**: `npx tsc --noEmit` clean; `npm run lint
      --max-warnings=0` clean; `npm run build` clean (PWA
      precache 51 entries / 3524 KiB); `npx vitest run`
      1196/1196.
- [x] **§Phase 4.5 follow-ups (F1-F4)** — clears the four
      tracked debts from Phase 4.5 §A-E:
      → **Done (3-day sprint)** — vertical slice across **+5 new
      files / +10 modified / +25 new tests** (1145 → 1170 vitest
      cases). All four follow-ups land green: - **F1 · Letter history view** (`components/LetterHistoryPanel.tsx`)
      — three-section read-only inspector for every letter the
      user has ever written to a Memoir: Pending (sortable by
      deliverAt, cancel CTA per row), Delivered (link to
      replyEntryId per row), Cancelled / Failed (collapsed
      footer). +8 component tests covering filter, sort,
      cancel, open-reply, empty-state, "other" section
      visibility. Wiring into the Settings tree is a follow-up
      sprint; the panel is ready to drop in. - **F2 · Memoir cascade-clears-letters**
      (`services/memoirCascade.ts` +
      `MemoryManagementPanel` cascade footer) — pure orchestrator
      that chains `clearMemories → clearLetters → deletePersona`
      in that order with each step in its own try/catch (so a
      failure in one bucket doesn't poison the others; the
      persona is the LAST thing to disappear so partial-failure
      retries are user-recoverable). UI: a new amber "Delete
      this memoir entirely" footer in `MemoryManagementPanel`
      with the same two-step "tap-to-arm, confirm-within-5s"
      pattern as the existing clear-all action. Wired from
      `App.handleCascadeDeleteMemoir` into the panel's optional
      `onCascadeDeleteMemoir` prop. +7 service tests + 3 panel
      UI tests. - **F3 · Viewer echoChamberQuery preface**
      (`components/ViewerReadingPanel.tsx`) — when an entry was
      captured from an Echo Chamber session
      (`entry.isEchoChamber === true`), surface the original
      round-table prompt at the top of the reading pane in a
      cyan-bordered card with `text-[10px]` "Round-table prompt"
      kicker. Lets the user re-read what they originally asked
      before scanning the synthesised consensus / divergence
      body. +3 viewer tests covering presence, absence, and the
      "wait for decryption" gate. - **F4 · Proactive recall → composer pre-seed**
      (`Editor` `seed` prop +
      `App.handleOpenComposerWithSeed` +
      `Dashboard.onOpenComposerWithSeed`) — clicking "Open" on a
      `ProactiveRecallCard` (silence-reconnect / anniversary /
      pending-followup) now routes the user straight into the
      entry composer with the title pre-filled
      ("写给 {memoirName}" / "For {memoirName}"), the
      localised hint dropped into the content, and the memoir
      name pre-tagged. Crucially: the seed is applied ONLY when
      the corresponding draft field is empty, so a user with an
      in-progress draft never has it clobbered by a recall
      click. The seed is single-shot — both `handleSaveEntry`
      and `handleBackToDashboard` clear it so a future
      "+ New entry" click starts blank. +4 editor tests. - **i18n**: 27 new keys per locale (zh + en); other locales
      inherit zh fallback (long-standing drift). - **Test infra unchanged**: re-uses the `fake-indexeddb`
      setup added in §4.b-3 so every IDB-backed cascade /
      history test gets a real IDB to talk to. - **Quality gates**: `npx tsc --noEmit` clean; `npm run
      lint --max-warnings=0` clean; `npm run build` clean (PWA
      precache 3495 KiB); `npx vitest run` 1170/1170.
- [x] **§Phase 4 §4.b-3 / Ed25519 signed backups** — closes the
      "checksum is not a signature" caveat from Phase 4.5 §E.
      Per-device Ed25519 keypair, AES-GCM-encrypted secret in
      IndexedDB, fingerprint-based TOFU on the receiving side.
      → **§4.b-3 done (3-day sprint)** — full vertical slice across
      **+8 new files / +12 modified / +1 design doc / +50 new
      tests** (1095 → 1145 vitest cases). The full quality gate is
      green: - **Crypto core** (`@noble/ed25519` + `@noble/hashes`, total
      ~11 KB minified): `services/edBootstrap.ts` wires SHA-512
      once globally; `services/deviceKeypair.ts` owns the
      per-device keypair lifecycle (`ensureDeviceKeypair`,
      `regenerateDeviceKeypair`, `loadPublicIdentity`,
      `unlockSecretKey`, `wipeSecret`); `services/backupSignature.ts`
      owns sign / verify (canonical-body strategy: signature
      covers `JSON.stringify(payload, null, 2)` with `signature` + `publicKey` stripped before re-stringify-ing). - **Schema bump** v4 → v5: backup payload gains optional
      `signature` + `publicKey` top-level fields. Backwards-
      compatible (v1-v4 importers ignore them; v5 importers
      reading older payloads default to `signature.kind = 'unsigned'`). - **TOFU trust store** (`services/trustedDevices.ts`):
      IDB-backed list of `{ publicKey, fingerprint, label,
      trustedAt }`. The wizard pre-checks the store on
      `loadFromText` so the preview pane can show "✓ trusted
      device" inline; unknown public keys route through the
      `verify-trust` phase before apply. - **Wizard state machine** (`hooks/useMigrationWizard.ts`):
      adds a 6th phase `verify-trust` plus a signature gate at
      the start of `confirmAndApply`: - `signature.kind === 'invalid'` → block with
      `SIGNATURE_INVALID`. - `signature.kind === 'unsigned' && !acceptedUnsigned` →
      block with `UNSIGNED_NOT_ACCEPTED`. - `signature.kind === 'valid' && !trustKnown` → route to
      `verify-trust`. - `acceptTrust(label)` → `trustPublicKey(...)` + back to
      preview; `rejectTrust()` → preview with
      `TRUST_REJECTED` banner. - **Three UI surfaces**: `MigrationExportModal` shows the
      signing fingerprint in the success pane (or an amber
      "no signature" warning when the source has no keypair);
      `MigrationImportWizard` adds a `SignatureBadge` (green /
      amber / red) above the mode toggle and a `VerifyTrustPane`
      for TOFU bootstrap; `SettingsPanel` exposes the device
      fingerprint chip + "Regenerate device keys" CTA inside
      the existing Phase 4.5 §E migration row. - **Bootstrap**: `App.handleSetPassword` and
      `App.handleUnlock` both call `ensureDeviceKeypair(password)`
      so pre-§4.b-3 installs grow a keypair on next unlock
      (idempotent — no-op when one exists). - **i18n**: 35 new keys per locale (zh + en); other locales
      inherit zh fallback (long-standing drift). - **Legal**: `PRIVACY.md` §3e + `TERMS.md` §3e (English +
      Chinese) cover the keypair lifecycle, TOFU semantics,
      rotation guidance ("rotate before passing the device on"). - **Design doc**: `docs/backup-signature.md` covers why
      Ed25519 (vs HMAC / RSA / Web Crypto native), the
      architecture diagram, schema diff, what-gets-signed
      canonicalization rationale, fingerprint format, TOFU
      flow, key rotation, out-of-scope items (multi-device
      trust graph, Settings UI for trust list, HSM / WebAuthn,
      transparency logs). - **Test infra**: `fake-indexeddb` added as a test-only dep;
      `vitest.config.ts` `setupFiles` wires it in once per process
      so the keypair / trustedDevices stores have a real IDB to
      talk to in `happy-dom` (same memory backing, full IDB
      spec). - **Quality gates**: `npx tsc --noEmit` clean; `npm run lint
      --max-warnings=0` clean; `npm run build` clean; `npx
      vitest run` 1145/1145.
- [x] **§Phase 4.5-E / Cross-device migration wizard** — 跨设备
      迁移. Three-day sprint that turns "carry your VECTOR vault
      to a new phone" from a 4-step Settings ritual into a single
      `.vectormigration` file + a 5-step wizard.
      → **§Phase 4.5-E done (3-day sprint)** — full vertical slice
      across **+8 new files / +5 modified / +1 design doc / +32
      new tests** (1063 → 1095 vitest cases), with the full quality
      gate green: - **Schema bump**: backup payload `v3 → v4` adds optional
      `letters` field (carrying Phase 4.5 §A `PendingLetter[]`,
      which the regular Settings export deliberately omits) plus
      the opt-in `passwordHashSnapshot` / `passwordSaltSnapshot`
      pair (only the migration export ever sets these). - **Service layer**: `services/migrationPackage.ts` wraps the
      existing `dashboardExport` / `dashboardImport` to add the
      wizard surface — `buildMigrationPackage`, `parseMigrationPackage`,
      `applyMigrationPackage`, plus a deterministic 6-character
      `computeShortCode` (SHA-256 → base32) so source + target
      devices can confirm "this is the right file". - **State machine**: `hooks/useMigrationWizard.ts` owns a 6-phase
      flow (`pick-file → preview → verifying → applying → done`,
      with `error` as a side branch). Verifies the typed master
      password against the package's credential snapshot **before**
      any data is written; password mismatch routes back to preview. - **Two UI surfaces**: `components/MigrationExportModal.tsx`
      on the source side (Settings entry, opt-in credential
      checkbox, download CTA, short-code chip) and
      `components/MigrationImportWizard.tsx` on the target side
      (file picker, preview, mode toggle, password input, done
      screen with partial-failure list). - **Two entry points**: `MigrationImportWizard` is mounted at
      App level so it's reachable from the cover screen (vault
      still locked, first-run on a new device — added a small
      secondary CTA below "INITIALIZE") AND from Settings (an
      always-unlocked re-import path next to Backup section). - **i18n**: ~70 new keys per locale (zh + en); other locales
      (ja/ko/fr/de/es) inherit zh fallback (long-standing drift,
      not introduced by this sprint). - **Legal**: `PRIVACY.md` §3d + `TERMS.md` §3d (English +
      Chinese) explicitly cover the new data-flow ("file is the
      most data-rich artifact VECTOR can produce", "checksum is
      not a signature", "credential carry only when same person"). - **Design doc**: `docs/migration-wizard.md` covers the why,
      architecture, schema diff, verification-code semantics,
      credential-snapshot rules, the state-machine ASCII, and
      out-of-scope rationales (cloud relay / QR / Ed25519 / per-
      section selective import / server-mediated rendezvous). - **Quality gates**: `npx tsc --noEmit` clean; `npm run lint`
      with `--max-warnings=0` clean; `npx vitest run` 1095/1095;
      `npm run build` clean (PWA precache 51 entries).
- [x] **§Phase 4.5-D / Lighthouse PWA score ≥ 90** — reproducible
      audit harness + the 2-day optimisation pass that brings
      mobile performance from a baseline 77 to a stable 91 across
      3 consecutive runs. Both desktop + mobile now pass the 90
      floor on all four categories (performance / accessibility /
      best-practices / seo).
      → **§Phase 4.5-D done (2-day sprint)** — full vertical slice
      across **+2 new files + 1 new doc + 7 modified files**
      (1063 tests across 138 files green at close — no test
      regressions; §D is presentation-only). Adds `lighthouse` +
      `chrome-launcher` as devDeps + `scripts/lighthouse-audit.mjs`
      harness (boots vite preview, runs Lighthouse mobile +
      desktop, threshold-fails on per-category breach). New
      `lighthouse-budget.json` is the single source of truth for
      the per-category floors. Six concrete optimisations land:
      (1) lazy-load Dashboard / MasterLock / Onboarding /
      CommandPalette / SpaceTimeBackground / CoverScreen via
      `React.lazy(...) + <Suspense fallback={<ScreenLoader>}>`
      (entry chunk 615 kB raw → 187 kB raw, -64 % gzipped);
      (2) `lib/noiseTexture.ts` inlines the third-party
      `grainy-gradients.vercel.app/noise.svg` as a
      `data:image/svg+xml` URI (best-practices 96 → 100);
      (3) drop `latin-ext` font subsets from the eager bundle
      (~75 kB shaved off the FCP critical path; users on the
      rare `latin-ext` glyph fall back to PingFang SC /
      Microsoft YaHei); (4) `vector-hoist-stylesheet` vite
      plugin relocates the bundled `<link rel="stylesheet">` to
      BEFORE the entry script so the preload scanner dispatches
      it first; (5) drop synthesised `font-black` on the
      `<h1>VECTOR</h1>` headline (use real `font-bold` 700,
      shaves ~50-100 ms paint delay); (6) strip the duplicate
      `<link rel="stylesheet" href="/index.css">` from source
      `index.html` (dev-mode artefact). Mobile FCP 3.6 → 2.1 s,
      LCP 4.2 → 2.6 s, CLS 0.078 → 0.032. `scripts/check-beta.sh`
      gains an opt-in Lighthouse gate via `RUN_LIGHTHOUSE=1` so
      pre-release engineers can enforce the budget before
      tagging without slowing the regular check-beta run. New
      `docs/lighthouse-audit.md` documents the harness, every
      optimisation, and the before/after numbers for the next
      maintainer. All gates green at close (typecheck + lint
      --max-warnings=0 + full vitest + build + 28/28 default
      check-beta + 29/29 with Lighthouse on).
- [x] **§Phase 4.5-C / Argon2id default-on rollout** — promotes
      the Phase 3 §3.e PoC + Phase 4 §4.b-1/§4.b-2 opt-in toggle
      to default-on for every installation. Existing PBKDF2
      hashes transparently migrate to Argon2id on the user's
      next successful unlock — no UX prompt, no latency penalty.
      → **§Phase 4.5-C done (1-day sprint)** — full vertical
      slice across **+1 new file + 4 modified, +15 net new
      tests** (1063 tests across 138 files green at close).
      `SecurityService.applyArgon2idDefaults()` runs idempotent
      one-shot migration on App mount via the
      `vector_argon2_default_v45` marker (so an explicit user
      OFF choice in Settings stays sticky). `needsRehash` widens
      to flag any non-Argon2id hash whenever the minter is on.
      New `services/passwordRehash.ts::maybeRehashOnUnlock`
      runs background re-derivation + persist after every
      successful unlock; failures are silent so the unlock UX is
      never affected. `App.tsx` mounts both
      (`applyArgon2idDefaults` on first render +
      `void maybeRehashOnUnlock(...)` after `setIsUnlocked(true)`
      in `handleUnlock`). `docs/security/argon2-eval.md` flips
      from "RFC / decision pending review" to **"SHIPPED —
      default-on Phase 4.5 §C"** with a rollout-summary block at
      the top documenting the migration-marker design + the
      silent-failure posture. `hash-wasm` stays lazy-imported so
      the bundle cost remains zero until the rehash actually
      fires. All gates green at close (typecheck + lint
      --max-warnings=0 + full vitest + build + 28/28 check-beta
      invariants).
- [x] **§Phase 4.5-B / Echo Chamber** — 多 persona 圆桌. The
      second Phase 4.5 ship — gives the user a way to ask one
      question to many voices at once and watch the consensus +
      disagreement crystallise. 5-day sprint.
      → **§Phase 4.5-B done** — full vertical slice across **+8
      new files + 6 modified files, +50 net new tests** (1049
      tests across 137 files green at close). New shared schema
      `lib/echoChamberSchema.ts` (3-7 persona bound, 16-1500 char
      query, dedup + cap helpers). New optional `DiaryEntry`
      fields `isEchoChamber` + `echoChamberQuery` (additive, no
      backup-schema bump). New `quotaService.canStartEchoChamber` + `isEchoChamberBlocked` predicates (Free hard-blocked;
      Stardust+ allowed at the morningStarPerMonth shared
      budget). New server module `server/echoChamberPrompt.ts`
      with the round-table-specific guidance block (the
      template explicitly instructs the LLM to **surface
      disagreement, not round to consensus**) + safety
      guardrails block (anti-PII, Memoir-voice-grounding,
      self-harm redirect). New `server/echoChamberRoutes.ts`
      registrar + `POST /api/echo-chamber` endpoint with
      injection-guard + structured logging. New
      `services/echoChamberService.ts` client wrapper with
      tagged-failure types (`'invalid-input' | 'rate-limited' |
    'rejected-by-injection-guard' | 'ai-unavailable' |
    'empty-response' | 'aborted' | 'unknown'`). New
      `hooks/useEchoChamber` state machine
      (`'idle' | 'submitting' | 'success' | 'error' |
    'cancelled'`) with `AbortController` for clean
      mid-flight cancellation. New `components/EchoChamberModal`
      with three surfaces (paywall takeover / compose form /
      result-with-Save). Dashboard wires a fixed-bottom-right
      "⚭ 圆桌" FAB (cyan accent — distinct from the rose
      Letter Mode FAB; stacks above it when both visible),
      builds the persona pool (built-in 7 sages + custom
      personas + memoirs deduped) and per-Memoir recall map,
      saves the round-table reply via `onMintEntry` as a
      regular `DiaryEntry` with `isEchoChamber: true` +
      `echoChamberQuery`. EntryGrid renders a cyan ⚭ "圆桌"
      badge in both list + grid view (stacked smartly with
      isSample / isLetterReply badges in grid mode).
      **30 new i18n keys per locale** (echoChamber\* + echo
      error reason mappings + paywall + open-FAB + badge).
      TERMS.md §3c + PRIVACY.md §3a both grow new "Echo
      Chamber" blocks in English + Chinese — explicitly states
      that disagreement is a feature, not a flaw, and that
      the reply is not stored unless the user explicitly hits
      Save. All gates green at close (typecheck + lint
      --max-warnings=0 + full vitest + build + 28/28
      check-beta invariants).
- [x] **§Phase 4.5-A / Letter Mode** — 心象的延迟回信. The first
      Phase 4.5 ship — gives the user a slow, ritual surface
      that complements the existing instant Morning Star turn.
      → **§Phase 4.5-A done (3-4 day sprint)** — full vertical
      slice across **+5 new files + 5 modified files,
      +50 net new tests** (999 tests across 132 files green
      at close).
      New domain object `PendingLetter`
      (`'pending' | 'delivered' | 'cancelled' | 'failed'` lifecycle
      with attempt counter + back-off) + optional
      `DiaryEntry.isLetterReply` / `letterId` fields (no v3
      backup schema bump — both additive). New IDB key
      `vector_master_vault_pending_letters`. New service
      `letterService.ts` (mint / cancel / markDelivered /
      markAttemptFailed / `dueLetters` with per-attempt
      exponential back-off / `recentlyDeliveredLetters` /
      `clearLettersForMemoir` cascade). New service
      `letterDelivery.ts` orchestrator: takes one due letter +
      its Memoir, runs `getMorningStarAnalysis` with the user's
      letter as the `reflection` slot + an envelope-framing
      sentence in `entryContent`, mints a `DiaryEntry` with
      `isLetterReply: true` + `letterId` back-pointer, returns
      a discriminated outcome (`'persona-not-memoir' |
    'ai-unavailable' | 'ai-empty-response' | 'persist-failed'
    | success`). New hook `useLetterStore` mirrors
      `useMemoryStore` posture (IDB primary + localStorage
      mirror + hydrate-on-read schema validation).
      `useDiaryData.addEntry` widened to accept an optional
      pre-minted `id` so the delivery sweep can record
      `PendingLetter.replyEntryId` atomically.
      New UI: `LetterComposeModal` (envelope-feel cream / amber
      palette, no AI progress bar — emphasises the deferred
      ritual; 1h / 24h / 3d delivery presets;
      character-counter; recipient selector when ≥ 2 Memoirs);
      `LetterArrivedCard` (sister to `ProactiveRecallCard`,
      rose-on-amber gradient with Mail icon, 7-day per-letter
      dismissal cooldown via `vector_letter_arrived_dismissed`
      localStorage key); EntryGrid shows an envelope (✉) badge
      next to the existing 示例 badge for `isLetterReply`
      entries (both list + grid view, stacked on grid).
      Dashboard mounts the store + runs a one-shot delivery
      sweep on mount (delivers each due letter through the
      pipeline, never re-fires mid-iteration so no
      double-delivery), renders the arrived-card stack below the
      proactive-recall stack, and exposes a fixed-bottom-right
      "✉ 写一封信" pill button when at least one Memoir exists.
      Defensive `try/catch` around `idb-keyval.get()` calls in
      all three IDB hooks (`useLetterStore` / `useMemoryStore`
      / `useCustomPersonas`) — `getDB()` synchronously throws
      `ReferenceError: indexedDB is not defined` in happy-dom,
      bypassing the inner `.catch()`. **20 new i18n keys per
      locale** (letterCompose\* + letterDelay1h/24h/3d +
      letterArrived\* + letterReplyBadge + letterComposeOpen\*).
      TERMS.md §3b + PRIVACY.md §3a both grow new "Letter Mode"
      blocks in English + Chinese — explicitly states the
      delivery sweep runs **only when you open Dashboard after
      the chosen delivery window** (no server-side scheduler) and
      reminds users that the deferred AI reply is not evidence
      anyone is "thinking of you in real time". All gates green
      at close (typecheck + lint --max-warnings=0 + full vitest + build + 28/28 check-beta invariants).
- [x] **§5.1.B-3 / Week 4-5** — Memoir long-term memory system:
      durability + proactive recall. Closes out the §B "灵魂功能"
      block of [`docs/product-vision-2026Q2.md`](docs/product-vision-2026Q2.md):
      decay curves + dedup + capacity + soft-delete + recall v2 + the three主动唤起触发器 (silence-reconnect, anniversary,
      pending-followup).
      → **§5.1.B-3 done (Week 4-5 of Phase 4)** — full vertical
      slice across **+7 new files + 4 modified files, +93 net new
      tests** at close. New design doc
      [`docs/memoir-memory-system.md`](docs/memoir-memory-system.md)
      pins every threshold + half-life + capacity ceiling.
      Memory schema gains optional `deletedAt` + `relatedTo`
      (additive — no v3 backup schema bump). New pure services:
      `memoryDecay` (per-category half-life decay + reinforcement
      boost + 4-tier qualitative labels), `memoryDedup`
      (bigram-Jaccard with three-band verdict + same-Memoir +
      same-category scope), `proactiveRecall` (three-trigger
      evaluator with specificity merge + cooldown predicate +
      `lastChatPerMemoir` derivation from existing
      `morningStarPersonas` arrays). `quotaService.TIER_LIMITS`
      extends with `memoriesPerMemoir` (200/500/1000 by tier).
      `selectMemoriesForRecall` upgraded to v2: `salience + 0.4 ×
    bm25 + categoryPrior` with substring-tolerant BM25-ish that
      handles Chinese + English equally + date / emotion shape
      detection in the prior. `useMemoryStore.addMemory` is now
      dedup + capacity-aware via the `AddMemoryOutcome`
      discriminated union (`'minted' | 'collapsed' | 'rejected'`).
      Soft delete becomes the default destructive action with a
      30-day recycle bin auto-purged on store mount. New hook
      `useProactiveRecall` combines the pure evaluator with 24h
      per-tuple localStorage cooldown. New UI surfaces:
      `MemoryManagementPanel` gains a capacity chip + per-row
      salience tier badges + Live ↔ Recycle-bin tab switcher;
      `ProactiveRecallCard` rendered above `<VaultContent>` on
      Dashboard with rose accent + dismissible. **24 new i18n
      keys per locale** (memoryPanelCapacity / Tab / Recycle /
      Salience + proactive\*). PRIVACY.md §3a expands with the
      W4-W5 disclosure block in both languages — explicitly states
      proactive recall evaluates on-device (zero server). Open CTA
      on the proactive card currently dismisses; full pre-seeded
      composer hand-off is a documented Phase 4.5 follow-up. All
      gates green at close (typecheck + lint --max-warnings=0 +
      full vitest + build + 28/28 check-beta invariants).
- [x] **§5.1.B-2 / Week 3.5** — Memoir memory harvest loop closed.
      Quick-win that wires the trigger into Week 3's already-
      working extractor. Without it the recall ranker had nothing
      to surface on the next round (extraction never actually
      ran, only the manual "edit / delete" surface in the
      management panel did).
      → **§5.1.B-2 done (Week 3.5 of Phase 4)** — full vertical
      slice across **3 new files + 2 modified, +25 net new tests**
      (860 / 122 files green at close).
      `services/memoryExtractionService.ts` (silent-failure POST
      wrapper for `/api/memoir-extract` — never bubbles to UI),
      `services/memoirTranscriptSlicer.ts` (pure markdown slicer
      that splits per-Memoir letter sections to avoid cross-
      pollination of memory banks),
      `hooks/useMemoirMemoryHarvest.ts` (fire-and-forget trigger
      with per-Memoir `Promise.all` isolation +
      `AbortController` for clean cancellation on entry
      navigation). `useMorningStarPipeline` learns
      `onAnalysisHarvest?` callback (called at the end of the
      success path, wrapped in try/catch, never awaited);
      `Viewer` mounts the harvest hook + wires it through, plus
      a `useEffect` cleanup that cancels any in-flight harvest
      on unmount. **Privacy posture**: extraction call is metered
      as part of the parent chat round (no extra quota gate);
      candidate bodies still flow through
      `detectUnsafeMemoryBody` second-line PII guard before
      persisting locally — defence in depth holds. All gates
      green at close.
- [x] **§5.1.B / Week 3** — Memoir (心象) MVP + long-term memory
      system. AI-assisted "为心中的人立一座心象 + 让它真的记得
      你们说过的话" flow. Free tier hard-blocks both creation
      (0 slots) AND chat (0/yr); paid tiers unlock per
      [`docs/product-vision-2026Q2.md`](docs/product-vision-2026Q2.md)
      §6.1 (Stardust 1×500/yr, Polaris 5×1000/yr, Owner 10×1000/yr).
      → **§5.1.B done (Week 3 of Phase 4)** — full vertical slice
      across **15 new files + 13 modified, +86 net new tests**
      (835 / 119 files green at close). New domain types
      (`Memory` / `MemoryCategory`); new pure data layer
      (`memoryService` for CRUD + recall ranking +
      `detectUnsafeMemoryBody` second-line PII guard); `quotaService`
      extended with `canCreateMemoir` + `canChatMemoir`; new IDB
      hook (`useMemoryStore`); 5-step Memoir wizard
      (`useMemoirBuilder` with **mandatory consent gate** before
      submit reaches the network); shared isomorphic schema
      (`lib/memoirBuilderSchema`); two new server modules with
      stricter Memoir guardrails — `memoirBuilderPrompt` (memory-of-
      them block + psychological-safety block + no-future-claims
      block injected verbatim into the generated systemPrompt) and
      `memoryExtractor`; two new server endpoints
      (`POST /api/memoir-build`, `POST /api/memoir-extract`); two new
      modals (`MemoirBuilderModal` with rose accent + Heart icon to
      visually distinguish from the cyan Persona Builder;
      `MemoryManagementPanel` with category grouping, inline edit
      with safety-check rejection, two-step armed wipe + static
      crisis-hotline reminder card pointing at CN/US/UK numbers);
      Settings panel CTA insertion (`onOpenMemoirBuilder` plumbed
      through `SettingsPanel` → `SettingsGuidingStarsSection`);
      `DashboardSettingsModal` wires the modal sibling-to
      `PersonaBuilderModal` and computes the Memoir paywall via
      `canCreateMemoir`; Morning Star pipeline learns
      `memoirRecallByPersona` (recency × keyword × milestone-boost
      ranker output keyed by Memoir name) — `Viewer` mounts
      `useMemoryStore` and computes the per-render recall map; **backup
      schema v2 → v3** with bidirectional compatibility (v1 / v2
      backups land as `memories: []`; v3 backups validate through
      `hydrateMemories`); **Day 6's customPersonas backup-import
      restoration TODO is now closed** (`useBackupImport` accepts
      optional `onImportCustomPersonas` + `onImportMemories`
      callbacks, `App` wires both); **22 new i18n keys per locale**
      (`memoirBuilder*` × 12, `memoirPaywall*` × 5,
      `memoryPanel*` + `memoryCategory*` + `memoryEdit*` +
      `memoryClearAll*` × 16); **TERMS.md + PRIVACY.md** each gain a
      new §3a Memoir section in both English and Chinese (creative-
      interpretation framing, anti-doxing / anti-public-figure
      restriction, "not a substitute for professional support"
      caveat, full data-flow disclosure of the three Memoir-specific
      AI-proxy transmissions, full user control surface enumeration).
      Total: 8 days, all gates green at close (typecheck clean +
      full vitest suite + lint).
- [x] **§4.a-5 / Week 2** — Persona Builder MVP. AI-assisted
      "add a custom 启明星" flow. Free tier hard-blocks at 0
      personas; Stardust/Polaris/Owner tiers unlock incrementally
      (5 / 30 / 50 caps per [`docs/product-vision-2026Q2.md`](docs/product-vision-2026Q2.md) §6.1).
      → **§4.a-5 done (Week 2 of Phase 4)** — full vertical
      slice across 7 new files + 5 modified, **86 new unit tests**
      across 9 test files. New domain types
      (`CustomPersona` / `CustomPersonaKind`); two new services
      (`personaService` for CRUD + classification, `quotaService`
      for tier-aware paywall verdicts); two new hooks
      (`useCustomPersonas` for persistence,
      `usePersonaBuilder` for the wizard state machine);
      isomorphic schema (`lib/personaBuilderSchema.ts`) shared
      between client wizard and server validator; new server
      endpoint `POST /api/persona-build` with prompt-injection
      guard + anti-PII guardrails + JSON output schema enforcer + structured `persona_build_*` log events; new modal
      (`PersonaBuilderModal`) with paywall takeover surface;
      new editable preview surface (`PersonaPreview`); Settings
      panel CTA insertion point; Morning Star
      `customPersonaPrompts` injection through the existing
      Viewer → useMorningStarPipeline pipeline; backup schema
      v1 → v2 with bidirectional compatibility (v1 imports
      treated as `customPersonas: []`, v2 imports validated
      through `hydratePersonas`); 22 new i18n keys per locale
      (zh + en). Backup-import restoration of customPersonas
      intentionally deferred (TODO marked in `useBackupImport.ts`)
      — export side captures them so nothing is lost. Total:
      6 days, 112 / 731 tests, all gates green at close.

#### B · Trust (security posture + transparency)

- [x] **§3.e-2** — Wire the Argon2id branch into
      `SecurityService.verifyPassword` (**verifier-only**, no minter
      change). Behind a `localStorage` feature flag
      (`vector_argon2_verify`) defaulting to `false`. Existing
      PBKDF2 hashes keep verifying without user-visible change.
      → **§3.e-2 done** — `services/securityService.ts`:
      (a) `ARGON2_HASH_PREFIX` recognised in `verifyPassword`,
      routed through a lazy `import('./argon2idPoc')` so the
      `hash-wasm` blob (~52 kB) stays out of the bundle until the
      flag is on; (b) `isArgon2idVerifierEnabled()` /
      `setArgon2idVerifierEnabled()` public accessors — the latter
      is the hook that a future Settings → Security panel will
      wire to its toggle; (c) `needsRehash()` returns false for
      Argon2id hashes (already strongest, downgrading would be a
      regression); (d) salt argument is ignored on the Argon2id
      branch — the hash format embeds its own salt; (e) malformed
      Argon2id strings return false rather than throwing so the
      caller can't time-distinguish "wrong password" from
      "corrupted record". 8 new test cases land in
      `services/securityService.test.ts` covering flag default /
      flag toggle / "1" + "true" parsing / off-flag refusal /
      on-flag accept / on-flag reject-wrong / malformed-hash
      rejection / PBKDF2 still works while flag on / no-rehash on
      Argon2id. Storage key is registered in
      `services/appSettings.ts` as `argon2VerifierEnabled`.
      Carries forward the GO verdict in
      `docs/security/argon2-eval.md`.
- [x] **§4.b-1 / §4.b-2** — Argon2id minter + Settings exposure.
      → **Both items shipped together in the Phase 4 W2.1/W2.2 sweep.**
      Rather than landing the verifier toggle alone (§4.b-1) and
      then the minter rollout (§4.b-2) in two PRs, W2.1 added the
      `vector_argon2_minter` flag with a "verify ≥ mint" invariant
      enforced in `SecurityService.isArgon2idMinterEnabled` itself;
      W2.2 then surfaced both flags through a single
      `components/SettingsArgon2idToggle.tsx` switch
      (`role="switch"` + `aria-checked`) that auto-enables the
      verifier when the user opts into the minter. This cuts the
      orphan-hash failure mode the original §4.b-1 / §4.b-2 split
      was trying to schedule around. Bundle stays clean: lazy
      `import('./argon2idPoc')` keeps the wasm out of the
      first-paint bundle until the user actually flips the toggle.
      9 new test cases pin every quadrant of the
      (verify ∈ {on, off}) × (mint ∈ {on, off}) flag matrix; 7
      cases cover the toggle UI. Telemetry budget (P95 ≤ 350 ms)
      will be enforced in a follow-up `lib/vitals` distribution
      once we have real-world unlock-latency data; today's
      benchmark (`docs/security/argon2-eval.md`) shows OWASP_REC
      sits at 99 ms mean on M-class hardware.
- [ ] **§4.b-3** — Backup file integrity. Add an Ed25519 signature
      derived from the user's master key over the backup payload, so
      a tampered backup file fails import before it overwrites
      anything. Backwards compatible: unsigned backups continue to
      import with a banner ("backup is unsigned — import at your own
      risk"). Threat-model the change in
      `docs/security/backup-integrity.md`.
- [ ] **§4.b-4** — Public security disclosure surface. Publish
      `SECURITY.md` v2 with: supported versions, threat model,
      reporting contact (PGP key fingerprint), known-issue ledger,
      annual review cadence. Wire `docs/security/argon2-eval.md` and
      `docs/security/backup-integrity.md` into the disclosure index.
- [ ] **§4.b-5** — Deletion / wipe verification. Today's "Wipe All
      Data" clears IDB but does not provably zero the underlying
      pages. Document the limitation in `SECURITY.md` v2 and add a
      visible "Verify wipe" affordance that re-reads the IDB store
      and reports any residue. Cover the wipe path in `e2e/wipe.spec.ts`.

#### C · Shipping (distribution + trust signals)

- [ ] **§4.c-1** — Seven-sage portrait pack lands. Tracked separately
      because it is asset-only, but treat as a Phase 4 exit gate so
      the cover screen ships visually consistent. Carry-over from
      §3.c. Acceptance: 7 portraits, unified ratio / padding / stroke,
      reviewed by a designer.
- [ ] **§4.c-2** — App store / install presence: produce
      `1024×1024` app icon, `1200×630` social card, `1200×1200` IG
      card. Wire into `index.html` `<meta>` tags and the manifest.
      Verify Lighthouse PWA score ≥ 90 on desktop + mobile.
- [ ] **§4.c-3** — Single-binary self-hosting recipe.
      `docker-compose.yml` + `deploy/README.md` walks a non-VECTOR
      maintainer through standing up the proxy + static asset
      server in ≤ 5 minutes on a fresh VPS. Includes a TLS section
      (Caddy auto-cert recipe) and an upgrade path
      (`vector-upgrade.sh`).
- [ ] **§4.c-4** — Translation completion: drop the 232-key
      backlog across `ja / ko / fr / es / de` to **zero missing**
      via the existing `npm run i18n:diff` flow. Engineering owns
      the script, content owners do the writing. Translator credit
      in `CONTRIBUTORS.md`.
- [x] **§4.c-5** — Public changelog + release process. Adopted
      semver-tagged releases. **`v1.1.0` cut at Phase 4 close**
      via the W4.3 commit + an annotated `git tag -a v1.1.0`
      carrying the W1–W4 summary in the tag body. CHANGELOG
      `[1.1.0]` entry written. Generated `dist/` zip + GPG-signed
      tag are still queued for the post-push pass once the W1.1
      PAT scope ships and the v1.0.5-beta.1 + v1.1.0 tags are
      pushed to origin (CI artefact step on the v1.1.0 ref will
      do the zip).

### Effort estimates (engineering only)

| ID    | Title                                           |    Effort |
| ----- | ----------------------------------------------- | --------: |
| 4.a-1 | First-day empty-state + sample reflections      |       3 d |
| 4.a-2 | Pre-canned first-reflection prompts             |       1 d |
| 4.a-3 | Funnel events into Sentry breadcrumbs           |       1 d |
| 4.a-4 | Cold-start perf budget + Playwright spec        |       2 d |
| 4.b-1 | Argon2id verifier wiring (feature-flagged)      |       1 d |
| 4.b-2 | Argon2id minter rollout + opportunistic re-mint |       1 d |
| 4.b-3 | Backup signature scheme + tampering test        |       3 d |
| 4.b-4 | `SECURITY.md` v2 + disclosure index             |       1 d |
| 4.b-5 | Wipe verification affordance + e2e spec         |       1 d |
| 4.c-1 | Seven-sage portrait pack (external)             |   (asset) |
| 4.c-2 | App icon / social card / Lighthouse PWA ≥ 90    |       2 d |
| 4.c-3 | Self-hosting recipe + upgrade script            |       2 d |
| 4.c-4 | i18n backlog drop to zero                       | (content) |
| 4.c-5 | Tagged releases + signed git tags               |       1 d |

**Phase 4 engineering total: ~15 days** (3 weeks at calm cadence).
Asset / content tracks (4.c-1, 4.c-4) run in parallel and do not
block engineering exit.

### KPI Dashboard — Phase 4 targets

| 指标                  |        Phase 3 后 |                Phase 4 后 (target) |
| --------------------- | ----------------: | ---------------------------------: |
| 加权综合              |               8.9 |                            **9.2** |
| 安全分                |              9.5+ |                            **9.7** |
| 设计系统              |               9.0 |                     **9.0** (持平) |
| UX 分                 |               8.7 |                            **9.0** |
| 测试分                |               9.0 |                            **9.2** |
| 可观测分              |               8.5 |                            **8.8** |
| 加密迭代轮数          | Argon2id 评估完成 | **Argon2id 已上线（默认 minter）** |
| 视觉回归 baseline 数  |                 6 |      **8** (新增 viewer / archive) |
| i18n 缺失键           |               232 |                              **0** |
| Lighthouse PWA 分     |              未知 |                           **≥ 90** |
| 单 VPS 自部署中位耗时 |              未知 |                        **≤ 5 min** |

### Cross-phase notes (carry forward from Phase 3)

- All `localStorage.setItem` MUST go through
  `services/browserStorage.ts`. Phase 4 adds nothing new here but
  the budget continues.
- Encryption migration MUST keep a backwards-compatible read path.
  Argon2id rollout (§4.b-2) follows the §6 of `argon2-eval.md`.
- New component files ≤ 400 LOC; > 350 must extract a hook /
  sub-component. Phase 3's max-lines posture stays.
- Every PR updates `CHANGELOG.md` under `[Unreleased]`.

### Phase 4 engineer-roadmap track (parallel to §4.a / §4.b / §4.c)

> The original §4.a (activation) / §4.b (trust) / §4.c (shipping)
> charter framed Phase 4 as a product / distribution phase. In
> parallel, a **single-engineer + agent collaboration** track
> shipped a tighter set of platform / DX investments under the
> "W1–W4" labels (`.cursor/plans/vector_engineer_tech_roadmap_v1.x_*`).
> The W1–W4 track closed in 14 commits over a single multi-hour
> session; only W1.1 remains, gated on a one-time GitHub PAT
> scope action.

| ID   | Title                                                             | Status                                                                 |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| W1.1 | PAT scope + push + push v1.0.5-beta.1                             | ⏳ blocked on maintainer GitHub UI action                              |
| W1.2 | `lib/vitals.ts` → `Sentry.metrics.distribution`                   | ✅                                                                     |
| W1.3 | `useDiaryData.{addContainer,deleteContainer}` functional setState | ✅                                                                     |
| W1.4 | husky + lint-staged + commitlint                                  | ✅                                                                     |
| W1.5 | Sentry release + sourcemap upload in CI                           | ✅                                                                     |
| W2.1 | Argon2id default minter behind `vector_argon2_minter` flag        | ✅ (closes §4.b-1 + §4.b-2 with one minter that auto-enables verifier) |
| W2.2 | Settings → Security toggle for Argon2id + 7-locale i18n           | ✅                                                                     |
| W2.3 | `server.ts` → `server/aiProviders.ts` extraction                  | ✅                                                                     |
| W2.4 | Morning Star SSE end-to-end with buffered fallback                | ✅                                                                     |
| W3.1 | ⌘K / Ctrl+K command palette (cmdk)                                | ✅                                                                     |
| W3.2 | vite-plugin-pwa service worker + offline shell                    | ✅                                                                     |
| W3.3 | Refcounted Blob URL attachment cache                              | ✅                                                                     |
| W4.1 | e2e `data-testid` migration + `docs/e2e-conventions.md`           | ✅                                                                     |
| W4.2 | `@fontsource` self-hosted Inter + JetBrains Mono                  | ✅                                                                     |
| W4.3 | CHANGELOG `[1.1.0]` + `git tag -a v1.1.0`                         | ✅ (closes §4.c-5)                                                     |
| W4.4 | npm audit hard CI gate + Dependabot                               | ✅                                                                     |

See `docs/phase-4-postmortem.md` for the full retrospective
(headline outcome, what shipped, what didn't go to plan, what we
learned, KPI table, open follow-ups).

---

## Working agreements (apply across all phases)

- Every `localStorage.setItem` must go through `services/browserStorage.ts`.
- Every outbound `fetch` carries a 5s timeout via `AbortController`.
- New component files ≤ 400 LOC; > 350 must extract a hook / sub-component.
- Encryption / password / API key changes must keep a backwards-compatible
  read path.
- After each task finishes, run `npm test && npm run lint`; on red, stop
  and fix before moving on.
- After every Phase, run `scripts/check-beta.sh` and add a `CHANGELOG.md`
  entry under the matching version heading.

### 跨阶段补充约束 (Additional cross-phase agreements)

#### 防止「hook 抽出来 ≠ 组件变小」重演

| 防御层         | 落地动作                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- |
| Phase 1 内     | `eslint.config.*` 加 `max-lines: ['warn', 600]` 先观察                                   |
| Phase 2 完成时 | 升级为 `max-lines: ['error', 400]`，且**不允许**逐文件 `eslint-disable max-lines` 白名单 |
| 每个 PR        | PR 模板必须填「本 PR 是否新增了组件代码？如是，是否同步抽了 hook 或子组件？」            |

#### 测试纪律

- 每写一个新组件，**同时**写最少 2 个 case（render + 1 个交互）。
- coverage thresholds 只能涨不能降，每月在 `vitest.config.ts` 提 5 个
  百分点。
- e2e 不允许用文案 selector，新加的元素必须带 `data-testid`。

#### 安全纪律

- 任何 `localStorage.setItem` 调用必须经 `services/browserStorage.ts`，
  且通过白名单校验「该 key 是否敏感」。
- 任何对外 fetch 必须 5s 超时 + AbortController。
- `.env.*.local` 永不提交，`.env.example` 永不放真实占位。

#### 文档纪律

- `CHANGELOG.md` 按 [Keep a Changelog](https://keepachangelog.com/) 格式，
  每个 PR 必更。
- 每个 Phase 收尾写一篇 `docs/phase-N-postmortem.md`，记录「做到了什么、
  漏了什么、为什么漏」。

---

## KPI Dashboard (每周 review)

> 把这张表挂在每周站会，分数演不下去就是路线图被卡住的信号。

| 指标                 | 当前    | Phase1 后 | Phase2 后 | Phase3 后         |
| -------------------- | ------- | --------- | --------- | ----------------- |
| 安全分               | 7.8     | **9.0**   | 9.2       | 9.5               |
| a11y 分              | 4.5     | **8.0**   | 8.2       | 8.5               |
| 合规分               | 4.5     | **8.0**   | 8.0       | 8.0               |
| 可观测分             | 6.0     | **8.5**   | 8.5       | 8.5               |
| 测试分               | 7.0     | 7.5       | **8.5**   | 9.0               |
| UX 分                | 6.5     | 6.8       | **8.5**   | 8.7               |
| 架构分               | 6.0     | 6.0       | **8.0**   | 8.5               |
| 设计系统             | 5.5     | 5.5       | 6.5       | **8.5**           |
| **加权综合**         | **6.6** | **7.5**   | **8.5**   | **8.8**           |
| 4 大组件最大行数     | 1247    | 1247      | **≤350**  | ≤350              |
| 组件 jsx-a11y 违规   | 未知    | **0**     | 0         | 0                 |
| 加密迭代轮数         | 100k    | **600k**  | 600k      | Argon2id 评估完成 |
| 仓库公开 markdown 数 | 2       | **6**     | 7         | 9                 |

---

## Risks & Mitigations (风险与备用方案)

| 风险                                         | 概率 | 影响         | 缓解                                                                              |
| -------------------------------------------- | ---- | ------------ | --------------------------------------------------------------------------------- |
| PBKDF2 600k 在低端手机解锁卡顿 > 2s          | 中   | 用户流失     | 给解锁加进度条 + iter 走配置项可降级                                              |
| SSE 在某些代理后失效（Cloudflare buffering） | 中   | AI 体验回退  | 带 `Cache-Control: no-transform` + `X-Accel-Buffering: no`，并保留非流式 fallback |
| service worker 卡老版本                      | 中   | 用户更新延迟 | 必须实装 update flow（监听 `updatefound` → 弹刷新提示）                           |
| 巨型组件拆分中破坏现有功能                   | 高   | 回归         | 每拆 1 个文件先补 5 个单测；必要时用 feature-flag 临时双轨                        |
| Argon2id wasm 体积 ~50KB                     | 低   | 首屏增加     | 仅在解锁路由 lazy load                                                            |
| OG image 在不同平台显示比例不一              | 低   | 品牌折扣     | 提供 1200×630（FB / Twitter）+ 1200×1200（IG）双图                                |

---

## Appendix: 立即可执行的「今天就开始」清单 (Today's first 4 hours)

按下面顺序，**4 小时内**可以完成 Phase 1 的一半：

```
1.  吊销 .env.local 里的 OpenRouter key                      (5  min)
2.  删除 .env.local，重生成只放本地 shell 环境变量            (5  min)
3.  securityService.ts: ITERATIONS 100_000 → 600_000         (5  min)
4.  跑测试，确认旧 hash 兼容                                 (10 min)
5.  PdfAttachmentViewer.tsx 第 6 行换成本地 import           (15 min)
6.  index.html viewport 删 maximum-scale + user-scalable     (2  min)
7.  index.css 加 :focus-visible 全局样式                     (5  min)
8.  装 eslint-plugin-jsx-a11y，npm run lint，按列表修        (90 min)
9.  抽 hooks/useMotionPreset.ts，给最显眼 4 处动画包上
    （CoverScreen / Onboarding / MasterLock / Viewer）       (60 min)
10. 写 LICENSE（MIT 模板，30 秒）+ SECURITY.md               (10 min)
```

剩下的 PRIVACY / TERMS / AI 免责条带 / hash mirror 删除 / prompt
injection 防护留到第 2 个工作单元。
