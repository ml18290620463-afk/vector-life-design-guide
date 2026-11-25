# Privacy / 隐私说明

Updated: 2026-11-23. This describes the current implementation, not a security certification.

VECTOR is local-first. New users can write immediately without a password or sample records. A screen lock and optional protection of selected data do **not** encrypt every local record. Anyone with access to your browser profile or an unlocked device may read unencrypted data.

VECTOR 以本地存储为主。首次使用直接进入记录页，无强制密码、引导或示例记录。主锁及局部数据保护**不等于整库静态加密**。可访问浏览器配置或已解锁设备的人可能读取未加密数据。

## Storage and access / 存储与访问矩阵

| Data / 数据                                                                                                        | Local storage / 本地存储                                   | Encryption / 加密边界                                                                                                                               | AI use / AI 使用                                                            | Backup and sync / 备份与同步                                                |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Ordinary diary entries / 普通记录                                                                                  | IndexedDB; small collections also mirrored in localStorage | Plain unless individually sealed/encrypted / 非封存记录通常为明文                                                                                   | Explicit allow, accessible and unlocked sources only / 显式允许且来源可访问 | Included in backup and optional account snapshot                            |
| Material metadata / 素材元信息                                                                                     | IndexedDB; embedded metadata may accompany records         | No blanket encryption guarantee / 不承诺统一加密                                                                                                    | Only eligible selected context; attachments depend on the enabled feature   | Included when supported by backup schema; not a guarantee for external URLs |
| Principles, memories, patterns, chats / 原则、记忆、模式、聊天                                                     | IndexedDB and account-scoped localStorage                  | Generally plaintext / 通常为明文                                                                                                                    | Eligibility and source permissions checked; candidates require review       | Supported stores included in snapshots                                      |
| NOW private draft, future draft, future plans, actions, restore job / 私有草稿、未来草稿、未来规划、行动、恢复任务 | IndexedDB                                                  | Encrypted for the selected protected keys when password protection is configured; plaintext without protection / 设置保护后指定键加密，未设置时明文 | Only after unlock and applicable explicit permission                        | Export decrypts internally before creating the backup envelope              |
| Processing receipts / 处理回执                                                                                     | Account-scoped localStorage                                | Plain IDs, fingerprints and versions; not raw source text / 明文标识、指纹和版本                                                                    | Not an independent permission grant                                         | Supported receipts may be backed up                                         |
| Semantic embeddings / 语义向量缓存                                                                                 | IndexedDB / worker cache                                   | No full-vault encryption guarantee; derived data can still be sensitive                                                                             | Local semantic retrieval                                                    | Excluded from vault backup; can be rebuilt                                  |
| Exported backup / 导出备份                                                                                         | User-selected file / 用户保存的文件                        | **Without password: plain JSON. With password: encrypted envelope** / **无密码为明文 JSON，有密码为加密文件**                                       | Export itself does not call AI                                              | Handle plain files as sensitive data                                        |
| Optional account snapshot / 可选账号快照                                                                           | Remote account service                                     | Encrypted snapshot; account ownership checked / 加密快照并校验归属                                                                                  | Sync is separate from AI authorization                                      | Requires configured account service and password                            |

Locking restricts application access. It does not erase local plaintext, OS backups, screenshots, exported files, or already transmitted information. Browser/device loss and forgotten passwords may cause irreversible data loss; keep a recoverable backup. Sealed historical records and protected drafts have their own decryption requirements.

锁定限制应用访问，不会擦除普通明文数据、系统备份、截图、导出文件或已发送内容。浏览器数据清理、设备丢失及忘记密码可能导致数据无法恢复；应自行保管可恢复备份。封存记录与受保护草稿各有解密要求。

## AI consent / AI 授权

Saving asks whether AI may access the record. Private, sampled, sealed/encrypted, inaccessible or time-locked sources are excluded from eligible context. Selected authorized content may be sent through the configured server to the chosen model provider. Check that provider's policy and your deployment configuration before sending sensitive information.

Permission changes abort in-flight client requests and reject stale responses. **Cancellation cannot retract content already sent or guarantee the provider stopped processing.** Source previews re-check current permissions and hide unavailable evidence. A true quotation does not prove a model's interpretation is correct. Review candidate memories before accepting them; rejection does not delete the original experience.

保存时由你选择 AI 可见性。私有、示例、封存/加密、不可访问或尚未解锁的来源不得作为可用上下文。经选择且已授权的内容可能通过服务端发往模型提供方；请了解实际部署及提供方政策。撤权会中止客户端请求并拒绝过时响应，**无法收回已发送内容，也不能保证提供方停止处理**。引用原文存在不等于模型推论正确，候选记忆需经人工审核。

## Accounts, diagnostics and deletion / 账号、诊断与删除

Accounts, billing, cloud snapshots and optional diagnostics exist in the codebase. Their availability and retention depend on the operator's configuration; local-first does not mean no network traffic or no central account. Sentry is optional. Operators must document enabled services, retention, subprocessors and a verified privacy contact before public deployment. This repository does not set an operator-wide retention promise.

账号、支付、云快照及可选诊断均有实现；是否启用和保留时长取决于部署方。本地优先不等于无联网或无中心账号。部署方应在公开上线前提供实际启用服务、保留期限、处理方及可核实的隐私联系方式。

Deleting local data does not delete exported backups or copies already held by remote services. Use the relevant account/provider deletion process for remote copies. Do not put real private records in public bug reports.

删除本地数据不会删除已导出的备份或远端副本；远端数据应通过对应账号/服务处理。不要在公开问题中提交真实隐私记录。
