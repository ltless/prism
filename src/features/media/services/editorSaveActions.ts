"use server";

import { revalidatePath } from "next/cache";
import { safeAction, type ActionResult } from "@/core/utils/action";
import { cookies } from "next/headers";

/**
 * Save the editor's canvas output as a new/overwritten media record.
 * Sends the image as multipart to the Go backend /api/v1/media/:id/save-editor.
 */
export async function saveEditorStateAction(
	formData: FormData,
): Promise<ActionResult<{ mediaId: string; filePath: string }>> {
	return safeAction<{ mediaId: string; filePath: string }>(
		"saveEditorState",
		async () => {
			const mediaId = formData.get("mediaId");
			const imageBlob = formData.get("imageBlob");
			const overwriteRaw = formData.get("overwrite");

			if (typeof mediaId !== "string" || !mediaId) {
				throw new Error("Missing mediaId");
			}
			if (!(imageBlob instanceof Blob)) {
				throw new Error("Missing or invalid imageBlob");
			}

			const MAX_BYTES = 70 * 1024 * 1024;
			if (imageBlob.size > MAX_BYTES) {
				throw new Error("Payload size exceeds maximum limit");
			}

			const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";
			const cookieStore = await cookies();
			const token = cookieStore.get("auth_token")?.value;

			const body = new FormData();
			body.append("file", imageBlob, "editor-output.png");
			body.append("overwrite", overwriteRaw === "true" ? "true" : "false");

			const res = await fetch(`${GO_API_URL}/api/v1/media/${mediaId}/save-editor`, {
				method: "POST",
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				body,
				cache: "no-store",
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ error: res.statusText }));
				throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
			}

			const result = await res.json() as { mediaId: string; filePath: string; isNew?: boolean };

			revalidatePath("/dashboard");
			return { mediaId: result.mediaId, filePath: result.filePath };
		},
	);
}
