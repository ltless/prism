import { describe, it, expect, vi, beforeEach } from 'vitest';

const testState = vi.hoisted(() => ({ updateCalls: [] as unknown[] }));

const mockDb = vi.hoisted(() => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn((values: unknown) => ({
      where: vi.fn(() => {
        testState.updateCalls.push(values);
        return Promise.resolve();
      }),
    })),
  })),
}));

function mockUser(user: Record<string, unknown> | null) {
  const val = user ? [user] : [];
  mockDb.select.mockImplementation(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(val)),
      })),
    })),
  }));
}

vi.mock('@/services/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getPreferencesAction, updatePreferencesAction } from '../services/preferencesActions';

beforeEach(() => { vi.clearAllMocks(); testState.updateCalls = []; });

describe('getPreferencesAction', () => {
  it('returns preferences with default theme when preferences is null', async () => {
    mockUser({ id: 'u-1', preferences: null });
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
    mockUser({
      id: 'u-1',
      preferences: {
        ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
        theme: 'light',
      },
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
    mockUser(null);
    const result = await updatePreferencesAction({
      ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
    });
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({
      preferences: {
        ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
      },
    });
  });

  it('saves theme preference (partial update)', async () => {
    mockUser(null);
    const result = await updatePreferencesAction({ theme: 'light' });
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({
      preferences: { theme: 'light' },
    });
  });

  it('merges with existing preferences (does not clobber)', async () => {
    mockUser({
      id: 'u-1',
      preferences: {
        ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
        theme: 'light',
      },
    });
    const result = await updatePreferencesAction({ theme: 'dark' });
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({
      preferences: expect.objectContaining({
        ai: { enabled: true, aestheticEnabled: true, autoFavoriteEnabled: true },
        theme: 'dark',
      }),
    });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await updatePreferencesAction({ theme: 'dark' });
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});