import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createTestDb } from '@/__tests__/helpers/db';
import { processMediaUpload } from '@/services/media/upload';
import * as schema from '@/services/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn(() => Promise.resolve({ width: 100, height: 100 })),
    resize: vi.fn(() => ({
      webp: vi.fn(() => ({
        toBuffer: vi.fn(() => Promise.resolve(Buffer.from('mock-webp'))),
        toFile: vi.fn(() => Promise.resolve()),
      })),
    })),
  })),
}));

vi.mock('@/services/media/processor', () => ({
  MediaProcessor: {
    generateHash: vi.fn(async () => 'test-hash-123'),
    extractExif: vi.fn(async () => ({})),
    processImage: vi.fn(async () => ({ width: 100, height: 100, palette: ['#fff', '#000'] })),
  },
}));

vi.mock('@/services/video/transcode', () => ({
  getVideoMetadata: vi.fn(),
  checkFFmpeg: vi.fn(async () => false),
  extractThumbnail: vi.fn(),
}));

vi.mock('@/core/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

let testDb: ReturnType<typeof createTestDb>;
let mediaDir: string;
let thumbDir: string;

beforeEach(async () => {
  testDb = createTestDb();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'prism-test-'));
  mediaDir = path.join(tmp, 'media');
  thumbDir = path.join(tmp, 'thumbs');
  await fs.mkdir(mediaDir, { recursive: true });
  await fs.mkdir(thumbDir, { recursive: true });
});

afterAll(() => { testDb?.cleanup(); });

describe('processMediaUpload integration', () => {
  it('rejects invalid file type', async () => {
    const badFile = new File(['bad'], 'test.exe', { type: 'application/x-msdownload' });
    const result = await processMediaUpload(badFile, testDb.db, mediaDir, thumbDir);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it('rejects oversized file', async () => {
    const big = Buffer.alloc(300 * 1024 * 1024);
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    const result = await processMediaUpload(file, testDb.db, mediaDir, thumbDir);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it('rejects invalid magic bytes', async () => {
    const fake = Buffer.from('not-a-real-image');
    const file = new File([fake], 'photo.jpg', { type: 'image/jpeg' });
    const result = await processMediaUpload(file, testDb.db, mediaDir, thumbDir);
    expect(result.success).toBe(false);
  });

  it('accepts valid JPEG and inserts to DB', async () => {
    const pixel = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const file = new File([pixel], 'photo.jpg', { type: 'image/jpeg' });
    const result = await processMediaUpload(file, testDb.db, mediaDir, thumbDir);
    expect(result.success).toBe(true);
    expect(result.mediaId).toBeTruthy();

    const inserted = testDb.db.select().from(schema.media).where(eq(schema.media.id, result.mediaId!)).get();
    expect(inserted).toBeTruthy();
    expect(inserted!.title).toBe('photo.jpg');
    expect(inserted!.mimeType).toBe('image/jpeg');
  });

  it('detects duplicate by hash', async () => {
    const pixel = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const file = new File([pixel], 'photo.jpg', { type: 'image/jpeg' });
    const first = await processMediaUpload(file, testDb.db, mediaDir, thumbDir);
    expect(first.success).toBe(true);

    const second = await processMediaUpload(file, testDb.db, mediaDir, thumbDir);
    expect(second.success).toBe(true);
    expect(second.isDuplicate).toBe(true);
    expect(second.mediaId).not.toBe(first.mediaId);
  });
});
