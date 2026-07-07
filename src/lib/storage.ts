import { promises as fs } from "fs";
import path from "path";

// Root storage dir (Hostinger persistent disk in prod). Structure:
//   storage/reports/{reportId}/photos/
//   storage/reports/{reportId}/generated/
export const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(process.cwd(), "storage");

export function reportDir(reportId: string): string {
  return path.join(STORAGE_DIR, "reports", reportId);
}

export function photosDir(reportId: string): string {
  return path.join(reportDir(reportId), "photos");
}

export function generatedDir(reportId: string): string {
  return path.join(reportDir(reportId), "generated");
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/** Absolute path from a stored relative path (paths are stored repo-root-relative). */
export function absPath(relPath: string): string {
  return path.isAbsolute(relPath) ? relPath : path.resolve(process.cwd(), relPath);
}

/** Store a path relative to cwd so it stays portable across deploys. */
export function toRelPath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath);
}

export async function writeFileEnsured(
  filePath: string,
  data: Buffer
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data);
}

/** Delete a file if it exists; never throws on ENOENT. */
export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Recursively delete a report's entire storage directory (GDPR delete). */
export async function removeReportDir(reportId: string): Promise<void> {
  await fs.rm(reportDir(reportId), { recursive: true, force: true });
}
