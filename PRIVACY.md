# Privacy Policy / 隐私政策

> **Plain summary**: VECTOR is local-first. Your journal entries, master
> password, recovery key, attachments, and reflections are stored only in
> your browser (IndexedDB). The only data that leaves your device is the
> single AI prompt you send to "Morning Star" — and only if you have
> configured an AI provider. We keep no user accounts, no analytics, no
> behavioural tracking.

Last updated: 2026-05-02. This document is part of the open-source
distribution of VECTOR (`LICENSE`: MIT) and may be modified by anyone who
self-hosts the application — read this version against the version of the
codebase you actually run.

---

## English

### 1. Who is the controller

For the canonical hosted instance (if any), the publisher of that instance is
the data controller. For self-hosted instances the operator who deployed the
server is the data controller. There is no centralised SaaS operator unless
the deployment manifest explicitly states one.

### 2. What data is processed and where

| Category                                                                 | Where it lives                                                                                                                                                                                                                            | Leaves your device?                           |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Journal entries (`title`, `content`, `tags`, `attachment`, `reflection`) | Your browser's IndexedDB (`vector_master_vault_*`)                                                                                                                                                                                        | **No**, never sent to a server                |
| Master password                                                          | Browser memory while unlocked; never persisted in plaintext anywhere                                                                                                                                                                      | **No**                                        |
| PBKDF2 hash + salt                                                       | Your browser's IndexedDB                                                                                                                                                                                                                  | **No**                                        |
| Recovery key                                                             | Hashed (SHA-256) and stored in IndexedDB                                                                                                                                                                                                  | **No**                                        |
| Attachments (image / video / audio / PDF)                                | IndexedDB as base64 (with a > 5 MB user warning)                                                                                                                                                                                          | **No**                                        |
| AI prompt for Morning Star                                               | Your text content **plus** the persona template is forwarded to the upstream AI provider you configured (OpenRouter or Google Gemini) over HTTPS through the VECTOR backend proxy                                                         | **Yes**, when you click "ENGRAVE" / "REFLECT" |
| Server logs                                                              | Structured JSON written to stdout / your log driver. Includes request id, provider, duration, error class. **API keys and Bearer tokens are scrubbed** by `scrubLogText`. The prompt content itself is not logged (only its byte length). | Stays on the server you deployed              |
| Sentry events (optional)                                                 | Only if `SENTRY_DSN` is set at build time. PII is disabled (`sendDefaultPii: false`); messages and exceptions are scrubbed by `lib/error.ts` before being sent.                                                                           | Yes, to your configured Sentry project        |

We do not embed any third-party analytics scripts, advertising pixels, or
session-replay tooling.

### 3. AI provider transmission

When you trigger Morning Star analysis, the proxy forwards your prompt
verbatim to the chosen provider (default OpenRouter, fallback Google
Gemini). Those providers have their own retention policies — please read
[OpenRouter privacy](https://openrouter.ai/privacy) and
[Google Generative Language API privacy](https://ai.google.dev/terms)
before submitting personal information you would not want a third-party
LLM operator to process.

We refuse a request before forwarding it whenever the prompt matches our
prompt-injection guard (`server/promptEnvelope.ts`). The guard raises
`HTTP 400 INJECTION` and the prompt never reaches the upstream provider.

### 3a. Memoir (心象) data

Memoir personas have additional data surfaces. All of the following are
**stored locally on your device only** (IndexedDB, mirrored to
localStorage when small) and are exported only when you explicitly run
"Export Star Map":

- The Memoir's `name`, `description`, AI-generated `systemPrompt`, and
  the wizard answers you provided.
- Each individual `Memory` (category + body + timestamps) extracted by
  the Memoir conversation pipeline.

Three Memoir-specific transmissions to the AI proxy occur:

1. **Memoir creation** (`POST /api/memoir-build`) — your wizard answers
   are forwarded to the upstream LLM with strict guardrails (no PII,
   no living-third-party impersonation, mandatory psychological-safety
   clauses).
2. **Memoir conversation** (the existing Morning Star path) — the entry
   text plus the top-N relevant memories are forwarded so the Memoir
   "remembers". Memories are picked locally by the recency × keyword
   recall ranker before transmission.
3. **Memoir memory extraction** (`POST /api/memoir-extract`) — the
   conversation transcript is sent ONCE per closed conversation; the
   LLM returns extracted memory candidates that we re-validate
   client-side via `services/memoryService.detectUnsafeMemoryBody`
   before persisting locally.

We do not store any Memoir data on our servers. Provider-side retention
remains governed by the provider's own policy (see §3 above).

You can:

- View, edit, or delete any single memory via Settings → 心象管理 →
  "Manage memories".
- Wipe a Memoir's entire memory bank (irreversible).
- Delete the Memoir persona itself, which cascades into its memory bank.
- Export Memoir personas + memories into your backup (carries them to
  another device); omit the backup to keep them on the originating
  device only.

#### Phase 4 W4-W5 additions

- Memories now decay over time (rate depends on category — milestones
  fade slowest). When a Memoir's bank is at the per-plan capacity,
  the lowest-salience non-milestone memory is auto-evicted before a
  new one is added. The Memoir management panel surfaces both the
  capacity meter and a per-memory salience tier.
- Deleting a memory is **soft by default**: it disappears from
  recall + capacity counts immediately but lives in a 30-day
  recycle bin where you can restore it. After 30 days it is
  hard-deleted on the next session.
- Dashboard may surface **proactive recall suggestions** for your
  Memoirs (sample triggers: long silence, anniversary that matches
  one of your stored milestone memories, or a forward-looking
  memory you haven't followed up on). All evaluation runs **on
  device** — no server is involved in computing or scheduling
  these prompts. Each suggestion is dismissible with a 24-hour
  cooldown. You can disable Memoirs altogether by deleting them in
  Settings → 心象管理.

#### Phase 4.5 §A additions — Letter Mode (写信模式)

- "Write a letter" lets you compose a message addressed to a
  Memoir and choose a delivery delay (1 hour / 24 hours / 3 days).
  Pending letters are stored locally in IndexedDB; they are **not
  uploaded** until the delivery sweep runs.
- The delivery sweep runs **only when you open Dashboard after
  the chosen delivery time**. There is no background scheduler
  on a server — VECTOR has no notion of you while the app is
  closed.
- When the sweep dispatches a letter, the letter body flows
  through the same AI proxy as a regular Memoir conversation
  (see §3 above). The reply is stored locally as a regular diary
  entry tagged with an envelope (✉) badge.
- You can cancel a pending letter any time before it is delivered
  via Settings → 心象管理 → "信件". After delivery the letter
  becomes a regular diary entry — delete it or its memoir to
  remove the data entirely.

#### Phase 4.5 §B additions — Echo Chamber (圆桌)

- "Round table" lets you ask one question to 3-7 personas
  simultaneously. The question + persona names + (for any Memoir
  voices you pick) the recall snippets all flow through the AI
  proxy in a **single request** to `/api/echo-chamber`.
- The reply is **not stored** unless you explicitly hit Save. If
  you close or hit Try-again, the reply is discarded — nothing
  reaches IndexedDB.
- When you save, the reply is persisted as a regular `DiaryEntry`
  with `isEchoChamber: true` and `echoChamberQuery` set to the
  original question. This entry behaves like every other entry:
  searchable, exportable, deletable, included in your local
  backups.
- Echo Chamber consumes ~5× the AI budget of a single Morning Star
  reply, so it is gated to paid tiers via the same
  `quotaService` mechanism that gates the Persona Builder and
  Memoir features.

### 3d. Cross-device migration (Phase 4.5 §E)

The cross-device migration wizard lets you carry your full vault from
one device to another. This is the single most data-rich operation
VECTOR exposes, so it has additional safeguards on top of the
data-flow already described above.

**What is bundled into a `.vectormigration` file:**

- All journal entries (the same `entries` array as `Settings → Export
Star Map`).
- All custom personas and Memoirs (the same payload as the regular
  backup since Phase 4 §5.1.A).
- All Memoir long-term memories (the same payload as the regular
  backup since Phase 4 §5.1.B).
- All pending and recently-delivered Letter Mode letters (Phase 4.5
  §A — these are NOT included in the regular `Export Star Map` flow,
  only in the migration package).
- **Optionally**, the master password hash + salt. Whether to bundle
  this is a per-export checkbox, defaulted to ON when the source
  device has a master password set. When you uncheck it, the new
  device must set a new password from scratch.

**Network posture:** the file is built locally and downloaded to your
device. VECTOR never uploads it to a server. The wizard explicitly
asks you to transfer the file via a channel **you** trust (AirDrop,
USB, encrypted email, USB drive, etc.).

**Verification code:** the wizard derives a 6-character SHA-256 short
code from the package body, displayed on both the source and target
devices. The codes are designed to MATCH byte-for-byte when the file
hasn't been altered. They are NOT a cryptographic signature — an
attacker who can replace the file in transit can also replace the
displayed code on the screen they control. For real package
authenticity guarantees, we recommend transferring the file over an
authenticated channel (USB, AirDrop). Server-side Ed25519 signed
backups are tracked as a Phase 4 §4.b-3 follow-up.

**Master password handling:** when the credential snapshot is
present, the wizard verifies the password you type on the target
device against the bundled hash BEFORE any data is written to local
storage. A wrong password aborts the import; a correct one persists
the salt + hash to local storage and forces you back through the
unlock screen so the muscle memory of typing the password on the
new device is cemented (we deliberately do NOT auto-unlock).

**No telemetry:** the wizard does not phone home about success /
failure. The "verification code matches" check is purely local.

### 3e. Backup integrity (Phase 4 §4.b-3 — Ed25519 signatures)

To close the "an attacker who can replace the file in transit can
also replace the displayed code" gap from §3d, every install gets
its own per-device Ed25519 keypair the first time the user sets a
master password.

**What is generated and where it lives:**

- A 32-byte raw Ed25519 secret key, encrypted under your master
  password via AES-GCM, stored in IndexedDB
  (`vector_master_vault_device_keypair`). Without the master password,
  the encrypted blob is inert to a physical attacker.
- A 32-byte raw Ed25519 public key, plain-stored alongside the
  encrypted secret. The public key is what the receiving device
  uses to verify a signed migration package.
- An ISO timestamp the keypair was minted at, surfaced in Settings.

**What gets sent over the wire:**

- Nothing. The keypair never leaves the device. The PUBLIC key is
  embedded in migration packages you produce; the SECRET key never
  leaves IndexedDB and is never serialized except in the
  master-password-encrypted form already described.

**TOFU trust list:**

- When the migration import wizard sees a signed package whose
  public key it doesn't recognise, it shows a 16-character
  fingerprint (`ABCD-EFGH-IJKL-MNOP`) and asks you to read the
  same fingerprint on the source device's Settings page. Only
  if you tap **Yes, trust this device** is the public key added
  to the local TOFU store
  (`vector_master_vault_trusted_devices`). Subsequent imports
  from the same device skip the prompt.
- The TOFU store is local to each device. We do not share trust
  records between devices, do not run a relay, do not see when
  you trust a key.

**Key rotation:**

- Settings exposes a "Regenerate device keys" CTA. Hitting it
  discards the old keypair and mints a fresh one. Existing
  migration packages signed by the OLD key will fail signature
  verification on receiving devices and re-trigger the TOFU
  prompt. The old public key may still be trusted on other
  devices that imported from it pre-rotation; those records are
  stale but harmless.
- Rotating keys is recommended before selling / passing on a
  physical device.

### 4. Retention

- **Journal data**: retained until you delete it. Wiping browser storage
  (Settings → "Wipe Data" or browser site-data clearing) is irreversible.
- **Server logs**: depends on the deployment. The reference Docker image
  uses Docker's default `json-file` log driver; operators are encouraged
  to rotate or pipe to a centralised log system with a finite retention
  window.
- **AI provider logs**: out of our control; consult the provider.

### 5. Your rights

Because there is no centralised account, exercising classical GDPR / CCPA
rights (access, rectification, erasure, portability) is performed
client-side:

- **Access / portability**: Settings → "Export Star Map" produces a JSON
  backup of every entry.
- **Erasure**: Settings → "Wipe Data" removes everything in the local
  vault. To purge any historical AI-provider records, contact the
  upstream provider directly using the email tied to your API key.
- **Rectification**: edit or delete entries inside the app.

For self-hosted instances, please contact the operator you trust with
your API key for any queries about server-side logs.

### 6. Children

VECTOR is not directed at children under 16. Operators in the EU should
verify the age of their users before allowing AI calls; do not deploy
without that check.

### 7. Security

See [`SECURITY.md`](./SECURITY.md) for vulnerability disclosure.

### 8. Changes

Material changes to this policy will be reflected in `CHANGELOG.md` under
the corresponding release version.

---

## 中文（参考翻译，文本歧义以英文为准）

### 1. 数据控制者

如有官方托管实例，由该实例的发布方担任数据控制者；自托管实例由部署服务的
运营方担任数据控制者。除非部署清单另有说明，VECTOR 项目本身不运营任何
集中式 SaaS。

### 2. 数据范围与位置

| 类别                                         | 存储位置                                                                             | 是否离开设备                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------- |
| 日记条目（标题 / 正文 / 标签 / 附件 / 反思） | 浏览器 IndexedDB                                                                     | **否**                            |
| 主密码                                       | 解锁期间存在浏览器内存；不以明文持久化                                               | **否**                            |
| PBKDF2 hash + salt                           | 浏览器 IndexedDB                                                                     | **否**                            |
| 恢复密钥                                     | SHA-256 哈希后存入 IndexedDB                                                         | **否**                            |
| 附件（图 / 视频 / 音频 / PDF）               | IndexedDB（base64，超 5 MB 会软提醒）                                                | **否**                            |
| Morning Star prompt                          | 通过 VECTOR 后端代理转发给你配置的上游 AI（OpenRouter / Gemini）                     | **是**，仅在你点击"刻录 / 反思"时 |
| 服务端日志                                   | 结构化 JSON。**自动脱敏 API key / Bearer token**；仅记录 prompt 字节长度，不记录原文 | 保留在你部署的服务器              |
| Sentry 事件（可选）                          | 仅当 `SENTRY_DSN` 在构建期被设置时启用，PII 已关闭                                   | 上送到你配置的 Sentry 项目        |

### 3. AI 上游传输

触发 Morning Star 时，prompt 会原样转发到所选上游模型。请阅读
[OpenRouter 隐私](https://openrouter.ai/privacy) 与
[Google Generative Language API 条款](https://ai.google.dev/terms)
后再提交敏感个人信息。

如果 prompt 命中我们的注入防护（`server/promptEnvelope.ts`），请求会以
`HTTP 400 INJECTION` 拒绝，**不会**抵达上游。

### 3a. 心象（Memoir）数据

心象（Memoir）功能引入了额外的数据面。下列数据**仅本地存储于你的设备**
（IndexedDB，体积较小时同时镜像到 localStorage），仅在你主动执行"导出
星图"时被纳入备份：

- 心象的 `name`、`description`、AI 生成的 `systemPrompt`、向导问答。
- 每条 `Memory`（类别 + 内容 + 时间戳），由心象对话流水线提取。

心象会触发三种独立的 AI 上游传输：

1. **创建心象**（`POST /api/memoir-build`）—— 将向导回答提交给上游
   LLM，附带严格防护（不嵌入个人信息、不冒充在世第三方、强制写入心理
   安全条款）。
2. **心象对话**（沿用 Morning Star 路径）—— 将日记内容 + 与之最相关
   的若干条记忆一同发送，让心象能"记得"。记忆由本地的 recency × 关键
   字 recall 排序器筛选后再传输。
3. **心象记忆提取**（`POST /api/memoir-extract`）—— 每段对话结束时
   将对话记录发送一次；上游返回的候选记忆会经客户端的
   `services/memoryService.detectUnsafeMemoryBody` 二次校验后再写入本地。

我们不在服务端存储任何心象数据。上游服务商的留存策略详见 §3。

你可以：

- 通过"设置 → 心象管理 → 管理记忆"查看、编辑、删除任意单条记忆；
- 一次性清空某位心象的全部记忆（不可恢复）；
- 删除心象本身，其记忆库会一并清除；
- 将心象与记忆纳入备份（携带到另一台设备），或选择不导出以保留在原设备。

#### Phase 4 W4-W5 新增

- 记忆会随时间衰减（不同类别衰减速率不同——里程碑最慢）。当某位
  心象的记忆库达到套餐上限时，新条目入库前会自动驱逐"分数"最低
  的非里程碑记忆。心象管理面板会同时显示容量条和每条记忆的强度
  分级标签。
- 删除记忆默认为**软删除**：立即从对话上下文与容量计数中消失，
  但会进入 30 天的回收站期间可以恢复；30 天后下次进入应用时会被
  彻底清除。
- Dashboard 可能根据本地评估，弹出**心象主动唤起卡片**（示例触发器：
  长时间未对话；今天的日期与你存的某条里程碑记忆吻合；你提过的
  即将发生的事过了一段时间还没回访）。所有评估完全**在你的设备
  上完成**，不涉及任何服务器调度。每条提示可以一键忽略，24 小时
  内不再出现。如果完全不需要，删除心象本身即可。

#### Phase 4.5 §A 新增 —— 写信模式（Letter Mode）

- "写一封信"允许你给某位心象写信，并选择延迟送达时间（1 小时 /
  24 小时 / 3 天）。未寄出的信件保存在你设备的 IndexedDB 中,
  **在送达前不会上传到任何服务器**。
- 送达扫描**仅在你重新打开 Dashboard 且超过延迟时间时**触发。
  服务端不存在任何后台调度器 —— 应用关闭时 VECTOR 完全不知道你。
- 扫描触发送达时,信件正文会通过常规心象对话使用的同一 AI 代理
  发送(详见 §3)。心象的回信以普通日记形式保存在本地,带有信封
  徽章(✉)。
- 在送达前你可以随时通过"设置 → 心象管理 → 信件"取消未寄出的信件。
  送达后回信成为普通日记 —— 删除该日记或对应心象即可彻底清除。

#### Phase 4.5 §B 新增 —— 圆桌 (Echo Chamber)

- "圆桌" 允许你把一个问题同时抛给 3-7 位声音。问题 + 入选名字
  - (若有心象在场) 召回的记忆片段会在**一次请求**中经由
    `/api/echo-chamber` 转发给 AI。
- 回应**不会被自动存储**。除非你点 "保存到日记",否则关闭或
  "重试" 都不会写入任何 IDB。
- 一旦保存,圆桌的回应以普通日记形式落入金库,带有
  `isEchoChamber: true` 标记 + `echoChamberQuery` 字段记录
  原始问题。它和其他日记一样可搜索 / 导出 / 删除 / 纳入本地备份。
- 圆桌消耗约 5 倍于单次启明星的算力,因此通过 `quotaService`
  机制限定为付费方案 —— 与启明星定制 / 心象功能同一道闸门。

### 3d. 跨设备迁移 (Phase 4.5 §E)

跨设备迁移向导让你把整个金库从一台设备搬到另一台,因此它是 VECTOR
对外暴露的最丰富的数据操作。除了上述各类数据流通的所有约束以外,
迁移流程额外有以下保护:

**`.vectormigration` 文件包含什么:**

- 全部日记条目 (与 `设置 → 导出星图` 相同的 `entries` 数组)。
- 全部自定义启明星与心象 (与 Phase 4 §5.1.A 之后的常规备份一致)。
- 全部心象长期记忆 (与 Phase 4 §5.1.B 之后的常规备份一致)。
- 全部待发送 / 最近送达的写信模式信件 (Phase 4.5 §A —— 这些**不**
  会出现在常规 `导出星图` 流程,只在迁移包里。
- **可选**主密码哈希 + salt。是否携带由导出页面的勾选框控制,默认在
  源设备已设置主密码时勾选。如果取消勾选,新设备需要重新设置密码。

**网络姿态:** 文件全程在本地构建并下载到你的设备,VECTOR 永远不会
把它上传到任何服务器。向导明确建议你通过你**自己信任**的渠道传输
(AirDrop、USB、加密邮件、U 盘等)。

**校验码:** 向导从迁移包正文派生一个 6 位 SHA-256 短码,在源设备
和目标设备上都会显示。理论上,只要文件没被篡改,两边显示的码会
**逐字节一致**。但它**不是**密码学签名 —— 一个能在传输途中替换文件
的攻击者,也能控制他在屏幕上显示的码。要获得真正的真实性保证,我们
建议通过认证过的物理通道 (USB / AirDrop) 传输。服务端 Ed25519 签名
备份作为 Phase 4 §4.b-3 的后续工作。

**主密码处理:** 当迁移包包含凭证快照时,向导会先用你在新设备上输入
的密码与包里的哈希做对比,**通过后才把任何数据写入本地**。密码错误
会中止导入;密码正确时,salt + 哈希被写入本地,随后强制把你重新带
回解锁页面 —— 我们**故意不**自动解锁,让你在新设备上亲手输入一次,
让肌肉记忆扎根。

**无遥测:** 向导不会上报成功 / 失败统计。"校验码一致"的核对完全
在本地完成。

### 3e. 备份完整性 (Phase 4 §4.b-3 —— Ed25519 签名)

为了堵住 §3d 里那道"能换文件的攻击者也能换屏幕上的码"的口子,从这个
版本开始,每个安装在你**首次设置主密码**时会本地生成一对自己的
Ed25519 密钥。

**会生成什么 + 存在哪里:**

- 一把 32 字节 Ed25519 私钥(原始字节),用主密码经 AES-GCM 加密,
  存在 IndexedDB (`vector_master_vault_device_keypair`)。没有主
  密码,这块加密 blob 对一个物理攻击者完全无用。
- 一把 32 字节 Ed25519 公钥,与加密私钥一起明文保存。**公钥**
  会被接收设备用来验证签名后的迁移包。
- 密钥对生成时间的 ISO 时间戳,在设置里显示。

**发往外部网络的内容:**

- 无。密钥对从不离开你的设备。**公钥**会嵌入到你产生的迁移包里;
  **私钥**除了上面描述的"主密码加密"形式之外,从不会被序列化。

**TOFU(首次使用即信任)信任列表:**

- 当迁移导入向导看到一个公钥它不认识的签名包时,会显示一个 16 位
  指纹(`ABCD-EFGH-IJKL-MNOP`),请你在源设备的设置页读出同一个
  指纹做核对。**只有你点击「是,信任这台设备」时**,公钥才会被
  加入本地 TOFU 列表(`vector_master_vault_trusted_devices`)。
  以后从同一设备导入会跳过这一步。
- TOFU 列表完全本地。我们不在设备之间共享、不运行任何中转、
  不会知道你信任了哪些密钥。

**密钥轮换:**

- 设置里有「重新生成设备密钥」按钮。点击后旧密钥被丢弃,新密钥被
  生成。用旧密钥签名的迁移包在接收设备上会通不过签名校验,需要
  重新走一次 TOFU 流程。旧公钥在其他已导入过的设备上可能仍被
  标记为可信 —— 这些记录变成陈旧但无害(它们信任的私钥已不存在)。
- 在转手 / 出售设备前,建议先轮换一次密钥。

### 4. 留存

- **日记数据**：保留到你主动删除为止。"Wipe Data"或清除站点数据**不可恢复**。
- **服务端日志**：取决于部署方式。建议轮转或上传到带保留窗口的集中式日志系统。
- **AI 上游日志**：超出我们控制，请联系上游服务商。

### 5. 用户权利

由于没有集中账号，GDPR / CCPA 等权利由客户端代为完成：

- **访问 / 导出**：设置 → "导出星图"生成 JSON 备份。
- **删除**：设置 → "Wipe Data"清空本地保险库；要删除上游 AI 留存请直接
  联系对应服务商。
- **更正**：在应用内编辑或删除条目。

### 6. 儿童

VECTOR 不面向 16 岁以下儿童。欧盟运营方在允许 AI 调用前应核实用户年龄。

### 7. 安全

漏洞披露请见 [`SECURITY.md`](./SECURITY.md)。

### 8. 变更

重大变更会记入 `CHANGELOG.md`。
