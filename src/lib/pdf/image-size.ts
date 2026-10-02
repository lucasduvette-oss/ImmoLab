/**
 * Dimensions (en pixels) d'une image PNG ou JPEG, lues dans son en-tête sans la décoder.
 * Sert à refuser les images démesurées avant de les placer dans le PDF : une petite image PNG
 * très compressée peut occuper des gigaoctets de mémoire une fois décodée.
 */
export function imageSize(buffer: Buffer): { type: "png" | "jpeg"; width: number; height: number } | null {
  // PNG : signature de 8 octets, puis le bloc IHDR (largeur et hauteur sur 4 octets chacune).
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
    return { type: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // JPEG : on parcourt les segments jusqu'au marqueur « début d'image » (SOF0 à SOF15, sauf DHT, JPG et DAC).
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      if (marker === 0xff) {
        offset++; // octet de remplissage
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2; // marqueurs sans longueur
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpeg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (length < 2) return null;
      offset += 2 + length;
    }
  }
  return null;
}

/** Nombre maximal de pixels accepté pour une image du rapport (≈ 4 000 × 4 000). */
export const MAX_IMAGE_PIXELS = 16_000_000;

/** L'image est-elle un PNG ou un JPEG de taille raisonnable ? */
export function isUsableImage(buffer: Buffer): boolean {
  const size = imageSize(buffer);
  return !!size && size.width > 0 && size.height > 0 && size.width * size.height <= MAX_IMAGE_PIXELS;
}
