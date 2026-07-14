import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { getUserDb } from '@/services/db/multitenant';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('@/core/utils/paths', () => ({
  getStorageRoot: vi.fn(() => tmpDir),
  getDatabaseUrl: vi.fn(() => 'postgresql://prism:prism_dev_2024@localhost:5432/prism'),
}));

vi.mock('@/core/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-mt-'));
  await fs.mkdir(path.join(tmpDir, 'users'), { recursive: true });
});

afterAll(async () => {
  if (tmpDir) {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

describe('multitenant DB integration', () => {
  it('returns user paths for a user', async () => {
    const result = await getUserDb('test-user-id');
    expect(result.paths.mediaDir).toContain('test-user-id');
    expect(result.paths.thumbDir).toContain('test-user-id');
    expect(result.db).toBeDefined();
  });

  it('returns same db instance on second access', async () => {
    const first = await getUserDb('cached-user');
    const second = await getUserDb('cached-user');
    expect(second.db).toBe(first.db);
  });
});
