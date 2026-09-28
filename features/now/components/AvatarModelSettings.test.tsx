import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AvatarModelSettings } from './AvatarModelSettings';
import { readAvatarModel, saveAvatarModel } from '../api/avatarModel';
import { chatWithAvatar } from '../api/avatar';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('lets the user choose a model from the default dropdown and sends the saved configuration with chat', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: '你好' }) });
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);

  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'gpt-4.1-mini' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(readAvatarModel()?.model).toBe('gpt-4.1-mini');
  expect(localStorage.getItem('vector.avatar.model.session.v1')).toBeNull();

  await chatWithAvatar([], []);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).modelConfig).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'secret-test',
    model: 'gpt-4.1-mini',
    endpoint: 'chat',
  });
});

it('connects with only an API Key by applying the default provider and model', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);

  expect(screen.getByLabelText('模型')).toBeTruthy();
  expect(screen.queryByLabelText('模型 ID')).toBeNull();
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(JSON.parse(fetcher.mock.calls[0][1].body).modelConfig).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'secret-test',
    model: 'gpt-4.1',
    endpoint: 'chat',
  });
  expect(readAvatarModel()?.model).toBe('gpt-4.1');
  expect(readAvatarModel()?.endpoint).toBe('chat');
});

it('remembers the API Key when the user enables the remember option', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reply: '你好' }) });
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);

  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'remembered-key' } });
  fireEvent.click(screen.getByLabelText('记住 API Key，下次自动使用'));
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(JSON.parse(localStorage.getItem('vector.avatar.model.remembered.v1') || '{}')).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'remembered-key',
    model: 'gpt-4.1',
    endpoint: 'chat',
  });

  sessionStorage.clear();
  await chatWithAvatar([], []);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).modelConfig).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'remembered-key',
    model: 'gpt-4.1',
    endpoint: 'chat',
  });
});

it('adds fetched account models to the default dropdown without requiring manual model input', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: ['my-model-a', 'my-model-b'] }),
    })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);

  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.click(screen.getByText('识别可用模型'));
  await screen.findByText(/已识别 2 个模型，已选择 my-model-a。/);
  fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'my-model-b' } });
  expect(screen.queryByLabelText('模型 ID')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(readAvatarModel()?.model).toBe('my-model-b');
});

it('clears configuration and reports failed connections without saving', async () => {
  sessionStorage.setItem(
    'vector.avatar.model.session.v1',
    JSON.stringify({ baseUrl: 'https://api.example.com/v1', apiKey: 'key', model: 'model' }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'model_auth_failed' }) }),
  );

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  expect((await screen.findByRole('alert')).textContent).toContain('API Key 无效');
  fireEvent.click(screen.getByText('清除已保存的 API 配置'));
  expect(readAvatarModel()).toBeNull();
  expect(localStorage.getItem('vector.avatar.model.remembered.v1')).toBeNull();
});

it('highlights invalid fields in red before connecting', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  expect(await screen.findByText('请填写 API Key。')).toBeTruthy();
  expect(screen.getByLabelText('API Key').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('模型')).toBeTruthy();
  expect(screen.queryByLabelText('模型 ID')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it('shows API address and custom model ID only for custom compatible providers', async () => {
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  expect(screen.queryByLabelText('API 地址')).toBeNull();
  expect(screen.queryByLabelText('模型 ID')).toBeNull();
  fireEvent.click(screen.getByText('高级设置（可选）'));
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '4' } });
  expect(screen.getByLabelText('API 地址')).toBeTruthy();
  expect(screen.getByLabelText('模型名称')).toBeTruthy();

  fireEvent.change(screen.getByLabelText('API 地址'), {
    target: { value: 'http://localhost:11434/v1' },
  });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'custom-model' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  expect(await screen.findByText(/接口地址必须是干净的 HTTPS 地址/)).toBeTruthy();
  expect(screen.getByLabelText('API 地址').getAttribute('aria-invalid')).toBe('true');
});

it('points built-in provider failures at the model dropdown instead of the default API address', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'model_not_found' }) }),
  );

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'gpt-4.1-mini' } });
  fireEvent.click(screen.getByText('高级设置（可选）'));
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() =>
    expect(screen.getByLabelText('模型').getAttribute('aria-invalid')).toBe('true'),
  );
  expect(screen.getByRole('alert').textContent).toContain('已停止向当前账号开放');
  expect(screen.getByLabelText('API 地址').getAttribute('aria-invalid')).toBe('false');
});

it('shows endpoint diagnostics without blaming the selected model', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'model_endpoint_not_found',
        upstreamStatus: 404,
        detail: 'Requested route was not found',
      }),
    }),
  );
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('服务商返回接口不存在（404）');
  expect(alert.textContent).not.toContain('稳定备选');
  expect(screen.getByLabelText('API 地址').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByLabelText('模型').getAttribute('aria-invalid')).toBe('false');
});

it('keeps default provider URL unmarked for generic connection failures', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'model_unavailable' }) }),
  );

  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'gpt-4.1-mini' } });
  fireEvent.click(screen.getByText('高级设置（可选）'));
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() =>
    expect(screen.getByLabelText('模型').getAttribute('aria-invalid')).toBe('false'),
  );
  expect(screen.getByRole('alert').textContent).toContain('服务商已收到请求');
  expect(screen.getByRole('alert').textContent).not.toContain('稳定备选');
  expect(screen.getByLabelText('API 地址').getAttribute('aria-invalid')).toBe('false');
});

it('saves a manually entered model for a built-in provider with the same key and address', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: '  secret-test  ' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'account-model' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(readAvatarModel()).toEqual({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'secret-test',
    model: 'account-model',
    endpoint: 'chat',
  });
});

it('does not silently substitute a default for an empty manually entered model', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'key' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  expect(await screen.findByText('请填写服务商提供的模型名称。')).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});

it('normalizes Gemini display names without changing the requested version', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'secret-test' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), {
    target: { value: 'Gemini 3.6 Flash' },
  });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));

  await waitFor(() => expect(readAvatarModel()?.model).toBe('gemini-3.6-flash'));
  expect(JSON.parse(fetcher.mock.calls[0][1].body).modelConfig.model).toBe('gemini-3.6-flash');
});

it('restores the Gemini recommended model when leaving manual input', () => {
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), {
    target: { value: 'Gemini 3.6 Flash' },
  });
  fireEvent.click(screen.getByRole('button', { name: '推荐' }));

  expect((screen.getByLabelText('模型') as HTMLSelectElement).value).toBe('gemini-2.5-flash');
  expect(screen.queryByLabelText('模型名称')).toBeNull();
});

it('keeps keys separate across providers and restores drafts when switching back', () => {
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'openai-key' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'my-model' } });
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '1' } });
  expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'deepseek-key' } });
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '0' } });
  expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('openai-key');
  expect((screen.getByLabelText('模型') as HTMLSelectElement).value).toBe('my-model');
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '1' } });
  expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe('deepseek-key');
});

it('explains blocked DNS without marking the model or key invalid', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: 'model_network_blocked' }) }),
  );
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '3' } });
  expect(screen.getByText(/Gemini App 订阅不等同于 Gemini API Key 或 API 额度/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  expect((await screen.findByRole('alert')).textContent).toContain('填写内容仍保留');
  expect(screen.getByLabelText('模型').getAttribute('aria-invalid')).toBe('false');
  expect(screen.getByLabelText('API Key').getAttribute('aria-invalid')).toBe('false');
  expect(readAvatarModel()).toBeNull();
});

it('discovers models when leaving the key field and cleans pasted authorization formatting', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ models: ['gpt-4.1-mini'] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  const key = screen.getByLabelText('API Key');
  fireEvent.change(key, { target: { value: '  Bearer "test-key"  ' } });
  fireEvent.blur(key);
  await waitFor(() =>
    expect((screen.getByLabelText('模型') as HTMLInputElement).value).toBe('gpt-4.1-mini'),
  );
  expect(fetcher.mock.calls[0][0]).toBe('/api/v1/avatar/model/list');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).modelConfig.apiKey).toBe('test-key');
  fireEvent.blur(key);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(readAvatarModel()).toBeNull();
});

it('keeps an unmatched manual version and allows choosing from the discovered list', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ models: ['gemini-2.5-flash'] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Gemini 3.6 Flash' } });
  fireEvent.click(screen.getByRole('button', { name: '识别可用模型' }));
  await screen.findByText('列表中没有匹配的模型，请选择其他模型或保留输入后验证。');
  expect((screen.getByLabelText('模型名称') as HTMLInputElement).value).toBe('gemini-3.6-flash');
  fireEvent.click(screen.getByRole('button', { name: '推荐' }));
  expect((screen.getByLabelText('模型') as HTMLInputElement).value).toBe('gemini-2.5-flash');
  expect(readAvatarModel()).toBeNull();
});

it('matches a friendly Gemini name against the live list without changing its version', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ models: ['gemini-2.5-flash'] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('服务商'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-key' } });
  fireEvent.click(screen.getByRole('button', { name: '手动输入' }));
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Gemini 2.5 Flash' } });
  fireEvent.click(screen.getByRole('button', { name: '识别可用模型' }));
  await waitFor(() =>
    expect((screen.getByLabelText('模型') as HTMLInputElement).value).toBe('gemini-2.5-flash'),
  );
});

const workingGemini = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  apiKey: 'test-working-gemini-key',
  model: 'gemini-2.5-flash',
  endpoint: 'chat' as const,
};

it('restores remembered Gemini settings without revalidation or automatic model replacement', () => {
  saveAvatarModel(workingGemini, true);
  sessionStorage.clear();
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  expect((screen.getByLabelText('服务商') as HTMLSelectElement).value).toBe('3');
  expect((screen.getByLabelText('API Key') as HTMLInputElement).value).toBe(workingGemini.apiKey);
  expect((screen.getByLabelText('模型') as HTMLSelectElement).value).toBe(workingGemini.model);
  expect((screen.getByLabelText('记住 API Key，下次自动使用') as HTMLInputElement).checked).toBe(
    true,
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps the Gemini picker visible for a previously saved unlisted model', () => {
  saveAvatarModel(
    { ...workingGemini, model: 'gemini-3.6-flash' },
    false,
  );
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  const picker = screen.getByLabelText('模型') as HTMLSelectElement;
  expect(picker.tagName).toBe('SELECT');
  expect(picker.value).toBe('gemini-3.6-flash');
  expect(screen.getByRole('option', { name: /gemini-3\.6-flash.*当前填写/ })).toBeTruthy();
  expect(screen.queryByLabelText('模型名称')).toBeNull();
});

it('keeps compatible Gemini choices after discovery fails and explains the actual cause', async () => {
  saveAvatarModel({ ...workingGemini, model: 'gemini-3.6-flash' }, false);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'model_dns_failed' }) }),
  );
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '识别可用模型' }));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('无法解析服务商域名');
  expect(alert.textContent).toContain('仍可从下方兼容模型中选择后验证');
  expect(screen.getByLabelText('模型').tagName).toBe('SELECT');
  expect(screen.getByRole('option', { name: /Gemini 2\.5 Flash/ })).toBeTruthy();
  expect(readAvatarModel()?.model).toBe('gemini-3.6-flash');
});

it.each(['model_auth_failed', 'model_rate_limited', 'model_timeout'])(
  'preserves working settings when a replacement fails with %s',
  async (error) => {
    saveAvatarModel(workingGemini, true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error }) }));
    const saved = vi.fn();
    render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText('API Key'), {
      target: { value: 'test-replacement-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('请确认网络或代理');
    expect(saved).not.toHaveBeenCalled();
    expect(readAvatarModel()).toEqual(workingGemini);
    sessionStorage.clear();
    expect(readAvatarModel()).toEqual(workingGemini);
  },
);

it('keeps settings after failed discovery and allows another attempt', async () => {
  saveAvatarModel(workingGemini, true);
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ models: ['gemini-2.5-flash'] }) });
  vi.stubGlobal('fetch', fetcher);
  render(<AvatarModelSettings onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByText('识别可用模型'));
  expect((await screen.findByRole('alert')).textContent).toContain('填写内容仍保留');
  fireEvent.click(screen.getByText('识别可用模型'));
  await screen.findByText(/已识别 1 个模型/);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(readAvatarModel()).toEqual(workingGemini);
});

it('aborts validation on close and ignores a late successful response', async () => {
  saveAvatarModel(workingGemini, true);
  let resolve!: (value: unknown) => void;
  const fetcher = vi.fn().mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const saved = vi.fn();
  const view = render(<AvatarModelSettings onClose={vi.fn()} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-unsaved-key' } });
  fireEvent.click(screen.getByRole('button', { name: '验证并保存' }));
  view.unmount();
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => {
    resolve({ ok: true, json: async () => ({ ok: true }) });
  });
  expect(saved).not.toHaveBeenCalled();
  expect(readAvatarModel()).toEqual(workingGemini);
});
