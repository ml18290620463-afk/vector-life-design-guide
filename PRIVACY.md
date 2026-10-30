# Privacy Policy / 隐私政策

Last updated: 2026-10-30.

## Plain summary

VECTOR is local-first. Your records, materials, principles, containers, attachments, master-password verifier, and ordinary backups are stored on your device first, mainly in browser storage / IndexedDB.

The current product no longer includes the retired Morning Star, Memoir, Echo Chamber, letter mode, cross-device migration wizard, trusted-device store, or advanced signed-backup payloads. References to those systems in older roadmap or changelog files are historical notes, not current runtime behavior.

## English

### 1. Who is responsible

For self-hosted instances, the person or organization deploying the server is responsible for that deployment. There is no central VECTOR cloud account system unless a separate deployment explicitly adds one.

### 2. What data is processed

| Category                                                                  | Where it lives                                                             | Leaves your device?                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Records (`title`, `content`, `tags`, timestamps, archive/container state) | Browser storage / IndexedDB                                                | When exported, transferred, or included in an AI request                  |
| Materials and attachments                                                 | Browser storage / IndexedDB; large files may affect backup size            | When exported, transferred, linked remotely, or included in an AI request |
| Principles and containers                                                 | Browser storage / IndexedDB                                                | When exported or included in AI context                                   |
| Master password verifier and salt                                         | Browser storage / IndexedDB                                                | No                                                                        |
| Ordinary backup JSON                                                      | A file you explicitly download                                             | Only wherever you choose to store or send that file                       |
| Avatar chat, memory extraction and summary requests                       | Sent to the configured server-side AI provider when you invoke AI features | Yes, only for that request                                                |
| Server logs                                                               | The server operator's logging system                                       | Stays on that server/log sink                                             |
| Sentry events                                                             | Only if `SENTRY_DSN` is configured                                         | Yes, to the configured Sentry project                                     |

VECTOR does not include third-party analytics pixels, advertising pixels, or session replay by default.

### 3. AI provider transmission

AI capabilities include avatar conversations, memory extraction, summaries and model discovery/testing. When these capabilities run, relevant messages and selected context or memories are sent through the VECTOR backend to the configured provider, such as OpenRouter or Google Gemini. Local-first does not mean AI requests stay on your device. Request context depends on the feature and current settings.

Provider-side retention and processing are governed by the provider you configure. Read their policies before sending sensitive personal information.

### 4. Backup and restore

Current vault backups contain schema 3 data: records and supplements, principles and their links, actions, guiding stars, containers, materials, future planning and feedback, the current draft, and retained avatar/cache data including conversations and memories. The normal download is encrypted with the source vault password; restoring it requires that password, even when the destination vault uses a different password.

Embedded material bytes travel with the backup. Web links preserve only their addresses; remote content may change or disappear. Temporary references cannot guarantee recovery on another device. Review the backup inspection before restoring. A backup is not a full browser-profile copy and does not promise to preserve every deployment setting.

Backup files are created locally and downloaded by your browser. VECTOR does not upload them to a server. If you send a backup file through email, chat, cloud drive, AirDrop, USB, or any other channel, that channel's privacy and security properties apply.

### 5. Retention and deletion

- Records remain until you delete them or clear browser storage.
- Ordinary backup files remain wherever you saved them.
- Server log retention depends on the deployment operator.
- Sentry event retention depends on your Sentry project settings.
- Wiping browser site data is irreversible unless you have a backup.

### 6. Security posture

- Main user data is local-first.
- Master passwords are not stored in plaintext.
- Markdown and attachment rendering use scheme allow-lists.
- The server should default to loopback for local development. If exposed to a network, configure `AI_ALLOWED_ORIGINS` and `AI_ACCESS_TOKEN`.

## 中文

### 1. 谁负责数据

如果你是自部署，部署这个服务的人或组织就是该实例的数据责任方。除非某个部署额外接入账号系统，否则 VECTOR 当前没有中心化云账号。

### 2. VECTOR 当前处理哪些数据

| 数据类型                                  | 存放位置                                           | 是否离开设备                                 |
| ----------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| 记录正文、标题、标签、时间、归档/容器状态 | 浏览器存储 / IndexedDB                             | 导出、转移或作为 AI 请求上下文时可能离开设备 |
| 素材与附件                                | 浏览器存储 / IndexedDB；大附件可能影响备份体积     | 导出、转移或作为 AI 请求上下文时可能离开设备 |
| 原则与容器                                | 浏览器存储 / IndexedDB                             | 导出或作为 AI 上下文时可能离开设备           |
| 主密码校验数据与盐                        | 浏览器存储 / IndexedDB                             | 不会                                         |
| 普通备份 JSON                             | 你主动下载的文件                                   | 只会去你选择保存或发送的地方                 |
| 分身对话、记忆提取与摘要请求              | 使用 AI 能力时，经由服务端发送给配置的 AI Provider | 会，仅限该次请求                             |
| 服务端日志                                | 部署方的日志系统                                   | 留在该服务器或日志系统中                     |
| Sentry 事件                               | 仅在配置 `SENTRY_DSN` 时启用                       | 会，发送到配置的 Sentry 项目                 |

VECTOR 默认不嵌入第三方统计像素、广告像素或会话回放工具。

### 3. AI Provider 传输

当前 AI 能力包括分身对话、记忆提取、摘要以及模型列表与连接测试。这些能力运行时，相关消息、选入的上下文或记忆会经由 VECTOR 后端发送给配置的 Provider，例如 OpenRouter 或 Google Gemini。本地优先不代表 AI 请求仅在本机处理；具体发送范围取决于使用的功能和当前设置。

上游 Provider 的留存和处理规则由你配置的 Provider 决定。请不要把你不愿交给第三方模型服务商处理的敏感信息发起请求。

### 4. 备份与恢复

当前资料库备份采用 schema 3，包含记录及补充、原则及关联、行动、引导星、容器、素材、未来规划与反馈、当前草稿，以及分身对话、记忆等缓存数据。常规下载使用来源资料库的密令加密；即使目标资料库使用不同密令，检查备份时仍需输入来源密令。

内嵌素材的文件内容随备份保存；网页链接只保存地址，远程内容可能变化或失效；临时引用不能保证跨设备恢复。恢复前请查看备份检查结果。资料库备份不是整个浏览器资料夹的副本，也不承诺包含全部部署设置。

备份文件在本地生成并由浏览器下载。VECTOR 不会把备份上传到服务器。如果你通过邮件、聊天工具、网盘、AirDrop、U 盘等方式转移备份文件，对应渠道的隐私与安全属性由该渠道决定。

### 5. 保留与删除

- 记录会保留到你删除它们或清空浏览器站点数据为止。
- 普通备份文件会保留在你保存它们的位置。
- 服务端日志保留多久取决于部署方。
- Sentry 事件保留多久取决于你的 Sentry 项目设置。
- 清空浏览器站点数据不可逆；除非你提前导出了备份。

### 6. 安全姿态

- 主数据本地优先。
- 主密码不会以明文保存。
- Markdown 与附件渲染使用协议白名单。
- 服务端本地开发默认应监听 loopback。若暴露到网络，请配置 `AI_ALLOWED_ORIGINS` 与 `AI_ACCESS_TOKEN`。
