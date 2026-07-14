import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createTestDb, seedTestUser } from '@/__tests__/helpers/db';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';
import { saveEditorBytes } from '@/features/media/services/editorSave';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn(() => Promise.resolve({ width: 100, height: 100 })),
    resize: vi.fn(() => ({
      webp: vi.fn(() => ({
        toBuffer: vi.fn(() => Promise.resolve(Buffer.from('mock-webp'))),
      })),
    })),
  })),
}));

vi.mock('@/services/media/processor', () => ({
  MediaProcessor: {
    generateHash: vi.fn(async (buf: Buffer) => {
      const c = await import('crypto');
      return c.createHash('sha256').update(buf).digest('hex');
    }),
    processImage: vi.fn(async () => ({ width: 100, height: 100, palette: ['#fff', '#000'] })),
  },
}));

vi.mock('@/services/media/thumbnail', () => ({
  createThumbnail: vi.fn(async () => Buffer.from('mock-thumbnail')),
}));

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let ctx: { db: Awaited<ReturnType<typeof createTestDb>>['db']; paths: { mediaDir: string; thumbDir: string } };
let mediaDir: string;

beforeEach(async () => {
  testDb = await createTestDb();
  await seedTestUser(testDb.db, 'u1');
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-editor-'));
  const thumbDir = path.join(mediaDir, 'thumbs');
  await fs.mkdir(thumbDir, { recursive: true });
  ctx = { db: testDb.db, paths: { mediaDir, thumbDir } };
});

afterAll(async () => { await testDb?.cleanup(); });

describe('saveEditorBytes integration', () => {
  it('saves edited file and updates DB', async () => {
    await testDb.db.insert(schema.media).values({
      id: 'm1', userId: 'u1', title: 'original.jpg', filePath: 'original.jpg',
      mimeType: 'image/jpeg', size: 100, hash: 'old-hash',
    });

    const result = await saveEditorBytes(ctx as any, {
      mediaId: 'm1',
      buffer: Buffer.from('new-image-data'),
      overwrite: false,
    });

    expect(result.mediaId).toBeTruthy();
    expect(result.mediaId).not.toBe('m1');
    expect(result.created).toBe(true);

    const items = await testDb.db.select().from(schema.media).where(eq(schema.media.id, 'm1'));
    expect(items[0]).toBeTruthy();
    expect(items[0]!.filePath).toBe('original.jpg');

    const copies = await testDb.db.select().from(schema.media).where(eq(schema.media.title, 'Copy of original.jpg'));
    expect(copies[0]).toBeTruthy();
  });
});
