import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createTestDb } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { like } from 'drizzle-orm';

let testDb: ReturnType<typeof createTestDb>;

beforeEach(() => {
  testDb = createTestDb();
  testDb.db.insert(schema.media).values([
    { id: '1', title: 'sunset_beach.jpg', filePath: '1.jpg', mimeType: 'image/jpeg', size: 100, hash: 'a', createdAt: new Date() },
    { id: '2', title: 'mountain_view.jpg', filePath: '2.jpg', mimeType: 'image/jpeg', size: 100, hash: 'b', createdAt: new Date() },
    { id: '3', title: 'beach_party.png', filePath: '3.png', mimeType: 'image/png', size: 100, hash: 'c', createdAt: new Date() },
  ]).run();
});

afterAll(() => { testDb?.cleanup(); });

describe('Media search', () => {
  it('finds by title substring', () => {
    const results = testDb.db.select().from(schema.media)
      .where(like(schema.media.title, '%beach%')).all();
    expect(results).toHaveLength(2);
  });

  it('finds by extension', () => {
    const results = testDb.db.select().from(schema.media)
      .where(like(schema.media.title, '%.png')).all();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('3');
  });

  it('returns empty for no match', () => {
    const results = testDb.db.select().from(schema.media)
      .where(like(schema.media.title, '%nonexistent%')).all();
    expect(results).toHaveLength(0);
  });
});
