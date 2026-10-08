import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  hasRememberedAvatarModel,
  readAvatarModel,
  saveAvatarModel,
  modelError,
  type AvatarModelConfig,
} from '../api/avatarModel';
import './avatarModelSettings.css';
import { presets, normalizeModelName, normalizeApiKey } from './avatarModelPresets';
type ModelEndpoint = NonNullable<AvatarModelConfig['endpoint']>;
const customPresetIndex = presets.length - 1;
const modelOptionsFor = (presetIndex: number, liveModels: string[], selectedModel: string) => {
  const presetModels = presets[presetIndex]?.models || [];
  const options = liveModels.length
    ? presetModels.filter((item) => liveModels.includes(item.id))
    : [...presetModels];
  liveModels.forEach((id) => {
    if (!options.some((item) => item.id === id)) options.push({ id, label: id });
  });
  if (!liveModels.length && selectedModel && !options.some((item) => item.id === selectedModel)) {
    options.push({ id: selectedModel, label: `${selectedModel} · 当前填写` });
  }
  return options;
};
const preferredModelFor = (available: string[], presetIndex: number, current: string) =>
  available.includes(current)
    ? current
    : presets[presetIndex]?.models.find((item) => available.includes(item.id))?.id ||
      available[0] ||
      current;
export function AvatarModelSettings({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  type FieldKey = 'baseUrl' | 'apiKey' | 'model';
  type FieldErrors = Partial<Record<FieldKey, string>>;
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const lastDiscovery = useRef('');
  const baseUrlRef = useRef<HTMLInputElement>(null);
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const advancedToggleRef = useRef<HTMLButtonElement>(null);
  const savedConfig = readAvatarModel();
  const [config, setConfig] = useState<AvatarModelConfig>(
    () => savedConfig || { ...presets[0], apiKey: '' },
  );
  // A saved, unfamiliar model must not hide the provider's model picker. Keep
  // it as one selectable option until account discovery can replace it.
  const [manualModel, setManualModel] = useState(() =>
    Boolean(savedConfig && !presets.some((p) => p.baseUrl === savedConfig.baseUrl)),
  );
  const providerDrafts = useRef(new Map<string, AvatarModelConfig>());
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(() => hasRememberedAvatarModel());
  const [showAdvanced, setShowAdvanced] = useState(
    savedConfig ? !presets.slice(0, -1).some((p) => p.baseUrl === savedConfig.baseUrl) : false,
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [preset, setPreset] = useState(() =>
    presets.findIndex((p) => p.baseUrl === config.baseUrl),
  );
  const currentPreset = preset < 0 ? customPresetIndex : preset;
  const isCustom = currentPreset === customPresetIndex;
  useEffect(() => {
    dialog.current?.showModal();
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  const focusFirstError = useCallback((errors: FieldErrors) => {
    const first = (['baseUrl', 'apiKey', 'model'] as FieldKey[]).find((field) => errors[field]);
    const refs = { baseUrl: baseUrlRef, apiKey: apiKeyRef, model: modelRef };
    if (!first) return;
    window.setTimeout(() => {
      const field = refs[first].current;
      // Preset providers intentionally lock their endpoint. When their endpoint
      // needs attention, lead to the disclosed setting rather than attempting
      // to focus a disabled input.
      (field && !field.disabled ? field : advancedToggleRef.current)?.focus();
    }, 0);
  }, []);
  useEffect(() => {
    if (!busy && Object.keys(fieldErrors).length) focusFirstError(fieldErrors);
  }, [busy, fieldErrors, focusFirstError]);
  const change = (patch: Partial<AvatarModelConfig>) => {
    if (patch.baseUrl !== undefined || patch.apiKey !== undefined) {
      setModels([]);
      lastDiscovery.current = '';
    }
    setConfig((c) => ({ ...c, ...patch }));
    setStatus('');
    setError('');
    setFieldErrors((current) => {
      const next = { ...current };
      (Object.keys(patch) as FieldKey[]).forEach((key) => delete next[key]);
      return next;
    });
  };
  const endpointFor = (model: string, baseUrl: string): ModelEndpoint => {
    const presetForAddress = presets.find((p) => p.baseUrl === baseUrl);
    const option = presetForAddress?.models.find((item) => item.id === model);
    if (option && !manualModel && !isCustom) return option.endpoint || 'chat';
    return config.endpoint || presetForAddress?.endpoint || 'chat';
  };
  const normalized = () => {
    const baseUrl = config.baseUrl.trim().replace(/\/$/, '');
    const presetForAddress = presets.find((p) => p.baseUrl === baseUrl);
    const model = normalizeModelName(
      (
        config.model.trim() ||
        (!manualModel && !isCustom ? presetForAddress?.model : '') ||
        ''
      ).trim(),
      [...(presetForAddress?.models.map((item) => item.id) || []), ...models],
      baseUrl === presets[3].baseUrl,
    );
    return {
      baseUrl,
      model,
      apiKey: normalizeApiKey(config.apiKey),
      endpoint: endpointFor(model, baseUrl),
    };
  };
  const validate = (listing = false) => {
    const c = normalized();
    const errors: FieldErrors = {};
    if (!c.baseUrl) {
      errors.baseUrl = '接口地址不能为空。';
    } else {
      try {
        const u = new URL(c.baseUrl);
        if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash)
          errors.baseUrl = '接口地址必须是干净的 HTTPS 地址，例如 https://api.openai.com/v1。';
      } catch {
        errors.baseUrl = '接口地址格式不正确，请填写 HTTPS 地址。';
      }
    }
    if (!c.apiKey) errors.apiKey = '请填写 API Key。';
    else if (/[\r\n]/.test(c.apiKey)) errors.apiKey = 'API Key 不能包含换行。';
    if (!listing && !c.model) errors.model = '请填写服务商提供的模型名称。';
    else if (!listing && /\s/.test(c.model)) {
      errors.model = c.baseUrl.includes('generativelanguage.googleapis.com')
        ? '暂未识别这个模型名称，请选择列表中的模型。'
        : '暂未识别这个名称，请识别模型后从列表选择，或粘贴服务商的模型名称。';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      if (errors.baseUrl) setShowAdvanced(true);
      setError('请先修正红色标记的内容。');
      focusFirstError(errors);
      return null;
    }
    return c;
  };
  const applyServerError = (code: string) => {
    const errors: FieldErrors = {};
    if (code === 'model_auth_failed')
      errors.apiKey = 'API Key 无效、已过期，或没有调用这个模型的权限。';
    if (code === 'model_not_found') {
      errors.model = modelError(code);
    }
    if (code === 'invalid_model_config' || code === 'model_endpoint_not_found') {
      errors.baseUrl = modelError(code);
      setShowAdvanced(true);
    }
    setFieldErrors(errors);
    focusFirstError(errors);
  };
  const modelErrorForCurrentConfig = (code: string, listing = false) => {
    if (listing) {
      return `${modelError(code)} 未能读取此 Key 的模型列表；你仍可从下方兼容模型中选择后验证。`;
    }
    return modelError(code);
  };

  const requestModel = async (listing = false) => {
    const value = validate(listing);
    if (!value || controller.current) return null;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    setStatus('');
    const timeout = setTimeout(() => abort.abort(), 25000);
    try {
      const response = await fetch(`/api/v1/avatar/model/${listing ? 'list' : 'test'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelConfig: value }),
        signal: abort.signal,
      });
      const result = await response.json();
      if (controller.current !== abort) return null;
      if (!response.ok || (listing ? !Array.isArray(result.models) : !result.ok)) {
        const code = result.error || 'model_unavailable';
        applyServerError(code);
        setError(modelErrorForCurrentConfig(code, listing));
        return null;
      }
      if (listing) {
        const available = result.models.filter(
          (model: unknown): model is string => typeof model === 'string',
        );
        const matched = normalizeModelName(
          value.model,
          available,
          value.baseUrl === presets[3].baseUrl,
        );
        const nextModel =
          manualModel && !available.includes(matched)
            ? value.model
            : preferredModelFor(available, currentPreset, matched);
        const nextEndpoint =
          presets[currentPreset]?.models.find((item) => item.id === nextModel)?.endpoint ||
          value.endpoint ||
          'chat';
        setConfig((c) => ({ ...c, model: nextModel, endpoint: nextEndpoint }));
        setModels(available);
        lastDiscovery.current = JSON.stringify([value.baseUrl, value.apiKey]);
        if (available.includes(nextModel)) setManualModel(false);
        setStatus(
          available.length
            ? manualModel && !available.includes(nextModel)
              ? '列表中没有匹配的模型，请选择其他模型或保留输入后验证。'
              : `已识别 ${available.length} 个模型，已选择 ${nextModel}。调用权限和额度将在保存时验证。`
            : '接口没有返回模型列表，你仍可选择常用模型或自行输入。',
        );
      } else {
        setConfig((c) => ({ ...c, model: value.model, endpoint: value.endpoint }));
        setStatus('连接成功，已保存为分身对话模型。');
      }
      return value;
    } catch (e) {
      if (controller.current !== abort) return null;
      const code = abort.signal.aborted
        ? 'model_timeout'
        : e instanceof TypeError
          ? 'model_network_failed'
          : e instanceof Error
            ? e.message
            : 'model_unavailable';
      applyServerError(code);
      setError(modelErrorForCurrentConfig(code, listing));
      return null;
    } finally {
      clearTimeout(timeout);
      if (controller.current === abort) {
        setBusy(false);
        controller.current = null;
      }
    }
  };
  const save = (value: AvatarModelConfig | null) => {
    try {
      saveAvatarModel(value, rememberKey);
      onSaved();
      onClose();
    } catch {
      setError('浏览器无法保存会话配置，请检查存储权限后重试。');
    }
  };
  const testAndSave = async () => {
    const value = await requestModel(false);
    if (value) save(value);
  };
  const currentConfig = normalized();
  const isGemini = currentConfig.baseUrl.includes('generativelanguage.googleapis.com');
  const modelOptions = modelOptionsFor(currentPreset, models, currentConfig.model);
  // Built-in providers always retain a picker, even when discovery fails or a
  // previously saved model is no longer among our presets.
  const canChoosePresetModel = !isCustom && !manualModel;
  const discoverOnBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    // Keep the form responsive while the user moves between its controls. In
    // particular, discovering models here must not disable the “remember”
    // checkbox before its click is applied.
    if ((event.relatedTarget as HTMLElement | null)?.closest('button, input, select, textarea, a'))
      return;
    const value = normalized();
    if (
      value.apiKey &&
      value.baseUrl &&
      !busy &&
      lastDiscovery.current !== JSON.stringify([value.baseUrl, value.apiKey])
    ) {
      void requestModel(true);
    }
  };
  const selectProvider = (index: number) => {
    providerDrafts.current.set(presets[currentPreset].name, { ...config });
    const next = presets[index];
    const draft = providerDrafts.current.get(next.name);
    setPreset(index);
    change(
      draft || {
        baseUrl: next.baseUrl,
        model: next.model,
        endpoint: next.endpoint || 'chat',
        apiKey: '',
      },
    );
    setManualModel(Boolean(index === customPresetIndex));
    setShowAdvanced(index === customPresetIndex);
    setShowKey(false);
    setFieldErrors({});
  };
  return (
    <dialog
      ref={dialog}
      className="avatar-model-dialog"
      aria-labelledby="avatar-model-title"
      onCancel={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void testAndSave();
        }}
        noValidate
      >
        <header>
          <button
            type="button"
            className="avatar-model-dialog__back"
            aria-label="返回分身"
            onClick={onClose}
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <h2 id="avatar-model-title">分身设置</h2>
        </header>
        <div className="avatar-model-field">
          <label htmlFor="avatar-provider">服务商</label>
          <select
            id="avatar-provider"
            disabled={busy}
            value={currentPreset}
            onChange={(e) => selectProvider(Number(e.target.value))}
          >
            {presets.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div
          className={`avatar-model-field ${fieldErrors.apiKey ? 'avatar-model-field--error' : ''}`}
        >
          <div className="avatar-model-label-row">
            <label htmlFor="avatar-api-key">API Key</label>
            {presets[currentPreset].keyUrl && (
              <a href={presets[currentPreset].keyUrl} target="_blank" rel="noreferrer">
                获取 Key ↗
              </a>
            )}
          </div>
          {presets[currentPreset].keyHint && (
            <p className="avatar-model-required-hint" role="note">
              {presets[currentPreset].keyHint}
            </p>
          )}
          <div className="avatar-model-key">
            <input
              ref={apiKeyRef}
              required
              disabled={busy}
              id="avatar-api-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              value={config.apiKey}
              aria-invalid={Boolean(fieldErrors.apiKey)}
              aria-describedby={fieldErrors.apiKey ? 'avatar-api-key-error' : undefined}
              placeholder={`粘贴 ${isCustom ? '服务商' : presets[currentPreset].name} API Key`}
              onChange={(e) => change({ apiKey: normalizeApiKey(e.target.value) })}
              onBlur={discoverOnBlur}
            />
            <button type="button" aria-pressed={showKey} onClick={() => setShowKey(!showKey)}>
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <label className="avatar-model-remember">
            <input
              id="avatar-remember-key"
              type="checkbox"
              disabled={busy}
              checked={rememberKey}
              onChange={(e) => setRememberKey(e.target.checked)}
            />
            <span>记住 API Key，下次自动使用</span>
          </label>
          {fieldErrors.apiKey && (
            <small id="avatar-api-key-error" className="avatar-model-error">
              {fieldErrors.apiKey}
            </small>
          )}
        </div>
        {(!isCustom || models.length > 0) && (
          <div className="avatar-model-label-row" role="group" aria-label="模型填写方式">
            <button
              type="button"
              disabled={busy}
              hidden={!manualModel}
              aria-pressed={!manualModel}
              onClick={() => {
                setManualModel(false);
                if (manualModel || !config.model.trim()) {
                  const next = presets[currentPreset];
                  const model = preferredModelFor(models, currentPreset, next.model);
                  const option = next.models.find((item) => item.id === model);
                  change({ model, endpoint: option?.endpoint || 'chat' });
                }
              }}
            >
              推荐
            </button>
            <button
              type="button"
              disabled={busy}
              hidden={manualModel}
              aria-pressed={manualModel}
              onClick={() => {
                setManualModel(true);
                window.setTimeout(() => modelRef.current?.focus(), 0);
              }}
            >
              手动输入
            </button>
          </div>
        )}
        {canChoosePresetModel && (
          <div
            className={`avatar-model-field ${fieldErrors.model ? 'avatar-model-field--error' : ''}`}
          >
            <div className="avatar-model-label-row">
              <label htmlFor="avatar-model-choice">模型</label>
              <button
                type="button"
                disabled={busy || !config.apiKey.trim()}
                onClick={() => void requestModel(true)}
              >
                {busy ? '识别中…' : '识别可用模型'}
              </button>
            </div>
            <select
              ref={modelRef as React.RefObject<HTMLSelectElement>}
              disabled={busy}
              id="avatar-model-choice"
              value={currentConfig.model}
              aria-invalid={Boolean(fieldErrors.model)}
              aria-describedby={fieldErrors.model ? 'avatar-model-choice-error' : undefined}
              onChange={(e) => {
                const nextModel = e.target.value;
                const option = modelOptions.find((item) => item.id === nextModel);
                change({ model: nextModel, endpoint: option?.endpoint || 'chat' });
              }}
            >
              {modelOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {fieldErrors.model && (
              <small id="avatar-model-choice-error" className="avatar-model-error">
                {fieldErrors.model}
              </small>
            )}
          </div>
        )}
        {!canChoosePresetModel && (
          <div
            className={`avatar-model-field ${fieldErrors.model ? 'avatar-model-field--error' : ''}`}
          >
            <div className="avatar-model-label-row">
              <label htmlFor="avatar-model-id">模型名称</label>
              <button
                type="button"
                disabled={busy || !config.apiKey.trim() || !config.baseUrl.trim()}
                onClick={() => void requestModel(true)}
              >
                识别可用模型
              </button>
            </div>
            <input
              ref={modelRef as React.RefObject<HTMLInputElement>}
              id="avatar-model-id"
              disabled={busy}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={config.model}
              placeholder={isGemini ? '例如 Gemini 2.5 Flash' : '输入或粘贴模型名称'}
              aria-invalid={Boolean(fieldErrors.model)}
              aria-describedby={fieldErrors.model ? 'avatar-model-id-error' : undefined}
              onChange={(e) => {
                change({ model: e.target.value });
              }}
            />
            {isGemini && <small>大小写、空格会自动整理，也可以直接识别后选择。</small>}
            {fieldErrors.model && (
              <small id="avatar-model-id-error" className="avatar-model-error">
                {fieldErrors.model}
              </small>
            )}
          </div>
        )}
        <button
          ref={advancedToggleRef}
          type="button"
          className="avatar-model-advanced-toggle"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? '收起高级设置' : '高级设置（可选）'}
        </button>
        {showAdvanced && (
          <div className="avatar-model-advanced-panel">
            {!isCustom && (
              <div className="avatar-model-field">
                <small>
                  内置服务商的地址已自动配置。需要兼容接口或第三方地址时，再在这里修改。
                </small>
              </div>
            )}
            {(manualModel || isCustom) && (
              <label className="avatar-model-field">
                接口协议
                <select
                  disabled={busy}
                  value={config.endpoint || 'chat'}
                  onChange={(e) => change({ endpoint: e.target.value as ModelEndpoint })}
                >
                  <option value="chat">Chat Completions</option>
                  <option value="responses">Responses</option>
                </select>
              </label>
            )}
            <div
              className={`avatar-model-field ${fieldErrors.baseUrl ? 'avatar-model-field--error' : ''}`}
            >
              <label htmlFor="avatar-base-url">API 地址</label>
              <input
                ref={baseUrlRef}
                id="avatar-base-url"
                type="url"
                disabled={busy || !isCustom}
                value={config.baseUrl}
                placeholder="https://api.example.com/v1"
                aria-invalid={Boolean(fieldErrors.baseUrl)}
                aria-describedby={
                  fieldErrors.baseUrl ? 'avatar-base-url-error' : 'avatar-base-url-help'
                }
                onChange={(e) => {
                  setPreset(customPresetIndex);
                  change({ baseUrl: e.target.value });
                }}
              />
              {fieldErrors.baseUrl ? (
                <small id="avatar-base-url-error" className="avatar-model-error">
                  {fieldErrors.baseUrl}
                </small>
              ) : (
                <small id="avatar-base-url-help">
                  内置服务商的 API 地址自动配置。只有代理、第三方或自定义兼容接口需要改。
                </small>
              )}
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="avatar-model-alert">
            {error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        <footer>
          <button type="submit" disabled={busy} className="avatar-model-primary">
            {busy ? '正在验证…' : '验证并保存'}
          </button>
        </footer>
        {savedConfig && (
          <button type="button" disabled={busy} onClick={() => save(null)}>
            清除已保存的 API 配置
          </button>
        )}
      </form>
    </dialog>
  );
}
