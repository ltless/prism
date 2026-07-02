import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createTestDb } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';
import { bulkMoveToTrashAction } from '@/features/media/services/mediaTrashActions';

let testDb: ReturnType<typeof createTestDb>;

vi.mock('@/services/db/multitenant', () => ({
  getUserDb: vi.fn(async () => ({
    db: testDb!.db,
    paths: { mediaDir: '/tmp', thumbDir: '/tmp/thumbs', dbPath: ':memory:' },
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  testDb = createTestDb();
  testDb.db.insert(schema.media).values([
    { id: 'm1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', createdAt: new Date() },
    { id: 'm2', title: 'b.jpg', filePath: 'b.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b', createdAt: new Date() },
  ]).run();
});

afterAll(() => { testDb?.cleanup(); });

describe('bulkMoveToTrashAction', () => {
  it('moves items to trash', async () => {
    const result = await bulkMoveToTrashAction(['m1']);
    expect(result.success).toBe(true);

    const trashed = testDb.db.select().from(schema.media).where(eq(schema.media.isTrash, true)).all();
    expect(trashed).toHaveLength(1);
    expect(trashed[0].id).toBe('m1');
  });

  it('empty ids is no-op', async () => {
    await bulkMoveToTrashAction([]);
    const trashed = testDb.db.select().from(schema.media).where(eq(schema.media.isTrash, true)).all();
    expect(trashed).toHaveLength(0);
  });

  it('multiple ids trashed at once', async () => {
    await bulkMoveToTrashAction(['m1', 'm2']);
    const trashed = testDb.db.select().from(schema.media).where(eq(schema.media.isTrash, true)).all();
    expect(trashed).toHaveLength(2);
  });
});
