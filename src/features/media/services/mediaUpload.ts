"use server";

import { revalidatePath } from "next/cache";
import { processMediaUpload } from "@/services/media/upload";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";

export async function uploadMediaAction(formData: FormData) {
 return safeAction("uploadMedia", async () => {
 const { db, paths } = await getContext();
 const file = formData.get("file") as File;
 if (!file) throw new Error("No file uploaded");

 const result = await processMediaUpload(file, db, paths.mediaDir, paths.thumbDir);
 if (!result.success) throw new Error(result.error);

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/duplicates");
 return { isDuplicate: result.isDuplicate };
 });
}
