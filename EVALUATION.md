# VECTOR v1.0.5 上线就绪度评估

> **评估对象**：`vector-life-design-guide v1.0.5`
> **评估日期**：2026-05-01
> **评估锚点**：以"开放注册的小型公开 SaaS / 个人 PWA 上线"为基准，而非自用 demo
> **方法论局限**：视觉/审美/UX 维度的判断来自代码层信号（`index.css` 设计 token、`index.html` viewport、a11y 属性、`prefers-reduced-motion`、icon set、文案、品牌一致性等），不是真实渲染观察。如需更可信的视觉评分，请补 1-2 张 dashboard / viewer / morning-star 截图，可再做一次视觉评审。

---

## 目录

1. [评分总览](#一评分总览)
2. [各维度详细分析](#二各维度详细分析)
3. [上线前必做项 (P0)](#三上线前必做项-p0--推荐-1-2-周内完成)
4. [上线后第一波优化 (P1)](#四上线后第一波优化-p1--1-个月内)
5. [中长期沉淀 (P2)](#五中长期沉淀-p2--季度级)
6. [综合结论](#六本轮加权综合66--10目标-84)

---

## 一、评分总览

| # | 维度 | 上轮 | 本轮 | 目标 | Δ |
|---|------|------|------|------|---|
| 1 | 产品定位与差异化 | 8.5 | **8.5** | 9.0 | — |
| 2 | 视觉设计与审美 | – | **7.0** | 8.5 | – |
| 3 | 交互体验（UX） | – | **6.5** | 8.5 | – |
| 4 | 无障碍（a11y） | 3.5 | **4.5** | 8.0 | +1.0 |
| 5 | 内容/文案/信息架构 | – | **6.5** | 8.0 | – |
| 6 | 品牌一致性 / Design System | – | **5.5** | 8.0 | – |
| 7 | 技术架构与可维护性 | 6.0 | **6.0** | 8.0 | 0 |
| 8 | 安全与隐私 | 6.5 | **7.8** | 9.0 | +1.3 |
| 9 | 性能 | 7.0 | **7.0** | 8.5 | 0 |
| 10 | 可靠性与可观测性 | – | **6.0** | 8.5 | – |
| 11 | 测试与 QA | 6.5 | **7.0** | 8.5 | +0.5 |
| 12 | 文档 / 法务 / 合规 | 5.0 | **4.5** | 8.0 | -0.5 |
| – | **加权综合** | **6.4** | **6.6** | **8.4** | **+0.2** |

**一句话结论**：安全和工程化的"地基"提升明显（+1.3 / lint+format 进来了），但**"产品上线"维度（设计系统、UX、文档、法务、巨型组件）这一层几乎没有动**，部分指标反而在退化（核心组件行数继续涨）。当前是一个"个人作品很惊艳，但作为公开产品需要再补一轮"的状态。

---

## 二、各维度详细分析

### 1. 产品定位与差异化 — 8.5 / 10

#### 已经做得好

- 选题独特：local-first + zero-knowledge + 多智者 AI 回信，在"日记/反思/教练"红海里有清晰的差异化叙事。
- 产品的"灵魂"——主密码加密 + 启明星人格回信 + 七颗星人选——三件事互相强化，不是堆功能。

#### 距离 9.0 的差距

- **缺一个 30 秒可讲清的 Value Proposition**：现在的 `README.md` 全是配置说明，对一个潜在用户/投资人/合作者，第一次看不到"我为什么要用它而不是 Notion / Day One / Reflect"。建议在 README 顶部补一段"为谁、解决什么、对比 X/Y/Z"的产品白皮书段落。
- **没有锚定典型用户旅程**：1 周 / 1 月 / 1 年使用价值是什么？目前 `components/CoverScreen.tsx` 是炫酷的入场动画，但没有"试用 5 分钟就能感受到价值"的 onboarding sample data hook（`MOCK_ENTRIES` 只是占位）。

---

### 2. 视觉设计与审美 — 7.0 / 10

#### 信号

- `index.css` 定义了一套 archive / 技术风的 design tokens（`--color-archive-*`、`--accent`、`--vector-magenta`、grid 背景），有"赛博朋克 × 学术 archive"的清晰美学方向，比一般 React 模板高一个层级。
- 组件层用 `motion/react`、`@tanstack/react-virtual`、`react-markdown`、`lucide-react`、`react-pdf` 撑起了厚重的视觉细节（解码动画、几何小船、记忆碎片）。
- `components/CyberButton.tsx` 用 `clip-path-polygon` 形成了独特的按钮形态语言。

#### 距离 8.5 的差距

- **token 不全**：`index.css` 只有色彩 + 字体，**缺 spacing / radius / shadow / motion / z-index 五个 scale**。结果是 `components/CyberButton.tsx`（27–36 行）出现 `bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_20px_rgba(...)]` 这种逐文件硬编码 rgba/像素值，颜色复制粘贴而不是引用 token，未来换皮成本极高。
- **light 主题的对比度风险**：light 模式下 `--text-muted: #64748b` 配 `--background: #f8fafc` 的对比度仅 4.4:1，临界过 WCAG AA，但描述/标签广泛使用 `opacity-40/60`，叠加后会跌破 4.5:1。需要做一次系统对比度扫描。
- **没有 design system 对齐机制**：缺一个 `tokens.css` / Storybook / Figma source of truth，组件之间会越走越散。
- **品牌资产薄**：`manifest.json` 只有一组 SVG 图标重复两次，没有 maskable / 512×512 PNG，没有 OG 图，没有 favicon set，公开发布后社交分享卡片会很丑。

#### 改进建议

- **(高 ROI)** 在 `index.css` 增补 `--space-*`、`--radius-*`、`--shadow-*`、`--motion-*` 五套 token，并把 `CyberButton` / `archive-*` 全部改成 token 引用，未来换皮一行配置生效。
- 跑一次 [WebAIM contrast checker](https://webaim.org/resources/contrastchecker/) 体检，给 `--text-muted-on-light` 单独定义一个 ≥ 7:1 的值。
- 设计 1 张 1200×630 OG image + 一组 maskable icon（192/512 PNG）。

---

### 3. 交互体验（UX） — 6.5 / 10

#### 已经做得好

- 引导流（`components/Onboarding.tsx`）有密码强度条 + recovery key 强制保存确认 + guiding star 选择三步走，仪式感强。
- `components/MasterLock.tsx` 有 5 次失败 → 30s lockout，是真负责任的本地节流。
- 路由级 `lazy + Suspense`（`App.tsx` 14–22 行），首屏不会拖整个 bundle。

#### 距离 8.5 的差距

- **没有 `prefers-reduced-motion` 兜底**：仓库 grep 0 命中。整页 `motion/react` 动画对前庭功能敏感的用户、低端机、电池模式都是噪声。这是 a11y 的必修项也是 UX 必修项。
- **写作核心路径过深**：从 Cover → Onboarding（首次）/ MasterLock → Dashboard → 点 "刻录此刻" → Editor → 保存 → 回 Dashboard，最少 4 次点击 + 1 次密码输入才能写下第一行。生产应用应该提供 **"快速记录"** 入口（任何屏幕悬浮 + 键盘快捷键）。
- **AI 长输出体验**：`components/MorningStarPanel.tsx` 用 `Markdown` 一次性渲染完整回复，`/api/morning-star`（`server.ts` 333 一带）也是一次性返回，**没有 streaming**。AI 对话的体感差距，"边出字"和"等 30 秒一次性出"是天壤之别。
- **错误恢复路径单一**：`getMorningStarAnalysis` 失败时返回 `### ⚠️ 星光指引中断`（`services/geminiService.ts` 88–93 行），没有"切换 provider / 切换 persona / 重试 N 次"的恢复 UI。
- **离线/弱网体验未覆盖**：是 PWA（有 manifest），但**没有 service worker**（grep 0 命中），断网后既不能继续写、也没有 "you are offline" 提示。
- **空状态/首日体验**：新用户进 Dashboard 看到的是空网格 + `MOCK_ENTRIES`，缺一个"3 行示例反思 + 一键 try Morning Star"的样例旅程。

#### 改进建议

- **P0 给所有 motion 包装 `useReducedMotion()`**（motion/react 自带 hook），高度敏感用户立刻获益。
- **P0 实装 SSE / streaming**：OpenRouter 和 Gemini 都原生支持。AI 体验会从 6.5 直接拉到 8。
- **P1 加全局快捷键**：`⌘K` 命令面板、`⌘N` 新建、`⌘.` 锁定，参考 Linear / Raycast。
- **P1 service worker 离线壳**（仅 cache app shell + 静态资源，数据层本来就在 IDB 里）。
- **P1 首次空状态加 1 条示例反思 + 演示 Morning Star 调用**（mock 返回，避免占用配额）。

---

### 4. 无障碍（a11y） — 4.5 / 10（上轮 3.5，已有改善）

#### 已做

- `components/Dashboard.tsx` / `components/DashboardHeader.tsx` / `components/Viewer.tsx` 已经引入了少量 `aria-label`，`components/SettingsPanel.tsx` / `components/Editor.tsx` 出现了 `role="dialog/status/alert"`。
- `package.json` 接入了 `eslint` 等基础工具链。

#### 距离 8.0 的差距

- **`prefers-reduced-motion` 0 命中**（再次强调）。
- **无 `eslint-plugin-jsx-a11y`**，社区里"a11y 防漏"的标准 lint 没启用。
- **`<meta name="viewport" maximum-scale=1.0, user-scalable=no">`**（`index.html` 第 5 行）—— 直接禁掉了用户的双指缩放，对低视力用户极不友好，**WCAG 1.4.4 失败**，应当移除 `maximum-scale` 和 `user-scalable=no`。
- **键盘陷阱风险**：`components/CyberButton.tsx` 支持 `as="div"`，但没有为 div 分支同时绑定 `role="button"` + `tabIndex={0}` + `onKeyDown` 处理 Enter / Space，可能产生不可达的"按钮"。
- **Focus 可见性**：未发现自定义 `:focus-visible` 样式，Tailwind 默认 outline 在 cyan / dark 主题下接近不可见。

#### 改进建议

- 接入 `eslint-plugin-jsx-a11y` 并修复全部告警（一两小时内可清零）。
- 在 `index.css` 加一条全局 `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`。
- 移除 viewport 的 `maximum-scale` 限制。
- 给所有动画包 `useReducedMotion()`。
- E2E 接入 [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright)，把 a11y 违规变成 CI 红灯。

---

### 5. 内容 / 文案 / 信息架构 — 6.5 / 10

#### 已做

- 七语翻译齐全（zh / en / ja / ko / fr / es / de，`i18n/translations.ts`），是少见的从 day 1 国际化。
- 文案有清晰的"赛博学术"声调：`Temporal Anchor Disconnected`、`establishing link`、`engrave this moment`，构建了产品人格。

#### 距离 8.0 的差距

- **中英 mix** 充斥 UI（"System Core Failure // 系统核心崩溃"），双语写法在中国人看来"很潮"，对全球用户是"未本地化"。建议 `// 中文` 仅用于品牌入场，正文严格按 i18n 单语展现。
- **错误文案对用户不友好**：`components/ErrorBoundary.tsx` 输出 `CRITICAL_KERNEL_ERROR_0xDEADBEEF`、`services/geminiService.ts` 的"星光暂时失联"，氛围有了，但**完全没告诉用户"现在该做什么"**。生产文案应当遵循 "What happened / Why / What you can do" 三段式。
- **i18n 漂移风险**：没有翻译漂移检测脚本（zh 和 en 的 key 是否完全对齐？）。建议加 `i18next-parser` 或自写一个 "diff 七个 locale 的 keyset" 测试。

---

### 6. 品牌一致性 / Design System — 5.5 / 10

#### 信号

- 视觉风格识别度高，但**所有视觉决策都散布在组件里**，没有可被设计师查阅的中央源。
- `components/CoverScreen.tsx`（509 行）和 `components/MasterLock.tsx`（866 行）都各自维护了一套"星空 + 装饰几何"，两套实现几乎重复。
- icon 体系：`components/MorningStarPanel.tsx` 把每位智者绑定到一个 lucide icon（Musk = Rocket, Camus = Coffee, Borges = Library …），有意思但**完全没有自有插画**，名人形象用通用 icon 替代，长期看会拖低品牌质感。

#### 改进建议

- **关键**：把所有视觉常量（色 / 阴影 / 动画曲线 / 文字阶 / 按钮形态）抽到 `lib/designTokens.ts` 或 CSS 变量，**任何组件不允许写裸 hex**。
- 加一个 `components/__stories__` 或最简的 `/styleguide` 路由（仅 dev 启用），把基础组件全部呈现，方便品牌一致性自检。
- 中长期为 7 位智者画 7 张原创 portrait（哪怕是简笔几何），让"启明星"成为产品的视觉资产。

---

### 7. 技术架构与可维护性 — 6.0 / 10（上轮 6.0，**未提升**）

#### 正向

- 新拆出 `hooks/useNowTick.ts`、`useBackupImport.ts`、`useAttachmentUpload.ts`、`useViewerStars.ts`，方向是对的。
- `services/` 维持小而专的模块（filter / grouping / migration / draft / id …）。
- `appStateMachine.ts` 用 transition table 控制状态切换，是高质量实践。

#### 负向（这是本轮最不舒服的发现）

- **巨型组件不降反升**：

  | 文件 | 上轮 | 本轮 | Δ |
  |------|------|------|---|
  | `Viewer.tsx` | 1156 | **1247** | +91 |
  | `Dashboard.tsx` | 851 | **983** | +132 |
  | `MasterLock.tsx` | 720 | **866** | +146 |
  | `SettingsPanel.tsx` | – | **988** | new |

- 也就是说，**"加 hooks"** 没有同步 **"减组件"**——extracted hooks 被新增功能填了回去。
- `hooks/useDiaryData.ts`：`persistEntries / persistPrinciples / persistContainers` 已经包了 `useCallback`（好），但 `addMaterial` / `deleteMaterial` 仍闭包 `materials` 数组而不是用函数式 `setMaterials(prev => …)`，**stale closure 隐患没修**（`useDiaryData.ts` 292–314 行）。
- `App.tsx` 顶层仍然 `const { ... } = useAppStore()` 一次性解构 15 个字段，**任何字段变化触发整树重渲**，没有切换到 selector + `useShallow` 或细粒度 hook。

#### 改进建议（强烈）

- 强制立约束：**任何组件文件超过 400 行 PR 不允许 merge**（加 ESLint `max-lines` 规则）。
- 现有 4 个巨型文件至少各砍出 3 个子组件 + 2 个 hook，目标行数：
  - `Viewer.tsx` ≤ 350
  - `Dashboard.tsx` ≤ 350
  - `MasterLock.tsx` ≤ 350
  - `SettingsPanel.tsx` ≤ 350
- `useDiaryData` 全面切换函数式 setState；`App.tsx` 切换为 `useAppStore(useShallow(s => ({ … })))` 或拆 N 个细粒度 hook。
- 用 `npx knip` 跑一次未使用导出/文件/依赖，做最后的"减脂"。

---

### 8. 安全与隐私 — 7.8 / 10（上轮 6.5，本轮提升明显）

#### 已做（本轮新增）

- `server.ts` 启用 `helmet` 严格 CSP（生产分支）、`x-powered-by` off、Origin allowlist + 可选 Bearer 通过 `server/aiProxyAuth.ts` 双闸；
- 默认 bind `127.0.0.1`，`0.0.0.0` 触发警告；
- 日志脱敏 `REDACT_PATTERNS / scrubLogText`，`requestId` 关联日志；
- 客户端 `index.tsx` Sentry `sendDefaultPii: false`，加了 `beforeSend / beforeBreadcrumb` 脱敏；
- 速率限制、prompt 长度限制、JSON body 128KB 限制；
- 安全 hash 串带版本号 `pbkdf2-sha256:v1:iter:base64`，constant-time 比较。

#### 仍缺（距 9.0 的差距）

- **PBKDF2 仍 100,000 轮**（`securityService.ts` 第 11 行），距 OWASP 2026 推荐的 600,000 还有 6 倍差距，未迁 Argon2id。
- **`passwordHash` / `passwordSalt` 仍 mirror 到 localStorage**（`useDiaryData.ts` 253–263 行），XSS 即可拿到 hash 离线爆破。
- **PDF worker 仍走 unpkg CDN**（`PdfAttachmentViewer.tsx` 第 6 行），CSP `script-src` / `worker-src` 必须为它开口子，供应链 / 离线双输。
- **prompt injection 服务端无防护**：`server.ts` 343–357 行把 `req.body.prompt` 一整块转发给 LLM，`services/geminiService.ts` 在客户端拼模板，恶意日记内容可以越权操纵启明星。
- **`.env.local` 仍存在且非空**（含 `OPENROUTER_API_KEY=REPLACE_WITH_YOUR_OPENROUTER_KEY` 占位），即便是占位也属于"会被人无意间复制粘贴出去"的危险文件——建议**完全不留**，只保留 `.env.example`。
- 没有 [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) hash 校验外部字体（`index.html` 第 13 行加载 Google Fonts）。

#### 改进建议

- PBKDF2 → 600k（兼容旧 hash 已经写好，自然升级）；中长期评估 [argon2-browser](https://github.com/antelle/argon2-browser) wasm 路径。
- 移除 hash / salt 的 localStorage mirror。
- pdf.worker 改用 `import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`。
- 服务端用 XML 标签包裹用户内容、忽略其中嵌入的 system 指令（"你现在是…"模式简单 regex 拦截）。
- 删除 `.env.local`（已暴露过的 key 必须吊销重发）。

---

### 9. 性能 — 7.0 / 10

#### 已做

- 路由级 lazy、`@tanstack/react-virtual` 虚拟滚动、Vite 手动 chunk 拆分、Sentry 仅按需 init。

#### 距 8.5 的差距

- **Cumulative Layout Shift**：`components/EntryGrid.tsx` 虚拟列表 `estimateSize` 固定值，不同卡片高度差异大时会跳；建议改用 `measureElement` 自适应。
- **TypewriterText / setInterval 全局心跳**：`Dashboard.tsx` 每秒 setNow 触发整页 reconcile，建议下沉到具体卡片或用 `useSyncExternalStore` 共享一个 ticker。
- **未做 image lazyload**：附件图片直接 `<img src={base64}>`，base64 全部入内存。建议大附件切到 Blob URL + `loading="lazy"`。
- **Web Vitals 未上报**：Sentry 已经有了，但没启用 [web-vitals](https://github.com/GoogleChrome/web-vitals)，无法量化生产性能回归。
- **首屏加载未配 priority**：Google Fonts 走 `<link>`（`index.html` 第 13 行），无 `&display=swap` 之外的字体子集优化，FCP 偏慢。

#### 改进建议

- 接入 `web-vitals` → Sentry，把 LCP / INP / CLS 当生产 SLI 看；
- 附件 Blob URL 化；
- 字体本地化或仅子集（中文很贵，但 Inter + JetBrains 可以子集）。

---

### 10. 可靠性 / 可观测性 — 6.0 / 10

#### 已做

- 客户端 Sentry（`index.tsx` 21–43 行），含 PII 脱敏；
- `/api/health` 端点；
- 服务端结构化 JSON 日志、`requestId`；
- E2E 已有 3 个 spec（`api / app / backup`）。

#### 距 8.5 的差距

- **服务端无 Sentry**：`server.ts` 未捕获的异常只走 `console.error`，生产会丢失关键 trace。
- **无 graceful shutdown**：没有 `SIGTERM` handler 关 listener、清 timer，K8s / PM2 滚动发布会丢请求。
- **dist 静态资源无长缓存头**：`server.ts` 392–397 行用 `express.static(distPath)` 默认配置，hash 资源没拿到 `Cache-Control: public, max-age=31536000, immutable`。
- **无 SLO / 告警**：`/api/health` 不区分 liveness / readiness，没有依赖检查（OpenRouter 探活）。
- **数据层无备份/导出健康度**：`useBackupImport` 是手动触发，缺周期性提醒（"已 60 天未备份，是否导出加密包？"）。

#### 改进建议

- 服务端接 `@sentry/node` + `@sentry/profiling-node`；
- 加 `process.on('SIGTERM', () => server.close(...))`；
- 静态资源中间件包一层 `setHeaders` 给 `assets/*` 设 immutable；
- 把 `/api/health` 拆成 `/api/livez`（进程在）+ `/api/readyz`（依赖通），并在云端配最简告警。
- App 内增加 "最近备份距今 X 天" 横幅。

---

### 11. 测试与 QA — 7.0 / 10

#### 已做

- 37 个测试文件、约 140–155 个 case；
- 业务关键 service 全部有覆盖（filters / grouping / migration / draft / security / id）；
- 3 个 Playwright e2e（`api` / `app` / `backup`），覆盖了备份流程；
- ESLint 进来了。

#### 距 8.5 的差距

- `Viewer / MasterLock / Editor / Onboarding / MorningStarPanel` 仍然**没有专属单测**，恰恰是回归最多的区域。
- `vitest.config.ts` 有 coverage 但**无 thresholds**，覆盖率会自然漂移。
- 全仓 `data-testid` **0 命中**，e2e 全靠中文 / 英文文案匹配，文案微调即红，**i18n 调整对 e2e 是地震**。
- 缺 visual regression（如 [Chromatic](https://www.chromatic.com/) 或 Playwright `toHaveScreenshot`）。
- 缺 a11y 测试（axe）。

#### 改进建议

- 给 4 个巨型组件至少各 5 个 happy / edge case 单测；
- `vitest.config.ts` 加 `coverage.thresholds: { lines: 70, branches: 60 }`；
- 渐进引入 `data-testid`；
- 加 `axe-playwright` 一条 spec，至少卡 `serious / critical` 级违规。

---

### 12. 文档 / 法务 / 合规 — 4.5 / 10（上轮 5.0，**轻微下降**）

#### 信号

- `README.md` 仍然是"配置说明"导向，113 行里 80% 在讲 OpenRouter；
- `package.json` **没有 `license` 字段、没有 `author`、没有 `repository`**；
- 仓库**无 `LICENSE`、`PRIVACY.md`、`TERMS.md`、`CHANGELOG.md`、`SECURITY.md`、`CONTRIBUTING.md`**；
- AI 输出（启明星）**没有任何免责声明**——这对面向公众的产品在多个司法辖区（EU AI Act、加州 SB-1001）是合规风险；
- 处理用户日记内容（含敏感个人想法）但**没有隐私政策**，欧盟用户访问即违反 GDPR Art.13。

#### 改进建议（上线前必做）

- 选 license（建议 AGPL-3.0 或 MIT，看你的开源策略）并补 `LICENSE` + `package.json` 字段；
- 写 `PRIVACY.md`：明确"日记内容仅本地、AI 调用会向 OpenRouter / Google 传输 prompt 文本"；
- 写 `TERMS.md`：AI 输出仅供参考、不是医疗 / 心理咨询、不构成投资 / 法律建议；
- 写 `SECURITY.md`：报告漏洞的渠道；
- 写 `CONTRIBUTING.md` + `CHANGELOG.md`；
- 在 Morning Star 输出顶部固定免责条带。

---

## 三、上线前必做项 (P0 — 推荐 1-2 周内完成)

### 1. 安全收尾

- PBKDF2 默认 600,000 轮；
- 删除 `passwordHash / Salt` 的 localStorage mirror；
- 删除 `.env.local`，吊销已暴露的 OpenRouter key 重发；
- PDF worker 本地打包；
- 服务端给 prompt 加固定包裹 + 注入关键词拦截。

### 2. a11y 红线

- 移除 viewport 的 `maximum-scale`；
- 接入 `eslint-plugin-jsx-a11y` 修零；
- `useReducedMotion` 包所有动画；
- 加全局 `:focus-visible` 样式；
- axe-playwright 卡 serious / critical。

### 3. 法务红线

- LICENSE / PRIVACY / TERMS / SECURITY 四份 markdown；
- Morning Star 输出加 AI 免责。

### 4. 可靠性红线

- 服务端 Sentry；
- SIGTERM graceful shutdown；
- dist 静态资源 immutable 缓存头。

### 5. 品牌资产红线

- 1200×630 OG image；
- 192 / 512 maskable PNG icon；
- `index.html` 补 Open Graph / Twitter card meta。

---

## 四、上线后第一波优化 (P1 — 1 个月内)

### 6. AI 体验升级

- 启明星 SSE streaming；
- 失败重试 / 切 provider / 切 persona 的 UI；
- 命令面板（⌘K）+ 全局快捷键。

### 7. 性能可观测

- web-vitals → Sentry；
- 附件 Blob URL 化；
- 字体子集化或本地化。

### 8. PWA

- service worker 离线壳；
- "X 天未备份" 提醒。

### 9. 代码瘦身

- 4 个巨型组件强制 ≤ 350 行；
- `addMaterial / deleteMaterial` 函数式 setState；
- `App.tsx` 切细粒度 selector；
- ESLint `max-lines: 400` 兜底。

### 10. 测试质量

- Viewer / MasterLock / Editor / Onboarding / MorningStarPanel 单测；
- coverage 阈值 70 / 60；
- data-testid 替换文案匹配。

---

## 五、中长期沉淀 (P2 — 季度级)

### 11. Design System

- `tokens.css`（color / spacing / radius / shadow / motion 全 scale）；
- `/styleguide` 页面或 Storybook；
- 7 位智者原创 portrait；
- 重复"星空背景"统一抽组件。

### 12. 产品延展

- 首日空状态 + 示例 morning-star；
- 小型分享 / 导出图（让用户能在 IG / 小红书晒一段反思）；
- Argon2id 评估；
- 手机端 PWA install 卡片引导。

---

## 六、本轮加权综合：6.6 / 10（目标 8.4）

- **离上线**：还差一波约 2 周的"产品化收尾"——安全 + a11y + 法务 + 品牌资产 + 可靠性。
- **离优秀**：还差一个季度的 Design System + AI streaming + 巨型组件拆分 + Storybook。

### 最值得动手的三件事（按 ROI 排序）

1. **PBKDF2 600k + 删 hash 镜像 + 删 `.env.local` + PDF worker 本地化** — 半天，安全分 +1.0
2. **`useReducedMotion` + viewport 修复 + 接入 jsx-a11y + 全局 focus-visible** — 半天，a11y 分 +2.5
3. **LICENSE / PRIVACY / TERMS / SECURITY 四份 + Morning Star 免责条** — 一天，合规分 +3.0

完成上述三项，加权综合可在 1-2 天内拉到 ≈ **7.5**，达到"可对外公开 beta"的最低门槛。

---

## 附录：方法论与口径

- **打分锚点**：以"开放注册的小型公开 SaaS / 个人 PWA 上线"为基准。打分**不**等同于"代码质量分"，而是"距离能上线 1.0"的距离。
- **数据来源**：本轮静态扫描 `package.json`、`server.ts`、`server/aiProxyAuth.ts`、`services/securityService.ts`、`services/diaryStorage.ts`、`hooks/useDiaryData.ts`、`App.tsx`、`stores/appStore.ts`、`index.html`、`index.css`、`manifest.json`、`vite.config.ts`、`vitest.config.ts`、`playwright.config.ts`、`i18n/translations.ts`、4 个巨型组件、新增 hooks。
- **未观察到的维度**：真实视觉渲染、真实交互流畅度、真实 AI 调用质量、移动端实测、安卓 / iOS PWA 装机率。建议补 1-2 张 dashboard / viewer / morning-star 截图后做一次视觉 review。
