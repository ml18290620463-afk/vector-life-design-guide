# VECTOR 模型分析交接说明（2026-11-22）

## 当前版本

此源码与本次 GitHub 提交一致。当前使用的开发源码来自 `.refinement/stable`，已作为仓库根目录导出；不要再切回旧工作目录根部源码。

## 产品方向

让个人经历帮助当下选择。保留自然记录、倾诉和陪伴，不强迫所有记录变成行动计划。不增加人格或成长总分。

## 本次变更

- 各模型请求共享 VECTOR 工作协议，保持产品身份、数据权限和候选确认边界；明确追问技术来源时如实回答。
- 分析结合构成因素、外部条件和时间变化，比较经验适用条件。
- 已结束行动的实际反馈可参与新选择的检索；日期范围检索包含反馈发生日期。
- 原则最多四条反馈中保留一条明确无效或不适用的反例。
- 完成不等于有效，取消或未执行不等于无效；长期记忆改写仍需用户确认。

## 重点入口

- services/avatarWorkProtocol.ts：跨模型工作协议
- services/avatarBehaviorStandard.ts：分析与对话规则
- services/avatarGuidanceSources.ts：授权来源、原则适用情境、反馈组装
- services/avatarGuidance.ts：检索与时间范围
- services/guidanceResults.ts：反馈选择
- features/now/state/avatarGuidanceContext.ts：对话上下文选择
- server/avatarChatRoutes.ts：聊天代理
- server/avatarFactExtraction.ts：候选提炼

## 本机启动

Node.js 22，先 npm ci。
构建：npm run build -- --configLoader runner
运行构建版：VECTOR_SERVE_BUILD=1 HOST=127.0.0.1 PORT=3010 npm run dev
查看：http://127.0.0.1:3010/now?preview=web
类型检查：npm run typecheck
测试：npm test -- --configLoader runner
环境配置参考 .env.example 和 .env.supabase.example；源码包不携带真实服务密钥或浏览器个人数据。

## 验证与待评估事项

本轮 53 项相关测试、类型检查和生产构建通过，本机页面 HTTP 200。
真实模型对话尚未验收。新增分析要求是提示规则，不是模型行为保证。
建议重点评估：情境相关检索仍以文本匹配为主；有限反馈预算只保留一条反例；取消/部分完成与实际效果能否被模型正确区分；纯倾诉不被强制安排任务；隐私撤销是否贯穿关联资料；切换模型后规则执行是否一致。

## 交给其他模型的分析任务

请先阅读代码并核对真实实现，按严重度列出有证据的问题及文件位置。优先检查数据隔离、隐私授权、检索遗漏、反馈解释、候选确认和用户体验。提出具体修复与验证方法，区分已实现能力、提示层约束和未来设想，不凭产品文案推断能力。
