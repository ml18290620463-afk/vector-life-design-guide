# 分身模型接入说明

分身只需要连接一个模型服务商。配置完成后，分身对话会使用你保存的模型。

## 三步完成

1. 在「分身设置」选择服务商。
2. 点击「获取 Key」，在对应平台创建 API Key 并粘贴；希望下次自动使用时，勾选「记住 API Key，下次自动使用」。
3. 点击「识别可用模型」，选定模型后点击「验证并保存」。

服务商列表中的推荐模型用于快速开始；「识别可用模型」会读取服务商返回的模型列表；调用权限和额度仍需通过「验证并保存」确认。账户没有返回模型列表时，也可以选择推荐模型或用「手动输入」填写服务商给出的模型名称。

## Gemini 用户

Gemini App 或 Gemini Pro 订阅并不等同于 Gemini API Key，也不等同于 API 调用额度。请在 [Google AI Studio](https://aistudio.google.com/apikey) 创建 API Key，然后粘贴到本工具。

如果界面提示需要额度或结算，请在 Google 账户的 API 设置中完成额度或结算设置后重试。Gemini App 的登录状态不能代替 API Key。

## 常见问题

| 看到的提示             | 可以怎么处理                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| API Key 无效或没有权限 | 确认服务商选择与 Key 所属平台一致，并核对该模型的调用权限；不必先更换 Key。 |
| 需要额度、结算或配额   | 在该服务商账户中确认可用额度、用量限制或结算设置。                          |
| 当前模型不可用         | 点击「识别可用模型」，再从识别结果中选择。                                  |
| 网络连接失败或超时     | 稍后重试；程序会自动尝试可用连接路径，失败不会覆盖已保存的配置。            |

## Key 的保存方式

勾选「记住 API Key」时，Key 会保存在当前浏览器的本地存储中；不勾选时只保留在当前会话，关闭浏览器后需要重新填写。Key 仅用于本地应用服务端向你选定的模型服务商发起请求。

## 创建 Key 的入口

- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [DeepSeek API Keys](https://platform.deepseek.com/api_keys)
- [OpenRouter Keys](https://openrouter.ai/settings/keys)
- [Google AI Studio API Key](https://aistudio.google.com/apikey)

粘贴 Key 后离开输入框时会尝试自动识别模型，也可以手动点击识别。复制时附带的外层引号、Bearer 前缀和首尾空格会自动清理。Gemini 模型名称兼容常见大小写和空格，但不会替换版本号。

在 macOS 本机运行时，程序会自动读取已启用的本地 HTTP/HTTPS 系统代理；不需要用户填写代理端口或修改 DNS。远程部署使用的是服务器网络，不会读取访问者手机或电脑的代理设置。

## 维护与回归约束

- Gemini 原生模型列表只使用 `x-goog-api-key`；兼容对话接口使用 Bearer，不能混用认证头。
- 只有验证成功后才保存新配置；识别失败、验证失败和关闭窗口均保留原配置。
- 重新打开设置恢复已保存的服务商、模型和记住选项，不自动重验或更换模型。
- 网络、超时、认证、额度和模型不可用分别处理；临时网络失败不标记 Key 无效。
- 自动换路仅发生在 TLS 建立前；请求已发送、认证失败或额度不足时，不自动重复调用。
- 测试使用虚拟 Key，不读取真实用户凭据。

修改接入流程后运行：

```sh
npx vitest run features/now/components/AvatarModelSettings.test.tsx server/avatarModelProxy.test.ts server/avatarCustomModel.test.ts server/avatarChatRoutes.test.ts
npx playwright test e2e/avatar-model-settings.spec.ts --grep 'user chooses|invalid model|custom model'
npm run typecheck
```
