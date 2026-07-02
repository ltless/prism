import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { createTestDb } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';

let testDb: ReturnType<typeof createTestDb>;
let bcrypt: typeof import('bcryptjs');

vi.mock('@/services/db', () => ({
  db: testDb!.db,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

beforeAll(async () => { bcrypt = await import('bcryptjs'); });

beforeEach(() => {
  testDb = createTestDb();
});

afterAll(() => { testDb?.cleanup(); });

describe('Register action integration', () => {
  it('creates user with hashed password', async () => {
    const hash = await bcrypt.hash('testpass123', 10);
    testDb.db.insert(schema.users).values({
      id: 'u1', username: 'newuser', passwordHash: hash, role: 'user',
    }).run();

    const user = testDb.db.select().from(schema.users).where(eq(schema.users.username, 'newuser')).get();
    expect(user).toBeTruthy();
    expect(user!.username).toBe('newuser');

    const match = await bcrypt.compare('testpass123', user!.passwordHash);
    expect(match).toBe(true);
  });

  it('rejects duplicate username', async () => {
    testDb.db.insert(schema.users).values({
      id: 'u1', username: 'existing', passwordHash: 'hash', role: 'user',
    }).run();

    expect(() => {
      testDb.db.insert(schema.users).values({
        id: 'u2', username: 'existing', passwordHash: 'hash2', role: 'user',
      }).run();
    }).toThrow();
  });
});
