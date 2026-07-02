import { saveEditorStateAction } from "@/features/media/services/editorSaveActions";
import { useEditorState, type EditorState } from "./state/editorState";
import type { MediaItem } from "@/features/media/types";
import { applyAdjustments } from "./engine/AdjustmentEngine";

/**
 * Render the editor's output onto a fresh canvas at full source resolution.
 *
 * This is used exclusively at save time. The preview canvas is downscaled
 * (max 1920px on longest edge) for 60fps performance; for save we need
 * every pixel of the original image.
 *
 * Pipeline:
 *   1. Fetch original image bytes via URL
 *   2. Create offscreen canvas at original dimensions
 *   3. Draw image at full res
 *   4. Read pixel data, pass through applyAdjustments(state.adjustments, ...)
 *   5. Write pixels back (engine mutates ImageData in place)
 *   6. Apply rotation + flip via canvas.getContext("2d").transform
 *
 * Returns HTMLCanvasElement — caller does .toBlob() to get bytes.
 */
export async function renderFullResCanvas(
  mediaUrl: string,
  editorState: EditorState
): Promise<HTMLCanvasElement> {
  // 1. Fetch original image
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch source image: ${response.status}`);
  }
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);
  const originalWidth = imageBitmap.width;
  const originalHeight = imageBitmap.height;

  // 2. Build transform matrix: rotation + flip applied in destination coords
  //    We want to render the image as it appears on screen (with rotation/flip).
  //    Rotation is in degrees CCW (user-facing slider is 0..360).
  const rotationRad = (-editorState.rotation * Math.PI) / 180; // CSS rotate is CCW positive
  const flipX = editorState.flipH ? -1 : 1;
  const flipY = editorState.flipV ? -1 : 1;

  // Swapped dimensions when rotation is 90/270 (odd quadrant).
  // More generally: use bounding box of the rotated image.
  const cos = Math.abs(Math.cos(rotationRad));
  const sin = Math.abs(Math.sin(rotationRad));
  const rotatedWidth = Math.ceil(originalWidth * cos + originalHeight * sin);
  const rotatedHeight = Math.ceil(originalWidth * sin + originalHeight * cos);

  // 3. Create output canvas at rotated size
  const canvas = document.createElement("canvas");
  canvas.width = rotatedWidth;
  canvas.height = rotatedHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2d context");

  // 4. Center, rotate, flip, then draw
  ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
  ctx.rotate(rotationRad);
  ctx.scale(flipX, flipY);
  ctx.drawImage(
    imageBitmap,
    -originalWidth / 2,
    -originalHeight / 2,
    originalWidth,
    originalHeight
  );

  // 5. Apply adjustments on the pixel data (after transform).
  //    Reordering (e.g. highlights before rotation to dodge sampling
  //    artifacts) is a known maybe-later; not worth the complexity yet.
  const imageData = ctx.getImageData(0, 0, rotatedWidth, rotatedHeight);
  const adjusted = applyAdjustments(editorState.adjustments, imageData);
  ctx.putImageData(adjusted, 0, 0);

  imageBitmap.close();
  return canvas;
}

/**
 * Full save flow: render full-res canvas, convert to Blob, POST to server.
 *
 * Returns the server action result — success indicates save completed,
 * failure contains the error message.
 *
 * Called by the Save UI.
 */
export async function saveEditorState(
  editorState: EditorState,
  mediaItem: MediaItem,
  options: {
    overwrite: boolean;
    /** Image MIME type for canvas.toBlob. Default image/png for lossless. */
    mimeType?: string;
    /** 0..1 quality for lossy formats. Default 0.92 (PNG ignores this). */
    quality?: number;
    /** Optional custom filename passed to server. */
    filename?: string;
  }
) {
  const mediaUrl = `/api/media/${mediaItem.filePath}`;
  const {
    overwrite,
    mimeType = "image/png",
    quality = 0.92,
    filename,
  } = options;

  // Render at full resolution
  const fullResCanvas = await renderFullResCanvas(mediaUrl, editorState);

  // Export canvas to Blob
  const blob: Blob = await new Promise<Blob | null>((resolve) =>
    fullResCanvas.toBlob(resolve, mimeType, quality)
  ).then((b) => {
    if (!b) throw new Error("toBlob returned null");
    return b;
  });

  // Build FormData and POST
  const formData = new FormData();
  formData.append("mediaId", mediaItem.id);
  formData.append("imageBlob", blob, filename ?? `edit${mimeExtension(mimeType)}`);
  formData.append("overwrite", String(overwrite));
  if (filename) formData.append("filename", filename);

  const result = await saveEditorStateAction(formData);

  // Mark editor as clean on successful overwrite (saved over source)
  // For "save as copy", isDirty stays true because the in-memory state
  // hasn't changed — the source record is still the one being edited.
  if (result.success && overwrite) {
    useEditorState.getState().setDirty(false);
  }

  return result;
}

function mimeExtension(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("png")) return ".png";
  return ".png";
}
