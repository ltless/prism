import { auth } from "@/auth";
import { media, folders } from "@/services/db/schema";
import { desc, eq, and } from "drizzle-orm";
import VaultLibraryClient from "@/features/media/components/VaultLibraryClient";
import type { MediaItem, Folder } from "@/features/media/types";
import { getUserDb } from "@/services/db/multitenant";
import { getVaultPinStatusAction } from "@/features/profile/services/profileActions";

const PAGE_SIZE = 50;

export default async function VaultPage() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return null;

 const { db } = await getUserDb(userId);

 const items = await db
 .select()
 .from(media)
 .where(and(eq(media.isTrash, false), eq(media.isVault, true)))
 .orderBy(desc(media.createdAt));

 const allFolders = await db.select().from(folders);

 // Check if user has configured their secure Vault PIN
 const statusRes = await getVaultPinStatusAction();
 const hasPin = statusRes.success ? !!statusRes.hasPin : false;

 return (
 <VaultLibraryClient
 initialItems={items as MediaItem[]}
 folders={allFolders as Folder[]}
 totalCount={items.length}
 pageSize={PAGE_SIZE}
 hasPin={hasPin}
 />
 );
}
