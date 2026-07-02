import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deleteMediaAction, nukeLibraryAction, updateMediaMetadataAction, renameMediaAction } from '../services/mediaCrud';
import fs from 'fs/promises';
import type { MediaItem } from "../types";

let mockDbItems: MediaItem[] = [];
let mockQueryResult: unknown = [];

function mockDb() {
 const chain: Record<string, unknown> = {};
 chain.then = vi.fn((resolve: (v: unknown) => unknown) => resolve(mockQueryResult));
 chain.select = vi.fn(() => chain);
 chain.from = vi.fn(() => chain);
 chain.where = vi.fn(() => chain);
 chain.limit = vi.fn(() => chain);
 chain.all = vi.fn(() => mockQueryResult);
 chain.orderBy = vi.fn(() => chain);
 chain.groupBy = vi.fn(() => chain);
 chain.run = vi.fn(() => Promise.resolve());
 chain.values = vi.fn((val: MediaItem) => {
 mockDbItems.push(val);
 return chain;
 });
 chain.set = vi.fn(() => chain);
 chain.insert = vi.fn(() => chain);
 chain.delete = vi.fn(() => {
 if (Array.isArray(mockQueryResult)) {
 mockQueryResult = mockQueryResult.slice(1);
 }
 return chain;
 });
 chain.update = vi.fn(() => chain);
 return chain;
}

vi.mock('@/services/db/multitenant', () => ({
 getUserDb: vi.fn(async () => ({
 db: mockDb(),
 paths: { mediaDir: '/tmp/media', thumbDir: '/tmp/thumbs', dbPath: ':memory:' },
 })),
}));

vi.mock('fs/promises', () => ({
 default: {
 mkdir: vi.fn(() => Promise.resolve()),
 writeFile: vi.fn(() => Promise.resolve()),
 unlink: vi.fn(() => Promise.resolve()),
 rm: vi.fn(() => Promise.resolve()),
 },
}));

describe('deleteMediaAction', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockDbItems = [];
 });

 it('should return success when item not found', async () => {
 mockQueryResult = [];
 const result = await deleteMediaAction('nonexistent');
 expect(result).toEqual({ success: true });
 });

 it('should skip fs.unlink when other records with same hash exist', async () => {
 mockQueryResult = [
 { id: '1', hash: 'abc', filePath: 'photo1.jpg' },
 { id: '2', hash: 'abc', filePath: 'photo1.jpg' },
 ];
 const result = await deleteMediaAction('1');
 expect(result.success).toBe(true);
 expect(fs.unlink).not.toHaveBeenCalled();
 });

 it('should call fs.unlink when only one record has the hash', async () => {
 mockQueryResult = [{ id: '1', hash: 'abc', filePath: 'photo.jpg' }];
 const result = await deleteMediaAction('1');
 expect(result.success).toBe(true);
 expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('photo.jpg'));
 });
});

describe('nukeLibraryAction', () => {
  const TEST_TOKEN = 'test-nuke-token-1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbItems = [];
    process.env.NUKE_CONFIRMATION_TOKEN = TEST_TOKEN;
  });

  afterEach(() => {
    delete process.env.NUKE_CONFIRMATION_TOKEN;
  });

  it('should fail when env token not configured', async () => {
    delete process.env.NUKE_CONFIRMATION_TOKEN;
    const result = await nukeLibraryAction(TEST_TOKEN);
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/disabled/i);
  });

  it('should fail with invalid confirmation token', async () => {
    const result = await nukeLibraryAction('wrong-token');
    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe('Invalid confirmation token');
  });

  it('should succeed with valid confirmation token', async () => {
    mockQueryResult = [];
    const result = await nukeLibraryAction(TEST_TOKEN);
    expect(result.success).toBe(true);
  });
});

describe('updateMediaMetadataAction', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should update metadata for records matching the filename hash', async () => {
 mockQueryResult = [];
 const result = await updateMediaMetadataAction('photo.jpg', { tags: ['nature'], embedding: [0.1, 0.2] });
 expect(result.success).toBe(true);
 });
});

describe('renameMediaAction', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('should return error for empty title', async () => {
 const result = await renameMediaAction('1', ' ');
 expect(result.success).toBe(false);
 expect((result as { success: false; error: string }).error).toBe('Title cannot be empty');
 });

 it('should rename a media item', async () => {
 mockQueryResult = [];
 const result = await renameMediaAction('1', 'New Title');
 expect(result.success).toBe(true);
 });
});
