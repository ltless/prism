import { auth } from "@/auth";
import TrashLibrary from "@/features/media/components/TrashLibrary";
import type { MediaItem } from "@/features/media/types";
import { goFetch } from "@/lib/api";

type ListResponse = { items: MediaItem[]; total: number };

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user?.id) return <TrashLibrary initialItems={[]} />;

  const res = await goFetch<ListResponse>("/api/v1/media?trash=true&limit=200");

  return <TrashLibrary initialItems={res.items ?? []} />;
}
