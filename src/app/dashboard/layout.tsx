import { Suspense } from "react";
import { cookies } from "next/headers";
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

  // Sidebar collapsed state must come from the cookie so the server renders
  // the correct --sidebar-w on first paint (localStorage is invisible to SSR
  // and caused the grid to snap back to the expanded layout on refresh).
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get("prism-sidebar-collapsed")?.value === "1";

  return (
    <SidebarProvider initialCollapsed={sidebarCollapsed}>
      <div className="flex h-dvh bg-app-bg overflow-hidden text-main-text">
        <Suspense fallback={null}>
          <Sidebar folders={allFolders} />
        </Suspense>
        <MainContentWrapper>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </MainContentWrapper>
      </div>
    </SidebarProvider>
  );
}
