# VECTOR: 矢量人生启航日志

> **VECTOR 是一个本地优先、零知识的反思日记 PWA。**
> 你写日记 + 选一位「启明星」（古今圣贤的 AI 化身：马斯克、加缪、老子……）+ 收到一封视角独到的回信。
> 所有内容 **只存在你的设备上**，用你自己的密码加密——我们的服务器看不到一个字。
>
> 给：26-38 岁有 2+ 年记日记习惯、想要 AI 教练但**不愿把日记送上云**的中文知识中产。
>
> 替代：Notion / 印象笔记 / Day One / Reflectly——它们要么没 AI 教练，要么把你的内容拿去训练。

## 即将上线 · 心象（Memoir）

> 你心里那位重要的人——已逝的爷爷、退休失联的导师、22 岁充满理想的自己——值得有一个**可以反复回访的地方**。
>
> 「心象」让你为心中的某个真实的人，立一座**可持续陪伴的对话容器**。心象会**记得你们说过的所有事**，会**主动关心你最近的变化**，会**与你一起经历你的人生**。
>
> 这不是 AI「复活」谁。这是**你心中的他**，在你心里留下的回声，被你郑重地保存下来。
>
> 详细愿景见 [`docs/product-vision-2026Q2.md`](docs/product-vision-2026Q2.md)。

---

## 已实现的安全基线

- 所有 AI Key 仅由服务端读取（`OPENROUTER_API_KEY` / `GEMINI_API_KEY`）
- Morning Star 通过 `/api/morning-star` 服务端代理调用
- 恢复凭证只保存校验指纹，不保存明文
- 主密码校验支持 PBKDF2 verifier，并兼容旧 hash/旧恢复码
- Argon2id 评估完成（[`docs/security/argon2-eval.md`](docs/security/argon2-eval.md) 决议 GO at OWASP_REC）

## 源码仓库与线上演示

推送到真实远程仓库或接入演示环境后，请把占位符 **`YOUR_ORG` / `YOUR_REPO`** 换成你的 GitHub（或 GitLab 等）路径，并保证 **`package.json` → `repository.url`** 与远程一致。

| 类型 | 链接 |
|------|------|
| **源码（Git）** | `https://github.com/YOUR_ORG/YOUR_REPO`（占位符，替换后即为「最新代码」入口） |
| **线上演示** | *暂无收录——部署完成后在此写入公网 URL（例如 `https://vector.example.com`），并与运维书签同步。* |

**一次性对齐步骤**

1. 在托管平台创建空仓库，本地执行：`git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git`（地址以平台为准）。
2. 编辑根目录 [`package.json`](./package.json)，将 `repository.url` 改为 `git+https://github.com/<所有者>/<仓库>.git`（与 `git remote get-url origin` 对应）。
3. 若有对外演示站点，在本节表格「线上演示」填写 URL；可选同时在 `package.json` 增加 `"homepage": "https://你的演示域名"`，便于 npm 与文档聚合展示。

## 环境要求

- Node.js 20+
- npm

## 本地运行

```bash
npm install
cp .env.example .env.local        # 这一步只在你的开发机上执行
# 在 .env.local 里至少填一个 AI Key（推荐 OpenRouter，免费）
npm run dev
```

> **关于 `.env.local`**：这个文件**只存在于你的本地开发机**，仓库里**不会**也**不应该**包含它（已加入 `.gitignore`）。
> 如果之前的副本曾经包含过真实的 `OPENROUTER_API_KEY` / `GEMINI_API_KEY`，请立即到对应控制台**吊销并重发**新 Key——任何被记录在 git 历史、备份镜像或聊天工具里的 Key 都视为已泄漏。

默认地址：

```text
http://localhost:3000
```

## AI 后端

服务端 `/api/morning-star` 同时支持两个 Provider：

| Provider      | Env Key              | 说明                           |
| ------------- | -------------------- | ------------------------------ |
| OpenRouter    | `OPENROUTER_API_KEY` | 免费模型可用，推荐用于本地测试 |
| Google Gemini | `GEMINI_API_KEY`     | 需要自行申请 GCP/AI Studio Key |

选择规则：`AI_PROVIDER=openrouter|gemini` 显式指定；未指定时按"哪个 Key 先填了就用哪个"自动选择，OpenRouter 优先。

### 接入 OpenRouter（免费 API）

1. 在 https://openrouter.ai/keys 注册并生成 Key（免费额度即可）
2. 在 `.env.local` 中填入：

   ```bash
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxx
   # 默认 google/gemma-3-12b-it:free（走 Google AI Studio 路由，对全新 free key 最友好）
   # 其它推荐：google/gemma-3-27b-it:free（质量更高）
   # 注意：部分 :free 模型（Llama 3.3、Qwen3-Coder 等）走 Venice 路由，需要 OpenRouter
   # 账户里的 per-key spend limit 设为非 0，否则会 402；详见
   # https://openrouter.ai/settings/keys
   OPENROUTER_MODEL=google/gemma-3-12b-it:free
   ```

3. 重启 `npm run dev`，访问 `http://localhost:3000/api/health` 应当返回：

   ```json
   { "status": "ok", "provider": "openrouter", "model": "..." }
   ```

4. 拉取当前所有 OpenRouter 免费模型列表（用于挑选 / 替换默认模型）：

   ```bash
   curl http://localhost:3000/api/models | jq '.models[].id'
   ```

   或筛选关键字：

   ```bash
   curl -s http://localhost:3000/api/models | jq '.models[] | select(.id | test("llama|qwen|gemini")) | {id, name, context_length}'
   ```

5. 直接打通启明星调用（替代前端 UI）：

   ```bash
   curl -s http://localhost:3000/api/morning-star \
     -H 'Content-Type: application/json' \
     -d '{"prompt":"用 JSON 回我一个 hello world"}'
   ```

> **限速提示**：OpenRouter 免费模型默认 20 req/min、200 req/day，且本服务对 `/api/morning-star` 也有自带 5 req/min 的速率限制（可由 `MORNING_STAR_RATE_LIMIT_*` 调整）。

## 环境变量

```bash
AI_PROVIDER=                 # openrouter | gemini | (留空自动)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_REFERER=http://localhost:3000
OPENROUTER_TITLE=VECTOR Life Design Guide
OPENROUTER_TIMEOUT_MS=60000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SENTRY_DSN=
PORT=3000
HOST=0.0.0.0
VITE_DEV_PORT=3000
VITE_DEV_HOST=0.0.0.0
```

## 常用命令

```bash
npm run lint
npm test
npm run build
npm audit --package-lock-only
```

## 安全须知

- `.env.local` 仅在本机使用，**不要分享、压缩打包、截图或提交到 Git**。文件被 `.gitignore` 忽略，但仍可能因复制操作泄漏。
- 一旦 `OPENROUTER_API_KEY` / `GEMINI_API_KEY` 离开你的设备（包括误传给他人），请到对应控制台立刻吊销并重新生成。
- 服务端默认仅监听 `127.0.0.1`。需要让局域网或公网访问时，请同时：
  1. 把 `HOST` 改为 `0.0.0.0`；
  2. 在 `MORNING_STAR_ALLOWED_ORIGINS` 中显式列出允许调用 `/api/morning-star`、`/api/models` 的浏览器 Origin（多个用逗号分隔）；
  3. 设置 `MORNING_STAR_ACCESS_TOKEN`，用于非浏览器客户端（curl、脚本、第三方 SDK）。
- AI 代理鉴权语义：
  - **同源浏览器调用**（前端走 `/api/morning-star`）：靠 Origin 白名单放行，不需要 token，前端代码无需任何配置。
  - **跨源浏览器调用**：必须出现在 `MORNING_STAR_ALLOWED_ORIGINS` 中，否则 403；如果想绕过同源限制，可以带 `Authorization: Bearer <token>`。
  - **非浏览器调用（无 Origin 头）**：未配置 token 时通过；配置了 token 时必须带 `Authorization: Bearer <token>`，否则 401。
- 每个 `/api/morning-star`、`/api/models` 响应都会带 `X-Request-Id` 响应头，错误响应 JSON 中也包含 `requestId`，便于在服务端结构化日志中关联问题（日志中所有可疑长字符串、API key、Bearer token 已自动脱敏）。
- 生产模式（`NODE_ENV=production`）会启用 Helmet CSP，仅放行 `self`、OpenRouter 与 Google Generative Language API；自定义部署时若需要新的资源源，请同步在 [`server.ts`](./server.ts) 的 `productionCspDirectives` 中扩展。
- Markdown 渲染的链接、图片与内嵌 PDF 已做协议白名单（`http(s):` / `mailto:` / `blob:` / `data:image/*`，不含 SVG），其它 scheme 会被替换为提示文字而非可点击元素。

## 备份与恢复

- 在「设置面板 → Restore Backup」点击 **Import JSON**，选择此前导出的 `VECTOR_*_BACKUP_*.json` 文件。
- 应用会先做 schema 校验（`type=vector-vault-backup`、`schemaVersion≤1`、`entryCount` 与 `entries.length` 一致），任何不通过都会拒绝整个文件而不是部分写入。同时支持 1.0.x 之前的旧格式 `{ version, entries }` 自动兼容读取。
- 校验通过后会弹出**应用内确认 modal**（不再是浏览器原生 `confirm`），告诉你将合并多少条目；点 **Import** 才真正写入，**模式始终是 merge**：现有条目按 `id` 去重保留，新条目追加。
- 导出建议至少每月一次：「设置面板 → Export Star Map」生成的 JSON 即可；单独的 `Export Text Log` 是只读快照，不能被导入。
- 导入失败的具体原因会显示在 Restore 区域（"backup is not valid JSON"、"file is not a VECTOR backup"、"backup was produced by a newer schema version" 等）。

## 数据可靠性提示

- 单个附件 ≥ 5MB 会显示软提示「附件较大，可能拖慢保存，并将跳过本地备份镜像」，> 100MB 直接拒绝。
- 当 entries 序列化大小超过 localStorage 镜像阈值时，Dashboard 顶部「Sync Active」徽章会切换为黄色「Backup mirror skipped」，IndexedDB 仍写入但本地镜像被跳过。出现持续这个状态时建议立即手动导出一次 backup，并清理大附件。
- IndexedDB 写入彻底失败会显示红色「Sync error」，此时本次编辑可能没有持久化，建议先复制原文再排查。

## 部署

仓库提供一份开箱即用的容器化样例：[`Dockerfile`](./Dockerfile)、[`docker-compose.yml`](./docker-compose.yml)、[`deploy/nginx.conf.example`](./deploy/nginx.conf.example)。

```bash
# 1. 构建镜像（同时把 SENTRY_DSN 烘进客户端 bundle，可选）
SENTRY_DSN=... docker compose build

# 2. 写一份 .env，至少包含一个 AI key 与暴露策略
cat > .env <<'EOF'
OPENROUTER_API_KEY=sk-or-v1-xxxx
MORNING_STAR_ALLOWED_ORIGINS=https://vector.example.com
MORNING_STAR_ACCESS_TOKEN=please-generate-a-long-random-string
EOF

# 3. 启动；compose 默认仅在 docker network 内 expose 3000，未挂 nginx 时不会暴露到公网
docker compose up -d
```

要直接对外暴露：把 `docker-compose.yml` 中 `nginx` 服务的注释解开，把 `deploy/nginx.conf.example` 复制成 `deploy/nginx.conf` 并填好域名 / 证书路径，然后 `docker compose up -d`。

非容器部署可以走更轻的姿势：

```bash
npm ci --omit=dev
NODE_ENV=production OPENROUTER_API_KEY=... HOST=127.0.0.1 npx tsx server.ts
```

任意场景下都建议把进程托管交给 `systemd` / `pm2` / `forever` 之类的 supervisor，并用 nginx / Caddy / Traefik 做 TLS 终端。

## 可观测性

- 服务端启用了**结构化 JSON 日志**：`/api/morning-star` 与 `/api/models` 的成功/失败都会输出 `{level, event, requestId, provider, durationMs, error}`，配合响应头 `X-Request-Id` 与错误响应 JSON 中的 `requestId`，可以一条线串起前端报错与服务端日志。日志中潜在的 API key、Bearer token、超长 base64（多半是加密内容）会被自动替换为 `[REDACTED]`。
- 推荐采集方式：
  - **systemd**：`journalctl -u vector --since today` 或 `journalctl -fo json` 接 vector / fluent-bit。
  - **Docker**：默认 `json-file` driver 即可，搭配 Loki / Datadog / CloudWatch 的 log shipper；compose 中可以追加 `logging.driver: journald` 或 `logging.driver: gelf` 切到自家管道。
  - 注意不要把日志通过明文邮件转发：虽然脱敏覆盖了常见 key 模式，未脱敏的 prompt 摘要仍可能含个人信息。
- 客户端 Sentry：在 `.env` 设置 `SENTRY_DSN`，构建期会注入。SDK 默认 `sendDefaultPii: false` 且在 `beforeSend`/`beforeBreadcrumb` 中再做一次脱敏；不设置 DSN 时不会有任何 Sentry 网络请求，可放心保持空。
- 前端任何被 `lib/error.ts` 的 `reportError` 捕获的错误都会先 scrub message 再上报，`ErrorBoundary` 给用户看到的只是一个匿名 trace id。
