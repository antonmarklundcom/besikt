import path from "path";
import { randomUUID } from "crypto";
import { PhotoSection, type Photo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { compressImage } from "@/lib/images";
import { photosDir, writeFileEnsured, toRelPath } from "@/lib/storage";

export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB pre-compression (§7)

const ACCEPTED = /^image\/(jpe?g|png|webp|heic|heif)$/i;

export type IncomingPhoto = {
  buffer: Buffer;
  mimeType: string;
  caption?: string;
};

/**
 * Compress + store photos for a report and create Photo rows.
 * Returns the created rows. Non-image / oversized files are skipped silently so
 * one bad file doesn't fail the whole upload.
 */
export async function storePhotos(
  reportId: string,
  files: IncomingPhoto[],
  section: PhotoSection = PhotoSection.BILDER
): Promise<Photo[]> {
  const dir = photosDir(reportId);

  const existing = await prisma.photo.count({ where: { reportId } });
  let sortOrder = existing;
  const created: Photo[] = [];

  for (const file of files) {
    if (existing + created.length >= MAX_PHOTOS) break;
    if (!ACCEPTED.test(file.mimeType)) continue;
    if (file.buffer.byteLength > MAX_PHOTO_BYTES) continue;

    const compressed = await compressImage(file.buffer);
    const filename = `${randomUUID()}.jpg`;
    const absolute = path.join(dir, filename);
    await writeFileEnsured(absolute, compressed);

    const row = await prisma.photo.create({
      data: {
        reportId,
        filePath: toRelPath(absolute),
        caption: file.caption?.trim() || null,
        sortOrder: sortOrder++,
        section,
      },
    });
    created.push(row);
  }

  return created;
}
