import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  goFetch: vi.fn(async () => ({})),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  completeSetupAction,
  saveVaultPinAction,
  updateProfileAndCoverAction,
} from '../services/setupActions';

beforeEach(() => { vi.clearAllMocks(); });

describe('completeSetupAction', () => {
  it('sets hasCompletedSetup: true', async () => {
    const result = await completeSetupAction();
    expect(result).toMatchObject({ success: true });
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
  });

  it('accepts null paths (clearing images)', async () => {
    const result = await updateProfileAndCoverAction(null, null);
    expect(result).toMatchObject({ success: true });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await updateProfileAndCoverAction('/img/p.jpg', '/img/c.jpg');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});
