import { auth } from "@/auth";
import { getUserDb } from "@/services/db/multitenant";

/** Helper to get DB for the current session user */
export async function getContext() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");
 return await getUserDb(userId);
}
