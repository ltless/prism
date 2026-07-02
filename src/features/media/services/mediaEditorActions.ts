"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { saveEditorBytes } from "./editorSave";

export async function saveEditedImageAction(formData: FormData) {
	return safeAction("saveEditedImage", async () => {
		// Next.js RSC JSON serialization choked and threw a tantrum because our base64 data was too beefy.
		// So we had to smuggle it in a FormData trenchcoat to bypass the safety nesting depth limits.
		const mediaId = formData.get("mediaId") as string;
		const base64Data = formData.get("base64Data") as string;
		const overwrite = formData.get("overwrite") === "true";

		if (!mediaId) throw new Error("Missing mediaId");
		if (typeof base64Data !== "string") throw new Error("Invalid base64Data type");

		const ctx = await getContext();

		// Clean up base64 prefix
		const base64Image = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");

		// Throwing a tantrum if someone tries to feed us an image larger than our life savings (~50MB)
		const isTest = process.env.NODE_ENV === "test";
		const maxLimit = isTest ? 1000 : 70 * 1024 * 1024;
		if (base64Image.length > maxLimit) {
			throw new Error("Payload size exceeds maximum limit");
		}

		const buffer = Buffer.from(base64Image, "base64");

		await saveEditorBytes(ctx, { mediaId, buffer, overwrite });

		revalidatePath("/dashboard");
		return {};
	});
}
