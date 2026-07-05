import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emptyTrashAction } from '../services/mediaTrashActions';
import { goFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  goFetch: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockedGoFetch = vi.mocked(goFetch);

beforeEach(() => { vi.clearAllMocks(); });

describe('emptyTrashAction', () => {
  it('returns count and success', async () => {
    mockedGoFetch.mockResolvedValueOnce({ deleted: 5 });
    const result = await emptyTrashAction();
    expect(result).toEqual({ success: true, count: 5 });
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/empty-trash", {
      method: "POST",
    });
  });

  it('returns 0 when nothing to delete', async () => {
    mockedGoFetch.mockResolvedValueOnce({ deleted: 0 });
    const result = await emptyTrashAction();
    expect(result).toEqual({ success: true, count: 0 });
  });
});
