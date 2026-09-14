import { auth } from "@/auth";
import TrashLibrary from "@/features/media/components/TrashLibrary";
import type { MediaItem } from "@/features/media/types";
import { goFetch } from "@/lib/api";
import { mediaListSchema } from "@/lib/apiSchemas";

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user?.id) return <TrashLibrary initialItems={[]} />;

  const res = await goFetch("/api/v1/media?trash=true&limit=200", undefined, mediaListSchema);

  // Runtime-validated core fields; cast only narrows the zod passthrough type.
  return <TrashLibrary initialItems={(res.items ?? []) as MediaItem[]} />;
}
