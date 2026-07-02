/**
 * Utility to crop an image using HTML5 Canvas
 */
export async function getCroppedImg(
 imageSrc: string,
 pixelCrop: { x: number; y: number; width: number; height: number },
 flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
 const image = await createImage(imageSrc);
 const canvas = document.createElement("canvas");
 const ctx = canvas.getContext("2d");

 if (!ctx) {
 return null;
 }

 canvas.width = pixelCrop.width;
 canvas.height = pixelCrop.height;

 ctx.translate(canvas.width / 2, canvas.height / 2);
 ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
 ctx.translate(-canvas.width / 2, -canvas.height / 2);

 ctx.drawImage(
 image,
 pixelCrop.x,
 pixelCrop.y,
 pixelCrop.width,
 pixelCrop.height,
 0,
 0,
 pixelCrop.width,
 pixelCrop.height
 );

 return new Promise((resolve) => {
 canvas.toBlob((blob) => {
 resolve(blob);
 }, "image/jpeg");
 });
}

function createImage(url: string): Promise<HTMLImageElement> {
 return new Promise((resolve, reject) => {
 const image = new Image();
 image.addEventListener("load", () => resolve(image));
 image.addEventListener("error", (error) => reject(error));
 image.setAttribute("crossOrigin", "anonymous");
 image.src = url;
 });
}
