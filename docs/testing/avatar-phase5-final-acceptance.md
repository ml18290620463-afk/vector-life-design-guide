# Phase 5 暨 VECTOR 分身 v2 最终总验收报告

日期：2026-11-25。范围：当前 `.latest/vector-github` 工作区；原有大量未提交改动均保留。本报告记录工程重构验收，真实模型在线量化评测独立执行。

## Phase 0–5 完成总览

| 阶段 | 完成范围 |
| --- | --- |
| Phase 0 | 仓库与测试基线、迁移契约和安全边界核对 |
| Phase 1 | 统一 v2 权威仓库、旧数据安全迁移、无密码旧用户暂停升级、备份恢复与账户同步 |
| Phase 2 | 权威直读检索、动态配额、到期沉降、白盒检索清单 |
| Phase 3 | 增量抽取、证据融合、冲突分叉与确认写入、候选收件箱、并发来源复核 |
| Phase 4 | 统一确认卡片、记忆库与设置分离、删除墓碑和交互 E2E |
| Phase 5 | 故障矩阵适用性终检、CL-09 死代码清理、全仓残留核查、工程门禁与评测脚本模拟校验 |

## 本阶段完成项与变更文件

- 删除 `features/now/components/AvatarRecordPanels.tsx` 中仅由旧测试引用的 `AvatarUnderstandingCard` 及未使用图标；从 `AvatarRecordPanels.test.tsx` 删除对应孤立测试。保留 `RecordPreviewCard`、`AvatarGrowthDraftCard` 和 `AvatarMemoryConfirm`：它们仍由现行界面引用，内部使用 `UnifiedArtifactCard`，属于必要业务薄封装。
- 更新 `docs/architecture/avatar-implementation-constraints.md`：v2.0 权威直读适用性声明与 FI 矩阵一致。没有新增异步派生索引或缓存。
- 修复 `e2e/avatar-functional.spec.ts` 中分身入口 helper 的导航等待时序，避免页面仍在切换至过去页时点击分身。
- 新增本报告。

## CL-01～CL-09 历史残留终检

原始核查输出：`/tmp/vector-phase5-final-cl-audit.log`。执行命令形式：`rg -l --glob '*.{ts,tsx}' '<pattern>' features services server e2e tests`；各模式及命中文件见原始日志。进一步精确核查：

```sh
rg -n "'serves'|\"serves\"|\bMAX_GUIDANCE\b|\bGUIDANCE_LIMIT\b|\bexpandGuidanceAssociations\b|\bAvatarUnderstandingCard\b|\bCANDIDATE_TTL\b|\b24_HOUR\b" features services server e2e tests --glob '*.{ts,tsx}'
rg -n 'LegacyAvatarUnderstandingVersion|LegacyAvatarAtomicMemory' features services server --glob '*.{ts,tsx}'
```

| 项 | 终检结论 |
| --- | --- |
| CL-01 | 旧双轨类型仅命中 `avatarLegacyTypes.ts` 与 `avatarOntologyMigrationConversion.ts`，均为获准的只读迁移边界；运行时旧 Store/双写未见命中。 |
| CL-02 | 旧 `serves` 在只读迁移类型和迁移/拒绝非法边测试中命中 3 处；权威 v2 边未采用该值。宽泛英文 `serves` 会误命中普通测试文本，不能作为清零依据。 |
| CL-03 | `MAX_GUIDANCE`、`GUIDANCE_LIMIT`、`expandGuidanceAssociations` 零命中。现行 `AVATAR_GUIDANCE_POLICIES` 为动态配额。 |
| CL-04 | `CANDIDATE_TTL`、`24_HOUR`、`24H_EXPIR` 零命中；未发现旧 24 小时强制清理符号。 |
| CL-05 | `forbidden_event_or_commitment` 仍作为违规抽取输出的拦截原因存在，属于必需安全校验；旧 experience/commitment 入库分支不应据此误判为保留。 |
| CL-06 | `AvatarUnderstandingCard` 清理后零命中；`UnifiedArtifactCard` 被四类现行产物卡片复用。 |
| CL-07 | 管理功能在设置中心；旧文案在测试及跳转链接中有命中，不构成主工作区内嵌 Tab。 |
| CL-08 | `searchScope`、`selectedCategory`、`activeCategory` 旧受限搜索模式零命中；现行跨分类搜索和标签筛选由组件测试覆盖。 |
| CL-09 | 孤立旧卡片及仅验证该组件的测试已删除；TypeScript、Lint 和全量测试门禁用于检出剩余未引用符号及孤立测试。未将仍被调用的业务包装组件误删。 |

## 故障矩阵与适用性

v2.0 从统一权威仓库直读，**不存在独立异步派生索引/持久检索缓存**。FI-01 的在途撤权/修订、旧响应交付前丢弃和后续过滤仍必测；索引 Epoch 失效标记与重建 CAS 是 v2.0 N/A。FI-02 异步索引重建全项为 v2.0 N/A。未来引入向量索引或持久缓存时必须先完成这两项准入门禁。当前 81 项测试不宣称覆盖不存在的索引时序。

| 项 | v2.0 覆盖 |
| --- | --- |
| FI-01 | `aiPrivacyProtectedRead.test.ts`、`avatarOntologySessionGuard.test.ts`：在途来源修订/锁定/撤权与交付前权限复核；索引部分 N/A。 |
| FI-02 | N/A，未引入独立异步索引。 |
| FI-03 | `avatarOntologyStore.test.ts`：确认写入、版本冲突、修订边与证据原子性。 |
| FI-04 | `avatarOntologySessionGuard.test.ts`、`aiPrivacyProtectedRead.test.ts`：锁定/重解锁 ABA、会话和 token 变更阻断。 |
| FI-05 | `avatarOntologyBackup.test.ts`、`deletionTombstone.test.ts`：旧备份命中删除/撤权墓碑的拦截和恢复边界。 |

故障边界目标运行日志：`/tmp/vector-phase5-fi-targeted.log`，7 文件 / 81 测试通过。

## 工程验证与原始日志

| 命令 | 结果 | 日志 |
| --- | --- | --- |
| `npm run typecheck` | CL-09 清理后通过 | `/tmp/vector-phase5-final-typecheck.log` |
| `npm run lint` (`eslint . --max-warnings=0`) | CL-09 清理后通过，零 warning | `/tmp/vector-phase5-final-lint.log` |
| `npm run build` | CL-09 清理后通过 | `/tmp/vector-phase5-final-build.log` |
| `npm test -- --maxWorkers=1 --no-file-parallelism` | CL-09 清理后 211 文件、1584 测试通过 | `/tmp/vector-phase5-postclean-vitest-escalated.log` |
| `E2E_BROWSER_CHANNEL=chrome npx playwright test --project=chromium --workers=1 <专项文件列表>` | CL-09 修正测试导航等待后，单次合并串行 50/50 通过 | `/tmp/vector-phase5-postclean-e2e-final3.log` |

CL-09 清理删除了一个仅被自身测试引用的旧卡片，所以最终单测数由清理前 1585 变为 1584。清理后首次单测在沙箱内因 Supertest 监听端口被拒（`listen EPERM 0.0.0.0`），产生 47 条环境失败；原始日志 `/tmp/vector-phase5-postclean-vitest.log`，没有跳过。获准在可监听本地端口的环境重跑后 211 文件 / 1584 测试全部通过。清理前完整通过日志仍可查：typecheck `/tmp/vector-phase5-typecheck-final2.log`、lint `/tmp/vector-phase5-lint-final2.log`、build `/tmp/vector-phase5-build-final2.log`、单测 `/tmp/vector-phase5-final-vitest-serial.log`、专项 E2E `/tmp/vector-phase5-final-e2e-final2.log`。清理后专项 E2E 前两次各有 1 条测试入口导航时序失败（分别为 49/50，日志 `/tmp/vector-phase5-postclean-e2e.log` 和 `/tmp/vector-phase5-postclean-e2e-final.log`）。失败发生在业务断言之前的测试导航阶段；在 `e2e/avatar-functional.spec.ts` 的入口 helper 等待页面 load 后，第三次单次合并串行运行 50/50 通过。最终结论以修正后的日志为准。

## 真实模型评测

`evals/avatar/real_model_eval_suite.json`：schemaVersion 1，6 案例。脚本经 esbuild 转译成功；以本地 `fetch` mock 注入并设置 `VECTOR_EVAL_MODEL_URL=https://mock.invalid/v1/chat/completions`、`VECTOR_EVAL_MODEL_ID=offline-mock`、`VECTOR_EVAL_MODEL_API_KEY=offline-mock`、`VECTOR_EVAL_REPORT_PATH=/tmp/vector-phase5-eval-mock-report.json`，执行 `node --import=/tmp/vector-avatar-eval-mock-fetch.mjs --import=tsx evals/avatar/runRealModelEval.ts`，6/6（P0 4/4）通过，模拟报告在 `/tmp/vector-phase5-eval-mock-report.json`。**该结果只验证脚本输入、请求、解析、报告及退出码，不是在线模型质量分数。**

本地真实执行（需由用户填写真实值；API Key 不要写入仓库）：

```sh
VECTOR_EVAL_MODEL_URL='https://<provider>/v1/chat/completions' \
VECTOR_EVAL_MODEL_ID='<model-id>' \
VECTOR_EVAL_MODEL_API_KEY='<api-key>' \
VECTOR_EVAL_REPORT_PATH='./evals/avatar/real-model-report.local.json' \
node --import=tsx evals/avatar/runRealModelEval.ts
```

本次环境未注入上述三项真实变量，因此在线评测待封版后本地执行。确保报告路径不提交含模型响应的敏感信息。

## 风险与待确认项

此前全量 E2E 有 28 条归因于非分身模块的历史基线失败；本轮专项 50/50 不代表全仓 E2E 100% 通过。遵照已批准范围，未修改这些无关业务模块。当前工作区已有大量未提交改动，本报告不宣称它们均属于 Phase 5，也未重置。
