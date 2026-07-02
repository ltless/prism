import type { MediaItem } from "../../../../types";

export function parseImageDimensions(item: MediaItem): { width: number; height: number } {
  const dims = { width: 0, height: 0 };
  if (!item.metadata) return dims;
  try {
    const meta =
      typeof item.metadata === "string"
        ? JSON.parse(item.metadata)
        : item.metadata;
    dims.width = meta.width || 0;
    dims.height = meta.height || 0;
  } catch {
    // metadata parse failed; ignore
  }
  return dims;
}
