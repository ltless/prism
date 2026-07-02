import { describe, it, expect } from 'vitest';
import { sanitizeAppAIConfig, sanitizeUserAIPrefs } from '../services/aiSanitize';

describe('sanitizeAppAIConfig', () => {
  it('returns defaults for undefined input', () => {
    const result = sanitizeAppAIConfig(undefined);
    expect(result.enabled).toBe(false);
    expect(result.variant).toBe('standard');
    expect(result.tagThreshold).toBe(0.12);
  });

  it('returns defaults for empty object', () => {
    const result = sanitizeAppAIConfig({});
    expect(result.enabled).toBe(false);
    expect(result.variant).toBe('standard');
  });

  it('preserves valid overrides', () => {
    const result = sanitizeAppAIConfig({ enabled: true, variant: 'sharp', tagThreshold: 0.2 });
    expect(result.enabled).toBe(true);
    expect(result.variant).toBe('sharp');
    expect(result.tagThreshold).toBe(0.2);
  });

  it('rejects invalid variant', () => {
    expect(() => sanitizeAppAIConfig({ variant: 'ultra' as never })).toThrow();
  });
});

describe('sanitizeUserAIPrefs', () => {
  it('returns defaults for undefined input', () => {
    const result = sanitizeUserAIPrefs(undefined);
    expect(result.enabled).toBe(false);
    expect(result.aestheticEnabled).toBe(false);
    expect(result.autoFavoriteEnabled).toBe(false);
  });

  it('preserves valid overrides', () => {
    const result = sanitizeUserAIPrefs({ enabled: true, aestheticEnabled: true });
    expect(result.enabled).toBe(true);
    expect(result.aestheticEnabled).toBe(true);
    expect(result.autoFavoriteEnabled).toBe(false);
  });
});
