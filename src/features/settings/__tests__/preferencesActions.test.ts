import { describe, it, expect, vi, beforeEach } from 'vitest';

const testState = vi.hoisted(() => ({ goFetchCalls: [] as { path: string; options: unknown }[], _profile: null as string | null }));

vi.mock('@/lib/api', () => ({
  goFetch: vi.fn((path: string, options?: unknown) => {
    testState.goFetchCalls.push({ path, options });
    if (path === '/api/v1/users/me') {
      const stored = (options as { method?: string } | undefined)?.method === 'PUT'
        ? undefined
        : testState._profile;
      return Promise.resolve({ preferences: stored ?? null });
    }
    return Promise.resolve({});
  }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getPreferencesAction, updatePreferencesAction } from '../services/preferencesActions';

beforeEach(() => { vi.clearAllMocks(); testState.goFetchCalls = []; (testState as Record<string, unknown>)._profile = undefined; });

describe('getPreferencesAction', () => {
  it('returns preferences with default theme when preferences is null', async () => {
    const result = await getPreferencesAction();
    expect(result).toMatchObject({
      success: true,
      preferences: {
        ai: { enabled: false, aestheticEnabled: false, autoFavoriteEnabled: false },
        theme: 'dark',
      },
    });
  });

  it('returns stored preferences when they exist', async () => {
    testState._profile = JSON.stringify({
      ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
      theme: 'light',
    });
    const result = await getPreferencesAction();
    expect(result).toMatchObject({
      success: true,
      preferences: {
        ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
        theme: 'light',
      },
    });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await getPreferencesAction();
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});

describe('updatePreferencesAction', () => {
  it('saves AI preferences (partial update)', async () => {
    const result = await updatePreferencesAction({
      ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
    });
    expect(result).toMatchObject({ success: true });
    const putCall = testState.goFetchCalls.find(c => c.options && (c.options as { method?: string }).method === 'PUT');
    expect(putCall).toBeDefined();
    const body = (putCall!.options as { body?: { preferences?: string } }).body;
    const parsed = JSON.parse(body!.preferences!);
    expect(parsed.ai).toMatchObject({ enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true });
  });

  it('saves theme preference (partial update)', async () => {
    const result = await updatePreferencesAction({ theme: 'light' });
    expect(result).toMatchObject({ success: true });
    const putCall = testState.goFetchCalls.find(c => c.options && (c.options as { method?: string }).method === 'PUT');
    expect(putCall).toBeDefined();
    const body = (putCall!.options as { body?: { preferences?: string } }).body;
    const parsed = JSON.parse(body!.preferences!);
    expect(parsed.theme).toBe('light');
  });

  it('merges with existing preferences (does not clobber)', async () => {
    testState._profile = JSON.stringify({
      ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
      theme: 'light',
    });
    const result = await updatePreferencesAction({ theme: 'dark' });
    expect(result).toMatchObject({ success: true });
    const putCall = testState.goFetchCalls.find(c => c.options && (c.options as { method?: string }).method === 'PUT');
    expect(putCall).toBeDefined();
    const body = (putCall!.options as { body?: { preferences?: string } }).body;
    const parsed = JSON.parse(body!.preferences!);
    expect(parsed.ai).toMatchObject({ enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true });
    expect(parsed.theme).toBe('dark');
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await updatePreferencesAction({ theme: 'dark' });
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});
