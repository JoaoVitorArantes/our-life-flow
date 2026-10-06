export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Validates type and size before any upload. */
export function validateImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return "Use uma imagem JPG, PNG ou WEBP.";
  if (file.size > MAX_IMAGE_BYTES) return "A imagem deve ter até 8 MB.";
  return null;
}

/** Center-crops to the target ratio and compresses to JPEG. */
export async function compressImage(file: File, width: number, height: number) {
  const bitmap = await createImageBitmap(file);
  const ratio = width / height;
  let sw = bitmap.width;
  let sh = sw / ratio;
  if (sh > bitmap.height) {
    sh = bitmap.height;
    sw = sh * ratio;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(
    bitmap,
    (bitmap.width - sw) / 2,
    (bitmap.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    width,
    height,
  );
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a imagem."))),
      "image/jpeg",
      0.84,
    ),
  );
}

export function compressSquareImage(file: File) {
  return compressImage(file, 640, 640);
}
