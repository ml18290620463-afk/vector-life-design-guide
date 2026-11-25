# Avatar v2 Phase 2 验收报告

## 本阶段完成项

- [x] 统一 `AVATAR_GUIDANCE_POLICIES`，完成本地权限过滤、到期过滤、标签/意图相关性排序、分槽配额、空槽顺延、去重与最低相关性截断。
- [x] 自动收缩：小窗口模式、长会话轻追问收缩至最多 2 条；跨周期、长目标及手动扩大范围采用扩展配额。
- [x] 700 字符摘录、120 消息上限；客户端和服务端使用同一场景策略，服务端拒绝超额请求。
- [x] 阶段状态到期通过统一 v2 仓库沉降为 `archived_expired`，保留对象、证据与修订链，重复执行不产生额外写入；锁定态禁止提交。到期时间等于当前时间也进入沉降。
- [x] 回答下方参考白盒展示数量、分类、时间范围、标签及零命中说明；预览原始记录时再次校验实时权限，避免展示陈旧摘录。
- [x] 发送前资料快检和剔除入口；展示当前服务商外发及中止无法撤回提示；剔除项不进入请求体。
- [x] 会话、账户、仓库权限变更立即中止请求；请求前后复核 token，丢弃失效响应。
- [x] 本阶段不实施 Phase 3 增量抽取协议、调度器及 Phase 4 整体记忆库/设置改版。

### 配额

| 模式 | 默认 | 放宽 | 关于我 / 我的认识 / 原始记录与未来 |
|---|---:|---:|---|
| capture | 3 | 3 | 1 / 0 / 2 |
| general | 6 | 12 | 2 / 2 / 2 |
| distill | 8 | 12 | 2 / 2 / 4 |
| recall | 10 | 16 | 1 / 2 / 7 |
| decide | 12 | 16 | 4 / 4 / 4 |
| review | 12 | 20 | 2 / 4 / 6 |

## 变更文件清单

以下按本阶段职责列出，不将既有工作区改动计作本阶段成果。

新增：
- `services/avatarGuidancePolicy.ts`、`services/avatarGuidancePolicy.test.ts`：集中策略、槽位选择、检索清单及六模式/冷启动测试。
- `e2e/avatar-phase2.spec.ts`：浏览器网络负载配额、用户剔除、锁定及撤权中止。
- 本报告与 `docs/testing/avatar-phase2-evidence/` 验收证据。

修改（含前阶段已在工作区存在、尚未提交的文件）：
- `features/now/components/AvatarChatMessage.test.tsx`：来源撤权后不显示陈旧内容。
- `services/avatarGuidance.ts`：替换旧混排裁剪及关联扩充逻辑，保留行动→目标→愿景关系。
- `services/avatarGuidanceSources.ts`、`services/avatarOntologyContext.ts`：统一仓库来源、标签、领域、历史及权限诊断。
- `services/avatarOntologyStore.ts`、`services/avatarOntologyStore.test.ts`、`services/avatarOntologyContext.test.ts`：到期沉降及边界测试。
- `features/now/state/avatarGuidanceContext.ts`、对应测试：问题检索、场景判定与 manifest。
- `features/now/api/avatar.ts`：动态配额、摘录/消息上限、剔除、仅本地导航元数据剥离。
- `features/now/api/avatarRequest.ts`、对应测试：订阅撤权、立即中止、前后复核。
- `features/now/components/AvatarChatPage.tsx`、`AvatarChatSurface.tsx`、`AvatarChatMessage.tsx`：快检、扩大范围、白盒及实时预览；快检置于聊天滚动容器内，避免将输入区推到导航下方。
- `features/now/types/now.ts`：消息携带本次检索 manifest。
- `server/avatarChatRoutes.ts`、对应测试、`server/avatarGuidanceContext.ts`：服务端模式配额与 700 字符边界校验，新增 7 条服务端用例。

`services/guidanceResults.ts` 已在 Phase 1 完成模型适配，检查后无需重复改写。无整文件删除；旧函数和旧固定上限已在原文件中删除。

## 历史残留清理进度

- [x] CL-03：`expandGuidanceAssociations`、`MAX_GUIDANCE`、`GUIDANCE_LIMIT` 在业务源码及全仓代码检索均为 0 命中。
- [x] 核心 guidance 链路的 `.slice(0, 12)`、旧 2/4 单槽裁剪为 0 命中。
- `rg` 无命中返回码为 1，属于成功确认无残留。完整命令及原始结果见 `avatar-phase2-evidence/cl03-audit.txt`。
- 场景配置中的 12 是动态策略值，不是全局上限。`features/now/api/avatar.ts` 的 `.slice(-12)` 与服务端抽取分支的 12 属于 Phase 3 抽取协议范围，保留不越界；非 guidance 的摘要/名称长度 12 不属于 CL-03。

## 真实测试与构建结果

工作目录：`.latest/vector-github`。以下检查在最后业务代码修改后执行：

```sh
npm run typecheck && npm run lint && npm run build && npm test -- --maxWorkers=1
```

- typecheck：通过，退出码 0。
- lint：通过，`--max-warnings=0`，退出码 0。
- build：通过，2996 modules，5.58 秒。存在静态/动态导入及 caniuse-lite 数据陈旧提示，不影响构建。
- 全量 Vitest：**205 文件 / 1555 用例全部通过**，191.81 秒，退出码 0，无跳过用例。日志 `avatar-phase2-evidence/unit-final.log`。
- 初次沙箱单测因 Supertest 无法监听本地端口，产生 40 条失败；允许本地监听后完整重跑通过，未跳过或削弱用例。原始日志 `unit-sandbox-failure.log` 保留。最终日志有 happy-dom 测试资源请求中止输出，但没有失败用例。

专项 E2E 均使用 Chrome、workers=1，串行执行，独立输出目录：

```sh
E2E_PORT=3914 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- \
  e2e/avatar-phase2.spec.ts e2e/avatar-functional.spec.ts e2e/avatar-upgrade.spec.ts \
  e2e/avatar-memory-archive.spec.ts e2e/avatar-guidance.spec.ts \
  e2e/avatar-model-settings.spec.ts e2e/ai-privacy.spec.ts \
  e2e/ai-request-boundary.spec.ts e2e/app.spec.ts e2e/first-run-bilingual.spec.ts \
  e2e/future-privacy.spec.ts --workers=1 --output=/tmp/vector-phase2-special-final
```

首次 **48 通过 / 2 失败**，4.5 分钟。分身、Phase 2 网络边界、升级、AI 隐私及首页全部通过。两条失败均为 Future 隐私用例保存愿景后点击“添加目标”超时；未修改 Future 业务或测试断言。

```sh
E2E_PORT=3914 E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- \
  e2e/future-privacy.spec.ts e2e/future-functional.spec.ts \
  e2e/experience-layout.spec.ts e2e/theme-v1.spec.ts \
  --grep 'future consent|未来草稿刷新|avatar' --workers=1 \
  --output=/tmp/vector-phase2-regression-final
```

复测及追加回归 **8 / 8 通过**，56.7 秒：两条 Future 隐私、390px/1440px 未来草稿刷新、桌面/移动分身布局及主题布局。两批覆盖 **56 条不同用例，最终均有通过记录**；不将首次 50 条运行宣称为一次全绿。完整日志见 `e2e-special.log`、`e2e-regression.log`。

测试重点：六模式默认/放宽及冷启动；capture ≤3、review 达20；标签、噪声、槽位及空槽顺延；700/120边界；到期相等、幂等与锁定；撤权不展示陈旧内容；真实浏览器外发排除及中止响应。新增网络 E2E 通过浏览器内调用生产 API 边界并断言网络请求，不等同于完整手动点击快检全过程覆盖。

## 风险与待确认项

- 首次 Future 隐私两条超时独立复测通过；保留波动记录，不修改无关业务。
- 前阶段 28 条非分身历史 E2E 失败沿用已批准的归因策略；本阶段运行专项而非重新运行全部历史 E2E。
- 页面打开期间发生到期沉降，会更新仓库 token；已有旧 token 请求失败关闭，可能需要重试，未放宽权限核验。
- 无密码旧用户升级整站真实导航 CTA 跳转与返回冒烟保留为 Phase 4/5 前置提醒（本阶段沿用已验收的隔离页覆盖）。
- Phase 2 开发与验证完成，等待验收；未进入 Phase 3。
