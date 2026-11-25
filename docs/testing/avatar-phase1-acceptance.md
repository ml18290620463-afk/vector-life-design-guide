# Avatar v2 Phase 1 验收报告

日期：2026-11-25。工作区：`.latest/vector-github`。仅交付 Phase 1，等待人工验收，不进入 Phase 2。

本阶段实现已收口；最终静态检查、全量单测及指定专项 E2E 通过。**全量 E2E 不全绿：完整执行 124 项，82 通过、42 失败。** 全量运行启动于最后一轮修复之前，最终代码的专项复测为 53/53；不能将两批结果拼接为全量通过。日志位于 [证据目录](avatar-phase1-evidence/)。

## 本阶段完成项

- [x] 统一 CognitiveObject 与四种 OntologyEdge，业务读取、确认、修订、删除与会话持久化使用 v2 仓库；提供谱系和修订投影。
- [x] 确认链路区分 about_me 用户明确原话与 my_understanding 推断。推断门槛为“至少两条独立记录或三条不同用户消息”且“跨日期或跨会话”；防重复证据累计，assistant 不能作为事实证据。用户编辑需重新核验并显式确认。
- [x] 来源权限实时重核、显式传递权限 token、请求前后及事务提交时会话复核；源删除影响接口和修订链完整性校验。
- [x] 无密码且无旧数据初始化空库；有旧数据且无密钥暂停消费者，密码 CTA 接入现有设密流程，成功后重新校验并迁移；锁定与快照校验失败阻断提交。暂停时不挂载抽取、写入及清理消费者。
- [x] 备份、恢复、账户快照与同步切换到统一图；旧备份经密钥和加密快照验证后迁移，不回灌旧运行时存储。恢复事务内复核当前账户及会话。
- [x] “我的变化”仅投影确认的观点修订，保留“不代表已经证明的成长”提示，无手动新增入口。
- [x] 修复分身会话重复自动保存：相同序列化内容不会因数组引用变化重复写入，组件回归覆盖连续 rerender。

版本号区分：外层 VaultBackup 为 `schemaVersion: 3`，认知图为 `ontologySchemaVersion: 2`，加密信封版本不变；不能把外层版本误写为 2。

## 变更文件清单

以下按实现职责列出本阶段核心文件。工作区此前已有大量未提交改动，[完整 Git 状态](avatar-phase1-evidence/workspace-status.txt)包含继承变更，不将全部 dirty 文件宣称为本阶段新增。

| 状态 | 文件 / 文件组 | 改动 |
| --- | --- | --- |
| 新增 | services/avatarOntologyStore.ts、avatarOntologyTransaction.ts、avatarOntologyValidation.ts、avatarOntologyConfirmation.ts、avatarOntologySessionGuard.ts、avatarOntologyKey.ts | 统一图存储、事务、校验、确认和会话守卫 |
| 新增 | services/avatarOntologyCandidates.ts、avatarOntologySessions.ts、avatarOntologyContext.ts、avatarOntologyArchive.ts、avatarOntologySourceDeletion.ts | 候选、会话、上下文、历史归档、删源影响 |
| 修改/拆分 | services/avatarOntologyMigration.ts、avatarOntologyMigrationConversion.ts、avatarOntologyMigrationCheckpoint.ts、avatarLegacyTypes.ts | 安全迁移、只读旧类型、加密快照 |
| 新增 | services/avatarOntologyBackup.ts、avatarOntologyBackupCheckpoint.ts、services/account/snapshotOntology.ts | v2 备份与账户图校验 |
| 修改/拆分 | services/vaultBackup.ts、vaultBackupEntries.ts、vaultBackupNormalization.ts、vaultBackupRecovery.ts、vaultBackupSummary.ts；services/account/snapshot.ts、sync.ts、recovery.ts | 备份恢复与同步消费者切换、事务复核 |
| 修改 | features/avatar/types.ts；services/avatarSourceEvidence.ts、aiPrivacy.ts、avatarEvidenceMetrics.ts、avatarEvidenceDialogue.ts、avatarDataLinkage.ts、avatarGuidanceSources.ts、avatarGuidance.ts、guidanceResults.ts、sourceDeletion.ts、vaultWipe.ts | 类型、权限及直接数据消费方改造 |
| 新增 | features/now/components/AvatarUpgradeBoundary.tsx 及测试；e2e/avatar-upgrade.spec.ts | 暂停、密码入口、设密恢复与边界测试 |
| 修改 | features/now/components/AvatarChatPage.tsx、AvatarMemoryLibrary.tsx、AvatarMemoryConfirm.tsx、AvatarMemoryDetail.tsx；features/now/hooks/useAvatarMemoryCapture.ts；features/now/state/avatarMemoryReferences.ts、avatarGuidanceContext.ts；features/now/NowFlow.tsx | 统一仓库消费、明确确认、升级挂点 |
| 删除 | services/avatarMemory.ts、avatarMemoryShared.ts、avatarMemoryAtoms.ts、avatarMemoryUnderstandings.ts、avatarMemoryRelations.ts、avatarMemorySessions.ts、avatarMemoryArchive.ts、avatarKnowledgeProjection.ts；features/now/components/AvatarMemoryTagManager.tsx | 旧双轨 CRUD 与废弃 UI/投影 |
| 测试迁移 | 对应 avatarOntology*.test.ts、account/snapshotOntology.test.ts、相关权限/组件测试；e2e/avatar-functional.spec.ts、avatar-memory-archive.spec.ts、experience-layout.spec.ts、theme-v1.spec.ts 及首页/隐私入口适配 | 替换旧夹具，保留业务断言；theme-v1 保留 600 消息场景并新增编辑器可见断言 |
| 文档 | 本报告、avatar-phase1-test-migration.md、avatar-phase1-evidence/ | 命令、日志、退役测试覆盖映射 |

本轮末尾仅额外修改 theme-v1 分身夹具及验收证据文件，未修改无关业务模块。

## 历史残留清理进度

- **CL-01：完成运行时清理。** 旧类型名称仅在 `avatarLegacyTypes.ts` 与 `avatarOntologyMigrationConversion.ts` 命中，共 8 处。旧 CRUD 名称和旧 Store 导入无命中（rg 退出码 1 表示未找到）。
- **CL-02：完成运行时清理。** 旧关系枚举仅保留为只读迁移类型；业务采用四种强类型边，类型检查通过。
- 原抽取 DTO 仍用于现行传输协议，非双轨存储；Phase 3 协议未提前实现。CL-03 至 CL-09 不在本阶段宣称完成。
- 退役测试的替代覆盖见 [测试迁移说明](avatar-phase1-test-migration.md)，不是通过 skip 规避失败。

实际扫描：

```sh
rg -n 'AvatarUnderstandingVersion|AvatarAtomicMemory|AvatarMemoryRelationKind' services features types --glob '!*.test.*'
rg -n 'saveUnderstanding|updateUnderstanding|deleteUnderstanding|saveAtomicMemory|updateAtomicMemory|deleteAtomicMemory|from .*avatarMemory(Atoms|Understandings|Relations|Shared)' services features components hooks server
rg -n 'AvatarUnderstandingVersion|AvatarAtomicMemory|AvatarMemoryRelationKind|saveUnderstanding|saveAtomicMemory' --glob '!package-lock.json' --glob '!docs/**' --glob '!dist/**' --glob '!playwright-report/**' --glob '!test-results/**'
```

输出见 [legacy-audit.txt](avatar-phase1-evidence/legacy-audit.txt) 与 [legacy-wide-scan.txt](avatar-phase1-evidence/legacy-wide-scan.txt)。

## 真实测试与构建结果

| 命令 | 实际结果 | 日志 |
| --- | --- | --- |
| npm run typecheck | exit 0；最后夹具修改后再次通过 | typecheck-post-theme.log |
| npm run lint | exit 0；最后夹具修改后再次通过 | lint-post-theme.log |
| npm run build | exit 0 | build.log |
| npm test -- --maxWorkers=1 | 204 文件、1534 测试全部通过，197.44s | unit.log |
| 完整 Playwright，下列命令 | 124 项：82 通过、42 失败，48.6 分钟 | full-e2e.log |
| 最终专项，四条命令如下 | 47 + 2 + 2 + 2 = 53 项全部通过 | special-e2e.log、future-drafts-e2e.log、avatar-layout-e2e.log、avatar-theme-e2e.log |

```sh
E2E_PORT=3910 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- --workers=1 --output=/tmp/vector-phase1-e2e-final-1125b
E2E_PORT=3912 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- e2e/avatar-functional.spec.ts e2e/avatar-upgrade.spec.ts e2e/avatar-memory-archive.spec.ts e2e/avatar-guidance.spec.ts e2e/avatar-model-settings.spec.ts e2e/ai-privacy.spec.ts e2e/ai-request-boundary.spec.ts e2e/app.spec.ts e2e/first-run-bilingual.spec.ts e2e/future-privacy.spec.ts --workers=1 --output=/tmp/vector-phase1-special-frozen
E2E_PORT=3912 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- e2e/future-functional.spec.ts --grep '未来草稿刷新' --workers=1 --output=/tmp/vector-phase1-draft-frozen
E2E_PORT=3912 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- e2e/experience-layout.spec.ts --grep avatar --workers=1 --output=/tmp/vector-phase1-layout-frozen
E2E_PORT=3914 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- e2e/theme-v1.spec.ts --grep avatar --workers=1 --output=/tmp/vector-phase1-theme-final
```

专项用例与结果单列：

| 要求 | 对应覆盖 | 真实结果 |
| --- | --- | --- |
| 无密码旧用户暂停与升级 | avatar-upgrade.spec.ts 旧用户用例；AvatarUpgradeBoundary.test.tsx | 浏览器用例通过；组件 7/7 |
| 新用户无密码初始化 | avatar-upgrade.spec.ts 新用户用例 | 通过 |
| 锁定阻断 | avatar-upgrade.spec.ts 锁定用例；边界、仓库、会话守卫与备份测试 | 浏览器用例通过；相关单测包含在 1534/1534 |
| 备份恢复 | avatarOntologyBackup 9、BackupCheckpoint 3、MigrationBackup 6 | 18/18；完整 E2E 的备份用例亦通过 |
| 账户同步 | account/snapshotOntology 3、account/sync 15 | 18/18 |
| 桌面/移动未来草稿刷新 | future-functional.spec.ts 对应两项 | 2/2 |

精确测试名称见 [special-test-map.txt](avatar-phase1-evidence/special-test-map.txt)。升级 E2E 在隔离测试页挂载真实边界、密码表单、加密与 IndexedDB；它验证迁移闭环，但不能独立证明整站设置导航的所有路径。整站首页/分身/隐私由另外的专项覆盖。

执行异常如实记录：此前一次串行单测有 1 个加密检查点超时，移除并发负载后完整重跑 1534/1534，未放宽断言或超时；此前日志保留为 previous-unit-timeout.log。全量 E2E 的 worker 曾无浏览器挂起约六分钟，经 TERM 后 runner 继续，最终全部 124 项有结果。最后 theme 测试首次启动因沙箱禁止监听端口失败，随后获工具批准用独立端口 3914 执行，两项通过；环境启动失败不计为测试通过。

## 风险与待确认项

全量 E2E 的 42 项失败逐项名称见 [full-e2e-failures.txt](avatar-phase1-evidence/full-e2e-failures.txt)。其中 14 项已由最终专项通过覆盖（首页隐私 1、分身功能 4、档案 3、升级 3、浅色布局 2、深色分身 1）；**其余 28 项没有在最终代码上重新完整验绿**，不能宣称全部是既有缺陷。

| 剩余失败组 | 数量 | 已观察到的失败点 / 归因边界 |
| --- | --- | --- |
| future-feedback-hierarchy、future-session | 5 | 旧“确定”保存按钮流程与当前“保存”不一致 |
| future-layout-data | 1 | 等待“从愿景开始”入口失败 |
| future-mobile-navigation | 4 | 预期 2 个 Tab，实际 3 个 |
| future.spec | 6 | 找不到旧“未来功能”导航，未到后续业务断言 |
| language-options | 1 | 旧 select 选项断言与当前语言切换入口不一致 |
| now-material-integrity、past-supplements、three-record-audit | 5 | 点击保存后未抵达 past-page；需继续确认现行 AI 权限弹窗流程，不能据此断言保存丢失 |
| past-patterns-data | 2 | 旧模式卡片与旧理解夹具；HEAD 已仅 timeline/principle，不恢复废弃界面 |
| past-reading-data | 2 | 记录按钮数量预期 0，实际 1；UI 断言差异，未擅改 |
| theme-v1 mobile now | 1 | 无关 NOW 布局失败，保留待独立处理 |
| visual cover | 1 | 首页截图与基线不同，未自动更新图片基线 |

上述无关模块未为追求全绿而改写业务或删除断言。需要验收者基于允许的范围保护评估这些未决项；本报告不宣称全量发布就绪。当前暂停在 Phase 1 验收，不进入 Phase 2。
