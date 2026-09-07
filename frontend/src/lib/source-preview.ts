export async function createSourcePreview(file: File): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();

      const maxDimension = 900;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(image, 0, 0, width, height);
      const preview = canvas.toDataURL("image/jpeg", 0.72);
      return preview.length <= 2 * 1024 * 1024 ? preview : null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}


export function validSourcePreview(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.length <= 2 * 1024 * 1024 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value));
}
