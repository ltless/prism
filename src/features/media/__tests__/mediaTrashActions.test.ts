import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emptyTrashAction } from '../services/mediaTrashActions';
import fs from 'fs/promises';

let mockQueryResult: unknown = [];

function mockDb() {
 const chain: Record<string, unknown> = {};
 chain.then = vi.fn((resolve: (v: unknown) => unknown) => resolve(mockQueryResult));
 chain.select = vi.fn(() => chain);
 chain.from = vi.fn(() => chain);
 chain.where = vi.fn(() => chain);
 chain.all = vi.fn(() => mockQueryResult);
 chain.delete = vi.fn(() => chain);
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
 unlink: vi.fn(() => Promise.resolve()),
 },
}));

describe('emptyTrashAction', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockQueryResult = [];
 });

 it('should return 0 when no items are trashed', async () => {
 mockQueryResult = [];
 const result = await emptyTrashAction();
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.count).toBe(0);
 }
 });

 it('should unlink file when no active references exist outside trash', async () => {
 // 1st query (trashed items): returns trashed item with hash 'abc'
 // 2nd query (active items with matching hashes): returns empty (no active references outside trash)
 let queryCallCount = 0;
 mockQueryResult = {
 then: (resolve: (v: unknown) => unknown) => {
 queryCallCount++;
 if (queryCallCount === 1) {
 resolve([{ id: '1', hash: 'abc', filePath: 'photo1.jpg', isTrash: true }]);
 } else {
 resolve([]); // no active references
 }
 }
 };

 const result = await emptyTrashAction();
 expect(result.success).toBe(true);
 if (result.success) {
 expect(result.count).toBe(1);
 }
 expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('photo1.jpg'));
 });

 it('should skip unlink when active references exist outside trash', async () => {
 // 1st query: returns trashed item with hash 'abc'
 // 2nd query: returns 1 active reference outside trash with hash 'abc'
 let queryCallCount = 0;
 mockQueryResult = {
 then: (resolve: (v: unknown) => unknown) => {
 queryCallCount++;
 if (queryCallCount === 1) {
 resolve([{ id: '1', hash: 'abc', filePath: 'photo1.jpg', isTrash: true }]);
 } else {
 resolve([{ hash: 'abc' }]); // active reference exists
 }
 }
 };

 const result = await emptyTrashAction();
 expect(result.success).toBe(true);
 expect(fs.unlink).not.toHaveBeenCalled();
 });
});
