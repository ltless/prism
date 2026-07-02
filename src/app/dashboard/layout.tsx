import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider } from "@/components/sidebar-context";
import { MainContentWrapper } from "@/components/MainContentWrapper";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserDb } from "@/services/db/multitenant";
import type { Folder } from "@/features/media/types";
import { folders, users } from "@/services/db/schema";
import { db } from "@/services/db";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [userRecord] = await db.select().from(users).where(eq(users.id, userId));
  if (!userRecord) {
    // User exists in JWT but not in DB — DB path mismatch or stale token
    redirect("/login");
  }
  if (!userRecord.hasCompletedSetup) {
    redirect("/setup");
  }

  const { db: userDb } = await getUserDb(userId);

  const allFolders = await userDb.select().from(folders);

  return (
    <SidebarProvider>
      <div className="flex h-dvh bg-app-bg overflow-hidden text-main-text">
        <Sidebar folders={allFolders as Folder[]} />
        <MainContentWrapper>
          {children}
        </MainContentWrapper>
      </div>
    </SidebarProvider>
  );
}
