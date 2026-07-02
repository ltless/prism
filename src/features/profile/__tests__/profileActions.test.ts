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
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((s: string) => Promise.resolve(`hashed_${s}`)),
    compare: vi.fn((s: string, h: string) => Promise.resolve(s === h.replace('hashed_', ''))),
  },
  hash: vi.fn((s: string) => Promise.resolve(`hashed_${s}`)),
  compare: vi.fn((s: string, h: string) => Promise.resolve(s === h.replace('hashed_', ''))),
}));

import { changePasswordAction, setVaultPinAction, changeVaultPinAction, disableVaultPinAction, getVaultPinStatusAction, verifyVaultPinAction, updateUsernameAction } from '../services/profileActions';

beforeEach(() => { vi.clearAllMocks(); testState.updateCalls = []; });

describe('changePasswordAction', () => {
  it('changes password with valid old password', async () => {
    mockUser({ id: 'u-1', passwordHash: 'hashed_oldpass' });
    const result = await changePasswordAction('oldpass', 'newpassword123');
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({ passwordHash: expect.stringContaining('newpassword123') });
  });

  it('returns error for short new password', async () => {
    mockUser({ id: 'u-1', passwordHash: 'hashed_oldpass' });
    const result = await changePasswordAction('oldpass', 'short');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Password must be at least') });
  });

  it('returns error for wrong old password', async () => {
    mockUser({ id: 'u-1', passwordHash: 'hashed_oldpass' });
    const result = await changePasswordAction('wrongold', 'newpassword123');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Current password is incorrect') });
  });

  it('returns error when unauthorized', async () => {
    const authModule = await import('@/auth');
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
    const result = await changePasswordAction('oldpass', 'newpassword123');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Unauthorized') });
  });
});

describe('vault PIN actions', () => {
  const withPin = { id: 'u-1', vaultPin: 'hashed_1234' };
  const noPin = { id: 'u-1', vaultPin: null };

  describe('setVaultPinAction', () => {
    it('sets PIN with valid numeric PIN', async () => {
      mockUser(null);
      const result = await setVaultPinAction('5678');
      expect(result).toMatchObject({ success: true });
      expect(testState.updateCalls[0]).toMatchObject({ vaultPin: 'hashed_5678' });
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
      mockUser(withPin);
      const result = await changeVaultPinAction('1234', '5678');
      expect(result).toMatchObject({ success: true });
      expect(testState.updateCalls[0]).toMatchObject({ vaultPin: 'hashed_5678' });
    });

    it('rejects wrong old PIN', async () => {
      mockUser(withPin);
      const result = await changeVaultPinAction('9999', '5678');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('Current PIN is incorrect') });
    });

    it('rejects when no PIN set', async () => {
      mockUser(noPin);
      const result = await changeVaultPinAction('1234', '5678');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('No PIN set') });
    });
  });

  describe('disableVaultPinAction', () => {
    it('disables PIN with correct PIN', async () => {
      mockUser(withPin);
      const result = await disableVaultPinAction('1234');
      expect(result).toMatchObject({ success: true });
      expect(testState.updateCalls[0]).toEqual({ vaultPin: null });
    });

    it('rejects wrong PIN', async () => {
      mockUser(noPin);
      const result = await disableVaultPinAction('9999');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('No PIN set') });
    });
  });

  describe('getVaultPinStatusAction', () => {
    it('returns hasPin=true when PIN exists', async () => {
      mockUser({ vaultPin: 'hashed_1234' });
      const result = await getVaultPinStatusAction();
      expect(result).toMatchObject({ success: true, hasPin: true });
    });

    it('returns hasPin=false when no PIN', async () => {
      mockUser({ vaultPin: null });
      const result = await getVaultPinStatusAction();
      expect(result).toMatchObject({ success: true, hasPin: false });
    });
  });

  describe('verifyVaultPinAction', () => {
    it('returns success for correct PIN', async () => {
      mockUser({ vaultPin: 'hashed_1234' });
      const result = await verifyVaultPinAction('1234');
      expect(result).toMatchObject({ success: true });
    });

    it('returns error for wrong PIN', async () => {
      mockUser({ vaultPin: 'hashed_1234' });
      const result = await verifyVaultPinAction('wrong');
      expect(result).toMatchObject({ success: false, error: expect.stringContaining('PIN is incorrect') });
    });
  });
});

describe('updateUsernameAction', () => {
  it('updates username with valid name', async () => {
    mockUser(null);
    const result = await updateUsernameAction('newuser_42');
    expect(result).toMatchObject({ success: true });
    expect(testState.updateCalls[0]).toMatchObject({ username: 'newuser_42' });
  });

  it('rejects short username', async () => {
    const result = await updateUsernameAction('ab');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('Username must be') });
  });

  it('rejects taken username', async () => {
    mockUser({ id: 'other', username: 'taken' });
    const result = await updateUsernameAction('taken');
    expect(result).toMatchObject({ success: false, error: expect.stringContaining('already taken') });
  });
});
