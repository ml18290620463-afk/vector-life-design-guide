import { beforeEach, describe, expect, it } from 'vitest';
import {
  readAvatarModel,
  readAvatarModelPreference,
  readAvatarModelRememberPreference,
  saveAvatarModel,
} from './avatarModel';

const config = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'device-key',
  model: 'example-model',
  endpoint: 'responses' as const,
};

describe('avatar model persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('restores a verified connection after a new browser session by default', () => {
    saveAvatarModel(config);
    sessionStorage.clear();

    expect(readAvatarModel()).toEqual(config);
    expect(readAvatarModelPreference()).toEqual({
      baseUrl: config.baseUrl,
      model: config.model,
      endpoint: config.endpoint,
    });
  });

  it('keeps the provider and model after opting out of stored keys', () => {
    saveAvatarModel(config, false);
    sessionStorage.clear();

    expect(readAvatarModel()).toBeNull();
    expect(readAvatarModelPreference()).toEqual({
      baseUrl: config.baseUrl,
      model: config.model,
      endpoint: config.endpoint,
    });
    expect(readAvatarModelRememberPreference()).toBe(false);
  });

  it('uses a remembered-key preference when the user returns to the model form', () => {
    saveAvatarModel(config, false);
    expect(readAvatarModelRememberPreference()).toBe(false);

    saveAvatarModel(config);
    expect(readAvatarModelRememberPreference()).toBe(true);
  });

  it('clears both connection and preference only when explicitly cleared', () => {
    saveAvatarModel(config);
    saveAvatarModel(null);

    expect(readAvatarModel()).toBeNull();
    expect(readAvatarModelPreference()).toBeNull();
  });
});
