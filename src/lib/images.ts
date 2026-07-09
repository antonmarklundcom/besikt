import sharp from "sharp";

// Phone photos arrive at 3–8 MB. Resize to max 1600px wide, JPEG q80 (§1).
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 80;

/**
 * Compress an uploaded image buffer to a web-friendly JPEG.
 * Auto-rotates using EXIF orientation, then strips metadata.
 */
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // honour EXIF orientation before we drop metadata
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
