import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkMoveToTrashAction } from '@/features/media/services/mediaTrashActions';
import { goFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  goFetch: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockedGoFetch = vi.mocked(goFetch);

beforeEach(() => { vi.clearAllMocks(); });

describe('bulkMoveToTrashAction', () => {
  it('calls bulk/trash endpoint', async () => {
    mockedGoFetch.mockResolvedValueOnce({ success: true });
    const result = await bulkMoveToTrashAction(['m1']);
    expect(result).toEqual({ success: true });
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/bulk/trash", {
      method: "POST",
      body: { media_ids: ["m1"] },
    });
  });

  it('empty ids is no-op', async () => {
    const result = await bulkMoveToTrashAction([]);
    expect(result).toEqual({ success: true });
    expect(mockedGoFetch).not.toHaveBeenCalled();
  });

  it('multiple ids trashed at once', async () => {
    mockedGoFetch.mockResolvedValueOnce({ success: true });
    await bulkMoveToTrashAction(['m1', 'm2']);
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/bulk/trash", {
      method: "POST",
      body: { media_ids: ["m1", "m2"] },
    });
  });
});
