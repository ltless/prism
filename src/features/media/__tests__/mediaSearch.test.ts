/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchMediaAction } from '../services/mediaSearch';

let mockQueryResult: unknown = [];

function mockDb() {
 const chain: Record<string, any> = {};
 chain.then = vi.fn((resolve: (v: unknown) => unknown) => resolve(mockQueryResult));
 chain.select = vi.fn(() => chain);
 chain.selectDistinct = vi.fn(() => chain);
 chain.from = vi.fn(() => chain);
 chain.where = vi.fn(() => chain);
 chain.limit = vi.fn(() => chain);
 chain.all = vi.fn(() => mockQueryResult);
 chain.get = vi.fn(() => undefined);
 chain.orderBy = vi.fn(() => chain);
 chain.groupBy = vi.fn(() => chain);
 chain.run = vi.fn(() => Promise.resolve());
 chain.values = vi.fn(() => chain);
 chain.set = vi.fn(() => chain);
 chain.insert = vi.fn(() => chain);
 chain.delete = vi.fn(() => chain);
 chain.update = vi.fn(() => chain);
 return chain;
}

vi.mock('@/services/db/multitenant', () => ({
 getUserDb: vi.fn(async () => ({
 db: mockDb(),
 paths: { mediaDir: '/tmp/media', thumbDir: '/tmp/thumbs' },
 })),
}));

vi.mock('@/auth', () => ({
 auth: vi.fn(async () => ({ user: { id: 'test-user-id' } })),
}));

vi.mock('@/services/ai/sidecar-client', () => ({
  sidecarEmbedText: vi.fn(async () => { throw new Error('sidecar down') }),
}));

vi.mock('@/shared/utils/cosineSimilarity', () => ({
 cosineSimilarity: vi.fn(() => 0),
}));

describe('searchMediaAction', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockQueryResult = [];
 });

 it('should return items via keyword fallback when AI unavailable', async () => {
 mockQueryResult = [
 { id: '1', title: 'Sunset Beach', mimeType: 'image/jpeg' },
 ];
 const result = await searchMediaAction('sunset');
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.mode).toBe('keyword');
 expect(result.items).toHaveLength(1);
 }
 });

 it('should filter by mime type', async () => {
 mockQueryResult = [];
 const result = await searchMediaAction('nature', undefined, { mimeType: 'image' });
 expect(result.success).toBe(true);
 });

 it('should filter by date range', async () => {
 mockQueryResult = [];
 const result = await searchMediaAction('test', undefined, {
 dateFrom: '2024-01-01',
 dateTo: '2024-12-31',
 });
 expect(result.success).toBe(true);
 });

 it('should filter by folder', async () => {
 mockQueryResult = [];
 const result = await searchMediaAction('test', 'folder-1');
 expect(result.success).toBe(true);
 });

 it('should return success: false when unauthenticated', async () => {
 const authModule = await import('@/auth');
 vi.mocked(authModule.auth).mockResolvedValueOnce({ user: null } as never);

 const result = await searchMediaAction('test');
 expect(result.success).toBe(false);
 expect((result as { success: false; error: string }).error).toBe('Unauthorized');
 });
});
