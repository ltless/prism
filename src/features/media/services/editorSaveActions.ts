"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "./mediaContext";
import { safeAction, type ActionResult } from "@/core/utils/action";
import { saveEditorBytes } from "./editorSave";

/**
 * Save the editor's canvas output as a new/overwritten media record.
 *   - mediaId: string           — ID of the source MediaItem
 *   - imageBlob: File/Blob      — PNG/JPEG/WebP bytes from canvas.toBlob()
 *   - overwrite: "true"|"false" — overwrite source record OR create copy
 *   - filename: string (optional) — desired filename (defaults to hash-based)
 * The actual overwrite-vs-copy + dedup + transactional file/DB ordering lives
 * in `saveEditorBytes` so it's shared with the base64 entry point.
 */
export async function saveEditorStateAction(
	formData: FormData
): Promise<ActionResult<{ mediaId: string; filePath: string }>> {
	return safeAction<{ mediaId: string; filePath: string }>(
		"saveEditorState",
		async () => {
			const mediaId = formData.get("mediaId");
			const imageBlob = formData.get("imageBlob");
			const overwriteRaw = formData.get("overwrite");
			const overwrite = overwriteRaw === "true";
			const customFilename = formData.get("filename");

			if (typeof mediaId !== "string" || !mediaId) {
				throw new Error("Missing mediaId");
			}
			if (!(imageBlob instanceof Blob)) {
				throw new Error("Missing or invalid imageBlob");
			}

			// Cap at 70MB — canvas can produce large PNGs for high-res images
			const MAX_BYTES = 70 * 1024 * 1024;
			if (imageBlob.size > MAX_BYTES) {
				throw new Error("Payload size exceeds maximum limit");
			}

			const ctx = await getContext();

			const arrayBuf = await imageBlob.arrayBuffer();
			const buffer = Buffer.from(arrayBuf);

			const result = await saveEditorBytes(ctx, {
				mediaId,
				buffer,
				overwrite,
				customFilename: typeof customFilename === "string" && customFilename.length > 0
					? customFilename
					: undefined,
				mimeType: imageBlob.type || undefined,
			});

			revalidatePath("/dashboard");
			return { mediaId: result.mediaId, filePath: result.filePath };
		}
	);
}
