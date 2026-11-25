# Security policy / 安全说明

The current release protects selected local stores and encrypted backup/sync envelopes. It does not promise encryption of the entire browser profile or complete protection from malware, browser extensions, XSS, an unlocked device, or a compromised deployment. Read [PRIVACY.md](PRIVACY.md) for the data matrix.

当前版本提供指定本地数据的可选加密及备份/同步加密，不承诺整库静态加密，也不能抵御已控制设备或浏览器的攻击者。详见隐私矩阵。

## Cryptography

- Password verification uses the configured Argon2id implementation, with legacy verification/migration where supported.
- Data encryption uses AES-256-GCM; the current PBKDF2-SHA256 derivation uses 600,000 iterations. Argon2 password verification is separate from encryption key derivation.
- Backup envelopes use random salts and IVs and authenticated metadata. Wrong-password and tamper cases have automated tests. These tests are not an independent cryptographic audit.
- Forgotten encryption passwords cannot be bypassed by a UI reset. Verify restore using a test backup before relying on a new deployment.

## Reporting / 报告问题

Repository: <https://github.com/ml18290620463-afk/vector-life-design-guide>.

If GitHub's **Report a vulnerability** private advisory feature is enabled in this repository, use it for sensitive reports. Its availability has not been verified. Otherwise request a private contact from the maintainer without posting exploit details or private data publicly. There is no verified security email or guaranteed response/disclosure timeline in this release; do not infer one from package metadata.

如仓库已启用 GitHub 私密漏洞报告，请使用该入口（本次未验证是否启用）。否则先向维护者索取私密联络方式，不公开漏洞利用细节或隐私数据。本版本未提供经核实的安全邮箱，也未承诺固定响应或披露时限。

Include affected version, minimal synthetic reproduction, impact, and environment. Never attach passwords, tokens, real diaries, database dumps, or unredacted backups. Operators should keep dependencies current, configure HTTPS and server secrets, and verify deployment-specific security controls.
