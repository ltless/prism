import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DuplicateList, DuplicateGroup } from "../../../features/media/components/DuplicateList";
import { goFetch } from "@/lib/api";
import { type FolderListResponse } from "@/types/goApi";

type DuplicatesResponse = { groups: DuplicateGroup[] };

export default async function DuplicatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [dupRes, folderRes] = await Promise.all([
    goFetch<DuplicatesResponse>("/api/v1/media/duplicates"),
    goFetch<FolderListResponse>("/api/v1/folders"),
  ]);

  const folderMap: Record<string, string> = {};
  for (const f of folderRes.items ?? []) {
    folderMap[f.id] = f.name;
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto pt-12">
        <div className="px-4 md:px-8 mb-6">
          <h1 className="text-xl font-semibold text-main-text">Duplicates</h1>
        </div>
        <DuplicateList groups={dupRes.groups ?? []} folderMap={folderMap} />
      </div>
    </main>
  );
}
