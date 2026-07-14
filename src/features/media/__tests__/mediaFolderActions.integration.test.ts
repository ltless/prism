import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb, seedTestUser } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  testDb = await createTestDb();
  await seedTestUser(testDb.db, 'u1');
});

afterAll(async () => { await testDb?.cleanup(); });

describe('Folder operations integration', () => {
  it('creates and queries a folder', async () => {
    await testDb.db.insert(schema.folders).values({
      id: 'f1', userId: 'u1', name: 'Test Folder', color: '#ff0000', folderType: 'manual',
    });

    const folders = await testDb.db.select().from(schema.folders);
    expect(folders).toHaveLength(1);
    expect(folders[0].name).toBe('Test Folder');
    expect(folders[0].color).toBe('#ff0000');
  });

  it('moves media to folder', async () => {
    await testDb.db.insert(schema.media).values({
      id: 'm1', userId: 'u1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a',
    });
    await testDb.db.insert(schema.folders).values({ id: 'f1', userId: 'u1', name: 'My Folder', folderType: 'manual' });

    await testDb.db.update(schema.media).set({ folderId: 'f1' }).where(eq(schema.media.id, 'm1'));

    const inFolder = await testDb.db.select().from(schema.media).where(eq(schema.media.folderId, 'f1'));
    expect(inFolder).toHaveLength(1);
  });

  it('smart folder query filters by tag category + min score', async () => {
    await testDb.db.insert(schema.media).values([
      { id: 'm1', userId: 'u1', title: 'a.jpg', filePath: 'a.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a' },
      { id: 'm2', userId: 'u1', title: 'b.jpg', filePath: 'b.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b' },
      { id: 'm3', userId: 'u1', title: 'c.jpg', filePath: 'c.jpg', mimeType: 'image/jpeg', size: 100, hash: 'c' },
    ]);

    await testDb.db.insert(schema.mediaTags).values([
      { mediaId: 'm1', userId: 'u1', tag: 'sunset', score: 0.95, category: 'Sky & Light' },
      { mediaId: 'm2', userId: 'u1', tag: 'cloud', score: 0.80, category: 'Sky & Light' },
      { mediaId: 'm3', userId: 'u1', tag: 'dog', score: 0.99, category: 'Animals' },
    ]);

    const smartIds = await testDb.db.select({ mediaId: schema.mediaTags.mediaId })
      .from(schema.mediaTags)
      .where(
        and(
          inArray(schema.mediaTags.category, ['Sky & Light']),
          gte(schema.mediaTags.score, 0.85)
        )
      );
    expect(smartIds).toHaveLength(1);
    expect(smartIds[0].mediaId).toBe('m1');
  });
});
