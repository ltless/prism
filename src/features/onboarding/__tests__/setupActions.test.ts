import { describe, it, expect, vi, beforeEach } from 'vitest';

const testState = vi.hoisted(() => ({ updateCalls: [] as unknown[] }));

const mockDb = vi.hoisted(() => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([])),
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

vi.mock('@/services/db', () => ({ db: mockDb }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((s: string) => Promise.resolve(`hashed_${s}`)),
    compare: vi.fn((s: string, h: string) => Promise.resolve(s === h.replace('hashed_', ''))),
  },
  hash: vi.fn((s: string) => Promise.resolve(`hashed_${s}`)),
  compare: vi.fn((s: string, h: string) => Promise.resolve(s === h.replace('hashed_', ''))),
}));

import {
  completeSetupAction,
  saveVaultPinAction,
  updateProfileAndCoverAction,
} from '../services/setupActions';

beforeEach(() => { vi.clearAllMocks(); testState.updateCalls = []; });

describe('completeSetupAction', () => {
  it('sets hasCompletedSetup: true', async () => {
    const result = await completeSetupAction();
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({ hasCompletedSetup: true });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await completeSetupAction();
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});

describe('saveVaultPinAction', () => {
  it('saves hashed PIN with valid 6-digit PIN', async () => {
    const result = await saveVaultPinAction('123456');
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({ vaultPin: 'hashed_123456' });
  });

  it('rejects short PIN (3 digits)', async () => {
    const result = await saveVaultPinAction('123');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('4-10') });
  });

  it('rejects non-numeric PIN', async () => {
    const result = await saveVaultPinAction('abcdef');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('numeric') });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await saveVaultPinAction('123456');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});

describe('updateProfileAndCoverAction', () => {
  it('updates both image and coverImage', async () => {
    const result = await updateProfileAndCoverAction('/img/profile.jpg', '/img/cover.jpg');
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({ image: '/img/profile.jpg', coverImage: '/img/cover.jpg' });
  });

  it('accepts null paths (clearing images)', async () => {
    const result = await updateProfileAndCoverAction(null, null);
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({ image: null, coverImage: null });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await updateProfileAndCoverAction('/img/p.jpg', '/img/c.jpg');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});