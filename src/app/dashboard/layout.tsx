import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/sidebar-context";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { goFetch } from "@/lib/api";
import { mapFolder, type FolderListResponse } from "@/types/goApi";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.hasCompletedSetup) redirect("/setup");

  const folderRes = await goFetch<FolderListResponse>("/api/v1/folders");
  const allFolders = (folderRes.items ?? []).map(mapFolder);

  return (
    <SidebarProvider>
      <div className="flex h-dvh bg-app-bg overflow-hidden text-main-text">
        <Sidebar folders={allFolders} />
        <MainContentWrapper>
          {children}
        </MainContentWrapper>
      </div>
    </SidebarProvider>
  );
}
