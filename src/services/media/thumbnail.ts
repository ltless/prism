import sharp from "sharp";

export async function createThumbnail(input: Buffer, maxWidth = 400, maxHeight = 400): Promise<Buffer> {
  return sharp(input)
    .resize(maxWidth, maxHeight, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
