# Avatar v2 Phase 1 测试迁移说明

本阶段将运行时统一到 `avatarOntologyStore`。旧测试对应的 API 已删除；下面列出保留的安全行为及替代覆盖，避免将删除旧 API 测试误报为跳过失败用例。

| 退役测试 | 退役原因 | v2 对应覆盖 |
| --- | --- | --- |
| avatarMemory.test.ts | 双轨 CRUD、旧八类关系及独立标签存储退出运行时 | avatarOntologyStore.test.ts：统一图、谱系完整性、确认/拒绝、证据编辑保护；avatarOntologyCandidates.test.ts：显式确认链路及去重 |
| avatarMemoryScope.test.ts | 旧 scope 存储结构退出运行时 | avatarSourceEvidence.test.ts：原文可访问性、私密/锁定/封存/加密/删除/撤权；avatarOntologyStore.test.ts：权限重核 |
| avatarCandidateExpiry.test.ts | 旧候选 TTL 静默删除不再是产品行为 | avatarOntologyCandidates.test.ts：48 小时后读取仍保留候选；avatarUpgradeBoundary.test.tsx：暂停期间不挂载消费者 |

原抽取传输 DTO 和 Past 经历关系仍用于现有协议，不是旧双轨存储。Phase 1 不提前改变 Phase 3 抽取协议。旧持久化类型仅保留在 avatarLegacyTypes 与 avatarOntologyMigration* 中；旧存储键只用于迁移及显式资料库清空。

新增浏览器升级验证使用真实 AvatarUpgradeBoundary、SecurityService、IndexedDB 和 v2 仓库，在专用测试页隔离验证边界组件。它覆盖真实密码表单与加密迁移，但不能单独代替整站导航测试；首页、隐私、分身保存及未来草稿使用现有整站 E2E 验证。

完整命令、实际结果及未通过项另见本阶段验收报告；此文不声明测试已经通过。
