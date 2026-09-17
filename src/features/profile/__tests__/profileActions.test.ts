import { describe, it, expect, vi, beforeEach } from 'vitest';

const testState = vi.hoisted(() => ({
  goFetchCalls: [] as { path: string; options: unknown }[],
  goFetchWithSetCookieCalls: [] as { path: string; options: unknown }[],
}));

vi.mock('@/lib/api', () => ({
  goFetch: vi.fn((path: string, options?: unknown) => {
    testState.goFetchCalls.push({ path, options });
    if (path.includes('/vault-pin/verify')) {
      const body = (options as { body?: { pin: string } } | undefined)?.body;
      return Promise.resolve({ valid: body?.pin === '1234' || body?.pin === 'correct_old_pin' });
    }
    if (path.includes('/vault-pin/status')) {
      return Promise.resolve({ enabled: true });
    }
    return Promise.resolve({});
  }),
  goFetchWithSetCookie: vi.fn((path: string, options?: unknown) => {
    testState.goFetchWithSetCookieCalls.push({ path, options });
    if (path.includes('/vault-pin/verify')) {
      const body = (options as { body?: { pin: string } } | undefined)?.body;
      return Promise.resolve({ data: { valid: body?.pin === '1234' || body?.pin === 'correct_old_pin' }, setCookie: null });
    }
    return Promise.resolve({ data: {}, setCookie: null });
  }),
  mirrorVaultCookie: vi.fn(() => Promise.resolve()),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { changePasswordAction, setVaultPinAction, changeVaultPinAction, disableVaultPinAction, getVaultPinStatusAction, verifyVaultPinAction, updateUsernameAction } from '../services/profileActions';
import { mirrorVaultCookie } from '@/lib/api';

beforeEach(() => { vi.clearAllMocks(); testState.goFetchCalls = []; testState.goFetchWithSetCookieCalls = []; });

describe('changePasswordAction', () => {
  it('changes password with valid old password', async () => {
    const result = await changePasswordAction('oldpass', 'newpassword123');
    expect(result).toMatchObject({ success: true });
    expect(testState.goFetchCalls[0]).toMatchObject({
      path: '/api/v1/auth/change-password',
      options: expect.objectContaining({
        method: 'POST',
        body: { old_password: 'oldpass', new_password: 'newpassword123' },
      }),
    });
  });

  it('returns error for short new password', async () => {
    const result = await changePasswordAction('oldpass', 'short');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Password must be at least') });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await changePasswordAction('oldpass', 'newpassword123');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});

describe('vault PIN actions', () => {
  describe('setVaultPinAction', () => {
    it('sets PIN with valid numeric PIN', async () => {
      const result = await setVaultPinAction('5678');
      expect(result).toMatchObject({ success: true });
      expect(testState.goFetchCalls[0]).toMatchObject({
        path: '/api/v1/users/me/vault-pin',
        options: expect.objectContaining({ method: 'POST', body: { pin: '5678' } }),
      });
    });

    it('rejects short PIN', async () => {
      const result = await setVaultPinAction('123');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('4-10') });
    });

    it('rejects non-numeric PIN', async () => {
      const result = await setVaultPinAction('abcd');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('numeric') });
    });
  });

  describe('changeVaultPinAction', () => {
    it('changes PIN with correct old PIN', async () => {
      const result = await changeVaultPinAction('1234', '5678');
      expect(result).toMatchObject({ success: true });
      expect(testState.goFetchCalls[0]).toMatchObject({
        path: '/api/v1/users/me/vault-pin/verify',
        options: expect.objectContaining({ body: { pin: '1234' } }),
      });
      expect(testState.goFetchCalls[1]).toMatchObject({
        path: '/api/v1/users/me/vault-pin',
        options: expect.objectContaining({ body: { pin: '5678' } }),
      });
    });

    it('rejects wrong old PIN', async () => {
      const result = await changeVaultPinAction('wrong', '5678');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('Current PIN is incorrect') });
    });

    it('rejects short new PIN', async () => {
      const result = await changeVaultPinAction('1234', '12');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('4-10') });
    });
  });

  describe('disableVaultPinAction', () => {
    it('disables PIN with correct PIN', async () => {
      const result = await disableVaultPinAction('1234');
      expect(result).toMatchObject({ success: true });
      expect(testState.goFetchWithSetCookieCalls[0]).toMatchObject({
        path: '/api/v1/users/me/vault-pin',
        options: expect.objectContaining({ method: 'DELETE' }),
      });
      expect(vi.mocked(mirrorVaultCookie)).toHaveBeenCalled();
    });

    it('rejects wrong PIN', async () => {
      const result = await disableVaultPinAction('wrong');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('PIN is incorrect') });
    });
  });

  describe('getVaultPinStatusAction', () => {
    it('returns hasPin=true when PIN exists', async () => {
      const result = await getVaultPinStatusAction();
      expect(result).toMatchObject({ success: true, hasPin: true });
    });
  });

  describe('verifyVaultPinAction', () => {
    it('returns success for correct PIN', async () => {
      const result = await verifyVaultPinAction('1234');
      expect(result).toMatchObject({ success: true });
      expect(testState.goFetchWithSetCookieCalls[0]).toMatchObject({
        path: '/api/v1/users/me/vault-pin/verify',
        options: expect.objectContaining({ method: 'POST', body: { pin: '1234' } }),
      });
      expect(vi.mocked(mirrorVaultCookie)).toHaveBeenCalled();
    });

    it('returns error for wrong PIN', async () => {
      const result = await verifyVaultPinAction('wrong');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('PIN is incorrect') });
      expect(vi.mocked(mirrorVaultCookie)).not.toHaveBeenCalled();
    });
  });
});

describe('updateUsernameAction', () => {
  it('updates username with valid name', async () => {
    const result = await updateUsernameAction('newuser_42');
    expect(result).toMatchObject({ success: true });
    expect(testState.goFetchCalls[0]).toMatchObject({
      path: '/api/v1/users/me/username',
      options: expect.objectContaining({ method: 'PUT', body: { username: 'newuser_42' } }),
    });
  });

  it('rejects short username', async () => {
    const result = await updateUsernameAction('ab');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Username must be') });
  });
});
