import type { AvatarModelConfig } from '../api/avatarModel';

type ModelEndpoint = NonNullable<AvatarModelConfig['endpoint']>;
type ModelOption = { id: string; label: string; endpoint?: ModelEndpoint };
type ProviderPreset = {
  name: string;
  baseUrl: string;
  model: string;
  endpoint?: ModelEndpoint;
  models: ModelOption[];
  keyUrl?: string;
  keyHint?: string;
};
export const presets: ProviderPreset[] = [
  {
    name: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'ChatGPT 订阅不等同于 API 额度；请在 OpenAI API 平台创建 Key 并确认账户可用额度。',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1 · 日常对话' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini · 更省额度' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini · 兼容选择' },
    ],
  },
  {
    name: 'DeepSeek',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: '请在 DeepSeek 开放平台创建 API Key，并确认账户余额或额度。',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat · 日常对话' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner · 深度思考' },
    ],
  },
  {
    name: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/settings/keys',
    keyHint: '请在 OpenRouter 创建 API Key；具体模型的可用性和价格以你的账户列表为准。',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4.1-mini',
    models: [
      { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 mini · 日常对话' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini · 更省额度' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat · 中文对话' },
    ],
  },
  {
    name: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint:
      'Gemini App 订阅不等同于 Gemini API Key 或 API 额度；请在 Google AI Studio 创建 Key 后粘贴。',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · 日常对话' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · 复杂理解' },
    ],
  },
  { name: '自定义兼容接口', baseUrl: '', model: '', models: [] },
];

// Resolve only unambiguous aliases; never guess a different model version.
export function normalizeModelName(value: string, candidates: string[], gemini = false) {
  const clean = value.trim().replace(/^["'`]+|["'`]+$/g, '');
  const comparable = (name: string) =>
    name
      .replace(/^models\//i, '')
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  if (candidates.includes(clean)) return clean;
  const matches = [...new Set(candidates)].filter((id) => comparable(id) === comparable(clean));
  if (matches.length === 1) return matches[0];
  return gemini
    ? clean
        .replace(/^models\//i, '')
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    : clean;
}

export function normalizeApiKey(value: string) {
  return value
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
}
