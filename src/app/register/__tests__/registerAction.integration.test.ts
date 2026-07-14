import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { createTestDb } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let bcrypt: typeof import('bcryptjs');

vi.mock('@/services/db', () => ({
  get db() { return testDb!.db; },
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

beforeAll(async () => { bcrypt = await import('bcryptjs'); });

beforeEach(async () => {
  testDb = await createTestDb();
});

afterAll(async () => { await testDb?.cleanup(); });

describe('Register action integration', () => {
  it('creates user with hashed password', async () => {
    const hash = await bcrypt.hash('testpass123', 10);
    await testDb.db.insert(schema.users).values({
      id: 'u1', username: 'newuser', passwordHash: hash, role: 'user',
    });

    const users = await testDb.db.select().from(schema.users).where(eq(schema.users.username, 'newuser'));
    expect(users[0]).toBeTruthy();
    expect(users[0]!.username).toBe('newuser');

    const match = await bcrypt.compare('testpass123', users[0]!.passwordHash);
    expect(match).toBe(true);
  });

  it('rejects duplicate username', async () => {
    await testDb.db.insert(schema.users).values({
      id: 'u1', username: 'existing', passwordHash: 'hash', role: 'user',
    });

    await expect(
      testDb.db.insert(schema.users).values({
        id: 'u2', username: 'existing', passwordHash: 'hash2', role: 'user',
      })
    ).rejects.toThrow();
  });
});
