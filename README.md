# VECTOR：矢量人生经验进化系统

> VECTOR 是一个本地优先的个人经验与成长 PWA。
>
> 当前产品主线已经收敛为：**现在记录 → 过去回看与沉淀 → 未来设计与践行 → 分身理解自己**。
>
> 所有日记、素材、原则、容器、主密码校验数据都优先保存在你的设备中。使用 AI 功能时，请求内容及必要上下文会发送给所配置的模型服务；本地存储与外部模型处理是不同的数据边界。

## 当前能力

- **Now**：统一的新建记录入口，支持快速记录、标签/事件整理、素材记录与分身对话入口。
- **Past**：响应式过去记录模块，在桌面与移动端统一承担读取、搜索、回顾、归档，以及用户手动维护原则。
- **Future**：设计愿景、目标与行动规划，在践行中记录行动的实际结果。
- **Avatar / 分身**：通过对话综合当下记录、过往经历、原则与未来目标，帮助用户理解处境、行为模式、困境的成因和长期影响。分身提出的模式须经用户在弹窗中确认、拒绝或修正。
- **连续性保障**：记录草稿与恢复、本地加密和数据读写在底层保持可用，不占用日常操作入口。

已下线并从主代码路径移除的旧模块包括：旧 Editor、新建记录旧链路、启明星、心象、圆桌、信件模式、心象记忆管理、跨设备迁移向导、可信设备管理与高级签名备份。

## 环境要求

- Node.js 20+
- npm

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认地址：

```text
http://localhost:3000
```

## 服务端 AI 能力

当前服务端 AI 能力主要服务于分身摘要与模型列表等辅助能力。录音与语音转文字已从当前版本撤下，仅作为第二期候选计划。服务端支持以下 Provider/Key：

| Provider / 能力 | Env Key              | 用途                    |
| --------------- | -------------------- | ----------------------- |
| OpenRouter      | `OPENROUTER_API_KEY` | 可作为通用模型 Provider |
| Google Gemini   | `GEMINI_API_KEY`     | 可作为通用模型 Provider |

选择规则：`AI_PROVIDER=openrouter|gemini` 显式指定；未指定时按配置自动选择。

常用检查：

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/models
```

## 常用环境变量

```bash
AI_PROVIDER=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-3-12b-it:free
OPENROUTER_REFERER=http://localhost:3000
OPENROUTER_TITLE=VECTOR Life Design Guide
OPENROUTER_TIMEOUT_MS=60000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SENTRY_DSN=
PORT=3000
HOST=127.0.0.1
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=5
AI_ALLOWED_ORIGINS=
AI_ACCESS_TOKEN=
VITE_DEV_PORT=3000
VITE_DEV_HOST=127.0.0.1
```

> 旧版 `MORNING_STAR_*` 环境变量仍在服务端作为兼容 fallback 读取，但新部署请使用 `AI_*` 命名。

## 常用命令

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

## 安全须知

- `.env.local` 只在本机使用，不要提交、截图、打包或分享。
- 一旦 `OPENROUTER_API_KEY` / `GEMINI_API_KEY` 泄漏，请立即在对应平台吊销并重发。
- 服务端默认监听 `127.0.0.1`。如果要暴露到局域网或公网，请同时配置：
  1. `HOST=0.0.0.0`
  2. `AI_ALLOWED_ORIGINS=https://your-domain.example`
  3. `AI_ACCESS_TOKEN=一段足够长的随机 token`
- Markdown 渲染的链接、图片与内嵌媒体有协议白名单；未知 scheme 会被替换为提示文本。
- 主密码无法由服务端找回。忘记主密码意味着旧加密记录无法解开。

## 数据连续性

- 长文本记录会自动保存草稿；重新进入记录页时可恢复未完成内容。
- 本地数据使用设备端存储与主密码保护；安全与恢复机制保留在服务层，避免干扰日常记录、回看、规划和对话。
- 数据迁移、导入与完整备份格式继续由底层兼容逻辑维护，不作为日常工作区入口。

## 部署

仓库包含容器化样例：

- [Dockerfile](./Dockerfile)
- [docker-compose.yml](./docker-compose.yml)
- [deploy/nginx.conf.example](./deploy/nginx.conf.example)

示例：

```bash
SENTRY_DSN=... docker compose build

cat > .env <<'EOF'
OPENROUTER_API_KEY=sk-or-v1-xxxx
AI_ALLOWED_ORIGINS=https://vector.example.com
AI_ACCESS_TOKEN=please-generate-a-long-random-string
EOF

docker compose up -d
```

非容器部署：

```bash
npm ci --omit=dev
NODE_ENV=production OPENROUTER_API_KEY=... HOST=127.0.0.1 npx tsx server.ts
```

生产环境建议用 nginx / Caddy / Traefik 终止 TLS，并用 systemd / pm2 / Docker supervisor 托管进程。

## 数据可靠性提示

- 单个附件 ≥ 5MB 会显示软提示；> 100MB 会被拒绝。
- entries 序列化过大时，IndexedDB 仍写入，但 localStorage 镜像会跳过；此时建议手动导出备份。
- IndexedDB 写入失败会显示同步错误，建议先复制原文再排查浏览器存储空间或权限问题。

## 历史文档

早期路线图、评估报告和产品愿景仍保留在仓库中，方便追溯项目演化。但它们可能描述已经下线的实验功能，不代表当前产品事实。

入口见：[docs/archive/README.md](./docs/archive/README.md)。
