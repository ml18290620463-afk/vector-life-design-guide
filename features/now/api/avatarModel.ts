export type AvatarModelEndpoint = 'chat' | 'responses';
export interface AvatarModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  endpoint?: AvatarModelEndpoint;
}
const SESSION_KEY = 'vector.avatar.model.session.v1';
const REMEMBERED_KEY = 'vector.avatar.model.remembered.v1';

const parseAvatarModel = (raw: string | null): AvatarModelConfig | null => {
  try {
    const value = JSON.parse(raw || 'null');
    return value &&
      ['baseUrl', 'apiKey', 'model'].every((k) => typeof value[k] === 'string') &&
      (value.endpoint === undefined || value.endpoint === 'chat' || value.endpoint === 'responses')
      ? value
      : null;
  } catch {
    return null;
  }
};

export function readAvatarModel(): AvatarModelConfig | null {
  return (
    parseAvatarModel(sessionStorage.getItem(SESSION_KEY)) ||
    parseAvatarModel(localStorage.getItem(REMEMBERED_KEY))
  );
}
export function hasRememberedAvatarModel(): boolean {
  return parseAvatarModel(localStorage.getItem(REMEMBERED_KEY)) !== null;
}
export function saveAvatarModel(value: AvatarModelConfig | null, remember = false) {
  if (value) {
    const payload = JSON.stringify(value);
    sessionStorage.setItem(SESSION_KEY, payload);
    if (remember) localStorage.setItem(REMEMBERED_KEY, payload);
    else localStorage.removeItem(REMEMBERED_KEY);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBERED_KEY);
  }
}
export const modelError = (code: string) =>
  ({
    invalid_model_config: '连接配置格式不合法，请检查 API 地址、Key 和模型名称。',
    model_network_blocked:
      '应用服务无法建立安全的外网连接，且没有检测到可用的本地代理。请确认当前设备可以访问服务商；如使用代理，请先启动本机代理后重试。填写内容仍保留。',
    model_network_failed: '连接在到达服务商前中断。请稍后重试；填写内容仍保留。',
    model_dns_failed:
      '无法解析服务商域名。当前设备或本机代理的 DNS 设置无法找到服务商地址，请检查 DNS 或代理后重试。',
    model_proxy_unreachable:
      '检测到本机代理，但它没有响应。请启动该代理、关闭失效代理，或在网络可直连时重试。',
    model_proxy_auth_required:
      '本机代理要求额外认证，分身无法通过它访问服务商。请在代理中完成认证或切换可用代理后重试。',
    model_tls_failed:
      '与服务商建立安全连接时证书校验失败。请检查系统时间、代理的 HTTPS 解密设置或证书配置。',
    model_unavailable:
      '服务商已收到请求，但没有返回可用结果。请稍后重试；若持续出现，请重新识别模型或联系服务商。',
    model_proxy_config_invalid: '本地代理连接设置有误，请检查后重试。',
    model_auth_failed:
      'API Key 无效、已过期，或未被该服务商接受。请在服务商控制台重新创建或检查该 Key。',
    model_permission_denied:
      'API Key 有效，但当前项目或账号没有调用该模型的权限。请检查项目、地区和模型访问权限。',
    model_rate_limited:
      '服务商拒绝了请求：额度不足、配额已用尽或请求过于频繁。请检查账户额度后重试。',
    model_billing_required: '当前模型需要开通 API 结算或额度。请到服务商账户完成设置后重试。',
    model_not_found:
      '该模型不存在、已停止向当前账号开放，或不支持当前接口。请根据服务商返回的信息更换模型，也可获取模型列表核对。',
    model_endpoint_not_found:
      '服务商返回接口不存在（404），尚不能判断模型权限。请检查 API 地址和接口类型。',
    model_response_invalid: '服务商已响应，但返回格式无法用于分身对话。请从可用模型中重新选择。',
    model_timeout: '连接超时。请稍后重试；如果使用自定义服务商，再检查接口地址。',
    model_not_configured: '分身尚未连接语言模型。请打开「模型接入」配置；这条消息已保留。',
    model_upstream_unavailable: '服务商暂时不可用（5xx）。请保留当前设置，稍后重试。',
  })[code] ||
  '连接验证未完成：服务商没有返回可安全展示的诊断。请稍后重试；若持续出现，请重新识别模型或在服务商控制台检查请求日志。当前设置已保留。';
